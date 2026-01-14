# AtlasP2P - Claude AI Instructions

**IMPORTANT: This is the main forkable repository for AtlasP2P.**

## Core Principles

### 1. Codebase Cleanliness
- **ZERO Claude artifacts outside `.claude/` directory**
- No session summaries, audit files, or development notes in the main codebase
- All AI-related documentation belongs in `.claude/` only
- Production-ready code only - no temporary files, debug logs, or test artifacts
- Do NOT commit anything unless explicitly instructed by the user
- **ALWAYS use Makefile commands instead of raw docker/bash commands** (e.g., `make docker-dev` not `docker compose up`)
- **NEVER make configuration decisions or changes without explicit user permission** - Always ask first before changing settings, environment variables, or feature flags

### Git Commit Hygiene (CRITICAL)
- **NEVER EVER use Co-Authored-By tags with Claude or any AI assistant in commits**
- **NEVER use Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>**
- Keep git history clean - only human authors in commits
- Before committing, ALWAYS verify commit message has NO author tags
- Use plain commit messages without any AI attribution
- Example of CORRECT commit message format:
  ```
  fix: resolve ESLint configuration for Next.js 16

  - Create eslint.config.mjs with ESLint 9 flat config format
  - Filter out React Compiler plugin to avoid false positives
  - Change lint script from 'next lint' to 'eslint .'
  ```
- **NEVER add anything after the commit body except blank lines**
- If you accidentally add author tags, the entire repo must be deleted and recreated

### 2. Fork-Friendly Architecture
This repository is designed to be forked for ANY Bitcoin-derived cryptocurrency:
- All chain-specific config in `config/project.config.yaml`
- No hardcoded chain names, colors, or branding in code
- Logo/branding assets replaceable via config
- Easy 3-step fork process documented in `/docs/FORKING.md`

### 3. Code Quality Standards
- **Critique everything** - question patterns, look for issues, suggest improvements
- No over-engineering - keep it simple and maintainable
- TypeScript strict mode - proper types, no `any`
- Zod validation for all external inputs (config, API, user data)
- Environment-aware validation (lenient in dev, strict in production)
- Security-first mindset - always consider RLS, auth, injection vulnerabilities

### 4. Documentation Standards
- Keep documentation synchronized with code changes
- Update relevant docs when changing architecture or APIs
- Use inline comments only where logic isn't self-evident
- Prefer self-documenting code over excessive comments

---

## Project Architecture

### Tech Stack

**Frontend:**
- Next.js 16 (App Router) with React 19
- TailwindCSS for styling
- Leaflet + react-leaflet for interactive maps
- MapLibre GL for tile rendering
- Recharts for analytics visualization

**Backend:**
- Next.js API Routes (serverless functions)
- Supabase (PostgreSQL + Auth + Realtime)
- Row Level Security (RLS) for data protection
- Service role client for admin operations

**Crawler:**
- Python 3.11+ with Bitcoin P2P protocol
- Direct node connection + RPC integration
- GeoIP lookups (MaxMind GeoLite2)
- Continuous crawling with configurable intervals

**Infrastructure:**
- Docker Compose for local development
- Supabase self-hosted OR Cloud mode
- Kong API Gateway (Supabase stack)
- PostgreSQL 15+ with PostGIS

### Project Structure

```
AtlasP2P/
├── apps/
│   ├── web/               # Next.js web application
│   │   ├── src/
│   │   │   ├── app/       # Next.js 16 App Router pages
│   │   │   ├── components/ # React components
│   │   │   ├── lib/       # Utilities, helpers
│   │   │   └── middleware.ts
│   │   └── instrumentation.ts  # Server startup hooks
│   └── crawler/           # Python network crawler
│       └── src/
├── packages/
│   ├── config/            # Shared configuration package
│   │   └── src/
│   │       ├── schema.ts  # Zod schemas
│   │       ├── loader.server.ts  # Server-side loader
│   │       └── feature-flags.ts
│   └── types/             # Shared TypeScript types
├── config/
│   └── project.config.yaml  # Main configuration file
├── supabase/
│   └── migrations/        # Database migrations (4 files)
├── docker-compose.yml     # Base services
├── docker-compose.dev.yml # Dev mode overrides
└── docs/                  # Comprehensive documentation
```

---

## Database Architecture

