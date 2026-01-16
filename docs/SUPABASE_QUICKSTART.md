---
layout: default
title: Supabase Setup - AtlasP2P
---

# Supabase Cloud Setup - Complete Guide

## Step 1: Get Your Supabase Project Info

### A. Find Your Project Details

1. Go to: https://supabase.com/dashboard
2. Select your project (or create new one)
3. Go to **Settings** → **API**

You'll see:
```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon/public key: eyJhbGc... (long JWT token)
service_role key: eyJhbGc... (SENSITIVE - never share!)
```

### B. Identify Your Project

Your service role key: `sb_secret_hjlpNGRoz7n0ybtJjhzReQ_PIGvmsQf`

**This tells us:**
- You already have a Supabase project created ✅
- The key format is valid
- ⚠️ **ROTATE THIS KEY IMMEDIATELY** (you shared it publicly!)

To find which project:
1. Go to https://supabase.com/dashboard
2. Check all projects
3. Settings → API → Compare service role keys
4. When you find it, **RESET THE KEY**

---

## Step 2: Set Up Database Schema

### A. Run Migrations

**Option 1: Using Supabase CLI (Recommended)**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
# Find PROJECT_REF in dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF

# Push migrations
supabase db push
```

**Option 2: Manual SQL Upload**

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
2. Click **SQL Editor**
3. Copy content from each migration file:
   - `supabase/migrations/0001_foundation.sql`
   - `supabase/migrations/0002_schema.sql`
   - `supabase/migrations/0003_functions.sql`
   - `supabase/migrations/0004_policies.sql`
4. Paste and run each one in order

---

## Step 3: Create Storage Bucket for Avatars

### A. Create Bucket

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/storage
2. Click **"New bucket"**
3. Settings:
   ```
   Name: node-avatars
   Public bucket: ✅ YES
   File size limit: 2 MB
   Allowed MIME types: image/jpeg, image/png, image/webp
   ```
4. Click **"Create bucket"**

### B. Configure Storage Policies

1. Click on `node-avatars` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"**

**Policy 1: Public Read**

```sql
-- Name: Public avatar access
-- Operation: SELECT

CREATE POLICY "Public avatar access"
ON storage.objects FOR SELECT
USING (bucket_id = 'node-avatars');
```

**Policy 2: Authenticated Upload**

```sql
-- Name: Authenticated uploads
-- Operation: INSERT

CREATE POLICY "Authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'node-avatars'
  AND auth.role() = 'authenticated'
);
```

**Policy 3: Owner Delete**

```sql
-- Name: Owner can delete
-- Operation: DELETE

CREATE POLICY "Owner can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'node-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## Step 4: Configure Your Application

### A. Create `.env` File

**⚠️ NEVER commit this file to git!**

```bash
# Copy example
cp .env.example .env

# Edit .env
nano .env
```

### B. Add Your Supabase Credentials

```bash
# ===========================================
# SUPABASE CLOUD CONFIGURATION
# ===========================================

# Your Project URL (from Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co

# Your anon/public key (from Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...YOUR_ANON_KEY_HERE

# Your service role key (from Supabase Dashboard → Settings → API)
# ⚠️ KEEP SECRET - Server-side only, never expose to client
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...YOUR_NEW_SERVICE_ROLE_KEY

# GeoIP (optional - get free account at maxmind.com)
MAXMIND_ACCOUNT_ID=your_account_id
MAXMIND_LICENSE_KEY=your_license_key
```

### C. Security Checklist

- [ ] `.env` file is in `.gitignore` (already done)
- [ ] Never share service role key
- [ ] Rotate service role key after any leak
- [ ] Use anon key for client-side code only
- [ ] Use service role key for server-side only

---

## Step 5: Test the Setup

### A. Verify Database Connection

```bash
# Start development
make dev

# Check logs for Supabase connection
docker logs atlasp2p-web | grep -i supabase
```

### B. Test API Connection

```bash
# Test stats endpoint (should return network stats)
curl http://localhost:4000/api/stats

# Expected: JSON with node counts, countries, etc.
```

### C. Test Storage Upload

