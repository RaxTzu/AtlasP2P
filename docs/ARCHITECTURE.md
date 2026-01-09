---
layout: default
title: Architecture - AtlasP2P
---

# AtlasP2P - Architecture Documentation

## Project Overview

AtlasP2P is a professional, production-ready P2P network visualization and monitoring platform. It provides real-time insights into any cryptocurrency blockchain network, featuring node discovery, geolocation mapping, performance tracking, node verification, operator profiles, and tipping. The platform is chain-agnostic and can be forked for any Bitcoin-derived cryptocurrency.

## Architecture

### Technology Stack

**Frontend:**
- Next.js 16 (App Router) with React 19
- TypeScript for type safety
- TailwindCSS + shadcn/ui for styling
- Leaflet for interactive mapping with Supercluster for clustering
- Recharts for statistics visualization
- Zustand for state management
- Supabase Client (SSR-aware)

**Backend:**
- Next.js API Routes (serverless functions)
- Supabase (PostgreSQL 15 + PostgREST + GoTrue + Realtime)
- Row Level Security (RLS) for data access control
- JWT authentication with role-based access

**Crawler:**
- Python 3.12 with asyncio
- Bitcoin P2P protocol implementation
- MaxMind GeoLite2 for geolocation
- Supabase Python client for data storage

**Infrastructure:**
- Docker Compose for local development
- Turborepo for monorepo management
- pnpm for package management
- Kong API Gateway for request routing

### Project Structure

```
AtlasP2P/
├── apps/
│   ├── web/                    # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/           # App Router pages and API routes
│   │   │   ├── components/    # React components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # Utilities and configs
│   │   │   └── types/         # TypeScript type definitions
│   │   └── public/            # Static assets
│   └── crawler/               # Python P2P network crawler
│       ├── src/
│       │   ├── crawler.py     # Main crawler logic
│       │   ├── protocol.py    # Bitcoin protocol implementation
│       │   ├── geoip.py       # GeoIP lookup service
│       │   └── database.py    # Database operations
│       │   └── config.py      # Reads chainConfig from project.config.yaml
├── packages/
│   └── types/                 # Shared TypeScript types
├── supabase/
│   └── migrations/            # Database migrations (4-layer architecture)
├── docker/
│   ├── docker-compose.yml     # Full stack orchestration
│   ├── Dockerfile.web         # Next.js container
│   ├── Dockerfile.crawler     # Python crawler container
│   └── kong.yml              # API gateway configuration
└── data/
    └── geoip/                # MaxMind GeoIP databases
```

## Database Architecture

### 4-Layer Migration Strategy

The database follows Supabase's official architecture with a professional 4-layer initialization:

**Layer 1: Foundation** (`0001_foundation.sql`)
- Creates all Supabase system users and roles
- `supabase_admin` - superuser for migrations
- `authenticator` - PostgREST connection user (NOINHERIT for security)
- `anon`, `authenticated`, `service_role` - JWT-switchable API roles
- `supabase_auth_admin`, `supabase_storage_admin` - service admins
- Creates `extensions`, `auth`, `storage` schemas
- Installs PostgreSQL extensions (uuid-ossp, pgcrypto, pg_trgm)
- Sets up `supabase_realtime` publication
- Configures default privileges and search paths

**Layer 2: Schema** (`0002_schema.sql`)
- Core tables: `nodes`, `snapshots`, `node_snapshots`, `network_snapshots`
- User features: `verifications`, `verified_nodes`, `node_profiles`
- Monetization: `node_tip_configs`, `tips`
- Views: `nodes_public`, `network_stats`, `leaderboard`
- All constraints, indexes, and relationships

**Layer 3: Functions** (`0003_functions.sql`)
- `auth.uid()` - Extract user UUID from JWT
- `auth.role()` - Extract role from JWT
- `auth.email()` - Extract email from JWT
- `is_admin()` - Check admin status
- Automated triggers for timestamps, profile changes
- Used extensively in RLS policies

**Layer 4: Policies** (`0004_policies.sql`)
- Core tables: `nodes`, `snapshots`, `node_snapshots`, `network_snapshots`
- User features: `verifications`, `verified_nodes`, `node_profiles`
- Monetization: `node_tip_configs`, `tips`
- Views: `nodes_public`, `network_stats`, `leaderboard`
- RLS policies for security
- Triggers for auto-updates

### Key Tables

**nodes** - Discovered blockchain nodes
- Network identity (IP, port, address)
- P2P handshake data (version, protocol, services)
- GeoIP data (country, city, lat/long, ISP, ASN)
- Performance metrics (latency, uptime, reliability)
- Computed fields (tier, PIX score, rank)
- Verification status and customization flags

