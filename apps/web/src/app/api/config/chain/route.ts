/**
 * Chain Config API (Public)
 *
 * GET - Returns chain configuration with database overrides
 * Used by crawler and other services to get current version info
 */

import { NextResponse } from 'next/server';
import { getChainConfigWithOverrides } from '@/lib/config-overrides';

export const dynamic = 'force-dynamic';

// GET /api/config/chain - Get chain config with DB overrides
export async function GET() {
  try {
    const chainConfig = await getChainConfigWithOverrides();

    return NextResponse.json({
      name: chainConfig.name,
      ticker: chainConfig.ticker,
      currentVersion: chainConfig.currentVersion,
      minimumVersion: chainConfig.minimumVersion,
      criticalVersion: chainConfig.criticalVersion,
      protocolVersion: chainConfig.protocolVersion,
      latestReleaseUrl: chainConfig.latestReleaseUrl,
      releasesUrl: chainConfig.releasesUrl,
    });
  } catch (error) {
    console.error('Chain config API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain config' },
      { status: 500 }
    );
  }
}
