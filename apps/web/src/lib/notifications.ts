/**
 * Notification Service
 *
 * Handles sending alerts via email (Resend) and webhooks (Discord, etc.)
 */

import { getChainConfig, getThemeConfig, getProjectConfig } from '@/config';
import type { ChainConfig, ThemeConfig } from '@atlasp2p/types';

// ===========================================
// CONSTANTS
// ===========================================

// Timeout for external API calls (10 seconds)
const FETCH_TIMEOUT_MS = 10000;

// Valid Discord webhook URL pattern
const DISCORD_WEBHOOK_REGEX = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

// ===========================================
// UTILITIES
// ===========================================

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate Discord webhook URL
 */
export function isValidDiscordWebhookUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false;
    // Must match Discord webhook pattern
    return DISCORD_WEBHOOK_REGEX.test(url);
  } catch {
    return false;
  }
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Basic email validation - allows most valid emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Alert types
export type AlertType = 'offline' | 'online' | 'version_outdated' | 'tier_change';

export interface NodeAlertData {
  nodeId: string;
  nodeName?: string;
  nodeIp: string;
  nodePort: number;
  alertType: AlertType;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}

export interface AlertResult {
  success: boolean;
  emailSent?: boolean;
  emailError?: string;
  webhookSent?: boolean;
  webhookError?: string;
}

