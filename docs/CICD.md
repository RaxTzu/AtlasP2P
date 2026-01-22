# CI/CD - Automated Production Deployment

Complete guide to AtlasP2P's automated CI/CD pipeline for production deployments.

---

## 🎯 Overview

AtlasP2P provides a **fully automated CI/CD workflow** that:
- Auto-detects your infrastructure (Caddy, secrets management)
- Builds Docker images with proper caching
- Deploys to your server via SSH
- Validates deployment health with automatic rollback
- Supports multiple deployment scenarios

**Key Features:**
- ✅ Config-driven (configure once, works forever)
- ✅ Auto-detection (minimal manual intervention)
- ✅ Safe deployments (backup → deploy → health check → rollback)
- ✅ Multiple secrets sources (AWS SSM, GitHub Secrets, manual)
- ✅ Flexible Caddy handling (container, host, none)

---

## 📋 Prerequisites

### 1. GitHub Repository Setup

Your fork should have:
```bash
.github/workflows/ci.yml                # CI checks (from upstream)
.github/workflows/deploy.yml            # Deployment workflow (copy from .example)
config/project.config.yaml              # Deployment config (customize for your chain)
```

**Setup deployment workflow:**

**Quick setup (recommended):**
```bash
make setup-deploy
# Follow the printed instructions
```

**Manual setup:**
```bash
# 1. Copy template
cp .github/workflows/deploy.yml.example .github/workflows/deploy.yml

# 2. Edit deploy.yml (change branch name, verify settings)
vim .github/workflows/deploy.yml

# 3. Remove from gitignore
sed -i '/.github\/workflows\/deploy.yml/d' .gitignore

# 4. Commit to your fork
git add .github/workflows/deploy.yml
git commit -m "Add deployment workflow for MyChain"
```

### 2. Server Requirements

**Minimum:**
- Ubuntu 22.04+ (or similar)
- Docker + Docker Compose v2
- SSH access with key-based auth
- 2 CPU, 4GB RAM, 50GB SSD

**Install Docker:**
```bash
# On your server
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 3. GitHub Configuration

#### **Required GitHub Variables** (Settings → Secrets and variables → Actions → Variables)

```bash
DEPLOY_USER=ubuntu              # SSH username
SSH_HOST=nodes.example.com      # Server IP or domain
DEPLOY_PATH=/opt/atlasp2p       # Deployment directory on server
```

#### **Required GitHub Secrets** (Settings → Secrets and variables → Actions → Secrets)

```bash
SSH_PRIVATE_KEY=<your-private-key>  # SSH key for server access
```

**Generate SSH key:**
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/atlasp2p_deploy
# Add public key to server: ssh-copy-id -i ~/.ssh/atlasp2p_deploy.pub user@server
# Copy private key to GitHub Secret: cat ~/.ssh/atlasp2p_deploy
```

---

## 🔧 Configuration

### Step 1: Configure Deployment Settings

Edit `config/project.config.yaml` (deployment section at the end):

```yaml
# ===========================================
# DEPLOYMENT CONFIGURATION
# ===========================================
deployment:
  # Choose deployment mode
  mode: self-hosted-docker  # or self-hosted-cloud

  caddy:
    enabled: true
    mode: auto  # auto-detects: container | host | none

  secrets:
    source: auto  # auto-detects: aws-ssm | github-secrets | manual
    ssmPath: /atlasp2p/prod/env  # Only if using AWS SSM

  healthCheck:
    enabled: true
    endpoint: /api/stats
    timeout: 30
    retries: 3

  backup:
    enabled: true  # DB backup before deploy (self-hosted only)
    retention: 7

  rollback:
    enabled: true
    onHealthCheckFail: true
```

**Commit this configuration:**
```bash
git add config/project.config.yaml
git commit -m "Configure production deployment"
git push
```

---

## 🔐 Secrets Management Options

AtlasP2P supports **three secrets management methods**:

### Option 1: AWS Parameter Store (Recommended for teams)

**Setup:**
1. Store entire .env file as single SecureString parameter in AWS SSM
2. Configure GitHub secrets:
   ```bash
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```
3. Configure GitHub variables:
   ```bash
   AWS_REGION=us-east-1
   ```
4. Update `project.config.yaml`:
   ```yaml
   secrets:
     source: aws-ssm
     ssmPath: /atlasp2p/prod/env
   ```

