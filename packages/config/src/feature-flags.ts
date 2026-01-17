// ===========================================
// UNIFIED FEATURE FLAGS LOADER
// ===========================================
// Single source of truth: YAML for config, ENV for secrets
// This replaces the old ENV-based loader with YAML-based approach

import { getProjectConfig } from './loader';
import type {
  ApplicationFeatureFlags,
  VerificationMethod,
  FeatureFlags,
} from '@atlasp2p/types';

let _cachedFlags: ApplicationFeatureFlags | null = null;

/**
 * Build verification methods array from YAML boolean flags
 */
function buildVerificationMethods(verification: FeatureFlags['verification']): VerificationMethod[] {
  const methods: VerificationMethod[] = [];

  if (verification.methods.messageSign) methods.push('message_sign');
  if (verification.methods.userAgent) methods.push('user_agent');
  if (verification.methods.portChallenge) methods.push('port_challenge');
  if (verification.methods.dnsTxt) methods.push('dns_txt');
  if (verification.methods.httpFile) methods.push('http_file');

  // Default to message_sign if no methods enabled
  return methods.length > 0 ? methods : ['message_sign'];
}

/**
 * Load feature flags from YAML config + ENV secrets
 * YAML = all configuration, ENV = secrets only
 */
export function getFeatureFlags(): ApplicationFeatureFlags {
  // Return cached if available (for performance)
  if (_cachedFlags) return _cachedFlags;

  // Load project config from YAML
  const config = getProjectConfig();
  const yaml = config.features;
  const admin = config.adminConfig;

  // Build complete feature flags object
  _cachedFlags = {
    // Core features
    core: {
      adminMode: true, // Always enabled, controlled by user roles
      authentication: true, // Always enabled for user features
      nodeVerification: yaml.verification.enabled,
      nodeProfiles: yaml.verification.enabled, // Profiles require verification
      tipping: yaml.tipping.enabled,
    },

    // Verification configuration
    verification: {
      methods: buildVerificationMethods(yaml.verification),
      requirePayment: yaml.verification.requirePayment,
      paymentAmount: yaml.verification.paymentAmount,
      paymentCurrency: yaml.verification.paymentCurrency,
      challengeExpiryHours: yaml.verification.challengeExpiryHours,
      autoApprove: yaml.verification.autoApprove,
    },

    // Turnstile (site key and mode from YAML, secret key from ENV)
    turnstile: {
      enabled: yaml.turnstile.enabled,
      siteKey: yaml.turnstile.siteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null,
      mode: yaml.turnstile.mode || 'invisible',
      protectedActions: yaml.turnstile.protectedActions as any[],
    },

    // Map features
    map: {
      enabled: yaml.map.enabled,
      clustering: yaml.map.clustering,
      heatmap: yaml.map.heatmap,
      liveUpdates: yaml.map.liveUpdates,
    },

    // Statistics
    stats: {
      enabled: yaml.stats.enabled,
      versionChart: yaml.stats.versionChart,
      countryChart: yaml.stats.countryChart,
      healthScore: yaml.stats.healthScore,
    },

    // Filters
    filters: {
      byCountry: yaml.filters.byCountry,
      byVersion: yaml.filters.byVersion,
      byTier: yaml.filters.byTier,
      byStatus: yaml.filters.byStatus,
      search: yaml.filters.search,
    },

    // Node features
    nodes: {
      categories: yaml.nodes.categories,
      rankings: yaml.nodes.rankings,
      uptimeTracking: yaml.nodes.uptimeTracking,
      historicalData: yaml.nodes.historicalData,
    },

    // Community features
    community: {
      nodeSubmission: yaml.community.nodeSubmission,
      leaderboard: yaml.community.leaderboard,
      badges: yaml.community.badges,
    },

    // UI features
    ui: {
      darkMode: yaml.ui.darkMode,
      themeSwitcher: yaml.ui.themeSwitcher,
    },

    // Tipping features
    tipping: {
      enabled: yaml.tipping.enabled,
      tracking: yaml.tipping.tracking,
      acceptedCoins: yaml.tipping.acceptedCoins || ['DINGO', 'BTC', 'LTC', 'DOGE', 'ETH'],
    },

    // Limits and restrictions
    limits: {
      rateLimiting: yaml.limits.rateLimiting,
      requestsPerMinute: yaml.limits.requestsPerMinute,
      maxNodesPerUser: yaml.limits.maxNodesPerUser,
      maxAvatarSizeMB: yaml.limits.maxAvatarSizeMB,
      allowedAvatarFormats: yaml.limits.allowedAvatarFormats,
      minTipAmount: yaml.limits.minTipAmount,
      maxTipAmount: yaml.limits.maxTipAmount,
    },

    // Analytics
    analytics: {
      enabled: yaml.analytics.enabled,
      provider: yaml.analytics.provider as any,
      domain: yaml.analytics.domain,
    },

    // Error tracking (DSN from ENV)
    errorTracking: {
      enabled: yaml.errorTracking.enabled,
      dsn: process.env.SENTRY_DSN || null,
    },

    // Performance monitoring
    performance: {
      enabled: yaml.performance.enabled,
      showMetrics: yaml.performance.showMetrics,
    },

    // Email configuration (provider/settings from YAML, credentials from ENV)
    email: {
      enabled: admin.email.provider !== 'disabled',
      smtp: admin.email.provider === 'smtp' ? {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        fromEmail: admin.email.fromEmail,
        fromName: admin.email.fromName,
      } : undefined,
    },

    // Webhook notifications
    webhook: {
      enabled: false, // Not yet implemented
      url: process.env.WEBHOOK_URL,
    },

    // API access
    api: {
      publicAPI: yaml.api.publicAPI,
      apiKeys: yaml.api.apiKeys,
    },

    // Data export
    dataExport: {
      enabled: yaml.dataExport.enabled,
      formats: yaml.dataExport.formats as any[],
    },

    // Realtime features
    realtime: {
      enabled: yaml.realtime.enabled,
      updateIntervalSeconds: yaml.realtime.updateIntervalSeconds,
    },

    // Debug mode (YAML config or auto-enable in development)
    debug: {
      enabled: yaml.debug.enabled || process.env.NODE_ENV === 'development',
    },
  };

  return _cachedFlags;
}

