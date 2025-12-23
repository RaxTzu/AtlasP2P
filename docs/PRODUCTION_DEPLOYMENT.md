# Production Deployment Guide

## Overview

This project is **production-ready** with the following infrastructure:

### ✅ Existing Production Features

1. **CI/CD Workflows** (`.github/workflows/`)
   - ✅ Automated testing on PRs (lint, typecheck, build)
   - ✅ Docker image builds for web app and crawler
   - ✅ Deployment to production via SSH
   - ✅ Health check after deployment

2. **Docker Infrastructure**
   - ✅ Multi-service docker-compose setup
   - ✅ Development environment (docker-compose.dev.yml)
   - ✅ Production environment (docker-compose.prod.yml)
   - ✅ Smart GeoIP auto-download on crawler startup

3. **Services Included in Docker Compose**
   - ✅ **Web App** (Next.js with API routes) - Port 4000
   - ✅ **Crawler** (Python P2P network scanner)
   - ✅ **PostgreSQL** (Database) - Port 4021
   - ✅ **Supabase Auth** (Authentication service)
   - ✅ **PostgREST** (Auto-generated REST API)
   - ✅ **Kong** (API Gateway) - Port 4020
   - ✅ **Inbucket** (Email testing in development)

## Production Deployment Options

### Option 1: GitHub Actions (Current Setup)

**Registry:** GitHub Container Registry (GHCR)

**Workflow:** `.github/workflows/deploy.yml`

1. **On push to main:**
   - Builds web and crawler Docker images
   - Pushes to `ghcr.io/<your-org>/<repo>-web:latest`
   - Pushes to `ghcr.io/<your-org>/<repo>-crawler:latest`
   - SSH deploys to production server
   - Runs health check

2. **Required Secrets:**
   ```bash
   # GitHub Settings → Secrets → Actions
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   DEPLOY_HOST          # Production server IP/domain
   DEPLOY_USER          # SSH username
   DEPLOY_KEY           # SSH private key
   DEPLOY_PATH          # Path to docker-compose.yml on server
   HEALTH_CHECK_URL     # https://your-domain.com
   ```

3. **Server Setup:**
   ```bash
   # On production server
   mkdir -p /opt/atlasp2p
   cd /opt/atlasp2p

   # Copy docker-compose.yml and docker-compose.prod.yml
   # Create .env file with production credentials

   # Login to GHCR
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

   # Pull and start
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Option 2: AWS ECR + ECS (Like Dingocoin-Ecosystem)

**Registry:** AWS Elastic Container Registry (ECR)

**Advantages:**
- Automatic scaling with ECS/Fargate
- Integrated with AWS services (RDS, Parameter Store, CloudWatch)
- Better for high-traffic production

**Implementation:**

1. **Create ECR Repositories:**
   ```bash
   aws ecr create-repository --repository-name atlasp2p-web
   aws ecr create-repository --repository-name atlasp2p-crawler
   ```

2. **Store Secrets in AWS SSM:**
   ```bash
   aws ssm put-parameter \
     --name /atlasp2p/env \
     --type SecureString \
     --value "$(cat .env.production)"
   ```

3. **Modify Workflow:**
   - Replace `docker/login-action` with `aws-actions/amazon-ecr-login`
   - Change registry from `ghcr.io` to `<account-id>.dkr.ecr.<region>.amazonaws.com`
   - Add AWS credentials to GitHub secrets

## Docker Services Breakdown

### Core Services (Always Running)

1. **PostgreSQL** (`atlasp2p-db`)
   - Database for nodes, snapshots, profiles
   - Port: 4021 (development), internal in production
   - Volume: `postgres-data` (persistent)

2. **Supabase Auth** (`atlasp2p-auth`)
   - User authentication and JWT management
   - Integrated with PostgreSQL

3. **PostgREST** (`atlasp2p-rest`)
   - Auto-generated REST API from PostgreSQL schema
   - Row Level Security (RLS) enforcement

4. **Kong** (`atlasp2p-kong`)
   - API Gateway for routing and rate limiting
   - Port: 4020 (exposed to host)

### Application Services

5. **Web App** (`atlasp2p-web`)
   - Next.js 16 with App Router
   - API routes for verification, profiles, tipping
   - Port: 4000 (development), 443 with Caddy (production)
   - Dockerfile: `docker/Dockerfile.web`

6. **Crawler** (`atlasp2p-crawler`)
   - Python P2P network scanner
   - Auto-downloads GeoIP databases on startup
   - Runs every 1-5 minutes (configurable)
   - Dockerfile: `Dockerfile.crawler`
   - Volume: `geoip-data` (persistent)

### Development Only

7. **Inbucket** (`atlasp2p-inbucket`)
   - Email testing (not needed in production)
   - Port: 4023 (web UI)

8. **Supabase Studio** (`atlasp2p-studio`)
   - Database admin UI (optional in production)
   - Port: 4022

## Production Environment Variables

### Required for Web App

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Custom domain
DOMAIN=nodes.dingocoin.com
ACME_EMAIL=admin@dingocoin.com
```

