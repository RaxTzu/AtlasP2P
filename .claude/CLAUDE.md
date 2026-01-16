# AtlasP2P - Claude AI Instructions

## Quick Access Commands

```bash
# SSH to Dingocoin server
ssh dingo

# AWS SSO login (for ECR, SSM access)
aws sso login --profile dingocoin

# Development
make setup-docker          # First time setup
make docker-dev            # Start all services
make docker-sync           # After pnpm add

# Production
make prod-docker           # Deploy with Caddy
make prod-docker-no-caddy  # Deploy without Caddy
```

---

## Rules

### Git
- **No Co-Authored-By tags** in commits (no AI attribution)
- Don't commit unless asked

### Code
- Use `make docker-dev` instead of raw `docker compose up` for project commands
- No hardcoded chain-specific values (use `config/project.config.yaml`)
- Ask before changing config or env vars

---

## Architecture Overview

```
apps/web/          # Next.js 16 + React 19
apps/crawler/      # Python P2P crawler
packages/config/   # Shared Zod schemas
packages/types/    # Shared TypeScript types
config/            # project.config.yaml
supabase/          # Database migrations
```

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Auth), Python crawler, Docker Compose

---

## Configuration

### Two Sources of Truth
1. **`config/project.config.yaml`** - App behavior, features, branding
2. **`.env`** - Secrets, API keys, credentials

### For Forks
- Remove `config/project.config.yaml` from `.gitignore`
- Commit your customized config
- Upstream only changes `.example` file (no merge conflicts)

---

## Deployment (CI/CD)

### Secrets Management (Single Source of Truth)
| Method | Use Case |
|--------|----------|
| **AWS SSM** | Enterprise, teams - all config in one SSM parameter |
| **GitHub Secrets** | Solo devs - secrets in repo settings |
| **Manual** | Testing - `.env` file on server |

### Registry Options
| Registry | Use Case |
|----------|----------|
| **GHCR** | Open-source, free public images |
| **ECR** | Enterprise, private images |

### GitHub Variables Required
```
SSH_HOST          # Server IP (not domain if behind Cloudflare)
DEPLOY_USER       # SSH user (e.g., deployment)
DEPLOY_PATH       # Deploy directory (e.g., /apps/project-name)
SSM_PARAM_NAME    # SSM parameter path (if using AWS SSM)
AWS_REGION        # AWS region (e.g., us-west-2)
```

### GitHub Secrets Required
```
SSH_PRIVATE_KEY        # SSH key for deployment
AWS_ACCESS_KEY_ID      # For SSM/ECR access
AWS_SECRET_ACCESS_KEY  # For SSM/ECR access
```

---

## Common Patterns

### Admin Operations (Bypass RLS)
```typescript
const adminClient = createAdminClient();
await adminClient.from('admin_users').upsert({ ... });
```

### Config Access
```typescript
const config = getProjectConfig();
const chainName = config.chainConfig.name;
```

### Upsert Pattern (Admin)
```typescript
await adminClient.from('admin_users').upsert(
  { user_id: 'X', is_active: true },
  { onConflict: 'user_id' }
);
```

---

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile.web` | Web app Docker build (needs ARG for NEXT_PUBLIC_*) |
| `docker-compose.prod.yml` | Production overrides |
| `.github/workflows/deploy.yml.example` | CI/CD template |
| `config/project.config.yaml` | All app configuration |

---

## Troubleshooting

### NEXT_PUBLIC_* Not Working
- Must be passed as `build-args` to Docker build
- Check Dockerfile.web has ARG/ENV declarations
- Check workflow passes `build-args` to `docker/build-push-action`

### Health Check Failing
- Don't use `set -e` in SSH heredoc
- Use explicit `check_passed` variable
- Add `|| true` to `source .env`

### ECR Push 403
- Check `IMAGE_PREFIX` in SSM matches ECR repo path
- Verify IAM user has ECR push permissions

---

## Documentation

- `/docs/CICD.md` - Complete CI/CD guide
- `/docs/PRODUCTION_DEPLOYMENT.md` - Environment variables
- `/docs/FORKING.md` - How to fork for your chain
- `/docs/ARCHITECTURE.md` - System design

