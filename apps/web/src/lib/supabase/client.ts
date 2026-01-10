import { createBrowserClient } from '@supabase/ssr';
import { getFeatureFlags } from '@atlasp2p/config';
import { AUTH_STORAGE_KEY } from './constants';

export function createClient() {
  const featureFlags = getFeatureFlags();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      url: supabaseUrl ? 'set' : 'MISSING',
      key: supabaseAnonKey ? 'set' : 'MISSING',
    });
    throw new Error('Supabase configuration is incomplete. Please check your environment variables.');
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: featureFlags.core.authentication,
        autoRefreshToken: featureFlags.core.authentication,
        detectSessionInUrl: featureFlags.core.authentication,
        flowType: 'pkce',
        storageKey: AUTH_STORAGE_KEY,
      },
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      global: {
        headers: {
          'x-client-info': 'atlasp2p',
        },
      },
    }
  );
}

// Singleton for client-side usage
let client: ReturnType<typeof createClient> | null = null;

export function getClient() {
  if (!client) {
    client = createClient();
  }
  return client;
}