### Required for Crawler

```bash
# Supabase (same as web app)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GeoIP (auto-downloads if credentials provided)
MAXMIND_ACCOUNT_ID=your-account-id
MAXMIND_LICENSE_KEY=your-license-key

# Crawler settings (optional, has defaults)
CRAWLER_INTERVAL_MINUTES=5
MAX_CONCURRENT_CONNECTIONS=100
CONNECTION_TIMEOUT_SECONDS=10
```

## Deployment Mode Decision

### Self-Hosted vs Cloud Supabase

| Factor | Self-Hosted Docker | Cloud Supabase |
|--------|-------------------|----------------|
| **Best for** | Small networks (<1K nodes) | Medium-large networks |
| **Complexity** | Low (one docker-compose) | Medium (external service) |
| **Cost** | $12-24/month (VPS only) | $25-50/month (VPS + Supabase Pro) |
| **Avatar Storage** | Docker volume (local files) | Supabase Storage (CDN) |
| **Scalability** | Limited to server | Auto-scaling |
| **Backups** | Manual | Automated (Supabase) |
| **CDN** | None (slower globally) | Built-in (faster) |

**Recommendation:**
- 🏢 **Self-Hosted**: Test deployments, small communities, cost-sensitive
- ☁️ **Cloud Supabase**: Production, global audience, high traffic

### Avatar Storage Setup

See **[SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md)** for complete guide on:
- Self-hosted Docker volumes (automatic)
- Cloud Supabase Storage bucket creation
- RLS policies configuration
- Migration between modes

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] **Choose deployment mode** (self-hosted vs cloud Supabase)
- [ ] Review `BEST_PRACTICES_REVIEW.md` for crawler improvements
- [ ] Review `CRAWLER_IMPROVEMENTS.md` for retry logic and protocol negotiation
- [ ] **If using Cloud Supabase:**
  - [ ] Create Supabase project
  - [ ] Run migrations: `supabase db push`
  - [ ] Configure RLS policies
  - [ ] **Set up Supabase Storage** (see SUPABASE_STORAGE_SETUP.md)
- [ ] Set up MaxMind account for GeoIP (free tier available)
- [ ] Configure GitHub secrets or AWS credentials
- [ ] Set up production server (VPS, EC2, etc.)

### Build Verification

```bash
# Verify TypeScript compilation
pnpm typecheck

# Verify linting
pnpm lint

# Verify production build
pnpm build

# Verify Docker builds
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### Deployment

1. **Push to main branch** (triggers automated deployment)
2. **Monitor GitHub Actions** for build success
3. **Verify health check** passes
4. **Check logs** on production server:
   ```bash
   docker logs atlasp2p-web
   docker logs atlasp2p-crawler
   ```

### Post-Deployment

- [ ] Verify web app accessible: `https://your-domain.com`
- [ ] Check API health: `curl https://your-domain.com/api/stats`
- [ ] Verify crawler is running: `docker logs atlasp2p-crawler | grep "CRAWL ITERATION"`
- [ ] Check GeoIP auto-download: `docker logs atlasp2p-crawler | grep "GeoIP"`
- [ ] Monitor database: `SELECT COUNT(*) FROM nodes;`
- [ ] Set up monitoring (Sentry, CloudWatch, etc.)

## Fork Customization

When forking for a new chain:

1. **Update chain config:**
   - `config/project.config.yaml` - All chain configuration
   - `apps/crawler/src/config.py` - P2P protocol settings

2. **Update branding:**
   - `config/project.config.yaml` - Colors, logos, and styling
   - Restart web container: `docker restart atlasp2p-web`

