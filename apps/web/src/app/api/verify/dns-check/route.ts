import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyDnsTxt } from '@/lib/verification'
import { rateLimit, RATE_LIMITS } from '@/lib/security'

/**
 * Check DNS TXT record for a pending verification
 *
 * This endpoint can be polled to check if DNS has propagated.
 * Rate limited to prevent abuse.
 */
export async function POST(request: NextRequest) {
  // Rate limit DNS check attempts (same as verification)
  const rateLimitResult = await rateLimit(request, 'verify:dns-check', RATE_LIMITS.VERIFY);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many DNS check attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { verificationId, domain } = body

  if (!verificationId || !domain) {
    return NextResponse.json(
      { error: 'verificationId and domain are required' },
      { status: 400 }
    )
  }

  // Get the verification with node details (using admin client to bypass RLS)
  const { data: verification, error: fetchError } = await adminClient
    .from('verifications')
    .select('*, nodes!inner(ip, port)')
    .eq('id', verificationId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !verification) {
    return NextResponse.json(
      { error: 'Verification not found' },
      { status: 404 }
    )
  }

  if (verification.method !== 'dns_txt') {
    return NextResponse.json(
      { error: 'This endpoint is only for DNS verification' },
      { status: 400 }
    )
  }

  if (verification.status !== 'pending') {
    return NextResponse.json(
      { error: 'Verification is no longer pending', status: verification.status },
      { status: 400 }
    )
  }

  if (new Date(verification.expires_at) < new Date()) {
    // Mark as expired
    await adminClient
      .from('verifications')
      .update({ status: 'expired' })
      .eq('id', verificationId)

    return NextResponse.json(
      { error: 'Verification has expired' },
      { status: 410 }
    )
  }

  // Get node IP
  const nodeIp = verification.nodes?.ip || verification.nodes?.[0]?.ip;
  if (!nodeIp) {
    return NextResponse.json(
      { error: 'Node IP not found' },
      { status: 500 }
    )
  }

  // Check DNS TXT record AND IP resolution (SECURITY FIX)
  const result = await verifyDnsTxt(domain, verification.challenge, nodeIp)

  if (!result.valid) {
    return NextResponse.json({
      verified: false,
      message: result.error || 'DNS TXT record not found or does not match challenge',
      challenge: verification.challenge,
      domain
    })
  }

  // DNS verification passed! Update to pending_approval
  const { error: updateError } = await adminClient
    .from('verifications')
    .update({
      status: 'pending_approval',
      verified_at: new Date().toISOString()
    })
    .eq('id', verificationId)

  if (updateError) {
    console.error('Failed to update verification:', updateError)
    return NextResponse.json(
      { error: 'Failed to update verification status' },
      { status: 500 }
    )
  }

  // Add to moderation queue
  await adminClient
    .from('moderation_queue')
    .insert({
      item_type: 'verification',
      item_id: verificationId,
      user_id: user.id,
      status: 'pending',
      content_data: {
        node_id: verification.node_id,
        method: 'dns_txt',
        challenge: verification.challenge,
        proof: domain,
        verification_passed: true
      }
    })

  return NextResponse.json({
    verified: true,
    message: 'DNS verification successful! Awaiting admin approval.',
    requiresAdminApproval: true
  })
}
