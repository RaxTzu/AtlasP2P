import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Debug endpoint to check auth state
 * GET /api/debug/auth
 *
 * SECURITY: This endpoint is disabled in production
 */
export async function GET() {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints are disabled in production' },
      { status: 404 }
    );
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Filter auth-related cookies
  const authCookies = allCookies.filter(c =>
    c.name.includes('auth') ||
    c.name.includes('sb-') ||
    c.name.includes('supabase')
  );

  // Try to get session
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  return NextResponse.json({
    cookies: {
      total: allCookies.length,
      authRelated: authCookies.length,
      names: authCookies.map(c => c.name),
      // Don't expose values for security, just show they exist
      hasValues: authCookies.map(c => ({ name: c.name, hasValue: !!c.value, length: c.value?.length })),
    },
    session: {
      exists: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      expiresAt: session?.expires_at,
      error: sessionError?.message,
    },
    user: {
      exists: !!user,
      id: user?.id,
      email: user?.email,
      error: userError?.message,
    },
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  });
}
