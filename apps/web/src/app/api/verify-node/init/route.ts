import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyNodeInitSchema } from '@/lib/validations'
import { rateLimit, RATE_LIMITS } from '@/lib/security'
import { VerificationStatus } from '@/lib/verification'

/**
 * Initialize node verification (Step 1 of 2)
 *
 * Called by the Go binary with the challenge string.
 * Returns the node's IP and port from the crawler database.
 * Stores the request IP for validation in step 2.
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Node IP/port details
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit init requests (10/hour per IP)
    const rateLimitResult = await rateLimit(request, 'verify-node:init', RATE_LIMITS.VERIFY);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many verification attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validation = verifyNodeInitSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${errors}`,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    const { challenge } = validation.data;

    const supabase = await createClient();

    // Find the verification by challenge
    const { data: verification, error: verificationError } = await supabase
      .from('verifications')
      .select(`
        id,
        node_id,
        status,
        expires_at,
        nodes (
          id,
          ip,
          port
        )
      `)
      .eq('challenge', challenge)
      .single();

    if (verificationError || !verification) {
      return NextResponse.json(
        {
          success: false,
          error: 'Verification not found. Please ensure you copied the challenge correctly.',
          code: 'VERIFICATION_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Check if verification is still pending
    if (verification.status !== VerificationStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: `Verification is not pending (current status: ${verification.status})`,
          code: 'INVALID_STATUS'
        },
        { status: 400 }
      );
    }

    // Check if challenge has expired
    if (new Date(verification.expires_at) < new Date()) {
      await supabase
        .from('verifications')
        .update({ status: VerificationStatus.EXPIRED })
        .eq('id', verification.id);

      return NextResponse.json(
        {
          success: false,
          error: 'Verification has expired. Please request a new verification challenge.',
          code: 'VERIFICATION_EXPIRED'
        },
        { status: 410 }
      );
    }

    // Extract request IP (from x-forwarded-for header)
    const requestIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      'unknown';

    // Store the request IP in the verification record for step 2 validation
    const { error: updateError } = await supabase
      .from('verifications')
      .update({ ip_address: requestIp })
      .eq('id', verification.id);

    if (updateError) {
      console.error('[VerifyNode:Init] Failed to update verification with IP:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to store verification data',
          code: 'UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    // Type guard to ensure nodes data exists
    const nodes = verification.nodes;
    if (!nodes || Array.isArray(nodes) || !('ip' in nodes) || !('port' in nodes)) {
      console.error('[VerifyNode:Init] Invalid nodes data structure:', nodes);
      return NextResponse.json(
        {
          success: false,
          error: 'Node data not found in verification',
          code: 'INVALID_NODE_DATA'
        },
        { status: 500 }
      );
    }

    const node = nodes as { id: string; ip: string; port: number };

    console.info('[VerifyNode:Init] Verification init successful', {
      verificationId: verification.id,
      nodeIp: node.ip,
      requestIp,
    });

    // Return node details to the binary
    return NextResponse.json({
      success: true,
      node: {
        ip: node.ip,
        port: node.port,
      },
      message: 'Node details retrieved. Please complete the verification checks.',
    });
  } catch (err) {
    console.error('[VerifyNode:Init] Unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
