// ===========================================
// NODES MAP - CONFIGURATION
// ===========================================
// NOTE: This file now uses YAML-based config from config/project.config.yaml
// All configs are loaded from YAML - NO hardcoded values!
// Configuration is loaded via loader.ts and loader.server.ts

// -------------------------------------------
// TIER CALCULATION LOGIC (not config)
// -------------------------------------------

export interface TierRequirements {
  tier: string;
  verified: boolean;
  minUptime: number;
  minAgeDays: number;
  currentVersion: boolean;
  tipsEnabled?: boolean;
}

export const tierRequirements: TierRequirements[] = [
  {
    tier: 'diamond',
    verified: true,
    minUptime: 99.9,
    minAgeDays: 90,
    currentVersion: true,
    tipsEnabled: true,
  },
  {
    tier: 'gold',
    verified: true,
    minUptime: 99,
    minAgeDays: 60,
    currentVersion: true,
  },
  {
    tier: 'silver',
    verified: true,
    minUptime: 95,
    minAgeDays: 30,
    currentVersion: false,
  },
  {
    tier: 'bronze',
    verified: true,
    minUptime: 0,
    minAgeDays: 0,
    currentVersion: false,
  },
];

// -------------------------------------------
// LEGACY HELPERS REMOVED
// -------------------------------------------
// getChainConfigLegacy and getThemeConfigLegacy have been removed
// Use the new YAML-based loaders instead:
//   import { getChainConfig, getThemeConfig } from '@atlasp2p/config'

// -------------------------------------------
// NEW PLUGGABLE CONFIG SYSTEM
// -------------------------------------------

export * from './loader';
// Note: loader.server.ts is NOT exported here - import it directly when needed server-side

// -------------------------------------------
// FEATURE FLAGS SYSTEM
// -------------------------------------------

export * from './feature-flags';

// -------------------------------------------
// ZOD VALIDATION SCHEMAS
// -------------------------------------------

export * from './schema';

// -------------------------------------------
// EDGE RUNTIME CONFIG
// -------------------------------------------
// Minimal config for Edge runtime (middleware)
// Auto-generated from project.config.yaml
// Import from '@atlasp2p/config/edge' to avoid bundling server code

// NOTE: Edge config NOT exported here to avoid bundling loader.ts
// Import directly: import { edgeConfig } from '@atlasp2p/config/edge'

export function calculateTier(
  isVerified: boolean,
  uptime: number,
  ageDays: number,
  isCurrentVersion: boolean,
  tipsEnabled: boolean
): string {
  for (const req of tierRequirements) {
    const meetsVerified = !req.verified || isVerified;
    const meetsUptime = uptime >= req.minUptime;
    const meetsAge = ageDays >= req.minAgeDays;
    const meetsVersion = !req.currentVersion || isCurrentVersion;
    const meetsTips = !req.tipsEnabled || tipsEnabled;

    if (meetsVerified && meetsUptime && meetsAge && meetsVersion && meetsTips) {
      return req.tier;
    }
  }

  return 'standard';
}

export function isVersionOutdated(
  version: string,
  currentVersion: string,
  minimumVersion: string
): 'current' | 'outdated' | 'critical' {
  const parseVersion = (v: string) => {
    const parts = v.split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };

  const v = parseVersion(version);
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumVersion);

  // Check if current
  if (v.major >= current.major && v.minor >= current.minor) {
    return 'current';
  }

  // Check if critical (below minimum)
  if (v.major < minimum.major || (v.major === minimum.major && v.minor < minimum.minor)) {
    return 'critical';
  }

  return 'outdated';
}
