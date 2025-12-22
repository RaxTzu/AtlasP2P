import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getChain } from '@atlasp2p/config'

/**
 * JSON API endpoint for network statistics
 * Matches Bitnodes.io API structure for compatibility
 *
 * Response Format (Bitnodes-compatible with extensions):
 * {
 *   "timestamp": 1702345678,
 *   "total_nodes": 1234,
 *   "available_nodes": 1200,
 *   "countries": 89,
 *   "versions": {
 *     "/Bitcoin:0.21.0/": 850,
 *     "/Bitcoin:0.20.0/": 350,
 *     "unknown": 34
 *   },
 *   "countries_distribution": {
 *     "US": { "count": 450, "name": "United States" },
 *     "DE": { "count": 280, "name": "Germany" },
 *     "CN": { "count": 150, "name": "China" }
 *   },
 *   "tiers_distribution": {
 *     "diamond": 45,
 *     "gold": 120,
 *     "silver": 230,
 *     "bronze": 305,
 *     "standard": 500
 *   },
 *   "network_health": {
 *     "health_score": 92.5,
 *     "average_uptime": 98.3,
 *     "average_latency": 125.4,
 *     "verified_nodes": 678,
 *     "tips_enabled_nodes": 234
 *   },
 *   "latest_height": 5678901,
 *   "historical_data": [
 *     {
 *       "timestamp": 1702259278,
 *       "total_nodes": 1220,
 *       "available_nodes": 1190,
 *       "average_uptime": 98.1
 *     }
 *   ]
 * }
 */
export async function GET() {
  const supabase = await createClient()
  const chain = getChain()

  try {
    // Fetch network stats from the view
    const { data: stats, error: statsError } = await supabase
      .from('network_stats')
      .select('*')
      .eq('chain', chain)
      .single()

    if (statsError && statsError.code !== 'PGRST116') { // PGRST116 = no rows
      throw statsError
    }

    // Fetch all nodes for detailed statistics
    const { data: allNodes, error: nodesError } = await supabase
      .from('nodes')
      .select('*')
      .eq('chain', chain)

    if (nodesError) {
      throw nodesError
    }

    // Calculate version distribution
    const versionDistribution: Record<string, number> = {}
    const onlineNodes = allNodes?.filter(n => n.status === 'up') || []

    onlineNodes.forEach(node => {
      const version = node.version || 'unknown'
      versionDistribution[version] = (versionDistribution[version] || 0) + 1
    })

    // Calculate country distribution
    const countryDistribution: Record<string, { count: number; name: string }> = {}

    onlineNodes.forEach(node => {
      const code = node.country_code || 'XX'
      if (!countryDistribution[code]) {
        countryDistribution[code] = {
          count: 0,
          name: node.country_name || 'Unknown'
        }
      }
      countryDistribution[code].count++
    })

    // Calculate tier distribution
    const tierDistribution: Record<string, number> = {
      diamond: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      standard: 0
    }

    onlineNodes.forEach(node => {
      const tier = node.tier || 'standard'
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1
    })

    // Calculate network health metrics
    const verifiedNodes = allNodes?.filter(n => n.is_verified).length || 0
    const tipsEnabledNodes = allNodes?.filter(n => n.tips_enabled).length || 0

    const uptimes = onlineNodes
      .filter(n => n.uptime != null)
      .map(n => parseFloat(n.uptime))
    const avgUptime = uptimes.length > 0
      ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length
      : 0

    const latencies = onlineNodes
      .filter(n => n.latency_avg != null)
      .map(n => parseFloat(n.latency_avg))
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0

    // Calculate health score (0-100)
    // Based on: uptime (50%), node count (20%), latency (20%), verified nodes (10%)
    const totalNodes = allNodes?.length || 0
    const availableNodes = onlineNodes.length
    const nodeAvailability = totalNodes > 0 ? (availableNodes / totalNodes) * 100 : 0
    const uptimeScore = avgUptime
    const latencyScore = Math.max(0, 100 - (avgLatency / 10)) // Better latency = higher score
    const verifiedScore = totalNodes > 0 ? (verifiedNodes / totalNodes) * 100 : 0

    const healthScore = (
      uptimeScore * 0.5 +
      nodeAvailability * 0.2 +
      latencyScore * 0.2 +
      verifiedScore * 0.1
    )

    // Get latest block height
    const latestHeight = onlineNodes.length > 0
      ? Math.max(...onlineNodes.map(n => n.start_height || 0))
      : 0

    // Fetch historical data (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: historicalData, error: histError } = await supabase
      .from('network_history')
      .select('*')
      .eq('chain', chain)
      .gte('snapshot_time', sevenDaysAgo.toISOString())
      .order('snapshot_time', { ascending: true })

    if (histError) {
      console.warn('Failed to fetch historical data:', histError)
    }

    // Transform historical data to Bitnodes format
    const historicalFormatted = historicalData?.map(snapshot => ({
      timestamp: Math.floor(new Date(snapshot.snapshot_time).getTime() / 1000),
      total_nodes: snapshot.total_nodes || 0,
      available_nodes: snapshot.online_nodes || 0,
      average_uptime: snapshot.avg_uptime ? parseFloat(snapshot.avg_uptime) : 0,
      countries: snapshot.unique_countries || 0,
    })) || []

    const response = {
      timestamp: Math.floor(Date.now() / 1000),
      total_nodes: totalNodes,
      available_nodes: availableNodes,
      countries: Object.keys(countryDistribution).length,
      versions: versionDistribution,
      countries_distribution: countryDistribution,
      tiers_distribution: tierDistribution,
      network_health: {
        health_score: Math.round(healthScore * 10) / 10,
        average_uptime: Math.round(avgUptime * 10) / 10,
        average_latency: Math.round(avgLatency * 10) / 10,
        verified_nodes: verifiedNodes,
        tips_enabled_nodes: tipsEnabledNodes,
      },
      latest_height: latestHeight,
      historical_data: historicalFormatted,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch statistics',
        details: error.message
      },
      {
        status: 500,
        headers: getCorsHeaders()
      }
    )
  }
}

/**
 * CORS headers for public API access
 */
function getCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  })
}
