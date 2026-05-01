import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/lib/notifications';

// GoTrue Send-Email Auth Hook (Supabase Standard Webhooks).
// Receives email payloads that GoTrue would otherwise hand to its built-in
// SMTP client. Used when SMTP is unavailable (e.g. DigitalOcean blocks
// outbound 25/465/587). Renders the same email types as GoTrue's defaults
// and dispatches via Resend HTTPS API through sendEmail().

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TIMESTAMP_DRIFT_SECONDS = 5 * 60;

type EmailActionType =
  | 'signup'
  | 'recovery'
  | 'invite'
  | 'magiclink'
  | 'email_change'
  | 'email_change_new'
  | 'reauthentication';

interface EmailHookPayload {
  user: {
    id?: string;
    email: string;
    new_email?: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifyStandardWebhookSignature(
  body: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignatureHeader: string,
  secretsConfig: string,
): boolean {
  const tsSeconds = parseInt(webhookTimestamp, 10);
  if (!Number.isFinite(tsSeconds)) return false;
  const drift = Math.abs(Math.floor(Date.now() / 1000) - tsSeconds);
  if (drift > MAX_TIMESTAMP_DRIFT_SECONDS) return false;

  // GOTRUE_HOOK_SEND_EMAIL_SECRETS format: "v1,whsec_<base64>" possibly
  // space-separated for rotation. Parse all whsec_ values.
  const rawSecrets = secretsConfig
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('whsec_'))
    .map((s) => s.slice('whsec_'.length));

  if (rawSecrets.length === 0) return false;

  const signedPayload = `${webhookId}.${webhookTimestamp}.${body}`;
  // webhook-signature header is space-separated list of "v<scheme>,<base64-sig>"
  const presentedSigs = webhookSignatureHeader
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('v1,'))
    .map((s) => s.slice('v1,'.length));

  for (const secretBase64 of rawSecrets) {
    const secretBytes = Buffer.from(secretBase64, 'base64');
    const expected = crypto.createHmac('sha256', secretBytes).update(signedPayload).digest('base64');
    for (const presented of presentedSigs) {
      if (timingSafeEqualHex(expected, presented)) return true;
    }
  }
  return false;
}

function safeRedirect(siteUrl: string, redirectTo: string): string {
  // Ensure redirect_to falls back to siteUrl if empty.
  if (redirectTo && redirectTo.length > 0) return redirectTo;
  return siteUrl;
}

function getApiExternalUrl(siteUrl: string): string {
  // GoTrue exposes its verify endpoint at API_EXTERNAL_URL/verify in
  // self-hosted setups (Caddy proxies /supabase/* to Kong→auth). Fall back
  // to {site_url}/auth/v1 for managed Supabase deployments.
  const fromEnv = process.env.API_EXTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  return `${siteUrl.replace(/\/$/, '')}/auth/v1`;
}

function buildVerifyUrl(
  apiBase: string,
  tokenHash: string,
  type: string,
  redirectTo: string,
): string {
  const params = new URLSearchParams({
    token: tokenHash,
    type,
    redirect_to: redirectTo,
  });
  return `${apiBase}/verify?${params.toString()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface RenderedEmail {
  subject: string;
  html: string;
}

// Templates mirror GoTrue's built-in defaults (plain HTML, single CTA link).
// Subjects match GoTrue's defaults so this hook is a drop-in replacement.
function renderEmail(payload: EmailHookPayload): RenderedEmail | null {
  const { email_data } = payload;
  const apiBase = getApiExternalUrl(email_data.site_url);
  const redirect = safeRedirect(email_data.site_url, email_data.redirect_to);

  switch (email_data.email_action_type) {
    case 'signup': {
      const url = buildVerifyUrl(apiBase, email_data.token_hash, 'signup', redirect);
      return {
        subject: 'Confirm Your Signup',
        html: `<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="${escapeHtml(url)}">Confirm your email</a></p>`,
      };
    }
    case 'recovery': {
      const url = buildVerifyUrl(apiBase, email_data.token_hash, 'recovery', redirect);
      return {
        subject: 'Reset Your Password',
        html: `<h2>Reset password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="${escapeHtml(url)}">Reset password</a></p>`,
      };
    }
    case 'magiclink': {
      const url = buildVerifyUrl(apiBase, email_data.token_hash, 'magiclink', redirect);
      return {
        subject: 'Your Magic Link',
        html: `<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="${escapeHtml(url)}">Log In</a></p>`,
      };
    }
    case 'invite': {
      const url = buildVerifyUrl(apiBase, email_data.token_hash, 'invite', redirect);
      return {
        subject: 'You have been invited',
        html: `<h2>You have been invited</h2>
<p>You have been invited to create a user on ${escapeHtml(email_data.site_url)}. Follow this link to accept the invite:</p>
<p><a href="${escapeHtml(url)}">Accept the invite</a></p>`,
      };
    }
    case 'email_change':
    case 'email_change_new': {
      const tokenHash = email_data.token_hash_new || email_data.token_hash;
      const url = buildVerifyUrl(apiBase, tokenHash, 'email_change', redirect);
      return {
        subject: 'Confirm Change of Email',
        html: `<h2>Confirm Change of Email</h2>
<p>Follow this link to confirm the update of your email from ${escapeHtml(payload.user.email)} to ${escapeHtml(payload.user.new_email || '')}:</p>
<p><a href="${escapeHtml(url)}">Change Email</a></p>`,
      };
    }
    case 'reauthentication': {
      return {
        subject: 'Confirm reauthentication',
        html: `<h2>Confirm reauthentication</h2>
<p>Enter the code: ${escapeHtml(email_data.token)}</p>`,
      };
    }
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const secrets = process.env.GOTRUE_HOOK_SEND_EMAIL_SECRETS;
  if (!secrets) {
    return NextResponse.json(
      { error: 'GOTRUE_HOOK_SEND_EMAIL_SECRETS not configured' },
      { status: 503 },
    );
  }

  const webhookId = req.headers.get('webhook-id');
  const webhookTimestamp = req.headers.get('webhook-timestamp');
  const webhookSignature = req.headers.get('webhook-signature');
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
  }

  const body = await req.text();
  if (!verifyStandardWebhookSignature(body, webhookId, webhookTimestamp, webhookSignature, secrets)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let payload: EmailHookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.user?.email || !payload.email_data?.email_action_type) {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const rendered = renderEmail(payload);
  if (!rendered) {
    return NextResponse.json(
      { error: `Unsupported email_action_type: ${payload.email_data.email_action_type}` },
      { status: 400 },
    );
  }

  // Email_change sends to the NEW address; everything else to the user's current email.
  const toAddress =
    payload.email_data.email_action_type === 'email_change_new' && payload.user.new_email
      ? payload.user.new_email
      : payload.user.email;

  const result = await sendEmail({
    to: toAddress,
    subject: rendered.subject,
    html: rendered.html,
  });

  if (!result.success) {
    // Return 5xx so GoTrue retries via Standard Webhooks backoff.
    return NextResponse.json({ error: result.error || 'Email send failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
