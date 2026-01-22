import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isUserAdmin, logAdminAction, rateLimit, RATE_LIMITS } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Get moderation queue (admin only)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin privileges required' },
      { status: 403 }
    );
  }

  // Rate limiting
  const rateLimitResult = await rateLimit(request, 'admin:moderation:list', RATE_LIMITS.READ);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // Get query parameters
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const itemType = searchParams.get('type') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const offset = (page - 1) * limit;

  let query = supabase
    .from('moderation_queue')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (itemType !== 'all') {
    query = query.eq('item_type', itemType);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: items, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch moderation queue' },
      { status: 500 }
    );
  }

  // Enrich items with user info and node info
  const adminClient = createAdminClient();
  const enrichedItems = await Promise.all((items || []).map(async (item) => {
    // Get user email
    let userEmail = null;
    try {
      const { data: { user: itemUser } } = await adminClient.auth.admin.getUserById(item.user_id);
      userEmail = itemUser?.email || null;
    } catch (e) {
      console.error('Failed to get user email:', e);
    }

    // For verifications, get node info and verification details
    let nodeInfo = null;
    let verificationInfo = null;
    let profileInfo = null;

    if (item.item_type === 'verification') {
      // Get verification details
      const { data: verification } = await adminClient
        .from('verifications')
        .select('node_id, method, challenge, created_at')
        .eq('id', item.item_id)
        .single();

      if (verification) {
        verificationInfo = {
          method: verification.method,
          created_at: verification.created_at
        };

        // Get node info
        const { data: node } = await adminClient
          .from('nodes')
          .select('ip, port, country_name, city, version, status')
          .eq('id', verification.node_id)
          .single();

        if (node) {
          nodeInfo = node;
        }
      }
    } else if (item.item_type === 'profile') {
      // Get profile info with pending changes
      const nodeId = item.item_id;

      // Get node info
      const { data: node } = await adminClient
        .from('nodes')
        .select('ip, port, country_name, city, version, status')
        .eq('id', nodeId)
        .single();

      if (node) {
        nodeInfo = node;
      }

      // Get current profile
      const { data: profile } = await adminClient
        .from('node_profiles')
        .select('display_name, description, avatar_url, website, twitter, github, discord, telegram, is_public, pending_changes, pending_submitted_at')
        .eq('node_id', nodeId)
        .single();

      // Get current tip config
      const { data: tipConfig } = await adminClient
        .from('node_tip_configs')
        .select('wallet_address, accepted_coins, minimum_tip, thank_you_message, is_active')
        .eq('node_id', nodeId)
        .single();

      if (profile) {
        profileInfo = {
          current: {
            display_name: profile.display_name,
            description: profile.description,
            avatar_url: profile.avatar_url,
            website: profile.website,
            twitter: profile.twitter,
            github: profile.github,
            discord: profile.discord,
            telegram: profile.telegram,
            is_public: profile.is_public,
            tip_config: tipConfig || undefined
          },
          pending: profile.pending_changes,
          submitted_at: profile.pending_submitted_at
        };
      }
    }

    // Get flagged_by email if item was flagged
    let flaggedByEmail = null;
    if (item.flagged_by) {
      try {
        const { data: { user: flagger } } = await adminClient.auth.admin.getUserById(item.flagged_by);
        flaggedByEmail = flagger?.email || null;
      } catch (e) {
        console.error('Failed to get flagger email:', e);
      }
    }

    return {
      ...item,
      user_email: userEmail,
      node_info: nodeInfo,
      verification_info: verificationInfo,
      profile_info: profileInfo,
      flagged_by_email: flaggedByEmail
    };
  }));

  return NextResponse.json({
    items: enrichedItems,
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    }
  });
}

