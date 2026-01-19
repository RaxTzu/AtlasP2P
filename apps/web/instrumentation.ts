// ===========================================
// INSTRUMENTATION - Server Initialization
// ===========================================
// This file runs ONCE when the Next.js server starts
// NOTE: Migrations run via docker/entrypoint.sh in production

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load project configuration on server startup
    const { autoLoadConfig } = await import('@atlasp2p/config/loader.server');

    try {
      // Load config (includes Zod validation)
      autoLoadConfig();

      // Run feature flags validation in PRODUCTION too
      const { validateFeatureFlags, printFeatureFlags } = await import('@atlasp2p/config');
      const validation = validateFeatureFlags();

      if (!validation.valid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(err => console.error(`  - ${err}`));
        throw new Error('Invalid configuration - check errors above');
      }

      console.log('✓ Project configuration loaded and validated');

      // Print feature flags in development mode
      if (process.env.NODE_ENV === 'development') {
        printFeatureFlags();
      }
    } catch (error) {
      console.error('✗ Configuration error:', error);
      throw error; // Prevent server start
    }
  }
}