**Upload secrets to SSM:**
```bash
# Create .env file with all secrets
aws ssm put-parameter \
  --name "/atlasp2p/prod/env" \
  --type "SecureString" \
  --value "$(cat .env)" \
  --region us-east-1
```

### Option 2: GitHub Secrets (Easiest for solo developers)

**Setup:**
Add ALL environment variables as GitHub Secrets:
```bash
DOMAIN=nodes.example.com
ACME_EMAIL=admin@example.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TURNSTILE_SECRET_KEY=...  # Cloudflare Turnstile (if enabled)
NEXT_PUBLIC_POSTHOG_KEY=...  # PostHog analytics (optional)
NEXT_PUBLIC_POSTHOG_HOST=...  # e.g., https://eu.i.posthog.com
POSTGRES_PASSWORD=...
JWT_SECRET=...
SMTP_HOST=...
SMTP_PASS=...
CHAIN_RPC_PASSWORD=...
ADMIN_EMAILS=...
```

**Configure:**
```yaml
secrets:
  source: github-secrets
```

### Option 3: Manual .env (For testing)

**Setup:**
1. Create `.env` file directly on server at `DEPLOY_PATH`
2. Workflow will skip secrets management
3. Configure:
   ```yaml
   secrets:
     source: manual
   ```

**On server:**
```bash
cd /opt/atlasp2p
nano .env  # Add all secrets manually
```

---

## 🐳 Docker Registry Configuration

AtlasP2P supports **two Docker registry options** for production deployments:

### Option 1: GitHub Container Registry (GHCR) - Recommended

**Pros:**
- ✅ **Free unlimited public images** (no storage costs)
- ✅ **Integrated with GitHub** (automatic auth in CI/CD)
- ✅ **No additional setup** (works out of the box)
- ✅ **Public images** (no auth needed on host server)

**Best for:** Open-source forks, solo developers, small teams

**Configuration:**
```yaml
# config/project.config.yaml
deployment:
  registry:
    type: ghcr
    public: true  # No auth needed on host (recommended)
```

**Image naming:**
```
ghcr.io/your-org/atlasp2p-web:latest
ghcr.io/your-org/atlasp2p-crawler:latest
```

**How it works:**
1. Workflow builds and pushes images to `ghcr.io/your-org/`
2. On deployment, host pulls images without authentication (if public)
3. Fallback to GitHub token if public pull fails

### Option 2: AWS Elastic Container Registry (ECR)

