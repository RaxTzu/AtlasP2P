import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { leaderboardQuerySchema, validateQuery } from '@/lib/validations'
import { withOptionalApiKeyAuth } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS, getClientIP } from '@/lib/security'

/**
 * Leaderboard API endpoint
 *
 * Returns ranked nodes by PIX score with pagination.
 *
 * @param {NextRequest} request - The request object
 * @returns {Promise<NextResponse>} Leaderboard data with pagination
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
    const searchParams = request.nextUrl.searchParams

    // Validate query parameters
    const validation = validateQuery(leaderboardQuerySchema, searchParams)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const { page, limit } = validation.data
    const offset = (page - 1) * limit

    // Fetch leaderboard from view
    const { data: leaderboard, error, count } = await supabase
      .from('leaderboard')
      .select('*', { count: 'exact' })
      .order('rank', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      leaderboard,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  })
}
