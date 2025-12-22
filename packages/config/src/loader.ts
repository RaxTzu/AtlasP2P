// ===========================================
// CONFIGURATION LOADER (CLIENT-SAFE)
// ===========================================
// Provides access to pre-loaded project configuration

import type {
  ProjectConfig,
  ChainConfig,
  ThemeConfig,
  ContentConfig,
  TileStyleConfig,
  SocialLink,
  NavigationItem,
  FeatureFlags,
  MarkerCategory,
} from '@atlasp2p/types';

// This will be initialized with the project config
let _projectConfig: ProjectConfig | null = null;

/**
 * Initialize the config system with a pre-loaded project config
 * This should be called once at app startup
 */
export function initializeConfig(config: ProjectConfig) {
  _projectConfig = config;
}

/**
 * Get the full project configuration
 */
export function getProjectConfig(): ProjectConfig {
  if (!_projectConfig) {
    throw new Error(
      'Project configuration not initialized. Call initializeConfig() with the loaded config first.'
    );
  }
  return _projectConfig;
}

/**
 * Get chain identifier (e.g., "dingocoin", "bitcoin")
 */
export function getChain(): string {
  return getProjectConfig().chain;
}

/**
 * Get chain configuration
 */
export function getChainConfig(): ChainConfig {
  return getProjectConfig().chainConfig;
}

/**
 * Get theme configuration
 */
export function getThemeConfig(): ThemeConfig {
  return getProjectConfig().themeConfig;
}

/**
 * Get content configuration
 */
export function getContentConfig(): ContentConfig {
  return getProjectConfig().content;
}

/**
 * Get navigation items
 */
export function getNavigationItems(): NavigationItem[] {
  return getProjectConfig().content.navigation;
}

/**
 * Get social links
 */
export function getSocialLinks(): SocialLink[] {
  return getProjectConfig().content.social;
}

/**
 * Get footer links
 */
export function getFooterLinks() {
  return getProjectConfig().content.footerLinks;
}

/**
 * Get map tile styles
 */
export function getTileStyles(): TileStyleConfig[] {
  return getProjectConfig().mapConfig.tileStyles;
}

/**
 * Get default tile style
 */
export function getDefaultTileStyle(): string {
  return getProjectConfig().mapConfig.defaultTileStyle;
}

/**
 * Get feature flags (YAML structure)
 * Note: For the full ApplicationFeatureFlags, use getFeatureFlags from '@atlasp2p/config'
 * This is kept for internal use only
 */
function _getFeatureFlagsYaml(): FeatureFlags {
  return getProjectConfig().features;
}

/**
 * Get map configuration
 */
export function getMapConfig() {
  return getProjectConfig().mapConfig;
}

/**
 * Get asset paths
 */
export function getAssetPaths() {
  return getProjectConfig().assets;
}

/**
 * Get marker categories (icon metadata for map markers)
 */
export function getMarkerCategories(): Record<string, MarkerCategory> {
  return getProjectConfig().themeConfig.markerCategories || {};
}
