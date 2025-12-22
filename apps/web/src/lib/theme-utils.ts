/**
 * Theme Utilities
 *
 * Helper functions for accessing theme colors from project configuration.
 * These functions ensure consistent color usage across all components.
 */

import { getThemeConfig } from '@/config';

/**
 * Get the primary theme color
 * Used for main branding elements, primary buttons, etc.
 */
export function getPrimaryColor(): string {
  return getThemeConfig().primaryColor;
}

/**
 * Get the secondary theme color
 * Used for secondary buttons, alternative elements, and accents.
 */
export function getSecondaryColor(): string {
  return getThemeConfig().secondaryColor;
}

/**
 * Get the accent theme color
 * Used for hover states, highlights, and interactive elements.
 */
export function getAccentColor(): string {
  return getThemeConfig().accentColor;
}

/**
 * Get the offline node color
 * Used for nodes that are currently offline/unreachable.
 */
export function getOfflineColor(): string {
  return getThemeConfig().offlineColor;
}

/**
 * Get a tier color by tier name
 * @param tier - The tier name (diamond, gold, silver, bronze, standard)
 */
export function getTierColor(tier: string): string {
  const tierColors = getThemeConfig().tierColors;
  return tierColors[tier as keyof typeof tierColors]?.color || tierColors.standard.color;
}

/**
 * Get all tier colors as a record
 */
export function getAllTierColors(): Record<string, string> {
  const tierColors = getThemeConfig().tierColors;
  return {
    diamond: tierColors.diamond.color,
    gold: tierColors.gold.color,
    silver: tierColors.silver.color,
    bronze: tierColors.bronze.color,
    standard: tierColors.standard.color,
  };
}

/**
 * Generate inline style object for primary color
 * Useful for applying color to elements
 */
export function primaryColorStyle(): React.CSSProperties {
  return { color: getPrimaryColor() };
}

/**
 * Generate inline style object for secondary color
 * Useful for applying color to elements
 */
export function secondaryColorStyle(): React.CSSProperties {
  return { color: getSecondaryColor() };
}

/**
 * Generate inline style object for accent color
 * Useful for applying color to elements
 */
export function accentColorStyle(): React.CSSProperties {
  return { color: getAccentColor() };
}

/**
 * Generate inline style object for background color
 * @param color - The color to use for background
 */
export function backgroundColorStyle(color: string): React.CSSProperties {
  return { backgroundColor: color };
}

/**
 * Generate inline style object for border color
 * @param color - The color to use for border
 */
export function borderColorStyle(color: string): React.CSSProperties {
  return { borderColor: color };
}
