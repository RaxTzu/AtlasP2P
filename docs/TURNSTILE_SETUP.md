# Cloudflare Turnstile Setup Guide

Complete guide for setting up Turnstile bot protection in AtlasP2P.

## Overview

Turnstile is Cloudflare's privacy-friendly CAPTCHA alternative that protects API endpoints from bots without degrading user experience.

**Currently Protected Endpoints:**
- ✅ `/api/verify` - Node ownership verification (POST, PUT)
- ⏳ Future: tipping, profile_update, contact (not yet implemented)

---

## Local Development Setup

For testing on localhost, use Cloudflare's test keys that **always pass** and work without domain whitelisting.

### 1. Configure Site Key

**File**: `config/project.config.yaml`

```yaml
turnstile:
  enabled: true
  siteKey: "1x00000000000000000000AA"  # Test key - works on localhost
  mode: invisible  # or visible for debugging
  protectedActions:
    - verification
```

### 2. Configure Secret Key

**File**: `.env` (NEVER commit!)

```bash
# Local development - test key (always passes)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### 3. Restart Server

```bash
# Stop current server (Ctrl+C)
make docker-dev
```

### Test Keys Reference

| Site Key | Secret Key | Behavior | Mode |
|----------|------------|----------|------|
| `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Always passes | Visible |
| `2x00000000000000000000AB` | `2x0000000000000000000000000000000AB` | Always passes | Invisible |
| `3x00000000000000000000FF` | `3x0000000000000000000000000000000FF` | Always fails | Testing errors |