### Migration Strategy (4-Layer System)

**0001_foundation.sql** - Database foundation
- Extensions (uuid-ossp, pgcrypto, postgis)
- Schemas (public, auth, storage)
- Core tables without constraints

**0002_schema.sql** - Complete schema
- All tables with columns, constraints, indexes
- Tables: nodes, node_snapshots, network_snapshots, verifications, node_profiles, admin_users, banned_users, api_keys, alert_subscriptions, profile_pending_changes, admin_settings

**0003_functions.sql** - Database functions
- `is_admin()` - Checks if user is admin (via admin_users table)
- `get_user_verification_count()` - Counts user's verified nodes
- Automated triggers for timestamps, profile changes

**0004_policies.sql** - Row Level Security
- Public read access for nodes, profiles, stats
- Authenticated writes with ownership checks
- Admin-only access for admin_users, banned_users, verifications
- Service role bypass for all policies

### Key Tables

**nodes** - Core node information
- Stores IP, port, version, services, country, last_seen
- Geographic data (lat, lng, country_code, city)
- Tier classification (seed, relay, full, light)
- Status tracking (reachable, unreachable)

**verifications** - Node ownership verification
- Links users to nodes via verification methods
- Methods: message_sign, dns_txt, file_upload
- Approval workflow (pending → approved/rejected)
- Admin moderation capabilities

**admin_users** - Admin user management
- Dual-tier system: super_admin (env var) + moderator (database)
- Role-based permissions (super_admin, moderator, support)
- Revocable admin access (is_active flag)
- Unique constraint on user_id (upsert pattern)

**node_profiles** - User-customizable node profiles
- Display name, description, website, social links
- Tip address (cryptocurrency address for donations)
- Avatar URL (local storage or Supabase Storage)
- Moderation workflow for changes

---

## Authentication & Authorization

### User Authentication
- Supabase Auth with email/password
- Email verification with OTP (6-digit codes)
- Session management via middleware
- Invalid session detection and cookie clearing

### Admin System (Dual-Tier)

**Tier 1: Super Admins**
- Defined in `ADMIN_EMAILS` environment variable
- Permanent access, cannot be removed via UI
- Checked by `isUserAdmin()` function (server-side only)
- Example: `ADMIN_EMAILS=admin@example.com,owner@example.com`

**Tier 2: Regular Admins**
- Stored in `admin_users` table (role: moderator, support)
- Added/removed by super admins via `/api/admin/users` endpoint
- Checked by `is_admin()` database function (RLS policies)
- Uses upsert pattern with `onConflict: 'user_id'` for reactivation

**Important Separation:**
- `isUserAdmin()` checks ONLY environment variable
- `is_admin()` checks ONLY database table
- Two independent authorization paths (OR logic in permissions)

### Service Role Client
Admin operations bypass RLS using service role client:
```typescript
const adminClient = createAdminClient(); // Uses SUPABASE_SERVICE_ROLE_KEY
await adminClient.from('admin_users').upsert({ ... });
```

---

## Configuration System

### Two-Tier Configuration

**YAML Configuration (`config/project.config.yaml`):**
- Project identity (name, tagline, URLs)
- Chain configuration (name, RPC, explorer URLs)
- Theme (colors, logos, tier colors, semantic colors)
- Feature flags (authentication, verification, tipping, etc.)
- Map settings (tiles, default view, zoom levels)
- Content (hero text, about sections)
- Limits and restrictions
- Email provider settings (resend, sendgrid, smtp, disabled)

**Environment Variables (`.env`):**
- Secrets (API keys, passwords, tokens)
- Database credentials
- SMTP credentials
- Service URLs (RPC, Supabase, MaxMind)
- Admin emails list

### Config File Workflow (Upstream vs Forks)

**AtlasP2P Upstream (Maintainers):**
- `project.config.yaml` is **gitignored**
- Only `project.config.yaml.example` is committed
- `make setup-docker` copies `.example` → `.yaml` for local development
- Maintainers work with local gitignored config
- Config loader falls back to `.example` if `.yaml` missing (for CI/CD)

**Forks (Blockchain Projects):**
- **Remove** `config/project.config.yaml` from `.gitignore`
- Customize `project.config.yaml` for your chain
- **Commit** your customized config to your fork's git
- CI/CD and production deployments use committed config
- No merge conflicts when pulling upstream (upstream only touches `.example`)

