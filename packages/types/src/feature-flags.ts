// ===========================================
// FEATURE FLAGS TYPES
// ===========================================
// Comprehensive type definitions for all feature flags

/**
 * Verification methods available in the system
 */
export type VerificationMethod = 'message_sign' | 'user_agent' | 'port_challenge' | 'dns_txt' | 'http_file';

/**
 * Analytics providers
 */
export type AnalyticsProvider = 'plausible' | 'google' | 'matomo' | 'fathom';

/**
 * Export formats for data export
 */
export type ExportFormat = 'json' | 'csv' | 'xml';

/**
 * Turnstile-protected actions
 */
export type TurnstileProtectedAction = 'verification' | 'tipping' | 'profile_update' | 'contact';

/**
 * Core system feature flags
 */
export interface CoreFeatureFlags {
  /** Enable entire admin dashboard and moderation system */
  adminMode: boolean;
  /** Enable user authentication (required for verification, profiles, tipping) */
  authentication: boolean;
  /** Enable node ownership verification */
  nodeVerification: boolean;
  /** Enable custom node profiles (requires verification) */
  nodeProfiles: boolean;
  /** Enable cryptocurrency tipping for verified nodes */
  tipping: boolean;
}

/**
 * Verification system configuration
 */
export interface VerificationFeatureFlags {
  /** Enabled verification methods */
  methods: VerificationMethod[];
  /** Require payment to verify node ownership (anti-spam) */
  requirePayment: boolean;
  /** Payment amount required for verification */
  paymentAmount: number;
  /** Currency for payment verification */
  paymentCurrency: string;
  /** Challenge expiry time in hours */
  challengeExpiryHours: number;
  /** Auto-approve verified nodes (skip manual moderation) */
  autoApprove: boolean;
}

/**
 * Cloudflare Turnstile configuration
 */
export interface TurnstileFeatureFlags {
  /** Enable Cloudflare Turnstile bot protection */
  enabled: boolean;
  /** Turnstile site key (public) */
  siteKey: string | null;
  /** Turnstile widget mode */
  mode: 'visible' | 'invisible' | 'managed';
  /** Which actions to protect with Turnstile */
  protectedActions: TurnstileProtectedAction[];
}

/**
 * Map feature flags
 */
export interface MapFeatureFlags {
  /** Enable map visualization */
  enabled: boolean;
  /** Enable marker clustering */
  clustering: boolean;
  /** Enable heatmap visualization */
  heatmap: boolean;
  /** Enable live updates via WebSocket */
  liveUpdates: boolean;
}

/**
 * Statistics dashboard feature flags
 */
export interface StatsFeatureFlags {
  /** Enable statistics dashboard */
  enabled: boolean;
  /** Show version distribution chart */
  versionChart: boolean;
  /** Show country distribution chart */
  countryChart: boolean;
  /** Show network health score */
  healthScore: boolean;
}

/**
 * Filter feature flags
 */
export interface FilterFeatureFlags {
  /** Enable country filter */
  byCountry: boolean;
  /** Enable version filter */
  byVersion: boolean;
  /** Enable tier filter */
  byTier: boolean;
  /** Enable status filter (online/offline) */
  byStatus: boolean;
  /** Enable search functionality */
  search: boolean;
}

/**
 * Node-related feature flags
 */
export interface NodeFeatureFlags {
  /** Enable node tier categories (diamond, gold, etc.) */
  categories: boolean;
  /** Enable node rankings and PIX score */
  rankings: boolean;
  /** Enable uptime tracking */
  uptimeTracking: boolean;
  /** Enable historical data storage */
  historicalData: boolean;
}

/**
 * Community feature flags
 */
export interface CommunityFeatureFlags {
  /** Enable manual node submission form */
  nodeSubmission: boolean;
  /** Enable leaderboard */
  leaderboard: boolean;
  /** Enable achievement badges */
  badges: boolean;
}

/**
 * UI/UX feature flags
 */
export interface UIFeatureFlags {
  /** Enable dark mode support */
  darkMode: boolean;
  /** Enable theme switcher in UI */
  themeSwitcher: boolean;
}

/**
 * Tipping feature flags
 */
export interface TippingFeatureFlags {
  /** Enable tipping functionality */
  enabled: boolean;
  /** Enable tip tracking */
  tracking: boolean;
  /** Accepted cryptocurrencies for tipping */
  acceptedCoins: string[];
}

/**
 * Limits and restrictions
 */
export interface LimitsConfig {
  /** Enable rate limiting */
  rateLimiting: boolean;
  /** Maximum requests per minute (if rate limiting enabled) */
  requestsPerMinute: number;
  /** Maximum nodes a single user can verify */
  maxNodesPerUser: number;
  /** Maximum avatar file size in MB */
  maxAvatarSizeMB: number;
  /** Allowed avatar file formats */
  allowedAvatarFormats: string[];
  /** Minimum tip amount */
  minTipAmount: number;
  /** Maximum tip amount */
  maxTipAmount: number;
}

