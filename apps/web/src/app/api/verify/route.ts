import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { verifyInitiateSchema, verifyCompleteSchema } from '@/lib/validations'
import {
  verifyMessageSignature,
  verifyDnsTxt,
  verifyHttpFile,
  parseSignatureProof,
  isValidAddress,
  getNetworkConfig,
  VerificationStatus,
  VerificationMethod,
  VerificationErrorCode
} from '@/lib/verification'
import { rateLimit, RATE_LIMITS } from '@/lib/security'
import { getChain } from '@atlasp2p/config'
import { requireTurnstile } from '@/lib/feature-flags.server'

/**
 * Initiate node verification
 *
 * Creates a verification challenge for proving node ownership.
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Verification challenge and instructions
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit verification attempts
    const rateLimitResult = await rateLimit(request, 'verify:initiate', RATE_LIMITS.VERIFY);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many verification attempts. Please try again later.',
          code: VerificationErrorCode.RATE_LIMIT_EXCEEDED
        },
        { status: 429 }
      );
    }

  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: VerificationErrorCode.AUTHENTICATION_REQUIRED
      },
      { status: 401 }
    )
  }

  const body = await request.json()

  // Validate request body
  const validation = verifyInitiateSchema.safeParse(body)

  if (!validation.success) {
    const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return NextResponse.json(
      {
        error: `Validation failed: ${errors}`,
        code: 'VALIDATION_ERROR'
      },
      { status: 400 }
    )
  }

  const { nodeId, method, turnstileToken } = validation.data

  // Verify Turnstile token if protection is enabled for 'verification' action
  const turnstileError = await requireTurnstile('verification', turnstileToken)
  if (turnstileError) {
    return turnstileError
  }

  // Check if node exists
  const { data: node, error: nodeError } = await supabase
    .from('nodes')
    .select('id, ip, port')
    .eq('id', nodeId)
    .single()

  if (nodeError || !node) {
    return NextResponse.json(
      {
        error: 'Node not found',
        code: VerificationErrorCode.NODE_NOT_FOUND
      },
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
    .eq('status', VerificationStatus.PENDING)
    .single()

  if (existingForUser) {
    return NextResponse.json(
      {
        error: 'You already have a pending verification for this node',
        code: 'VERIFICATION_PENDING'
      },
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
      {
        error: 'This node is already verified',
        code: VerificationErrorCode.ALREADY_VERIFIED
      },
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
      status: VerificationStatus.PENDING,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json(
      {
        error: 'Failed to create verification',
        code: VerificationErrorCode.CREATE_FAILED,
        details: createError.message
      },
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
  } catch (err) {
    console.error('Unexpected error in POST /api/verify:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

function generateChallenge(method: string): string {
  const nonce = randomBytes(16).toString('hex')

  switch (method) {
    case 'message_sign':
      return `node-verify:${nonce}`
    case VerificationMethod.USER_AGENT:
      return `NodeVerify:${nonce.substring(0, 8)}`
    case VerificationMethod.PORT_CHECK:
      return nonce
    case VerificationMethod.DNS_TXT:
      return `node-verify=${nonce}`
    case VerificationMethod.HTTP_FILE:
      return nonce
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
    case VerificationMethod.USER_AGENT:
      return `Add the following to your ${confName} and restart your node:\n\nuseragent=${challenge}\n\nYour node at ${node.ip}:${node.port} will be checked within 24 hours.`
    case VerificationMethod.PORT_CHECK:
      return `Ensure your node at ${node.ip}:${node.port} is accessible. We will verify connectivity and respond to our challenge.`
    case VerificationMethod.DNS_TXT:
      return `Add a DNS TXT record to your domain with this value:\n\n${challenge}\n\nYou can add this to any domain you own (e.g., mynode.example.com or example.com).`
    case VerificationMethod.HTTP_FILE:
      return `Download the verification binary for your OS and run:\n\n./verify ${challenge}\n\nThe server will listen on port 8080 at ${node.ip}:8080 for verification.`
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
  try {
    // Rate limit verification completion attempts
    const rateLimitResult = await rateLimit(request, 'verify:complete', RATE_LIMITS.VERIFY);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many verification attempts. Please try again later.',
          code: VerificationErrorCode.RATE_LIMIT_EXCEEDED
        },
        { status: 429 }
      );
    }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: VerificationErrorCode.AUTHENTICATION_REQUIRED
      },
      { status: 401 }
    )
  }

  const body = await request.json()

  // Validate request body
  const validation = verifyCompleteSchema.safeParse(body)

  if (!validation.success) {
    const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return NextResponse.json(
      {
        error: `Validation failed: ${errors}`,
        code: 'VALIDATION_ERROR'
      },
      { status: 400 }
    )
  }

  const { verificationId, proof, turnstileToken } = validation.data

  // Verify Turnstile token if protection is enabled for 'verification' action
  const turnstileError = await requireTurnstile('verification', turnstileToken)
  if (turnstileError) {
    return turnstileError
  }

  // Get the verification
  const { data: verification, error: fetchError } = await supabase
    .from('verifications')
    .select('*')
    .eq('id', verificationId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !verification) {
    return NextResponse.json(
      {
        error: 'Verification not found',
        code: VerificationErrorCode.VERIFICATION_NOT_FOUND
      },
      { status: 404 }
    )
  }

  if (verification.status !== VerificationStatus.PENDING) {
    return NextResponse.json(
      {
        error: 'Verification is no longer pending',
        code: VerificationErrorCode.INVALID_STATUS
      },
      { status: 400 }
    )
  }

  if (new Date(verification.expires_at) < new Date()) {
    await supabase
      .from('verifications')
      .update({ status: VerificationStatus.EXPIRED })
      .eq('id', verificationId)

    return NextResponse.json(
      {
        error: 'Verification has expired',
        code: VerificationErrorCode.VERIFICATION_EXPIRED
      },
      { status: 410 }
    )
  }

  // Verify based on method
  let isValid = false;
  let errorMessage = '';

  switch (verification.method) {
    case VerificationMethod.MESSAGE_SIGN: {
      /**
       * SECURITY NOTE: Message signature verification proves cryptographic ownership
       * of a wallet address, but does NOT directly prove control of the node.
       *
       * This method assumes the user either:
       * 1. Has RPC access to the node to generate the signature
       * 2. Runs the wallet on the node machine
       * 3. Will be validated by admin approval process
       *
       * For stronger proof of node control, consider requiring:
       * - user_agent + message_sign (combined verification)
       * - port_check + message_sign (combined verification)
       * - Admin verification of operator identity
       *
       * Unlike DNS TXT (which now validates domain→IP resolution),
       * message signing relies on social trust and admin approval.
       */

      // Signature verification requires proof
      if (!proof) {
        return NextResponse.json(
          {
            error: 'Signature proof is required for message_sign verification',
            code: VerificationErrorCode.PROOF_REQUIRED
          },
          { status: 400 }
        )
      }

      // Parse proof format: "address:signature"
      const parsed = parseSignatureProof(proof);
      if (!parsed) {
        return NextResponse.json(
          {
            error: 'Invalid proof format. Expected "address:signature"',
            code: 'INVALID_PROOF_FORMAT'
          },
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
          {
            error: `Invalid address format. Address should start with '${networkConfig.addressPrefix}'`,
            code: VerificationErrorCode.INVALID_ADDRESS
          },
          { status: 400 }
        )
      }

      // Verify the signature with chain-specific config
      const result = await verifyMessageSignature(
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

    case VerificationMethod.DNS_TXT: {
      // DNS TXT verification requires proof (domain name)
      if (!proof) {
        console.warn('[Verification] DNS TXT proof missing', {
          verificationId,
          userId: user.id,
        });
        return NextResponse.json(
          {
            error: 'Domain name is required for dns_txt verification',
            code: 'PROOF_REQUIRED',
          },
          { status: 400 }
        )
      }

      // Validate domain format to prevent SSRF and DNS rebinding attacks
      const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
      const MAX_DOMAIN_LENGTH = 253;

      if (!DOMAIN_REGEX.test(proof) || proof.length > MAX_DOMAIN_LENGTH) {
        console.warn('[Verification] Invalid DNS domain format', {
          verificationId,
          userId: user.id,
          domain: proof.substring(0, 50), // Log truncated domain for security
        });
        return NextResponse.json(
          {
            error: 'Invalid domain format. Please provide a valid domain name (e.g., example.com)',
            code: 'INVALID_DOMAIN_FORMAT',
          },
          { status: 400 }
        )
      }

      // Prevent localhost/private IP lookups (SSRF protection)
      const BLOCKED_DOMAINS = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254', // AWS metadata service
        '169.254', // Link-local
        '10.', // Private network
        '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
        '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', // Private network
        '192.168.', // Private network
      ];

      const lowerDomain = proof.toLowerCase();
      if (BLOCKED_DOMAINS.some(blocked => lowerDomain.includes(blocked))) {
        console.warn('[Verification] Blocked domain attempt (SSRF protection)', {
          verificationId,
          userId: user.id,
          domain: proof,
        });
        return NextResponse.json(
          {
            error: 'Private/local domains are not allowed for verification',
            code: 'DOMAIN_BLOCKED',
          },
          { status: 400 }
        )
      }

      // Get the node's IP address
      const { data: node, error: nodeError } = await supabase
        .from('nodes')
        .select('ip')
        .eq('id', verification.node_id)
        .single();

      if (nodeError || !node) {
        console.error('[Verification] Node not found for DNS verification', {
          verificationId,
          nodeId: verification.node_id,
          error: nodeError?.message,
        });
        return NextResponse.json(
          {
            error: 'Node not found',
            code: 'NODE_NOT_FOUND',
          },
          { status: 404 }
        )
      }

      // Verify DNS TXT record AND IP resolution (SECURITY FIX)
      console.info('[Verification] Verifying DNS TXT record and IP resolution', {
        verificationId,
        userId: user.id,
        domain: proof,
        nodeIp: node.ip,
        challenge: verification.challenge.substring(0, 20) + '...',
      });

      const result = await verifyDnsTxt(proof, verification.challenge, node.ip);
      isValid = result.valid;
      if (!isValid) {
        errorMessage = result.error || 'DNS TXT verification failed';
        console.warn('[Verification] DNS TXT verification failed', {
          verificationId,
          userId: user.id,
          domain: proof,
          error: errorMessage,
        });
      } else {
        console.info('[Verification] DNS TXT verification successful', {
          verificationId,
          userId: user.id,
          domain: proof,
        });
      }
      break;
    }

    case VerificationMethod.HTTP_FILE: {
      // HTTP File verification - Direct proof of node control
      // User runs verification binary on the node, proving:
      // 1. File system access
      // 2. Process execution
      // 3. Network binding capability
      // 4. Direct IP access

      // Get the node's IP address
      const { data: node, error: nodeError } = await supabase
        .from('nodes')
        .select('ip')
        .eq('id', verification.node_id)
        .single();

      if (nodeError || !node) {
        console.error('[Verification] Node not found for HTTP file verification', {
          verificationId,
          nodeId: verification.node_id,
          error: nodeError?.message,
        });
        return NextResponse.json(
          {
            error: 'Node not found',
            code: 'NODE_NOT_FOUND',
          },
          { status: 404 }
        )
      }

      // Verify HTTP file challenge
      console.info('[Verification] Verifying HTTP file challenge', {
        verificationId,
        userId: user.id,
        nodeIp: node.ip,
        challenge: verification.challenge.substring(0, 20) + '...',
      });

      const result = await verifyHttpFile(node.ip, verification.challenge);
      isValid = result.valid;
      if (!isValid) {
        errorMessage = result.error || 'HTTP file verification failed';
        console.warn('[Verification] HTTP file verification failed', {
          verificationId,
          userId: user.id,
          nodeIp: node.ip,
          error: errorMessage,
        });
      } else {
        console.info('[Verification] HTTP file verification successful', {
          verificationId,
          userId: user.id,
          nodeIp: node.ip,
        });
      }
      break;
    }

    case VerificationMethod.USER_AGENT:
    case VerificationMethod.PORT_CHECK: {
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
        {
          error: 'Unknown verification method',
          code: 'UNKNOWN_METHOD'
        },
        { status: 400 }
      )
  }

  // If verification failed, update status to failed
  if (!isValid) {
    await supabase
      .from('verifications')
      .update({
        status: VerificationStatus.FAILED,
        verified_at: new Date().toISOString()
      })
      .eq('id', verificationId)

    return NextResponse.json(
      {
        error: errorMessage || 'Verification failed',
        code: VerificationErrorCode.VERIFICATION_FAILED
      },
      { status: 400 }
    )
  }

  // Verification passed automated checks - send to moderation queue
  const { error: updateError } = await supabase
    .from('verifications')
    .update({
      status: VerificationStatus.PENDING_APPROVAL, // Require admin approval
      verified_at: new Date().toISOString()
    })
    .eq('id', verificationId)

  if (updateError) {
    return NextResponse.json(
      {
        error: 'Failed to update verification',
        code: VerificationErrorCode.UPDATE_FAILED
      },
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
      status: VerificationStatus.PENDING,
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
  } catch (err) {
    console.error('Unexpected error in PUT /api/verify:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * Check for pending verification for a node
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Pending verification or null
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit verification status checks to prevent enumeration attacks
    const rateLimitResult = await rateLimit(request, 'verify:read', RATE_LIMITS.VERIFY);
    if (!rateLimitResult.allowed) {
      console.warn('[Verification] Rate limit exceeded for GET request', {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        endpoint: 'verify:read',
      });
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        { status: 429 }
      );
    }

  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const nodeId = searchParams.get('nodeId')

  if (!nodeId) {
    console.warn('[Verification] GET request missing nodeId parameter');
    return NextResponse.json(
      { error: 'nodeId is required', code: 'MISSING_NODE_ID' },
      { status: 400 }
    )
  }

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.warn('[Verification] GET request unauthorized', {
      error: authError?.message,
    });
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
      { status: 401 }
    )
  }

  // Check for pending or pending_approval verification
  const { data: pending, error } = await supabase
    .from('verifications')
    .select('id, method, challenge, expires_at, status')
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .in('status', [VerificationStatus.PENDING, VerificationStatus.PENDING_APPROVAL])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('[Verification] Failed to query pending verification', {
      nodeId,
      userId: user.id,
      error: error.message,
      code: error.code,
    });
    return NextResponse.json(
      {
        error: 'Failed to check pending verification',
        code: 'DATABASE_ERROR'
      },
      { status: 500 }
    )
  }

  console.info('[Verification] GET request successful', {
    nodeId,
    userId: user.id,
    hasPending: !!pending,
  });

  return NextResponse.json({
    pending: pending || null
  })
  } catch (err) {
    console.error('Unexpected error in GET /api/verify:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * Cancel a pending verification
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Success or error
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limit verification cancellation to prevent abuse
    const rateLimitResult = await rateLimit(request, 'verify:delete', RATE_LIMITS.VERIFY);
    if (!rateLimitResult.allowed) {
      console.warn('[Verification] Rate limit exceeded for DELETE request', {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        endpoint: 'verify:delete',
      });
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        { status: 429 }
      );
    }

  const supabase = await createClient()

  // IMPORTANT: Admin client usage due to missing RLS DELETE policy
  // Migration 0005_fix_verification_delete_policy.sql adds the missing policy:
  //   CREATE POLICY "Users can delete own pending verifications"
  //   ON verifications FOR DELETE USING (auth.uid() = user_id AND status IN ('pending', 'pending_approval'))
  //
  // After migration is deployed, this code can be refactored to use regular client:
  //   const { error } = await supabase.from('verifications').delete().eq('id', verificationId)
  //
  // Current approach (pre-migration): Use admin client + manual authorization check
  const adminClient = createAdminClient()
  const searchParams = request.nextUrl.searchParams
  const verificationId = searchParams.get('verificationId')

  if (!verificationId) {
    console.warn('[Verification] DELETE request missing verificationId parameter');
    return NextResponse.json(
      { error: 'verificationId is required', code: 'MISSING_VERIFICATION_ID' },
      { status: 400 }
    )
  }

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.warn('[Verification] DELETE request unauthorized', {
      error: authError?.message,
      verificationId,
    });
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
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
    console.warn('[Verification] Verification not found for deletion', {
      verificationId,
      userId: user.id,
      error: fetchError?.message,
    });
    return NextResponse.json(
      { error: 'Verification not found', code: 'VERIFICATION_NOT_FOUND' },
      { status: 404 }
    )
  }

  if (verification.user_id !== user.id) {
    console.warn('[Verification] User attempted to delete another user\'s verification', {
      verificationId,
      requestingUserId: user.id,
      verificationUserId: verification.user_id,
    });
    return NextResponse.json(
      { error: 'You can only cancel your own verifications', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  // Allow canceling pending or pending_approval verifications
  if (verification.status !== VerificationStatus.PENDING && verification.status !== VerificationStatus.PENDING_APPROVAL) {
    console.warn('[Verification] Attempted to cancel verification with invalid status', {
      verificationId,
      userId: user.id,
      status: verification.status,
    });
    return NextResponse.json(
      {
        error: `Cannot cancel verification with status: ${verification.status}`,
        code: 'INVALID_STATUS'
      },
      { status: 400 }
    )
  }

  // Delete the verification using admin client (bypasses RLS)
  const { error } = await adminClient
    .from('verifications')
    .delete()
    .eq('id', verificationId)

  if (error) {
    console.error('[Verification] Failed to delete verification', {
      verificationId,
      userId: user.id,
      error: error.message,
      code: error.code,
    });
    return NextResponse.json(
      {
        error: 'Failed to cancel verification',
        code: 'DELETE_FAILED',
        details: error.message
      },
      { status: 500 }
    )
  }

  console.info('[Verification] Verification cancelled successfully', {
    verificationId,
    userId: user.id,
  });

  return NextResponse.json({
    success: true,
    message: 'Verification cancelled'
  })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/verify:', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
