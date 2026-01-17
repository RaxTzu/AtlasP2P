// ===========================================
// ZOD SCHEMA VALIDATION
// ===========================================
// Comprehensive runtime validation for project.config.yaml
// Prevents malformed config from crashing the app

import { z } from 'zod';

// ===========================================
// HELPER SCHEMAS
// ===========================================

// Version string format: "1.18.0"
const VersionStringSchema = z.string().regex(
  /^\d+\.\d+\.\d+$/,
  'Version must be in format X.Y.Z (e.g., "1.18.0")'
);

// Hex color: "#155799"
const HexColorSchema = z.string().regex(
  /^#[0-9A-Fa-f]{6}$/,
  'Color must be a valid hex color (e.g., "#155799")'
);

// URL validation
const URLSchema = z.string().url('Must be a valid URL');

// Email validation
const EmailSchema = z.string().email('Must be a valid email address');

// Port number (1-65535)
const PortSchema = z.number().int().min(1).max(65535, 'Port must be between 1 and 65535');

// Percentage (0-100)
const PercentageSchema = z.number().min(0).max(100, 'Percentage must be between 0 and 100');

// Positive number
const PositiveNumberSchema = z.number().positive('Must be a positive number');

// Non-negative number
const NonNegativeNumberSchema = z.number().min(0, 'Must be non-negative');

// Lucide icon name (basic validation - just ensure it's a non-empty string)
const LucideIconSchema = z.string().min(1, 'Icon name is required');

// ===========================================
// ENUM SCHEMAS
// ===========================================

export const TurnstileModeSchema = z.enum(['visible', 'invisible', 'managed']);

export const TurnstileActionSchema = z.enum(['verification', 'tipping', 'profile_update', 'contact']);

export const EmailProviderSchema = z.enum(['resend', 'sendgrid', 'smtp', 'disabled']);

export const AnalyticsProviderSchema = z.enum(['plausible', 'google', 'matomo', 'fathom']).nullable();

export const TileProviderSchema = z.enum(['openstreetmap', 'mapbox', 'carto-dark']);

export const SocialIconSchema = z.enum(['github', 'twitter', 'discord', 'telegram', 'reddit', 'youtube', 'medium', 'linkedin']);

export const NavigationIconSchema = z.enum(['map', 'barchart', 'trophy', 'server', 'activity', 'user', 'info', 'settings', 'docs', 'layout-dashboard']);

export const ExportFormatSchema = z.enum(['json', 'csv', 'xml']);

export const AccessibilitySchema = z.enum(['low', 'medium', 'high', 'aaa']);

// ===========================================
// CHAIN CONFIGURATION
// ===========================================

export const ChainConfigSchema = z.object({
  name: z.string().min(1, 'Chain name is required'),
  ticker: z.string().min(1, 'Ticker is required'),
  p2pPort: PortSchema,
  rpcPort: PortSchema,
  protocolVersion: z.number().int().positive('Protocol version must be a positive integer'),
  currentVersion: VersionStringSchema,
  minimumVersion: VersionStringSchema,
  criticalVersion: VersionStringSchema,
  explorerUrl: URLSchema,
  websiteUrl: URLSchema,
  githubUrl: URLSchema,
  releasesUrl: URLSchema.optional(),
  latestReleaseUrl: URLSchema.optional(),
  messagePrefix: z.string().min(1, 'Message prefix is required').optional(),
  addressPrefix: z.string().min(1, 'Address prefix is required').optional(),
  pubKeyHash: z.string().regex(/^[0-9a-fA-F]+$/, 'pubKeyHash must be a hex string').optional(),
  dnsSeeds: z.array(z.string().min(1, 'DNS seed cannot be empty')),
  seedNodes: z.array(z.string().regex(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[[0-9a-fA-F:]+\]):\d+$/, 'Seed node must be in IP:PORT format (IPv4: 1.2.3.4:port or IPv6: [::1]:port)')),
  magicBytes: z.string().regex(/^[0-9a-fA-F]{8}$/, 'Magic bytes must be 8 hex characters'),
  userAgentPatterns: z.array(z.string().min(1, 'User agent pattern cannot be empty')).min(1, 'At least one user agent pattern is required'),
}).refine(
  (data) => data.dnsSeeds.length > 0 || data.seedNodes.length > 0,
  {
    message: 'At least one DNS seed or seed node is required. Either dnsSeeds or seedNodes must have at least one entry.',
    path: ['dnsSeeds']
  }
);

