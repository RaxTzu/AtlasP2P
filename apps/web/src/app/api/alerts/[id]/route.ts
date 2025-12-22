/**
 * Individual Alert Subscription API
 *
 * GET - Get subscription details
 * PUT - Update subscription settings
 * DELETE - Remove subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/security';
import { isValidDiscordWebhookUrl } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/alerts/:id - Get subscription details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch subscription (RLS ensures user can only see their own)
  const { data: subscription, error } = await supabase
    .from('alert_subscriptions')
    .select(`
      *,
      node:nodes(id, ip, port, country_name, city, status)
    `)
    .eq('id', id)
    .single();

  if (error || !subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  return NextResponse.json({ subscription });
}

// PUT /api/alerts/:id - Update subscription settings
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Rate limit subscription updates
  const rateLimitResult = await rateLimit(request, 'alerts:update', RATE_LIMITS.ALERTS);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many subscription changes. Please try again later.' },
      { status: 429 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Accept both camelCase and snake_case field names from frontend
  const alertOffline = body.alertOffline ?? body.alert_offline;
  const alertOnline = body.alertOnline ?? body.alert_online;
  const alertVersionOutdated = body.alertVersionOutdated ?? body.alert_version_outdated;
  const alertTierChange = body.alertTierChange ?? body.alert_tier_change;
  const emailEnabled = body.emailEnabled ?? body.email_enabled;
  const emailAddress = body.emailAddress ?? body.email_address;
  const webhookEnabled = body.webhookEnabled ?? body.webhook_enabled;
  const webhookUrl = body.webhookUrl ?? body.webhook_url;
  const webhookType = body.webhookType ?? body.webhook_type;
  const cooldownMinutes = body.cooldownMinutes ?? body.cooldown_minutes;

  // Build update object (only include provided fields)
  const updates: Record<string, unknown> = {};

  if (alertOffline !== undefined) updates.alert_offline = alertOffline;
  if (alertOnline !== undefined) updates.alert_online = alertOnline;
  if (alertVersionOutdated !== undefined) updates.alert_version_outdated = alertVersionOutdated;
  if (alertTierChange !== undefined) updates.alert_tier_change = alertTierChange;
  if (emailEnabled !== undefined) updates.email_enabled = emailEnabled;
  if (emailAddress !== undefined) updates.email_address = emailAddress || null;
  if (webhookEnabled !== undefined) updates.webhook_enabled = webhookEnabled;
  if (webhookUrl !== undefined) updates.webhook_url = webhookUrl || null;
  if (webhookType !== undefined) updates.webhook_type = webhookType;
  if (cooldownMinutes !== undefined) updates.cooldown_minutes = cooldownMinutes;

  // Validate webhook URL if webhook is being enabled (using proper URL validation)
  if (webhookEnabled && webhookUrl) {
    if ((webhookType === 'discord' || !webhookType) && !isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        { error: 'Invalid Discord webhook URL format' },
        { status: 400 }
      );
    }
  }

  // Update subscription (RLS ensures user can only update their own)
  const { data: subscription, error } = await supabase
    .from('alert_subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  return NextResponse.json({ subscription });
}

// DELETE /api/alerts/:id - Remove subscription
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Rate limit subscription deletions
  const rateLimitResult = await rateLimit(request, 'alerts:delete', RATE_LIMITS.ALERTS);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many subscription changes. Please try again later.' },
      { status: 429 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete subscription (RLS ensures user can only delete their own)
  const { error } = await supabase
    .from('alert_subscriptions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
