# AtlasP2P

<div align="center">
  <img src="docs/assets/atlasp2p.jpg" alt="AtlasP2P" width="400"/>
</div>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-RaxTzu%2FAtlasP2P-blue)](https://github.com/RaxTzu/AtlasP2P)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-success)](https://raxtzu.github.io/AtlasP2P/)
[![CI](https://github.com/RaxTzu/AtlasP2P/actions/workflows/ci.yml/badge.svg)](https://github.com/RaxTzu/AtlasP2P/actions/workflows/ci.yml)

A professional, production-ready P2P network visualization platform for cryptocurrency blockchains. Monitor your network's health, discover nodes worldwide, and provide transparency to your community.

**🚀 Fork-Ready** | **⚡ Real-time Updates** | **🌍 Global Node Discovery** | **🎨 Fully Customizable**

## Key Features

- **Real-time Node Discovery**: Bitcoin P2P protocol crawler with recursive peer discovery from DNS seeds
- **Interactive Geolocation Map**: Leaflet-powered map with clustering, filtering, and node details
- **Performance Metrics**: Node tiers (Diamond/Gold/Silver/Bronze) based on uptime, latency, and reliability
- **Node Verification**: Prove node ownership via message signing, DNS TXT records, or user agent tags
- **Operator Profiles**: Custom branding with avatars, descriptions, and social links for verified nodes

## Live Demo

- **Dingocoin Network**: [nodes.raxtzu.com](https://nodes-dingocoin.raxtzu.com) (example deployment)

## Quick Start

**📖 New users**: See **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** for complete guide!

### Development (5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/RaxTzu/AtlasP2P.git
cd AtlasP2P

# 2. Choose deployment mode:

# Option A: Local Docker (Full Stack - Recommended)
make setup-docker   # Creates .env from template
make docker-dev     # Starts PostgreSQL + Supabase + Web + Crawler

# Option B: Cloud Supabase (Production-Ready)
make setup-cloud    # Creates .env from template
# Edit .env with your Supabase Cloud credentials
make cloud-dev      # Starts Web + Crawler only
```

**What just happened?**
- `make setup-docker` copied `.env.docker.example` → `.env`
- `make setup-docker` copied `project.config.yaml.example` → `project.config.yaml`
- Both files are gitignored for upstream development

**Forking?** Use `make setup-fork` for guided fork setup!
- Customize `config/project.config.yaml` for your blockchain
- Commit with `git add -f config/project.config.yaml`
- See [FORKING.md](./docs/FORKING.md) for complete instructions

**Access locally** (default ports - configurable via .env):
- Web App: http://localhost:4000
- Supabase Studio: http://localhost:4022 (Docker mode only)
- API: http://localhost:4020 (Docker mode only)
- Inbucket (email testing): http://localhost:4023 (Docker mode only)

**Port Configuration**: All ports are configurable in `.env` via `WEB_PORT`, `KONG_PORT`, `DB_PORT`, `STUDIO_PORT`, etc. See `.env.example` for full list.

### Production

```bash
# 1. Configure domain in .env
DOMAIN=nodes.yourcoin.org
ACME_EMAIL=admin@yourcoin.org

# 2. Deploy with auto-SSL
make prod-docker   # Self-hosted (full stack)
# OR
make prod-cloud    # Cloud Supabase + Docker app
```

**Access**: https://nodes.yourcoin.org (Caddy handles SSL certificates automatically)

### Automated CI/CD Deployment

**Configure once, deploy forever** with our GitHub Actions workflow:

```bash
# 1. Setup deployment workflow (forks only)
make setup-deploy

# 2. Configure deployment in config/project.config.yaml
deployment:
  mode: self-hosted-docker  # or self-hosted-cloud
  registry:
    type: ghcr  # or ecr
  caddy:
    mode: auto  # auto-detects infrastructure
  secrets:
    source: auto  # AWS SSM, GitHub Secrets, or manual

# 3. Add GitHub Variables and Secrets
# Settings → Secrets and variables → Actions
DEPLOY_USER, DEPLOY_HOST, DEPLOY_PATH, SSH_PRIVATE_KEY

# 3. Push to master - automatic deployment!
git push origin master
```

**Features:**
- ✅ Auto-detects Caddy (container/host/none)
- ✅ Auto-detects secrets management (SSM/GitHub/manual)
- ✅ Health checks with automatic rollback
- ✅ Database backups before deployment
- ✅ Multi-secrets sources (AWS Parameter Store, GitHub Secrets, manual .env)

**See:** [docs/CICD.md](./docs/CICD.md) for complete automated deployment guide

## Tech Stack

**Frontend**:
- [Next.js 16](https://nextjs.org) - React framework with App Router
- [React 19](https://react.dev) - UI library
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [Leaflet](https://leafletjs.com) + [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) - Interactive maps
- [Recharts](https://recharts.org) - Charts and statistics
- [Zustand](https://zustand.docs.pmnd.rs/) - State management

**Backend**:
- [Supabase](https://supabase.com) - PostgreSQL database, REST API, Authentication, Real-time subscriptions
- [PostgREST](https://postgrest.org) - Auto-generated REST API from database schema
- [Kong](https://konghq.com) - API Gateway for request routing

**Crawler**:
- Python 3.12 with asyncio - Bitcoin P2P protocol implementation
- [MaxMind GeoIP2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) - IP geolocation
- [Supabase Python Client](https://github.com/supabase-community/supabase-py) - Database integration

**Infrastructure**:
- [Docker Compose](https://docs.docker.com/compose/) - Multi-container orchestration
- [Caddy](https://caddyserver.com) - Reverse proxy with automatic HTTPS
- [Turborepo](https://turbo.build/repo) - Monorepo build system

## Fork This Project for Your Cryptocurrency

**AtlasP2P is designed to be forked!** Deploy a node map for ANY Bitcoin-derived cryptocurrency in minutes.

### Quick Fork (3 Steps)

**1. Edit Configuration** (`config/project.config.yaml`):
```yaml
chain: yourcoin
chainConfig:
  name: YourCoin
  ticker: YOUR
  p2pPort: 8333
  magicBytes: "f9beb4d9"  # Your chain's magic bytes
  dnsSeeds:
    - seed.yourcoin.org
```

**2. Replace Logos** (`apps/web/public/logos/`):
- Use the provided `TEMPLATE-*.svg` files as guides
- Replace with your coin's branding (PNG or SVG)
- Update paths in `project.config.yaml`

**3. Deploy!**
```bash
make prod-docker   # Self-hosted
# OR
make prod-cloud    # Cloud Supabase
```

**Keep Your Fork Updated:**
```bash
make sync-upstream  # Pull latest improvements from AtlasP2P
```

See **[Complete Forking Guide](./docs/FORKING.md)** for detailed instructions.

---

## Documentation

📘 **[Complete Documentation](https://raxtzu.github.io/AtlasP2P/)** - GitHub Pages

**Quick Links**:
- **[Forking Guide](./docs/FORKING.md)** ⭐ **Start here to fork for your cryptocurrency**
- **[Configuration Reference](./docs/config/CONFIGURATION.md)** - Complete config options
- **[API Reference](./docs/api/API_REFERENCE.md)** - Public API endpoints
- **[Deployment Guide](./docs/PRODUCTION_DEPLOYMENT.md)** - Docker, Kubernetes, AWS, VPS
- **[Crawler Implementation](./docs/crawler/IMPLEMENTATION_GUIDE.md)** - P2P crawler details

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Run `make lint && make typecheck && make build` before submitting.

## Credits & Attribution

**Built by**: [RaxTzu Team](https://github.com/raxtzu)

**Inspired by**:
- [Bitnodes.io](https://bitnodes.io/) - Node discovery methodology and API structure
  - Reference implementation by [Addy Yeow](https://github.com/ayeowch/bitnodes)
  - We adapted the P2P crawler approach and API compatibility

**Core Technologies**:
- [Next.js](https://nextjs.org) by Vercel - React framework
- [Supabase](https://supabase.com) - Open-source Firebase alternative
- [Leaflet](https://leafletjs.com) - Open-source interactive maps
- [PostgreSQL](https://www.postgresql.org) - Database
- [Python](https://www.python.org) - Crawler implementation
- [Docker](https://www.docker.com) - Containerization
- [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) - Geolocation data

**Map Tiles**:
- [OpenStreetMap](https://www.openstreetmap.org/copyright) - Map data contributors
- [CARTO](https://carto.com/attributions) - Map tile provider

**Bitcoin P2P Protocol**:
- Based on [Bitcoin Core](https://github.com/bitcoin/bitcoin) protocol specification
- Adapted for Bitcoin-derived chains (Dogecoin, Litecoin, Dingocoin, etc.)

**Dependencies**:
- See [package.json](./apps/web/package.json) for complete frontend dependencies
- See [requirements.txt](./apps/crawler/requirements.txt) for complete Python dependencies

## License

MIT License - see [LICENSE](./LICENSE) file for details.

Copyright (c) 2025 RaxTzu Team

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
