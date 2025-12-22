#!/usr/bin/env node
/**
 * Config Validation Script
 * Checks project.config.yaml for missing fields compared to .example
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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
    log(`\n⚠  Config schema version mismatch!`, 'yellow');
    log(`   Your config: v${project.configVersion || 'unknown'}`, 'yellow');
    log(`   Latest:      v${example.configVersion}`, 'yellow');
    log(`   You may be missing new fields`, 'cyan');
  }

  // Deep key comparison
  const missingKeys = findMissingKeys(example, project);

  if (missingKeys.length > 0) {
    log(`\n⚠  Missing ${missingKeys.length} config key(s):`, 'yellow');
    missingKeys.forEach(key => {
      log(`   - ${key}`, 'yellow');
    });
    log(`\n💡 Add these to config/project.config.yaml`, 'cyan');
    log(`   Or copy from config/project.config.yaml.example`, 'cyan');
    log(`\n   Examples: config/examples/dingocoin.yaml`, 'cyan');
    process.exit(1);
  }

  log('\n✓ Configuration is valid!', 'green');
  log(`  All ${Object.keys(example).length} top-level keys present`, 'green');
  process.exit(0);
}

main();
