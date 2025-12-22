import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check if user is authenticated and is admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use admin client for all operations (bypass RLS)
    const adminClient = createAdminClient();
    const { data: { users }, error } = await adminClient.auth.admin.listUsers();
    if (error) throw error;

    const superAdmins = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

    // Get admin status, ban status, and verified nodes count from database
    const { data: adminUsers } = await adminClient
      .from('admin_users')
      .select('user_id')
      .eq('is_active', true);

    const { data: bannedUsers } = await adminClient
      .from('banned_users')
      .select('user_id');

    // Count verified nodes per user
    const { data: verifiedNodes } = await adminClient
      .from('verified_nodes')
      .select('user_id');

    const adminUserIds = new Set(adminUsers?.map(a => a.user_id) || []);
    const bannedUserIds = new Set(bannedUsers?.map(b => b.user_id) || []);

    // Group verified nodes by user_id and count
    const verifiedNodeCounts = new Map<string, number>();
    verifiedNodes?.forEach(v => {
      if (v.user_id) {
        verifiedNodeCounts.set(v.user_id, (verifiedNodeCounts.get(v.user_id) || 0) + 1);
      }
    });

    // Debug logging
    console.log(`[Admin Users API] Super admins:`, superAdmins);
    console.log(`[Admin Users API] Admin user IDs from DB:`, Array.from(adminUserIds));
    console.log(`[Admin Users API] Total users:`, users.length);

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email || '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      is_admin: superAdmins.includes(u.email || '') || adminUserIds.has(u.id),
      is_banned: bannedUserIds.has(u.id),
      verified_nodes_count: verifiedNodeCounts.get(u.id) || 0,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action, reason } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and action required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const adminSupabase = await createClient(); // For getting current admin's info

    if (action === 'promote') {
      // Check if user is already a super admin
      const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);
      const superAdmins = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

      if (targetUser?.user?.email && superAdmins.includes(targetUser.user.email)) {
        return NextResponse.json({ error: 'User is already a super admin' }, { status: 400 });
      }

      // Upsert into admin_users table (reactivate if already exists)
      const { error } = await adminClient
        .from('admin_users')
        .upsert({
          user_id: userId,
          role: 'moderator',
          granted_by: user.id,
          is_active: true,
          revoked_at: null
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'User promoted to admin' });
    }

    if (action === 'demote') {
      // Remove from admin_users table using service role client
      const { error } = await adminClient
        .from('admin_users')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Admin privileges revoked' });
    }

    if (action === 'ban') {
      // Check if user is a super admin
      const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);
      const superAdmins = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

      if (targetUser?.user?.email && superAdmins.includes(targetUser.user.email)) {
        return NextResponse.json({ error: 'Cannot ban super admin users' }, { status: 403 });
      }

      // Upsert into banned_users table using service role client
      const { error } = await adminClient
        .from('banned_users')
        .upsert({
          user_id: userId,
          banned_by: user.id,
          reason: reason || 'No reason provided',
          is_permanent: true,
          banned_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'User banned successfully' });
    }

    if (action === 'unban') {
      // Remove ban by deleting the record using service role client
      const { error } = await adminClient
        .from('banned_users')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'User unbanned successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing user:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Use admin client for user operations
    const adminClient = createAdminClient();

    // Check if target user is super admin
    const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);
    const superAdmins = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

    if (targetUser?.user?.email && superAdmins.includes(targetUser.user.email)) {
      return NextResponse.json({ error: 'Cannot delete super admin users' }, { status: 403 });
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