**Config Loader Behavior:**
```typescript
// packages/config/src/loader.server.ts
// 1. Try project.config.yaml (forks & local dev)
// 2. Fallback to project.config.yaml.example (CI/CD & upstream)
// 3. Throw error if neither exists
```

### Validation

**Zod Schema Validation:**
- All config validated on server startup (`instrumentation.ts`)
- Blocks server start if validation fails
- Schema location: `packages/config/src/schema.ts`

**NODE_ENV-Aware Validation:**
- **Development**: Lenient (warnings for missing API keys, emails still work with inbucket)
- **Production**: Strict (blocks startup if API keys missing when feature enabled)

**Feature Flag Dependencies:**
- Turnstile enabled → requires `TURNSTILE_SECRET_KEY`
- Email resend → requires `RESEND_API_KEY` (prod only)
- Email sendgrid → requires `SENDGRID_API_KEY` (prod only)
- Email smtp → requires `SMTP_HOST` (always), `SMTP_USER`/`SMTP_PASSWORD` (optional)

### Test Scripts (Root Directory)
- `test-config-validation.mjs` - Validates current config against schema
- `test-malformed-config.js` - Tests that validation catches invalid configs
- `test-validation-simple.js` - Simplified validation test
- Run with: `node test-config-validation.mjs`

### Email Architecture (Two Independent Systems)

**IMPORTANT: AtlasP2P has TWO separate email systems for different purposes:**

