#!/usr/bin/env node
/**
 * Config Validation Script
 * Checks project.config.yaml for missing fields compared to .example
 *
 * - Required keys: FAILS if missing
 * - Optional keys: WARNS but passes (app has defaults)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Keys that are OPTIONAL - app provides defaults if missing
// These will only WARN, not FAIL validation
const OPTIONAL_KEY_PATTERNS = [
  // Version-specific marker features (new in recent updates)
  /^themeConfig\.versionStatusColors/,
  /^assets\.markerIcon/,
  /^assets\.overrideAvatarWhenOutdated/,

  // Optional chain config
  /^chainConfig\.releasesUrl$/,
  /^chainConfig\.latestReleaseUrl$/,
  /^chainConfig\.messagePrefix$/,
  /^chainConfig\.addressPrefix$/,
  /^chainConfig\.pubKeyHash$/,

  // Optional theme/UI
  /^themeConfig\.semanticColors/,
  /^themeConfig\.markerCategories/,

  // Optional content
  /^content\.copyrightText$/,
  /^content\.githubRepoUrl$/,
  /^content\.support/,
  /^content\.seo/,

  // Deployment config (not needed for local dev)
  /^deployment\./,

  // Debug/dev features
  /^features\.debug/,
  /^features\.errorTracking/,
  /^features\.performance/,
  /^features\.analytics/,
];

function isOptionalKey(key) {
  return OPTIONAL_KEY_PATTERNS.some(pattern => pattern.test(key));
}

function findMissingKeys(defaults, project, prefix = '') {
  const missing = [];

  for (const [key, value] of Object.entries(defaults)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (!(key in project)) {
      missing.push(fullKey);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively check nested objects
      missing.push(...findMissingKeys(value, project[key] || {}, fullKey));
    }
  }

  return missing;
}

function main() {
  const configPath = join(process.cwd(), 'config', 'project.config.yaml');
  const examplePath = join(process.cwd(), 'config', 'project.config.yaml.example');

  // Check if example exists
  if (!existsSync(examplePath)) {
    log('✗ project.config.yaml.example not found!', 'red');
    process.exit(1);
  }

  // Load example (source of truth)
  const example = yaml.load(readFileSync(examplePath, 'utf8'));

  // Check if project config exists
  if (!existsSync(configPath)) {
    log('⚠  project.config.yaml not found', 'yellow');
    log('   Run: make setup-docker (upstream) or make setup-fork (forks)', 'cyan');
    log('   Loader will fallback to .example', 'cyan');
    process.exit(0);
  }

  // Load project config
  const project = yaml.load(readFileSync(configPath, 'utf8'));

  log('\n📋 Validating configuration...', 'cyan');

  // Check if it's still template
  if (project.chain === 'template') {
    log('\n⚠  WARNING: Config still uses chain="template"', 'yellow');
    log('   This appears to be an uncustomized fork!', 'yellow');
    log('   Edit config/project.config.yaml for your blockchain', 'cyan');
  }

  // Check config version
  if (project.configVersion !== example.configVersion) {
    log(`\n⚠  Config schema version mismatch`, 'yellow');
    log(`   Your config: v${project.configVersion || 'unknown'}`, 'dim');
    log(`   Latest:      v${example.configVersion}`, 'dim');
  }

  // Deep key comparison
  const allMissingKeys = findMissingKeys(example, project);

  // Separate required vs optional
  const requiredMissing = allMissingKeys.filter(key => !isOptionalKey(key));
  const optionalMissing = allMissingKeys.filter(key => isOptionalKey(key));

  // Report optional missing (warning only)
  if (optionalMissing.length > 0) {
    log(`\n💡 Missing ${optionalMissing.length} optional key(s):`, 'dim');
    optionalMissing.forEach(key => {
      log(`   - ${key}`, 'dim');
    });
    log(`   (App will use defaults - run 'make config-sync' to add them)`, 'dim');
  }

  // Report required missing (error)
  if (requiredMissing.length > 0) {
    log(`\n✗ Missing ${requiredMissing.length} required config key(s):`, 'red');
    requiredMissing.forEach(key => {
      log(`   - ${key}`, 'red');
    });
    log(`\n💡 Add these to config/project.config.yaml`, 'cyan');
    log(`   Or run: make config-sync`, 'cyan');
    process.exit(1);
  }

  log('\n✓ Configuration is valid!', 'green');
  if (optionalMissing.length > 0) {
    log(`  ${Object.keys(example).length} top-level keys present (${optionalMissing.length} optional keys using defaults)`, 'green');
  } else {
    log(`  All ${Object.keys(example).length} top-level keys present`, 'green');
  }
  process.exit(0);
}

main();
