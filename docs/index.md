---
layout: default
title: AtlasP2P - Professional P2P Network Visualization
---

# AtlasP2P Documentation

Welcome to the **AtlasP2P** documentation - a professional, production-ready P2P network visualization platform for cryptocurrency blockchains.

[![GitHub](https://img.shields.io/badge/GitHub-RaxTzu%2FAtlasP2P-blue)](https://github.com/RaxTzu/AtlasP2P)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Quick Start

Deploy a node map for your cryptocurrency in 3 simple steps:

### 1. Edit Configuration
```yaml
# config/project.config.yaml
chain: yourcoin
chainConfig:
  name: YourCoin
  ticker: YOUR
  p2pPort: 8333
  magicBytes: "f9beb4d9"
```

### 2. Replace Logos
```bash
# Use template files as guides
cp your-logo.png apps/web/public/logos/logo.png
cp your-favicon.ico apps/web/public/logos/favicon.ico
```

### 3. Deploy
```bash
make prod
```

---

## 📚 Documentation Sections

<div class="grid">
  <div class="card">
    <h3>⭐ Forking Guide</h3>
    <p>Complete step-by-step guide to fork AtlasP2P for your cryptocurrency.</p>
    <a href="./FORKING.html" class="btn">Read Guide →</a>
  </div>

  <div class="card">
    <h3>⚙️ Configuration</h3>
    <p>Complete reference for project.config.yaml customization.</p>
    <a href="./config/CONFIGURATION.html" class="btn">Read Docs →</a>
  </div>

  <div class="card">
    <h3>🌐 API Reference</h3>
    <p>RESTful API endpoints for node data, statistics, and network health.</p>
    <a href="./api/API_REFERENCE.html" class="btn">API Docs →</a>
  </div>

  <div class="card">
    <h3>🚀 Deployment</h3>
    <p>Production deployment guides for Docker, Kubernetes, AWS, and VPS.</p>
    <a href="./PRODUCTION_DEPLOYMENT.html" class="btn">Deploy Guide →</a>
  </div>

  <div class="card">
    <h3>🕷️ Crawler</h3>
    <p>P2P network crawler implementation and configuration.</p>
    <a href="./crawler/IMPLEMENTATION_GUIDE.html" class="btn">Crawler Docs →</a>
  </div>

  <div class="card">
    <h3>🏗️ Architecture</h3>
    <p>Technical architecture and system design documentation.</p>
    <a href="./ARCHITECTURE.html" class="btn">Architecture →</a>
  </div>

  <div class="card">
    <h3>💻 Developer Guide</h3>
    <p>Contribution guidelines, development setup, and common tasks.</p>
    <a href="./DEVELOPER.html" class="btn">Dev Guide →</a>
  </div>
</div>

---

## ✨ Key Features

- **🌍 Real-time Node Discovery**: Bitcoin P2P protocol crawler with DNS seed discovery
- **🗺️ Interactive Geolocation Map**: Leaflet-powered map with clustering and filtering
- **📊 Performance Metrics**: Node tiers (Diamond/Gold/Silver/Bronze) based on uptime and latency
- **✅ Node Verification**: Prove node ownership via message signing or DNS TXT records
- **👤 Operator Profiles**: Custom branding with avatars and social links
- **💰 Tipping System**: Enable tips for verified nodes
- **📈 Network Statistics**: Real-time charts and historical trending
- **🔔 Alerting**: Network health notifications and alerts

---

## 🛠️ Tech Stack

**Frontend**:
- [Next.js 16](https://nextjs.org) with App Router
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Leaflet](https://leafletjs.com) for interactive maps

**Backend**:
- [Supabase](https://supabase.com) - PostgreSQL + REST API + Real-time
- [Kong](https://konghq.com) - API Gateway
- Python 3.12 - P2P crawler with asyncio

**Infrastructure**:
- [Docker Compose](https://docs.docker.com/compose/)
- [Caddy](https://caddyserver.com) - Auto HTTPS
- [Turborepo](https://turbo.build/repo) - Monorepo

---

## 🎯 Use Cases

- **Blockchain Projects**: Visualize your network's global distribution
- **Node Operators**: Showcase your infrastructure and attract more nodes
- **Community Transparency**: Provide real-time network health to users
- **Research & Analytics**: Track network growth and geographic diversity
- **Decentralization Metrics**: Prove your network's distributed nature

---

## 📖 Documentation Navigation

| Guide | Description |
|-------|-------------|
| [Forking Guide](./FORKING.html) | Fork this project for your cryptocurrency |
| [Configuration](./config/CONFIGURATION.html) | Complete YAML configuration reference |
| [API Reference](./api/API_REFERENCE.html) | RESTful API documentation |
| [Deployment](./PRODUCTION_DEPLOYMENT.html) | Production deployment scenarios |
| [Crawler Guide](./crawler/IMPLEMENTATION_GUIDE.html) | P2P crawler implementation |
| [Architecture](./ARCHITECTURE.html) | Technical architecture deep-dive |
| [Developer Guide](./DEVELOPER.html) | Development setup and contribution guide |

---

## 🤝 Credits

**Built by**: [RaxTzu Team](https://github.com/raxtzu)

**Inspired by**: [Bitnodes.io](https://bitnodes.io/) - Node discovery methodology by [Addy Yeow](https://github.com/ayeowch/bitnodes)

**Core Technologies**: Next.js • Supabase • Leaflet • PostgreSQL • Python • Docker • MaxMind GeoIP

---

## 📄 License

MIT License - [View Full License](https://github.com/RaxTzu/AtlasP2P/blob/main/LICENSE)

Copyright (c) 2025 RaxTzu Team
