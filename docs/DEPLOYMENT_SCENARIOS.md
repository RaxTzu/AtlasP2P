---
layout: default
title: Deployment Scenarios - AtlasP2P
---

# AtlasP2P - Complete Deployment Scenarios

## 🎯 All Possible Scenarios Explained

This document covers **EVERY** way you can deploy AtlasP2P, from development to production.

---

## 📊 Scenario Matrix

| Scenario | Supabase | Containers | Use Case | Cost |
|----------|----------|------------|----------|------|
| **Dev: Docker** | Local (Docker) | All services | Local development | $0 |
| **Dev: Cloud** | Supabase Cloud | Web + Crawler | Cloud development | $0-25/mo |
| **Dev: Bare** | Local (Docker) | None (pnpm dev) | Frontend dev only | $0 |
| **Prod: Docker** | Local (Docker) | All services | Self-hosted VPS | $15-25/mo |
| **Prod: Cloud** | Supabase Cloud | Web + Crawler | Hybrid cloud | $40-50/mo |
| **Prod: Serverless** | Supabase Cloud | None (Vercel) | Fully serverless | $50-100/mo |

---

## 🤖 Automated CI/CD

**AtlasP2P includes a complete CI/CD pipeline for automated production deployments.**

- Auto-detects infrastructure (Caddy, secrets management)
- Builds and deploys on push to master
- Health checks with automatic rollback
- Multiple secrets sources (AWS SSM, GitHub Secrets, manual)

**Setup:** Configure once in `config/project.config.yaml`, deploy forever.

**See:** [CI/CD Documentation](./CICD.md) for complete guide.

---

## 🔍 Detailed Scenarios

### Scenario 1: Dev - Local Docker (Default)

**Architecture:**
```
Docker Compose
├── PostgreSQL (5432 → ${DB_PORT:-4021})
├── Kong (8000 → ${KONG_PORT:-4020})
├── GoTrue (auth)
├── PostgREST (REST API)
├── Inbucket (email testing → ${INBUCKET_WEB_PORT:-4023})
├── Supabase Studio (admin → ${STUDIO_PORT:-4022})
├── Web App (Next.js → ${WEB_PORT:-4000})
└── Crawler (Python)
```

**Port Configuration:**
All exposed ports are configurable via `.env` for maximum flexibility:

```bash
# .env - Port Configuration
WEB_PORT=4000              # Web app
KONG_PORT=4020             # Supabase API Gateway
DB_PORT=4021               # PostgreSQL direct access
STUDIO_PORT=4022           # Supabase Studio UI
INBUCKET_WEB_PORT=4023     # Email testing UI
INBUCKET_SMTP_PORT=4024    # Email SMTP
```

**Why configurable ports?**
- Run multiple AtlasP2P instances (different chains)
- Avoid port conflicts with existing services
- Custom firewall rules
- Fork-friendly deployment

**Setup:**
```bash
make setup-docker
make docker-dev
```

**Environment (.env):**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:4020
SUPABASE_INTERNAL_URL=http://kong:8000  # Docker internal
```

**Migrations:** Auto-run from `/docker-entrypoint-initdb.d/`

**Storage:** Docker volume `avatar-storage`

**When to use:**
- First time trying AtlasP2P
- Full control over entire stack
- Offline development
- Testing database changes

---

### Scenario 2: Dev - Cloud Supabase

**Architecture:**
```
Supabase Cloud (managed)
  ↑
Docker Compose (local)
├── Web App (Next.js → 4000)
└── Crawler (Python)
```

**Setup:**
```bash
# 1. Create Supabase project
supabase projects create my-nodes

# 2. Setup locally
make setup-cloud
nano .env  # Add Supabase credentials

# 3. Run migrations
supabase link && supabase db push

# 4. Start
make cloud-dev
```

**Environment (.env):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_INTERNAL_URL=https://xxxxx.supabase.co  # Same URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Migrations:** `supabase db push` or SQL Editor

**Storage:** Supabase Storage with CDN

**When to use:**
- Want managed database
- Testing Supabase features
- Global CDN for avatars
- Preparing for production

**Cost:**
- Free tier: 500MB DB, 2GB bandwidth
- Pro: $25/mo (8GB DB, 250GB bandwidth)

---

### Scenario 3: Dev - Bare Metal (Frontend Only)

**Architecture:**
```
Docker Compose (background)
├── PostgreSQL
├── Kong
└── Auth services