// ===========================================
// EMAIL NOTIFICATIONS (Resend)
// ===========================================

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  // IMPORTANT: Set RESEND_FROM_EMAIL in your environment
  // Default uses SMTP_ADMIN_EMAIL or falls back to noreply@localhost
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_ADMIN_EMAIL || 'noreply@localhost';

  if (!apiKey) {
    console.error('[Notifications] RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  // Validate email address
  if (!isValidEmail(payload.to)) {
    console.error('[Notifications] Invalid email address:', payload.to);
    return { success: false, error: 'Invalid email address' };
  }

  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Notifications] Resend API error:', error);
      return { success: false, error };
    }

    console.log('[Notifications] Email sent successfully to:', payload.to);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Notifications] Email send timed out');
      return { success: false, error: 'Request timed out' };
    }
    console.error('[Notifications] Email send failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ===========================================
// WEBHOOK NOTIFICATIONS (Discord, etc.)
// ===========================================

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  embed: DiscordEmbed
): Promise<{ success: boolean; error?: string }> {
  // Validate webhook URL
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    console.error('[Notifications] Invalid Discord webhook URL');
    return { success: false, error: 'Invalid Discord webhook URL format' };
  }

  try {
    console.log('[Notifications] Sending Discord webhook to:', webhookUrl.substring(0, 60) + '...');

    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    console.log('[Notifications] Discord response status:', response.status);

    // Discord returns 204 No Content on success
    if (response.status === 204 || response.ok) {
      console.log('[Notifications] Discord webhook sent successfully');
      return { success: true };
    }

    const errorText = await response.text();
    console.error('[Notifications] Discord webhook error:', response.status, errorText);
    return { success: false, error: `HTTP ${response.status}: ${errorText || 'Unknown error'}` };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Notifications] Discord webhook timed out');
      return { success: false, error: 'Request timed out' };
    }
    console.error('[Notifications] Discord webhook failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ===========================================
// ALERT FORMATTERS
// ===========================================

const ALERT_COLORS = {
  offline: 0xff0000,    // Red
  online: 0x00ff00,     // Green
  version_outdated: 0xffa500, // Orange
  tier_change: 0x0099ff, // Blue (will be dynamic based on upgrade/downgrade)
};

const ALERT_EMOJIS = {
  offline: '🔴',
  online: '🟢',
  version_outdated: '⚠️',
  tier_change: '📊',
};

const ALERT_TITLES = {
  offline: 'Node Offline',
  online: 'Node Back Online',
  version_outdated: 'Node Version Outdated',
  tier_change: 'Node Tier Changed',
};

// Tier emojis and colors for better visual representation
const TIER_EMOJIS: Record<string, string> = {
  diamond: '💎',
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
  standard: '⭐',
};

const TIER_COLORS: Record<string, number> = {
  diamond: 0x00ffff,  // Cyan
  gold: 0xffd700,     // Gold
  silver: 0xc0c0c0,   // Silver
  bronze: 0xcd7f32,   // Bronze
  standard: 0x808080, // Gray
};

const TIER_NAMES: Record<string, string> = {
  diamond: 'Diamond',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  standard: 'Standard',
};

export function formatAlertForDiscord(
  data: NodeAlertData,
  overrides?: { chainConfig?: ChainConfig; themeConfig?: ThemeConfig }
): DiscordEmbed {
  const chain = overrides?.chainConfig || getChainConfig();
  const theme = overrides?.themeConfig || getThemeConfig();

  const emoji = ALERT_EMOJIS[data.alertType];
  const title = `${emoji} ${ALERT_TITLES[data.alertType]}`;

  // Dynamic color for tier changes (upgrade = gold, downgrade = gray)
  let color = ALERT_COLORS[data.alertType];
  if (data.alertType === 'tier_change' && data.previousValue && data.newValue) {
    const tierOrder = ['diamond', 'gold', 'silver', 'bronze', 'standard'];
    const upgraded = tierOrder.indexOf(data.newValue.toLowerCase()) < tierOrder.indexOf(data.previousValue.toLowerCase());
    color = upgraded ? TIER_COLORS[data.newValue.toLowerCase()] || 0xffd700 : 0x808080;
  }

  // Format IP:Port correctly for IPv6 (use brackets)
  const isIPv6 = data.nodeIp.includes(':');
  const ipPort = isIPv6 ? `[${data.nodeIp}]:${data.nodePort}` : `${data.nodeIp}:${data.nodePort}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Node', value: data.nodeName || data.nodeIp, inline: true },
    { name: 'IP:Port', value: ipPort, inline: true },
  ];

  let description = '';
  switch (data.alertType) {
    case 'offline':
      description = `Your node **${data.nodeName || data.nodeIp}** is no longer reachable from the network.`;

      // Add last seen info if available
      if (data.metadata?.lastSeen) {
        const lastSeenDate = new Date(data.metadata.lastSeen);
        const now = new Date();
        const minutesAgo = Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000);
        fields.push({
          name: '⏱️ Last Seen',
          value: minutesAgo < 60 ? `${minutesAgo} minutes ago` : `${Math.floor(minutesAgo / 60)} hours ago`,
          inline: true
        });
      }

      // Add version info if available
      if (data.metadata?.version) {
        fields.push({ name: 'Version', value: data.metadata.version, inline: true });
      }

      description += '\n\n**Possible causes:**\n• Node software stopped/crashed\n• Firewall blocking port ' + data.nodePort + '\n• Network connectivity issues\n• Server/VPS down\n\n**Next steps:**\n• Check if your node process is running\n• Verify firewall rules allow port ' + data.nodePort + '\n• Check server logs for errors';
      break;

    case 'online':
      description = `Your node **${data.nodeName || data.nodeIp}** is back online and responding to connections.`;
      fields.push({ name: 'Status', value: '✅ Connected', inline: true });

      // Add version info
      if (data.metadata?.version) {
        fields.push({ name: 'Version', value: data.metadata.version, inline: true });
      }

      // Add downtime duration if available
      if (data.metadata?.downtimeDuration) {
        const duration = data.metadata.downtimeDuration;
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
        fields.push({ name: '⏱️ Downtime', value: durationStr, inline: true });
      }

      description += '\n\n🎉 Your node is now accepting connections and contributing to the network!';
      break;
    case 'version_outdated':
      // Normalize versions for display - standardize to 3-part format (Major.Minor.Patch)
      const normalizeDisplayVersion = (v: string) => {
        const cleaned = v?.replace(/^v/i, '').replace(/[^0-9.]/g, '') || 'Unknown';
        if (cleaned === 'Unknown') return cleaned;

        // Split into parts and take first 3 (ignore 4th build number)
        const parts = cleaned.split('.').map(p => parseInt(p) || 0);
        return `${parts[0] || 0}.${parts[1] || 0}.${parts[2] || 0}`;
      };

      const yourVersion = normalizeDisplayVersion(data.newValue || '');
      const latestVersion = normalizeDisplayVersion(chain.currentVersion);

      // Additional safety check: if versions are actually equal after normalization, log warning
      // (this should be caught by crawler, but as failsafe)
      if (yourVersion === latestVersion) {
        console.warn('[Alerts] VERSION_OUTDATED alert triggered for same version:', {
          yourVersion,
          latestVersion,
          rawYour: data.newValue,
          rawLatest: chain.currentVersion,
          nodeId: data.nodeId
        });
      }

      description = `Your node **${data.nodeName || data.nodeIp}** is running an outdated version and should be updated.`;
      fields.push({ name: 'Your Version', value: `v${yourVersion}`, inline: true });
      fields.push({ name: 'Latest Version', value: `v${latestVersion}`, inline: true });

      // Download link
      if (chain.latestReleaseUrl) {
        fields.push({
          name: '📥 Download Latest',
          value: `[${chain.name} v${latestVersion}](${chain.latestReleaseUrl})`,
          inline: false
        });
      } else if (chain.releasesUrl) {
        fields.push({
          name: '📥 Releases',
          value: `[View all releases](${chain.releasesUrl})`,
          inline: false
        });
      }

      // Add update urgency with semantic version comparison
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(n => parseInt(n) || 0);
        const parts2 = v2.split('.').map(n => parseInt(n) || 0);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 < p2) return -1;
          if (p1 > p2) return 1;
        }
        return 0;
      };

      const critVersion = normalizeDisplayVersion(chain.criticalVersion || '');
      const minVersion = normalizeDisplayVersion(chain.minimumVersion || '');

      if (critVersion && compareVersions(yourVersion, critVersion) < 0) {
        description += '\n\n🚨 **CRITICAL UPDATE REQUIRED**\nYour version may have security vulnerabilities. Update immediately to avoid potential issues!';
      } else if (minVersion && compareVersions(yourVersion, minVersion) < 0) {
        description += '\n\n⚡ **Important Update**\nYour version is below the minimum recommended. Please update soon to ensure compatibility with the network.';
      } else {
        description += '\n\n💡 **Recommended Update**\nA newer version is available with improvements and bug fixes.';
      }
      break;
    case 'tier_change':
      if (data.previousValue && data.newValue) {
        const tierOrder = ['diamond', 'gold', 'silver', 'bronze', 'standard'];
        const oldTier = data.previousValue.toLowerCase();
        const newTier = data.newValue.toLowerCase();
        const upgraded = tierOrder.indexOf(newTier) < tierOrder.indexOf(oldTier);

        const oldEmoji = TIER_EMOJIS[oldTier] || '⭐';
        const newEmoji = TIER_EMOJIS[newTier] || '⭐';
        const oldName = TIER_NAMES[oldTier] || data.previousValue;
        const newName = TIER_NAMES[newTier] || data.newValue;

        if (upgraded) {
          description = `🎉 **Congratulations!** Your node **${data.nodeName || data.nodeIp}** has been promoted to a higher tier!`;
          fields.push({
            name: '⬆️ Tier Upgrade',
            value: `${oldEmoji} ${oldName} → ${newEmoji} **${newName}**`,
            inline: false
          });
          description += '\n\n**What this means:**\n• Higher visibility on the network map\n• Better ranking in the leaderboard\n• Recognition for improved performance\n\n**Keep it up!** Maintain your uptime and performance to stay in this tier.';
        } else {
          description = `Your node **${data.nodeName || data.nodeIp}** tier has changed.`;
          fields.push({
            name: '⬇️ Tier Changed',
            value: `${oldEmoji} ${oldName} → ${newEmoji} ${newName}`,
            inline: false
          });
          description += '\n\n**What this means:**\n• Your node performance metrics have changed\n• This may affect your visibility and ranking\n\n**Improve your tier by:**\n• Maintaining higher uptime (aim for 99%+)\n• Ensuring stable connectivity\n• Running the latest node version\n• Verifying your node ownership';
        }
      } else {
        description = `Your node **${data.nodeName || data.nodeIp}** tier has been updated.`;
      }
      break;
  }

  return {
    title,
    description,
    color,
    fields,
    footer: { text: `${chain.name} Node Monitor • ${chain.websiteUrl || ''}` },
    timestamp: new Date().toISOString(),
  };
}

export function formatAlertForEmail(
  data: NodeAlertData,
  userEmail: string,
  overrides?: { chainConfig?: ChainConfig; themeConfig?: ThemeConfig }
): EmailPayload {
  const chain = overrides?.chainConfig || getChainConfig();
  const theme = overrides?.themeConfig || getThemeConfig();
  const projectName = getProjectConfig().projectName;

  const emoji = ALERT_EMOJIS[data.alertType];
  const title = ALERT_TITLES[data.alertType];
  const nodeName = data.nodeName || data.nodeIp;

  // Format IP:Port correctly for IPv6 (use brackets)
  const isIPv6 = data.nodeIp.includes(':');
  const ipPort = isIPv6 ? `[${data.nodeIp}]:${data.nodePort}` : `${data.nodeIp}:${data.nodePort}`;

  // Normalize version for display - standardize to 3-part format (Major.Minor.Patch)
  const normalizeVersion = (v: string) => {
    const cleaned = v?.replace(/^v/i, '').replace(/[^0-9.]/g, '') || 'Unknown';
    if (cleaned === 'Unknown') return cleaned;

    // Split into parts and take first 3 (ignore 4th build number)
    // This ensures 1.18.0 and 1.18.0.0 display identically as 1.18.0
    const parts = cleaned.split('.').map(p => parseInt(p) || 0);
    return `${parts[0] || 0}.${parts[1] || 0}.${parts[2] || 0}`;
  };

  let statusColor = '#ff0000';
  let statusText = '';
  let actionText = '';
  let additionalInfo = '';

  switch (data.alertType) {
    case 'offline':
      statusColor = '#ff0000';
      statusText = 'Your node is no longer reachable from the network.';

      // Add last seen info
      if (data.metadata?.lastSeen) {
        const lastSeenDate = new Date(data.metadata.lastSeen);
        const minutesAgo = Math.floor((Date.now() - lastSeenDate.getTime()) / 60000);
        const timeAgo = minutesAgo < 60 ? `${minutesAgo} minutes ago` : `${Math.floor(minutesAgo / 60)} hours ago`;
        additionalInfo += `
          <tr>
            <td style="padding: 8px 0; color: #888;">⏱️ Last Seen</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${timeAgo}</td>
          </tr>
        `;
      }

      // Add version
      if (data.metadata?.version) {
        additionalInfo += `
          <tr>
            <td style="padding: 8px 0; color: #888;">Version</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace;">${data.metadata.version}</td>
          </tr>
        `;
      }

      actionText = `
        <div style="margin-top: 20px; padding: 15px; background-color: #2a2020; border-left: 4px solid #ff0000; border-radius: 4px;">
          <h4 style="margin: 0 0 10px; color: #ff6666;">Troubleshooting Steps</h4>
          <ol style="margin: 0; padding-left: 20px; color: #ccc; line-height: 1.8;">
            <li>Check if your node process is running</li>
            <li>Verify firewall rules allow port ${data.nodePort}</li>
            <li>Check network connectivity and DNS resolution</li>
            <li>Review node logs for errors</li>
            <li>Verify server/VPS is not down or under maintenance</li>
          </ol>
        </div>
      `;
      break;

    case 'online':
      statusColor = '#00ff00';
      statusText = '🎉 Your node is back online and responding to connections!';

      // Add version
      if (data.metadata?.version) {
        additionalInfo += `
          <tr>
            <td style="padding: 8px 0; color: #888;">Version</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace;">${data.metadata.version}</td>
          </tr>
        `;
      }

      // Add downtime duration
      if (data.metadata?.downtimeDuration) {
        const duration = data.metadata.downtimeDuration;
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
        additionalInfo += `
          <tr>
            <td style="padding: 8px 0; color: #888;">⏱️ Downtime</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${durationStr}</td>
          </tr>
        `;
      }

      actionText = `
        <div style="margin-top: 20px; padding: 15px; background-color: #1a2a1a; border-left: 4px solid #00ff00; border-radius: 4px;">
          <p style="margin: 0; color: #99ff99;">Your node is now accepting connections and contributing to the ${chain.name} network.</p>
        </div>
      `;
      break;

    case 'version_outdated':
      statusColor = '#ffa500';
      const yourVersion = normalizeVersion(data.newValue || '');
      const latestVersion = normalizeVersion(chain.currentVersion);

      statusText = `Your node is running an outdated version and should be updated.`;

      additionalInfo = `
        <tr>
          <td style="padding: 8px 0; color: #888;">Your Version</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace;">v${yourVersion}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888;">Latest Version</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: ${theme.primaryColor}; font-weight: 600;">v${latestVersion}</td>
        </tr>
      `;

      actionText = chain.latestReleaseUrl ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="${chain.latestReleaseUrl}" style="display: inline-block; background-color: ${theme.primaryColor}; color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; transition: transform 0.2s;">
            📥 Download ${chain.name} v${latestVersion}
          </a>
        </div>
        <p style="margin-top: 15px; font-size: 13px; color: #888; text-align: center;">
          Or view all releases at <a href="${chain.releasesUrl || chain.githubUrl + '/releases'}" style="color: ${theme.primaryColor}; text-decoration: none;">${chain.name} Releases</a>
        </p>
      ` : '';
      break;

    case 'tier_change':
      if (data.previousValue && data.newValue) {
        const tierOrder = ['diamond', 'gold', 'silver', 'bronze', 'standard'];
        const oldTier = data.previousValue.toLowerCase();
        const newTier = data.newValue.toLowerCase();
        const upgraded = tierOrder.indexOf(newTier) < tierOrder.indexOf(oldTier);

        const oldEmoji = TIER_EMOJIS[oldTier] || '⭐';
        const newEmoji = TIER_EMOJIS[newTier] || '⭐';
        const oldName = TIER_NAMES[oldTier] || data.previousValue;
        const newName = TIER_NAMES[newTier] || data.newValue;

        statusColor = upgraded ? '#ffd700' : '#808080';

        if (upgraded) {
          statusText = `🎉 Congratulations! Your node has been promoted to ${newEmoji} <strong>${newName}</strong> tier!`;
          additionalInfo = `
            <tr>
              <td style="padding: 8px 0; color: #888;">Previous Tier</td>
              <td style="padding: 8px 0; text-align: right;">${oldEmoji} ${oldName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Current Tier</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #ffd700;">${newEmoji} ${newName}</td>
            </tr>
          `;
          actionText = `
            <div style="margin-top: 20px; padding: 15px; background-color: #2a2520; border-left: 4px solid #ffd700; border-radius: 4px;">
              <h4 style="margin: 0 0 10px; color: #ffd700;">🎉 What This Means</h4>
              <ul style="margin: 0; padding-left: 20px; color: #ccc; line-height: 1.8;">
                <li>Higher visibility on the network map</li>
                <li>Better ranking in the leaderboard</li>
                <li>Recognition for improved performance</li>
              </ul>
              <p style="margin: 15px 0 0; color: #99ff99; font-weight: 600;">
                Keep it up! Maintain your uptime and performance to stay in this tier.
              </p>
            </div>
          `;
        } else {
          statusText = `Your node tier has changed from ${oldEmoji} ${oldName} to ${newEmoji} ${newName}.`;
          additionalInfo = `
            <tr>
              <td style="padding: 8px 0; color: #888;">Previous Tier</td>
              <td style="padding: 8px 0; text-align: right;">${oldEmoji} ${oldName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Current Tier</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${newEmoji} ${newName}</td>
            </tr>
          `;
          actionText = `
            <div style="margin-top: 20px; padding: 15px; background-color: #2a2a2a; border-left: 4px solid #808080; border-radius: 4px;">
              <h4 style="margin: 0 0 10px; color: #ccc;">💡 Improve Your Tier</h4>
              <ul style="margin: 0; padding-left: 20px; color: #ccc; line-height: 1.8;">
                <li>Maintain higher uptime (aim for 99%+)</li>
                <li>Ensure stable connectivity and low latency</li>
                <li>Run the latest node version</li>
                <li>Verify your node ownership</li>
              </ul>
            </div>
          `;
        }
      } else {
        statusColor = '#0099ff';
        statusText = `Your node tier has been updated.`;
      }
      break;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
    <!-- Header -->
    <div style="background-color: ${theme.primaryColor}; padding: 20px; text-align: center;">
      <h1 style="margin: 0; color: #000000; font-size: 24px;">${emoji} ${title}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        ${statusText}
      </p>

      <div style="background-color: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px; color: ${theme.primaryColor};">Node Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #888;">Name</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${nodeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">IP:Port</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace;">${ipPort}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">Status</td>
            <td style="padding: 8px 0; text-align: right;">
              <span style="background-color: ${statusColor}; color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                ${data.alertType.toUpperCase().replace('_', ' ')}
              </span>
            </td>
          </tr>
          ${additionalInfo}
        </table>
        ${actionText}
      </div>

      <p style="font-size: 14px; color: #888; margin: 20px 0 0;">
        You received this alert because you have notifications enabled for this node.
        <a href="${chain.websiteUrl}" style="color: ${theme.primaryColor};">Manage your alerts</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #0f0f0f; padding: 20px; text-align: center; border-top: 1px solid #333;">
      <p style="margin: 0; font-size: 12px; color: #666;">
        ${chain.name} Node Monitor &bull; Powered by ${projectName}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    to: userEmail,
    subject: `${emoji} ${title}: ${nodeName}`,
    html,
  };
}

