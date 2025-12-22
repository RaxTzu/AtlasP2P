#!/usr/bin/env node
/**
 * Generate Edge Runtime Config
 *
 * Reads project.config.yaml and extracts ONLY what Edge runtime needs.
 * Generates packages/config/src/edge.ts with minimal safe exports.
 *
 * Edge runtime can't access Node.js modules (fs, path), so we pre-generate
 * a static TypeScript file at build time.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'config', 'project.config.yaml');
const OUTPUT_PATH = path.join(ROOT_DIR, 'packages', 'config', 'src', 'edge.ts');

// Read and parse YAML config
function readConfig() {
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    console.error(`❌ Failed to read ${CONFIG_PATH}:`, error.message);
    process.exit(1);
  }
}

// Generate TypeScript file content
function generateEdgeConfig(config) {
  // Extract only what Edge runtime needs (middleware)
  const authenticationEnabled = config.features?.core?.authentication ?? true;

  return `// ===========================================
// EDGE RUNTIME CONFIG (AUTO-GENERATED)
// ===========================================
// Generated from config/project.config.yaml
// DO NOT EDIT - Run 'pnpm generate:edge-config' to regenerate
//
// This file contains ONLY what Edge runtime needs.
// Edge runtime (middleware) cannot access Node.js modules,
// so we pre-generate this static file at build time.

/**
 * Minimal config for Edge runtime (middleware)
 * Contains only feature flags needed by middleware
 */
export const edgeConfig = {
  /**
   * Whether authentication is enabled
   * From: features.core.authentication in project.config.yaml
   */
  authenticationEnabled: ${authenticationEnabled},
} as const;

export type EdgeConfig = typeof edgeConfig;
`;
}

// Main execution
function main() {
  console.log('🔧 Generating Edge runtime config...');

  // Read config
  const config = readConfig();
  console.log(`✓ Read config from ${CONFIG_PATH}`);

  // Generate TypeScript content
  const content = generateEdgeConfig(config);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
  console.log(`✓ Generated ${OUTPUT_PATH}`);

  console.log('✅ Edge config generated successfully');
}

main();
