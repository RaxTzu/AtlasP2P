import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';
import { getFeatureFlags } from '@atlasp2p/config';

/**
 * Enhanced middleware with feature flag support
 *
 * Runs BEFORE page rendering to:
 * 1. Protect routes based on feature flags
 * 2. Handle authentication (if enabled)
 * 3. Enforce admin access (if admin mode enabled)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Load feature flags
  const flags = getFeatureFlags();

  // Create Supabase client for middleware
  const { supabase, response } = createClient(request);

  // ===========================================
  // FEATURE FLAG ENFORCEMENT
  // ===========================================

  // Block admin routes if admin mode is disabled
  if (pathname.startsWith('/admin') && !flags.core.adminMode) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'feature_disabled');
    redirectUrl.searchParams.set('message', 'Admin features are disabled');
    return NextResponse.redirect(redirectUrl);
  }

  // Block profile routes if profiles are disabled
  if (pathname.startsWith('/profiles') && !flags.core.nodeProfiles) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'feature_disabled');
    redirectUrl.searchParams.set('message', 'Node profiles are disabled');
    return NextResponse.redirect(redirectUrl);
  }

  // Block leaderboard if disabled
  if (pathname.startsWith('/leaderboard') && !flags.community.leaderboard) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'feature_disabled');
    redirectUrl.searchParams.set('message', 'Leaderboard is disabled');
    return NextResponse.redirect(redirectUrl);
  }

  // Block stats page if disabled
  if (pathname.startsWith('/stats') && !flags.stats.enabled) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'feature_disabled');
    redirectUrl.searchParams.set('message', 'Statistics are disabled');
    return NextResponse.redirect(redirectUrl);
  }

  // ===========================================
  // AUTHENTICATION ENFORCEMENT
  // ===========================================

  // Only enforce authentication if it's enabled
  if (!flags.core.authentication) {
    // Authentication is disabled - allow all routes
    return response;
  }

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes that require authentication
  const protectedRoutes = ['/my-nodes', '/profiles/edit'];

  // Add admin routes if admin mode is enabled
  if (flags.core.adminMode) {
    protectedRoutes.push('/admin');
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Not authenticated - redirect to login
    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Admin routes require admin privileges (if admin mode enabled)
    if (flags.core.adminMode && pathname.startsWith('/admin')) {
      // Check if user is admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('revoked_at', null)
        .single();

      // Not an admin - redirect to home with error
      if (!adminUser) {
        const redirectUrl = new URL('/', request.url);
        redirectUrl.searchParams.set('error', 'unauthorized');
        redirectUrl.searchParams.set('message', 'Admin access required');
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return response;
}

/**
 * Configure which routes the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
