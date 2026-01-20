import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { NodeWithProfile } from '@atlasp2p/types'
import { isUserAdmin } from '@/lib/security'

/**
 * Transform database snake_case to TypeScript camelCase
 */
function transformNode(dbNode: any): NodeWithProfile {
  return {
    id: dbNode.id,
    ip: dbNode.ip || '',
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
    uptime: dbNode.uptime_percentage || dbNode.uptime || 0,
    tier: dbNode.tier || 'standard',
    pixScore: dbNode.pix_score,
    rank: dbNode.rank,
    isVerified: dbNode.is_verified || false,
    tipsEnabled: dbNode.tips_enabled || false,
    createdAt: dbNode.created_at || new Date().toISOString(),
    updatedAt: dbNode.updated_at || new Date().toISOString(),
    displayName: dbNode.display_name,
    avatarUrl: dbNode.avatar_url,
    isPublic: dbNode.is_public ?? true,
    description: dbNode.description || null,
    website: dbNode.website || null,
    twitter: dbNode.twitter || null,
    github: dbNode.github || null,
    discord: dbNode.discord || null,
    telegram: dbNode.telegram || null,
  }
}

/**
 * Single node details API endpoint
 *
 * Returns detailed information about a specific node including
 * profile data and 30-day uptime history.
 *
 * @param {NextRequest} request - The request object
 * @param {Object} params - Route parameters
 * @param {string} params.id - Node UUID
 * @returns {Promise<NextResponse>} Node details and uptime history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch node with profile data
  const { data: dbNode, error } = await supabase
    .from('nodes_public')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch node', details: error.message },
      { status: 500 }
    )
  }

  // Transform to camelCase
  const node = transformNode(dbNode)

  // Fetch uptime history (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: uptimeHistory } = await supabase
    .from('node_snapshots')
    .select('snapshot_time, is_online, response_time_ms')
    .eq('node_id', id)
    .gte('snapshot_time', thirtyDaysAgo.toISOString())
    .order('snapshot_time', { ascending: true })

  return NextResponse.json({
    node,
    uptimeHistory: uptimeHistory || []
  })
}

/**
 * Delete a manually registered node
 *
 * Only allows deletion if:
 * - User is authenticated
 * - Node was registered by this user OR user is admin
 * - Node source is 'manual' (can't delete crawler-discovered nodes)
 *
 * @param {NextRequest} request - The request object
 * @param {Object} params - Route parameters
 * @param {string} params.id - Node UUID
 * @returns {Promise<NextResponse>} Success or error response
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Check if user is admin
  const userIsAdmin = await isUserAdmin(user.id)

  // Use admin client to access full node data (including registered_by)
  const adminClient = createAdminClient()

  // Fetch node to check ownership
  const { data: node, error: nodeError } = await adminClient
    .from('nodes')
    .select('id, registered_by, source')
    .eq('id', id)
    .single()

  if (nodeError || !node) {
    return NextResponse.json(
      { error: 'Node not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isOwner = node.registered_by === user.id
  if (!isOwner && !userIsAdmin) {
    return NextResponse.json(
      { error: 'You can only delete nodes you registered' },
      { status: 403 }
    )
  }

  // Only allow deletion of manually registered nodes (unless admin)
  if (node.source !== 'manual' && !userIsAdmin) {
    return NextResponse.json(
      { error: 'Only manually registered nodes can be deleted' },
      { status: 403 }
    )
  }

  // Delete the node (cascades to related records via FK constraints)
  const { error: deleteError } = await adminClient
    .from('nodes')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[DeleteNode] Failed to delete node:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Node deleted successfully'
  })
}
