---
layout: default
title: Developer Guide - AtlasP2P
---

# Developer Guide

Complete guide for developers wanting to contribute to AtlasP2P or build custom features.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Testing](#testing)
5. [Contributing Guidelines](#contributing-guidelines)
6. [Common Tasks](#common-tasks)

---

## Development Environment Setup

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Docker** and **Docker Compose**
- **Python** 3.12+ (for crawler development)
- **MaxMind Account** (for GeoIP database access)
- **Git** for version control

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/RaxTzu/AtlasP2P.git
cd AtlasP2P

# 2. First time setup (creates .env, installs deps)
make setup-docker

# 3. Start development environment
make dev

# Access the application:
# Access points (ports configurable via .env):
# - Web App: http://localhost:${WEB_PORT:-4000}
# - Supabase Studio: http://localhost:${STUDIO_PORT:-4022}
# - API Gateway: http://localhost:${KONG_PORT:-4020}
# - Inbucket (email): http://localhost:${INBUCKET_WEB_PORT:-4023}
```

---

## Project Structure

```
AtlasP2P/
├── apps/
│   ├── web/                    # Next.js 16 frontend
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── components/    # React components
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── lib/           # Utilities
│   │   │   └── types/         # TypeScript types
│   │   └── public/            # Static assets
│   └── crawler/               # Python P2P crawler
│       ├── src/
│       │   ├── crawler.py     # Main crawler
│       │   ├── protocol.py    # P2P protocol
│       │   ├── geoip.py       # GeoIP lookup
│       │   └── config.py      # Loads chainConfig from YAML
├── packages/
│   ├── types/                 # Shared TypeScript types
│   └── config/                # Chain configs
├── supabase/
│   └── migrations/            # Database migrations
├── docker/
│   └── docker-compose*.yml    # Container orchestration
├── config/
│   └── project.config.yaml    # Main configuration file
└── docs/                      # GitHub Pages documentation
```

### Key Technologies

**Frontend:**
- Next.js 16 with App Router
- TypeScript 5.7+ (strict mode)
- Tailwind CSS 4
- Leaflet for maps
- Zustand for state management

**Backend:**
- Supabase (PostgreSQL + PostgREST + Auth)
- Python 3.12 (asyncio crawler)
- Kong API Gateway
- Docker Compose

**Database:**
- PostgreSQL 15
- Row Level Security (RLS)
- Real-time subscriptions

---

## Development Workflow

### Starting Development

```bash
# Start all services (database, web app, crawler)
make dev

# View logs
make logs

# View specific service logs
make logs-web      # Web app only
make logs-crawler  # Crawler only
make logs-db       # Database only
```

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the appropriate directory:
   - Frontend: `apps/web/src/`
   - Crawler: `apps/crawler/src/`
   - Database: `supabase/migrations/`
   - Configuration: `config/project.config.yaml`

   **Config changes require restart:**
   ```bash
   # After editing config/project.config.yaml
   docker restart atlasp2p-web
   ```
   Code changes hot-reload automatically. Config is loaded at startup only.

3. **Test your changes:**
   ```bash
   # TypeScript type checking
   pnpm typecheck

   # Linting
   pnpm lint

   # Build verification
   pnpm build
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Code Quality Standards

**MANDATORY checks before committing:**

```bash
# 1. Type checking (must pass)
pnpm typecheck

# 2. Linting (must pass)
pnpm lint

# 3. Build verification (must pass)
pnpm build
```

### Port Configuration

All services use ports **4000-4100** (configurable via `.env`):

| Service | Default Port | Env Variable | Description |
|---------|--------------|--------------|-------------|
| Web App | 4000 | `WEB_PORT` | Development server |
| Testing | 4001 | N/A | Test server |
| Kong API | 4020 | `KONG_PORT` | API Gateway |
| PostgreSQL | 4021 | `DB_PORT` | Database |
| Studio | 4022 | `STUDIO_PORT` | Supabase admin UI |
| Inbucket Web | 4023 | `INBUCKET_WEB_PORT` | Email testing UI |
| Inbucket SMTP | 4024 | `INBUCKET_SMTP_PORT` | Email SMTP |

**Port Configuration:**
All ports can be customized in `.env` to avoid conflicts or run multiple instances:

```bash
# Example: Run on alternative ports
WEB_PORT=5000
KONG_PORT=5020
DB_PORT=5021
STUDIO_PORT=5022
```

This makes it easy to:
- Run multiple AtlasP2P instances (different chains)
- Avoid conflicts with existing services
- Test different configurations simultaneously

---

## Testing

### Running Tests

```bash
# Run all tests
make test

# Type checking only
make typecheck

# Linting only
make lint

# Format code
make format
```

### Writing Tests

**Frontend Tests** (`apps/web/__tests__/`):
- Use Jest + React Testing Library
- Test component rendering and user interactions
- Test custom hooks

**API Tests** (`apps/web/__tests__/api/`):
- Test API endpoints
- Test authentication/authorization
- Test error handling

**Database Tests** (via Supabase Studio):
- Test RLS policies
- Test database functions
- Verify migrations

---

## Contributing Guidelines

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add node verification system
fix: correct map clustering algorithm
docs: update API reference
refactor: improve database query performance
test: add tests for node profiles
```

### Pull Request Process

1. **Fork the repository**
2. **Create a feature branch** from `main`
3. **Make your changes** with descriptive commits
4. **Ensure all tests pass** (`pnpm typecheck && pnpm lint && pnpm build`)
5. **Submit a pull request** to `main` branch

**PR Checklist:**
- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] TypeScript compilation succeeds
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventional format

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (auto-format on save)
- **Linting**: ESLint with strict rules
- **Components**: Functional components with hooks
- **CSS**: Tailwind utility classes (avoid custom CSS)

---

## Common Tasks

### Adding a New Page

1. Create file in `apps/web/src/app/[page]/page.tsx`:
   ```typescript
   export default function NewPage() {
     return (
       <div className="container mx-auto p-6">
         <h1>New Page</h1>
       </div>
     )
   }
   ```

2. Add navigation link in `apps/web/src/components/layout/Header.tsx`

### Adding a New API Endpoint

1. Create file in `apps/web/src/app/api/[endpoint]/route.ts`:
   ```typescript
   import { NextResponse } from 'next/server'

   export async function GET(request: Request) {
     // Your logic here
     return NextResponse.json({ data: 'response' })
   }
   ```

2. Add TypeScript types in `apps/web/src/types/api.ts`

### Adding a Database Migration

1. Create SQL file in `supabase/migrations/`:
   ```bash
   touch supabase/migrations/$(date +%Y%m%d%H%M%S)_your_migration_name.sql
   ```

2. Write SQL migration:
   ```sql
   -- Add your schema changes
   ALTER TABLE nodes ADD COLUMN new_field TEXT;

   -- Update RLS policies if needed
   CREATE POLICY "Policy name"
     ON table_name FOR SELECT
     USING (true);
   ```

3. Apply migration:
   ```bash
   make migrate  # Run all migrations
   # OR
   make migrate-reset  # Reset and reapply (DESTROYS DATA!)
   ```

### Adding a New Chain Configuration

1. Edit `config/project.config.yaml`:
   ```yaml
   chain: newcoin
   chainConfig:
     name: NewCoin
     ticker: NEW
     p2pPort: 12345
     magicBytes: "aabbccdd"
     # ... other settings
   ```

2. Restart containers to load new config:
   ```bash
   docker restart atlasp2p-web atlasp2p-crawler
   ```

**Note**: The crawler automatically reads from `project.config.yaml`. No need to modify Python files!

### Working with the Crawler

**Run crawler:**
```bash
# Start crawler in Docker (recommended)
make crawler

# Run crawler locally (outside Docker)
make crawler-local
```

**Crawler logs:**
```bash
make logs-crawler
```

**Modify crawler behavior:**
- Edit `apps/crawler/src/crawler.py` for crawler logic changes
- Update chain settings in `config/project.config.yaml` (crawler reads this automatically)
- Adjust environment variables in `.env`

---

## Database Development

### Accessing PostgreSQL

```bash
# Via psql
make db-shell

# Via Supabase Studio
# Open http://localhost:4022
```

### Creating Views

```sql
-- Example: Create a custom view
CREATE OR REPLACE VIEW custom_stats AS
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'online') as online
FROM nodes;
```

### Row Level Security (RLS)

```sql
-- Enable RLS on table
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Public read access"
  ON your_table FOR SELECT
  USING (true);

-- User-specific write access
CREATE POLICY "Users can update own data"
  ON your_table FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## Debugging

### Frontend Debugging

**Browser DevTools:**
- React DevTools extension
- Network tab for API calls
- Console for errors

**Next.js Debugging:**
```bash
# Enable verbose logging
DEBUG=* pnpm dev

# Check server-side errors
# Look at terminal output
```

### Crawler Debugging

**Python logging:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**View crawler output:**
```bash
docker logs -f atlasp2p-crawler
```

### Database Debugging

**Check Supabase Studio:**
- http://localhost:4022
- View table data
- Run SQL queries
- Check RLS policies

**PostgreSQL logs:**
```bash
docker logs atlasp2p-db
```

---

## Environment Variables

### Required for Development

```bash
# .env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:4020
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# MaxMind GeoIP
MAXMIND_ACCOUNT_ID=your-account-id
MAXMIND_LICENSE_KEY=your-license-key
```

### Optional Variables

```bash
# Cloudflare Turnstile (Bot Protection)
# For local dev: Use test key that works on localhost
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# For production: Get real key at dash.cloudflare.com
# See docs/TURNSTILE_SETUP.md for complete guide

# Crawler configuration
CRAWLER_INTERVAL_MINUTES=5
MAX_CONCURRENT_CONNECTIONS=100

# Email (GoTrue Auth Emails)
# For production: Use Resend SMTP relay
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=your-resend-api-key
SMTP_ADMIN_EMAIL=noreply@yourdomain.com
SMTP_SENDER_NAME=Your Node Map

# Email (Application Custom Emails)
# Configured in config/project.config.yaml (adminConfig.email.provider)
RESEND_API_KEY=your-resend-api-key
```

---

## Resources

**Documentation:**
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

**Project Guides:**
- [Forking Guide](./FORKING.html)
- [Configuration Reference](./config/CONFIGURATION.html)
- [API Reference](./api/API_REFERENCE.html)
- [Architecture](./ARCHITECTURE.html)

**Community:**
- [GitHub Issues](https://github.com/RaxTzu/AtlasP2P/issues)
- [GitHub Discussions](https://github.com/RaxTzu/AtlasP2P/discussions)

---

## Getting Help

- **Documentation**: Check this guide and linked resources
- **Issues**: Search [GitHub Issues](https://github.com/RaxTzu/AtlasP2P/issues)
- **Questions**: Open a [Discussion](https://github.com/RaxTzu/AtlasP2P/discussions)
- **Bug Reports**: File an [Issue](https://github.com/RaxTzu/AtlasP2P/issues/new)

---

## License

MIT License - See [LICENSE](https://github.com/RaxTzu/AtlasP2P/blob/main/LICENSE) file for details.
