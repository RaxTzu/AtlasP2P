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
      await syncAdminUsers(pool);
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
    await syncAdminUsers(pool);
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

/**
 * Sync ADMIN_EMAILS from environment to admin_users table.
 * This ensures admins defined in config automatically get database access.
 */
async function syncAdminUsers(pool) {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    console.log('[Migrate] No ADMIN_EMAILS configured, skipping admin sync');
    return;
  }

  const emails = adminEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    return;
  }

  console.log(`[Migrate] Syncing ${emails.length} admin email(s) to admin_users...`);

  for (const email of emails) {
    try {
      // Look up user by email in auth.users
      const { rows } = await pool.query(
        `SELECT id FROM auth.users WHERE LOWER(email) = $1`,
        [email]
      );

      if (rows.length === 0) {
        console.log(`[Migrate] Admin email ${email} not found in auth.users (user not registered yet)`);
        continue;
      }

      const userId = rows[0].id;

      // Upsert into admin_users with super_admin role
      await pool.query(`
        INSERT INTO public.admin_users (user_id, role, is_active, created_at, updated_at)
        VALUES ($1, 'super_admin', true, NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          role = 'super_admin',
          is_active = true,
          updated_at = NOW()
      `, [userId]);

      console.log(`[Migrate] ✓ Admin synced: ${email} (${userId})`);
    } catch (err) {
      console.error(`[Migrate] ✗ Failed to sync admin ${email}:`, err.message);
    }
  }

  console.log('[Migrate] ✓ Admin users synced');
}

main().catch(err => {
  console.error('[Migrate] Fatal:', err.message);
  process.exit(1);
});