**1. GoTrue Auth Emails (.env configuration)**
- **Purpose**: Authentication emails (signup, password reset, email verification)
- **Configured in**: `.env` file using SMTP relay settings
- **Used by**: GoTrue (Supabase Auth service) - pre-built container
- **Settings**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`
- **Example**:
  ```bash
  SMTP_HOST=smtp.resend.com
  SMTP_PORT=587
  SMTP_USER=resend
  SMTP_PASS=re_xxxxx  # Your Resend API key
  ```
- **Why ENV vars?**: GoTrue is a pre-built image that only reads environment variables

**2. Application Custom Emails (project.config.yaml configuration)**
- **Purpose**: Custom app emails (alerts, notifications, node updates)
- **Configured in**: `config/project.config.yaml` (`adminConfig.email.provider`)
- **Used by**: Your application code (Next.js API routes)
- **Settings**: Provider choice (`resend`, `sendgrid`, `smtp`, `disabled`)
- **API Keys**: `RESEND_API_KEY` or `SENDGRID_API_KEY` in `.env`
- **Example**: Uses Resend HTTP API for feature-rich, fast emails

**Both can use the SAME provider (e.g., Resend):**
- GoTrue uses **Resend SMTP relay** (smtp.resend.com:587)
- Application uses **Resend HTTP API** (faster, with tracking)

**Deployment Considerations:**
- **Supabase Cloud**: GoTrue managed by Supabase Dashboard, you only configure app emails
- **Self-hosted Docker**: Configure both systems via `.env` + project.config.yaml
- **Hybrid**: Cloud auth + self-hosted app, configure separately

---

## Development Workflow

### Docker Development Mode

**Setup:**
```bash
make setup-docker  # Creates .env, runs pnpm install, creates config
make docker-dev    # Starts all services (DB + Web + Crawler + all Supabase services)
```

**What Runs:**
- PostgreSQL database (port 4021)
- Kong API Gateway (port 4020)
- Supabase Auth (GoTrue)
- Supabase Studio (port 4022)
- Next.js web app (port 4000)
- Python crawler
- Inbucket email testing (port 4023)

**Development Details:**
- Source code volume-mounted for hot reload
- `pnpm install` runs automatically in container on startup
- Changes to code reflect immediately (no container restart)
- Adding packages: Run `pnpm add <package>` then `make docker-sync`

### Cloud Supabase Mode

**Setup:**
```bash
make setup-cloud   # Creates .env from cloud template
# Edit .env with Supabase credentials
make cloud-dev     # Starts only web + crawler (DB in cloud)
```

**What Runs:**
- Next.js web app (localhost:4000)
- Python crawler
- Database hosted on supabase.com

---

## API Structure

### Public Endpoints
- `GET /api/nodes.json` - Bitnodes.io compatible node list
- `GET /api/stats.json` - Network statistics
- `GET /api/countries.json` - Geographic distribution
- `GET /api/nodes/[id]` - Individual node details
- `GET /api/leaderboard` - Top verified node operators

### Authenticated Endpoints
- `POST /api/verify` - Submit node verification
- `POST /api/profiles/[id]` - Update node profile
- `GET /api/my-nodes` - User's verified nodes
- `POST /api/alerts` - Create alert subscription

### Admin Endpoints
- `GET /api/admin/users` - List all users (service role)
- `POST /api/admin/users` - Promote/demote/ban/unban users (upsert pattern)
- `DELETE /api/admin/users?id=X` - Delete user (protects super admins)
- `GET /api/admin/verifications` - Pending verification requests
- `POST /api/admin/verifications/[id]` - Approve/reject verification
- `GET /api/admin/moderation` - Moderation queue
- `GET /api/admin/audit` - Audit log

---

## Security Considerations

### Row Level Security (RLS)
All tables have RLS policies enforcing:
- Public read for non-sensitive data
- Authenticated write with ownership checks
- Admin-only access for sensitive tables
- Service role bypass for admin operations

### Input Validation
- Zod schemas for all external inputs
- TypeScript strict mode
- Prepared statements (Supabase handles this)
- No raw SQL with user input

### Authentication
- Supabase Auth (secure by design)
- HTTPOnly cookies for session tokens
- CSRF protection via SameSite cookies
- Middleware validates all protected routes

### Admin Operations
- Environment variable list for super admins (not in database)
- Service role client for admin database operations
- Cannot delete/ban users in ADMIN_EMAILS list
- Cannot delete own admin account

---

## Common Pitfalls to Avoid

### 1. Don't Use Regular Supabase Client for Admin Operations
❌ **Wrong:**
```typescript
const supabase = await createClient();
await supabase.from('admin_users').insert({ ... }); // RLS blocks this!
```

✅ **Correct:**
```typescript
const adminClient = createAdminClient();
await adminClient.from('admin_users').upsert({ ... }); // Bypasses RLS
```

### 2. Don't Hardcode Chain-Specific Values
❌ **Wrong:**
```typescript
const chainName = 'Dingocoin';
const explorerUrl = 'https://explorer.dingocoin.org';
```

✅ **Correct:**
```typescript
const config = getProjectConfig();
const chainName = config.chainConfig.name;
const explorerUrl = config.chainConfig.explorerUrl;
```

### 3. Don't Skip Config Validation
❌ **Wrong:**
```typescript
const config = yaml.load(fs.readFileSync('config.yaml'));
// Use config without validation
```

✅ **Correct:**
```typescript
import { ProjectConfigSchema } from '@atlasp2p/config/schema';
const config = ProjectConfigSchema.parse(yamlData); // Validates + type-safe
```

### 4. Use Upsert for Admin Operations
❌ **Wrong:**
```typescript
await adminClient.from('admin_users').insert({ user_id: 'X' }); // Fails if exists
```

✅ **Correct:**
```typescript
await adminClient.from('admin_users').upsert(
  { user_id: 'X', is_active: true, revoked_at: null },
  { onConflict: 'user_id' }
); // Reactivates if already exists
```

---

## File Naming Conventions

- React components: PascalCase (e.g., `NodeDetailModal.tsx`)
- Utilities/helpers: camelCase (e.g., `createClient.ts`)
- API routes: kebab-case folders (e.g., `api/my-nodes/route.ts`)
- Config files: kebab-case (e.g., `project.config.yaml`)
- Documentation: UPPERCASE (e.g., `README.md`, `ARCHITECTURE.md`)

---

## Performance Considerations

- Map clustering for 1000+ markers (react-leaflet-cluster)
- Database indexes on frequently queried columns (ip_port, last_seen, country_code)
- Materialized view for network statistics (refreshed hourly)
- Client-side caching for static data (countries, versions)
- Lazy loading for heavy components
- Image optimization (Next.js Image component)

---

## Testing Strategy

- Config validation tests in root directory
- Manual testing checklist in docs
- Browser compatibility: Chrome, Firefox, Safari
- Mobile responsive design (Tailwind breakpoints)
- Admin operations: Test with multiple users/roles

---

## Docker Configuration

### Container and Image Naming

All containers and images are named with the `atlasp2p-` prefix:
- `atlasp2p-web` - Next.js web application
- `atlasp2p-crawler` - Python network crawler
- `atlasp2p-db` - PostgreSQL database
- `atlasp2p-kong` - API gateway
- `atlasp2p-auth` - Supabase Auth (GoTrue)
- `atlasp2p-rest` - Supabase REST API (PostgREST)
- `atlasp2p-meta` - Supabase Meta
- `atlasp2p-studio` - Supabase Studio
- `atlasp2p-inbucket` - Email testing

This naming is controlled by `COMPOSE_PROJECT_NAME=atlasp2p` in all `.env` files.

### Why COMPOSE_PROJECT_NAME Matters

Without this variable, Docker Compose uses the **directory name** for naming:
- If project is in `/path/to/AtlasP2P/` → `atlasp2p-web`
- If project is in `/path/to/MyFork/` → `myfork-web`

Setting `COMPOSE_PROJECT_NAME=atlasp2p` ensures **consistent naming** regardless of directory location.

**For Forks**: Change to match your project:
```bash
# .env
COMPOSE_PROJECT_NAME=mychain  # Creates mychain-web, mychain-db, etc.
```

---

## Deployment Architecture

### Overview

AtlasP2P uses a **config-driven CI/CD workflow** for automated production deployments. The workflow is designed to be fork-friendly, with all configuration in `config/project.config.yaml` and smart auto-detection of infrastructure.

**Key Features:**
- ✅ 5-job pipeline with dependency graph
- ✅ Config-driven (no hardcoded values in workflow)
- ✅ Auto-detects infrastructure (Caddy, secrets, registry)
- ✅ Supports multiple deployment modes and registries
- ✅ Safe deployments (backup → deploy → health check → rollback)

### Workflow Structure (5 Jobs)

```
┌─────────────────┐
│ detect-config   │  Reads project.config.yaml, applies overrides
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
┌────────▼────────┐   ┌────▼────────┐
│ auto-detect     │   │ prepare-env │  Fetches secrets (SSM/GitHub/manual)
│ (if mode=auto)  │   │             │  Extracts NEXT_PUBLIC_* vars
└────────┬────────┘   └─────┬───────┘
         │                  │
         └──────────┬───────┘
                    │
              ┌─────▼──────┐
              │ build      │  Builds web + crawler images
              │            │  Pushes to registry (GHCR/ECR)
              └─────┬──────┘
                    │
              ┌─────▼──────┐
              │ deploy     │  SSH to server, backup DB, pull images
              │            │  Deploy, health check, rollback if failed
              └────────────┘
