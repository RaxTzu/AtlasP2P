// ===========================================
// EDGE RUNTIME CONFIG (AUTO-GENERATED)
// ===========================================
// Generated from config/project.config.yaml
// DO NOT EDIT - Run 'pnpm generate:edge-config' to regenerate
//
// This file contains ONLY what Edge runtime needs.
// Edge runtime (middleware) cannot access Node.js modules,
// so we pre-generate this static file at build time.

/**
 * Minimal config for Edge runtime (middleware)
 * Contains only feature flags needed by middleware
 */
export const edgeConfig = {
  /**
   * Whether authentication is enabled
   * From: features.core.authentication in project.config.yaml
   */
  authenticationEnabled: true,
} as const;

export type EdgeConfig = typeof edgeConfig;
