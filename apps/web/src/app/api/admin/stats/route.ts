import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isUserAdmin } from '@/lib/security';

/**
 * Get admin dashboard stats
 */
export async function GET(request: NextRequest) {
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

  // Get stats
  const [
    { count: totalUsers },
    { count: bannedUsers },
    { count: pendingModeration },
    { count: verifiedNodes }
  ] = await Promise.all([
    supabase.from('verified_nodes').select('*', { count: 'exact', head: true }),
    supabase.from('banned_users').select('*', { count: 'exact', head: true }),
    supabase.from('moderation_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('nodes').select('*', { count: 'exact', head: true }).eq('is_verified', true)
  ]);

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    bannedUsers: bannedUsers || 0,
    pendingModeration: pendingModeration || 0,
    verifiedNodes: verifiedNodes || 0
  });
}
