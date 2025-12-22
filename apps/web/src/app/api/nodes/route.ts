import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nodesQuerySchema, validateQuery } from '@/lib/validations'
import { withOptionalApiKeyAuth } from '@/lib/api-middleware'
import { checkRateLimit, getRateLimitConfig, getClientIP } from '@/lib/security'

export async function GET(request: NextRequest) {
  return withOptionalApiKeyAuth(request, async (ctx) => {
    // Apply rate limit based on authentication status
    const ip = getClientIP(request)
    const rateLimitConfig = await getRateLimitConfig(ctx ? 'authenticated' : 'anonymous')
    const rateLimitResult = await checkRateLimit(ip, 'public-api-nodes', rateLimitConfig)

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later or use an API key for higher limits.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(rateLimitResult.resetAt.getTime() / 1000).toString(),
          }
        }
      )
    }

    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    // Validate query parameters
    const validation = validateQuery(nodesQuerySchema, searchParams)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const { page, limit, tier, country, version, verified, online, sort, order } = validation.data
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('nodes_public')
      .select('*', { count: 'exact' })

    // Apply filters
    if (tier) {
      query = query.eq('tier', tier)
    }
    if (country) {
      query = query.eq('country_code', country)
    }
    if (version) {
      query = query.eq('version', version)
    }
    if (verified === 'true') {
      query = query.eq('is_verified', true)
    }
    if (online === 'true') {
      query = query.eq('is_online', true)
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: nodes, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch nodes', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      nodes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  })
}
