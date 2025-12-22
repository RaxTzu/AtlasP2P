# Helper Scripts

This directory contains utility scripts for setup and testing.

## 📜 Scripts

### `setup-supabase-storage.sql`

**Purpose**: Create Supabase Storage bucket for avatars with proper RLS policies

**Usage**:
```bash
# In Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of this file
# 3. Paste and run
```

**What it creates**:
- `node-avatars` storage bucket (public, 2MB limit)
- 3 RLS policies:
  - Public read access
  - Authenticated uploads
  - Owner deletion

**When to run**: After creating Supabase project, before starting development

---

### `test-connection.js`

**Purpose**: Test Supabase Cloud connection and configuration

**Usage**:
```bash
# From project root:
node scripts/test-connection.js
```

**Prerequisites**:
- `.env.local` configured with Supabase credentials
- Node.js installed

**What it tests**:
1. REST API health check
2. Database tables existence
3. Storage bucket configuration

**When to run**: After configuring `.env.local`, before starting development

---

## 🚀 Quick Setup Flow

```bash
# 1. Create Supabase project
supabase projects create my-nodes

# 2. Configure environment
make setup-cloud
nano .env.local  # Add Supabase credentials

# 3. Run migrations
supabase link && supabase db push

# 4. Create storage bucket
# Copy scripts/setup-supabase-storage.sql
# Paste in Supabase Dashboard → SQL Editor → Run

# 5. Test connection
node scripts/test-connection.js

# 6. Start development
make cloud-dev
```

---

## 📚 Related Documentation

- **[QUICKSTART.md](../docs/QUICKSTART.md)** - Complete setup guide
- **[SUPABASE_QUICKSTART.md](../docs/SUPABASE_QUICKSTART.md)** - Detailed Supabase setup
- **[DEPLOYMENT_SCENARIOS.md](../docs/DEPLOYMENT_SCENARIOS.md)** - All deployment options

---

## 🔧 Troubleshooting

### "Connection failed"

```bash
# Check .env.local exists and has correct values
cat .env.local | grep SUPABASE

# Verify Supabase project is running
# Dashboard → Project Status
```

### "Bucket not found"

```bash
# Run the SQL script again
# Dashboard → SQL Editor → Paste scripts/setup-supabase-storage.sql
```

### "Table not found"

```bash
# Run migrations
supabase link && supabase db push
```