**verifications** - Node ownership verification challenges
- Multiple methods: message_sign, user_agent, port_challenge, dns_txt
- Challenge/response pattern with expiration
- Status tracking: pending → verified/failed/expired

**node_profiles** - Customization for verified nodes
- Display name, description, avatar
- Social links (Twitter, Discord, Telegram, GitHub, website)
- Tags and public/private toggle

**node_tip_configs** - Tipping configuration
- Wallet addresses for tips
- Accepted coins, minimum amounts
- Thank you messages

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- **Public read**: nodes, snapshots, verified_nodes, tips
- **Authenticated write**: profiles, tip configs (own data only)
- **Service role bypass**: crawler can insert/update nodes

## Key Features

### 1. Node Verification System

**Purpose**: Prove node ownership to unlock profiles and tipping

**Methods**:
1. **Message Signing** (Primary)
   - Node operator signs challenge with private key
   - Backend verifies signature using bitcoinjs-message
   - Most secure and cryptographically sound

2. **User Agent** (Automated)
   - Operator sets custom user agent in node config
   - Crawler detects and matches during scans
   - Convenient for technical users

3. **Port Challenge**
   - Temporarily bind to specific port as proof
   - Crawler validates port response
   - For users who can't access wallet keys

4. **DNS TXT Record** (Domain-based)
   - Add TXT record to domain pointing to node IP
   - Validates domain ownership + node control
   - For nodes with associated domains

**API Endpoints**:
- `POST /api/verify` - Initiate verification, returns challenge
- `POST /api/verify/:id/complete` - Submit proof
- `GET /api/verify/:id` - Check status

**Frontend Flow**:
- VerificationModal component with method selector
- Real-time status updates via Supabase subscription
- Success notification + verified badge appears on map

### 2. Node Profiles & Customization

**Purpose**: Brand your node, showcase operator info

**Features**:
- Display name and description
- Avatar upload (Supabase Storage, 256x256 resized)
- Social links with validation
- Custom tags (e.g., "Community Node", "Exchange")
- Public/private toggle

**API Endpoints**:
- `GET /api/profiles/:nodeId` - Fetch profile
- `PUT /api/profiles/:nodeId` - Update (RLS protected)
- `POST /api/profiles/:nodeId/avatar` - Upload avatar

**Frontend**:
- Node detail page (`/node/[id]`) with full profile display
- ProfileEditor component in dashboard
- AvatarUpload with drag-and-drop

### 3. Node Tipping

**Purpose**: Reward node operators with cryptocurrency tips

**Features**:
- Configure multiple wallet addresses (DINGO, DOGE, BTC)
- QR code generation for easy mobile tipping
- Optional tip tracking (on-chain verification)
- Thank you messages
- Tip statistics (if enabled)

**API Endpoints**:
- `GET /api/nodes/:nodeId/tip-config` - Get tip config
- `PUT /api/nodes/:nodeId/tip-config` - Update (authenticated)
- `POST /api/tips` - Record tip (optional)

**Frontend**:
- TipModal with QR code and copyable address
- "Copy Address" toast confirmation
- Tip history display (if tracking enabled)

### 4. Node Tiers & PIX Score

**Tiers**: Diamond → Gold → Silver → Bronze → Standard

**PIX Score Calculation**:
```
PIX Score = (uptime% × 0.5) + ((100 - latency_avg_ms) × 0.3) + (reliability% × 0.2)
```

**Tier Thresholds**:
- Diamond: PIX > 950, uptime > 99%, latency < 50ms
- Gold: PIX > 900, uptime > 98%, latency < 100ms
- Silver: PIX > 850, uptime > 95%, latency < 200ms
- Bronze: PIX > 800, uptime > 90%, latency < 500ms
- Standard: Everything else

**Visual Design**:
- Color-coded markers on map
- Tier badges on profiles
- Leaderboard sorting by tier + PIX score

### 5. Statistics Dashboard

**Location**: `/stats` page

**Components**:
- Network health score (aggregate metric)
- Total/online nodes, country count, version stats
- Version distribution (pie chart)
- Country distribution (bar chart)
- Tier distribution (stacked bar)
- Historical trends (line chart, 7/30/90 days)
- Geographic heatmap (Leaflet)

**Data Sources**:
- `network_stats` view (real-time aggregation)
- `network_snapshots` table (historical data)
- Recharts for visualizations

### 6. Leaderboard

