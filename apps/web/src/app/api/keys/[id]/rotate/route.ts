/**
 * API Key Rotation Endpoint
 *
 * POST - Rotate an API key (revoke old, create new with same settings)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rotateApiKey } from '@/lib/api-keys';
import { rateLimit, RATE_LIMITS } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/keys/:id/rotate - Rotate an API key
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: keyId } = await params;

  // Rate limit rotation (counts as key operation)
  const rateLimitResult = await rateLimit(request, 'api-keys:rotate', RATE_LIMITS.API_KEYS);
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

  try {
    const result = await rotateApiKey(user.id, keyId);

    return NextResponse.json({
      key: {
        id: result.key.id,
        name: result.key.name,
        keyPrefix: result.key.key_prefix,
        description: result.key.description,
        scopes: result.key.scopes,
        rateLimit: result.key.rate_limit,
        isActive: result.key.is_active,
        createdAt: result.key.created_at,
      },
      rawKey: result.rawKey, // Only returned once!
      warning: 'Store this key securely. It will not be shown again. Your old key has been revoked.',
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to rotate API key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rotate API key' },
      { status: 500 }
    );
  }
}