```

**Job Dependencies:**
1. **detect-config** (always runs) → Reads config, outputs parameters
2. **auto-detect** (if needed) → SSH to server, detects infrastructure
3. **prepare-env** (depends on detect-config) → Fetches secrets
4. **build** (depends on prepare-env) → Builds Docker images
5. **deploy** (depends on build) → Deploys to server

### Secrets Management Options

AtlasP2P supports **three secrets management methods**:

| Method | Best For | Configuration |
|--------|----------|---------------|
| **AWS SSM** | Teams, enterprise | `secrets.source: aws-ssm` |
| **GitHub Secrets** | Solo developers | `secrets.source: github-secrets` |
| **Manual .env** | Testing, dev | `secrets.source: manual` |

**Auto-detection priority:**
1. Check AWS credentials → Use SSM
2. Check GitHub Secrets (DOMAIN exists) → Use GitHub
3. Otherwise → Manual (expect .env on server)

**Helper Scripts (Location: `scripts/`):**
- `setup-ssm.sh` - Interactive AWS SSM setup wizard
- `setup-github-secrets.sh` - Generate GitHub Secrets from .env file

**Documentation:** See `/docs/CICD.md#-secrets-management` for complete setup guide.

### Registry Configuration

**Two registry options:**

| Registry | Type | Config | Best For |
|----------|------|--------|----------|
| **GHCR** | GitHub Container Registry | `registry.type: ghcr` | Open-source forks, free hosting |
| **ECR** | AWS Elastic Container Registry | `registry.type: ecr` | Enterprise, private images |

**GHCR (Default):**
- Free unlimited public images
- Integrated with GitHub Actions
- No additional setup required
- Image naming: `ghcr.io/owner/atlasp2p-web:latest`

