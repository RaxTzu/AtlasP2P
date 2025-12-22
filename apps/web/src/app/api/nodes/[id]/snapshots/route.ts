import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || '7'; // days

  try {
    const supabase = await createClient();

    // Calculate time range
    const hoursAgo = parseInt(period) * 24;
    const since = new Date();
    since.setHours(since.getHours() - hoursAgo);

    const { data, error } = await supabase
      .from('node_snapshots')
      .select('snapshot_time, is_online, response_time_ms, block_height')
      .eq('node_id', id)
      .gte('snapshot_time', since.toISOString())
      .order('snapshot_time', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
