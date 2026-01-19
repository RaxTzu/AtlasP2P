/**
 * Custom Server Wrapper for Next.js Standalone Mode
 *
 * Runs migrations before starting the Next.js server.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'supabase/migrations');

async function syncPasswords(pool) {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) return;

  const users = ['supabase_auth_admin', 'authenticator', 'supabase_storage_admin', 'supabase_functions_admin', 'supabase_admin', 'dashboard_user'];
  const client = await pool.connect();
  try {
    for (const user of users) {
      try {
        await client.query(`ALTER ROLE ${user} WITH PASSWORD '${password.replace(/'/g, "''")}'`);
      } catch (e) {}
    }
    console.log('[Migrations] ✓ Synced passwords');
  } finally {
    client.release();
  }
}

async function runMigrations() {
  if (!process.env.POSTGRES_PASSWORD) {
    console.log('[Migrations] No POSTGRES_PASSWORD, skipping');
    return;
  }

  const host = process.env.POSTGRES_HOST || 'db';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'postgres';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD;

  const pool = new Pool({
    connectionString: `postgresql://${user}:${password}@${host}:${port}/${db}`,
    ssl: false
  });

  try {
    const client = await pool.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`);
    client.release();

    const applied = (await pool.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('[Migrations] No migrations dir');
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    const pending = files.filter(f => !applied.includes(f));

    if (pending.length === 0) {
      console.log('[Migrations] ✓ No pending migrations');
      await syncPasswords(pool);
      return;
    }

    console.log(`[Migrations] Applying ${pending.length} migration(s)`);
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await c.query('COMMIT');
        console.log(`[Migrations] ✓ ${file}`);
      } catch (e) {
        await c.query('ROLLBACK');
        console.error(`[Migrations] ✗ ${file}:`, e.message);
        throw e;
      } finally {
        c.release();
      }
    }

    await syncPasswords(pool);
    console.log('[Migrations] ✓ Done');
  } catch (e) {
    console.error('[Migrations] Error:', e.message);
  } finally {
    await pool.end();
  }
}

async function startServer() {
  await runMigrations();
  console.log('[Server] Starting Next.js server...');
  require('./apps/web/server.js');
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