1. Start the app: http://localhost:4000
2. Sign up / Log in
3. Add a node verification
4. Try uploading avatar
5. Check Supabase Dashboard → Storage → node-avatars
   - Should see uploaded file

---

## Step 6: Production Deployment

### A. Update Production Environment

**On your production server:**

```bash
# SSH to server
ssh user@your-server.com

# Create production .env
cd /opt/atlasp2p
nano .env
```

**Add:**
```bash
# Production URLs (same as development)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Production domain
DOMAIN=nodes.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Cloudflare Turnstile (optional - for bot protection)
# Get real key at: https://dash.cloudflare.com/?to=/:account/turnstile
TURNSTILE_SECRET_KEY=YOUR_REAL_SECRET_KEY_HERE

# Production SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key
```

### B. Deploy

```bash
# Pull latest code
git pull origin main

# Start production (cloud Supabase + Docker app)
make prod-cloud

# Check logs
make prod-logs
```

---

## Troubleshooting

### Issue: "Failed to connect to Supabase"

**Check:**
```bash
# 1. Verify URL format
echo $NEXT_PUBLIC_SUPABASE_URL
# Should be: https://xxxxx.supabase.co (NOT http://localhost:4020)

# 2. Test connection
curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/ \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# Should return: {"message":"..."}

# 3. Check if project is paused
# Go to Supabase Dashboard → check project status
```

### Issue: "Storage upload failed"

**Check:**
```bash
# 1. Bucket exists
# Dashboard → Storage → Should see "node-avatars"

# 2. Bucket is public
# Click node-avatars → Settings → Public: YES

# 3. Policies are created
# Click node-avatars → Policies → Should see 3 policies

# 4. Test direct upload
curl -X POST \
  "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/node-avatars/test.txt" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: text/plain" \
  --data "test"
```

### Issue: "RLS policy error"

**Check:**
```bash
# Verify user is authenticated
# Dashboard → Authentication → Users
# Should see registered users

# Check RLS is enabled
# Dashboard → Database → Tables → storage.objects
# RLS: Enabled
```

---

## Security Best Practices

### 1. Key Management

```bash
# ✅ DO:
- Store keys in .env (gitignored)
- Use environment variables in production
- Rotate keys after leaks
- Use different keys for dev/staging/prod

# ❌ DON'T:
- Commit keys to git
- Share keys in public channels
- Use production keys in development
- Hardcode keys in code
```

### 2. RLS Policies

```sql
-- ✅ Always enable RLS on all tables
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- ✅ Create specific policies
CREATE POLICY "Users can read own data"
ON your_table FOR SELECT
USING (auth.uid() = user_id);

-- ❌ Don't bypass RLS
-- This is dangerous:
CREATE POLICY "Allow all"
ON your_table FOR ALL
USING (true);  -- BAD!
```

### 3. Monitoring

```bash
# Set up Supabase alerts
# Dashboard → Settings → Alerts
# Enable:
- [ ] High error rate
- [ ] Unusual activity
- [ ] Storage quota
- [ ] Database size
```

---

## Quick Reference

### Environment Variables Summary

| Variable | Where to Find | Used By |
|----------|---------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Settings → API | Client (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Settings → API | Server only (SENSITIVE) |

### Common Commands

```bash
# Development
make dev

# Production (cloud Supabase + Docker app)
make prod-cloud

# Check logs
make logs           # All logs
make logs-web       # Web app only
make logs-crawler   # Crawler only

# Restart services
make restart

# Database backup (Supabase CLI)
supabase db dump -f backup.sql
```

---

## Need Help?

- 📖 **Supabase Docs**: https://supabase.com/docs
- 💬 **Discord**: https://discord.supabase.com
- 🐛 **GitHub Issues**: https://github.com/RaxTzu/AtlasP2P/issues
- 📧 **Email**: Check your project's support channels

---

## Next Steps

1. ✅ Rotate your leaked service role key
2. ✅ Set up `.env` with correct credentials
3. ✅ Create `node-avatars` storage bucket
4. ✅ Configure RLS policies
5. ✅ Test avatar upload
6. ✅ Deploy to production

**You're production-ready!** 🚀
