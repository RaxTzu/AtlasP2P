/**
 * Alert Test API
 *
 * POST - Test email or webhook delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { testDiscordWebhook, testEmailNotification } from '@/lib/notifications';
import { autoLoadConfig } from '@atlasp2p/config/loader.server';
import { initializeConfig } from '@atlasp2p/config';
import { rateLimit, RATE_LIMITS } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required for fs-based config loader

// POST /api/alerts/test - Test notification delivery
export async function POST(request: NextRequest) {
  // --- Initialize Project Config (Server-Side) ---
  const projectConfig = autoLoadConfig();
  initializeConfig(projectConfig);
  // -------------------------------------------------

  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit the endpoint
  const rateLimitResult = await rateLimit(request, 'alerts:test', RATE_LIMITS.API_TEST);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const body = await request.json();
  const { type, webhookUrl, email } = body;

  if (!type || !['email', 'discord'].includes(type)) {
    return NextResponse.json(
      { error: 'Invalid test type. Use "email" or "discord"' },
      { status: 400 }
    );
  }

  // Test email
  if (type === 'email') {
    const testEmail = email || user.email;
    if (!testEmail) {
      return NextResponse.json(
        { error: 'No email address found to send the test to.' },
        { status: 400 }
      );
    }

    const result = await testEmailNotification(testEmail);
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Test email sent successfully to ${testEmail}. Check your inbox.`
        : `Failed to send test email: ${result.error}`,
    });
  }

  // Test Discord webhook
  if (type === 'discord') {
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL is required for Discord test' },
        { status: 400 }
      );
    }

    if (!webhookUrl.includes('discord.com/api/webhooks')) {
      return NextResponse.json(
        { error: 'Invalid Discord webhook URL' },
        { status: 400 }
      );
    }

    const result = await testDiscordWebhook(webhookUrl);
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? 'Test message sent to Discord successfully.'
        : `Failed to send Discord message: ${result.error}`,
    });
  }

  return NextResponse.json({ error: 'Unknown test type' }, { status: 400 });
}