// ===========================================
// MAIN ALERT SENDER
// ===========================================

export interface AlertSubscription {
  id: string;
  user_id: string;
  node_id: string | null;
  alert_offline: boolean;
  alert_online: boolean;
  alert_version_outdated: boolean;
  alert_tier_change: boolean;
  email_enabled: boolean;
  webhook_enabled: boolean;
  webhook_url: string | null;
  webhook_type: string;
  cooldown_minutes: number;
  last_alert_at: string | null;
}

export async function sendNodeAlert(
  data: NodeAlertData,
  subscription: AlertSubscription,
  userEmail: string,
  overrides?: { chainConfig?: ChainConfig; themeConfig?: ThemeConfig }
): Promise<AlertResult> {
  const result: AlertResult = { success: true };

  // Check cooldown
  if (subscription.last_alert_at) {
    const lastAlert = new Date(subscription.last_alert_at);
    const cooldownMs = subscription.cooldown_minutes * 60 * 1000;
    if (Date.now() - lastAlert.getTime() < cooldownMs) {
      console.log(`[Notifications] Alert skipped - cooldown not expired for subscription ${subscription.id}`);
      return { success: false, emailError: 'Cooldown not expired', webhookError: 'Cooldown not expired' };
    }
  }

  // Send email if enabled
  if (subscription.email_enabled && userEmail) {
    const emailPayload = formatAlertForEmail(data, userEmail, overrides);
    const emailResult = await sendEmail(emailPayload);
    result.emailSent = emailResult.success;
    result.emailError = emailResult.error;
  }

  // Send webhook if enabled
  if (subscription.webhook_enabled && subscription.webhook_url) {
    if (subscription.webhook_type === 'discord') {
      const embed = formatAlertForDiscord(data, overrides);
      const webhookResult = await sendDiscordWebhook(subscription.webhook_url, embed);
      result.webhookSent = webhookResult.success;
      result.webhookError = webhookResult.error;
    }
    // Add other webhook types here (slack, generic, etc.)
  }

  result.success = !!(result.emailSent || result.webhookSent);
  return result;
}

