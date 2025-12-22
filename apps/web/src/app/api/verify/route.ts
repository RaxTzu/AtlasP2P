import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { verifyInitiateSchema, verifyCompleteSchema } from '@/lib/validations'
import {
  verifyMessageSignature,
  verifyDnsTxt,
  parseSignatureProof,
  isValidAddress,
  getNetworkConfig
} from '@/lib/verification'
import { rateLimit, RATE_LIMITS } from '@/lib/security'
import { getChain } from '@atlasp2p/config'

/**
 * Initiate node verification
 *
 * Creates a verification challenge for proving node ownership.
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Verification challenge and instructions
 */
export async function POST(request: NextRequest) {
  // Rate limit verification attempts
  const rateLimitResult = await rateLimit(request, 'verify:initiate', RATE_LIMITS.VERIFY);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await request.json()

  // Validate request body
  const validation = verifyInitiateSchema.safeParse(body)

  if (!validation.success) {
    const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return NextResponse.json(
      { error: `Validation failed: ${errors}` },
      { status: 400 }
    )
  }

  const { nodeId, method } = validation.data

  // Check if node exists
  const { data: node, error: nodeError } = await supabase
    .from('nodes')
    .select('id, ip, port')
    .eq('id', nodeId)
    .single()

  if (nodeError || !node) {
    return NextResponse.json(
      { error: 'Node not found' },
      { status: 404 }
    )
  }

  // Check if THIS USER already has a pending verification for this node
  // (Allow multiple users to try verifying - first to succeed wins)
  const { data: existingForUser } = await supabase
    .from('verifications')
    .select('id')
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (existingForUser) {
    return NextResponse.json(
      { error: 'You already have a pending verification for this node' },
      { status: 409 }
    )
  }

  // Check if node is already verified
  const { data: alreadyVerified } = await supabase
    .from('verified_nodes')
    .select('id')
    .eq('node_id', nodeId)
    .single()

  if (alreadyVerified) {
    return NextResponse.json(
      { error: 'This node is already verified' },
      { status: 409 }
    )
  }

  // Generate challenge based on method
  const challenge = generateChallenge(method)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour expiry

  // Create verification record
  const { data: verification, error: createError } = await supabase
    .from('verifications')
    .insert({
      node_id: nodeId,
      user_id: user.id,
      method,
      challenge,
      status: 'pending',
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json(
      { error: 'Failed to create verification', details: createError.message },
      { status: 500 }
    )
  }

  // Return instructions based on method
  const instructions = getVerificationInstructions(method, challenge, node)

  return NextResponse.json({
    verification: {
      id: verification.id,
      method,
      challenge,
      expiresAt: expiresAt.toISOString()
    },
    instructions
  })
}

function generateChallenge(method: string): string {
  const nonce = randomBytes(16).toString('hex')

  switch (method) {
    case 'message_sign':
      return `node-verify:${nonce}`
    case 'user_agent':
      return `NodeVerify:${nonce.substring(0, 8)}`
    case 'port_check':
      return nonce
    case 'dns_txt':
      return `node-verify=${nonce}`
    default:
      return nonce
  }
}

function getVerificationInstructions(
  method: string,
  challenge: string,
  node: { ip: string; port: number }
): string {
  // Get chain name from environment for instructions
  const chain = getChain()
  const cliName = `${chain}-cli`
  const confName = `${chain}.conf`

  switch (method) {
    case 'message_sign':
      return `Sign the following message with your node's wallet:\n\n${challenge}\n\nUse: ${cliName} signmessage "<address>" "${challenge}"`
    case 'user_agent':
      return `Add the following to your ${confName} and restart your node:\n\nuseragent=${challenge}\n\nYour node at ${node.ip}:${node.port} will be checked within 24 hours.`
    case 'port_check':
      return `Ensure your node at ${node.ip}:${node.port} is accessible. We will verify connectivity and respond to our challenge.`
    case 'dns_txt':
      return `Add a DNS TXT record to your domain with this value:\n\n${challenge}\n\nYou can add this to any domain you own (e.g., mynode.example.com or example.com).`
    default:
      return 'Unknown verification method'
  }
}

/**
 * Complete node verification
 *
 * Submits proof for a pending verification challenge.
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Verification result
 */
export async function PUT(request: NextRequest) {
  // Rate limit verification completion attempts
  const rateLimitResult = await rateLimit(request, 'verify:complete', RATE_LIMITS.VERIFY);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await request.json()

  // Validate request body
  const validation = verifyCompleteSchema.safeParse(body)

  if (!validation.success) {
    const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return NextResponse.json(
      { error: `Validation failed: ${errors}` },
      { status: 400 }
    )
  }

  const { verificationId, proof } = validation.data

  // Get the verification
  const { data: verification, error: fetchError } = await supabase
    .from('verifications')
    .select('*')
    .eq('id', verificationId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !verification) {
    return NextResponse.json(
      { error: 'Verification not found' },
      { status: 404 }
    )
  }

  if (verification.status !== 'pending') {
    return NextResponse.json(
      { error: 'Verification is no longer pending' },
      { status: 400 }
    )
  }

  if (new Date(verification.expires_at) < new Date()) {
    await supabase
      .from('verifications')
      .update({ status: 'expired' })
      .eq('id', verificationId)

    return NextResponse.json(
      { error: 'Verification has expired' },
      { status: 410 }
    )
  }

  // Verify based on method
  let isValid = false;
  let errorMessage = '';

  switch (verification.method) {
    case 'message_sign': {
      // Signature verification requires proof
      if (!proof) {
        return NextResponse.json(
          { error: 'Signature proof is required for message_sign verification' },
          { status: 400 }
        )
      }

      // Parse proof format: "address:signature"
      const parsed = parseSignatureProof(proof);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid proof format. Expected "address:signature"' },
          { status: 400 }
        )
      }

      const { address, signature } = parsed;

      // Get chain from environment for network config
      const chain = getChain();
      const networkConfig = getNetworkConfig(chain);

      // Validate address format
      if (!isValidAddress(address, networkConfig.addressPrefix)) {
        return NextResponse.json(
          { error: `Invalid address format. Address should start with '${networkConfig.addressPrefix}'` },
          { status: 400 }
        )
      }

      // Verify the signature with chain-specific config
      const result = verifyMessageSignature(
        verification.challenge,
        address,
        signature,
        networkConfig
      );

      isValid = result.valid;
      if (!isValid) {
        errorMessage = result.error || 'Signature verification failed';
      }
      break;
    }

    case 'dns_txt': {
      // DNS TXT verification requires proof (domain name)
      if (!proof) {
        return NextResponse.json(
          { error: 'Domain name is required for dns_txt verification' },
          { status: 400 }
        )
      }

      // Get the node's IP address
      const { data: node } = await supabase
        .from('nodes')
        .select('ip')
        .eq('id', verification.node_id)
        .single();

      if (!node) {
        return NextResponse.json(
          { error: 'Node not found' },
          { status: 404 }
        )
      }

      // Verify DNS TXT record
      const result = await verifyDnsTxt(proof, verification.challenge);
      isValid = result.valid;
      if (!isValid) {
        errorMessage = result.error || 'DNS TXT verification failed';
      }
      break;
    }

    case 'user_agent':
    case 'port_check': {
      // These methods are verified automatically by the crawler
      // Check if crawler has updated the verification status
      // For now, we'll accept the submission and let the crawler verify
      return NextResponse.json({
        success: true,
        message: 'Verification request received. Your node will be checked by our crawler within 24 hours.',
        pendingAutomaticVerification: true
      })
    }

    default:
      return NextResponse.json(
        { error: 'Unknown verification method' },
        { status: 400 }
      )
  }

  // If verification failed, update status to failed
  if (!isValid) {
    await supabase
      .from('verifications')
      .update({
        status: 'failed',
        verified_at: new Date().toISOString()
      })
      .eq('id', verificationId)

    return NextResponse.json(
      { error: errorMessage || 'Verification failed' },
      { status: 400 }
    )
  }

  // Verification passed automated checks - send to moderation queue
  const { error: updateError } = await supabase
    .from('verifications')
    .update({
      status: 'pending_approval', // Require admin approval
      verified_at: new Date().toISOString()
    })
    .eq('id', verificationId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update verification' },
      { status: 500 }
    )
  }

  // Add to moderation queue for admin review
  await supabase
    .from('moderation_queue')
    .insert({
      item_type: 'verification',
      item_id: verificationId,
      user_id: user.id,
      status: 'pending',
      content_data: {
        node_id: verification.node_id,
        method: verification.method,
        challenge: verification.challenge,
        proof: proof || 'Auto-verified',
        verification_passed: true
      }
    })

  return NextResponse.json({
    success: true,
    message: 'Verification submitted successfully. An admin will review it shortly.',
    requiresAdminApproval: true
  })
}

