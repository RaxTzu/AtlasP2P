# AtlasP2P Docker Configuration

This directory contains configuration files for the AtlasP2P Docker services.

## Files

- **kong.yml**: Kong API Gateway declarative configuration
  - Routes API requests to Supabase services (auth, rest, storage)
  - CORS configuration
  - JWT authentication

- **Caddyfile**: Production reverse proxy configuration
  - Auto-SSL via Let's Encrypt
  - Routes `/supabase/*` to Kong
  - Routes everything else to Web App

## Docker Compose Files (in project root)

```
docker-compose.yml       # Base services (DB, Auth, REST, Kong, Web)
docker-compose.dev.yml   # Dev overrides (exposed ports, Studio, Inbucket)
docker-compose.prod.yml  # Prod overrides (Caddy reverse proxy)
```

## Usage

### Development
```bash
make dev          # Start all services with debug ports
make dev-down     # Stop
make dev-logs     # View logs
```

Exposed ports: 4000 (Web), 4020 (Kong), 4021 (DB), 4022 (Studio), 4023 (Inbucket)

### Production
```bash
# Set in .env first:
# DOMAIN=nodes.dingocoin.com
# ACME_EMAIL=admin@dingocoin.com

make prod         # Start with Caddy (auto-SSL)
make prod-down    # Stop
make prod-logs    # View logs
```

Exposed ports: 80, 443 only (via Caddy)

## Architecture

### Development
```
Browser ──┬──→ :4000 Web App
          └──→ :4020 Kong ──→ Auth, REST, Storage
```

### Production
```
Browser ──→ :443 Caddy ──┬──→ Web App
                         └──→ /supabase/* → Kong
```
