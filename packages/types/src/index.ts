// ===========================================
// NODES MAP - SHARED TYPES
// ===========================================

// -------------------------------------------
// NODE TYPES
// -------------------------------------------

export type NodeStatus = 'pending' | 'up' | 'down' | 'reachable';
export type NodeTier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'standard';
export type ConnectionType = 'ipv4' | 'ipv6' | 'onion';
export type VerificationMethod = 'message_sign' | 'user_agent' | 'port_challenge' | 'dns_txt' | 'http_file';
export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired';

export interface Node {
  id: string;

  // Network Identity
  ip: string;
  port: number;
  address: string;
  chain: string;

  // From P2P handshake
  version: string | null;
  protocolVersion: number | null;
  services: number | null;  // Bitmask: NODE_NETWORK=1, NODE_BLOOM=4, etc.
  startHeight: number | null;

  // Parsed version
  clientName: string | null;
  clientVersion: string | null;
  versionMajor: number | null;
  versionMinor: number | null;
  versionPatch: number | null;
  isCurrentVersion: boolean;

  // GeoIP
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  org: string | null;
  asn: number | null;
  asnOrg: string | null;
  connectionType: ConnectionType;

  // Status
  status: NodeStatus;
  lastSeen: string | null;
  firstSeen: string;
  timesSeen: number;

  // Performance
  latencyMs: number | null;
  latencyAvg: number | null;
  uptime: number;

  // Computed
  tier: NodeTier;
  pixScore: number | null;
  rank: number | null;