// ===========================================
// THEME CONFIGURATION
// ===========================================

export const TierColorConfigSchema = z.object({
  color: HexColorSchema,
  icon: LucideIconSchema,
  label: z.string().min(1, 'Tier label is required'),
});

export const MarkerCategorySchema = z.object({
  name: z.string().min(1, 'Marker category name is required'),
  description: z.string().min(1, 'Marker category description is required'),
  icon: z.string().min(1, 'Marker category icon path is required'),
  iconSize: z.tuple([
    z.number().int().positive('Icon width must be positive'),
    z.number().int().positive('Icon height must be positive')
  ]),
  priority: z.number().int().positive('Priority must be a positive integer'),
});

export const ThemeConfigSchema = z.object({
  name: z.string().min(1, 'Theme name is required'),
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  accentColor: HexColorSchema,
  logo: z.string().min(1, 'Logo path is required'),
  favicon: z.string().min(1, 'Favicon path is required'),
  tierColors: z.object({
    diamond: TierColorConfigSchema,
    gold: TierColorConfigSchema,
    silver: TierColorConfigSchema,
    bronze: TierColorConfigSchema,
    standard: TierColorConfigSchema,
  }),
  offlineColor: HexColorSchema,
  markerCategories: z.record(MarkerCategorySchema).optional(),
});

// ===========================================
// CONTENT CONFIGURATION
// ===========================================

export const NavigationItemSchema = z.object({
  name: z.string().min(1, 'Navigation item name is required'),
  href: z.string().min(1, 'Navigation item href is required'),
  icon: NavigationIconSchema,
  external: z.boolean().optional(),
});

export const FooterLinkSchema = z.object({
  label: z.string().min(1, 'Footer link label is required'),
  href: z.string().min(1, 'Footer link href is required'),
  external: z.boolean().optional(),
});

export const SocialLinkSchema = z.object({
  name: z.string().min(1, 'Social link name is required'),
  href: URLSchema,
  icon: SocialIconSchema,
});

export const SupportContactSchema = z.object({
  enabled: z.boolean(),
  email: EmailSchema.optional(),
  discord: URLSchema.optional(),
}).refine(
  (data) => !data.enabled || data.email || data.discord,
  {
    message: 'At least one contact method (email or discord) must be provided when support is enabled',
    path: ['email']
  }
);

export const ContentConfigSchema = z.object({
  siteName: z.string().min(1, 'Site name is required'),
  siteDescription: z.string().min(1, 'Site description is required'),
  siteUrl: URLSchema,
  navigation: z.array(NavigationItemSchema).min(1, 'At least one navigation item is required'),
  footerLinks: z.array(FooterLinkSchema),
  social: z.array(SocialLinkSchema),
  copyrightText: z.string().optional(),
  githubRepoUrl: URLSchema.optional(),
  support: SupportContactSchema.optional(),
});

// ===========================================
// MAP CONFIGURATION
// ===========================================

export const TileStyleConfigSchema = z.object({
  id: z.string().min(1, 'Tile style ID is required'),
  name: z.string().min(1, 'Tile style name is required'),
  description: z.string().optional(),
  icon: LucideIconSchema.optional(),
  url: z.string().optional(),
  urlDark: z.string().optional(),
  styleUrl: z.string().optional(),
  attribution: z.string().min(1, 'Attribution is required'),
  maxZoom: z.number().int().min(1).max(22, 'maxZoom must be between 1 and 22').optional(),
  subdomains: z.array(z.string()).optional(),
  filter: z.string().optional(),
  filterDark: z.string().optional(),
  accessibility: AccessibilitySchema.optional(),
});