**Location**: `/leaderboard` page

**Features**:
- Sortable by: rank, PIX score, uptime, latency
- Filterable by: tier, country, verified status
- Top 3 podium styling
- Rank change indicators (↑↓)
- Pagination or infinite scroll
- "Your Node" highlighting (if authenticated)

**API**:
- Uses `leaderboard` view (materialized for performance)
- `GET /api/leaderboard?tier=gold&country=US&sort=pix_score`

### 7. Real-time Updates

**Implementation**:
- Supabase Realtime WebSocket subscriptions
- `useNodes` hook subscribes to `nodes` table changes
- Automatic refetch on INSERT/UPDATE/DELETE
- Optimistic updates for better UX
- Toast notifications for important events

**Realtime Publication**:
- `nodes` table added to `supabase_realtime` publication
- Enable per-table: `ALTER PUBLICATION supabase_realtime ADD TABLE nodes;`

**Notification Types**:
- New node discovered
- Node status changed (up/down)
- Tier upgrade
- Verification completed

## P2P Network Crawler

### Protocol Implementation

The crawler implements Bitcoin P2P protocol for node discovery:

**Handshake Flow**:
1. Send `version` message with protocol version
2. Receive `version` response
3. Exchange `verack` acknowledgments
4. Send `getaddr` to request peer list
5. Receive `addr` with peer addresses

**Data Collection**:
- IP address and port
- Version string (e.g., `/Bitcoin:0.21.0/`)
- Protocol version number
- Services bitmask
- Start height (blockchain tip)
- User agent (parsed for verification)
- Connection latency

### Chain Adapters

**Architecture**: Multi-chain support via adapter pattern

```python
class ChainAdapter:
    def get_network_magic(self) -> bytes
    def get_default_port(self) -> int
    def get_dns_seeds(self) -> List[str]
    def parse_version_string(self, version: str) -> Dict
```

**Supported Chains**:
- Bitcoin (via config)
- Litecoin (via config)
- Dogecoin (via config)
- Dingocoin (example in config/project.config.yaml.example)
- Any Bitcoin-derived chain (configure in project.config.yaml)

### Crawler Configuration

**Environment Variables**:
- `CHAIN` - Which blockchain to crawl (default: bitcoin)
- `CRAWLER_INTERVAL_MINUTES` - Crawl frequency (default: 5)
- `MAX_CONCURRENT_CONNECTIONS` - Connection pool size (default: 100)
- `CONNECTION_TIMEOUT_SECONDS` - Socket timeout (default: 10)
- `SUPABASE_SERVICE_ROLE_KEY` - Database access key
- `GEOIP_DB_PATH` - MaxMind database location

**Docker Deployment**:
```bash
docker compose --profile crawler up -d
```

## API Endpoints

### Public Endpoints (No Auth Required)

**Nodes**:
- `GET /api/nodes` - List nodes with filtering
  - Query params: `page`, `limit`, `tier`, `country`, `version`, `verified`, `online`, `sort`, `order`
  - Returns: `{ nodes: [], pagination: {} }`

**Statistics**:
- `GET /api/stats` - Network statistics
  - Returns: Total/online nodes, countries, version/country/tier distributions, historical data

**Leaderboard**:
- `GET /api/leaderboard` - Top nodes by PIX score
  - Query params: `page`, `limit`, `tier`, `country`, `verified`
  - Returns: Ranked nodes with performance metrics

**Profiles**:
- `GET /api/profiles/:nodeId` - Public node profile (if `is_public=true`)

### Authenticated Endpoints (JWT Required)

**Verification**:
- `POST /api/verify` - Start node verification
  - Body: `{ nodeId, method }`
  - Returns: Challenge object
- `POST /api/verify/:id/complete` - Submit verification proof
  - Body: `{ proof }` (signature, user agent, etc.)
- `GET /api/verify/:id` - Check verification status

**Profile Management**:
- `PUT /api/profiles/:nodeId` - Update node profile (owner only, RLS enforced)
  - Body: `{ displayName, description, avatarUrl, socialLinks, tags, isPublic }`
- `POST /api/profiles/:nodeId/avatar` - Upload avatar
  - Body: FormData with image file
  - Returns: `{ url }` - CDN URL

**Tipping**:
- `PUT /api/nodes/:nodeId/tip-config` - Configure tipping (owner only)
  - Body: `{ walletAddress, acceptedCoins, minimumTip, thankYouMessage, isActive }`
- `POST /api/tips` - Record tip (optional)
  - Body: `{ nodeId, txHash, amount, coin, fromAddress }`

