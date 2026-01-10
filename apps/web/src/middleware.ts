import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';
import { edgeConfig } from '@atlasp2p/config/edge';

/**
 * Middleware for authentication and authorization
 *
 * Runs BEFORE page rendering to protect routes.
 * Uses Edge-compatible config from project.config.yaml.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If authentication is disabled, allow all requests
  // Config comes from project.config.yaml (auto-generated for Edge runtime)
  if (!edgeConfig.authenticationEnabled) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  const { supabase, response } = createClient(request);

  // Check authentication - use getUser() for security (verifies with server)
  const { data: { user }, error } = await supabase.auth.getUser();

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    const cookies = request.cookies.getAll();
    const authCookies = cookies.filter(c => c.name.includes('auth') || c.name.includes('sb-'));
    console.log(`[Middleware] Path: ${pathname}`);
    console.log(`[Middleware] User: ${user?.email || 'none'}, Error: ${error?.message || 'none'}`);
    console.log(`[Middleware] Auth cookies (${authCookies.length}):`, authCookies.map(c => `${c.name}=${c.value?.substring(0, 50)}...`));
  }

  // If user session is invalid (e.g., user deleted from DB), clear cookies and redirect to auth
  if (error && error.message.includes('User from sub claim in JWT does not exist')) {
    console.log('[Middleware] Invalid session detected, clearing cookies');
    const redirectResponse = NextResponse.redirect(new URL('/auth', request.url));

    // Clear all auth cookies
    redirectResponse.cookies.delete('atlasp2p-auth');
    redirectResponse.cookies.delete('sb-access-token');
    redirectResponse.cookies.delete('sb-refresh-token');

    return redirectResponse;
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/manage', '/my-nodes', '/verify', '/profile'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Not authenticated - redirect to auth page
    if (!user) {
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
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
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
