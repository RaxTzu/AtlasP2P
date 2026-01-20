# AtlasP2P Docker Configuration

This directory contains configuration files for the AtlasP2P Docker services.

## Files

- **entrypoint.sh**: Production container entrypoint
  - Waits for database (Docker mode only)
  - Runs migrations via migrate.js
  - Starts Next.js server
  - Skips DB steps in cloud mode (no POSTGRES_PASSWORD)

- **migrate.js**: Database migration runner
  - Tracks applied migrations in `schema_migrations` table
  - Applies pending SQL files from `supabase/migrations/`
  - Syncs Supabase internal user passwords with POSTGRES_PASSWORD

- **kong.yml**: Kong API Gateway declarative configuration
  - Routes API requests to Supabase services (auth, rest, storage)
  - CORS configuration
  - JWT authentication

- **Caddyfile**: Container-based Caddy reverse proxy configuration
  - Used with: `make prod-docker` (caddy.mode: container)
  - Auto-SSL via Let's Encrypt
  - Routes `/supabase/*` to Kong
  - Routes everything else to Web App

- **Caddyfile.host.example**: Host-based Caddy configuration template
  - Used with: `make prod-docker-no-caddy` (caddy.mode: host)
  - One-time infrastructure setup (NOT deployed by CI/CD)
  - Copy and customize for your domains/ports
  - Deploy to: `/etc/caddy/sites/yourproject.Caddyfile`
  - See file header for complete setup instructions

- **Caddyfile.cloud**: Cloud mode Caddy configuration
  - Used with: `make prod-cloud` (for Supabase Cloud)
  - Routes only web traffic (API is on Supabase Cloud)

## Docker Compose Files (in project root)

```
docker-compose.yml       # Base services (DB, Auth, REST, Kong, Web)
docker-compose.dev.yml   # Dev overrides (exposed ports, Studio, Inbucket)
docker-compose.prod.yml  # Prod overrides (pre-built images, port exposure)
docker-compose.cloud-prod.yml  # Cloud overrides (Supabase Cloud instead of self-hosted)
```

## Usage

### Development
```bash
make docker-dev   # Start all services (Docker mode)
make cloud-dev    # Start with Supabase Cloud
make down         # Stop
make logs         # View logs
```

Exposed ports: 4000 (Web), 4020 (Kong), 4021 (DB), 4022 (Studio), 4023 (Inbucket)

### Production

#### Option 1: Container Caddy (caddy.mode: container)
```bash
# Set in .env first:
# DOMAIN=nodes.example.com
# ACME_EMAIL=admin@example.com

make prod-docker  # Start with containerized Caddy (auto-SSL)
```
Exposed ports: 80, 443 (via Caddy container)

#### Option 2: Host Caddy (caddy.mode: host)
```bash
# One-time setup (manual):
# 1. Copy and customize Caddyfile.host.example
# 2. Deploy to /etc/caddy/sites/yourproject.Caddyfile
# 3. sudo systemctl reload caddy

make prod-docker-no-caddy  # Start without Caddy container
```
Exposed ports: 4000 (Web), 4020 (Kong) → Reverse proxied by host Caddy

#### Option 3: Cloud Mode (caddy.mode: host or container)
```bash
# For Supabase Cloud instead of self-hosted
make prod-cloud          # With containerized Caddy
make prod-cloud-no-caddy # With host Caddy
```
Exposed ports: 4000 (Web only) → Kong on Supabase Cloud

## Architecture

### Development
```
Browser ──┬──→ :4000 Web App
          └──→ :4020 Kong ──→ Auth, REST, Storage
```

### Production (Container Caddy)
```
Browser ──→ :443 Caddy Container ──┬──→ Web App
                                   └──→ /supabase/* → Kong
```

### Production (Host Caddy)
```
Browser ──→ :443 Host Caddy ──┬──→ :4000 Web App
                              └──→ :4020 Kong ──→ Auth, REST, Storage
```

### Production (Cloud Mode)
```
Browser ──┬──→ :443 Caddy ──→ :4000 Web App
          └──→ Supabase Cloud API (direct HTTPS)
```

## Caddy Configuration Guide

### When to use each Caddyfile:

| File | Deployment Mode | Where Caddy Runs | When to Use |
|------|----------------|------------------|-------------|
| `Caddyfile` | Self-hosted | Docker container | Default production setup, single project |
| `Caddyfile.host.example` | Self-hosted | Host systemctl | Multi-project server, existing Caddy install |
| `Caddyfile.cloud` | Cloud | Docker container | Using Supabase Cloud for database/auth |

### Setting up Host Caddy:

**This is a ONE-TIME infrastructure setup, NOT automated by CI/CD.**

1. Copy and customize the template:
   ```bash
   cp docker/Caddyfile.host.example /tmp/myproject.Caddyfile
   # Edit: Replace domains (from SITE_URL, API_EXTERNAL_URL)
   #       Replace ports (from WEB_PORT, KONG_PORT in .env)
   ```

2. Deploy to server:
   ```bash
   sudo cp /tmp/myproject.Caddyfile /etc/caddy/sites/myproject.Caddyfile
   sudo chown root:root /etc/caddy/sites/myproject.Caddyfile
   sudo chmod 644 /etc/caddy/sites/myproject.Caddyfile
   ```

3. Ensure main Caddyfile imports sites directory:
   ```
   # /etc/caddy/Caddyfile
   import /etc/caddy/sites/*.Caddyfile
   ```

4. Reload Caddy:
   ```bash
   sudo systemctl reload caddy
   sudo systemctl status caddy
   ```

**If you change ports later:**
- Update AWS SSM Parameter Store (for automated deployments)
- Update /etc/caddy/sites/myproject.Caddyfile (infrastructure)
- Reload Caddy

See `Caddyfile.host.example` for complete instructions and troubleshooting.
