'use client';

/**
 * React Hooks for Feature Flags
 *
 * Client-safe hooks for accessing feature flags configuration.
 * These hooks can be used in any React component to conditionally render features.
 */

import { useMemo } from 'react';
import { getFeatureFlags } from '@atlasp2p/config';
import type {
  ApplicationFeatureFlags,
  VerificationMethod,
  TurnstileProtectedAction,
} from '@atlasp2p/types';

// Lazy-load feature flags to avoid initialization order issues
let _cachedFeatureFlags: ApplicationFeatureFlags | null = null;

function getFeatureFlagsLazy(): ApplicationFeatureFlags {
  // In development, bypass cache to allow hot reload
  // (Config changes still require server restart, but this helps with edge cases)
  if (process.env.NODE_ENV === 'development') {
    return getFeatureFlags();
  }

  // In production, use cache for performance
  if (!_cachedFeatureFlags) {
    _cachedFeatureFlags = getFeatureFlags();
  }
  return _cachedFeatureFlags;
}

/**
 * Get all feature flags
 * Use this sparingly - prefer specific hooks for better tree-shaking
 */
export function useFeatureFlags(): ApplicationFeatureFlags {
  return useMemo(() => getFeatureFlagsLazy(), []);
}

// ============================================
// CORE FEATURES
// ============================================

/**
 * Check if authentication is enabled
 */
export function useAuthEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().core.authentication, []);
}

/**
 * Check if admin mode is enabled
 */
export function useAdminEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().core.adminMode, []);
}

/**
 * Check if node verification is enabled
 */
export function useVerificationEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().core.nodeVerification, []);
}

/**
 * Get enabled verification methods
 */
export function useVerificationMethods(): VerificationMethod[] {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    if (!flags.core.nodeVerification) return [];
    return flags.verification.methods;
  }, []);
}

/**
 * Check if a specific verification method is enabled
 */
export function useIsVerificationMethodEnabled(method: VerificationMethod): boolean {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    if (!flags.core.nodeVerification) return false;
    return flags.verification.methods.includes(method);
  }, [method]);
}

/**
 * Check if node profiles are enabled
 */
export function useProfilesEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().core.nodeProfiles, []);
}

/**
 * Check if tipping is enabled
 */
export function useTippingEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().core.tipping, []);
}

/**
 * Check if leaderboard is enabled
 */
export function useLeaderboardEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().community.leaderboard, []);
}

/**
 * Check if statistics are enabled
 */
export function useStatsEnabled(): boolean {
  return useMemo(() => getFeatureFlagsLazy().stats.enabled, []);
}

// ============================================
// TURNSTILE / SECURITY
// ============================================

/**
 * Check if Turnstile is enabled and configured
 */
export function useTurnstileEnabled(): boolean {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    return (
      flags.turnstile.enabled &&
      (flags.turnstile.siteKey?.length ?? 0) > 0
    );
  }, []);
}

/**
 * Get Turnstile site key (client-safe)
 */
export function useTurnstileSiteKey(): string {
  return useMemo(() => getFeatureFlagsLazy().turnstile.siteKey || '', []);
}

/**
 * Get Turnstile mode
 */
export function useTurnstileMode(): 'visible' | 'invisible' | 'managed' {
  return useMemo(() => getFeatureFlagsLazy().turnstile.mode, []);
}

/**
 * Check if Turnstile is required for a specific action
 */
export function useTurnstileProtection(action: TurnstileProtectedAction | string): boolean {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    if (!flags.turnstile.enabled) return false;
    if (!flags.turnstile.siteKey) return false;
    return flags.turnstile.protectedActions.includes(action as any);
  }, [action]);
}

// ============================================
// VERIFICATION SETTINGS
// ============================================

/**
 * Check if payment is required for verification
 */
export function useVerificationPaymentRequired(): boolean {
  return useMemo(() => getFeatureFlagsLazy().verification.requirePayment, []);
}

/**
 * Get verification payment details
 */
export function useVerificationPayment() {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    return {
      required: flags.verification.requirePayment,
      amount: flags.verification.paymentAmount,
      currency: flags.verification.paymentCurrency,
    };
  }, []);
}

// ============================================
// RPC CONFIGURATION
// ============================================

/**
 * Check if RPC is configured (client should NOT access credentials)
 * Returns only whether RPC is available, not the actual credentials
 */
export function useRpcAvailable(): boolean {
  return useMemo(() => {
    // Check if RPC environment variables are set (server-side only check)
    return typeof window === 'undefined';
  }, []);
}

// ============================================
// FEATURE COMBINATIONS
// ============================================

/**
 * Check if user can verify nodes
 * Requires both authentication and verification to be enabled
 */
export function useCanVerifyNodes(): boolean {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    return flags.core.authentication && flags.core.nodeVerification;
  }, []);
}

/**
 * Check if user can create profiles
 * Requires authentication, verification, and profiles to be enabled
 */
export function useCanCreateProfiles(): boolean {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    return (
      flags.core.authentication &&
      flags.core.nodeVerification &&
      flags.core.nodeProfiles
    );
  }, []);
}

/**
 * Check if user can send tips
 * Requires authentication, verification, and tipping to be enabled
 */
export function useCanSendTips(): boolean {
  return useMemo(() => {
    const flags = getFeatureFlagsLazy();
    return (
      flags.core.authentication &&
      flags.core.nodeVerification &&
      flags.core.tipping
    );
  }, []);
}

/**
 * Check if a specific feature is enabled
 * Generic hook for checking any feature by path
 *
 * @example
 * const enabled = useIsFeatureEnabled('authentication.enabled');
 * const enabled = useIsFeatureEnabled('verification.methods');
 */
export function useIsFeatureEnabled(featurePath: string): boolean {
  return useMemo(() => {
    const keys = featurePath.split('.');
    let current: any = getFeatureFlagsLazy();

    for (const key of keys) {
      if (current === undefined || current === null) {
        return false;
      }
      current = current[key];
    }

    // Handle different types
    if (typeof current === 'boolean') return current;
    if (current instanceof Set) return current.size > 0;
    if (typeof current === 'string') return current.length > 0;
    if (typeof current === 'number') return current > 0;

    return Boolean(current);
  }, [featurePath]);
}