export const MapConfigSchema = z.object({
  defaultCenter: z.tuple([
    z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
    z.number().min(-180).max(180, 'Longitude must be between -180 and 180')
  ]),
  defaultZoom: z.number().int().min(0).max(22, 'Zoom must be between 0 and 22'),
  minZoom: z.number().int().min(0).max(22, 'minZoom must be between 0 and 22'),
  maxZoom: z.number().int().min(0).max(22, 'maxZoom must be between 0 and 22'),
  tileProvider: TileProviderSchema,
  clusterRadius: z.number().int().positive('Cluster radius must be positive'),
  clusterMaxZoom: z.number().int().min(0).max(22, 'clusterMaxZoom must be between 0 and 22'),
  tileStyles: z.array(TileStyleConfigSchema).min(1, 'At least one tile style is required'),
  defaultTileStyle: z.string().min(1, 'Default tile style is required'),
}).refine(
  (data) => data.minZoom <= data.maxZoom,
  { message: 'minZoom must be less than or equal to maxZoom' }
).refine(
  (data) => data.tileStyles.some(style => style.id === data.defaultTileStyle),
  { message: 'defaultTileStyle must match one of the tileStyles IDs' }
);

// ===========================================
// CRAWLER CONFIGURATION
// ===========================================

export const CrawlerConfigSchema = z.object({
  pruneAfterHours: PositiveNumberSchema,
  scanIntervalMinutes: PositiveNumberSchema,
  maxConcurrentConnections: z.number().int().min(1).max(1000, 'Max concurrent connections must be between 1 and 1000'),
  connectionTimeoutSeconds: PositiveNumberSchema,
  extendedTimeoutSeconds: PositiveNumberSchema,
  maxRetries: z.number().int().min(0).max(10, 'Max retries must be between 0 and 10'),
  initialRetryDelaySeconds: PositiveNumberSchema,
  retryBackoffMultiplier: z.number().min(1).max(10, 'Retry backoff multiplier must be between 1 and 10'),
  fallbackProtocolVersions: z.array(z.number().int().positive('Protocol version must be positive')),
  requireVersionForSave: z.boolean(),
});

// ===========================================
// ADMIN & EMAIL CONFIGURATION
// ===========================================

export const SemanticColorsSchema = z.object({
  success: HexColorSchema,
  warning: HexColorSchema,
  error: HexColorSchema,
  info: HexColorSchema,
});

export const EmailOTPConfigSchema = z.object({
  expiryMinutes: PositiveNumberSchema,
  maxResendAttempts: z.number().int().min(1).max(10, 'Max resend attempts must be between 1 and 10'),
  resendCooldownSeconds: PositiveNumberSchema,
});

export const EmailConfigSchema = z.object({
  provider: EmailProviderSchema,
  fromEmail: EmailSchema,
  fromName: z.string().min(1, 'From name is required'),
  alertsFromEmail: EmailSchema.optional(),
  alertsFromName: z.string().optional(),
  autoConfirm: z.boolean(),
  verificationRequired: z.boolean(),
  otp: EmailOTPConfigSchema,
});

export const AlertsConfigSchema = z.object({
  enabled: z.boolean(),
  nodeCountDropPercent: PercentageSchema,
  healthScoreThreshold: PercentageSchema,
  alertCooldownHours: PositiveNumberSchema,
});

export const AdminConfigSchema = z.object({
  adminEmails: z.array(EmailSchema).min(1, 'At least one admin email is required'),
  semanticColors: SemanticColorsSchema,
  email: EmailConfigSchema,
  alerts: AlertsConfigSchema,
});

// ===========================================
// FEATURE FLAGS
// ===========================================

