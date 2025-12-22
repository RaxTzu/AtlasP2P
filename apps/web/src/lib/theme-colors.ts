/**
 * Config-driven tier color system for consistent styling across 2D map and 3D globe
 *
 * IMPORTANT: This system is fully config-driven. Colors come from project.config.yaml
 * When forking for another coin, simply edit the YAML file.
 *
 * Fallback default colors are provided if config doesn't specify them.
 */

import type { NodeTier, NodeStatus, TierColorConfig } from '@atlasp2p/types';
import { getThemeConfig } from '@/config';

// Fallback defaults (used if not specified in YAML)
const DEFAULT_TIER_COLORS: Record<NodeTier, TierColorConfig> = {
  diamond: {
    color: '#00d4ff',
    icon: '💎',
    label: 'Diamond',
  },
  gold: {
    color: '#ffd700',
    icon: '🥇',
    label: 'Gold',
  },
  silver: {
    color: '#c0c0c0',
    icon: '🥈',
    label: 'Silver',
  },
  bronze: {
    color: '#cd7f32',
    icon: '🥉',
    label: 'Bronze',
  },
  standard: {
    color: '#ff8c00',
    icon: '📍',
    label: 'Standard',
  },
};

const DEFAULT_OFFLINE_COLOR = '#94a3b8';
const DEFAULT_REACHABLE_COLOR = '#f59e0b'; // Orange/warning for TCP-only connections

/**
 * Get tier colors from config or use defaults
 * Memoized to avoid repeated config reads
 */
let _cachedTierColors: Record<NodeTier, TierColorConfig> | null = null;
let _cachedOfflineColor: string | null = null;
let _cachedReachableColor: string | null = null;

function getTierColorsFromConfig(): Record<NodeTier, TierColorConfig> {
  if (_cachedTierColors) {
    return _cachedTierColors;
  }

  try {
    const theme = getThemeConfig();
    _cachedTierColors = theme.tierColors || DEFAULT_TIER_COLORS;
    _cachedOfflineColor = theme.offlineColor || DEFAULT_OFFLINE_COLOR;
    _cachedReachableColor = (theme as any).reachableColor || DEFAULT_REACHABLE_COLOR;
  } catch (error) {
    // Fallback to defaults if config unavailable (e.g., client-side)
    _cachedTierColors = DEFAULT_TIER_COLORS;
    _cachedOfflineColor = DEFAULT_OFFLINE_COLOR;
    _cachedReachableColor = DEFAULT_REACHABLE_COLOR;
  }

  return _cachedTierColors;
}

/**
 * Get tier color with status support
 * Fully config-driven - reads from YAML
 *
 * @param tier - Node tier (diamond, gold, silver, bronze, standard)
 * @param status - Node status ('up', 'reachable', 'down', 'pending') or boolean for backward compat
 * @returns Hex color code
 */
export function getTierColor(tier: NodeTier | null | undefined, status: NodeStatus | boolean = true): string {
  // Initialize cache if needed
  getTierColorsFromConfig();

  // Handle boolean for backward compatibility (true = 'up', false = 'down')
  const nodeStatus: NodeStatus = typeof status === 'boolean'
    ? (status ? 'up' : 'down')
    : status;

  // Offline/down nodes show config-defined offline color (gray)
  if (nodeStatus === 'down' || nodeStatus === 'pending') {
    return _cachedOfflineColor || DEFAULT_OFFLINE_COLOR;
  }

  // Reachable nodes show orange/warning color
  if (nodeStatus === 'reachable') {
    return _cachedReachableColor || DEFAULT_REACHABLE_COLOR;
  }

  // Online ('up') nodes show their tier color
  const tierColors = getTierColorsFromConfig();
  const tierConfig = tier ? tierColors[tier] : tierColors.standard;
  return tierConfig?.color || tierColors.standard.color;
}

/**
 * Get tier icon from config
 * @param tier - Node tier
 * @returns Icon string (emoji or custom)
 */
export function getTierIcon(tier: NodeTier | null | undefined): string {
  const tierColors = getTierColorsFromConfig();
  const tierConfig = tier ? tierColors[tier] : tierColors.standard;
  return tierConfig?.icon || tierColors.standard.icon;
}

/**
 * Get tier label from config
 * @param tier - Node tier
 * @returns Human-readable label
 */
export function getTierLabel(tier: NodeTier | null | undefined): string {
  const tierColors = getTierColorsFromConfig();
  const tierConfig = tier ? tierColors[tier] : tierColors.standard;
  return tierConfig?.label || tierColors.standard.label;
}

/**
 * Get all tier colors as an array (useful for charts/legends)
 */
export function getAllTierColors(): Array<{ tier: NodeTier; color: string; icon: string; label: string }> {
  const tierColors = getTierColorsFromConfig();
  return (Object.keys(tierColors) as NodeTier[]).map(tier => ({
    tier,
    color: tierColors[tier].color,
    icon: tierColors[tier].icon,
    label: tierColors[tier].label,
  }));
}

/**
 * Reset cache (useful for testing or config hot-reload)
 */
export function resetTierColorCache(): void {
  _cachedTierColors = null;
  _cachedOfflineColor = null;
  _cachedReachableColor = null;
}
