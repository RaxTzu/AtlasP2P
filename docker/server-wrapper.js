/**
 * Custom Server Wrapper for Next.js Standalone Mode
 *
 * Ensures instrumentation hook runs before starting the Next.js server.
 * This is required because Next.js standalone mode doesn't automatically
 * call instrumentation.js, which means migrations won't run on startup.
 */

const path = require('path');

async function startServer() {
  try {
    // Load and run instrumentation BEFORE starting Next.js
    const instrumentationPath = path.join(__dirname, 'apps/web/.next/server/instrumentation.js');
    console.log('[Server] Loading instrumentation from:', instrumentationPath);

    const instrumentation = require(instrumentationPath);

    if (instrumentation && typeof instrumentation.register === 'function') {
      console.log('[Server] Running instrumentation.register()...');
      await instrumentation.register();
      console.log('[Server] ✓ Instrumentation completed');
    } else {
      console.warn('[Server] Warning: No register() function found in instrumentation');
    }
  } catch (error) {
    console.error('[Server] Failed to run instrumentation:', error.message);
    // Don't fail - allow server to start anyway
  }

  // Now start the actual Next.js server
  console.log('[Server] Starting Next.js server...');
  require('./apps/web/server.js');
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