## Authentication & Authorization

### Supabase Auth

**Authentication Methods**:
- Email/password
- Magic link (passwordless)
- Social OAuth (optional: GitHub, Google)

**Session Management**:
- Next.js middleware for protected routes
- Server-side session with cookies
- JWT tokens in localStorage for client-side

### Admin System (Dual-Tier Architecture)

**Purpose**: Secure admin access with permanent super admins and database-managed regular admins

**Tier 1: Super Admins** (Environment Variable)
- Defined in `ADMIN_EMAILS` environment variable
- Permanent admin access, cannot be removed via UI
- Comma-separated email list: `ADMIN_EMAILS=admin@example.com,super@example.com`
- Checked by `isUserAdmin()` function in API routes
- Never committed to git (stored in `.env`, not `.env.example`)

**Tier 2: Regular Admins** (Database Table)
- Stored in `admin_users` table:
  - `user_id` (PRIMARY KEY) - References auth.users
  - `role` - Admin role type ('moderator', 'support', etc.)
  - `granted_by` - Super admin who granted access
  - `is_active` - Active status (can be revoked)
  - `revoked_at` - Timestamp when revoked
- Added/removed by super admins via `/api/admin/users` POST endpoint
- Checked by `is_admin()` database function for RLS policies
- Can be revoked if needed

**Implementation**:

1. **Environment-Based Checks** (`isUserAdmin()` function):
   - Only checks `ADMIN_EMAILS` environment variable
   - Does NOT check `admin_users` table
   - Used by API routes for server-side authorization
   - Located in `apps/web/src/lib/security.ts`

2. **Database Function** (`is_admin()` in Supabase):
   ```sql
   CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
   BEGIN
     RETURN EXISTS (
       SELECT 1 FROM admin_users
       WHERE user_id = auth.uid() AND is_active = true
     );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
   - Only checks `admin_users` table
   - Does NOT check environment variable
   - Used by RLS policies for database-level authorization

3. **Combined Authorization**:
   - User is admin if EITHER condition is true:
     - Email in `ADMIN_EMAILS` (super admin)
     - OR `admin_users.is_active = true` (regular admin)

**Admin Operations**:
- User management: List, promote, demote, ban, unban, delete
- Uses service role client (`createAdminClient()`) to bypass RLS
- Upsert operation with `onConflict: 'user_id'` for reactivating revoked admins
- Protects super admins from deletion/banning
- Prevents self-deletion

**Security Measures**:
- Row Level Security (RLS) on `admin_users` table
- Service role client used for admin API operations
- Middleware clears invalid session cookies
- Cannot delete/ban super admins or own account

### Row Level Security (RLS)

**Policy Examples**:

```sql
-- Anyone can view nodes
CREATE POLICY "Nodes are viewable by everyone"
  ON nodes FOR SELECT USING (true);

-- Service role can manage nodes (crawler)
CREATE POLICY "Service role can manage nodes"
  ON nodes FOR ALL
  USING (auth.role() = 'service_role');

-- Users can update their own profiles
CREATE POLICY "Users can update own profiles"
  ON node_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view admin_users table
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (is_admin());
```

## Development Setup

### Prerequisites

- Node.js 20+ and pnpm 9+
- Docker and Docker Compose
- Python 3.12+ (for local crawler development)
- MaxMind account for GeoIP database

### Quick Start (Use Makefile Commands!)

**1. First Time Setup**:
```bash
make setup-docker   # Creates .env, installs deps
```

**2. Start Development**:
```bash
make dev            # Starts full stack (DB + Web + Crawler)
```

**3. Access the Application**:
- **Web App**: http://localhost:4000
- **Supabase Studio**: http://localhost:4022
- **API**: http://localhost:4020

### Key Makefile Commands

Run `make help` to see all available commands:

```bash
# Setup
make setup-docker   # First time setup (local Docker)
make setup-cloud    # First time setup (Supabase Cloud)
make setup-fork     # Setup for forking

# Development
make dev            # Start development stack
make down           # Stop all services
make restart        # Restart development
make logs           # View all logs
make logs-web       # View web app logs
make logs-crawler   # View crawler logs

# Database
make migrate        # Run migrations
make db-shell       # PostgreSQL shell

# Production
make prod-docker    # Production (self-hosted)
make prod-cloud     # Production (cloud DB)

