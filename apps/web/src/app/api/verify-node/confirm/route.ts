import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyNodeConfirmSchema } from '@/lib/validations'
import { rateLimit, RATE_LIMITS } from '@/lib/security'
import { VerificationStatus } from '@/lib/verification'

/**
 * Confirm node verification (Step 2 of 2)
 *
 * Called by the Go binary with the verification results.
 * Validates that:
 * 1. Process check passed (daemon running)
 * 2. Port check passed (port listening)
 * 3. Request IP matches init IP (prevents IP spoofing between steps)
 * 4. Request IP matches node IP in crawler DB (proves node ownership)
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Verification result
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit confirm requests (10/hour per IP)
    const rateLimitResult = await rateLimit(request, 'verify-node:confirm', RATE_LIMITS.VERIFY);
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
    const validation = verifyNodeConfirmSchema.safeParse(body);

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

    const { challenge, processCheck, portCheck, systemInfo } = validation.data;

    const supabase = createAdminClient();

    // Find the verification by challenge
    const { data: verification, error: verificationError } = await supabase
      .from('verifications')
      .select(`
        id,
        node_id,
        user_id,
        status,
        expires_at,
        ip_address,
        method,
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

    // Extract request IP (prioritize Cloudflare header for real client IP)
    let requestIp = request.headers.get('cf-connecting-ip') ||
                    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    request.headers.get('x-real-ip') ||
                    'unknown';

    // Handle IPv4 with port (e.g., "192.168.1.1:8080" -> "192.168.1.1")
    // IPv6 has multiple colons, IPv4 with port has exactly one
    const colonCount = (requestIp.match(/:/g) || []).length;
    if (colonCount === 1) {
      // IPv4 with port - strip the port
      requestIp = requestIp.split(':')[0];
    }
    // IPv6 addresses (multiple colons) are kept as-is

    // SECURITY VALIDATION #1: Request IP must match IP from init call
    if (requestIp !== verification.ip_address) {
      console.warn('[VerifyNode:Confirm] IP mismatch with init call', {
        verificationId: verification.id,
        initIp: verification.ip_address,
        confirmIp: requestIp,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'IP address mismatch detected. Init and confirm requests must come from the same IP.',
          code: 'IP_MISMATCH_INIT'
        },
        { status: 403 }
      );
    }

    // Type guard to ensure nodes data exists
    const nodes = verification.nodes;
    if (!nodes || Array.isArray(nodes) || !('ip' in nodes)) {
      console.error('[VerifyNode:Confirm] Invalid nodes data structure:', nodes);
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

    // SECURITY VALIDATION #2: Request IP must match node IP in crawler DB
    if (requestIp !== node.ip) {
      console.warn('[VerifyNode:Confirm] IP mismatch with node database', {
        verificationId: verification.id,
        nodeIp: node.ip,
        requestIp,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'IP address does not match the node in our database. Please run this command on your node server.',
          code: 'IP_MISMATCH_NODE'
        },
        { status: 403 }
      );
    }

    // VALIDATION #3: Process check must pass
    if (!processCheck.found) {
      console.warn('[VerifyNode:Confirm] Process check failed', {
        verificationId: verification.id,
        method: processCheck.method,
      });

      await supabase
        .from('verifications')
        .update({
          status: VerificationStatus.FAILED,
          verified_at: new Date().toISOString(),
          metadata: {
            processCheck,
            portCheck,
            systemInfo,
            failureReason: 'Daemon process not found',
          }
        })
        .eq('id', verification.id);

      return NextResponse.json(
        {
          success: false,
          error: 'Node daemon process not found. Please ensure the daemon is running.',
          code: 'PROCESS_CHECK_FAILED'
        },
        { status: 400 }
      );
    }

    // VALIDATION #4: Port check must pass
    if (!portCheck.listening) {
      console.warn('[VerifyNode:Confirm] Port check failed', {
        verificationId: verification.id,
        port: portCheck.port,
        method: portCheck.method,
      });

      await supabase
        .from('verifications')
        .update({
          status: VerificationStatus.FAILED,
          verified_at: new Date().toISOString(),
          metadata: {
            processCheck,
            portCheck,
            systemInfo,
            failureReason: 'Port not listening',
          }
        })
        .eq('id', verification.id);

      return NextResponse.json(
        {
          success: false,
          error: `Port ${portCheck.port} is not listening. Please ensure your node is running and accepting connections.`,
          code: 'PORT_CHECK_FAILED'
        },
        { status: 400 }
      );
    }

    // All checks passed - update to pending_approval
    const { error: updateError } = await supabase
      .from('verifications')
      .update({
        status: VerificationStatus.PENDING_APPROVAL,
        verified_at: new Date().toISOString(),
        metadata: {
          processCheck,
          portCheck,
          systemInfo,
          requestIp,
        }
      })
      .eq('id', verification.id);

    if (updateError) {
      console.error('[VerifyNode:Confirm] Failed to update verification:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update verification status',
          code: 'UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    // Add to moderation queue for admin review
    const { error: queueError } = await supabase
      .from('moderation_queue')
      .insert({
        item_type: 'verification',
        item_id: verification.id,
        user_id: verification.user_id,
        status: VerificationStatus.PENDING,
        content_data: {
          node_id: verification.node_id,
          method: verification.method,
          challenge: challenge,
          proof: 'Two-step POST verification',
          verification_passed: true,
          processCheck,
          portCheck,
          systemInfo,
        }
      });

    if (queueError) {
      console.error('[VerifyNode:Confirm] Failed to add to moderation queue:', queueError);
      // Don't fail the request - verification is still updated
    }

    console.info('[VerifyNode:Confirm] Verification submitted successfully', {
      verificationId: verification.id,
      nodeId: verification.node_id,
      requestIp,
      processCheck,
      portCheck,
    });

    return NextResponse.json({
      success: true,
      status: VerificationStatus.PENDING_APPROVAL,
      message: 'Verification submitted successfully! An admin will review it shortly.',
    });
  } catch (err) {
    console.error('[VerifyNode:Confirm] Unexpected error:', err);
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