**Pros:**
- ✅ **Private images** (better security for enterprise)
- ✅ **AWS integration** (IAM roles, VPC endpoints)
- ✅ **Host AWS CLI support** (uses server's credentials)
- ✅ **Regional deployment** (lower latency)

**Best for:** Enterprise deployments, teams using AWS infrastructure

**Configuration:**
```yaml
# config/project.config.yaml
deployment:
  registry:
    type: ecr
    region: us-east-1  # Your AWS region
    # public: ignored (ECR images are always private)
```

**Required GitHub Secrets (for CI/CD):**
```bash
AWS_ACCESS_KEY_ID=AKIA...       # IAM user with ECR push permissions
AWS_SECRET_ACCESS_KEY=...       # Secret access key
```

**Required GitHub Variables:**
```bash
AWS_REGION=us-east-1            # ECR region
```

**Image naming:**
```
123456789.dkr.ecr.us-east-1.amazonaws.com/atlasp2p/web:latest
123456789.dkr.ecr.us-east-1.amazonaws.com/atlasp2p/crawler:latest
```

**How it works:**
1. Workflow builds and pushes images to ECR using workflow credentials
2. On deployment, host attempts authentication:
   - **First**: Try host AWS CLI (if configured) ✅ Recommended
   - **Fallback**: Use AWS credentials from .env (if available)
3. Host pulls images after authentication

### Smart Host Authentication

The workflow automatically handles authentication on your server:

#### **For GHCR:**
```bash
# If public: true (default)
→ Attempt pull without authentication
  ↓ Success → Done!
  ↓ Failed → Use GitHub token from workflow

# If public: false
→ Always use GitHub token
```

#### **For ECR:**
```bash
# Priority 1: Use host AWS CLI (Dingocoin-Ecosystem pattern)
→ Check if `aws` command exists on host
  ↓ Yes → aws ecr get-login-password (uses server IAM role/credentials)
  ↓ Success → Done!

# Priority 2: Fallback to .env credentials
→ Check if AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in .env
  ↓ Yes → Use these credentials for ECR login
  ↓ No → Error (deployment fails)
```

**Best practice for ECR:** Configure AWS CLI on your server with IAM role or credentials:
```bash
# On your server
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region: us-east-1
# Default output format: json
```

### Switching Between Registries

**To switch from GHCR to ECR:**

1. **Update config:**
   ```yaml
   deployment:
     registry:
       type: ecr
       region: us-east-1
   ```

2. **Add GitHub Secrets:**
   ```bash
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```

3. **Add GitHub Variables:**
   ```bash
   AWS_REGION=us-east-1
   ```

4. **Commit and push:**
   ```bash
   git add config/project.config.yaml
   git commit -m "Switch to ECR registry"
   git push origin master
   ```

5. **Next deployment:** Workflow automatically uses ECR!

**To switch from ECR to GHCR:**

1. **Update config:**
   ```yaml
   deployment:
     registry:
       type: ghcr
       public: true
   ```

2. **Commit and push:**
   ```bash
   git add config/project.config.yaml
   git commit -m "Switch to GHCR registry"
   git push origin master
   ```

3. **Next deployment:** Workflow automatically uses GHCR!

### Registry Variables Injected to .env

The workflow automatically adds these variables to your server's `.env`:

```bash
# Docker Registry Configuration (injected by CI/CD)
REGISTRY_TYPE=ghcr              # or ecr
REGISTRY_PUBLIC=true            # Only for GHCR
REGISTRY_REGION=us-east-1       # Only for ECR
REGISTRY=ghcr.io/owner          # Full registry URL
IMAGE_PREFIX=atlasp2p-          # Image naming prefix
IMAGE_TAG=latest                # Image tag
```

These are used by `docker-compose.prod.yml` and `docker-compose.cloud-prod.yml`:

```yaml
services:
  web:
    image: ${REGISTRY}/${IMAGE_PREFIX}web:${IMAGE_TAG}

  crawler:
    image: ${REGISTRY}/${IMAGE_PREFIX}crawler:${IMAGE_TAG}
```

### Troubleshooting Registry Issues

#### "Failed to pull image: unauthorized"

**For GHCR:**
```bash
# Check if image is public
# GitHub → Packages → atlasp2p-web → Package settings
# → Change visibility to Public

# Or authenticate manually on server:
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USER --password-stdin
```

**For ECR:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Manual login:
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Check ECR permissions
aws ecr describe-repositories --region us-east-1
```

#### "Cannot find repository"

**For ECR:**
```bash
# Create ECR repositories (do once)
aws ecr create-repository --repository-name atlasp2p/web --region us-east-1
aws ecr create-repository --repository-name atlasp2p/crawler --region us-east-1
```

**For GHCR:**
- Repositories auto-created on first push (no manual creation needed)

#### "Invalid registry type"

**Check config:**
```yaml
registry:
  type: ghcr  # Must be exactly "ghcr" or "ecr" (lowercase)
```

---

## 🚀 Deployment Workflows

### Auto Deployment (Push to master)

**Just commit and push:**
```bash
git add .
git commit -m "Update feature"
git push origin master
```

Workflow automatically:
1. Detects configuration from `project.config.yaml`
2. Auto-detects infrastructure (Caddy mode, secrets source)
3. Fetches secrets
4. Builds Docker images
5. Deploys to server
6. Validates health
7. Rolls back if failed

### Manual Deployment (with overrides)

**Trigger via GitHub Actions UI:**
1. Go to Actions → Deploy to Production
2. Click "Run workflow"
3. Select branch (usually `master`)
4. **Optional overrides:**
   - Override deployment mode: `self-hosted-docker` | `self-hosted-cloud`
   - Override Caddy mode: `container` | `host` | `none`
   - Override secrets: `aws-ssm` | `github-secrets` | `manual`
   - Skip backup: `false` (dangerous!)
   - Test rollback: `true` (for testing only)

---

## 🏗️ How It Works

### Workflow Jobs

**1. detect-config**
- Reads `project.config.yaml`
- Applies workflow_dispatch overrides (if manual)
- Determines Make target (`prod-docker`, `prod-docker-no-caddy`, etc.)

**2. auto-detect** (if mode=auto)
- SSH to server
- Checks if systemd Caddy running → use `host` mode
- Checks if ports 80/443 occupied → use `none` mode
- Otherwise → use `container` mode
- Tries AWS credentials → use SSM
- Checks GitHub secrets → use GitHub
- Otherwise → manual

**3. prepare-env**
- Fetches secrets from chosen source
- Extracts `NEXT_PUBLIC_*` vars for Docker build args
- Creates `.env.production` artifact

**4. build-verify-binaries**
- Extracts configuration from `project.config.yaml`:
  - Chain name (e.g., "Dingocoin")
  - P2P port (e.g., 33117)
  - Site URL for API calls
  - Derives daemon names (e.g., "dingocoind,dingocoin-qt")
- Builds verification binaries for all platforms:
  - Linux (x86_64, ARM64)
  - macOS (Intel, Apple Silicon)
  - Windows (x64)
- Injects configuration via Go ldflags at build time
- Generates SHA256 checksums for each binary
- Uploads binaries as artifact (deployed with web app)

**5. build-and-push**
- Builds web image (with `NEXT_PUBLIC` vars baked in)
- Builds crawler image
- Pushes to GitHub Container Registry (GHCR) or AWS ECR
- Uses layer caching for speed

**6. deploy**
- SSH to server
- Copies docker-compose files + Makefile
- Copies `.env` file (if not manual)
- **Backup database** (if self-hosted + backup enabled)
- Login to GHCR
- Pull latest images
- Run Make target (e.g., `make prod-docker`)
- **Health check** (10 retries, 30 seconds)
- **Rollback on failure** (restore DB, restart old containers)
- Cleanup old images

---

## 🔍 Auto-Detection Logic

### Caddy Mode Detection

```bash
if systemd Caddy is active:
  → Use "host" mode (don't start container Caddy)
elif ports 80/443 are occupied:
  → Use "none" mode (no Caddy at all)
else:
  → Use "container" mode (start Caddy in Docker)
```

**Make targets:**
- `host` or `none` → `prod-docker-no-caddy`
- `container` → `prod-docker` (with --profile with-caddy)

### Secrets Source Detection

```bash
if AWS credentials valid:
  → Use "aws-ssm"
elif GitHub secrets populated (check for DOMAIN):
  → Use "github-secrets"
else:
  → Use "manual" (expect .env on server)
```

---

## 🔨 Verification Binary Build

The CI/CD pipeline automatically builds cross-platform verification binaries for the two-step POST-based node verification system.

### Configuration Extraction

The build process extracts configuration from `project.config.yaml`:

```yaml
chainConfig:
  name: "Dingocoin"
  p2pPort: 33117

content:
  siteUrl: "https://nodes.dingocoin.com"
```

**Derived values:**
- `CHAIN_NAME`: "Dingocoin"
- `DAEMON_NAMES`: "dingocoind,dingocoin-qt" (auto-derived from chain name)
- `DEFAULT_PORT`: "33117"
- `API_URL`: "https://nodes.dingocoin.com"

### Build Process

```bash
# 1. Extract config with yq
CHAIN_NAME=$(yq '.chainConfig.name' config/project.config.yaml)
P2P_PORT=$(yq '.chainConfig.p2pPort' config/project.config.yaml)
SITE_URL=$(yq '.content.siteUrl' config/project.config.yaml)

# 2. Derive daemon names
DAEMON_BASE=$(echo "$CHAIN_NAME" | tr '[:upper:]' '[:lower:]')
DAEMON_NAMES="${DAEMON_BASE}d,${DAEMON_BASE}-qt"

# 3. Build with ldflags injection
go build -ldflags="-s -w \
  -X main.Version=2.0.0 \
  -X main.ApiUrl=$SITE_URL \
  -X main.DaemonNames=$DAEMON_NAMES \
  -X main.DefaultPort=$P2P_PORT \
  -X main.ChainName=$CHAIN_NAME" \
  -trimpath -o verify-linux-amd64 .
```

### Platform Support

Binaries are built for:
- **Linux**: x86_64, ARM64
- **macOS**: Intel (x86_64), Apple Silicon (ARM64)
- **Windows**: x64

Each binary includes SHA256 checksum for verification.

### Deployment

Binaries are:
1. Uploaded as GitHub Actions artifact
2. Downloaded during deployment
3. Copied to `apps/web/public/verify/` on the server
4. Served directly from the web app at `/verify/verify-{platform}-{arch}`

### Local Build

To build binaries locally:

```bash
cd tools/verify

# Set configuration
export API_URL="https://your-domain.com"
export DAEMON_NAMES="yourchaind,yourchain-qt"
export DEFAULT_PORT="8333"
export CHAIN_NAME="YourChain"

# Build
./build.sh
```

Binaries will be output to `apps/web/public/verify/`.

---

## 📊 Deployment Scenarios

### Scenario 1: Fresh Server (No Caddy)

**What happens:**
1. Auto-detect: No Caddy found → `container` mode
2. Workflow starts Caddy container
3. Caddy gets SSL cert from Let's Encrypt
4. Proxies to web container

**Requirements:**
- `DOMAIN` and `ACME_EMAIL` in secrets
- Ports 80/443 available
- DNS pointing to server

### Scenario 2: Existing Caddy on Host

**What happens:**
1. Auto-detect: systemd Caddy active → `host` mode
2. Workflow skips Caddy container
3. Web container exposes port 4000
4. You configure host Caddy to proxy to port 4000

**Your Caddyfile (on host):**
```
nodes.example.com {
  reverse_proxy localhost:4000
}
```

### Scenario 3: Behind External Load Balancer

**What happens:**
1. Auto-detect: Ports 80/443 occupied → `none` mode
2. Workflow skips Caddy
3. Web exposes port 4000
4. Load balancer proxies to port 4000

**Requirements:**
- Load balancer handles SSL
- Load balancer forwards to port 4000

---

## 🛡️ Safety Features

### Pre-Deployment Validation

Workflow checks:
- SSH connectivity
- Docker installed
- Docker Compose available
- Sufficient disk space
- Port availability (if using container Caddy)

### Database Backup (Self-Hosted)

**Before every deployment:**
```bash
docker compose exec -T db pg_dump -U postgres atlasp2p > backups/db-YYYYMMDD-HHMMSS.sql
```

**Retention:** 7 days (configurable)

**Restore manually:**
```bash
cd /opt/atlasp2p
cat backups/db-20240115-143022.sql | docker compose exec -T db psql -U postgres atlasp2p
```

### Health Check

**10 retries over 30 seconds:**
```bash
for i in {1..10}; do
  curl -sf http://localhost:4000/api/stats && break
  sleep 3
done
```

**If all retries fail:** Automatic rollback

### Automatic Rollback

**On health check failure:**
1. Stop new containers
2. Restore database backup (if exists)
3. Restart old containers
4. Notify failure in GitHub Actions

---

## 🔧 Troubleshooting

### Deployment Fails: "SSH connection refused"

**Fix:**
```bash
# Verify SSH key in GitHub Secrets
# Test SSH manually:
ssh -i ~/.ssh/deploy_key user@server
```

### Deployment Fails: "DOMAIN not set"

**Fix:**
```bash
# For GitHub Secrets method: Add DOMAIN secret
# For AWS SSM: Ensure DOMAIN in SSM parameter
# For manual: Add DOMAIN to .env on server
```

### Health Check Fails

**Check logs:**
```bash
# On server
cd /opt/atlasp2p
docker compose logs web
```

**Common issues:**
- Database not ready (increase `timeout` in config)
- Migrations not applied
- Port conflict

### Rollback Failed

**Manual rollback:**
```bash
# On server
cd /opt/atlasp2p
docker compose down
docker compose pull  # Get previous images
docker compose up -d
```

### Auto-Detect Wrong Mode

**Override manually:**
```bash
# Via workflow_dispatch UI:
# - Override Caddy mode: "container"
# - Run workflow

# Or update config:
caddy:
  mode: container  # Force container mode
```

### Containers Using Old Configuration After Deployment

**Symptom:** Deployment completes successfully, images are pulled from registry, but containers use old configuration (wrong ports, old seed nodes, etc.).

**Root Cause:** Docker Compose with both `build:` and `image:` directives prefers building locally even when images are pulled. The `build: null` pattern doesn't fully remove the build context.

**Verification:**
```bash
# On server, check which image is actually running:
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.ID}}"

