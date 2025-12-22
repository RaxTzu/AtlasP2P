# Supabase Storage Setup (Production)

## Overview

AtlasP2P supports **two avatar storage modes**:

| Mode | When to Use | Avatar Storage |
|------|-------------|----------------|
| **Self-Hosted** | Small deployments, full control | Docker volume (local files) |
| **Cloud Supabase** | Medium-large deployments, CDN delivery | Supabase Storage (managed CDN) |

---

## Option 1: Self-Hosted (Docker Compose)

### Configuration

**docker-compose.yml** already includes avatar persistence:

```yaml
web:
  volumes:
    - avatar-storage:/app/public/avatars  # Persists avatars across restarts
```

### How It Works

1. User uploads avatar
2. Saved to `/app/public/avatars/` in container
3. Docker volume persists data across restarts
4. Served via Next.js at `/avatars/{filename}`

### Pros/Cons

✅ **Pros:**
- No external dependencies
- Full control over files
- Works offline

❌ **Cons:**
- No CDN (slower for global users)
- Manual backups required
- Scales with server disk

---

## Option 2: Cloud Supabase (Recommended for Production)

### Prerequisites

- Supabase account: https://supabase.com
- Project created in Supabase Dashboard

### Step 1: Create Storage Bucket

1. Go to Supabase Dashboard → **Storage**
2. Click **New Bucket**
3. Settings:
   - **Name**: `node-avatars`
   - **Public bucket**: ✅ **YES** (required for public avatar access)
   - **File size limit**: 2MB
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

### Step 2: Configure Row Level Security (RLS)

Navigate to **Storage** → **Policies** → `node-avatars` bucket:

#### Policy 1: Public Read Access

```sql
-- Allow anyone to view avatars
CREATE POLICY "Public avatar access"
ON storage.objects FOR SELECT
USING (bucket_id = 'node-avatars');
```

#### Policy 2: Authenticated Upload (Owner Only)

```sql
-- Allow authenticated users to upload avatars
-- (additional ownership check happens in API route)
CREATE POLICY "Authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'node-avatars'
  AND auth.role() = 'authenticated'
);
```

#### Policy 3: Owner Delete

```sql
-- Allow users to delete their own avatars
CREATE POLICY "Owner can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'node-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 3: Update Environment Variables

**Production .env:**

```bash
# Supabase Cloud Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

**Get these values from:**
- Supabase Dashboard → Settings → API

### Step 4: Test Upload

```bash
# Start production containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check logs for Supabase Storage connection
docker logs atlasp2p-web | grep -i storage

# Test upload via API
curl -X POST https://your-domain.com/api/profiles/NODE_ID/avatar \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@test-avatar.png"

# Expected response:
{
  "url": "https://your-project.supabase.co/storage/v1/object/public/node-avatars/avatars/123-1234567890.png",
  "storage": "supabase"
}
```

### Step 5: Verify CDN Delivery

1. Upload avatar via web UI
2. Check returned URL starts with: `https://*.supabase.co/storage/`
3. Open URL in browser (should load instantly)
4. Check response headers: `x-cache: HIT` (CDN served)

---

## How Auto-Detection Works

**Code:** `apps/web/src/app/api/profiles/[id]/avatar/route.ts`

```typescript
// Try Supabase Storage first
const { data, error } = await supabase.storage
  .from('node-avatars')
  .upload(`avatars/${fileName}`, file)

if (!error) {
  return { url: publicUrl, storage: 'supabase' }
}

// Fallback to local storage if Supabase fails
console.log('Supabase Storage not available, using local storage')
const publicDir = path.join(process.cwd(), 'public', 'avatars')
await writeFile(filePath, buffer)
return { url: `/avatars/${fileName}`, storage: 'local' }
```

**Decision logic:**
1. **If** `NEXT_PUBLIC_SUPABASE_URL` points to cloud → Use Supabase Storage
2. **Else** (local docker URL) → Use local file storage

---

## Migration Guide

### From Local to Cloud Supabase

**1. Export existing avatars:**

```bash
# Copy avatars from Docker volume
docker run --rm -v avatar-storage:/data -v $(pwd):/backup alpine \
  tar czf /backup/avatars-backup.tar.gz /data

# Extract
tar xzf avatars-backup.tar.gz
```

**2. Upload to Supabase Storage:**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-id

# Upload files
for file in data/*; do
  filename=$(basename "$file")
  supabase storage upload node-avatars/avatars/$filename $file
done
```

**3. Update database URLs:**

```sql
-- Update all avatar URLs from local to Supabase
UPDATE node_profiles
SET avatar_url = 'https://your-project.supabase.co/storage/v1/object/public/node-avatars' || avatar_url
WHERE avatar_url LIKE '/avatars/%';
```

**4. Switch environment:**

```bash
# Update .env to use cloud Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# ... other Supabase keys

# Restart containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart web
```

---

## Monitoring & Maintenance

### Check Storage Usage

```bash
# Supabase Dashboard → Storage → node-avatars
# Shows: Files count, Total size, Bandwidth usage
```

### Cleanup Orphaned Files

```sql
-- Find avatars not referenced by any profile
SELECT * FROM storage.objects
WHERE bucket_id = 'node-avatars'
AND name NOT IN (
  SELECT SUBSTRING(avatar_url FROM 'avatars/(.+)$')
  FROM node_profiles
  WHERE avatar_url LIKE '%/avatars/%'
);
```

### Storage Limits

**Supabase Free Tier:**
- 1GB storage
- 2GB bandwidth/month

**Supabase Pro ($25/month):**
- 100GB storage
- 200GB bandwidth/month

---

## Troubleshooting

### Issue: "Failed to upload avatar"

**Check 1: Bucket exists**
```bash
# Supabase Dashboard → Storage
# Ensure "node-avatars" bucket is created and public
```

**Check 2: RLS policies applied**
```sql
-- Check policies exist
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

**Check 3: Environment variables**
```bash
docker exec atlasp2p-web env | grep SUPABASE_URL
# Should show: https://your-project.supabase.co (not localhost)
```

### Issue: "Avatar not displaying"

**Check CORS settings:**
```bash
# Supabase Dashboard → Storage → Configuration
# Allowed origins: https://your-domain.com
```

**Check bucket is public:**
```bash
# Supabase Dashboard → Storage → node-avatars
# Public bucket: YES
```

### Issue: "Slow avatar loading"

- ✅ Using Supabase Cloud? (CDN enabled automatically)
- ✅ Check CDN headers: `x-cache: HIT`
- ✅ Enable browser caching: `Cache-Control: public, max-age=3600`

---

## Best Practices

1. **Always use Cloud Supabase for production** (better performance, CDN, managed)
2. **Set file size limits** in code (2MB max)
3. **Validate MIME types** before upload
4. **Clean up orphaned files** monthly
5. **Monitor storage usage** to avoid quota limits
6. **Use WebP format** for smaller file sizes (auto-convert in future)

---

## Summary

| Deployment Mode | Avatar Storage | Setup Required |
|----------------|----------------|----------------|
| **Development** | Local folder | ✅ Auto-created |
| **Self-Hosted Docker** | Docker volume | ✅ Pre-configured |
| **Cloud Supabase** | Supabase Storage | ⚠️ Follow this guide |

**For production**: Use **Cloud Supabase** for best performance and scalability.
