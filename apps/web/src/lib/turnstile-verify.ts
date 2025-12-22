/**
 * Turnstile Server-Side Verification
 *
 * Verifies Turnstile tokens on the server using Cloudflare's API.
 * This should ONLY be used in API routes or server actions.
 */

import { getFeatureFlags } from '@atlasp2p/config';

/**
 * Turnstile verification response from Cloudflare
 */
interface TurnstileVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

/**
 * Verify a Turnstile token with Cloudflare
 *
 * @param token - The token returned from the Turnstile widget
 * @param remoteIp - Optional IP address of the user (for additional validation)
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  const featureFlags = getFeatureFlags();
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Check if Turnstile is configured
  if (!featureFlags.turnstile.enabled) {
    return { success: true }; // Turnstile disabled, allow through
  }

  if (!secretKey) {
    console.error('Turnstile is enabled but secret key is not configured');
    return { success: false, error: 'Turnstile misconfigured' };
  }

  try {
    // Build request body
    const body = new URLSearchParams();
    body.append('secret', secretKey);
    body.append('response', token);

    if (remoteIp) {
      body.append('remoteip', remoteIp);
    }

    // Call Cloudflare's verification endpoint
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('Turnstile verification request failed:', response.status);
      return { success: false, error: 'Verification request failed' };
    }

    const data: TurnstileVerificationResponse = await response.json();

    if (!data.success) {
      const errorCodes = data['error-codes']?.join(', ') || 'Unknown error';
      console.warn('Turnstile verification failed:', errorCodes);
      return {
        success: false,
        error: getTurnstileErrorMessage(data['error-codes']),
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      success: false,
      error: 'Verification failed',
    };
  }
}

/**
 * Get user-friendly error message from Turnstile error codes
 */
function getTurnstileErrorMessage(errorCodes?: string[]): string {
  if (!errorCodes || errorCodes.length === 0) {
    return 'Verification failed';
  }

  const code = errorCodes[0];

  const errorMessages: Record<string, string> = {
    'missing-input-secret': 'Server configuration error',
    'invalid-input-secret': 'Server configuration error',
    'missing-input-response': 'Please complete the verification',
    'invalid-input-response': 'Verification failed - please try again',
    'bad-request': 'Invalid request',
    'timeout-or-duplicate': 'Verification expired - please try again',
  };

  return errorMessages[code] || 'Verification failed';
}

/**
 * Middleware helper to verify Turnstile token from request
 * Extracts token from Authorization header or body
 */
export async function verifyRequestTurnstile(request: Request): Promise<{
  success: boolean;
  error?: string;
}> {
  const featureFlags = getFeatureFlags();

  // Check if Turnstile is enabled
  if (!featureFlags.turnstile.enabled) {
    return { success: true };
  }

  try {
    // Try to get token from header
    let token = request.headers.get('cf-turnstile-response');

    // If not in header, try body
    if (!token) {
      const contentType = request.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const body = await request.json();
        token = body.turnstileToken || body.cfTurnstileResponse;
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const body = await request.formData();
        token = body.get('turnstileToken') as string || body.get('cfTurnstileResponse') as string;
      }
    }

    if (!token) {
      return {
        success: false,
        error: 'Verification token missing',
      };
    }

    // Get client IP
    const remoteIp = request.headers.get('cf-connecting-ip') ||
                      request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip');

    return await verifyTurnstileToken(token, remoteIp || undefined);
  } catch (error) {
    console.error('Error verifying Turnstile from request:', error);
    return {
      success: false,
      error: 'Verification failed',
    };
  }
}

/**
 * API route helper - returns standardized error response
 */
export function createTurnstileErrorResponse(error?: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Verification failed',
      message: error || 'Please complete the verification challenge',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
