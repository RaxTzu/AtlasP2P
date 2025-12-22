import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getChain } from '@atlasp2p/config'

/**
 * JSON API endpoint for country-based node distribution
 * Matches Bitnodes.io API structure for compatibility
 *
 * Query Parameters:
 *   - sort: Sort field (code, name, count) - default: count
 *   - order: Sort order (asc, desc) - default: desc
 *   - online_only: Filter to only online nodes (true, false) - default: true
 *
 * Response Format (Bitnodes-compatible with extensions):
 * {
 *   "timestamp": 1702345678,
 *   "total_countries": 89,
 *   "total_nodes": 1234,
 *   "countries": [
 *     {
 *       "code": "US",
 *       "name": "United States",
 *       "count": 450,
 *       "percentage": 36.4,
 *       "online_count": 445,
 *       "verified_count": 123,
 *       "tiers": {
 *         "diamond": 15,
 *         "gold": 45,
 *         "silver": 89,
 *         "bronze": 130,
 *         "standard": 171
 *       },
 *       "average_uptime": 98.5,
 *       "average_latency": 125.3
 *     },
 *     {
 *       "code": "DE",
 *       "name": "Germany",
 *       "count": 280,
 *       "percentage": 22.7,
 *       "online_count": 275,
 *       "verified_count": 87,
 *       "tiers": {
 *         "diamond": 10,
 *         "gold": 35,
 *         "silver": 70,
 *         "bronze": 90,
 *         "standard": 75
 *       },
 *       "average_uptime": 97.8,
 *       "average_latency": 98.6
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const chain = getChain()

  // Parse query parameters
  const sort = searchParams.get('sort') || 'count'
  const order = searchParams.get('order') || 'desc'
  const onlineOnly = searchParams.get('online_only') !== 'false' // Default: true

  // Validate sort field
  if (!['code', 'name', 'count'].includes(sort)) {
    return NextResponse.json(
      {
        error: 'Invalid sort field',
        details: 'sort must be one of: code, name, count'
      },
      {
        status: 400,
        headers: getCorsHeaders()
      }
    )
  }

  // Validate order
  if (!['asc', 'desc'].includes(order)) {
    return NextResponse.json(
      {
        error: 'Invalid order',
        details: 'order must be one of: asc, desc'
      },
      {
        status: 400,
        headers: getCorsHeaders()
      }
    )
  }

  try {
    // Build query for all nodes
    let query = supabase
      .from('nodes')
      .select('*')
      .eq('chain', chain)

    if (onlineOnly) {
      query = query.eq('status', 'up')
    }

    const { data: nodes, error } = await query

    if (error) {
      throw error
    }

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({
        timestamp: Math.floor(Date.now() / 1000),
        total_countries: 0,
        total_nodes: 0,
        countries: []
      }, {
        status: 200,
        headers: {
          ...getCorsHeaders(),
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        }
      })
    }

    // Group nodes by country
    const countryMap = new Map<string, {
      code: string
      name: string
      nodes: typeof nodes
    }>()

    nodes.forEach(node => {
      const code = node.country_code || 'XX'
      const name = node.country_name || 'Unknown'

      if (!countryMap.has(code)) {
        countryMap.set(code, {
          code,
          name,
          nodes: []
        })
      }

      countryMap.get(code)!.nodes.push(node)
    })

    // Calculate statistics for each country
    const countriesData = Array.from(countryMap.values()).map(country => {
      const countryNodes = country.nodes
      const totalCount = countryNodes.length
      const onlineCount = countryNodes.filter(n => n.status === 'up').length
      const verifiedCount = countryNodes.filter(n => n.is_verified).length

      // Tier distribution
      const tiers = {
        diamond: countryNodes.filter(n => n.tier === 'diamond').length,
        gold: countryNodes.filter(n => n.tier === 'gold').length,
        silver: countryNodes.filter(n => n.tier === 'silver').length,
        bronze: countryNodes.filter(n => n.tier === 'bronze').length,
        standard: countryNodes.filter(n => n.tier === 'standard').length,
      }

      // Average uptime
      const uptimeValues = countryNodes
        .filter(n => n.uptime != null)
        .map(n => parseFloat(n.uptime))
      const avgUptime = uptimeValues.length > 0
        ? uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length
        : 0

      // Average latency
      const latencyValues = countryNodes
        .filter(n => n.latency_avg != null)
        .map(n => parseFloat(n.latency_avg))
      const avgLatency = latencyValues.length > 0
        ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length
        : 0

      return {
        code: country.code,
        name: country.name,
        count: totalCount,
        percentage: 0, // Will be calculated after we know total
        online_count: onlineCount,
        verified_count: verifiedCount,
        tiers,
        average_uptime: Math.round(avgUptime * 10) / 10,
        average_latency: Math.round(avgLatency * 10) / 10,
      }
    })

    // Calculate percentages
    const totalNodes = nodes.length
    countriesData.forEach(country => {
      country.percentage = totalNodes > 0
        ? Math.round((country.count / totalNodes) * 1000) / 10
        : 0
    })

    // Sort countries
    countriesData.sort((a, b) => {
      let compareValue = 0

      if (sort === 'code') {
        compareValue = a.code.localeCompare(b.code)
      } else if (sort === 'name') {
        compareValue = a.name.localeCompare(b.name)
      } else if (sort === 'count') {
        compareValue = a.count - b.count
      }

      return order === 'asc' ? compareValue : -compareValue
    })

    const response = {
      timestamp: Math.floor(Date.now() / 1000),
      total_countries: countryMap.size,
      total_nodes: totalNodes,
      countries: countriesData,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error: any) {
    console.error('Error fetching countries:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch country distribution',
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
