import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isUserAdmin, logAdminAction, rateLimit, RATE_LIMITS } from '@/lib/security';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Ban a user (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin privileges required' },
      { status: 403 }
    );
  }

  // Rate limiting
  const rateLimitResult = await rateLimit(request, 'admin:ban_user', RATE_LIMITS.PROFILE);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // Parse request body
  const body = await request.json();
  const { reason, duration, notes } = body;

  // Calculate expiration if duration is provided (in hours)
  const expiresAt = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null;

  // Ban the user
  const { data: ban, error: banError } = await supabase
    .from('banned_users')
    .upsert({
      user_id: targetUserId,
      banned_by: user.id,
      reason,
      expires_at: expiresAt?.toISOString(),
      is_permanent: !duration,
      notes
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (banError) {
    return NextResponse.json(
      { error: 'Failed to ban user', details: banError.message },
      { status: 500 }
    );
  }

  // Log admin action
  await logAdminAction(
    user.id,
    'ban_user',
    'user',
    targetUserId,
    { reason, duration, notes },
    request
  );

  return NextResponse.json({
    success: true,
    ban
  });
}

/**
 * Unban a user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin privileges required' },
      { status: 403 }
    );
  }

  // Unban the user
  const { error: unbanError } = await supabase
    .from('banned_users')
    .delete()
    .eq('user_id', targetUserId);

  if (unbanError) {
    return NextResponse.json(
      { error: 'Failed to unban user' },
      { status: 500 }
    );
  }

  // Log admin action
  await logAdminAction(
    user.id,
    'unban_user',
    'user',
    targetUserId,
    undefined,
    request
  );

  return NextResponse.json({
    success: true
  });
}