Terminal (foreground)
└── pnpm dev (Next.js only)
```

**Setup:**
```bash
# 1. Start database services (in background)
make docker-dev  # Starts all services
# OR manually start only DB + Supabase services:
# docker compose -f docker-compose.yml up -d db kong auth rest meta

# 2. Run migrations
make migrate

# 3. Start Next.js in dev mode (foreground, hot reload)
pnpm --filter @atlasp2p/web dev
```

**When to use:**
- Frontend development only
- Don't need hot reload in Docker
- Faster iteration on UI
- Debugging Next.js server

---

### Scenario 4: Prod - Self-Hosted (Full Docker)

**Architecture:**
```
Internet
  ↓
Caddy (80/443) ← Auto-SSL
  ↓
Docker Compose
├── PostgreSQL (internal only)
├── Kong (internal only)
├── Auth services
├── Web App (internal only)
└── Crawler
```

**Setup (Manual):**
```bash
# On production server
git clone https://github.com/YourOrg/YourNodes.git
cd YourNodes

cp .env.docker.example .env
nano .env

# Required:
DOMAIN=nodes.dogecoin.com
ACME_EMAIL=admin@dogecoin.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-key

# Start (with Caddy)
make prod-docker

# OR start without container Caddy (if host Caddy installed)
make prod-docker-no-caddy
```

**Setup (Automated CI/CD):**
```bash
# Configure deployment in config/project.config.yaml
# See docs/CICD.md for complete guide
# Then just push to master - automatic deployment!
```

**Includes:**
- Auto-SSL via Caddy (Let's Encrypt)
- All services containerized
- Automatic backups (setup required)
- Persistent volumes

**Server Requirements:**
- 2 CPU, 4GB RAM minimum
- 50GB SSD
- Ubuntu 22.04 or similar
- Docker + Docker Compose

**Cost:**
- DigitalOcean: $24/mo (4GB RAM)
- Hetzner: $12/mo (4GB RAM)
- Linode: $24/mo (4GB RAM)

**When to use:**
- Full control required
- Small-medium network (<5K nodes)
- Cost-sensitive deployment
- Don't want external dependencies

---

### Scenario 5: Prod - Hybrid Cloud

**Architecture:**
```
Internet
  ↓
Caddy (80/443) ← Auto-SSL
  ↓
Docker Compose
├── Web App
└── Crawler
  ↓
Supabase Cloud (managed)
├── PostgreSQL
├── Auth
├── Storage
└── Realtime
```

**Setup (Manual):**
```bash
# 1. Create Supabase project
supabase projects create nodes-prod --org-id xxx --region us-east-1

# 2. On production server
git clone https://github.com/YourOrg/YourNodes.git
cd YourNodes

cp .env.cloud.example .env
nano .env

# Required:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DOMAIN=nodes.dogecoin.com
ACME_EMAIL=admin@dogecoin.com

# 3. Run migrations
supabase link --project-ref xxxxx
supabase db push

# 4. Create storage bucket (SQL Editor)
# See SUPABASE_QUICKSTART.md

# 5. Start (with Caddy)
make prod-cloud

# OR start without container Caddy
make prod-cloud-no-caddy
```

**Setup (Automated CI/CD):**
```bash
# Configure deployment in config/project.config.yaml
# Set mode: self-hosted-cloud
# See docs/CICD.md for complete guide
```

**Benefits:**
- Managed database (auto-backups, scaling)
- CDN-delivered avatars
- Less server resources needed
- Professional monitoring

**Server Requirements:**
- 1 CPU, 2GB RAM sufficient
- 20GB SSD
- Lower specs than full Docker

**Cost:**
- VPS: $12/mo (2GB RAM)
- Supabase Pro: $25/mo
- Total: ~$37/mo

**When to use:**
- Medium-large network (5K+ nodes)
- Global audience (CDN benefits)
- Want auto-scaling
- Professional deployment

---

### Scenario 6: Prod - Fully Serverless

**Architecture:**
```
Internet
  ↓
Vercel (Next.js + API routes)
  ↓
Supabase Cloud (database + auth + storage)
  ↑
VPS (crawler only)
```

**Setup:**
```bash
# 1. Create Supabase project (same as Scenario 5)

# 2. Deploy to Vercel
vercel deploy

# In Vercel dashboard → Environment Variables:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 3. Deploy crawler separately
# On small VPS:
docker run -d \
  -e SUPABASE_URL=https://xxxxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  -e CHAIN=dogecoin \
  ghcr.io/yourorg/nodes-crawler
