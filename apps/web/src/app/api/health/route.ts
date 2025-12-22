import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Health check endpoint
 *
 * Returns system health status including database connectivity,
 * node count, and basic statistics.
 *
 * @returns {Promise<NextResponse>} Health status object
 */
export async function GET() {
  try {
    const startTime = Date.now();
    const supabase = await createClient();

    // Check database connectivity by querying nodes count
    const { count, error } = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Database connection failed',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      nodes: count || 0,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
