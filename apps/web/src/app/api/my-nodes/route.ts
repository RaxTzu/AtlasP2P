import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { NodeWithProfile } from '@atlasp2p/types'

/**
 * Transform database snake_case to TypeScript camelCase
 * Handles nested node_profiles from join
 */
function transformNode(dbNode: any): NodeWithProfile {
  // Extract profile data from nested join (array with single item or null)
  const profile = Array.isArray(dbNode.node_profiles)
    ? dbNode.node_profiles[0]
    : dbNode.node_profiles;

  return {
    id: dbNode.id,
    ip: typeof dbNode.ip === 'string' ? dbNode.ip : (dbNode.ip?.toString() || ''),
    port: dbNode.port || 0,
    address: dbNode.address || '',
    chain: dbNode.chain || '',
    version: dbNode.version,
    protocolVersion: dbNode.protocol_version,
    services: dbNode.services,
    startHeight: dbNode.start_height,
    clientName: dbNode.client_name,
    clientVersion: dbNode.client_version,
    versionMajor: dbNode.version_major,
    versionMinor: dbNode.version_minor,
    versionPatch: dbNode.version_patch,
    isCurrentVersion: dbNode.is_current_version || false,
    countryCode: dbNode.country_code,
    countryName: dbNode.country_name,
    region: dbNode.region,
    city: dbNode.city,
    latitude: dbNode.latitude,
    longitude: dbNode.longitude,
    timezone: dbNode.timezone,
    isp: dbNode.isp,
    org: dbNode.org,
    asn: dbNode.asn,
    asnOrg: dbNode.asn_org,
    connectionType: dbNode.connection_type || 'ipv4',
    status: dbNode.status || 'pending',
    lastSeen: dbNode.last_seen,
    firstSeen: dbNode.first_seen || new Date().toISOString(),
    timesSeen: dbNode.times_seen || 0,
    latencyMs: dbNode.latency_ms,
    latencyAvg: dbNode.latency_avg,
    uptime: dbNode.uptime || 0,
    tier: dbNode.tier || 'standard',
    pixScore: dbNode.pix_score,
    rank: dbNode.rank,
    isVerified: dbNode.is_verified || false,
    tipsEnabled: dbNode.tips_enabled || false,
    createdAt: dbNode.created_at || new Date().toISOString(),
    updatedAt: dbNode.updated_at || new Date().toISOString(),
    // Profile data from join - owner sees their profile regardless of is_public
    displayName: profile?.display_name || null,
    avatarUrl: profile?.avatar_url || null,
    isPublic: profile?.is_public ?? true,
    description: profile?.description || null,
    website: profile?.website || null,
    twitter: profile?.twitter || null,
    github: profile?.github || null,
    discord: profile?.discord || null,
    telegram: profile?.telegram || null,
  }
}

/**
 * Get authenticated user's verified nodes
 *
 * Returns all nodes verified by the current user with their profiles
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Get user's verified nodes (using admin client to bypass RLS)
  const { data: verifiedNodes, error: verifiedError } = await adminClient
    .from('verified_nodes')
    .select('node_id, verification_method, verified_at')
    .eq('user_id', user.id)

  if (verifiedError) {
    console.error('verified_nodes error:', verifiedError)
    return NextResponse.json(
      { error: 'Failed to fetch verified nodes' },
      { status: 500 }
    )
  }

  if (!verifiedNodes || verifiedNodes.length === 0) {
    return NextResponse.json({
      nodes: []
    })
  }

  const nodeIds = verifiedNodes.map(vn => vn.node_id)

  // Get full node details using admin client (bypasses RLS on nodes table)
  const { data: dbNodes, error: nodesError } = await adminClient
    .from('nodes')
    .select(`
      *,
      node_profiles!left (
        display_name,
        avatar_url,
        description,
        website,
        twitter,
        github,
        discord,
        telegram,
        is_public
      )
    `)
    .in('id', nodeIds)
    .order('last_seen', { ascending: false })

  if (nodesError) {
    console.error('nodes error:', nodesError)
    return NextResponse.json(
      { error: 'Failed to fetch node details' },
      { status: 500 }
    )
  }

  // Transform to camelCase and add verification info
  const nodes = (dbNodes || []).map(dbNode => {
    const verificationInfo = verifiedNodes.find(vn => vn.node_id === dbNode.id)
    const transformed = transformNode(dbNode)
    return {
      ...transformed,
      verificationMethod: verificationInfo?.verification_method || null,
      verifiedAt: verificationInfo?.verified_at || null
    }
  })

  return NextResponse.json({
    nodes
  })
}
