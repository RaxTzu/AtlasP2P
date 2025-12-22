import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nodesQuerySchema, validateQuery } from '@/lib/validations'
import { getChain } from '@atlasp2p/config'

/**
 * JSON API endpoint for programmatic access to node data
 * Matches Bitnodes.io API structure for compatibility
 *
 * Query Parameters:
 *   - page: Page number (default: 1)
 *   - limit: Results per page (default: 100, max: 500)
 *   - country: ISO 3166-1 alpha-2 country code (e.g., US, GB, CN)
 *   - tier: Node tier (diamond, gold, silver, bronze, standard)
 *   - version: Specific client version
 *   - verified: Filter by verification status (true, false)
 *   - online: Filter by online status (true, false)
 *   - sort: Sort field (last_seen, first_seen, pix_score, tier, uptime_percentage)
 *   - order: Sort order (asc, desc)
 *
 * Response Format (Bitnodes-compatible):
 * {
 *   "timestamp": 1702345678,
 *   "total_nodes": 1234,
 *   "latest_height": 5678901,
 *   "nodes": {
 *     "192.168.1.1:33117": {
 *       "protocol_version": 70015,
 *       "user_agent": "/Bitcoin:0.21.0/",
 *       "connected_since": 1702345678,
 *       "services": "0000000000000001",
 *       "height": 5678901,
 *       "hostname": "example.com",
 *       "city": "San Francisco",
 *       "country": "US",
 *       "latitude": 37.7749,
 *       "longitude": -122.4194,
 *       "timezone": "America/Los_Angeles",
 *       "asn": "AS15169",
 *       "organization_name": "Google LLC"
 *     }
 *   },
 *   "pagination": {
 *     "page": 1,
 *     "limit": 100,
 *     "total": 1234,
 *     "total_pages": 13
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const chain = getChain()

  // Validate query parameters
  const validation = validateQuery(nodesQuerySchema, searchParams)

  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        details: validation.error
      },
      {
        status: 400,
        headers: getCorsHeaders()
      }
    )
  }

  const { page, limit, tier, country, version, verified, online, sort, order } = validation.data
  const offset = (page - 1) * limit

  try {
    // Build query
    let query = supabase
      .from('nodes_public')
      .select('*', { count: 'exact' })
      .eq('chain', chain)

    // Apply filters
    if (tier) {
      query = query.eq('tier', tier)
    }
    if (country) {
      query = query.eq('country_code', country)
    }
    if (version) {
      query = query.eq('client_version', version)
    }
    if (verified === 'true') {
      query = query.eq('is_verified', true)
    } else if (verified === 'false') {
      query = query.eq('is_verified', false)
    }
    if (online === 'true') {
      query = query.eq('status', 'up')
    } else if (online === 'false') {
      query = query.eq('status', 'down')
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: nodes, error, count } = await query

    if (error) {
      throw error
    }

    // Get latest block height from the most recent node
    const latestHeight = nodes && nodes.length > 0
      ? Math.max(...nodes.map(n => n.start_height || 0))
      : 0

    // Transform nodes to Bitnodes-compatible format
    const nodesMap: Record<string, any> = {}

    nodes?.forEach(node => {
      const address = `${node.ip}:${node.port}`
      nodesMap[address] = {
        protocol_version: node.protocol_version,
        user_agent: node.version || '',
        connected_since: node.first_seen ? Math.floor(new Date(node.first_seen).getTime() / 1000) : null,
        services: node.services || '0000000000000000',
        height: node.start_height,
        hostname: null, // Not tracked yet
        city: node.city,
        country: node.country_code,
        country_name: node.country_name,
        latitude: node.latitude ? parseFloat(node.latitude) : null,
        longitude: node.longitude ? parseFloat(node.longitude) : null,
        timezone: node.timezone,
        asn: node.asn ? `AS${node.asn}` : null,
        organization_name: node.asn_org || node.org,
        isp: node.isp,
        // Extended fields beyond Bitnodes
        status: node.status,
        last_seen: node.last_seen ? Math.floor(new Date(node.last_seen).getTime() / 1000) : null,
        latency_ms: node.latency_avg ? parseFloat(node.latency_avg) : null,
        uptime_percentage: node.uptime ? parseFloat(node.uptime) : null,
        reliability: node.reliability ? parseFloat(node.reliability) : null,
        tier: node.tier,
        pix_score: node.pix_score ? parseFloat(node.pix_score) : null,
        rank: node.rank,
        is_verified: node.is_verified,
        tips_enabled: node.tips_enabled,
      }
    })

    const response = {
      timestamp: Math.floor(Date.now() / 1000),
      total_nodes: count || 0,
      latest_height: latestHeight,
      nodes: nodesMap,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        ...getRateLimitHeaders(limit),
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error: any) {
    console.error('Error fetching nodes:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch nodes',
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
 * Rate limiting headers (informational)
 * Actual rate limiting should be implemented at the edge/gateway level
 */
function getRateLimitHeaders(requestsUsed: number): HeadersInit {
  const limit = 1000 // requests per hour
  const remaining = Math.max(0, limit - requestsUsed)
  const resetTime = Math.floor(Date.now() / 1000) + 3600

  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
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
