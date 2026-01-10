import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_STORAGE_KEY } from './constants';

/**
 * Create Supabase client for middleware
 *
 * Uses the same AUTH_STORAGE_KEY as browser client to ensure cookie names match.
 */
export function createClient(request: NextRequest) {
  // Create a response to modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Use internal URL for server-side (Docker), fallback to public URL
  const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set on request for current request context
            request.cookies.set(name, value);
            // Set on response for browser
            response.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
          });
        },
      },
    }
  );

  return { supabase, response };
}