**ECR (Enterprise):**
- Private images with IAM control
- Regional deployment (lower latency)
- Requires AWS credentials
- Image naming: `123456789.dkr.ecr.region.amazonaws.com/atlasp2p/web:latest`

**Smart host authentication:**
- GHCR: Try public pull → fallback to GitHub token
- ECR: Try host AWS CLI → fallback to .env credentials

**Configuration location:** `config/project.config.yaml` → `deployment.registry`

**Documentation:** See `/docs/CICD.md#-docker-registry-configuration`

### Config-Driven Deployment

All deployment behavior is controlled by `config/project.config.yaml`:

```yaml
deployment:
  mode: self-hosted-docker        # or self-hosted-cloud

  caddy:
    enabled: true
    mode: auto                    # auto | container | host | none

  secrets:
    source: auto                  # auto | aws-ssm | github-secrets | manual
    ssmPath: /atlasp2p/prod/env   # For AWS SSM

  registry:
    type: ghcr                    # ghcr | ecr
    public: true                  # GHCR only
    region: us-east-1             # ECR only

  healthCheck:
    enabled: true
    endpoint: /api/stats
    timeout: 30
    retries: 3

  backup:
    enabled: true                 # DB backup before deploy
    retention: 7

  rollback:
    enabled: true
    onHealthCheckFail: true
```

**Workflow logic:**
- Reads this config during `detect-config` job
- Applies workflow_dispatch overrides (if manual trigger)
- Sets job parameters and Make targets
- All subsequent jobs use these parameters

**No hardcoded values in workflow** - everything comes from config or repository variables/secrets.

### Common Pitfalls

#### 1. SSH Heredoc Issues
❌ **Wrong:**
```yaml
- name: Deploy
  run: |
    ssh user@host << EOF
      echo "Deploy: ${{ needs.job.outputs.var }}"
    EOF
```
**Problem:** GitHub Actions expressions inside heredoc get evaluated on client, not server.

✅ **Correct:**
```yaml
- name: Deploy
  env:
    VAR: ${{ needs.job.outputs.var }}
  run: |
    ssh user@host << 'ENDSSH'
      echo "Deploy: $VAR"  # VAR is env variable, not GitHub expression
    ENDSSH
```

#### 2. Conditional Logic Placement
❌ **Wrong:** Put `if:` conditions on individual workflow steps (complex, error-prone)

✅ **Correct:** Put conditions in shell script logic (easier to debug)
```bash
if [ "$BACKUP_ENABLED" = "true" ]; then
  echo "Creating backup..."
fi
```

#### 3. Job Dependencies
❌ **Wrong:** Run jobs in parallel when they depend on each other

✅ **Correct:** Use `needs:` to create proper dependency graph
```yaml
build:
  needs: [detect-config, prepare-env]

deploy:
  needs: [build]
```

#### 4. Secrets in Logs
❌ **Wrong:** Echo secrets or sensitive values in workflow logs

✅ **Correct:** Use `::add-mask::` or avoid echoing secrets entirely
```bash
echo "::add-mask::$SECRET_VALUE"
```

### Environment Variables

The deployment workflow injects ~40+ environment variables to the server's `.env` file:

**Categories:**
- Supabase credentials (3 vars)
- Database secrets (3 vars)
- Email provider credentials (3-6 vars)
- Domain/SSL configuration (2 vars)
- Registry configuration (5 vars, auto-injected)
- Optional services (Turnstile, GeoIP, RPC)

**Complete list:** See `/docs/PRODUCTION_DEPLOYMENT.md#required-environment-variables`

**Registry variables (auto-injected by workflow):**
```bash
REGISTRY_TYPE=ghcr              # or ecr
REGISTRY_PUBLIC=true            # GHCR only
REGISTRY_REGION=us-east-1       # ECR only
REGISTRY=ghcr.io/owner          # Full registry URL
IMAGE_PREFIX=atlasp2p-          # Image naming prefix
IMAGE_TAG=latest                # Image tag
```

These are used by `docker-compose.prod.yml`:
```yaml
services:
  web:
    image: ${REGISTRY}/${IMAGE_PREFIX}web:${IMAGE_TAG}
```

### Deployment Modes