export const VerificationMethodsSchema = z.object({
  messageSign: z.boolean(),
  userAgent: z.boolean(),
  portChallenge: z.boolean(),
  dnsTxt: z.boolean(),
  httpFile: z.boolean(),
});

export const VerificationFeaturesSchema = z.object({
  enabled: z.boolean(),
  methods: VerificationMethodsSchema,
  requirePayment: z.boolean(),
  paymentAmount: NonNegativeNumberSchema,
  paymentCurrency: z.string().min(1, 'Payment currency is required'),
  challengeExpiryHours: PositiveNumberSchema,
  autoApprove: z.boolean(),
});

export const MapFeaturesSchema = z.object({
  enabled: z.boolean(),
  clustering: z.boolean(),
  heatmap: z.boolean(),
  liveUpdates: z.boolean(),
});

export const StatsFeaturesSchema = z.object({
  enabled: z.boolean(),
  versionChart: z.boolean(),
  countryChart: z.boolean(),
  healthScore: z.boolean(),
});

export const FilterFeaturesSchema = z.object({
  byCountry: z.boolean(),
  byVersion: z.boolean(),
  byTier: z.boolean(),
  byStatus: z.boolean(),
  search: z.boolean(),
});

export const NodeFeaturesSchema = z.object({
  categories: z.boolean(),
  rankings: z.boolean(),
  uptimeTracking: z.boolean(),
  historicalData: z.boolean(),
});

export const TippingFeaturesSchema = z.object({
  enabled: z.boolean(),
  tracking: z.boolean(),
  acceptedCoins: z.array(z.string().min(1, 'Coin ticker cannot be empty')).optional(),
});

export const CommunityFeaturesSchema = z.object({
  nodeSubmission: z.boolean(),
  leaderboard: z.boolean(),
  badges: z.boolean(),
});

export const UIFeaturesSchema = z.object({
  darkMode: z.boolean(),
  themeSwitcher: z.boolean(),
});

export const TurnstileFeaturesSchema = z.object({
  enabled: z.boolean(),
  siteKey: z.string().min(1, 'Turnstile site key is required'),
  mode: TurnstileModeSchema,
  protectedActions: z.array(TurnstileActionSchema),
});

export const LimitsFeaturesSchema = z.object({
  rateLimiting: z.boolean(),
  requestsPerMinute: z.number().int().min(1).max(10000, 'Requests per minute must be between 1 and 10000'),
  maxNodesPerUser: z.number().int().min(1).max(100, 'Max nodes per user must be between 1 and 100'),
  maxAvatarSizeMB: z.number().min(0.1).max(10, 'Max avatar size must be between 0.1 and 10 MB'),
  allowedAvatarFormats: z.array(z.string().regex(/^(jpg|jpeg|png|webp|gif)$/, 'Invalid image format')).min(1, 'At least one avatar format is required'),
  minTipAmount: NonNegativeNumberSchema,
  maxTipAmount: PositiveNumberSchema,
});

export const AnalyticsFeaturesSchema = z.object({
  enabled: z.boolean(),
  provider: AnalyticsProviderSchema,
  domain: z.string().nullable(),
});

export const ErrorTrackingFeaturesSchema = z.object({
  enabled: z.boolean(),
});

export const PerformanceFeaturesSchema = z.object({
  enabled: z.boolean(),
  showMetrics: z.boolean(),
});

export const DataExportFeaturesSchema = z.object({
  enabled: z.boolean(),
  formats: z.array(ExportFormatSchema).min(1, 'At least one export format is required'),
});

export const RealtimeFeaturesSchema = z.object({
  enabled: z.boolean(),
  updateIntervalSeconds: z.number().int().min(1).max(300, 'Update interval must be between 1 and 300 seconds'),
});

export const APIFeaturesSchema = z.object({
  publicAPI: z.boolean(),
  apiKeys: z.boolean(),
});

export const DebugFeaturesSchema = z.object({
  enabled: z.boolean(),
});

