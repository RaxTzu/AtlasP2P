/**
 * Alert Processing API
 *
 * POST - Process pending alerts based on node status changes
 * Called by crawler after each pass or by a cron job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  sendNodeAlert,
  NodeAlertData,
  AlertSubscription,
  AlertType,
} from '@/lib/notifications';
import { autoLoadConfig } from '@atlasp2p/config/loader.server';
import { initializeConfig, getChainConfig, getThemeConfig } from '@atlasp2p/config';
import { getChainConfigWithOverrides, isMaintenanceMode } from '@/lib/config-overrides';

export const dynamic = 'force-dynamic';

// Allow up to 60 seconds for processing
export const maxDuration = 60;

interface NodeChange {
  node_id: string;
  node_ip: string;
  node_port: number;
  node_name: string | null;
  change_type: AlertType;
  previous_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
}

interface SubscriptionWithUser extends AlertSubscription {
  user: { email?: string } | null;
}

// POST /api/alerts/process - Process pending alerts
export async function POST(request: NextRequest) {
  // --- Initialize Project Config (Server-Side) ---
  const projectConfig = autoLoadConfig();
  initializeConfig(projectConfig);
  // -------------------------------------------------

  const adminClient = createAdminClient();

  // Optional: Verify this is an internal call via API key
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.ALERTS_PROCESS_KEY;

  // If key is set, require it
  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if maintenance mode is enabled (skip all alerts)
    const maintenanceMode = await isMaintenanceMode();
    if (maintenanceMode) {
      console.log('[Alerts] Maintenance mode enabled - skipping all alerts');
      return NextResponse.json({ processed: 0, sent: 0, skipped: 'maintenance_mode' });
    }

    // Get chain config with database overrides for accurate version info
    const chainConfig = await getChainConfigWithOverrides();
    const themeConfig = getThemeConfig();
    const configOverrides = { chainConfig, themeConfig };

    const body = await request.json().catch(() => ({}));
    const checkMinutes = body.checkMinutes || 10; // Check nodes updated in last X minutes

    console.log('[Alerts] Processing alerts for nodes updated in last', checkMinutes, 'minutes');
    console.log('[Alerts] Using chain config - currentVersion:', chainConfig.currentVersion);

    // Get nodes that have changed status recently
    const cutoff = new Date(Date.now() - checkMinutes * 60 * 1000).toISOString();
    console.log('[Alerts] Cutoff timestamp:', cutoff);

    // Find nodes that went offline (were up, now down)
    // Include last_seen and version for metadata
    const { data: offlineNodes, error: offlineError } = await adminClient
      .from('nodes')
      .select('id, ip, port, status, previous_status, updated_at, last_seen, version')
      .eq('status', 'down')
      .eq('previous_status', 'up')
      .gte('updated_at', cutoff);

    console.log('[Alerts] Offline nodes query:', { count: offlineNodes?.length, error: offlineError?.message });

    // Find nodes that came back online (were down, now up)
    // Include version and calculate downtime
    const { data: onlineNodes } = await adminClient
      .from('nodes')
      .select('id, ip, port, status, previous_status, updated_at, last_seen, version, previous_status_changed_at')
      .eq('status', 'up')
      .eq('previous_status', 'down')
      .gte('updated_at', cutoff);

    console.log('[Alerts] Online nodes query:', { count: onlineNodes?.length });

    // Find nodes with outdated versions
    const { data: outdatedNodes } = await adminClient
      .from('nodes')
      .select('id, ip, port, client_version, is_current_version, updated_at, version')
      .eq('is_current_version', false)
      .gte('updated_at', cutoff);

    console.log('[Alerts] Outdated nodes query:', { count: outdatedNodes?.length });

    // Find nodes with tier changes
    const { data: tierChangedNodes } = await adminClient
      .from('nodes')
      .select('id, ip, port, tier, previous_tier, updated_at, version')
      .not('previous_tier', 'is', null)
      .neq('tier', 'previous_tier')
      .gte('updated_at', cutoff);

    console.log('[Alerts] Tier changed nodes query:', { count: tierChangedNodes?.length });

    // Get display names from profiles for all affected nodes
    const allNodeIds = [
      ...(offlineNodes || []).map(n => n.id),
      ...(onlineNodes || []).map(n => n.id),
      ...(outdatedNodes || []).map(n => n.id),
      ...(tierChangedNodes || []).map(n => n.id),
    ];

    const { data: profiles } = allNodeIds.length > 0
      ? await adminClient
          .from('node_profiles')
          .select('node_id, display_name')
          .in('node_id', allNodeIds)
      : { data: [] };

    const profileMap = new Map(profiles?.map(p => [p.node_id, p.display_name]) || []);
    console.log('[Alerts] Profile map size:', profileMap.size, 'profiles fetched:', profiles?.length);

    // Build list of changes
    const changes: NodeChange[] = [];

    for (const node of offlineNodes || []) {
      const displayName = profileMap.get(node.id);
      console.log('[Alerts] Offline node:', node.id, 'display_name:', displayName, 'ip:', node.ip);
      changes.push({
        node_id: node.id,
        node_ip: node.ip,
        node_port: node.port,
        node_name: displayName || null,
        change_type: 'offline',
        metadata: {
          lastSeen: node.last_seen,
          version: node.version,
        }
      });
    }

    for (const node of onlineNodes || []) {
      // Calculate downtime duration in minutes
      let downtimeDuration: number | undefined;
      if (node.previous_status_changed_at) {
        const downSince = new Date(node.previous_status_changed_at).getTime();
        const backUpAt = new Date(node.updated_at).getTime();
        downtimeDuration = Math.floor((backUpAt - downSince) / 60000);
      }

      changes.push({
        node_id: node.id,
        node_ip: node.ip,
        node_port: node.port,
        node_name: profileMap.get(node.id) || null,
        change_type: 'online',
        metadata: {
          version: node.version,
          downtimeDuration,
        }
      });
    }

    for (const node of outdatedNodes || []) {
      changes.push({
        node_id: node.id,
        node_ip: node.ip,
        node_port: node.port,
        node_name: profileMap.get(node.id) || null,
        change_type: 'version_outdated',
        new_value: node.client_version,
        metadata: {
          version: node.version,
        }
      });
    }

    for (const node of tierChangedNodes || []) {
      changes.push({
        node_id: node.id,
        node_ip: node.ip,
        node_port: node.port,
        node_name: profileMap.get(node.id) || null,
        change_type: 'tier_change',
        previous_value: node.previous_tier, // Old tier
        new_value: node.tier, // New tier
        metadata: {
          version: node.version,
        }
      });
    }

    console.log('[Alerts] Found', changes.length, 'node changes to process');

    if (changes.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0 });
    }

    // Get all subscriptions that might be affected
    const nodeIds = new Set(changes.map(c => c.node_id));

    console.log('[Alerts] Searching subscriptions for', nodeIds.size, 'unique nodes');

    // Fetch all active subscriptions (the table should be small)
    const { data: allSubscriptions, error: subError } = await adminClient
      .from('alert_subscriptions')
      .select('*');

    // Filter to matching subscriptions (specific node or global)
    const subscriptions = (allSubscriptions || []).filter(sub =>
      sub.node_id === null || nodeIds.has(sub.node_id)
    );

    console.log('[Alerts] Subscriptions query result:', {
      total: allSubscriptions?.length,
      matching: subscriptions.length,
      error: subError?.message
    });

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Alerts] No matching subscriptions found');
      return NextResponse.json({ processed: changes.length, sent: 0 });
    }

    // Get user emails separately using admin client
    const userIds = [...new Set(subscriptions.map(s => s.user_id))];
    const userEmailMap = new Map<string, string>();

    for (const userId of userIds) {
      try {
        const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
        if (user?.email) {
          userEmailMap.set(userId, user.email);
        }
      } catch (e) {
        console.log('[Alerts] Failed to get user email:', userId);
      }
    }

    // Enrich subscriptions with emails
    const enrichedSubscriptions: SubscriptionWithUser[] = subscriptions.map(s => ({
      ...s,
      user: { email: userEmailMap.get(s.user_id) },
    }));

    // Get verified nodes to check ownership for global subscriptions
    const { data: verifiedNodes } = await adminClient
      .from('verified_nodes')
      .select('user_id, node_id');

    const verifiedMap = new Map<string, Set<string>>();
    for (const v of verifiedNodes || []) {
      if (!verifiedMap.has(v.user_id)) {
        verifiedMap.set(v.user_id, new Set());
      }
      verifiedMap.get(v.user_id)!.add(v.node_id);
    }

    // Process each change against matching subscriptions
    let sent = 0;
    const processed: string[] = [];

    for (const change of changes) {
      // Find subscriptions for this node
      const matchingSubs = enrichedSubscriptions.filter(sub => {
        // Specific node subscription
        if (sub.node_id === change.node_id) {
          return true;
        }

        // Global subscription - check if user owns this node
        if (sub.node_id === null) {
          const userNodes = verifiedMap.get(sub.user_id);
          return userNodes?.has(change.node_id);
        }

        return false;
      });

      for (const sub of matchingSubs) {
        console.log('[Alerts] Processing subscription:', sub.id, 'for change:', change.change_type);

        // Check if this alert type is enabled
        const alertEnabled = (
          (change.change_type === 'offline' && sub.alert_offline) ||
          (change.change_type === 'online' && sub.alert_online) ||
          (change.change_type === 'version_outdated' && sub.alert_version_outdated) ||
          (change.change_type === 'tier_change' && sub.alert_tier_change)
        );

        console.log('[Alerts] Alert enabled:', alertEnabled, 'for type:', change.change_type);

        if (!alertEnabled) {
          console.log('[Alerts] Skipping - alert type not enabled');
          continue;
        }

        // Get user email
        const userEmail = sub.user?.email;
        console.log('[Alerts] User email:', userEmail, 'email_enabled:', sub.email_enabled);

        if (!userEmail && sub.email_enabled) {
          console.log('[Alerts] No email for user', sub.user_id);
          continue;
        }

        // Prepare alert data
        const alertData: NodeAlertData = {
          nodeId: change.node_id,
          nodeName: change.node_name || undefined,
          nodeIp: change.node_ip,
          nodePort: change.node_port,
          alertType: change.change_type,
          previousValue: change.previous_value,
          newValue: change.new_value,
          metadata: change.metadata,
        };

        // Send alert with database overrides for accurate version info
        console.log('[Alerts] Sending alert for node:', change.node_id, 'type:', change.change_type);
        const result = await sendNodeAlert(
          alertData,
          sub,
          userEmail || '',
          configOverrides
        );
        console.log('[Alerts] Send result:', result);

        if (result.success) {
          sent++;

          // Update last_alert_at
          await adminClient
            .from('alert_subscriptions')
            .update({ last_alert_at: new Date().toISOString() })
            .eq('id', sub.id);

          // Create alert history
          await adminClient
            .from('alert_history')
            .insert({
              subscription_id: sub.id,
              node_id: change.node_id,
              alert_type: change.change_type,
              email_sent: result.emailSent || false,
              email_error: result.emailError,
              webhook_sent: result.webhookSent || false,
              webhook_error: result.webhookError,
              message: `Node ${change.node_name || change.node_ip} ${change.change_type}`,
              metadata: {
                node_ip: change.node_ip,
                node_port: change.node_port,
                previous_value: change.previous_value,
                new_value: change.new_value,
              },
            });

          processed.push(`${change.node_ip}:${change.change_type}:${sub.id}`);
        }
      }
    }

    console.log('[Alerts] Sent', sent, 'alerts for', changes.length, 'changes');

    return NextResponse.json({
      processed: changes.length,
      sent,
      details: processed,
    });

  } catch (error) {
    console.error('[Alerts] Processing failed:', error);
    return NextResponse.json(
      { error: 'Failed to process alerts' },
      { status: 500 }
    );
  }
}