/**
 * Analytics and monitoring configuration
 */
export interface AnalyticsConfig {
  /** Enable analytics tracking */
  enabled: boolean;
  /** Analytics provider */
  provider: AnalyticsProvider | null;
  /** Analytics domain/site ID */
  domain: string | null;
}

/**
 * Error tracking configuration
 */
export interface ErrorTrackingConfig {
  /** Enable error tracking (Sentry, etc.) */
  enabled: boolean;
  /** Sentry DSN or equivalent */
  dsn: string | null;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /** Enable performance monitoring */
  enabled: boolean;
  /** Show performance metrics in UI (debug) */
  showMetrics: boolean;
}

/**
 * Email notification configuration
 */
export interface EmailConfig {
  /** Enable email notifications */
  enabled: boolean;
  /** SMTP configuration (server-side only) */
  smtp?: {
    host: string;
    port: number;
    user: string;
    password: string;
    fromEmail: string;
    fromName: string;
  };
}

/**
 * Webhook notification configuration
 */
export interface WebhookConfig {
  /** Enable webhook notifications */
  enabled: boolean;
  /** Webhook URL (server-side only) */
  url?: string;
}

/**
 * API access configuration
 */
export interface APIConfig {
  /** Enable public API access */
  publicAPI: boolean;
  /** Enable API key authentication */
  apiKeys: boolean;
}

/**
 * Data export configuration
 */
export interface DataExportConfig {
  /** Enable data export functionality */
  enabled: boolean;
  /** Available export formats */
  formats: ExportFormat[];
}

/**
 * Realtime features configuration
 */
export interface RealtimeConfig {
  /** Enable realtime updates */
  enabled: boolean;
  /** Update interval in seconds */
  updateIntervalSeconds: number;
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  /** Enable debug mode */
  enabled: boolean;
}

/**
 * Complete application feature flags
 * This is the main configuration object used throughout the app
 */
export interface ApplicationFeatureFlags {
  /** Core system flags */
  core: CoreFeatureFlags;
  /** Verification configuration */
  verification: VerificationFeatureFlags;
  /** Turnstile bot protection */
  turnstile: TurnstileFeatureFlags;
  /** Map features */
  map: MapFeatureFlags;
  /** Statistics dashboard */
  stats: StatsFeatureFlags;
  /** Filters */
  filters: FilterFeatureFlags;
  /** Node features */
  nodes: NodeFeatureFlags;
  /** Community features */
  community: CommunityFeatureFlags;
  /** UI/UX features */
  ui: UIFeatureFlags;
  /** Tipping features */
  tipping: TippingFeatureFlags;
  /** Limits and restrictions */
  limits: LimitsConfig;
  /** Analytics */
  analytics: AnalyticsConfig;
  /** Error tracking */
  errorTracking: ErrorTrackingConfig;
  /** Performance monitoring */
  performance: PerformanceConfig;
  /** Email notifications */
  email: EmailConfig;
  /** Webhook notifications */
  webhook: WebhookConfig;
  /** API configuration */
  api: APIConfig;
  /** Data export */
  dataExport: DataExportConfig;
  /** Realtime features */
  realtime: RealtimeConfig;
  /** Debug mode */
  debug: DebugConfig;
}

/**
 * Helper type for checking if a specific feature is enabled
 */
export type FeatureFlagPath =
  | 'core.adminMode'
  | 'core.authentication'
  | 'core.nodeVerification'
  | 'core.nodeProfiles'
  | 'core.tipping'
  | 'verification.requirePayment'
  | 'verification.autoApprove'
  | 'turnstile.enabled'
  | 'map.enabled'
  | 'map.clustering'
  | 'map.heatmap'
  | 'map.liveUpdates'
  | 'stats.enabled'
  | 'stats.versionChart'
  | 'stats.countryChart'
  | 'stats.healthScore'
  | 'filters.byCountry'
  | 'filters.byVersion'
  | 'filters.byTier'
  | 'filters.byStatus'
  | 'filters.search'
  | 'nodes.categories'
  | 'nodes.rankings'
  | 'nodes.uptimeTracking'
  | 'nodes.historicalData'
  | 'community.nodeSubmission'
  | 'community.leaderboard'
  | 'community.badges'
  | 'ui.darkMode'
  | 'ui.themeSwitcher'
  | 'limits.rateLimiting'
  | 'analytics.enabled'
  | 'errorTracking.enabled'
  | 'performance.enabled'
  | 'performance.showMetrics'
  | 'email.enabled'
  | 'webhook.enabled'
  | 'api.publicAPI'
  | 'api.apiKeys'
  | 'dataExport.enabled'
  | 'realtime.enabled'
  | 'debug.enabled';