/**
 * Review moderation item (approve/reject)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin privileges required' },
      { status: 403 }
    );
  }

  // Rate limiting
  const rateLimitResult = await rateLimit(request, 'admin:moderation:review', RATE_LIMITS.PROFILE);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // Parse request body
  const body = await request.json();
  const { itemId, action, notes } = body;

  if (!['approve', 'reject', 'flag'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  }

  // Get moderation item
  const { data: item, error: fetchError } = await supabase
    .from('moderation_queue')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    return NextResponse.json(
      { error: 'Moderation item not found' },
      { status: 404 }
    );
  }

  // Update moderation queue
  const updateData: Record<string, any> = {
    status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged',
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    review_notes: notes
  };

  // If flagging, also track who flagged and when
  if (action === 'flag') {
    updateData.flagged_by = user.id;
    updateData.flagged_at = new Date().toISOString();
    updateData.flagged_reason = notes;
  }

  const { error: updateError } = await supabase
    .from('moderation_queue')
    .update(updateData)
    .eq('id', itemId);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update moderation item' },
      { status: 500 }
    );
  }

  // Update the actual item based on type
  if (item.item_type === 'avatar') {
    await supabase
      .from('node_profiles')
      .update({
        is_avatar_approved: action === 'approve',
        avatar_rejected_reason: action === 'reject' ? notes : null,
        moderation_status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged',
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        moderation_notes: notes
      })
      .eq('node_id', item.item_id);
  } else if (item.item_type === 'verification') {
    // Handle verification approval (use adminClient to bypass RLS)
    if (action === 'approve') {
      // Get verification details
      const { data: verification, error: verifyFetchError } = await adminClient
        .from('verifications')
        .select('node_id, user_id, method')
        .eq('id', item.item_id)
        .single();

      if (verifyFetchError) {
        console.error('Failed to fetch verification:', verifyFetchError);
        return NextResponse.json(
          { error: 'Failed to fetch verification details' },
          { status: 500 }
        );
      }

      if (verification) {
        // Mark verification as verified
        const { error: updateVerifyError } = await adminClient
          .from('verifications')
          .update({ status: 'verified' })
          .eq('id', item.item_id);

        if (updateVerifyError) {
          console.error('Failed to update verification:', updateVerifyError);
        }

        // Mark node as verified
        const { error: updateNodeError } = await adminClient
          .from('nodes')
          .update({ is_verified: true })
          .eq('id', verification.node_id);

        if (updateNodeError) {
          console.error('Failed to update node:', updateNodeError);
        }

        // Create verified_nodes record
        const { error: insertError } = await adminClient
          .from('verified_nodes')
          .upsert({
            node_id: verification.node_id,
            user_id: verification.user_id,
            verification_method: verification.method,
            verified_at: new Date().toISOString()
          }, {
            onConflict: 'node_id'
          });

        if (insertError) {
          console.error('Failed to create verified_nodes record:', insertError);
          return NextResponse.json(
            { error: 'Failed to create verified node record' },
            { status: 500 }
          );
        }
      }
    } else if (action === 'reject') {
      // Mark verification as failed
      const { error: rejectError } = await adminClient
        .from('verifications')
        .update({ status: 'failed' })
        .eq('id', item.item_id);

      if (rejectError) {
        console.error('Failed to reject verification:', rejectError);
      }
    }
  } else if (item.item_type === 'profile') {
    // Handle profile changes approval
    const nodeId = item.item_id;

    if (action === 'approve') {
      // Get the pending changes from the profile
      const { data: profile, error: profileError } = await adminClient
        .from('node_profiles')
        .select('pending_changes')
        .eq('node_id', nodeId)
        .single();

      if (profileError || !profile?.pending_changes) {
        console.error('Failed to fetch pending changes:', profileError);
        return NextResponse.json(
          { error: 'No pending changes found' },
          { status: 400 }
        );
      }

      // Apply the pending changes to the profile
      const pendingChanges = profile.pending_changes as Record<string, any>;
      const { error: applyError } = await adminClient
        .from('node_profiles')
        .update({
          display_name: pendingChanges.display_name,
          description: pendingChanges.description,
          avatar_url: pendingChanges.avatar_url,
          website: pendingChanges.website,
          twitter: pendingChanges.twitter,
          github: pendingChanges.github,
          discord: pendingChanges.discord,
          telegram: pendingChanges.telegram,
          is_public: pendingChanges.is_public,
          pending_changes: null,
          pending_submitted_at: null,
          moderation_status: 'approved',
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          moderation_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('node_id', nodeId);

      if (applyError) {
        console.error('Failed to apply profile changes:', applyError);
        return NextResponse.json(
          { error: 'Failed to apply profile changes' },
          { status: 500 }
        );
      }

      // Apply tip config changes if included
      if (pendingChanges.tip_config) {
        const tipConfig = pendingChanges.tip_config;

        // Check if tip config exists
        const { data: existingTip } = await adminClient
          .from('node_tip_configs')
          .select('id')
          .eq('node_id', nodeId)
          .single();

        if (existingTip) {
          // Update existing
          const { error: tipError } = await adminClient
            .from('node_tip_configs')
            .update({
              wallet_address: tipConfig.wallet_address || '',
              accepted_coins: tipConfig.accepted_coins || [],
              minimum_tip: tipConfig.minimum_tip || null,
              thank_you_message: tipConfig.thank_you_message || '',
              is_active: tipConfig.is_active ?? false
            })
            .eq('node_id', nodeId);

          if (tipError) {
            console.error('Failed to update tip config:', tipError);
          }
        } else {
          // Insert new
          const { error: tipError } = await adminClient
            .from('node_tip_configs')
            .insert({
              node_id: nodeId,
              wallet_address: tipConfig.wallet_address || '',
              accepted_coins: tipConfig.accepted_coins || [],
              minimum_tip: tipConfig.minimum_tip || null,
              thank_you_message: tipConfig.thank_you_message || '',
              is_active: tipConfig.is_active ?? false
            });

          if (tipError) {
            console.error('Failed to insert tip config:', tipError);
          }
        }
      }
    } else if (action === 'reject') {
      // Clear pending changes without applying
      const { error: clearError } = await adminClient
        .from('node_profiles')
        .update({
          pending_changes: null,
          pending_submitted_at: null,
          moderation_status: 'rejected',
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          moderation_notes: notes
        })
        .eq('node_id', nodeId);

      if (clearError) {
        console.error('Failed to reject profile changes:', clearError);
      }
    }
  }

  // Gather comprehensive audit details
  const auditDetails: Record<string, any> = {
    action,
    item_type: item.item_type,
    notes: notes || null
  };

  // Add item-specific details for audit trail
  if (item.item_type === 'verification') {
    // Get verification and node info for audit
    const { data: verification } = await adminClient
      .from('verifications')
      .select('node_id, user_id, method')
      .eq('id', item.item_id)
      .single();

    if (verification) {
      const { data: node } = await adminClient
        .from('nodes')
        .select('ip, port, country_name, city')
        .eq('id', verification.node_id)
        .single();

      const { data: { user: submitter } } = await adminClient.auth.admin.getUserById(verification.user_id);

      auditDetails.verification = {
        method: verification.method,
        node_id: verification.node_id,
        node_address: node ? `${node.ip}:${node.port}` : null,
        node_location: node ? `${node.city || ''}, ${node.country_name || ''}`.replace(/^, |, $/g, '') : null,
        submitted_by: submitter?.email || verification.user_id
      };
    }
  } else if (item.item_type === 'profile') {
    // Get profile change details for audit
    const { data: profile } = await adminClient
      .from('node_profiles')
      .select('pending_changes, user_id, node_id')
      .eq('node_id', item.item_id)
      .single();

    if (profile) {
      const { data: node } = await adminClient
        .from('nodes')
        .select('ip, port, country_name, city')
        .eq('id', profile.node_id)
        .single();

      const { data: { user: submitter } } = await adminClient.auth.admin.getUserById(profile.user_id);

      const pending = profile.pending_changes as Record<string, any> | null;
      auditDetails.profile = {
        node_id: profile.node_id,
        node_address: node ? `${node.ip}:${node.port}` : null,
        node_location: node ? `${node.city || ''}, ${node.country_name || ''}`.replace(/^, |, $/g, '') : null,
        submitted_by: submitter?.email || profile.user_id,
        changes: pending ? {
          display_name: pending.display_name,
          description: pending.description ? `${pending.description.substring(0, 50)}${pending.description.length > 50 ? '...' : ''}` : null,
          has_avatar: !!pending.avatar_url,
          website: pending.website,
          twitter: pending.twitter,
          github: pending.github,
          discord: pending.discord,
          telegram: pending.telegram,
          is_public: pending.is_public,
          tip_enabled: pending.tip_config?.is_active,
          tip_wallet: pending.tip_config?.wallet_address ? `${pending.tip_config.wallet_address.substring(0, 8)}...` : null
        } : null
      };
    }
  } else if (item.item_type === 'avatar') {
    auditDetails.avatar = {
      url: item.content_url,
      node_id: item.item_id
    };

    const { data: { user: submitter } } = await adminClient.auth.admin.getUserById(item.user_id);
    auditDetails.submitted_by = submitter?.email || item.user_id;
  }

  // Log admin action with comprehensive details
  await logAdminAction(
    user.id,
    `moderation_${action}`,
    item.item_type,
    item.item_id,
    auditDetails,
    request
  );

  return NextResponse.json({
    success: true
  });
}
