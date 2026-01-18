/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts up.
 * Perfect for running database migrations before handling requests.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on Node.js runtime (not Edge)
    const { runMigrations } = await import('./lib/migrate');
    await runMigrations();
  }
}
