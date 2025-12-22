import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMITS } from '@/lib/security'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Get node profile by node ID
 * Returns current profile data plus any pending changes
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: nodeId } = await params
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Get profile (use admin client to ensure we can read it)
  const { data: profile, error } = await adminClient
    .from('node_profiles')
    .select('*')
    .eq('node_id', nodeId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }

  // Check if user is the owner (to show pending changes)
  const { data: { user } } = await supabase.auth.getUser()

  // Only show pending changes to the owner
  if (!user || profile.user_id !== user.id) {
    // Remove pending_changes from response for non-owners
    const { pending_changes, pending_submitted_at, has_pending_changes, ...publicProfile } = profile
    return NextResponse.json(publicProfile)
  }

  return NextResponse.json(profile)
}

/**
 * Update node profile
 * Requires authentication and ownership
 * Changes go to moderation queue for admin approval
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  // Rate limit profile updates
  const rateLimitResult = await rateLimit(request, 'profiles:update', RATE_LIMITS.PROFILE);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many profile updates. Please try again later.' },
      { status: 429 }
    );
  }

  const { id: nodeId } = await params
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

  // Verify user owns this node (using admin client)
  const { data: ownership, error: ownershipError } = await adminClient
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
    displayName,
    description,
    avatarUrl,
    website,
    twitter,
    github,
    discord,
    telegram,
    isPublic,
    tipConfig
  } = body

  // Prepare the pending changes (profile + tipping)
  const pendingChanges: Record<string, any> = {
    display_name: displayName,
    description,
    avatar_url: avatarUrl,
    website,
    twitter,
    github,
    discord,
    telegram,
    is_public: isPublic ?? true
  }

  // Include tipping config if provided
  if (tipConfig) {
    pendingChanges.tip_config = {
      wallet_address: tipConfig.walletAddress || '',
      accepted_coins: tipConfig.acceptedCoins || [],
      minimum_tip: tipConfig.minimumTip || null,
      thank_you_message: tipConfig.thankYouMessage || '',
      is_active: tipConfig.isActive ?? false
    }
  }

  // Check if profile exists
  const { data: existingProfile, error: profileError } = await adminClient
    .from('node_profiles')
    .select('*')
    .eq('node_id', nodeId)
    .single()

  // If profile exists (even if query had error code PGRST116)
  if (existingProfile) {
    // Update existing profile with pending changes
    const { error: updateError } = await adminClient
      .from('node_profiles')
      .update({
        pending_changes: pendingChanges,
        pending_submitted_at: new Date().toISOString()
      })
      .eq('node_id', nodeId)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to submit changes', details: updateError.message },
        { status: 500 }
      )
    }
  } else if (profileError && profileError.code === 'PGRST116') {
    // No profile found - create new one
    const { error: insertError } = await adminClient
      .from('node_profiles')
      .insert({
        node_id: nodeId,
        user_id: user.id,
        pending_changes: pendingChanges,
        pending_submitted_at: new Date().toISOString(),
        // Set minimal defaults for required fields
        is_public: true
      })

    if (insertError) {
      console.error('Profile insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create profile', details: insertError.message },
        { status: 500 }
      )
    }
  } else if (profileError) {
    // Some other error occurred
    console.error('Profile fetch error:', profileError)
    return NextResponse.json(
      { error: 'Failed to fetch profile', details: profileError.message },
      { status: 500 }
    )
  }

  // Remove any existing pending moderation items for this profile
  await adminClient
    .from('moderation_queue')
    .delete()
    .eq('item_type', 'profile')
    .eq('item_id', nodeId)
    .eq('status', 'pending')

  // Get current tip config for comparison
  let currentTipConfig = null
  if (tipConfig) {
    const { data: tipData } = await adminClient
      .from('node_tip_configs')
      .select('wallet_address, accepted_coins, minimum_tip, thank_you_message, is_active')
      .eq('node_id', nodeId)
      .single()

    if (tipData) {
      currentTipConfig = tipData
    }
  }

  // Add to moderation queue
  const { error: queueError } = await adminClient
    .from('moderation_queue')
    .insert({
      item_type: 'profile',
      item_id: nodeId,
      user_id: user.id,
      status: 'pending',
      content_data: {
        node_id: nodeId,
        changes: pendingChanges,
        current_values: existingProfile ? {
          display_name: existingProfile.display_name,
          description: existingProfile.description,
          avatar_url: existingProfile.avatar_url,
          website: existingProfile.website,
          twitter: existingProfile.twitter,
          github: existingProfile.github,
          discord: existingProfile.discord,
          telegram: existingProfile.telegram,
          is_public: existingProfile.is_public,
          tip_config: currentTipConfig
        } : null
      }
    })

  if (queueError) {
    console.error('Failed to add to moderation queue:', queueError)
    // Don't fail the request, just log it
  }

  return NextResponse.json({
    success: true,
    message: 'Your changes have been submitted for review. An admin will approve them shortly.',
    pending: true,
    pendingChanges
  })
}

/**
 * Delete node profile
 * Requires authentication and ownership
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: nodeId } = await params
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

  // Verify user owns this node (using admin client)
  const { data: ownership, error: ownershipError } = await adminClient
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

  // Delete profile (using admin client)
  const { error: deleteError } = await adminClient
    .from('node_profiles')
    .delete()
    .eq('node_id', nodeId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
