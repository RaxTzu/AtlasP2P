/**
 * API Middleware
 *
 * Provides authentication and rate limiting for public API endpoints
 * that can be accessed via API keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { validateApiKey, extractApiKey, hasScope, ApiScope } from '@/lib/api-keys';

// ===========================================
// TYPES
// ===========================================

export interface ApiContext {
  isAuthenticated: boolean;
  keyId?: string;
  userId?: string;
  scopes?: ApiScope[];
  rateLimit?: number;
}

export interface RateLimitState {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ===========================================
// MIDDLEWARE
// ===========================================

/**
 * Authenticate a request using API key
 *
 * Returns context about the authenticated key, or null if no valid key
 */
export async function authenticateApiKey(
  request: NextRequest,
  requiredScope?: ApiScope
): Promise<ApiContext> {
  const apiKey = extractApiKey(request.headers);

  if (!apiKey) {
    return { isAuthenticated: false };
  }

  // Get client info for logging
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip');
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  // Validate the key
  const result = await validateApiKey(apiKey, endpoint, method, ip || undefined);

  if (!result.valid) {
    return { isAuthenticated: false };
  }

  // Check required scope if specified
  if (requiredScope && result.scopes && !hasScope(result.scopes, requiredScope)) {
    return { isAuthenticated: false };
  }

  return {
    isAuthenticated: true,
    keyId: result.keyId,
    userId: result.userId,
    scopes: result.scopes,
    rateLimit: result.rateLimit,
  };
}

/**
 * Check rate limit for an API key
 */
export async function checkApiKeyRateLimit(
  keyId: string,
  rateLimit: number
): Promise<RateLimitState> {
  const adminClient = createAdminClient();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const windowStart = new Date(Date.now() - windowMs);

  // Get recent request count from api_key_usage
  const { count, error } = await adminClient
    .from('api_key_usage')
    .select('*', { count: 'exact', head: true })
    .eq('key_id', keyId)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('[API Middleware] Rate limit check failed:', error);
    // Fail open - allow the request
    return {
      allowed: true,
      remaining: rateLimit,
      resetAt: new Date(Date.now() + windowMs),
    };
  }

  const currentCount = count || 0;
  const remaining = Math.max(0, rateLimit - currentCount);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  return {
    allowed: currentCount < rateLimit,
    remaining,
    resetAt,
  };
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(state: RateLimitState, rateLimit: number): HeadersInit {
  return {
    'X-RateLimit-Limit': rateLimit.toString(),
    'X-RateLimit-Remaining': state.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(state.resetAt.getTime() / 1000).toString(),
  };
}

/**
 * Wrapper for public API endpoints that support API key authentication
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withApiKeyAuth(request, 'read:nodes', async (ctx) => {
 *     // Your endpoint logic
 *     return NextResponse.json({ data: ... });
 *   });
 * }
 * ```
 */
export async function withApiKeyAuth(
  request: NextRequest,
  requiredScope: ApiScope,
  handler: (ctx: ApiContext) => Promise<NextResponse>
): Promise<NextResponse> {
  // Authenticate the request
  const ctx = await authenticateApiKey(request, requiredScope);

  if (!ctx.isAuthenticated) {
    // Check if they provided a key at all
    const providedKey = extractApiKey(request.headers);
    if (providedKey) {
      // They provided a key but it's invalid
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 }
      );
    }
    // No key provided - could allow anonymous access or require auth
    // For now, require API key for authenticated endpoints
    return NextResponse.json(
      { error: 'API key required. Include it in Authorization header as "Bearer <key>" or X-API-Key header.' },
      { status: 401 }
    );
  }

  // Check rate limit for this key
  if (ctx.keyId && ctx.rateLimit) {
    const rateLimitState = await checkApiKeyRateLimit(ctx.keyId, ctx.rateLimit);

    if (!rateLimitState.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimitState, ctx.rateLimit),
        }
      );
    }

    // Execute handler and add rate limit headers to response
    const response = await handler(ctx);

    // Clone response to add headers
    const headers = new Headers(response.headers);
    Object.entries(rateLimitHeaders(rateLimitState, ctx.rateLimit)).forEach(([k, v]) => {
      headers.set(k, v);
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Execute handler without rate limiting
  return handler(ctx);
}

/**
 * Allow both API key auth and anonymous access (for public endpoints)
 *
 * If an API key is provided, validate it. If not, allow anonymous access.
 */
export async function withOptionalApiKeyAuth(
  request: NextRequest,
  handler: (ctx: ApiContext | null) => Promise<NextResponse>
): Promise<NextResponse> {
  const apiKey = extractApiKey(request.headers);

  if (apiKey) {
    // Key provided - validate it
    const ctx = await authenticateApiKey(request);

    if (!ctx.isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 }
      );
    }

    // Check rate limit
    if (ctx.keyId && ctx.rateLimit) {
      const rateLimitState = await checkApiKeyRateLimit(ctx.keyId, ctx.rateLimit);

      if (!rateLimitState.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          {
            status: 429,
            headers: rateLimitHeaders(rateLimitState, ctx.rateLimit),
          }
        );
      }

      const response = await handler(ctx);
      const headers = new Headers(response.headers);
      Object.entries(rateLimitHeaders(rateLimitState, ctx.rateLimit)).forEach(([k, v]) => {
        headers.set(k, v);
      });

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return handler(ctx);
  }

  // No key provided - anonymous access
  return handler(null);
}
