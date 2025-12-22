import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { getAnonymousRateLimit, getAuthenticatedRateLimit } from './config-overrides';

/**
 * Security utilities for hardening the application
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Rate limiting based on user ID or IP address
 *
 * Stores rate limit data in Supabase for distributed rate limiting
 *
 * @param request - Next.js request object
 * @param endpoint - Endpoint identifier
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function rateLimit(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = await createClient();

  // Get user ID if authenticated
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Get IP address from headers
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
              request.headers.get('x-real-ip') ||
              'unknown';

  const windowStart = new Date(Date.now() - config.windowMs);

  // Check existing rate limit
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString())
    .or(userId ? `user_id.eq.${userId}` : `ip_address.eq.${ip}`)
    .single();

  const now = new Date();
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  if (existing) {
    const remaining = config.maxRequests - existing.request_count;

    if (existing.request_count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }

    // Increment counter
    await supabase
      .from('rate_limits')
      .update({
        request_count: existing.request_count + 1,
        updated_at: now.toISOString()
      })
      .eq('id', existing.id);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt
    };
  }

  // Create new rate limit record
  await supabase
    .from('rate_limits')
    .insert({
      user_id: userId,
      ip_address: userId ? null : ip,
      endpoint,
      request_count: 1,
      window_start: windowStart.toISOString()
    });

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt
  };
}

/**
 * Check if user is banned
 *
 * @param userId - User ID to check
 * @returns True if user is banned
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .rpc('is_user_banned', { check_user_id: userId });

  return data === true;
}

/**
 * Check if user is admin based on ADMIN_EMAILS environment variable
 *
 * @param userId - User ID to check
 * @returns True if user is admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();

  // Get user email from auth
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== userId || !user.email) {
    return false;
  }

  // Admin emails MUST be set in ADMIN_EMAILS environment variable
  if (!process.env.ADMIN_EMAILS) {
    console.warn('ADMIN_EMAILS environment variable not set');
    return false;
  }

  const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim());
  return adminEmails.includes(user.email);
}

/**
 * Log admin action to audit trail
 *
 * @param adminId - Admin user ID
 * @param action - Action performed
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @param details - Additional details
 * @param request - Request object for IP/user agent
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  const supabase = await createClient();

  const ip = request?.headers.get('x-forwarded-for')?.split(',')[0] ||
             request?.headers.get('x-real-ip') ||
             null;

  const userAgent = request?.headers.get('user-agent') || null;

  await supabase.rpc('log_admin_action', {
    p_admin_id: adminId,
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId || null,
    p_details: details ? JSON.stringify(details) : null,
    p_ip_address: ip,
    p_user_agent: userAgent
  });
}

/**
 * Sanitize user input to prevent XSS
 *
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate file upload for security
 *
 * @param file - File to validate
 * @returns Validation result
 */
export function validateFileUpload(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
    };
  }

  // Check file size (max 2MB)
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 2MB.'
    };
  }

  // Check file name
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.html'];
  const fileName = file.name.toLowerCase();
  if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
    return {
      valid: false,
      error: 'Invalid file extension.'
    };
  }

  return { valid: true };
}

/**
 * Check if image is safe (basic check for malicious content)
 *
 * @param buffer - Image buffer
 * @returns True if image appears safe
 */
export async function isImageSafe(buffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(buffer);

  // Check magic numbers for valid image formats
  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  const isWebP = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

  return isPNG || isJPEG || isGIF || isWebP;
}

/**
 * Generate secure random token
 *
 * @param length - Token length
 * @returns Random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }

  return token;
}

/**
 * Hash password using Web Crypto API
 *
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify CSRF token
 *
 * @param request - Request object
 * @param expectedToken - Expected CSRF token
 * @returns True if valid
 */
export function verifyCsrfToken(request: NextRequest, expectedToken: string): boolean {
  const token = request.headers.get('x-csrf-token') ||
                request.headers.get('csrf-token');

  return token === expectedToken;
}

/**
 * Get client IP address from request
 *
 * @param request - Next.js request object
 * @returns IP address string
 */
export function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip')?.trim() ||
         'unknown';
}

/**
 * Simple in-memory rate limit check (for public API endpoints)
 *
 * This is a simpler version that doesn't require database access,
 * suitable for high-traffic public endpoints.
 *
 * @param identifier - IP address or key ID
 * @param endpoint - Endpoint identifier
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const existing = rateLimitStore.get(key);

  // Clean up old entries periodically (every 100 calls)
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.windowStart < now - config.windowMs * 2) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (existing && existing.windowStart > windowStart) {
    // Within the same window
    if (existing.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(existing.windowStart + config.windowMs)
      };
    }

    existing.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - existing.count,
      resetAt: new Date(existing.windowStart + config.windowMs)
    };
  }

  // New window
  rateLimitStore.set(key, { count: 1, windowStart: now });
  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt: new Date(now + config.windowMs)
  };
}

/**
 * Get dynamic rate limit config with admin settings support
 * Falls back to default if admin setting not configured
 */
export async function getRateLimitConfig(type: 'anonymous' | 'authenticated'): Promise<RateLimitConfig> {
  if (type === 'authenticated') {
    const maxRequests = await getAuthenticatedRateLimit();
    return {
      maxRequests,
      windowMs: 60 * 1000 // 1 minute
    };
  } else {
    const maxRequests = await getAnonymousRateLimit();
    return {
      maxRequests,
      windowMs: 60 * 1000 // 1 minute
    };
  }
}

/**
 * Rate limit configurations for different endpoints
 * NOTE: READ and PUBLIC_API now use dynamic configs via getRateLimitConfig()
 */
export const RATE_LIMITS = {
  // Very strict limits for authentication
  AUTH: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000 // 15 minutes
  },

  // Strict limits for verification attempts
  VERIFY: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000 // 1 hour
  },

  // Moderate limits for profile updates
  PROFILE: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000 // 1 hour
  },

  // Generous limits for read operations
  READ: {
    maxRequests: 60,
    windowMs: 60 * 1000 // 1 minute - 60 req/min for anonymous
  },

  // Public API read endpoints (authenticated with API key)
  PUBLIC_API: {
    maxRequests: 120,
    windowMs: 60 * 1000 // 1 minute - 120 req/min with API key
  },

  // Very strict for file uploads
  UPLOAD: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000 // 1 hour
  },

  // Moderate limits for API tests (email/webhook)
  API_TEST: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000 // 5 minutes
  },

  // Alert subscription management
  ALERTS: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000 // 1 hour - 30 subscription changes per hour
  },

  // Tip config updates
  TIP_CONFIG: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000 // 1 hour - 10 tip config updates per hour
  },

  // Admin actions
  ADMIN: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000 // 1 hour - admins get more headroom
  },

  // API key operations
  API_KEYS: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000 // 1 hour - 20 key operations per hour
  }
};
