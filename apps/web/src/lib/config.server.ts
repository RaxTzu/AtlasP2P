// ===========================================
// SERVER-SIDE CONFIG LOADER
// ===========================================
// This file should ONLY be imported in server components

import { autoLoadConfig } from '@atlasp2p/config/loader.server';
import type { ProjectConfig } from '@atlasp2p/types';

let _cachedConfig: ProjectConfig | null = null;

/**
 * Load project configuration (server-side only)
 * Caches the result for performance
 */
export function loadProjectConfig(): ProjectConfig {
  if (_cachedConfig) {
    return _cachedConfig;
  }

  _cachedConfig = autoLoadConfig();
  return _cachedConfig;
}