# Check image SHA - should match registry, not local build:
docker inspect atlasp2p-web | grep -A5 "Image"
docker images | grep atlasp2p-web

# If images show different SHAs, containers are using local builds
```

**Solution (Already Fixed):**

This issue was resolved in commit `741ea44` with the following changes:

1. **docker-compose.prod.yml**: Fully redeclared `web` and `crawler` services with all necessary directives (volumes, depends_on, environment, healthcheck) to override base config without inheritance
2. **Makefile**: Added `--no-build` flag to all production targets (`prod-docker`, `prod-docker-no-caddy`, `prod-cloud`, `prod-cloud-no-caddy`, `prod-restart`)

**Manual Fix (if using older version):**

```bash
# On server:
cd /opt/atlasp2p

# Stop containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Remove locally built images
docker rmi $(docker images --filter "reference=atlasp2p-*" -q) 2>/dev/null || true

# Pull fresh images
docker pull ${REGISTRY}/${IMAGE_PREFIX}web:latest
docker pull ${REGISTRY}/${IMAGE_PREFIX}crawler:latest

# Start with --no-build flag
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --no-build

# Verify containers use registry images
docker ps --format "table {{.Names}}\t{{.Image}}"
```

**Prevention:**
- Always use `make prod-docker-no-caddy` or equivalent Make targets (they include `--no-build`)
- Never run `docker compose up` directly without `--no-build` in production
- Verify image SHAs after deployment match registry

---

## 📈 Monitoring Deployment

### GitHub Actions UI

**View:**
- Job status (detect, build, deploy)
- Real-time logs
- Deployment summaries
- Error messages

### Server Monitoring

**Check deployment:**
```bash
# On server
docker compose ps
docker compose logs -f web
curl http://localhost:4000/api/stats
```

**Check Caddy SSL:**
```bash
curl -I https://nodes.example.com
# Should return 200 with valid SSL
```

---

## 🔄 Update Workflow

**Typical deployment flow:**

```bash
# 1. Make changes locally
git checkout -b feature/new-feature
# ... edit code ...