**Source**: [Cloudflare Docs](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

---

## Production Deployment

For production, you need **real keys** from Cloudflare Dashboard and must whitelist your domain.

### 1. Get Production Keys

1. Go to [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click **Add Site**
3. Add your domain: `nodes.dingocoin.com`
4. Copy the **Site Key** and **Secret Key**

### 2. Configure Site Key

**File**: `config/project.config.yaml`

```yaml
turnstile:
  enabled: true
  siteKey: "0x4AAAAAACHmrULrWXGjnBlP"  # Your real production key
  mode: invisible
  protectedActions:
    - verification
```

### 3. Configure Secret Key

**Via CI/CD (Recommended):**

Store in GitHub Secrets or AWS SSM:
```bash
TURNSTILE_SECRET_KEY=0x4AAAAAACHmrfqdjuWH8nhgwEVTDHAqZTE
```

**Via Manual .env (Testing):**
```bash
# Production keys
TURNSTILE_SECRET_KEY=0x4AAAAAACHmrfqdjuWH8nhgwEVTDHAqZTE
```

### 4. Whitelist Domain

In Cloudflare Dashboard → Your Site → Settings:
- Add `nodes.dingocoin.com`
- Add `*.dingocoin.com` (for subdomains)
- **DO NOT** add `localhost` to production keys (use test keys for dev)

---

## How It Works

### Flow Diagram

```
1. User clicks "Verify Node"
   ↓
2. Frontend loads Turnstile widget (invisible = automatic)
   ↓
3. Turnstile challenges user (silently checks browser behavior)
   ↓
4. User passes → Cloudflare generates token
   ↓
5. Frontend sends: { nodeId, method, turnstileToken: "..." }
   ↓
6. Backend calls Cloudflare API to verify token
   ↓
7. Valid? → Allow verification
   Invalid? → Return 403 "Turnstile verification failed"
```

### Code Flow

**Frontend** (`VerificationModal.tsx`):
```typescript
const requiresTurnstile = useTurnstileProtection('verification');

// Widget renders if required
{requiresTurnstile && (
  <TurnstileWidget onSuccess={setTurnstileToken} />
)}

// Include token in request
const body = {
  nodeId,
  method,
  turnstileToken  // Added by widget callback
};
```

**Backend** (`/api/verify/route.ts`):
```typescript
import { requireTurnstile } from '@/lib/feature-flags.server';

export async function POST(request: NextRequest) {
  // Verify Turnstile token
  const turnstileError = await requireTurnstile('verification', turnstileToken);
  if (turnstileError) {
    return turnstileError; // 403 error
  }

  // Continue with verification...
}
```

---

## Widget Modes

### Invisible (Recommended)
- No visible widget to user
- Runs challenge in background
- Best UX, seamless experience
- **Use for production**

```yaml
mode: invisible
```

### Visible
- Shows checkbox challenge
- User must click to verify
- Good for debugging
- **Use for development/testing**

```yaml
mode: visible
```

### Managed
- Cloudflare decides based on user behavior
- Shows challenge only if suspicious
- Adaptive approach
- **Use for high-security production**

```yaml
mode: managed
```

---

## Troubleshooting

### "Turnstile verification required"

**Cause**: Frontend didn't send token

**Solutions**:
1. Check `turnstile.enabled: true` in config
2. Check action is in `protectedActions: [verification]`
3. Verify `TURNSTILE_SECRET_KEY` is in `.env`
4. Restart dev server after config changes

### "CAPTCHA verification failed"

**Cause**: Domain not whitelisted

**Solutions**:
1. **For localhost**: Use test keys (`1x00000000000000000000AA`)
2. **For production**: Add domain in Cloudflare Dashboard
3. Check you're not mixing dev/prod keys

### Widget Not Rendering

**Check**:
1. `useTurnstileProtection('verification')` matches config action name
2. `siteKey` is set in `config/project.config.yaml`
3. `enabled: true` in config
4. Browser console for errors

### Token Verification Failing

**Check**:
1. Secret key matches site key (dev vs prod)
2. Domain whitelisted in Cloudflare
3. Token not expired (tokens expire after ~5 minutes)
4. Network connectivity to Cloudflare API

---

## Security Best Practices

### ✅ DO

- Use test keys for local development
- Use invisible mode for production
- Only protect high-value endpoints
- Rotate secret keys periodically
- Monitor analytics in Cloudflare Dashboard
- Keep secret keys in `.env` (never commit!)

### ❌ DON'T

- Use production keys on localhost
- Commit secret keys to Git
- Mix dev and production keys
- Protect every endpoint (causes UX issues)
- Hardcode keys in code
- Share secret keys publicly

---

## Configuration Reference

### Config File (`project.config.yaml`)

```yaml
turnstile:
  enabled: true                    # Enable/disable protection
  siteKey: "1x00...AA"            # Public site key
  mode: invisible                  # invisible | visible | managed
  protectedActions:                # Endpoints requiring Turnstile
    - verification                 # ✅ Implemented
```

### Environment File (`.env`)

```bash
# NEVER commit this file!
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Frontend Hook

```typescript
const requiresTurnstile = useTurnstileProtection('verification');
```

### Backend Verification

```typescript
const error = await requireTurnstile('verification', token);
if (error) return error; // 403
```

---

## Quick Setup Checklist

### Local Development
- [ ] Set `siteKey: "1x00000000000000000000AA"` in config
- [ ] Set `TURNSTILE_SECRET_KEY=1x0000...AA` in .env
- [ ] Set `enabled: true` in config
- [ ] Restart dev server
- [ ] Test verification flow

### Production Deployment
- [ ] Get real keys from Cloudflare Dashboard
- [ ] Set production `siteKey` in config
- [ ] Set production `TURNSTILE_SECRET_KEY` in CI/CD secrets
- [ ] Add production domain to Cloudflare whitelist
- [ ] Test on staging environment first
- [ ] Monitor Cloudflare analytics after launch

---

## Support

**Cloudflare Turnstile Documentation:**
- [Official Docs](https://developers.cloudflare.com/turnstile/)
- [Testing Guide](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)

**AtlasP2P Documentation:**
- [Main Config Docs](./config/CONFIGURATION.md)
- [Security Implementation](../apps/web/src/lib/feature-flags.server.ts)
