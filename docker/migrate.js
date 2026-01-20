#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * Standalone script to run SQL migrations.
 * Called by entrypoint.sh before starting the app.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || '/app/supabase/migrations';

async function main() {
  const targetPassword = process.env.POSTGRES_PASSWORD;
  if (!targetPassword) {
    console.log('[Migrate] No POSTGRES_PASSWORD, skipping migrations');
    return; // Clean exit without process.exit
  }

  const host = process.env.POSTGRES_HOST || 'db';
  const port = parseInt(process.env.POSTGRES_PORT || '5432');
  const database = process.env.POSTGRES_DB || 'postgres';
  // Use supabase_admin (superuser in Supabase image) to be able to ALTER reserved roles
  const user = process.env.POSTGRES_USER || 'supabase_admin';

  // Try target password first, fall back to default 'postgres' (Supabase image default)
  let pool;
  let currentPassword;

  for (const tryPassword of [targetPassword, 'postgres']) {
    try {
      const testPool = new Pool({ host, port, database, user, password: tryPassword, max: 1 });
      await testPool.query('SELECT 1');
      pool = new Pool({ host, port, database, user, password: tryPassword });
      currentPassword = tryPassword;
      if (tryPassword !== targetPassword) {
        console.log('[Migrate] Connected with default password, will sync to target');
      }
      await testPool.end();
      break;
    } catch (e) {
      // Try next password
    }
  }

  if (!pool) {
    throw new Error('Could not connect to database with any known password');
  }

  // Sync passwords first if using default password
  if (currentPassword !== targetPassword) {
    await syncPasswords(pool, targetPassword);
    // Reconnect with correct password
    await pool.end();
    pool = new Pool({ host, port, database, user, password: targetPassword });
  }

  try {
    // Create tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const { rows } = await pool.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map(r => r.filename));

    // Get pending migrations
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('[Migrate] No migrations directory:', MIGRATIONS_DIR);
      return; // Clean exit
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .filter(f => !applied.has(f));

    if (files.length === 0) {
      console.log('[Migrate] No pending migrations');
      await syncPasswords(pool, targetPassword);
      return; // Clean exit
    }

    console.log(`[Migrate] Applying ${files.length} migration(s)...`);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migrate] ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrate] ✗ ${file}:`, err.message);
        throw err; // Re-throw to trigger finally and then fail
      } finally {
        client.release();
      }
    }

    await syncPasswords(pool, targetPassword);
    console.log('[Migrate] Done');
  } finally {
    await pool.end();
  }
}

async function syncPasswords(pool, password) {
  // All roles that need password sync (including postgres for Docker volume resets)
  const users = [
    'postgres',
    'supabase_admin',
    'supabase_auth_admin',
    'authenticator',
    'supabase_storage_admin',
    'supabase_functions_admin',
    'dashboard_user'
  ];

  for (const user of users) {
    try {
      await pool.query(`ALTER ROLE ${user} WITH PASSWORD '${password.replace(/'/g, "''")}'`);
    } catch (e) {
      // User might not exist
    }
  }
  console.log('[Migrate] ✓ Synced passwords');
}

main().catch(err => {
  console.error('[Migrate] Fatal:', err.message);
  process.exit(1);
});