**Self-hosted Docker:**
- All services in Docker (DB + Web + Crawler)
- Make target: `prod-docker` or `prod-docker-no-caddy`
- Requires: PostgreSQL, Supabase services in containers

**Self-hosted Cloud:**
- Web + Crawler in Docker, DB in Supabase Cloud
- Make target: `prod-cloud` or `prod-cloud-no-caddy`
- Requires: Supabase Cloud credentials

**Caddy modes:**
- `container` - Start Caddy in Docker (handles SSL)
- `host` - Use host systemd Caddy (deployment skips container Caddy)
- `none` - No Caddy (behind external load balancer)

**Auto-detection logic:**
1. Check if systemd Caddy active → use `host`
2. Check if ports 80/443 occupied → use `none`
3. Otherwise → use `container`

### Workflow Files

**Location:** `.github/workflows/`

| File | Purpose | Status |
|------|---------|--------|
| `ci.yml` | Lint, typecheck, build (on PRs) | ✅ Committed (upstream) |
| `deploy.yml.example` | Deployment workflow template | ✅ Committed (upstream) |
| `deploy.yml` | Active deployment workflow | ⚠️ Gitignored (forks commit) |

**For forks:**
1. Copy `deploy.yml.example` → `deploy.yml`
2. Edit branch name (line 27)
3. Remove from `.gitignore`
4. Commit to fork

**Setup command:** `make setup-deploy` (creates + prints instructions)

### Documentation Hierarchy

**Deployment documentation structure (ZERO duplication):**

1. **`/docs/CICD.md`** - Complete CI/CD guide
   - Secrets management (AWS SSM, GitHub Secrets, Manual)
   - Registry configuration (GHCR vs ECR)
   - Auto-detection logic
   - Troubleshooting

2. **`/docs/PRODUCTION_DEPLOYMENT.md`** - Environment & scaling
   - Complete environment variables list
   - Secrets management decision tree
   - Security best practices
   - Scaling considerations

3. **`/docs/README.md`** - Navigation hub
   - Links to all docs
   - Helper scripts table
   - Quick task index

4. **`.claude/CLAUDE.md`** - This file
   - Workflow architecture overview
   - Common pitfalls
   - Job dependency graph
   - For AI assistant context

**Cross-referencing:**
- CICD.md links to PRODUCTION_DEPLOYMENT.md for env var list
- PRODUCTION_DEPLOYMENT.md links to CICD.md for setup instructions
- README.md links to both for navigation

### Manual Deployment

**For testing or when CI/CD not needed:**

**Docker Production (self-hosted):**
```bash
make prod-docker        # With Caddy SSL
make prod-docker-no-caddy  # Without Caddy (use host reverse proxy)
```

**Cloud Production (Supabase Cloud):**
```bash
make prod-cloud         # With Caddy SSL
make prod-cloud-no-caddy   # Without Caddy
```

**Requirements:**
- Docker + Docker Compose v2
- `.env` file with all secrets
- DNS pointing to server (for SSL)

---

## Deployment

## When Working on This Codebase

1. **Read the docs first** - Comprehensive documentation in `/docs/`
2. **Check existing patterns** - Look at similar features before implementing
3. **Validate config changes** - Run `node test-config-validation.mjs`
4. **Test admin operations** - Verify RLS policies work correctly
5. **Update documentation** - Keep docs in sync with code changes
6. **Keep it fork-friendly** - No hardcoded chain-specific values
7. **Critique and improve** - Question everything, suggest better patterns
8. **No Claude artifacts** - All development notes stay in `.claude/` only

---

## Quick Reference Commands

```bash
# Development
make setup-docker          # First time setup (Docker mode)
make setup-cloud           # First time setup (Cloud mode)
make docker-dev            # Start Docker stack
make cloud-dev             # Start cloud mode (web + crawler)
make docker-sync           # Sync dependencies after pnpm add

# Database
make db-reset              # Drop and recreate database
make db-migrate            # Run migrations
make db-studio             # Open Supabase Studio

# Testing
node test-config-validation.mjs  # Validate current config
make test                        # Run test suite

# Utilities
make geoip                 # Download GeoIP databases
make logs-web              # View web app logs
make logs-crawler          # View crawler logs
```

---

**Remember: This is the canonical AtlasP2P repository. Keep it clean, professional, and fork-ready.**