  // Verification & Customization
  isVerified: boolean;
  tipsEnabled: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface NodeWithProfile extends Node {
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  description: string | null;
  website: string | null;
  twitter: string | null;
  github: string | null;
  discord: string | null;
  telegram: string | null;
}

// -------------------------------------------
// STATISTICS TYPES
// -------------------------------------------

export interface NetworkStats {
  chain: string;
  totalNodes: number;
  onlineNodes: number;
  countries: number;
  avgUptime: number;
  avgLatency: number;
  verifiedNodes: number;
  diamondNodes: number;
  goldNodes: number;
  timestamp: string;
}

export interface VersionDistribution {
  version: string;
  count: number;
  percentage: number;
  onlineCount: number;
  isCurrentVersion: boolean;
}

export interface CountryDistribution {
  countryCode: string;
  countryName: string;
  count: number;
  percentage: number;
}

export interface Snapshot {
  id: string;
  chain: string;
  timestamp: string;
  totalNodes: number;
  reachableNodes: number;
  blockHeight: number | null;
  stats: {
    versions: VersionDistribution[];
    countries: CountryDistribution[];
  } | null;
}

// -------------------------------------------
// NODE HISTORY
// -------------------------------------------

export interface NodeHistory {
  id: string;
  nodeId: string;
  timestamp: string;
  status: NodeStatus;
  latencyMs: number | null;
  blockHeight: number | null;
}

// -------------------------------------------
// VERIFICATION
// -------------------------------------------

export interface Verification {
  id: string;
  nodeId: string;
  userId: string;
  method: VerificationMethod;
  challenge: string;
  response: string | null;
  status: VerificationStatus;
  verifiedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface VerifiedNode {
  id: string;
  nodeId: string;
  userId: string;
  verifiedAt: string;
  verificationMethod: VerificationMethod;
}

// -------------------------------------------
// NODE PROFILE
// -------------------------------------------

export interface NodeProfile {
  id: string;
  nodeId: string;
  userId: string;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  github: string | null;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------
// TIPPING
// -------------------------------------------

export interface NodeTipConfig {
  id: string;
  nodeId: string;
  userId: string;
  walletAddress: string;
  acceptedCoins: string[];
  minimumTip: number | null;
  thankYouMessage: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Tip {
  id: string;
  nodeId: string;
  txHash: string;
  amount: number;
  coin: string;
  fromAddress: string | null;
  toAddress: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

// -------------------------------------------
// API TYPES
// -------------------------------------------

export interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    timestamp?: string;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface NodeFilters {
  status?: NodeStatus;
  country?: string;
  version?: string;
  tier?: NodeTier;
  isVerified?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'rank' | 'uptime' | 'latency' | 'lastSeen' | 'firstSeen';
  sortOrder?: 'asc' | 'desc';
}

// -------------------------------------------
// LEADERBOARD
// -------------------------------------------

export interface LeaderboardEntry {
  id: string;
  address: string;
  displayName: string | null;
  avatarUrl: string | null;
  tier: NodeTier;
  pixScore: number;
  rank: number;
  uptime: number;
  latencyAvg: number | null;
  countryCode: string | null;
  isVerified: boolean;
  firstSeen: string;
}

// -------------------------------------------
// USER
// -------------------------------------------

export interface User {
  id: string;
  email: string | null;
  createdAt: string;
}

export interface UserWithNodes extends User {
  claimedNodes: Node[];
}

// -------------------------------------------
// CHAIN CONFIG
// -------------------------------------------

export interface ChainConfig {
  name: string;
  ticker: string;
  p2pPort: number;
  rpcPort: number;
  protocolVersion: number;
  currentVersion: string;
  minimumVersion: string;
  criticalVersion: string;
  explorerUrl: string;
  websiteUrl: string;
  githubUrl: string;
  // Release/download URLs
  releasesUrl?: string;      // e.g., "https://github.com/dingocoin/dingocoin/releases"
  latestReleaseUrl?: string; // e.g., "https://github.com/dingocoin/dingocoin/releases/tag/v1.18.0.0"
  // Wallet/address configuration (for verification)
  addressPrefix?: string;    // e.g., "D" for Dingocoin, "1" or "3" for Bitcoin
  messagePrefix?: string;    // e.g., "Dingocoin Signed Message:\n"
  pubKeyHash?: string;       // Version byte for P2PKH addresses (hex)
}

export interface TierColorConfig {
  color: string;
  icon: string;
  label: string;
}

export interface SemanticColors {
  success: string;      // Green - success states, confirmations
  error: string;        // Red - errors, critical actions
  warning: string;      // Orange - warnings, demote
  info: string;         // Blue - informational messages
  admin: string;        // Purple - admin actions, promote
  danger: string;       // Dark red - dangerous actions
}

export interface ThemeConfig {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo: string;
  favicon: string;
  semanticColors?: SemanticColors;
  tierColors: Record<NodeTier, TierColorConfig>;
  offlineColor: string;
  markerCategories?: Record<string, MarkerCategory>;
}

export interface MarkerCategory {
  name: string;
  description: string;
  icon: string;
  iconSize: [number, number];
  priority: number;
}

export interface MapConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  tileProvider: 'openstreetmap' | 'mapbox' | 'carto-dark';
  clusterRadius: number;
  clusterMaxZoom: number;
}

// -------------------------------------------
// PLUGGABLE CONFIG TYPES
// -------------------------------------------

export interface SocialLink {
  name: string;
  href: string;
  icon: 'github' | 'twitter' | 'discord' | 'telegram' | 'reddit' | 'youtube' | 'medium' | 'linkedin';
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: 'map' | 'barchart' | 'trophy' | 'server' | 'activity' | 'user' | 'info' | 'settings' | 'docs' | 'layout-dashboard';
  external?: boolean;
}

export interface TileStyleConfig {
  id: string;
  name: string;
  description?: string;
  icon?: string;  // lucide-react icon name
  url?: string;  // Raster tile URL (optional if using styleUrl)
  urlDark?: string;  // Dark mode tile URL (optional)
  styleUrl?: string;  // MapLibre vector style JSON URL (alternative to url)
  attribution: string;
  maxZoom?: number;
  subdomains?: string[];
  filter?: string;  // CSS filter for coin branding (raster tiles only)
  filterDark?: string;  // CSS filter for dark mode (raster tiles only)
  accessibility?: 'low' | 'medium' | 'high' | 'aaa';
}

export interface SupportContact {
  enabled: boolean;
  email?: string;
  discord?: string;
}

export interface ContentConfig {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  navigation: NavigationItem[];
  footerLinks: {
    label: string;
    href: string;
    external?: boolean;
  }[];
  social: SocialLink[];
  copyrightText?: string;
  githubRepoUrl?: string;
  support?: SupportContact;
}

// -------------------------------------------
// EMAIL & ADMIN CONFIG
// -------------------------------------------

export type EmailProvider = 'resend' | 'sendgrid' | 'smtp' | 'disabled';

export interface EmailOTPConfig {
  expiryMinutes: number;
  maxResendAttempts: number;
  resendCooldownSeconds: number;
}

export interface EmailConfig {
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  alertsFromEmail?: string;
  alertsFromName?: string;
  autoConfirm: boolean;
  verificationRequired: boolean;
  otp: EmailOTPConfig;
}

export interface AlertsConfig {
  enabled: boolean;
  nodeCountDropPercent: number;
  healthScoreThreshold: number;
  alertCooldownHours: number;
}

export interface AdminConfig {
  adminEmails: string[];
  email: EmailConfig;
  alerts: AlertsConfig;
}

// -------------------------------------------
// CRAWLER CONFIGURATION
// -------------------------------------------

export interface CrawlerConfig {
  pruneAfterHours: number;
  scanIntervalMinutes: number;
  maxConcurrentConnections: number;
  connectionTimeoutSeconds: number;
  extendedTimeoutSeconds: number;
  maxRetries: number;
  initialRetryDelaySeconds: number;
  retryBackoffMultiplier: number;
  fallbackProtocolVersions: number[];
  requireVersionForSave: boolean;
}

export interface ProjectConfig {
  // Project identity
  projectName: string;
  chain: string;

