/**
 * API Keys Management Endpoint
 *
 * GET - List user's API keys
 * POST - Create a new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createApiKey, listApiKeys, API_SCOPES, ApiScope } from '@/lib/api-keys';
import { rateLimit, RATE_LIMITS } from '@/lib/security';

export const dynamic = 'force-dynamic';

// GET /api/keys - List user's API keys
export async function GET(request: NextRequest) {
  // Rate limit reads
  const rateLimitResult = await rateLimit(request, 'api-keys:list', RATE_LIMITS.READ);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(user.id);

    // Mask sensitive data
    const safeKeys = keys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      description: key.description,
      scopes: key.scopes,
      rateLimit: key.rate_limit,
      lastUsedAt: key.last_used_at,
      requestCount: key.request_count,
      isActive: key.is_active,
      expiresAt: key.expires_at,
      revokedAt: key.revoked_at,
      createdAt: key.created_at,
    }));

    return NextResponse.json({ keys: safeKeys });
  } catch (error) {
    console.error('Failed to list API keys:', error);
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

// POST /api/keys - Create a new API key
export async function POST(request: NextRequest) {
  // Rate limit key creation
  const rateLimitResult = await rateLimit(request, 'api-keys:create', RATE_LIMITS.API_KEYS);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many API key operations. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, scopes, rateLimit: customRateLimit, expiresAt } = body;

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'Key name is required' },
      { status: 400 }
    );
  }

  if (name.length > 100) {
    return NextResponse.json(
      { error: 'Key name must be 100 characters or less' },
      { status: 400 }
    );
  }

  // Validate scopes
  const validScopes = Object.keys(API_SCOPES);
  if (scopes && Array.isArray(scopes)) {
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        return NextResponse.json(
          { error: `Invalid scope: ${scope}. Valid scopes are: ${validScopes.join(', ')}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate rate limit
  if (customRateLimit !== undefined) {
    if (typeof customRateLimit !== 'number' || customRateLimit < 10 || customRateLimit > 10000) {
      return NextResponse.json(
        { error: 'Rate limit must be between 10 and 10000 requests per hour' },
        { status: 400 }
      );
    }
  }

  try {
    // Check existing key count (limit to 10 per user)
    const existingKeys = await listApiKeys(user.id);
    const activeKeys = existingKeys.filter(k => k.is_active && !k.revoked_at);
    if (activeKeys.length >= 10) {
      return NextResponse.json(
        { error: 'Maximum of 10 active API keys allowed per user' },
        { status: 400 }
      );
    }

    const result = await createApiKey(user.id, name.trim(), {
      description: description?.trim(),
      scopes: scopes as ApiScope[],
      rateLimit: customRateLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({
      key: {
        id: result.key.id,
        name: result.key.name,
        keyPrefix: result.key.key_prefix,
        description: result.key.description,
        scopes: result.key.scopes,
        rateLimit: result.key.rate_limit,
        isActive: result.key.is_active,
        expiresAt: result.key.expires_at,
        createdAt: result.key.created_at,
      },
      rawKey: result.rawKey, // Only returned once!
      warning: 'Store this key securely. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
