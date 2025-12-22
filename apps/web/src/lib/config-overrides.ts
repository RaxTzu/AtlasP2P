// ===========================================
// CONFIG OVERRIDES FROM DATABASE
// ===========================================
// Fetches admin settings from the database and merges with base config
// Use this in API routes that need the most current chain config values

import { createAdminClient } from '@/lib/supabase/server';
import type { ChainConfig, ProjectConfig } from '@atlasp2p/types';
import { loadProjectConfig } from './config.server';

interface AdminSetting {
  key: string;
  value: any;
  category: string;
}

// Cache for admin settings (5 minute TTL)
let _cachedSettings: AdminSetting[] | null = null;
let _cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch admin settings from the database
 * Results are cached for 5 minutes to reduce DB queries
 */
async function fetchAdminSettings(): Promise<AdminSetting[]> {
  const now = Date.now();

  // Return cached if still valid
  if (_cachedSettings && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedSettings;
  }

  try {
    const adminClient = createAdminClient();
    const { data: settings, error } = await adminClient
      .from('admin_settings')
      .select('key, value, category')
      .order('key');

    if (error) {
      console.error('Failed to fetch admin settings:', error);
      return _cachedSettings || [];
    }

    // JSONB values are already parsed by Supabase - no need to JSON.parse
    // Update cache
    _cachedSettings = settings || [];
    _cacheTimestamp = now;

    return _cachedSettings;
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return _cachedSettings || [];
  }
}

/**
 * Get a specific admin setting value
 * Falls back to undefined if not found
 */
export async function getAdminSetting<T>(key: string): Promise<T | undefined> {
  const settings = await fetchAdminSettings();
  const setting = settings.find(s => s.key === key);
  return setting?.value as T | undefined;
}

/**
 * Get chain config with database overrides applied
 * Database values take precedence over project.config.yaml ONLY if they differ
 * This allows YAML updates to flow through unless admin explicitly overrides
 */
export async function getChainConfigWithOverrides(): Promise<ChainConfig> {
  const baseConfig = loadProjectConfig();
  const chainConfig = { ...baseConfig.chainConfig };
  const settings = await fetchAdminSettings();

  // Apply chain-related overrides only if DB has a value
  for (const setting of settings) {
    if (setting.category !== 'chain') continue;
    if (setting.value === null || setting.value === undefined) continue;

    switch (setting.key) {
      case 'chain.currentVersion':
        chainConfig.currentVersion = setting.value;
        break;
      case 'chain.minimumVersion':
        chainConfig.minimumVersion = setting.value;
        break;
      case 'chain.criticalVersion':
        chainConfig.criticalVersion = setting.value;
        break;
      case 'chain.protocolVersion':
        chainConfig.protocolVersion = Number(setting.value);
        break;
      case 'chain.latestReleaseUrl':
        chainConfig.latestReleaseUrl = setting.value;
        break;
      case 'chain.releasesUrl':
        chainConfig.releasesUrl = setting.value;
        break;
    }
  }

  return chainConfig;
}

/**
 * Get the YAML config value for a setting key (for comparison in UI)
 */
export function getYamlConfigValue(key: string): any {
  const config = loadProjectConfig();

  switch (key) {
    case 'chain.currentVersion':
      return config.chainConfig.currentVersion;
    case 'chain.minimumVersion':
      return config.chainConfig.minimumVersion;
    case 'chain.criticalVersion':
      return config.chainConfig.criticalVersion;
    case 'chain.protocolVersion':
      return config.chainConfig.protocolVersion;
    case 'chain.latestReleaseUrl':
      return config.chainConfig.latestReleaseUrl;
    case 'chain.releasesUrl':
      return config.chainConfig.releasesUrl;
    default:
      return undefined;
  }
}

/**
 * Get full project config with database overrides applied
 * Database values take precedence over project.config.yaml
 */
export async function getProjectConfigWithOverrides(): Promise<ProjectConfig> {
  const baseConfig = loadProjectConfig();
  const settings = await fetchAdminSettings();

  // Deep clone to avoid mutating the cached config
  const config: ProjectConfig = JSON.parse(JSON.stringify(baseConfig));

  // Apply all overrides
  for (const setting of settings) {
    switch (setting.category) {
      case 'chain':
        switch (setting.key) {
          case 'chain.currentVersion':
            config.chainConfig.currentVersion = setting.value;
            break;
          case 'chain.minimumVersion':
            config.chainConfig.minimumVersion = setting.value;
            break;
          case 'chain.criticalVersion':
            config.chainConfig.criticalVersion = setting.value;
            break;
          case 'chain.protocolVersion':
            config.chainConfig.protocolVersion = Number(setting.value);
            break;
          case 'chain.latestReleaseUrl':
            config.chainConfig.latestReleaseUrl = setting.value;
            break;
          case 'chain.releasesUrl':
            config.chainConfig.releasesUrl = setting.value;
            break;
        }
        break;

      case 'crawler':
        // Crawler settings can be read by crawler via API
        break;

      case 'notifications':
        // Notification settings
        break;
    }
  }

  return config;
}

/**
 * Check if maintenance mode is enabled
 * When true, alert notifications should be suppressed
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const value = await getAdminSetting<boolean>('notifications.maintenanceMode');
  return value === true;
}

/**
 * Get crawler scan interval in minutes
 */
export async function getCrawlerInterval(): Promise<number> {
  const value = await getAdminSetting<number>('crawler.scanIntervalMinutes');
  return value ?? 5; // Default 5 minutes
}

/**
 * Get node prune threshold in hours
 */
export async function getNodePruneHours(): Promise<number> {
  const value = await getAdminSetting<number>('crawler.pruneAfterHours');
  return value ?? 168; // Default 7 days (168 hours)
}

/**
 * Get anonymous API rate limit (requests per minute)
 */
export async function getAnonymousRateLimit(): Promise<number> {
  const value = await getAdminSetting<number>('api.anonymousRateLimit');
  return value ?? 60; // Default 60 req/min
}

/**
 * Get authenticated API rate limit (requests per minute)
 */
export async function getAuthenticatedRateLimit(): Promise<number> {
  const value = await getAdminSetting<number>('api.authenticatedRateLimit');
  return value ?? 120; // Default 120 req/min
}

/**
 * Clear the settings cache
 * Useful after an admin updates settings
 */
export function clearSettingsCache(): void {
  _cachedSettings = null;
  _cacheTimestamp = 0;
}
