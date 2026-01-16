# AtlasP2P Documentation

## 📚 Getting Started

**New to AtlasP2P?** Start here:

1. **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start guide (5 min setup)
   - Choose your deployment path
   - Run your first commands
   - Understand the architecture

2. **[QUICKSTART.md](./QUICKSTART.md)** - Detailed setup for all modes
   - 🐳 Local Docker (full stack)
   - ☁️ Cloud Supabase (managed DB)
   - 🚀 Production deployment

3. **[FORKING.md](./FORKING.md)** - Customize for your blockchain
   - Replace branding
   - Add chain configuration
   - Deploy your fork

## 📖 Documentation Index

### Setup & Deployment

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | Quick start, first steps, architecture overview | 🌟 Start here! |
| **[QUICKSTART.md](./QUICKSTART.md)** | Detailed setup for all deployment modes | After getting started |
| **[DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md)** | All possible deployment scenarios explained | Planning architecture |
| **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** | Production checklist, environment variables, scaling, monitoring | Going live |
| **[CICD.md](./CICD.md)** | Automated CI/CD pipeline, secrets management, registry configuration | Setting up CI/CD |
| **[SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md)** | Step-by-step Supabase setup | Using cloud Supabase |
| **[SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md)** | Avatar storage configuration | Setting up avatars |

### Customization

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[FORKING.md](./FORKING.md)** | Fork and customize for your chain | Creating your own node map |
| **[BRANDING.md](../apps/web/public/logos/BRANDING.md)** | Asset requirements, logo specs | Replacing branding |

### Architecture

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design, tech stack | Understanding the codebase |
| **[API.md](./API.md)** | API endpoints, authentication | Building integrations |
| **[DATABASE.md](./DATABASE.md)** | Schema, migrations, RLS policies | Database work |

## 🚀 Quick Commands

```bash
# Development (Local Docker)
make setup-docker
make docker-dev

# Development (Cloud Supabase)
make setup-cloud
nano .env.local  # Add credentials
make cloud-dev

# Production (Self-Hosted)
make prod-docker

# Production (Cloud)
make prod-cloud

# All commands
make help
```

## 🎯 Common Tasks

### I want to...

**Get started quickly**
→ [GETTING_STARTED.md](./GETTING_STARTED.md) - 5 minute quick start

**Deploy to production**
→ [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Full checklist

**Fork for Dogecoin/Litecoin**
→ [FORKING.md](./FORKING.md) - Step-by-step customization

**Use Supabase Cloud**
→ [SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md) - Setup guide

**Understand the architecture**
→ [DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md) - All scenarios

**Replace logos and colors**
→ [apps/web/public/logos/BRANDING.md](../apps/web/public/logos/BRANDING.md)

**Add my blockchain**
→ [FORKING.md](./FORKING.md#step-2-chain-configuration-required)

**Migrate from Docker to Cloud**
→ [DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md#-migration-paths)

**Troubleshoot issues**
→ [QUICKSTART.md](./QUICKSTART.md#-troubleshooting) - Common problems

**Set up secrets management**
→ [CICD.md](./CICD.md#-secrets-management) - AWS SSM, GitHub Secrets, Manual

**Configure Docker registry**
→ [CICD.md](./CICD.md#-docker-registry-configuration) - GHCR vs ECR

## 🛠️ Helper Scripts

AtlasP2P provides automated setup scripts for common tasks:

| Script | Purpose | Documentation |
|--------|---------|---------------|
| `scripts/setup-ssm.sh` | Upload secrets to AWS Systems Manager Parameter Store | [CI/CD Guide](./CICD.md#option-1-aws-systems-manager-parameter-store-recommended-for-teams) |
| `scripts/setup-github-secrets.sh` | Generate GitHub Secrets from .env file | [CI/CD Guide](./CICD.md#option-2-github-secrets-easiest-for-solo-developers) |

**Note:** Helper scripts are coming soon. For now, follow manual setup in the CI/CD documentation.

## 📂 Documentation Structure

```
docs/
├── README.md                      # This file
├── QUICKSTART.md                  # 🌟 Start here
├── FORKING.md                     # Customization guide
├── DEPLOYMENT_SCENARIOS.md        # All scenarios explained
├── PRODUCTION_DEPLOYMENT.md       # Production guide
├── SUPABASE_QUICKSTART.md         # Supabase setup
├── SUPABASE_STORAGE_SETUP.md      # Avatar storage
├── ARCHITECTURE.md                # System design
├── API.md                         # API reference
├── DATABASE.md                    # Database schema
└── assets/                        # Documentation images
    └── atlasp2p.jpg               # Logo for GitHub Pages
```

## 🔗 External Resources

- **GitHub**: https://github.com/RaxTzu/AtlasP2P
- **Demo**: https://raxtzu.github.io/AtlasP2P/
- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs
- **Docker**: https://docs.docker.com

## 🤝 Contributing

Found a typo or want to improve the docs?

1. Fork the repository
2. Edit in `docs/` folder
3. Submit pull request

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Ready to start?** → [QUICKSTART.md](./QUICKSTART.md)