/**
 * Check for pending verification for a node
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Pending verification or null
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const nodeId = searchParams.get('nodeId')

  if (!nodeId) {
    return NextResponse.json(
      { error: 'nodeId is required' },
      { status: 400 }
    )
  }

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Check for pending or pending_approval verification
  const { data: pending, error } = await supabase
    .from('verifications')
    .select('id, method, challenge, expires_at, status')
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .in('status', ['pending', 'pending_approval'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    return NextResponse.json(
      { error: 'Failed to check pending verification' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    pending: pending || null
  })
}

/**
 * Cancel a pending verification
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Success or error
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient() // Use admin client to bypass RLS for delete
  const searchParams = request.nextUrl.searchParams
  const verificationId = searchParams.get('verificationId')

  if (!verificationId) {
    return NextResponse.json(
      { error: 'verificationId is required' },
      { status: 400 }
    )
  }

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // First check if the verification exists and belongs to user (using admin client to bypass RLS)
  const { data: verification, error: fetchError } = await adminClient
    .from('verifications')
    .select('id, status, user_id')
    .eq('id', verificationId)
    .single()

  if (fetchError || !verification) {
    console.error('Verification fetch error:', fetchError)
    return NextResponse.json(
      { error: 'Verification not found' },
      { status: 404 }
    )
  }

  if (verification.user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only cancel your own verifications' },
      { status: 403 }
    )
  }

  // Allow canceling pending or pending_approval verifications
  if (verification.status !== 'pending' && verification.status !== 'pending_approval') {
    return NextResponse.json(
      { error: `Cannot cancel verification with status: ${verification.status}` },
      { status: 400 }
    )
  }

  // Delete the verification using admin client (bypasses RLS)
  const { error } = await adminClient
    .from('verifications')
    .delete()
    .eq('id', verificationId)

  if (error) {
    console.error('Failed to delete verification:', error)
    return NextResponse.json(
      { error: 'Failed to cancel verification', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Verification cancelled'
  })
}
