#!/usr/bin/env node
/**
 * Config Sync Script
 * Merges missing keys from .example into existing project.config.yaml
 * Preserves existing values while adding new keys with defaults
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
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

/**
 * Deep merge - adds missing keys from source to target
 * Returns array of added key paths
 */
function deepMerge(target, source, prefix = '') {
  const addedKeys = [];

  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (!(key in target)) {
      // Key is missing - add it
      target[key] = value;
      addedKeys.push(fullKey);
    } else if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      // Both are objects - recurse
      addedKeys.push(...deepMerge(target[key], value, fullKey));
    }
    // If key exists and values differ, keep existing (don't overwrite)
  }

  return addedKeys;
}

/**
 * Custom YAML dump that preserves formatting better
 */
function dumpYaml(obj) {
  return yaml.dump(obj, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

function main() {
  const configPath = join(process.cwd(), 'config', 'project.config.yaml');
  const examplePath = join(process.cwd(), 'config', 'project.config.yaml.example');
  const dryRun = process.argv.includes('--dry-run');

  log('\n🔄 Config Sync', 'cyan');
  log('   Merging missing keys from .example into your config\n', 'dim');

  // Check if example exists
  if (!existsSync(examplePath)) {
    log('✗ project.config.yaml.example not found!', 'red');
    process.exit(1);
  }

  // Check if project config exists
  if (!existsSync(configPath)) {
    log('⚠  project.config.yaml not found', 'yellow');
    log('   Run: make setup-fork to create from .example', 'cyan');
    process.exit(1);
  }

  // Load both configs
  const example = yaml.load(readFileSync(examplePath, 'utf8'));
  const project = yaml.load(readFileSync(configPath, 'utf8'));

  // Deep merge - adds missing keys
  const addedKeys = deepMerge(project, example);

  if (addedKeys.length === 0) {
    log('✓ Config already up to date - no missing keys', 'green');
    process.exit(0);
  }

  // Report what will be added
  log(`📝 ${dryRun ? 'Would add' : 'Adding'} ${addedKeys.length} missing key(s):`, 'yellow');
  addedKeys.forEach(key => {
    log(`   + ${key}`, 'green');
  });

  if (dryRun) {
    log('\n   (Dry run - no changes made)', 'dim');
    log('   Run without --dry-run to apply changes', 'cyan');
    process.exit(0);
  }

  // Write updated config
  try {
    // Read original file to preserve comments at top
    const originalContent = readFileSync(configPath, 'utf8');
    const headerMatch = originalContent.match(/^(#[^\n]*\n)+/);
    const header = headerMatch ? headerMatch[0] : '';

    // Generate new YAML
    const newContent = header + dumpYaml(project);

    writeFileSync(configPath, newContent, 'utf8');

    log('\n✓ Config updated successfully!', 'green');
    log(`   Added ${addedKeys.length} key(s) from .example`, 'green');
    log('\n   Review changes: git diff config/project.config.yaml', 'cyan');
  } catch (err) {
    log(`\n✗ Failed to write config: ${err.message}`, 'red');
    process.exit(1);
  }
}

main();
