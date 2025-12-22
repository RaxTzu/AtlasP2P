/**
 * Turnstile Configuration Helper
 *
 * Cloudflare Turnstile is a CAPTCHA alternative that helps prevent bots
 * without degrading user experience.
 *
 * This module provides helpers for configuring Turnstile widgets.
 */

import { getFeatureFlags, getProjectConfig } from '@atlasp2p/config';

const featureFlags = getFeatureFlags();

/**
 * Get Turnstile configuration for client-side widget
 */
export function getTurnstileConfig() {
  const config = getProjectConfig();
  return {
    enabled: featureFlags.turnstile.enabled,
    siteKey: featureFlags.turnstile.siteKey,
    mode: config.features.turnstile.mode,
    protectedActions: featureFlags.turnstile.protectedActions,
  };
}

/**
 * Check if Turnstile is properly configured
 */
export function isTurnstileConfigured(): boolean {
  return (
    featureFlags.turnstile.enabled &&
    !!featureFlags.turnstile.siteKey &&
    !!process.env.TURNSTILE_SECRET_KEY
  );
}

/**
 * Check if an action requires Turnstile protection
 */
export function requiresTurnstile(action: string): boolean {
  if (!isTurnstileConfigured()) return false;
  return featureFlags.turnstile.protectedActions.includes(action as any);
}

/**
 * Get Turnstile widget options based on mode
 */
export function getTurnstileWidgetOptions(options?: {
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  tabindex?: number;
}) {
  const config = getTurnstileConfig();

  return {
    sitekey: config.siteKey,
    appearance: config.mode,
    theme: options?.theme || 'auto',
    size: options?.size || 'normal',
    tabindex: options?.tabindex,
  };
}

/**
 * Turnstile widget themes
 */
export const TURNSTILE_THEMES = ['light', 'dark', 'auto'] as const;
export type TurnstileTheme = typeof TURNSTILE_THEMES[number];

/**
 * Turnstile widget sizes
 */
export const TURNSTILE_SIZES = ['normal', 'compact'] as const;
export type TurnstileSize = typeof TURNSTILE_SIZES[number];

/**
 * Turnstile response type
 */
export interface TurnstileResponse {
  token: string;
  timestamp: number;
}
