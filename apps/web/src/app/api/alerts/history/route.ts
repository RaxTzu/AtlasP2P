/**
 * Alert History API
 *
 * GET - Get user's alert history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/alerts/history - Get user's alert history
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get query params
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const nodeId = searchParams.get('nodeId');

  // Build query
  let query = supabase
    .from('alert_history')
    .select(`
      *,
      subscription:alert_subscriptions!inner(user_id),
      node:nodes(id, ip, port, display_name, country_name, city)
    `)
    .eq('subscription.user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (nodeId) {
    query = query.eq('node_id', nodeId);
  }

  const { data: history, error, count } = await query;

  if (error) {
    console.error('Failed to fetch alert history:', error);
    return NextResponse.json({ error: 'Failed to fetch alert history' }, { status: 500 });
  }

  return NextResponse.json({
    history: history || [],
    pagination: {
      limit,
      offset,
      total: count,
    },
  });
}