export const FeatureFlagsSchema = z.object({
  map: MapFeaturesSchema,
  stats: StatsFeaturesSchema,
  filters: FilterFeaturesSchema,
  nodes: NodeFeaturesSchema,
  verification: VerificationFeaturesSchema,
  tipping: TippingFeaturesSchema,
  community: CommunityFeaturesSchema,
  ui: UIFeaturesSchema,
  turnstile: TurnstileFeaturesSchema,
  limits: LimitsFeaturesSchema,
  analytics: AnalyticsFeaturesSchema,
  errorTracking: ErrorTrackingFeaturesSchema,
  performance: PerformanceFeaturesSchema,
  dataExport: DataExportFeaturesSchema,
  realtime: RealtimeFeaturesSchema,
  api: APIFeaturesSchema,
  debug: DebugFeaturesSchema,
});

// ===========================================
// ASSETS CONFIGURATION
// ===========================================

export const AssetsConfigSchema = z.object({
  logoPath: z.string().min(1, 'Logo path is required'),
  faviconPath: z.string().min(1, 'Favicon path is required'),
  ogImagePath: z.string().min(1, 'OG image path is required'),
});

// ===========================================
// DEPLOYMENT CONFIGURATION
// ===========================================

export const DeploymentRegistrySchema = z.object({
  type: z.enum(['ghcr', 'ecr'], {
    errorMap: () => ({ message: 'Registry type must be either "ghcr" (GitHub Container Registry) or "ecr" (AWS Elastic Container Registry)' })
  }),
  public: z.boolean().optional().default(true),
  region: z.string().optional().default('us-east-1'),
  repositories: z.object({
    web: z.string().min(1, 'Web repository name is required'),
    crawler: z.string().min(1, 'Crawler repository name is required'),
  }),
});

export const DeploymentCaddySchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['auto', 'container', 'host', 'none']).default('auto'),
});

export const DeploymentSecretsSchema = z.object({
  source: z.enum(['auto', 'aws-ssm', 'github-secrets', 'manual']).default('auto'),
  ssmPath: z.string().optional(),
});

export const DeploymentHealthCheckSchema = z.object({
  enabled: z.boolean().default(true),
  endpoint: z.string().default('/api/stats'),
  timeout: z.number().positive().default(30),
  retries: z.number().int().positive().default(3),
});

export const DeploymentBackupSchema = z.object({
  enabled: z.boolean().default(true),
  retention: z.number().int().positive().default(7),
});

export const DeploymentRollbackSchema = z.object({
  enabled: z.boolean().default(true),
  onHealthCheckFail: z.boolean().default(true),
});

export const DeploymentConfigSchema = z.object({
  mode: z.enum(['self-hosted-docker', 'self-hosted-cloud', 'cloud-serverless']).default('self-hosted-docker'),
  registry: DeploymentRegistrySchema,
  caddy: DeploymentCaddySchema,
  secrets: DeploymentSecretsSchema,
  healthCheck: DeploymentHealthCheckSchema,
  backup: DeploymentBackupSchema,
  rollback: DeploymentRollbackSchema,
}).optional();

// ===========================================
// ROOT PROJECT CONFIG SCHEMA
// ===========================================

export const ProjectConfigSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  chain: z.string().min(1, 'Chain name is required'),
  chainConfig: ChainConfigSchema,
  themeConfig: ThemeConfigSchema,
  content: ContentConfigSchema,
  mapConfig: MapConfigSchema,
  crawlerConfig: CrawlerConfigSchema,
  adminConfig: AdminConfigSchema,
  features: FeatureFlagsSchema,
  assets: AssetsConfigSchema,
  deployment: DeploymentConfigSchema,
});

// ===========================================
// TYPES
// ===========================================

export type ValidatedProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ValidatedChainConfig = z.infer<typeof ChainConfigSchema>;
export type ValidatedThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type ValidatedFeatureFlags = z.infer<typeof FeatureFlagsSchema>;
