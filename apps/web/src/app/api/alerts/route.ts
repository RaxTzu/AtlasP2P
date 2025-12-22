/**
 * Alert Subscriptions API
 *
 * GET - List user's alert subscriptions
 * POST - Create a new subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/security';
import { isValidDiscordWebhookUrl } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// GET /api/alerts - List user's subscriptions
export async function GET(request: NextRequest) {
  // Rate limit reads
  const rateLimitResult = await rateLimit(request, 'alerts:list', RATE_LIMITS.READ);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user's subscriptions with node details
  // First try with node join, fall back to simple fetch if relationship not found
  let subscriptions;
  let error;

  // Try the joined query first
  const joinedResult = await supabase
    .from('alert_subscriptions')
    .select(`
      *,
      node:nodes(id, ip, port, country_name, city, status)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (joinedResult.error?.code === 'PGRST200') {
    // Relationship not found in schema cache - fall back to simple query
    console.warn('Node relationship not found, fetching without join');
    const simpleResult = await supabase
      .from('alert_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    subscriptions = simpleResult.data;
    error = simpleResult.error;
  } else {
    subscriptions = joinedResult.data;
    error = joinedResult.error;
  }

  if (error) {
    console.error('Failed to fetch subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: subscriptions || [] });
}

// POST /api/alerts - Create a new subscription
export async function POST(request: NextRequest) {
  // Rate limit subscription creation
  const rateLimitResult = await rateLimit(request, 'alerts:create', RATE_LIMITS.ALERTS);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many subscription changes. Please try again later.' },
      { status: 429 }
    );
  }

  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    nodeId: rawNodeId,
    alertOffline = true,
    alertOnline = true,
    alertVersionOutdated = false,
    alertTierChange = false,
    emailEnabled = true,
    webhookEnabled = false,
    webhookUrl,
    webhookType = 'discord',
    cooldownMinutes = 60,
  } = body;

  // Normalize nodeId - empty string should be treated as null
  const nodeId = rawNodeId && rawNodeId.trim() !== '' ? rawNodeId : null;

  // Validate that at least one notification channel is enabled
  if (!emailEnabled && !webhookEnabled) {
    return NextResponse.json(
      { error: 'At least one notification channel (email or webhook) must be enabled' },
      { status: 400 }
    );
  }

  // Validate node ownership if nodeId is provided
  if (nodeId) {
    const adminClient = createAdminClient();
    const { data: verification } = await adminClient
      .from('verified_nodes')
      .select('id')
      .eq('node_id', nodeId)
      .eq('user_id', user.id)
      .single();

    if (!verification) {
      return NextResponse.json(
        { error: 'You can only create alerts for your verified nodes' },
        { status: 403 }
      );
    }
  }

  // Validate webhook URL if webhook is enabled (using proper URL validation)
  if (webhookEnabled && webhookUrl) {
    if (webhookType === 'discord' && !isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        { error: 'Invalid Discord webhook URL format' },
        { status: 400 }
      );
    }
  }

  // Check if subscription already exists
  // Note: PostgreSQL NULL comparison requires IS NULL, not = NULL
  let existingQuery = supabase
    .from('alert_subscriptions')
    .select('id')
    .eq('user_id', user.id);

  if (nodeId) {
    existingQuery = existingQuery.eq('node_id', nodeId);
  } else {
    existingQuery = existingQuery.is('node_id', null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Subscription already exists for this node' },
      { status: 409 }
    );
  }

  // Create subscription
  const { data: subscription, error } = await supabase
    .from('alert_subscriptions')
    .insert({
      user_id: user.id,
      node_id: nodeId || null,
      alert_offline: alertOffline,
      alert_online: alertOnline,
      alert_version_outdated: alertVersionOutdated,
      alert_tier_change: alertTierChange,
      email_enabled: emailEnabled,
      webhook_enabled: webhookEnabled,
      webhook_url: webhookUrl || null,
      webhook_type: webhookType,
      cooldown_minutes: cooldownMinutes,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create subscription:', error);
    // Return more specific error message
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A subscription for this node already exists' }, { status: 409 });
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Permission denied. Please try again.' }, { status: 403 });
    }
    return NextResponse.json({ error: `Failed to create subscription: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ subscription }, { status: 201 });
}