# 2. Test locally
make docker-dev
# ... test ...

# 3. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 4. Create PR, review, merge

# 5. Automatic deployment triggers on merge to master
# → Workflow runs automatically
# → Check GitHub Actions for status
# → Visit https://nodes.example.com to verify
```

---

## 🎛️ Advanced Configuration

### Custom Make Target

**In project.config.yaml:**
```yaml
deployment:
  mode: self-hosted-docker
  caddy:
    mode: container
```

**Workflow uses:** `make prod-docker`

**Override in workflow_dispatch:**
- Override Caddy: `none` → Uses `make prod-docker-no-caddy`

### Resource Limits

**In project.config.yaml:**
```yaml
resources:
  web:
    memory: 2g
    cpus: "1.0"
  crawler:
    memory: 1g
    cpus: "0.5"
  db:
    memory: 2g
    cpus: "1.0"
```

*Note: Resource limits require docker-compose.yml updates (not auto-applied)*

### Notification Integration

**In project.config.yaml:**
```yaml
notifications:
  slack:
    enabled: true
    webhook: ""  # Add via GitHub Secret: SLACK_WEBHOOK
  discord:
    enabled: false
    webhook: ""
```

*Note: Notification features require workflow updates*

---

## 📚 Related Documentation

- [Deployment Scenarios](./DEPLOYMENT_SCENARIOS.md) - All deployment options
- [Forking Guide](./FORKING.md) - Fork setup for your blockchain
- [Production Deployment](./PRODUCTION_DEPLOYMENT.md) - Manual production setup
- [Architecture](./ARCHITECTURE.md) - System architecture overview

---

## ✅ Checklist for New Fork

**First-time CI/CD setup:**

- [ ] Fork AtlasP2P repository
- [ ] Edit `config/project.config.yaml` (deployment section)
- [ ] Add GitHub Variables: `DEPLOY_USER`, `SSH_HOST`, `DEPLOY_PATH`
- [ ] Add GitHub Secret: `SSH_PRIVATE_KEY`
- [ ] Choose secrets method and configure (SSM / GitHub Secrets / manual)
- [ ] Commit config: `git add -f config/project.config.yaml && git commit`
- [ ] Push to master: `git push origin master`
- [ ] Watch GitHub Actions → Deploy to Production
- [ ] Verify: `https://your-domain.com`

---

**Configure once, deploy forever!**
