// ===========================================
// SERVER-SIDE CONFIGURATION LOADER
// ===========================================
// This file uses Node.js fs/path and should ONLY be imported server-side

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import type { ProjectConfig } from '@atlasp2p/types';
import { initializeConfig } from './loader';
import { ProjectConfigSchema } from './schema';
import { ZodError } from 'zod';

/**
 * Load configuration from YAML file (SERVER-SIDE ONLY)
 * @param configPath - Path to the YAML config file
 */
export function loadConfigFromFile(configPath: string): ProjectConfig {
  try {
    // Read and parse YAML file
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const rawConfig = yaml.load(fileContents);

    // Validate with Zod
    const result = ProjectConfigSchema.safeParse(rawConfig);

    if (!result.success) {
      const errors = result.error.errors.map(e =>
        `  ${e.path.join('.')}: ${e.message}`
      ).join('\n');

      throw new Error(
        `Invalid configuration in ${configPath}:\n${errors}\n\n` +
        `Please check your project.config.yaml file against the schema.`
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ZodError) {
      // Re-throw Zod errors with formatted message
      const errors = error.errors.map(e =>
        `  ${e.path.join('.')}: ${e.message}`
      ).join('\n');

      throw new Error(
        `Configuration validation failed in ${configPath}:\n${errors}\n\n` +
        `Please check your project.config.yaml file.`
      );
    }

    // Re-throw other errors (file not found, YAML parse errors, etc.)
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}

/**
 * Auto-load configuration from default location (SERVER-SIDE ONLY)
 * Looks for config/project.config.yaml in the project root
 * Falls back to project.config.yaml.example if not found (for CI/CD and upstream development)
 * Automatically initializes the config singleton
 */
export function autoLoadConfig(): ProjectConfig {
  // Try multiple possible paths, with fallback to .example
  const possiblePaths = [
    // Primary config (for forks and local development)
    path.join(process.cwd(), 'config', 'project.config.yaml'),
    path.join(process.cwd(), 'config', 'project.config.yml'),
    path.join(process.cwd(), '..', '..', 'config', 'project.config.yaml'),
    path.join(process.cwd(), '..', '..', 'config', 'project.config.yml'),
    // Fallback to .example (for CI/CD and upstream development)
    path.join(process.cwd(), 'config', 'project.config.yaml.example'),
    path.join(process.cwd(), '..', '..', 'config', 'project.config.yaml.example'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      const config = loadConfigFromFile(configPath);

      // Log which config file was loaded (helpful for debugging)
      if (configPath.includes('.example')) {
        console.log(`⚠️  Using example config: ${path.basename(configPath)}`);
        console.log('   For production, copy this to project.config.yaml and customize');
      }

      // Initialize the config singleton so it's available everywhere
      initializeConfig(config);
      return config;
    }
  }

  throw new Error(
    'Could not find project.config.yaml or project.config.yaml.example. ' +
    'Please create one in the /config directory.'
  );
}
