# Forking Guide: Create Your Own Blockchain Nodes Map

This guide walks you through forking this project to create a nodes map for **any** cryptocurrency blockchain.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (5 minutes)](#quick-start-5-minutes)
3. [Detailed Setup](#detailed-setup)
4. [Crawler Configuration](#crawler-configuration)
5. [Database Setup](#database-setup)
6. [Customization](#customization)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- [ ] **Node.js 20+** and **pnpm 9+** installed
- [ ] **Docker** and **Docker Compose** (for local database)
- [ ] **Python 3.11+** (for running the crawler)
- [ ] **MaxMind account** (free) for GeoIP data
- [ ] **Supabase account** (free tier works) OR self-hosted Supabase
- [ ] Basic knowledge of your blockchain's P2P protocol

---

## Quick Start (5 minutes)

### Step 1: Fork and Clone

```bash
# Fork this repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/AtlasP2P.git
cd AtlasP2P
```

### Step 2: Fork Setup (One Command!)

```bash
make setup-fork
```

**This automatically:**
- ✅ Runs `pnpm install` to install dependencies
- ✅ Creates `.env` from template
- ✅ Creates `config/project.config.yaml` from example
- ✅ Shows you the next steps

### Step 3: Edit Configuration

Edit `/config/project.config.yaml` with your blockchain's details:

```yaml
projectName: YourCoin Nodes Map
chain: yourcoin

chainConfig:
  name: YourCoin
  ticker: YOUR
  p2pPort: 12345      # Your blockchain's P2P port
  rpcPort: 12346      # Your blockchain's RPC port
  protocolVersion: 70015
  currentVersion: "1.0.0"
  websiteUrl: https://yourcoin.org
  githubUrl: https://github.com/yourcoin/yourcoin

themeConfig:
  primaryColor: "#YOUR_BRAND_COLOR"
  logo: /logos/yourcoin.png
  favicon: /logos/yourcoin-favicon.ico

content:
  siteName: YourCoin Nodes Map
  siteDescription: Real-time YourCoin network nodes map
  social:
    - name: GitHub
      href: https://github.com/yourcoin/yourcoin
      icon: github
```

See `CONFIGURATION.md` for complete options.

**Committing Your Fork Config:**

AtlasP2P upstream gitignores `project.config.yaml` to allow local development. **Forks should commit this file!**

```bash
# Validate your config
make config-check

# Test your changes (if running)
docker restart atlasp2p-web

# Commit with -f to override gitignore
git add -f config/project.config.yaml
git commit -m "Configure for YourCoin"
git push origin master
```

**Why this works:**
- ✅ Upstream never modifies `.yaml` (only `.example`)
- ✅ No merge conflicts when pulling upstream
- ✅ CI/CD works (committed file exists)
- ✅ No .gitignore modifications needed

**Example Configs:** See `config/examples/` for real-world examples (Dingocoin, Dogecoin).

### Step 4: Add Your Logos

The project includes **template SVG files** in `apps/web/public/logos/` to guide you:

```bash
# Template files (use as guides - they show you what to replace):
TEMPLATE-logo.svg        → Replace with your main logo
TEMPLATE-logo-512.svg    → Replace with your OG image
TEMPLATE-favicon.svg     → Replace with your favicon
```

**Replace template files with your branding**:

```bash
# Option 1: Direct replacement
cp your-logo.png apps/web/public/logos/logo.png
cp your-logo-512.png apps/web/public/logos/logo-512.png
cp your-favicon.ico apps/web/public/logos/favicon.ico

# Option 2: Named after your coin (update config paths)
cp your-logo.png apps/web/public/logos/yourcoin.png
cp your-favicon.ico apps/web/public/logos/yourcoin-favicon.ico
```

**Logo Requirements**:
- **Main logo** (`logo.png` or `TEMPLATE-logo.svg`):
  - Size: 256x256px (or scalable SVG)
  - Format: PNG or SVG (SVG preferred)
  - Background: Transparent recommended
  - Usage: Navigation header, footer, loading screens

- **Favicon** (`favicon.ico` or `TEMPLATE-favicon.svg`):
  - Size: 32x32px or 64x64px
  - Format: ICO, PNG, or SVG
  - Usage: Browser tab icon

- **OG Image** (`logo-512.png` or `TEMPLATE-logo-512.svg`):
  - Size: 512x512px or 1200x630px
  - Format: PNG or SVG
  - Usage: Social media previews (Twitter, Facebook, Discord)

See `apps/web/public/logos/README.md` for detailed logo guidelines and best practices.

### Step 4: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required variables:
```bash
# Supabase (get from supabase.com dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# MaxMind GeoIP (get from maxmind.com)
MAXMIND_ACCOUNT_ID=123456
MAXMIND_LICENSE_KEY=xxxxx
```

### Step 5: Build and Run

```bash
# Build the project
pnpm build

# Start local Supabase (includes PostgreSQL)
make up

# Download GeoIP databases
make geoip-download

# Start the web app
make dev
# Opens at http://localhost:4000
```

**That's it!** You now have a working nodes map. Continue reading for crawler setup and deployment.

---

## Detailed Setup

### 1. Supabase Setup

#### Option A: Supabase Cloud (Recommended)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (takes ~2 minutes to provision)
3. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **SQL Editor** and run migrations:
   - Copy contents of `/supabase/migrations/00000_supabase_core.sql` and run
   - Copy contents of `/supabase/migrations/00000_supabase_schemas.sql` and run
   - Copy contents of `/supabase/migrations/00001_supabase_auth.sql` and run
   - Copy contents of `/supabase/migrations/00002_initial_schema.sql` and run

#### Option B: Local Supabase (Docker)

```bash
# Start local Supabase stack
make up

# Migrations run automatically on first start
# Access Supabase Studio at http://localhost:4022
```

**Local credentials** (from `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:4020
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. MaxMind GeoIP Setup

GeoIP databases convert IP addresses to geographic locations.

1. Go to [maxmind.com](https://www.maxmind.com/en/geolite2/signup)
2. Create a free GeoLite2 account
3. Go to **Account → Manage License Keys**
4. Create a new license key
5. Add credentials to `.env`:
   ```bash
   MAXMIND_ACCOUNT_ID=123456
   MAXMIND_LICENSE_KEY=xxxxxxxxxxxxx
   ```
6. Download databases:
   ```bash
   make geoip-download
   ```

This downloads `GeoLite2-City.mmdb` and `GeoLite2-ASN.mmdb` to `/data/geoip/`.

---

## Crawler Configuration

The crawler discovers nodes on your blockchain's P2P network.

### 1. Create Chain Adapter

Create `/apps/crawler/src/adapters/yourcoin.py`:

```python
"""YourCoin chain adapter"""
from dataclasses import dataclass
from typing import List

@dataclass
class ChainConfig:
    name: str
    ticker: str
    magic_bytes: bytes
    protocol_version: int
    p2p_port: int
    dns_seeds: List[str]
    user_agent: str

YOURCOIN_CONFIG = ChainConfig(
    name="YourCoin",
    ticker="YOUR",
    magic_bytes=bytes([0xAB, 0xCD, 0xEF, 0x12]),  # Your chain's magic bytes
    protocol_version=70015,                        # Your protocol version
    p2p_port=12345,                                # Your P2P port
    dns_seeds=[
        "seed1.yourcoin.org",
        "seed2.yourcoin.org",
        "dnsseed.yourcoin.org",
    ],
    user_agent="/NodesMap:1.0.0/",
)
```

**How to find your chain's values**:

- **Magic bytes**: Check your blockchain's source code (usually in `chainparams.cpp` or similar)
  - Bitcoin: `0xF9BEB4D9`
  - Dogecoin: `0xC0C0C0C0`
  - Dingocoin: `0xC1C1C1C1`
  - Look for `pchMessageStart` or `netMagic`

- **Protocol version**: Usually in `version.h` or protocol documentation
  - Look for `PROTOCOL_VERSION` constant

- **DNS seeds**: Usually in `chainparams.cpp`
  - Look for `vSeeds` array
  - These are DNS servers that return node IP addresses

### 2. Register Adapter

Edit `/apps/crawler/src/config.py`:

```python
from adapters.yourcoin import YOURCOIN_CONFIG

CHAINS = {
    "yourcoin": YOURCOIN_CONFIG,
    "dingocoin": DINGOCOIN_CONFIG,  # Keep existing
    # ... other chains
}
```

### 3. Test Crawler Locally

```bash
# Set environment
export CHAIN=yourcoin
export SUPABASE_SERVICE_ROLE_KEY=your-key
export MAXMIND_ACCOUNT_ID=your-id
export MAXMIND_LICENSE_KEY=your-key

# Run crawler once
cd apps/crawler
python -m src.crawler
```

Expected output:
```
[INFO] Starting YourCoin node crawler
[INFO] Fetching seeds from DNS...
[INFO] Found 15 seed nodes
[INFO] Connecting to 10.0.0.1:12345...
[INFO] Handshake successful: /YourCoin:1.0.0/
[INFO] Discovered 42 peers from node
[INFO] Processed 100 nodes in 45.2s
[INFO] Saved to database: 87 online, 13 offline
```

### 4. Run Crawler Continuously

```bash
# Using Docker Compose
docker compose --profile crawler up -d

# Or using systemd service (production)
# See deployment section
```

---

## Database Setup

### Understanding the Schema

The database has 4 main tables:

1. **`nodes`** - All discovered nodes with GeoIP data
2. **`node_snapshots`** - Historical uptime data (per node)
3. **`network_snapshots`** - Aggregate network stats (hourly/daily)
4. **`verifications`** - Node ownership verification challenges

### Populating Initial Data

The crawler automatically populates data, but you can manually test:

```sql
-- Test insert (via Supabase SQL Editor)
INSERT INTO nodes (
  chain,
  address,
  port,
  status,
  version,
  protocol_version,
  latitude,
  longitude,
  country_code,
  country_name,
  city
) VALUES (
  'yourcoin',
  '192.0.2.1',
  12345,
  'up',
  '/YourCoin:1.0.0/',
  70015,
  37.7749,
  -122.4194,
  'US',
  'United States',
  'San Francisco'
);
```

### Verify Data

```bash
# Check nodes count
curl http://localhost:4000/api/stats

# Expected response:
{
  "totalNodes": 42,
  "onlineNodes": 38,
  "countries": 15,
  "versionDistribution": [...],
  "countryDistribution": [...]
}
```

---

## Customization

### Theme Colors

Edit `/config/project.config.yaml`:

```yaml
themeConfig:
  primaryColor: "#ff8c00"    # Buttons, charts, active states
  secondaryColor: "#ffa500"  # Hover states
  accentColor: "#ffb347"     # Highlights, badges
```

Restart web container to see changes: `docker restart atlasp2p-web`

### Map Tile Styles

Add custom map styles:

```yaml
mapConfig:
  tileStyles:
    - id: custom-dark
      name: Dark Theme
      url: https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
      attribution: "&copy; CARTO &copy; OpenStreetMap"
      maxZoom: 20
      subdomains: [a, b, c, d]

  defaultTileStyle: custom-dark
```

Popular tile providers:
- **CARTO** (free): `basemaps.cartocdn.com`
- **OpenStreetMap** (free): `tile.openstreetmap.org`
- **Mapbox** (requires API key): `api.mapbox.com`
- **Stadia** (requires API key): `tiles.stadiamaps.com`

### Navigation and Links

```yaml
content:
  navigation:
    - name: Explorer
      href: https://explorer.yourcoin.org
      icon: barchart
      external: true

  social:
    - name: Reddit
      href: https://reddit.com/r/yourcoin
      icon: reddit
    - name: Telegram
      href: https://t.me/yourcoin
      icon: telegram

  footerLinks:
    - label: Documentation
      href: /docs
      external: false
```

### Feature Flags

Disable features you don't need:

```yaml
features:
  verification:
    enabled: false    # Disable node verification
  tipping:
    enabled: false    # Disable tipping system
  community:
    nodeSubmission: false    # Disable manual node submission
    leaderboard: false       # Disable leaderboard
```

---

## Deployment

### Option 1: Vercel (Web App Only - Recommended)

1. Push your changes to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy! ✨

**Deploy crawler separately** (see below)

### Option 2: Docker Compose (Full Stack)

```bash
# Build all containers
docker compose build

# Start everything
docker compose --profile crawler up -d

# View logs
docker compose logs -f
```

Services:
- Web app: http://localhost:4000
- Supabase Studio: http://localhost:4022
- PostgreSQL: localhost:4021

### Option 3: VPS (Production)

#### Web App (Vercel/Netlify)
See Option 1

#### Crawler (VPS/Cloud Server)

**Using systemd**:

Create `/etc/systemd/system/yourcoin-crawler.service`:

```ini
[Unit]
Description=YourCoin Nodes Map Crawler
After=network.target

[Service]
Type=simple
User=crawler
WorkingDirectory=/opt/atlasp2p/apps/crawler
Environment="CHAIN=yourcoin"
Environment="CRAWLER_INTERVAL_MINUTES=5"
Environment="SUPABASE_SERVICE_ROLE_KEY=your-key"
Environment="MAXMIND_ACCOUNT_ID=your-id"
Environment="MAXMIND_LICENSE_KEY=your-key"
ExecStart=/usr/bin/python3 -m src.crawler
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable yourcoin-crawler
sudo systemctl start yourcoin-crawler
sudo systemctl status yourcoin-crawler
```

**Using Docker**:

```bash
# Build crawler image
docker build -f docker/Dockerfile.crawler -t yourcoin-crawler .

# Run crawler
docker run -d \
  --name yourcoin-crawler \
  --restart unless-stopped \
  -e CHAIN=yourcoin \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e MAXMIND_ACCOUNT_ID=your-id \
  -e MAXMIND_LICENSE_KEY=your-key \
  -v $(pwd)/data/geoip:/app/data/geoip:ro \
  yourcoin-crawler
```

### Domain and SSL

1. Point your domain to Vercel/Netlify (web app)
2. Configure custom domain in Vercel/Netlify dashboard
3. SSL certificate is automatic ✅

---

## Troubleshooting

### Build Errors

#### Error: "Module not found: Can't resolve 'fs'"
**Cause**: Trying to use Node.js modules in client code
**Fix**: Ensure `@atlasp2p/config/loader.server` is only imported in server-side code (API routes, server components)

#### Error: "Project configuration not initialized"
**Cause**: Config not loaded before component renders
**Fix**: Ensure `ConfigProvider` wraps your app in `layout.tsx`

### Crawler Issues

#### Error: "Connection refused"
**Cause**: Node not reachable or wrong port
**Fix**:
- Verify `p2pPort` in config matches your blockchain
- Check if DNS seeds are responsive: `dig seed1.yourcoin.org`
- Test manual connection: `telnet node-ip 12345`

#### Error: "Invalid magic bytes"
**Cause**: Wrong network magic in adapter
**Fix**: Check your blockchain's `chainparams.cpp` for correct `pchMessageStart`

#### Error: "No nodes discovered"
**Cause**: DNS seeds not returning IPs
**Fix**:
- Verify DNS seeds: `dig seed1.yourcoin.org`
- Add hardcoded seed IPs to adapter temporarily
- Check if nodes are actually online on your network

### Database Issues

#### Error: "Relation 'nodes' does not exist"
**Cause**: Migrations not run
**Fix**: Run all migrations in order (see Supabase Setup)

#### Error: "Row Level Security policy violation"
**Cause**: Trying to write as anon user (should use service role)
**Fix**: Ensure crawler uses `SUPABASE_SERVICE_ROLE_KEY`, not `ANON_KEY`

### No Nodes Showing on Map

1. **Check database has data**:
   ```bash
   curl http://localhost:4000/api/nodes
   ```
   Should return array of nodes

2. **Check GeoIP data**:
   ```sql
   SELECT address, latitude, longitude FROM nodes LIMIT 10;
   ```
   If lat/long are NULL, GeoIP lookup failed

3. **Check browser console**:
   - Open DevTools → Console
   - Look for errors or failed API calls

4. **Verify Supabase connection**:
   - Check `NEXT_PUBLIC_SUPABASE_URL` is correct
   - Check Supabase project is not paused (free tier auto-pauses after 7 days inactive)

---

## Example Configurations

### Dogecoin

```yaml
projectName: Dogecoin Nodes Map
chain: dogecoin

chainConfig:
  name: Dogecoin
  ticker: DOGE
  p2pPort: 22556
  protocolVersion: 70015
  websiteUrl: https://dogecoin.com

themeConfig:
  primaryColor: "#c2a633"
  logo: /logos/dogecoin.png
```

Python adapter:
```python
DOGECOIN_CONFIG = ChainConfig(
    name="Dogecoin",
    ticker="DOGE",
    magic_bytes=bytes([0xC0, 0xC0, 0xC0, 0xC0]),
    protocol_version=70015,
    p2p_port=22556,
    dns_seeds=[
        "seed.multidoge.org",
        "seed2.multidoge.org",
    ],
    user_agent="/NodesMap:1.0.0/",
)
```

### Bitcoin

```yaml
projectName: Bitcoin Nodes Map
chain: bitcoin

chainConfig:
  name: Bitcoin
  ticker: BTC
  p2pPort: 8333
  protocolVersion: 70016
  websiteUrl: https://bitcoin.org

themeConfig:
  primaryColor: "#f7931a"
  logo: /logos/bitcoin.png
```

Python adapter:
```python
BITCOIN_CONFIG = ChainConfig(
    name="Bitcoin",
    ticker="BTC",
    magic_bytes=bytes([0xF9, 0xBE, 0xB4, 0xD9]),
    protocol_version=70016,
    p2p_port=8333,
    dns_seeds=[
        "seed.bitcoin.sipa.be",
        "dnsseed.bluematt.me",
        "dnsseed.bitcoin.dashjr.org",
    ],
    user_agent="/NodesMap:1.0.0/",
)
```

---

## Checklist: Launch Your Nodes Map

- [ ] Fork repository and clone locally
- [ ] Edit `/config/project.config.yaml` with your blockchain details
- [ ] Add logos to `/apps/web/public/logos/`
- [ ] Create `.env` with Supabase and MaxMind credentials
- [ ] Run migrations on Supabase
- [ ] Create chain adapter in `/apps/crawler/src/adapters/`
- [ ] Test crawler locally
- [ ] Build and run web app (`pnpm build && make dev`)
- [ ] Verify nodes appear on map
- [ ] Deploy web app to Vercel/Netlify
- [ ] Deploy crawler to VPS/Docker
- [ ] Configure custom domain
- [ ] Set up monitoring/alerts
- [ ] Announce to your community! 🎉

---

## Getting Help

- **Documentation**: See `CONFIGURATION.md` for all config options
- **Examples**: Check `/config/examples/` for reference configs
- **Issues**: Open an issue on GitHub
- **Community**: Join our Discord (link in README)

---

## Additional Topics

### Custom Node Tiers

Node tier thresholds are calculated in the database tier calculation logic. To customize tier colors and icons, edit `/config/project.config.yaml`:

```yaml
themeConfig:
  tierColors:
    diamond:
      color: "#00d4ff"
      icon: "gem"
      label: "Diamond"
    gold:
      color: "#ffd700"
      icon: "trophy"
    # ... etc
```

### Custom PIX Score Formula

Edit `/apps/web/src/lib/pix.ts`:

```typescript
export function calculatePIX(
  uptime: number,
  latency: number,
  reliability: number
): number {
  return (
    uptime * 0.5 +
    (100 - latency) * 0.3 +
    reliability * 0.2
  );
}
```

### Multi-Chain Support

To support multiple chains in one deployment:

1. Update `config/project.config.yaml` with multi-chain configuration
2. Run separate crawler instances for each chain
3. Use chain-specific configs in database
4. Filter all queries by `chain` column

---

## Success Stories

Once launched, consider:
- Adding your project to [nodes.fyi](https://nodes.fyi) directory
- Announcing on your blockchain's forum/Reddit
- Tweeting with hashtag `#NodesMap`
- Contributing improvements back upstream

Happy forking! 🚀
