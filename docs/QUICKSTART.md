---
layout: default
title: Quick Start - AtlasP2P
---

# AtlasP2P - Quick Start Guide

## 🚀 Choose Your Deployment Path

AtlasP2P supports **three deployment architectures**. Choose the one that fits your needs:

### Path Comparison

| Path | Best For | Complexity | Monthly Cost |
|------|----------|------------|--------------|
| **🐳 Local Docker** | Testing, small networks | Low | $10-25 (VPS only) |
| **☁️ Cloud Supabase** | Production, global users | Medium | $35-50 (VPS + Supabase) |
| **🚀 Production** | Public deployment | Low-Medium | Varies |

---

## 🐳 Path A: Local Docker (Full Stack)

**What this includes:**
- PostgreSQL (database)
- Kong (API gateway)
- GoTrue (authentication)
- PostgREST (REST API)
- Next.js (web app)
- Python (crawler)

**All running in Docker containers on your machine.**

### Setup (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/YourOrg/AtlasP2P.git
cd AtlasP2P

# 2. Setup for Docker mode
make setup-docker

# 3. Start everything
make docker-dev

# 4. Access the app
open http://localhost:4000
```

**That's it!** Migrations run automatically. Everything works out-of-the-box.

### What You Get

- **Web App**: http://localhost:4000
- **Supabase Studio**: http://localhost:4022 (database admin)
- **Inbucket**: http://localhost:4023 (email testing)
- **PostgreSQL**: localhost:4021

### Next Steps

1. Create user account at http://localhost:4000
2. Wait for crawler to discover nodes (~5 minutes)
3. Verify a node to customize it
4. Enable tipping for your node

### Customizing for Your Blockchain

See [FORKING.md](./FORKING.md) to adapt this for your chain (Dogecoin, Litecoin, etc.)

---

## ☁️ Path B: Cloud Supabase (Managed DB)

**What this includes:**
- Supabase Cloud (managed database + auth + storage)
- Next.js (web app) - Docker or bare metal
- Python (crawler) - Docker or bare metal

**Database managed by Supabase, app runs on your server.**

### Prerequisites

1. **Supabase account**: https://supabase.com (free tier available)
2. **Supabase CLI**: `npm install -g supabase`

### Setup (10 minutes)

#### Step 1: Create Supabase Project

```bash
# Option A: CLI (recommended)
supabase projects create atlasp2p --org-id your-org-id

# Option B: Dashboard
# Go to https://supabase.com/dashboard
# Click "New Project"
# Name: atlasp2p
# Choose region close to your users
```

#### Step 2: Setup Local Project

```bash
# 1. Clone and setup
git clone https://github.com/YourOrg/AtlasP2P.git
cd AtlasP2P
make setup-cloud

# 2. Link to Supabase project
supabase login
supabase link --project-ref your-project-ref

# 3. Run migrations
supabase db push

# 4. Create storage bucket
# Dashboard → SQL Editor → Run:
```

```sql
-- Create avatar storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('node-avatars', 'node-avatars', true);

-- Create RLS policies
CREATE POLICY "Public read" ON storage.objects FOR SELECT
USING (bucket_id = 'node-avatars');

CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'node-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Owner delete" ON storage.objects FOR DELETE
USING (bucket_id = 'node-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

#### Step 3: Configure Environment

```bash
# Edit .env with your Supabase credentials
nano .env

# Get from: Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### Step 4: Start Development

```bash
# Start web app + crawler (no database containers)
make cloud-dev

# Access at http://localhost:4000
```

### What You Get

- **Web App**: http://localhost:4000
- **Supabase Dashboard**: https://supabase.com/dashboard (manage your project)
- **Database**: Managed by Supabase (auto-backups, scaling)
- **Storage**: CDN-delivered avatars

### Benefits of Cloud Mode

✅ Auto-scaling database
✅ Built-in backups
✅ CDN for avatars (faster globally)
✅ Less server resources needed
✅ Professional monitoring dashboard

---

## 🚀 Path C: Production Deployment

### Option 1: Self-Hosted (Full Docker)

**Use when:** You want full control, all services on your VPS

```bash
# 1. Setup on production server
git clone https://github.com/YourOrg/AtlasP2P.git
cd AtlasP2P

# 2. Copy and configure .env
cp .env.docker.example .env
nano .env

# Required:
DOMAIN=nodes.yourchain.com
ACME_EMAIL=admin@yourchain.com

# 3. Start production
make prod-docker

# 4. Access
open https://nodes.yourchain.com
```

**Includes:**
- Caddy (reverse proxy with auto-SSL)
- PostgreSQL, Kong, Auth
- Web app, Crawler

### Option 2: Hybrid (Cloud DB + Docker App)

**Use when:** You want managed DB but self-hosted app

```bash
# 1. Create Supabase project (see Path B)

# 2. Setup production
git clone https://github.com/YourOrg/AtlasP2P.git
cd AtlasP2P
cp .env.cloud.example .env
nano .env

# Add Supabase credentials + domain
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DOMAIN=nodes.yourchain.com
ACME_EMAIL=admin@yourchain.com

# 3. Run migrations
supabase link && supabase db push

# 4. Start production
make prod-cloud

# 5. Access
open https://nodes.yourchain.com
```

**Includes:**
- Caddy (reverse proxy with auto-SSL)
- Web app, Crawler
- Supabase Cloud (database, auth, storage)

---

## 📊 Comparison Matrix

| Feature | Local Docker | Cloud Supabase | Prod (Docker) | Prod (Cloud) |
|---------|-------------|----------------|---------------|--------------|
| **Setup Time** | 5 min | 10 min | 15 min | 20 min |
| **Migrations** | Auto | Manual (CLI) | Auto | Manual (CLI) |
| **Database** | Local container | Supabase | Local container | Supabase |
| **Storage** | Docker volume | Supabase CDN | Docker volume | Supabase CDN |
| **Backups** | Manual | Auto | Manual | Auto |
| **SSL/HTTPS** | No | No | Yes (Caddy) | Yes (Caddy) |
| **Email** | Inbucket | SMTP config | SMTP config | SMTP config |
| **Cost** | Free | $25/mo* | $15/mo VPS | $15 VPS + $25 Supabase |

*Supabase free tier: 500MB DB, 2GB bandwidth/month

---

## 🔄 Switching Between Modes

### From Docker → Cloud

```bash
# 1. Export data
docker exec atlasp2p-db pg_dump -U postgres > backup.sql

# 2. Create Supabase project and link
supabase link

# 3. Import data
cat backup.sql | psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres"

# 4. Switch environment
cp .env.cloud.example .env
# Edit with Supabase credentials

# 5. Restart
make cloud-dev
```

### From Cloud → Docker

```bash
# 1. Switch environment
cp .env.docker.example .env

# 2. Restart
make docker-dev
# Migrations auto-run, starts fresh
```

---

## 🆘 Troubleshooting

### "Database connection failed"

**Docker mode:**
```bash
# Check if PostgreSQL is running
make ps

# View logs
make logs-db
```

**Cloud mode:**
```bash
# Test connection
curl https://xxxxx.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Check credentials in .env
cat .env | grep SUPABASE
```

### "Port 4000 already in use"

```bash
# Kill process on port 4000
lsof -ti :4000 | xargs kill -9

# Or change port in .env
PORT=4011
```

### "Migrations not running"

**Docker mode:**
```bash
# Manually run migrations
make migrate
```

**Cloud mode:**
```bash
# Push migrations
supabase db push

# Or manually in dashboard
# SQL Editor → paste migration files
```

### "Crawler not finding nodes"

```bash
# Check crawler logs
make logs-crawler

# Verify chain config
cat config/project.config.yaml

# Check DNS seeds
dig seed1.yourchain.org
```

---

## 📚 Next Steps

- **Customize branding**: See [FORKING.md](./FORKING.md)
- **Add your chain**: [CHAIN_CONFIGURATION.md](./CHAIN_CONFIGURATION.md)
- **Production tips**: [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
- **Supabase setup**: [SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md)

---

## 🤝 Getting Help

- **GitHub Issues**: https://github.com/RaxTzu/AtlasP2P/issues
- **Documentation**: https://raxtzu.github.io/AtlasP2P/
- **Discord**: [Your Discord link]

---

**Ready to start?** Run `make help` to see all available commands.
