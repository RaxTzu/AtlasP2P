/**
 * Individual API Key Management Endpoint
 *
 * GET - Get API key details
 * PUT - Update API key settings
 * DELETE - Revoke/delete API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  rotateApiKey,
  API_SCOPES,
  ApiScope,
} from '@/lib/api-keys';
import { rateLimit, RATE_LIMITS } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/keys/:id - Get API key details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: keyId } = await params;

  // Rate limit reads
  const rateLimitResult = await rateLimit(request, 'api-keys:get', RATE_LIMITS.READ);
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
    const key = await getApiKey(user.id, keyId);
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({
      key: {
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
        revokedReason: key.revoked_reason,
        createdAt: key.created_at,
        updatedAt: key.updated_at,
      },
    });
  } catch (error) {
    console.error('Failed to get API key:', error);
    return NextResponse.json({ error: 'Failed to get API key' }, { status: 500 });
  }
}

// PUT /api/keys/:id - Update API key settings
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: keyId } = await params;

  // Rate limit updates
  const rateLimitResult = await rateLimit(request, 'api-keys:update', RATE_LIMITS.API_KEYS);
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
  const { name, description, scopes, rateLimit: customRateLimit, isActive } = body;

  // Validate name if provided
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Key name cannot be empty' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Key name must be 100 characters or less' }, { status: 400 });
    }
  }

  // Validate scopes if provided
  if (scopes !== undefined) {
    const validScopes = Object.keys(API_SCOPES);
    if (!Array.isArray(scopes)) {
      return NextResponse.json({ error: 'Scopes must be an array' }, { status: 400 });
    }
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        return NextResponse.json(
          { error: `Invalid scope: ${scope}. Valid scopes are: ${validScopes.join(', ')}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate rate limit if provided
  if (customRateLimit !== undefined) {
    if (typeof customRateLimit !== 'number' || customRateLimit < 10 || customRateLimit > 10000) {
      return NextResponse.json(
        { error: 'Rate limit must be between 10 and 10000 requests per hour' },
        { status: 400 }
      );
    }
  }

  try {
    const key = await updateApiKey(user.id, keyId, {
      name: name?.trim(),
      description: description?.trim(),
      scopes: scopes as ApiScope[],
      rateLimit: customRateLimit,
      isActive,
    });

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({
      key: {
        id: key.id,
        name: key.name,
        keyPrefix: key.key_prefix,
        description: key.description,
        scopes: key.scopes,
        rateLimit: key.rate_limit,
        isActive: key.is_active,
        updatedAt: key.updated_at,
      },
    });
  } catch (error) {
    console.error('Failed to update API key:', error);
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}

// DELETE /api/keys/:id - Revoke or delete API key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: keyId } = await params;

  // Rate limit deletions
  const rateLimitResult = await rateLimit(request, 'api-keys:delete', RATE_LIMITS.API_KEYS);
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

  // Check for permanent delete flag
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === 'true';

  try {
    if (permanent) {
      // Permanently delete the key
      await deleteApiKey(user.id, keyId);
      return NextResponse.json({ success: true, message: 'API key deleted permanently' });
    } else {
      // Just revoke the key (default)
      await revokeApiKey(user.id, keyId, 'Revoked by user');
      return NextResponse.json({ success: true, message: 'API key revoked' });
    }
  } catch (error) {
    console.error('Failed to delete/revoke API key:', error);
    return NextResponse.json({ error: 'Failed to delete/revoke API key' }, { status: 500 });
  }
}
