/**
 * Database Migration Runner
 *
 * Automatically runs pending migrations at application startup.
 * Uses a tracking table to know which migrations have been applied.
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// In development: cwd is apps/web, so ../../supabase/migrations
// In production standalone: cwd is /app, so ./supabase/migrations
const MIGRATIONS_DIR = process.env.NODE_ENV === 'production'
  ? path.join(process.cwd(), 'supabase/migrations')
  : path.join(process.cwd(), '../../supabase/migrations');

interface Migration {
  filename: string;
  sql: string;
}

/**
 * Get database connection pool
 */
function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL not set - cannot run migrations');
  }

  return new Pool({
    connectionString,
    // Disable SSL for local Docker, enable for Supabase Cloud
    ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false
  });
}

/**
 * Get all migration files sorted by name (which includes timestamp)
 */
function getMigrationFiles(): Migration[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[Migrations] No migrations directory found at:', MIGRATIONS_DIR);
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => ({
    filename,
    sql: fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8')
  }));
}

/**
 * Ensure schema_migrations table exists
 */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations ORDER BY filename');
    return result.rows.map(row => row.filename);
  } catch (error) {
    console.warn('[Migrations] Could not fetch applied migrations, assuming none:', error);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(pool: Pool, migration: Migration): Promise<boolean> {
  const client = await pool.connect();

  try {
    console.log(`[Migrations] Applying ${migration.filename}...`);

    // Begin transaction
    await client.query('BEGIN');

    try {
      // Execute migration SQL
      await client.query(migration.sql);

      // Record migration as applied
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [migration.filename]
      );

      // Commit transaction
      await client.query('COMMIT');

      console.log(`[Migrations] ✓ Applied ${migration.filename}`);
      return true;
    } catch (err) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error(`[Migrations] Failed to apply ${migration.filename}:`, err);
      return false;
    }
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  // Skip migrations if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.log('[Migrations] DATABASE_URL not set, skipping migrations');
    return;
  }

  console.log('[Migrations] Starting migration check...');

  const pool = getPool();

  try {
    // Ensure migrations tracking table exists
    await ensureMigrationsTable(pool);

    // Get all migrations and applied migrations
    const allMigrations = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(pool);

    // Find pending migrations
    const pendingMigrations = allMigrations.filter(
      m => !appliedMigrations.includes(m.filename)
    );

    if (pendingMigrations.length === 0) {
      console.log('[Migrations] ✓ No pending migrations');
      return;
    }

    console.log(`[Migrations] Found ${pendingMigrations.length} pending migration(s)`);

    // Apply each pending migration
    for (const migration of pendingMigrations) {
      const success = await applyMigration(pool, migration);
      if (!success) {
        console.error(`[Migrations] ⚠ Migration ${migration.filename} failed, stopping`);
        throw new Error(`Migration ${migration.filename} failed`);
      }
    }

    console.log('[Migrations] ✓ All migrations applied successfully');
  } catch (error) {
    console.error('[Migrations] ⚠ Migration process failed:', error);
    // Don't throw - let the app start anyway with a warning
    // In production, you might want to throw to prevent starting with wrong schema
  } finally {
    await pool.end();
  }
}
