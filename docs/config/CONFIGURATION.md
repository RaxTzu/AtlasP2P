# Configuration Guide

This guide explains every configuration option in `/config/project.config.yaml` - the **ONLY file** you need to edit to customize your Nodes Map.

**After editing config:** Configuration is loaded at server startup. Restart the web container to apply changes:
```bash
docker restart atlasp2p-web
```

## Table of Contents

1. [Project Identity](#project-identity)
2. [Chain Configuration](#chain-configuration)
3. [Theme & Branding](#theme--branding)
4. [Content Configuration](#content-configuration)
5. [Map Configuration](#map-configuration)
6. [Feature Flags](#feature-flags)
7. [Asset Paths](#asset-paths)
8. [Environment Variables](#environment-variables)

---

## Project Identity

```yaml
projectName: Dingocoin Nodes Map
chain: dingocoin
```

### `projectName` (string)
- **Description**: Display name for your project
- **Used in**: Page titles, header, meta tags
- **Example**: "Dogecoin Nodes Map", "Bitcoin Network Map"

### `chain` (string, lowercase)
- **Description**: Database identifier for your blockchain
- **Used in**: Database queries, API filters, crawler configuration
- **Example**: `dingocoin`, `dogecoin`, `bitcoin`, `litecoin`
- **⚠️ Important**: Must match the chain value in your database

---

## Chain Configuration

```yaml
chainConfig:
  name: Dingocoin
  ticker: DINGO
  p2pPort: 33117
  rpcPort: 22892
  protocolVersion: 70017
  currentVersion: "1.16.0"
  minimumVersion: "1.14.0"
  criticalVersion: "1.12.0"
  explorerUrl: https://explorer.dingocoin.org
  websiteUrl: https://dingocoin.org
  githubUrl: https://github.com/dingocoin/dingocoin
```

### `name` (string)
- **Description**: Human-readable blockchain name
- **Used in**: UI labels, tooltips, network info display
- **Example**: "Dingocoin", "Dogecoin", "Bitcoin"

### `ticker` (string)
- **Description**: Cryptocurrency ticker symbol
- **Used in**: Node labels, statistics, tipping system, API key prefixes (e.g., `dingo_sk_...`)
- **Example**: "DINGO", "DOGE", "BTC", "LTC"

### `p2pPort` (integer)
- **Description**: Default P2P network port
- **Used in**: Crawler connection attempts, node validation
- **Example**: 33117 (Dingocoin), 22556 (Dogecoin), 8333 (Bitcoin)

### `rpcPort` (integer)
- **Description**: Default RPC port
- **Used in**: Node verification, documentation
- **Example**: 22892 (Dingocoin), 22555 (Dogecoin), 8332 (Bitcoin)

### `protocolVersion` (integer)
- **Description**: Current P2P protocol version
- **Used in**: Crawler handshake, compatibility checks
- **Example**: 70017 (Dingocoin), 70015 (Dogecoin/Bitcoin)

### `currentVersion` (string)
- **Description**: Latest stable node software version
- **Used in**: Version comparison, "outdated" warnings
- **Example**: "1.16.0", "1.14.7", "24.0.1"

### `minimumVersion` (string)
- **Description**: Minimum acceptable version (still supported)
- **Used in**: Node tier calculations, statistics
- **Example**: "1.14.0"

### `criticalVersion` (string)
- **Description**: Below this version is considered critical/outdated
- **Used in**: Warnings, tier degradation
- **Example**: "1.12.0"

### `explorerUrl` (string, URL)
- **Description**: Blockchain explorer base URL
- **Used in**: Links to transactions, blocks, addresses
- **Example**: "https://explorer.dingocoin.org"

### `websiteUrl` (string, URL)
- **Description**: Official project website
- **Used in**: Footer links, "Learn more" buttons
- **Example**: "https://dingocoin.org"

### `githubUrl` (string, URL)
- **Description**: Source code repository
- **Used in**: Footer links, developer resources
- **Example**: "https://github.com/dingocoin/dingocoin"

### `messagePrefix` (string, optional)
- **Description**: Message signing prefix used by wallet for signature verification
- **Used in**: Node ownership verification via message signing
- **Example**: "Dingocoin Signed Message:\n", "Bitcoin Signed Message:\n"
- **Note**: Must match your wallet's signing prefix exactly. If omitted, defaults to "{chainName} Signed Message:\n"

### `addressPrefix` (string, optional)
- **Description**: Expected starting character(s) of wallet addresses
- **Used in**: Address format validation during verification
- **Example**: "D" (Dingocoin/Dogecoin), "1" (Bitcoin P2PKH), "L" (Litecoin)

### `pubKeyHash` (string, hex, optional)
- **Description**: Version byte for P2PKH addresses in hexadecimal
- **Used in**: Cryptographic signature recovery during verification
- **Example**: "1e" (Dingocoin/Dogecoin = 0x1E = 30), "00" (Bitcoin = 0x00)

---

## Theme & Branding

```yaml
themeConfig:
  name: Dingocoin Nodes Map
  primaryColor: "#ff8c00"
  secondaryColor: "#ffa500"
  accentColor: "#ffb347"
  logo: /logos/dingocoin.png
  favicon: /logos/dingocoin-favicon.ico
```

### `name` (string)
- **Description**: Theme display name
- **Used in**: Meta tags, page titles
- **Example**: "Dingocoin Nodes Map"

### `primaryColor` (string, hex color)
- **Description**: Main brand color
- **Used in**: Buttons, active states, charts, node markers, globe atmosphere
- **Example**: "#ff8c00" (orange), "#c2a633" (gold), "#f7931a" (bitcoin orange)
- **Tip**: Use your blockchain's brand color

### `secondaryColor` (string, hex color)
- **Description**: Secondary accent color
- **Used in**: Hover states, secondary buttons
- **Example**: "#ffa500"

### `accentColor` (string, hex color)
- **Description**: Highlight/accent color
- **Used in**: Badges, highlights, special UI elements
- **Example**: "#ffb347"

### `logo` (string, path)
- **Description**: Path to main logo image (relative to `/public`)
- **Used in**: Header, footer, loading screens, navigation
- **Example**: "/logos/dingocoin.png" or "/logos/logo.png"
- **Template**: See `apps/web/public/logos/TEMPLATE-logo.svg` for guidance
- **Recommended**:
  - Format: PNG or SVG (SVG preferred for scalability)
  - Size: 256x256px or scalable
  - Background: Transparent preferred (works on light/dark themes)
  - File location: `apps/web/public/logos/`

### `favicon` (string, path)
- **Description**: Path to favicon (browser tab icon)
- **Used in**: Browser tab icon, bookmarks
- **Example**: "/logos/dingocoin-favicon.ico" or "/logos/favicon.ico"
- **Template**: See `apps/web/public/logos/TEMPLATE-favicon.svg` for guidance
- **Recommended**:
  - Format: ICO, PNG, or SVG
  - Size: 32x32px or 64x64px
  - Multiple sizes in ICO format for best compatibility
  - File location: `apps/web/public/logos/`

**Pro Tip**: Use [RealFaviconGenerator](https://realfavicongenerator.net/) to create multi-platform favicons from your logo.

**See Also**: `apps/web/public/logos/README.md` for complete logo guidelines and template files.

---

## Content Configuration

```yaml
content:
  siteName: Dingocoin Nodes Map
  siteDescription: Real-time map and analytics for Dingocoin network nodes worldwide
  siteUrl: https://nodes.dingocoin.org

  navigation:
    - name: Map
      href: /
      icon: map
    - name: Statistics
      href: /stats
      icon: barchart
    - name: Leaderboard
      href: /leaderboard
      icon: trophy

  footerLinks:
    - label: API
      href: /api-docs
      external: false

  social:
    - name: GitHub
      href: https://github.com/dingocoin/dingocoin
      icon: github
    - name: Twitter
      href: https://twitter.com/ABoringDingo
      icon: twitter
    - name: Discord
      href: https://discord.gg/dingocoin
      icon: discord

  copyrightText: Open source project
  githubRepoUrl: https://github.com/RaxTzu/AtlasP2P
```

### `siteName` (string)
- **Description**: Full site name for SEO
- **Used in**: `<title>` tags, Open Graph metadata
- **Example**: "Dingocoin Nodes Map"

### `siteDescription` (string)
- **Description**: Site description for SEO and social sharing
- **Used in**: Meta description, Open Graph description
- **Example**: "Real-time map and analytics for Dingocoin network nodes worldwide"
- **Recommended**: 50-160 characters

### `siteUrl` (string, URL)
- **Description**: Canonical site URL
- **Used in**: Open Graph tags, sitemap, canonical links
- **Example**: "https://nodes.dingocoin.org"

### `navigation` (array of objects)
Navigation menu items in the header

**Object structure**:
```yaml
- name: Map              # Display text
  href: /               # URL path or full URL
  icon: map             # Icon identifier
  external: false       # Optional: opens in new tab
```

**Available icons**:
- `map` - Map view icon
- `barchart` - Statistics/charts icon
- `trophy` - Leaderboard/rankings icon
- `user` - Profile/account icon
- `info` - Information/about icon
- `settings` - Settings/preferences icon
- `docs` - Documentation icon

### `footerLinks` (array of objects)
Middle section links in footer

**Object structure**:
```yaml
- label: API            # Link text
  href: /api-docs       # URL
  external: false       # Optional: true for external links
```

### `social` (array of objects)
Social media icons in footer

**Object structure**:
```yaml
- name: GitHub          # Display name (tooltip)
  href: https://...     # Social media URL
  icon: github          # Icon identifier
```

**Available social icons**:
- `github` - GitHub
- `twitter` - Twitter/X
- `discord` - Discord
- `telegram` - Telegram
- `reddit` - Reddit
- `youtube` - YouTube
- `medium` - Medium
- `linkedin` - LinkedIn

### `copyrightText` (string)
- **Description**: Copyright/license text in footer
- **Used in**: Footer bottom section
- **Example**: "Open source project", "MIT License", "© 2025 Dingocoin"

### `githubRepoUrl` (string, URL)
- **Description**: Link to this nodes map repository (not the blockchain repo)
- **Used in**: "Fork on GitHub" button in footer
- **Example**: "https://github.com/RaxTzu/AtlasP2P"

---

## Admin & Notification Configuration

```yaml
adminConfig:
  # Admin emails for alerts and notifications (array)
  adminEmails:
    - admin@example.com
    - devops@example.com

  # Semantic Colors
  semanticColors:
    success: "#22c55e"
    warning: "#f59e0b"
    error: "#ef4444"
    info: "#3b82f6"

  # Email Configuration
  email:
    provider: resend
    fromEmail: noreply@example.com
    fromName: Node Map
    alertsFromEmail: alerts@example.com
    alertsFromName: Node Map Alerts
    autoConfirm: false
    verificationRequired: true
    otp:
      expiryMinutes: 10
      maxResendAttempts: 3
      resendCooldownSeconds: 60

  # Alert thresholds
  alerts:
    enabled: false
    nodeCountDropPercent: 20
    healthScoreThreshold: 70
    alertCooldownHours: 24
```

### `adminEmails` (array of strings)
- **Description**: List of admin email addresses to receive system alerts
- **Used in**: Alert notifications, system warnings, critical events
- **Example**: `["admin@example.com", "devops@example.com"]`
- **Important**: Multiple admins can be configured for redundancy
- **Validation**: Each email must be a valid email address format

### `semanticColors` (object)
Standardized colors for UI states across the application.

**Purpose**: Ensures consistent color usage for status indicators, alerts, and feedback.

#### `semanticColors.success` (string, hex color)
- **Description**: Color for successful operations and online nodes
- **Used in**: Success messages, online status indicators, positive metrics
- **Default**: `#22c55e` (green)
- **Example**: Node online badges, successful verification messages

#### `semanticColors.warning` (string, hex color)
- **Description**: Color for warnings and outdated versions
- **Used in**: Warning messages, outdated node indicators, caution alerts
- **Default**: `#f59e0b` (amber/orange)
- **Example**: "Node version outdated" warnings, soft alerts

#### `semanticColors.error` (string, hex color)
- **Description**: Color for errors, offline nodes, and critical issues
- **Used in**: Error messages, offline status, critical alerts, failed operations
- **Default**: `#ef4444` (red)
- **Example**: Node offline indicators, validation errors, system failures

#### `semanticColors.info` (string, hex color)
- **Description**: Color for informational messages and tips
- **Used in**: Info tooltips, help text, neutral notifications
- **Default**: `#3b82f6` (blue)
- **Example**: Feature explanations, helpful tips, neutral status updates

**Best Practices**:
- Use high-contrast colors for accessibility (WCAG AA minimum)
- Maintain color consistency across light and dark modes
- Test with colorblind-safe palettes

### Email Configuration

**IMPORTANT: Two Separate Email Systems**

AtlasP2P uses **two independent email systems** for different purposes:

1. **GoTrue Auth Emails** (.env configuration)
   - **Purpose**: Authentication-related emails (signup, password reset, email verification)
   - **Configured in**: `.env` file using SMTP settings
   - **Email service**: Uses SMTP relay (Resend, SendGrid, or custom SMTP)
   - **ENV variables**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - **Example**: Resend SMTP (`smtp.resend.com:587`)
   - **Note**: GoTrue is a pre-built Supabase service that only reads ENV vars

2. **Application Custom Emails** (project.config.yaml configuration)
   - **Purpose**: Custom application emails (alerts, notifications, node updates)
   - **Configured in**: `config/project.config.yaml` (`adminConfig.email.provider`)
   - **Email service**: Can use HTTP API (Resend, SendGrid) or SMTP
   - **ENV variables**: `RESEND_API_KEY`, `SENDGRID_API_KEY`, or SMTP settings
   - **Example**: Resend API for faster, feature-rich emails
   - **Note**: These emails are sent by your application code

**Both can use the SAME provider (e.g., both use Resend)**, but through different interfaces (SMTP relay vs HTTP API).

---

#### `email.provider` (string)
- **Description**: Email service provider for **application custom emails** (alerts, notifications)
- **Options**: `resend` | `sendgrid` | `smtp` | `disabled`
- **Used in**: Node alerts, admin notifications, custom feature emails
- **Does NOT affect**: Auth emails (those are configured in .env SMTP settings)
- **Environment Requirements**:
  - `resend`: Requires `RESEND_API_KEY` in .env (production only)
  - `sendgrid`: Requires `SENDGRID_API_KEY` in .env (production only)
  - `smtp`: Requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` in .env
  - `disabled`: No application emails (auth emails still work via .env)

#### `email.fromEmail` (string, email)
- **Description**: Default sender email address for user emails
- **Used in**: Verification emails, user notifications, general communications
- **Example**: `noreply@example.com`, `no-reply@nodes.dingocoin.org`
- **Important**: Must be a verified sender in your email provider

#### `email.fromName` (string)
- **Description**: Display name for email sender
- **Used in**: Email "From" field display name
- **Example**: `Dingocoin Nodes Map`, `Node Map`

#### `email.alertsFromEmail` (string, email, optional)
- **Description**: Separate sender email for system alerts
- **Used in**: Critical alerts, system notifications to admins
- **Example**: `alerts@example.com`, `system-alerts@nodes.dingocoin.org`
- **Default**: Falls back to `fromEmail` if not specified
- **Why separate?**: Allows admins to filter/prioritize alert emails

#### `email.alertsFromName` (string, optional)
- **Description**: Display name for alert emails
- **Used in**: Alert email "From" field
- **Example**: `Node Map Alerts`, `System Alerts`
- **Default**: Falls back to `fromName` if not specified

#### `email.autoConfirm` (boolean)
- **Description**: Skip email verification for new accounts
- **Used in**: Development/testing to bypass email verification flow
- **Default**: `false`
- **Recommendation**:
  - Set `true` for local development (faster testing)
  - Set `false` for production (security)

#### `email.verificationRequired` (boolean)
- **Description**: Require email verification for new accounts
- **Used in**: Account creation flow
- **Default**: `true`
- **Important**: If `false`, users can access features without verifying email

#### `email.otp.expiryMinutes` (integer)
- **Description**: How long verification codes remain valid
- **Range**: 1-60 minutes (recommended: 5-15)
- **Default**: `10`
- **Example**: `10` = codes expire after 10 minutes

#### `email.otp.maxResendAttempts` (integer)
- **Description**: Maximum times user can request new verification code
- **Range**: 1-10 (recommended: 3-5)
- **Default**: `3`
- **Purpose**: Prevents email spam abuse

#### `email.otp.resendCooldownSeconds` (integer)
- **Description**: Wait time before allowing code resend
- **Range**: 30-120 seconds (recommended: 60)
- **Default**: `60`
- **Purpose**: Rate limiting for resend requests

### Alert Configuration

#### `alerts.enabled` (boolean)
- **Description**: Enable automated system alerts
- **Used in**: Background monitoring tasks
- **Default**: `false`
- **Important**: Requires email provider configured (not `disabled`)

#### `alerts.nodeCountDropPercent` (integer)
- **Description**: Alert when total nodes drop by this percentage
- **Range**: 0-100
- **Default**: `20`
- **Example**: `20` = alert if node count drops 20% or more
- **Use case**: Detect network issues or crawler problems

#### `alerts.healthScoreThreshold` (integer)
- **Description**: Alert when network health score falls below this value
- **Range**: 0-100
- **Default**: `70`
- **Example**: `70` = alert if health score < 70
- **Use case**: Monitor overall network health

#### `alerts.alertCooldownHours` (integer)
- **Description**: Minimum hours between repeated alerts
- **Range**: 1-168 (1 hour to 1 week)
- **Default**: `24`
- **Purpose**: Prevents alert fatigue from repeated notifications

---

## Map Configuration

```yaml
mapConfig:
  defaultCenter: [20, 0]
  defaultZoom: 2
  minZoom: 2
  maxZoom: 18
  tileProvider: openstreetmap
  clusterRadius: 80
  clusterMaxZoom: 14

  tileStyles:
    - id: dingocoin
      name: Dingocoin (Themed)
      url: https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
      attribution: "&copy; OpenStreetMap contributors"
      maxZoom: 20
      subdomains: [a, b, c, d]

  defaultTileStyle: dingocoin
```

### `defaultCenter` (array: [latitude, longitude])
- **Description**: Initial map center position
- **Used in**: Map initialization
- **Example**: `[20, 0]` (centered on Africa), `[39, -98]` (USA), `[51, 10]` (Europe)
- **Range**: Latitude: -90 to 90, Longitude: -180 to 180

### `defaultZoom` (integer)
- **Description**: Initial zoom level
- **Used in**: Map initialization
- **Example**: `2` (world view), `4` (continent), `10` (city)
- **Range**: Typically 1-18

### `minZoom` (integer)
- **Description**: Minimum allowed zoom level (furthest out)
- **Example**: `2`

### `maxZoom` (integer)
- **Description**: Maximum allowed zoom level (closest in)
- **Example**: `18`

### `tileProvider` (string)
- **Description**: Legacy tile provider identifier
- **Used in**: Fallback if tileStyles not found
- **Example**: "openstreetmap", "carto"

### `clusterRadius` (integer)
- **Description**: Pixel radius for clustering nearby nodes
- **Used in**: Supercluster configuration
- **Example**: `80` (aggressive clustering), `40` (less clustering)
- **Range**: 20-200 pixels
- **Tip**: Higher values = more clustering

### `clusterMaxZoom` (integer)
- **Description**: Zoom level at which clustering stops
- **Used in**: Supercluster configuration
- **Example**: `14` (individual nodes visible at zoom 15+)
- **Tip**: Set to 1-2 levels below maxZoom

### `tileStyles` (array of objects)
Custom map tile layers for the style switcher

**Object structure**:
```yaml
- id: unique-id         # Unique identifier (lowercase, no spaces)
  name: Display Name    # Name shown in switcher
  url: https://...      # Tile server URL pattern
  attribution: "..."    # Copyright/attribution HTML
  maxZoom: 20          # Max zoom for this tileset
  subdomains: [a,b,c]  # Optional: tile server subdomains
```

**URL patterns**:
- `{s}` = subdomain (a, b, c, d)
- `{z}` = zoom level
- `{x}` = tile X coordinate
- `{y}` = tile Y coordinate
- `{r}` = retina/HD indicator

**Popular tile providers**:

**CARTO (Free, recommended)**:
```yaml
# Light theme
url: https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png

# Dark theme
url: https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png

# Voyager (colorful)
url: https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
```

**OpenStreetMap (Free)**:
```yaml
url: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

**Stadia Maps (Requires API key)**:
```yaml
url: https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png
```

### `defaultTileStyle` (string)
- **Description**: ID of default tile style to show
- **Used in**: Initial map render, style switcher default
- **Example**: "dingocoin", "voyager", "dark"
- **Must match**: One of the `id` values in `tileStyles` array

---

## Feature Flags

Control which features are enabled/disabled in your deployment.

```yaml
features:
  map:
    enabled: true
    clustering: true
    heatmap: false
    liveUpdates: true

  stats:
    enabled: true
    versionChart: true
    countryChart: true
    healthScore: true

  filters:
    byCountry: true
    byVersion: true
    byTier: true
    byStatus: true
    search: true

  nodes:
    categories: true
    rankings: true
    uptimeTracking: true
    historicalData: true

  verification:
    enabled: true
    messageSign: true
    userAgent: true
    portChallenge: false
    dnsTxt: false

  tipping:
    enabled: true
    tracking: false

  community:
    nodeSubmission: false
    leaderboard: true
    badges: true

  ui:
    darkMode: true
    themeSwitcher: true
```

### Map Features

- **`enabled`** - Show the main map page
- **`clustering`** - Cluster nearby nodes at low zoom levels
- **`heatmap`** - Show node density heatmap layer
- **`liveUpdates`** - Enable real-time node status updates via Supabase subscriptions

### Stats Features

- **`enabled`** - Show statistics page and stats panel
- **`versionChart`** - Display node version distribution chart
- **`countryChart`** - Display country distribution chart
- **`healthScore`** - Calculate and show network health score

### Filter Features

- **`byCountry`** - Enable country filter dropdown
- **`byVersion`** - Enable version filter dropdown
- **`byTier`** - Enable tier filter (Diamond, Gold, Silver, etc.)
- **`byStatus`** - Enable online/offline status filter
- **`search`** - Enable node search by IP/name

### Node Features

- **`categories`** - Categorize nodes (exchange, personal, etc.)
- **`rankings`** - Show node rankings by PIX score
- **`uptimeTracking`** - Track and display uptime history
- **`historicalData`** - Show historical performance charts

### Verification Features

- **`enabled`** - Enable node ownership verification system
- **`messageSign`** - Allow verification via message signing
- **`userAgent`** - Allow verification via custom user agent
- **`portChallenge`** - Allow verification via port challenge
- **`dnsTxt`** - Allow verification via DNS TXT record

### Tipping Features

- **`enabled`** - Enable tipping system for verified nodes
- **`tracking`** - Track tips on-chain (requires additional setup)

### Community Features

- **`nodeSubmission`** - Allow users to submit their nodes manually
- **`leaderboard`** - Show public leaderboard of top nodes
- **`badges`** - Award badges for achievements

### UI Features

- **`darkMode`** - Enable dark mode toggle
- **`themeSwitcher`** - Show theme/style switcher

---

## Asset Paths

```yaml
assets:
  logoPath: /logos/dingocoin.png
  faviconPath: /logos/dingocoin-favicon.ico
  ogImagePath: /logos/dingocoin-og.png
```

### `logoPath` (string, path)
- **Description**: Main logo for header and UI
- **Location**: Place file in `/apps/web/public/logos/`
- **Recommended format**: PNG with transparency
- **Recommended size**: 200x50px (width x height)

### `faviconPath` (string, path)
- **Description**: Favicon for browser tabs
- **Location**: Place file in `/apps/web/public/logos/`
- **Recommended format**: ICO or PNG
- **Recommended sizes**: 32x32px or 64x64px

### `ogImagePath` (string, path)
- **Description**: Path to Open Graph image for social media sharing
- **Used in**: Facebook, Twitter, Discord, LinkedIn link previews
- **Example**: "/logos/dingocoin512.png" or "/logos/logo-512.png"
- **Template**: See `apps/web/public/logos/TEMPLATE-logo-512.svg` for guidance
- **Recommended**:
  - Format: PNG or JPG (PNG preferred)
  - Size: 512x512px (square) or 1200x630px (landscape)
  - File size: Under 1MB for fast loading
  - Include your logo/branding clearly visible
  - File location: `apps/web/public/logos/`
- **Optional**: Leave blank to use main logo

**What is OG Image?** When someone shares your nodes map on social media, this image appears in the preview card. Make it eye-catching!

---

## Environment Variables

While most configuration is in YAML, some sensitive values **must** remain in environment variables.

### Required `.env.local` Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MaxMind GeoIP (for crawler)
MAXMIND_ACCOUNT_ID=your-account-id
MAXMIND_LICENSE_KEY=your-license-key

# Optional: Crawler Configuration
CRAWLER_INTERVAL_MINUTES=5
MAX_CONCURRENT_CONNECTIONS=100
CONNECTION_TIMEOUT_SECONDS=10
```

### Why These Aren't in YAML

- **Security**: API keys should never be committed to Git
- **Environment-specific**: Different values for dev/staging/production
- **Supabase standard**: Follows Next.js and Supabase conventions

---

## Quick Reference: What Goes Where

| Type | File | Purpose |
|------|------|---------|
| **Public config** | `project.config.yaml` | Branding, features, public settings |
| **Secrets** | `.env.local` | API keys, database credentials |
| **Assets** | `/apps/web/public/logos/` | Logos, favicons, images |
| **Business logic** | Code files | Tier thresholds, PIX formula |

---

## Examples

See `/config/examples/` for complete configuration examples:
- `dogecoin.config.yaml` - Dogecoin configuration
- `bitcoin.config.yaml` - Bitcoin configuration
- `litecoin.config.yaml` - Litecoin configuration

---

## Validation

Your configuration is validated at build time. Common errors:

❌ **Invalid color format**: Use hex colors like `#ff8c00`
❌ **Missing required fields**: All fields shown above are required
❌ **Invalid icon names**: Must use icons from the available list
❌ **Invalid URLs**: Must start with `http://` or `https://`
❌ **Mismatched defaultTileStyle**: Must match a tileStyle `id`

✅ **Tip**: Run `pnpm build` to validate your configuration before deploying

---

## Need Help?

- See `FORKING.md` for step-by-step fork instructions
- Check `WHAT_IS_CONFIGURABLE.md` for overview
- Open an issue on GitHub for questions
