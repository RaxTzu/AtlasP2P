# 🎉 AtlasP2P - Getting Started

Welcome to AtlasP2P! This guide covers everything you need to know to get up and running.

---

## ✅ What You Get

AtlasP2P is a **complete fork-ready** P2P network visualization platform that supports:

✅ **Three deployment modes** (Local Docker, Cloud Supabase, Production)
✅ **Complete documentation** (Setup, customization, deployment)
✅ **Professional architecture** (Docker, Makefile, proper folder structure)
✅ **Easy customization** (Replace branding, add your blockchain)
✅ **Production-ready** (SSL, monitoring, scaling guides)

---

## 🚀 Quick Start (5 Minutes)

### Option A: Local Docker (Recommended for First Time)

```bash
# 1. Setup
make setup-docker

# 2. Start everything
make docker-dev

# 3. Access
open http://localhost:4000
```

**Done!** Everything runs locally, no external dependencies.

**Note:** `make setup-docker` copies `project.config.yaml.example` → `project.config.yaml`. This file is gitignored for upstream development.

**Forking?** Use `make setup-fork` for guided setup, then commit your config with `git add -f config/project.config.yaml`

### Option B: Cloud Supabase (Production-Ready)

```bash
# 1. Create Supabase project
supabase projects create my-nodes

# 2. Setup
make setup-cloud
nano .env  # Add Supabase credentials

# 3. Run migrations
supabase link && supabase db push

# 4. Create storage (Dashboard → SQL Editor)
# Copy/paste: scripts/setup-supabase-storage.sql

# 5. Test connection
node scripts/test-connection.js

# 6. Start
make cloud-dev
```

---

## 📚 Documentation Guide

**New to AtlasP2P?** Read in this order:

1. **This file** (Getting Started) - You are here!
2. **[QUICKSTART.md](./QUICKSTART.md)** - Detailed setup for all deployment modes
3. **[FORKING.md](./FORKING.md)** - Customize for your blockchain
4. **[DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md)** - Understand all options
5. **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** - Go live checklist

**Quick reference**: [README.md](./README.md) - Documentation index

---

## 🎯 Three Deployment Paths

| Path | What | When to Use | Cost |
|------|------|-------------|------|
| 🐳 **Local Docker** | Full stack in containers | Development, testing | Free |
| ☁️ **Cloud Supabase** | Managed DB + app | Production dev | $0-25/mo |
| 🚀 **Production** | Self-hosted OR hybrid | Live deployment | $15-50/mo |

**Confused?** See [DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md) for decision tree.

---

## 📋 What's Included

### Project Structure

```
AtlasP2P/
├── apps/
│   ├── web/          # Next.js frontend
│   └── crawler/      # Python P2P crawler
├── docs/             # 📚 Complete documentation
├── scripts/          # 🔧 Helper scripts
│   ├── setup-supabase-storage.sql
│   └── test-connection.js
├── config/           # Chain configurations
├── supabase/         # Database migrations
├── Makefile          # All commands (make help)
└── docker-compose*.yml  # Multiple deployment modes
```

### Files You Created

```
✅ .env.docker.example    # Template for local Docker
✅ .env.cloud.example     # Template for Cloud Supabase
✅ docker-compose.cloud.yml  # Cloud deployment mode
✅ scripts/               # Helper scripts folder
✅ docs/                 # 6 comprehensive guides
```

---

## 🛠️ Common Commands

```bash
# Setup
make setup-docker     # Local Docker setup
make setup-cloud      # Cloud Supabase setup

# Development
make docker-dev       # Full stack locally
make cloud-dev        # Cloud database mode

# Production
make prod-docker      # Self-hosted
make prod-cloud       # Hybrid cloud

# Testing
node scripts/test-connection.js  # Test Supabase
make typecheck        # TypeScript check
make build            # Production build

# All commands
make help
```

---

## 🎨 Customization (For Forks)

### Step 1: Replace Branding

```bash
# Replace these files with your blockchain's branding:
apps/web/public/logos/
├── atlasp2p.jpg → yourchain.jpg
├── atlasp2p.svg → yourchain.svg
├── atlasp2p-og.png → yourchain-og.png
└── atlasp2p-*.{ico,svg,png} → yourchain-*
```

### Step 2: Update Config

```yaml
# config/project.config.yaml
projectName: DogecoinNodes
chain: dogecoin

themeConfig:
  name: Dogecoin Nodes
  logo: /logos/dogecoin.svg
  primaryColor: "#C2A633"
```

### Step 3: Add Chain

Edit `config/project.config.yaml`:

```yaml
chainConfig:
  name: Dogecoin
  ticker: DOGE
  p2pPort: 22556
  # ... rest of config
```

