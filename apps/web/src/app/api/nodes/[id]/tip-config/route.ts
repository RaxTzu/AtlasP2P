import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMITS } from '@/lib/security'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Get node tip configuration by node ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: nodeId } = await params
  const supabase = await createClient()

  // Get tip config (active configs are accessible to everyone via RLS)
  const { data: tipConfig, error } = await supabase
    .from('node_tip_configs')
    .select('*')
    .eq('node_id', nodeId)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No tip config found
      return NextResponse.json(
        { error: 'Tip configuration not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch tip configuration' },
      { status: 500 }
    )
  }

  return NextResponse.json(tipConfig)
}

/**
 * Create or update node tip configuration
 * Requires authentication and ownership
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  // Rate limit tip config updates
  const rateLimitResult = await rateLimit(request, 'tip-config:update', RATE_LIMITS.TIP_CONFIG);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many tip configuration updates. Please try again later.' },
      { status: 429 }
    );
  }

  const { id: nodeId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Verify user owns this node
  const { data: ownership, error: ownershipError } = await supabase
    .from('verified_nodes')
    .select('id')
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .single()

  if (ownershipError || !ownership) {
    return NextResponse.json(
      { error: 'You do not own this node' },
      { status: 403 }
    )
  }

  // Parse request body
  const body = await request.json()

  const {
    walletAddress,
    acceptedCoins,
    minimumTip,
    thankYouMessage,
    isActive
  } = body

  // Validate wallet address
  if (!walletAddress || walletAddress.trim().length === 0) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    )
  }

  // Update or insert tip config
  const { data: tipConfig, error: updateError } = await supabase
    .from('node_tip_configs')
    .upsert({
      node_id: nodeId,
      user_id: user.id,
      wallet_address: walletAddress,
      accepted_coins: acceptedCoins || ['BTC'],
      minimum_tip: minimumTip || null,
      thank_you_message: thankYouMessage || null,
      is_active: isActive ?? true
    }, {
      onConflict: 'node_id'
    })
    .select()
    .single()

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update tip configuration', details: updateError.message },
      { status: 500 }
    )
  }

  // Note: tips_enabled flag on nodes table is automatically synced
  // via the sync_tips_enabled_trigger database trigger

  return NextResponse.json(tipConfig)
}

/**
 * Delete node tip configuration
 * Requires authentication and ownership
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: nodeId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Verify user owns this node
  const { data: ownership, error: ownershipError } = await supabase
    .from('verified_nodes')
    .select('id')
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .single()

  if (ownershipError || !ownership) {
    return NextResponse.json(
      { error: 'You do not own this node' },
      { status: 403 }
    )
  }

  // Delete tip config
  const { error: deleteError } = await supabase
    .from('node_tip_configs')
    .delete()
    .eq('node_id', nodeId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete tip configuration' },
      { status: 500 }
    )
  }

  // Note: tips_enabled flag on nodes table is automatically synced
  // via the sync_tips_enabled_trigger database trigger

  return NextResponse.json({ success: true })
}