# Code Quality
make lint           # Run ESLint
make typecheck      # TypeScript check
make build          # Production build
make test           # Run tests
```

### Port Configuration

**All Ports: 4000-4100 Range**:
- **Development Server**: 4000 (via `make dev`)
- **Testing Server**: 4001 (automatic during tests)
- **Kong API**: 4020
- **PostgreSQL**: 4021
- **Supabase Studio**: 4022
- **Inbucket Web**: 4023
- **Inbucket SMTP**: 4024
- **Kong SSL**: 4025

### Database Migrations

**Running Migrations**:
```bash
# Migrations auto-run on container start via /docker-entrypoint-initdb.d/
# Or manually:
docker exec -i atlasp2p-db psql -U supabase_admin -d postgres < supabase/migrations/0001_foundation.sql
```

**Migration Order** (critical):
1. `0001_foundation.sql` - Roles, schemas, extensions
2. `0002_schema.sql` - Tables, constraints, indexes
3. `0003_functions.sql` - Database functions and triggers
4. `0004_policies.sql` - Row Level Security policies

### Accessing Services

- **Web App**: http://localhost:4000 (development)
- **Supabase Studio**: http://localhost:4022
- **Kong API**: http://localhost:4020
- **PostgreSQL**: localhost:4021 (user: postgres, password: postgres)
- **PostgREST**: http://localhost:4020/rest/v1
- **Inbucket (Email)**: http://localhost:4023

**CRITICAL**: Always use `make dev` to start on port 4000. ALL services use ports 4000-4100.

## Production Deployment

### Environment Variables

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-only)
- `MAXMIND_ACCOUNT_ID` - MaxMind account ID
- `MAXMIND_LICENSE_KEY` - MaxMind license key

**Optional**:
- `CRAWLER_INTERVAL_MINUTES` - Crawl frequency
- `MAX_CONCURRENT_CONNECTIONS` - Crawler concurrency
- `GEOIP_DB_PATH` - GeoIP database path

### Deployment Checklist

- [ ] Set up Supabase cloud project
- [ ] Run migrations on production database
- [ ] Configure RLS policies
- [ ] Set up Supabase Storage bucket for avatars
- [ ] Download MaxMind GeoIP database
- [ ] Deploy Next.js app to Vercel/Netlify
- [ ] Deploy crawler to VPS/cloud (continuous)
- [ ] Set up monitoring and alerts
- [ ] Configure CDN for static assets
- [ ] Enable SSL/TLS

## Key Design Decisions

### Why Next.js App Router?

- Server Components for better performance
- Built-in API routes (serverless)
- Excellent TypeScript support
- RSC enables server-side data fetching without client-side overhead

### Why Supabase?

- PostgreSQL with PostgREST = instant REST API
- Built-in auth with JWT
- Real-time subscriptions via WebSocket
- Row Level Security for fine-grained access control
- Generous free tier for open source projects

### Why Python for Crawler?

- Excellent async support with asyncio
- Simple socket programming
- Rich ecosystem for networking
- MaxMind GeoIP2 has official Python library

### Why Turborepo?

- Fast builds with caching
- Simple monorepo management
- Shared TypeScript types between packages
- Clear dependency graph

## Performance Optimizations

1. **Database Indexes**: All frequently queried columns indexed
2. **Materialized Views**: Leaderboard pre-computed, refreshed every 5 min
3. **API Pagination**: All list endpoints support pagination
4. **Map Clustering**: Supercluster reduces marker count at low zoom
5. **Image Optimization**: Next.js Image component for avatars
6. **Real-time Throttling**: Subscription updates throttled to prevent UI thrashing
7. **CDN Delivery**: Static assets served via CDN
8. **Connection Pooling**: PostgreSQL connection pooler (pgbouncer)

## Security Considerations

1. **Row Level Security**: All tables protected with RLS policies
2. **JWT Validation**: All authenticated requests validated
3. **Input Validation**: Zod schemas for API inputs
4. **SQL Injection**: PostgREST parameterizes all queries
5. **XSS Protection**: React escapes all user content
6. **CORS Configuration**: Restricted to allowed origins
7. **Rate Limiting**: Kong API Gateway rate limits
8. **Secrets Management**: Environment variables, never committed

## Future Enhancements

- [ ] Multi-chain support (Dogecoin, Litecoin, Bitcoin)
- [ ] Mobile app (React Native)
- [ ] Network health alerts (email/webhook)
- [ ] Embeddable widgets (iframe badges)
- [ ] Public API with rate limiting
- [ ] Node comparison tool
- [ ] Historical data export (CSV/JSON)
- [ ] Analytics dashboard with ML-based anomaly detection

## Contributing

See CONTRIBUTING.md for development guidelines.

## License

MIT License - see LICENSE file for details.