3. **GitHub Workflow Updates:**
   - Update registry and secrets in `.github/workflows/deploy.yml`

4. **Deploy:**
   ```bash
   git add .
   git commit -m "Customize for YourChain"
   git push origin main
   # GitHub Actions will automatically build and deploy
   ```

## Scaling Considerations

### Small Network (<1000 nodes)
- Single VPS (2 CPU, 4GB RAM)
- All services in docker-compose
- Database on same server

### Medium Network (1000-10000 nodes)
- Separate database server (PostgreSQL RDS/managed)
- Multiple crawler instances (horizontal scaling)
- CDN for static assets

### Large Network (>10000 nodes)
- Managed database (AWS RDS, Supabase)
- Kubernetes for auto-scaling
- Separate crawler cluster
- Redis for caching
- Load balancer

## Monitoring

### Essential Metrics

1. **Crawler Health:**
   - Nodes discovered per crawl
   - Success rate (nodes with version data)
   - Crawl duration
   - GeoIP database age

2. **Web App:**
   - Response times (p50, p95, p99)
   - Error rates (4xx, 5xx)
   - Active users
   - Database query performance

3. **Database:**
   - Connection pool usage
   - Query latency
   - Table sizes
   - Index usage

### Logging

```bash
# Web app logs
docker logs -f atlasp2p-web

# Crawler logs (with filters)
docker logs -f atlasp2p-crawler | grep -E "CRAWL|ERROR|Retry|Fallback"

# Database logs
docker logs -f atlasp2p-db

# API Gateway logs
docker logs -f atlasp2p-kong
```

## Troubleshooting

### Crawler not finding nodes

```bash
# Check DNS seeds resolve
docker exec atlasp2p-crawler dig seed1.yourchain.org

# Check protocol version matches chain
docker exec atlasp2p-crawler cat /app/config/project.config.yaml | grep protocolVersion
```

### GeoIP not loading

```bash
# Check if databases exist
docker exec atlasp2p-crawler ls -lh /app/data/geoip/

# Check credentials
docker exec atlasp2p-crawler env | grep MAXMIND

# Force re-download
docker exec atlasp2p-crawler rm -rf /app/data/geoip/*.mmdb
docker restart atlasp2p-crawler
```

### Web app not connecting to database

```bash
# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your-anon-key"

# Check environment variables
docker exec atlasp2p-web env | grep SUPABASE
```

## Backup Strategy

### Database

```bash
# Manual backup
docker exec atlasp2p-db pg_dump -U supabase_admin postgres > backup.sql

# Automated (add to crontab)
0 2 * * * docker exec atlasp2p-db pg_dump -U supabase_admin postgres | gzip > /backups/nodes-$(date +\%Y\%m\%d).sql.gz
```

### GeoIP Databases

- Automatically re-downloaded if >7 days old
- Stored in Docker volume `geoip-data`
- Backup not critical (can re-download)

## Security Hardening

1. **Firewall Rules:**
   ```bash
   # Allow only necessary ports
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 22/tcp  # SSH (restrict to known IPs)
   ufw enable
   ```

2. **Database:**
   - Use strong `supabase_admin` password
   - Enable SSL connections
   - Regular security updates: `docker compose pull`

3. **Secrets Management:**
   - Never commit `.env` files
   - Use GitHub Secrets or AWS Parameter Store
   - Rotate service role keys regularly

4. **Rate Limiting:**
   - Kong API Gateway has built-in rate limiting
   - Adjust in `docker/kong.yml`

## Cost Estimates

### AWS Deployment (Example)

- **ECS Fargate** (web + crawler): $30-50/month
- **RDS PostgreSQL** (db.t3.small): $25/month
- **ECR Storage**: $1-5/month
- **Data Transfer**: $5-20/month
- **Total**: ~$60-100/month

### VPS Deployment (DigitalOcean, Linode)

- **2 CPU, 4GB RAM, 80GB SSD**: $12-24/month
- **All-in-one docker-compose**: Most cost-effective

### Supabase (Database + Auth)

- **Free tier**: Up to 500MB database, 2GB bandwidth
- **Pro tier**: $25/month, 8GB database
- Recommended for production

---

**Ready to Deploy?** Follow the checklist above and run:

```bash
# Final verification
make build
make typecheck
make lint

# Push to trigger deployment
git push origin main
```

GitHub Actions will handle the rest! 🚀
