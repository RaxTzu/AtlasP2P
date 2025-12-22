// ===========================================
// SERVER-SIDE FEATURE FLAGS UTILITIES
// ===========================================
// Helper functions for checking feature flags in API routes and server components
// Now uses unified loader from @atlasp2p/config (YAML + ENV secrets)

import { getFeatureFlags } from '@atlasp2p/config';
import { NextResponse } from 'next/server';
import type { VerificationMethod, TurnstileProtectedAction } from '@atlasp2p/types';

// Re-export for convenience
export { getFeatureFlags };

/**
 * Check if a feature is enabled by path
 * @example isFeatureEnabled('core.authentication')
 */
export function isFeatureEnabled(featurePath: string): boolean {
  const flags = getFeatureFlags();
  const keys = featurePath.split('.');
  let current: any = flags;

  for (const key of keys) {
    if (current === undefined || current === null) {
      return false;
    }
    current = current[key];
  }

  return Boolean(current);
}

/**
 * Check if authentication is required for the current operation
 * Returns a NextResponse with 403 if authentication is disabled
 */
export function requireAuthentication(): NextResponse | null {
  const flags = getFeatureFlags();
  if (!flags.core.authentication) {
    return NextResponse.json(
      {
        error: 'Authentication is disabled',
        message: 'This feature requires authentication to be enabled in the application configuration',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check if node verification is required for the current operation
 * Returns a NextResponse with 403 if verification is disabled
 */
export function requireVerification(): NextResponse | null {
  const flags = getFeatureFlags();
  if (!flags.core.nodeVerification) {
    return NextResponse.json(
      {
        error: 'Node verification is disabled',
        message: 'This feature requires node verification to be enabled in the application configuration',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check if node profiles are enabled
 * Returns a NextResponse with 403 if profiles are disabled
 */
export function requireProfiles(): NextResponse | null {
  const flags = getFeatureFlags();
  if (!flags.core.nodeProfiles) {
    return NextResponse.json(
      {
        error: 'Node profiles are disabled',
        message: 'This feature requires node profiles to be enabled in the application configuration',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check if tipping is enabled
 * Returns a NextResponse with 403 if tipping is disabled
 */
export function requireTipping(): NextResponse | null {
  const flags = getFeatureFlags();
  if (!flags.core.tipping) {
    return NextResponse.json(
      {
        error: 'Tipping is disabled',
        message: 'This feature requires tipping to be enabled in the application configuration',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check if admin mode is enabled
 * Returns a NextResponse with 403 if admin mode is disabled
 */
export function requireAdminMode(): NextResponse | null {
  const flags = getFeatureFlags();
  if (!flags.core.adminMode) {
    return NextResponse.json(
      {
        error: 'Admin mode is disabled',
        message: 'Admin features are disabled in the application configuration',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check if a specific verification method is enabled
 */
export function isVerificationMethodEnabled(method: VerificationMethod): boolean {
  const flags = getFeatureFlags();
  return flags.core.nodeVerification && flags.verification.methods.includes(method);
}

/**
 * Get all enabled verification methods
 */
export function getEnabledVerificationMethods(): VerificationMethod[] {
  const flags = getFeatureFlags();
  return flags.core.nodeVerification ? flags.verification.methods : [];
}

/**
 * Check if Turnstile protection is required for an action
 */
export function isTurnstileRequired(action: TurnstileProtectedAction): boolean {
  const flags = getFeatureFlags();
  return flags.turnstile.enabled && flags.turnstile.protectedActions.includes(action);
}

/**
 * Verify Turnstile token (server-side)
 * @param token - The Turnstile token from the client
 * @returns true if valid, false otherwise
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const flags = getFeatureFlags();

  // If Turnstile is disabled, skip verification
  if (!flags.turnstile.enabled) {
    return true;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('[Turnstile] Secret key not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[Turnstile] Verification failed:', error);
    return false;
  }
}

/**
 * Require Turnstile verification for a protected action
 * Returns a NextResponse with 403 if verification fails
 * @param action - The action being protected
 * @param token - The Turnstile token from the client (optional)
 */
export async function requireTurnstile(
  action: TurnstileProtectedAction,
  token?: string
): Promise<NextResponse | null> {
  const flags = getFeatureFlags();

  // If Turnstile is not enabled for this action, allow the request
  if (!isTurnstileRequired(action)) {
    return null;
  }

  // Token is required if Turnstile is enabled
  if (!token) {
    return NextResponse.json(
      {
        error: 'Turnstile verification required',
        message: 'This action requires bot protection verification',
      },
      { status: 403 }
    );
  }

  // Verify the token
  const isValid = await verifyTurnstileToken(token);
  if (!isValid) {
    return NextResponse.json(
      {
        error: 'Turnstile verification failed',
        message: 'Bot protection verification failed. Please try again.',
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Get verification configuration
 */
export function getVerificationConfig() {
  const flags = getFeatureFlags();
  return flags.verification;
}

/**
 * Get limits configuration
 */
export function getLimitsConfig() {
  const flags = getFeatureFlags();
  return flags.limits;
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitingEnabled(): boolean {
  const flags = getFeatureFlags();
  return flags.limits.rateLimiting;
}

/**
 * Get rate limit configuration (requests per minute)
 */
export function getRateLimitConfig(): { enabled: boolean; requestsPerMinute: number } {
  const flags = getFeatureFlags();
  return {
    enabled: flags.limits.rateLimiting,
    requestsPerMinute: flags.limits.requestsPerMinute,
  };
}

/**
 * Check if an avatar file is valid based on size and format limits
 */
export function isValidAvatarFile(file: File): { valid: boolean; error?: string } {
  const flags = getFeatureFlags();

  // Check file size
  const maxSizeBytes = flags.limits.maxAvatarSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Avatar file size must not exceed ${flags.limits.maxAvatarSizeMB}MB`,
    };
  }

  // Check file format
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !flags.limits.allowedAvatarFormats.includes(extension)) {
    return {
      valid: false,
      error: `Avatar format must be one of: ${flags.limits.allowedAvatarFormats.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Check if a tip amount is valid based on limits
 */
export function isValidTipAmount(amount: number): { valid: boolean; error?: string } {
  const flags = getFeatureFlags();

  if (amount < flags.limits.minTipAmount) {
    return {
      valid: false,
      error: `Tip amount must be at least ${flags.limits.minTipAmount}`,
    };
  }

  if (amount > flags.limits.maxTipAmount) {
    return {
      valid: false,
      error: `Tip amount must not exceed ${flags.limits.maxTipAmount}`,
    };
  }

  return { valid: true };
}

/**
 * Get email configuration (server-side only)
 */
export function getEmailConfig() {
  const flags = getFeatureFlags();
  if (!flags.email.enabled) {
    return null;
  }

  return flags.email;
}

/**
 * Get webhook configuration (server-side only)
 */
export function getWebhookConfig() {
  const flags = getFeatureFlags();
  if (!flags.webhook.enabled) {
    return null;
  }

  return flags.webhook;
}
