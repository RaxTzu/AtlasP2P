import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Not admin' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    // Build query
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // Apply filter
    if (filter !== 'all') {
      query = query.eq('resource_type', filter);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Fetch admin emails using admin client
    const adminClient = createAdminClient();
    const adminIds = [...new Set(logs?.map(l => l.admin_id) || [])];

    // Build a map of admin IDs to emails
    const adminEmailMap = new Map<string, string>();
    await Promise.all(
      adminIds.map(async (adminId) => {
        try {
          const { data: { user: adminUser } } = await adminClient.auth.admin.getUserById(adminId);
          if (adminUser?.email) {
            adminEmailMap.set(adminId, adminUser.email);
          }
        } catch (e) {
          // User may have been deleted
        }
      })
    );

    // Enrich logs with admin emails
    const logsWithEmails = logs?.map(log => ({
      ...log,
      admin_email: adminEmailMap.get(log.admin_id) || null
    }));

    return NextResponse.json({ logs: logsWithEmails || [] });
  } catch (error) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