/**
 * Clear cached flags (useful for testing or hot reload)
 */
export function clearFeatureFlagsCache() {
  _cachedFlags = null;
}

/**
 * Validate configuration on startup (server-side only)
 */
export function validateFeatureFlags(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const flags = getFeatureFlags();

  // Check authentication dependency
  if (flags.core.nodeVerification && !flags.core.authentication) {
    errors.push('Node verification requires authentication to be enabled');
  }

  if (flags.core.nodeProfiles && !flags.core.nodeVerification) {
    errors.push('Node profiles require verification to be enabled');
  }

  // Check Turnstile configuration
  if (flags.turnstile.enabled) {
    if (!flags.turnstile.siteKey) {
      errors.push('Turnstile enabled but siteKey is missing in project.config.yaml');
    }
    if (!process.env.TURNSTILE_SECRET_KEY) {
      errors.push('Turnstile enabled but TURNSTILE_SECRET_KEY is missing in .env');
    }
  }

  // Check email configuration
  if (flags.email.enabled) {
    const config = getProjectConfig();
    const emailConfig = config.adminConfig.email;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, require API keys. In development, allow empty keys (emails just won't send)
    if (emailConfig.provider === 'resend' && isProduction && !process.env.RESEND_API_KEY) {
      errors.push('Email provider is "resend" but RESEND_API_KEY is missing in .env (required in production)');
    }
    if (emailConfig.provider === 'sendgrid' && isProduction && !process.env.SENDGRID_API_KEY) {
      errors.push('Email provider is "sendgrid" but SENDGRID_API_KEY is missing in .env (required in production)');
    }
    if (emailConfig.provider === 'smtp') {
      if (!process.env.SMTP_HOST) {
        errors.push('Email provider is "smtp" but SMTP_HOST is missing in .env');
      }
      // SMTP_USER and SMTP_PASSWORD are optional (e.g., for local inbucket testing)
    }
  }

  // Check error tracking
  if (flags.errorTracking.enabled && !flags.errorTracking.dsn) {
    errors.push('Error tracking enabled but SENTRY_DSN is missing in .env');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print feature flags configuration (useful for debugging)
 * Server-side only - safe to call in Node.js environment
 */
export function printFeatureFlags(): void {
  // Check if we're in a browser environment
  if (typeof global === 'undefined') return;

  const flags = getFeatureFlags();
  const validation = validateFeatureFlags();

  console.log('📋 Feature Flags Configuration (from project.config.yaml):');
  console.log('  Authentication:', flags.core.authentication ? '✅' : '❌');
  console.log('  Node Verification:', flags.core.nodeVerification ? '✅' : '❌');
  if (flags.core.nodeVerification) {
    console.log('    Methods:', flags.verification.methods.join(', '));
  }
  console.log('  Node Profiles:', flags.core.nodeProfiles ? '✅' : '❌');
  console.log('  Tipping:', flags.core.tipping ? '✅' : '❌');
  console.log('  Leaderboard:', flags.community.leaderboard ? '✅' : '❌');
  console.log('  Statistics:', flags.stats.enabled ? '✅' : '❌');
  console.log('  Turnstile:', flags.turnstile.enabled ? '✅' : '❌');
  console.log('  Email:', flags.email.enabled ? '✅' : '❌');

  if (!validation.valid) {
    console.warn('⚠️  Configuration Warnings:');
    validation.errors.forEach(error => console.warn(`  - ${error}`));
  }
}

// NOTE: Do NOT auto-print feature flags at module level
// printFeatureFlags() is called from instrumentation.ts after config initialization