Restart web container: `docker restart atlasp2p-web`

**Full guide**: [FORKING.md](./FORKING.md)

---

## 🔄 Fork Workflow

```bash
# 1. Fork on GitHub
https://github.com/RaxTzu/AtlasP2P → Click Fork

# 2. Clone your fork
git clone https://github.com/YOU/DogecoinNodes.git

# 3. Customize (see above)

# 4. Deploy
make prod-cloud

# 5. Pull upstream updates later
git remote add upstream https://github.com/RaxTzu/AtlasP2P.git
git fetch upstream
git merge upstream/main
```

**Images won't conflict!** Git handles same-filename replacements gracefully.

---

## 🧪 Testing Your Setup

### Test 1: Type Check

```bash
pnpm typecheck
# Should pass with 0 errors
```

### Test 2: Build

```bash
pnpm build
# Should complete successfully
```

### Test 3: Connection (Cloud Mode)

```bash
node scripts/test-connection.js
# Tests: API, database, storage
```

### Test 4: Full Development

```bash
make docker-dev  # or make cloud-dev
curl http://localhost:4000/api/stats
# Should return JSON
```

---

## 📊 Architecture Overview

### Local Docker Mode

```
Browser → Web App (Docker)
            ↓
       Kong API Gateway (Docker)
            ↓
  ┌─────────┴─────────┐
  ↓                   ↓
Auth (Docker)    PostgREST (Docker)
  ↓                   ↓
     PostgreSQL (Docker)
```

**All in containers, zero external deps!**

### Cloud Supabase Mode

```
Browser → Web App (Docker)
            ↓
    Supabase Cloud
  ┌────────┴────────┐
  ↓                 ↓
Auth         Storage + DB
(Managed)      (Managed)
```

**DB managed, app containerized**

**Details**: [DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md#-detailed-scenarios)

---

## ⚙️ Environment Variables

### For Docker Mode (`.env.docker.example`)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:4020
SUPABASE_INTERNAL_URL=http://kong:8000
```

### For Cloud Mode (`.env.cloud.example`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Production**: Add `DOMAIN` and `ACME_EMAIL` for SSL

---

## 🆘 Troubleshooting

### "Port 4000 already in use"

```bash
lsof -ti :4000 | xargs kill -9
# Or change PORT in .env
```

### "Connection failed"

```bash
# Docker mode:
make docker-logs

# Cloud mode:
node scripts/test-connection.js
```

### "Migrations not running"

```bash
# Docker mode:
make migrate

# Cloud mode:
supabase link && supabase db push
```

### "Images not loading"

```bash
# Check avatar volume:
docker volume ls | grep avatar

# Verify .gitignore:
cat .gitignore | grep avatars
```

**Full troubleshooting**: [QUICKSTART.md#-troubleshooting](./QUICKSTART.md#-troubleshooting)

---

## 🎯 Next Steps

### For Immediate Development

```bash
# Start coding now:
make setup-docker
make docker-dev
```

### For Production Deployment

1. Read [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
2. Choose deployment mode
3. Configure domain + SSL
4. Deploy with `make prod-docker` or `make prod-cloud`

### For Customization

1. Read [FORKING.md](./FORKING.md)
2. Replace branding
3. Add your blockchain config
4. Test and deploy

---

## 📦 What Makes This Fork-Ready?

✅ **Works out-of-box** - Run `make docker-dev`, get a working app
✅ **Multiple deployment modes** - Choose what fits your needs
✅ **Complete documentation** - Every scenario covered
✅ **Professional structure** - scripts/, docs/, proper .gitignore
✅ **Easy customization** - Replace logos, update config, done
✅ **Upstream mergeable** - Pull updates without conflicts
✅ **Production-ready** - SSL, monitoring, scaling guides included

---

## 🤝 Getting Help

- **Quick issues**: [Troubleshooting section above](#-troubleshooting)
- **Setup questions**: [QUICKSTART.md](./QUICKSTART.md)
- **Customization**: [FORKING.md](./FORKING.md)
- **GitHub Issues**: https://github.com/RaxTzu/AtlasP2P/issues
- **Documentation**: [README.md](./README.md) - Full index

---

## ✨ You're Ready!

**Start development**:
```bash
make setup-docker && make docker-dev
```

**OR customize first**:
```bash
# Read: docs/FORKING.md
# Then: Replace branding, update config, deploy
```

**OR go straight to production**:
```bash
# Read: docs/PRODUCTION_DEPLOYMENT.md
# Then: make prod-cloud
```

---

**Choose your path and get started!** 🚀

For detailed guidance, see [QUICKSTART.md](./QUICKSTART.md)