  // Chain & theme configs (from existing system)
  chainConfig: ChainConfig;
  themeConfig: ThemeConfig;

  // Content configuration
  content: ContentConfig;

  // Map configuration
  mapConfig: MapConfig & {
    tileStyles: TileStyleConfig[];
    defaultTileStyle: string;
  };

  // Crawler configuration
  crawlerConfig: CrawlerConfig;

  // Admin and email configuration
  adminConfig: AdminConfig;

  // Feature flags
  features: FeatureFlags;

  // Asset paths
  assets: {
    logoPath: string;
    faviconPath: string;
    ogImagePath: string;
  };
}

// -------------------------------------------
// FEATURE FLAGS
// -------------------------------------------

// Export enhanced feature flags system
export * from './feature-flags';

// Legacy FeatureFlags interface (for backward compatibility with YAML config)
// This is used in project.config.yaml and will be mapped to ApplicationFeatureFlags
export interface FeatureFlags {
  map: {
    enabled: boolean;
    clustering: boolean;
    heatmap: boolean;
    liveUpdates: boolean;
  };
  stats: {
    enabled: boolean;
    versionChart: boolean;
    countryChart: boolean;
    healthScore: boolean;
  };
  filters: {
    byCountry: boolean;
    byVersion: boolean;
    byTier: boolean;
    byStatus: boolean;
    search: boolean;
  };
  nodes: {
    categories: boolean;
    rankings: boolean;
    uptimeTracking: boolean;
    historicalData: boolean;
  };
  verification: {
    enabled: boolean;
    methods: {
      messageSign: boolean;
      userAgent: boolean;
      portChallenge: boolean;
      dnsTxt: boolean;
      httpFile: boolean;
    };
    requirePayment: boolean;
    paymentAmount: number;
    paymentCurrency: string;
    challengeExpiryHours: number;
    autoApprove: boolean;
  };
  tipping: {
    enabled: boolean;
    tracking: boolean;
    acceptedCoins?: string[];
  };
  community: {
    nodeSubmission: boolean;
    leaderboard: boolean;
    badges: boolean;
  };
  ui: {
    darkMode: boolean;
    themeSwitcher: boolean;
  };
  turnstile: {
    enabled: boolean;
    siteKey: string;
    mode: 'visible' | 'invisible' | 'managed';
    protectedActions: string[];
  };
  limits: {
    rateLimiting: boolean;
    requestsPerMinute: number;
    maxNodesPerUser: number;
    maxAvatarSizeMB: number;
    allowedAvatarFormats: string[];
    minTipAmount: number;
    maxTipAmount: number;
  };
  analytics: {
    enabled: boolean;
    provider: string | null;
    domain: string | null;
  };
  errorTracking: {
    enabled: boolean;
  };
  performance: {
    enabled: boolean;
    showMetrics: boolean;
  };
  dataExport: {
    enabled: boolean;
    formats: string[];
  };
  realtime: {
    enabled: boolean;
    updateIntervalSeconds: number;
  };
  api: {
    publicAPI: boolean;
    apiKeys: boolean;
  };
  debug: {
    enabled: boolean;
  };
}
