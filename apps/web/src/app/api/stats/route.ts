import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { withOptionalApiKeyAuth } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS, getClientIP } from '@/lib/security'
import { getChain } from '@atlasp2p/config'

/**
 * Network statistics API endpoint
 *
 * Returns comprehensive network statistics including node counts,
 * uptime averages, version/country/tier distributions, and
 * historical data for the last 7 days.
 *
 * @returns {Promise<NextResponse>} Network statistics object
 */
export async function GET(request: NextRequest) {
  return withOptionalApiKeyAuth(request, async (ctx) => {
    // If no API key, apply anonymous rate limit
    if (!ctx) {
      const ip = getClientIP(request)
      const rateLimitResult = await checkRateLimit(ip, 'public-api', RATE_LIMITS.PUBLIC_API)
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later or use an API key for higher limits.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': RATE_LIMITS.PUBLIC_API.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.floor(rateLimitResult.resetAt.getTime() / 1000).toString(),
            }
          }
        )
      }
    }

    const supabase = await createClient()
    const chain = getChain()

    // Fetch network stats from the view
    const { data: stats, error } = await supabase
      .from('network_stats')
      .select('*')
      .eq('chain', chain)
      .single()

    if (error) {
      // Handle empty database (PGRST116 = no rows returned)
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          totalNodes: 0,
          onlineNodes: 0,
          countries: 0,
          avgUptime: 0,
          avgLatency: 0,
          avgPixScore: 0,
          diamondNodes: 0,
          goldNodes: 0,
          silverNodes: 0,
          bronzeNodes: 0,
          versionDistribution: {},
          countryDistribution: {},
          tierDistribution: { diamond: 0, gold: 0, silver: 0, bronze: 0, standard: 0 },
          historicalData: []
        })
      }
      return NextResponse.json(
        { error: 'Failed to fetch stats', details: error.message },
        { status: 500 }
      )
    }

    // Fetch version distribution
    const { data: versionDist } = await supabase
      .from('nodes')
      .select('version')
      .eq('chain', chain)

    const versionDistribution: Record<string, number> = {}
    versionDist?.forEach((node) => {
      const v = node.version || 'unknown'
      versionDistribution[v] = (versionDistribution[v] || 0) + 1
    })

    // Fetch country distribution
    const { data: countryDist } = await supabase
      .from('nodes')
      .select('country_code, country_name')
      .eq('chain', chain)

    const countryDistribution: Record<string, { count: number; name: string }> = {}
    countryDist?.forEach((node) => {
      const code = node.country_code || 'XX'
      if (!countryDistribution[code]) {
        countryDistribution[code] = { count: 0, name: node.country_name || 'Unknown' }
      }
      countryDistribution[code].count++
    })

    // Fetch tier distribution
    const { data: tierDist } = await supabase
      .from('nodes')
      .select('tier')
      .eq('chain', chain)

    const tierDistribution: Record<string, number> = {
      diamond: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      standard: 0
    }
    tierDist?.forEach((node) => {
      const t = node.tier || 'standard'
      tierDistribution[t] = (tierDistribution[t] || 0) + 1
    })

    // Fetch historical data (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: historicalData } = await supabase
      .from('network_history')
      .select('*')
      .eq('chain', chain)
      .gte('snapshot_time', sevenDaysAgo.toISOString())
      .order('snapshot_time', { ascending: true })

    return NextResponse.json({
      ...stats,
      versionDistribution,
      countryDistribution,
      tierDistribution,
      historicalData: historicalData || []
    })
  })
}
