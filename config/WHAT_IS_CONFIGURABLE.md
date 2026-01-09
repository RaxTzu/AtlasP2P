# What's Configurable via YAML

This document outlines **EVERYTHING** you can customize by editing `/config/project.config.yaml`.

## ✅ Fully Controlled by YAML Config

### 1. Project Branding
- **Project Name** - Shown in header, page titles
- **Site Description** - Meta description for SEO
- **Site URL** - Canonical URL
- **Copyright Text** - Footer message
- **GitHub Repo URL** - Link in footer

### 2. Blockchain Configuration
- **Chain Name** - Display name (e.g., "Dingocoin")
- **Ticker** - Symbol (e.g., "DINGO")
- **P2P Port** - Network port (e.g., 33117)
- **RPC Port** - RPC port (e.g., 22892)
- **Protocol Version** - P2P protocol version
- **Current Version** - Latest node software version
- **Minimum Version** - Minimum acceptable version
- **Critical Version** - Outdated threshold
- **Explorer URL** - Block explorer link
- **Website URL** - Official website link
- **GitHub URL** - Source code repository

### 3. Theme & Visual Design
- **Primary Color** - Main brand color (hex, used in buttons, icons, charts)
- **Secondary Color** - Secondary accent color
- **Accent Color** - Highlight color
- **Logo Path** - Path to logo image
- **Favicon Path** - Path to favicon
- **OG Image Path** - Open Graph image for social sharing

### 4. Navigation & Links
- **Navigation Items** - Header menu items with:
  - name (display text)
  - href (URL path)
  - icon (icon name)
  - external (true/false for external links)

- **Footer Links** - Footer middle section links
  - label
  - href
  - external (true/false)

- **Social Links** - Social media icons/links
  - name (display name)
  - href (URL)
  - icon (github, twitter, discord, telegram, reddit, youtube, medium, linkedin)

### 5. Map Customization
- **Default Center** - Starting map position [lat, long]
- **Default Zoom** - Starting zoom level
- **Min/Max Zoom** - Zoom level limits
- **Cluster Radius** - How aggressively to cluster nodes
- **Cluster Max Zoom** - Zoom level to stop clustering

- **Tile Styles** - Custom map tile layers with:
  - id (unique identifier, required)
  - name (display name in switcher, required)
  - attribution (copyright text, required)
  - url (raster tile URL pattern) OR styleUrl (vector style URL)
  - description (tooltip/help text, optional)
  - icon (Lucide icon name, optional)
  - urlDark (alternative URL for dark mode, optional)
  - filterDark (alternative CSS filter for dark mode, optional)
  - maxZoom (max zoom for tiles, optional)
  - subdomains (tile server subdomains, optional)
  - filter (CSS filter for color adjustments, optional)
  - accessibility (accessibility level: low | medium | high | aaa, optional)

- **Default Tile Style** - Which tile style to show by default

### 6. Admin & Notification Configuration
- **Admin Emails** - Array of admin email addresses for system alerts
- **Semantic Colors** - UI state colors (success, warning, error, info) with:
  - success (green for online nodes, successful operations)
  - warning (amber for outdated versions, warnings)
  - error (red for offline nodes, critical alerts)
  - info (blue for informational messages)
- **Email Provider** - Email service (resend, sendgrid, smtp, disabled)
- **From Email/Name** - Sender information for user emails
- **Alerts From Email/Name** - Optional separate sender for system alerts
- **Email Verification Settings** - autoConfirm, verificationRequired
- **OTP Settings** - Expiry time, max resend attempts, cooldown
- **Alert Thresholds** - Node count drop %, health score threshold, cooldown

### 7. Feature Flags

Control which features are enabled:

**Map Features:**
- clustering, heatmap, liveUpdates

**Stats Features:**
- versionChart, countryChart, healthScore

**Filter Features:**
- byCountry, byVersion, byTier, byStatus, search

**Node Features:**
- categories, rankings, uptimeTracking, historicalData

**Verification Features:**
- messageSign, userAgent, portChallenge, dnsTxt

**Tipping Features:**
- enabled, tracking

**Community Features:**
- nodeSubmission, leaderboard, badges

**UI Features:**
- darkMode, themeSwitcher

### 8. Deployment Configuration

Control production deployment behavior:

**Deployment Mode:**
- mode (self-hosted-docker | self-hosted-cloud)

**Docker Registry:**
- type (ghcr | ecr) - GitHub Container Registry or AWS Elastic Container Registry
- public (true/false) - Make GHCR images public (no auth needed on host)
- region (string) - AWS region for ECR (e.g., us-east-1)

**Caddy Configuration:**
- enabled (true/false) - Enable Caddy reverse proxy
- mode (auto | container | host | none) - Caddy deployment mode

**Secrets Management:**
- source (auto | aws-ssm | github-secrets | manual) - Where to fetch secrets
- ssmPath (string) - AWS SSM parameter path (if using aws-ssm)

**Health Check:**
- enabled (true/false)
- endpoint (string) - API endpoint to check (e.g., /api/stats)
- timeout (number) - Seconds to wait per check
- retries (number) - Number of retry attempts

**Backup:**
- enabled (true/false) - Backup database before deployment
- retention (number) - Days to keep backups

**Rollback:**
- enabled (true/false) - Auto-rollback on failure
- onHealthCheckFail (true/false) - Rollback if health check fails

## ❌ NOT Configurable (By Design)

These belong in `.env` or code:

### Environment Variables (.env)
- **NEXT_PUBLIC_SUPABASE_URL** - Database URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Public API key
- **SUPABASE_SERVICE_ROLE_KEY** - Admin API key (server-side only)
- **MAXMIND_ACCOUNT_ID** - GeoIP account ID
- **MAXMIND_LICENSE_KEY** - GeoIP license key

### Code-Level Constants
- **Tier Requirements** - Diamond/Gold/Silver/Bronze thresholds
- **PIX Score Formula** - Performance calculation
- **Database Schema** - Table structures
- **Component Logic** - React component behavior

## 🔄 Dynamic Runtime Behavior

The following adapt automatically based on config:

1. **Page Titles & Metadata** - Uses `themeConfig.name` and `chainConfig.name`
2. **Favicon** - Dynamically loaded from `themeConfig.favicon`
3. **Theme Colors** - Applied to:
   - Header buttons (primaryColor)
   - Chart colors (primaryColor)
   - Icons throughout app (primaryColor)
   - Hover states and accents
4. **Navigation Menu** - Generated from `content.navigation[]`
5. **Footer Links** - Generated from `content.social[]` and `content.footerLinks[]`
6. **Map Tile Switcher** - Generated from `mapConfig.tileStyles[]`
7. **Blockchain Network** - All database queries filter by `chain`

## 📝 How to Customize

Edit **ONE FILE**: `/config/project.config.yaml`

```yaml
# Change these values:
chainConfig:
  name: YourCoin          # ← Your blockchain name
  ticker: YOUR            # ← Your ticker symbol
  websiteUrl: https://...  # ← Your website

themeConfig:
  primaryColor: "#YOUR_COLOR"  # ← Your brand color
  logo: /logos/yourcoin.png    # ← Your logo

content:
  social:
    - name: Twitter
      href: https://twitter.com/YOUR_HANDLE  # ← Your social links
      icon: twitter
```

Then add your logos to `/apps/web/public/logos/` and deploy!

## 🚀 That's It!

**Everything visible to users** is controlled by this YAML file. No code changes needed to fork for a new blockchain.