// ===========================================
// TEST FUNCTIONS
// ===========================================

export async function testDiscordWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const chain = getChainConfig();
    const chainName = chain?.name || 'Nodes Map';

    const embed: DiscordEmbed = {
      title: 'Webhook Test Successful',
      description: 'Your Discord webhook is configured correctly and will receive node alerts.',
      color: 0x00ff00,
      fields: [
        { name: 'Status', value: 'Connected', inline: true },
        { name: 'Network', value: chainName, inline: true },
      ],
      footer: { text: `${chainName} Node Monitor` },
      timestamp: new Date().toISOString(),
    };

    return sendDiscordWebhook(webhookUrl, embed);
  } catch (error) {
    console.error('[Notifications] testDiscordWebhook error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send test' };
  }
}

export async function testEmailNotification(email: string): Promise<{ success: boolean; error?: string }> {
  const chain = getChainConfig();
  const theme = getThemeConfig();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
    <div style="background-color: ${theme.primaryColor}; padding: 20px; text-align: center;">
      <h1 style="margin: 0; color: #000000;">✅ Email Test Successful</h1>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px; line-height: 1.6;">
        Your email notifications are configured correctly. You will receive alerts for your monitored nodes.
      </p>
    </div>
    <div style="background-color: #0f0f0f; padding: 20px; text-align: center; border-top: 1px solid #333;">
      <p style="margin: 0; font-size: 12px; color: #666;">
        ${chain.name} Node Monitor
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: email,
    subject: `✅ ${chain.name} Node Monitor - Email Test`,
    html,
  });
}