```

**Benefits:**
- Auto-scaling web app
- Zero ops for frontend
- Global edge network
- Automatic SSL

**Cost:**
- Vercel Pro: $20/mo
- Supabase Pro: $25/mo
- Small VPS (crawler): $6/mo
- Total: ~$51/mo

**When to use:**
- Large network (10K+ nodes)
- Global audience
- Want zero-ops frontend
- Budget allows

---

## 🔄 Migration Paths

### Docker → Cloud

```bash
# 1. Export database
docker exec atlasp2p-db pg_dump -U postgres > backup.sql

# 2. Create Supabase project
supabase projects create nodes

# 3. Import
cat backup.sql | psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres"

# 4. Switch environment
cp .env.cloud.example .env
# Edit with credentials

# 5. Stop Docker, start cloud
make docker-down
make cloud-dev
```

### Cloud → Docker

```bash
# 1. Export from Supabase
supabase db dump > backup.sql

# 2. Switch environment
cp .env.docker.example .env

# 3. Start Docker
make docker-dev

# 4. Import (optional)
cat backup.sql | docker exec -i atlasp2p-db psql -U postgres
```

### Dev → Production

**Docker to Docker:**
```bash
# Same .env, different target
make docker-dev   # Development
make prod-docker  # Production (adds Caddy + SSL)
```

**Cloud to Cloud:**
```bash
# Same Supabase project, different target
make cloud-dev    # Development
make prod-cloud   # Production (adds Caddy + SSL)
```

---

## 🧪 Testing Scenarios

### Minimal Test (No Docker)

```bash
pnpm install
pnpm build
pnpm test
```

### Full Integration Test

```bash
make docker-dev
sleep 30  # Wait for services

# Test API
curl http://localhost:4000/api/stats

# Test database
docker exec atlasp2p-db psql -U postgres -c "SELECT COUNT(*) FROM nodes;"

# Test web
curl http://localhost:4000 | grep "Nodes Map"
```

---

## 📋 Decision Tree

**Choose your deployment:**

```
Start
  ↓
Is this for development?
├─ Yes → Do you want managed DB?
│  ├─ Yes → Scenario 2 (Cloud Dev)
│  └─ No  → Scenario 1 (Docker Dev)
│
└─ No (Production) → What's your budget?
   ├─ <$30/mo  → Scenario 4 (Self-Hosted)
   ├─ $30-50/mo → Scenario 5 (Hybrid Cloud)
   └─ >$50/mo  → Scenario 6 (Serverless)
```

---

## 🎯 Recommendations

### For Forks

**Start with:** Scenario 1 (Docker Dev)
- Easiest setup
- No external dependencies
- Learn the system

**Move to:** Scenario 2 (Cloud Dev)
- Test cloud features
- Prepare for production

**Deploy as:** Scenario 5 (Hybrid Cloud)
- Best balance of cost/features
- Scalable for growth

### For Contributors

**Use:** Scenario 3 (Bare Metal)
- Fastest iteration
- Frontend hot reload
- Easy debugging

### For Production

**Small networks (<1K nodes):** Scenario 4 (Self-Hosted)
**Medium networks (1-10K):** Scenario 5 (Hybrid Cloud)
**Large networks (>10K):** Scenario 6 (Serverless)

---

## ⚙️ Configuration Comparison

| Variable | Docker Dev | Cloud Dev | Prod Docker | Prod Cloud |
|----------|------------|-----------|-------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | localhost:4020 | *.supabase.co | localhost:4020 | *.supabase.co |
| `SUPABASE_INTERNAL_URL` | kong:8000 | *.supabase.co | kong:8000 | *.supabase.co |
| `DOMAIN` | - | - | Required | Required |
| `ACME_EMAIL` | - | - | Required | Required |
| `SMTP_HOST` | inbucket | SMTP server | SMTP server | SMTP server |
| `GOTRUE_MAILER_AUTOCONFIRM` | true | false | false | false |

---

## 🔧 Troubleshooting by Scenario

### Docker Dev: "Kong unhealthy"

```bash
make logs-auth   # Check auth/Kong logs
make restart     # Restart all services
```

### Cloud Dev: "Unauthorized"

```bash
# Check keys in .env
grep SUPABASE .env

# Test connection
curl https://xxxxx.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
```

### Prod: "SSL failed"

```bash
# Check DNS
dig nodes.yourchain.com

# Check Caddy logs
make prod-logs

# Verify ACME_EMAIL
grep ACME_EMAIL .env
```

---

**Choose your scenario and follow the guide!** Each has detailed instructions in the respective documentation files.
