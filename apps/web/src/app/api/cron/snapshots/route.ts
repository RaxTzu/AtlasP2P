import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getChain } from '@atlasp2p/config';

/**
 * Create network snapshot for historical tracking
 *
 * DEPRECATED: Snapshots are now created automatically by the crawler service.
 * This endpoint remains as a manual fallback/recovery mechanism.
 *
 * The crawler calls create_network_snapshot() after each crawl pass,
 * which automatically deduplicates to hourly intervals.
 *
 * Manual usage (if needed): curl -X POST http://localhost:4000/api/cron/snapshots
 */
export async function POST(request: NextRequest) {
  // Optional: Add authorization header check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const chain = getChain();

  try {
    // Call database function to create snapshot
    const { data, error } = await supabase
      .rpc('create_network_snapshot', { p_chain: chain });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create snapshot', details: error.message },
        { status: 500 }
      );
    }

    // Check if snapshot was created (empty array means duplicate)
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Snapshot already exists for this time',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Snapshot created',
      timestamp: data[0].snapshot_ts,
      totalNodes: data[0].total_nodes_count,
      onlineNodes: data[0].online_nodes_count,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check last snapshot time
 */
export async function GET() {
  const supabase = await createClient();
  const chain = getChain();

  const { data, error } = await supabase
    .from('network_history')
    .select('snapshot_time, total_nodes, online_nodes')
    .eq('chain', chain)
    .order('snapshot_time', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({
        message: 'No snapshots yet',
        count: 0,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    lastSnapshot: data.snapshot_time,
    totalNodes: data.total_nodes,
    onlineNodes: data.online_nodes,
  });
}
