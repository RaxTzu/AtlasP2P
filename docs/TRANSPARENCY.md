# Transparency & Privacy

This document explains what data AtlasP2P collects, how it's used, and your privacy rights. As an open-source project, we believe in full transparency about our data practices.

---

## Data Collection Summary

| Data Type | Collected | Stored | Purpose |
|-----------|-----------|--------|---------|
| Node IP addresses | Yes | Yes | Core functionality - display nodes on map |
| Node ports | Yes | Yes | Core functionality - identify services |
| Geolocation (city/country) | Yes | Yes | Map visualization |
| ISP/ASN information | Yes | Yes | Network diversity analysis |
| Node software version | Yes | Yes | Network health monitoring |
| Performance metrics | Yes | Yes | Tier ranking system |
| User email (registered) | Yes | Yes | Authentication, alerts |
| User IP (API requests) | Yes | Temporary | Rate limiting only |
| Cookies/Tracking | No | No | Not used |
| Analytics | No | No | Not used |

---

## Node Data Collection

### What the Crawler Collects

The P2P crawler connects to publicly advertised nodes and collects:

**From P2P Protocol Handshake:**
- IP address and port
- Protocol version
- User agent string (e.g., `/Dingocoin:1.16.0/`)
- Services flags
- Best block height
- Connection latency

**From GeoIP Lookup (MaxMind):**
- Country code and name
- Region/State
- City
- Approximate latitude/longitude (city-level, not precise)
- Timezone
- ISP name
- Organization name
- ASN (Autonomous System Number)

**Calculated Metrics:**
- Uptime percentage (based on response history)
- Average latency
- Reliability score
- PIX (Performance Index) score
- Tier classification (Diamond/Gold/Silver/Bronze/Standard)
- Global rank

### What We DO NOT Collect

- Wallet addresses or balances
- Transaction data
- Private keys
- Precise GPS coordinates (only city-level)
- Personal identity information from nodes
- Any data behind the node (blockchain data is not stored)

### Data Sources

1. **P2P Discovery**: Nodes advertise themselves to peers; we connect like any other P2P participant
2. **DNS Seeds**: Standard blockchain DNS seeds for initial discovery
3. **RPC (if configured)**: Optional local node RPC for peer lists
4. **Manual Registration**: Users can register nodes manually

---

## User Data Collection

### Account Registration

When you create an account, we store:
- Email address (for authentication and alerts)
- Password hash (bcrypt, salted)
- Account creation timestamp
- Last sign-in timestamp

### Node Verification

When you verify node ownership:
- Verification method used
- Verification timestamp
- Challenge/response data (temporary)
- IP address at time of verification (for security audit)

### Node Profiles

If you customize your node profile:
- Display name
- Description
- Avatar image
- Social links (Twitter, Discord, GitHub, Telegram, Website)
- Tip wallet address (if enabled)

### Alert Subscriptions

If you set up alerts:
- Which nodes to monitor
- Alert preferences (offline/online/version/tier)
- Discord webhook URL (if configured)
- Notification history

### API Keys

If you create API keys:
- Key name and description
- Scopes (permissions)
- Usage statistics (request count, last used)
- Key hash (actual key is shown only once)

---

## Data NOT Collected

We explicitly do NOT collect or store:

- Browser fingerprints
- Tracking cookies
- Third-party analytics (no Google Analytics, etc.)
- Advertising identifiers
- Device identifiers
- Location from your browser
- Browsing history
- Data from other websites

---

## Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Node data | Until node is offline for 24+ hours |
| Network snapshots | 90 days (historical charts) |
| Node snapshots (uptime) | 30 days |
| Verification attempts | 7 days (failed), permanent (successful) |
| Alert history | 90 days |
| Audit logs | 1 year |
| User accounts | Until deleted |

---

## Data Sharing

### Public Data

The following is publicly accessible via the API:
- Node IP addresses and ports
- Node geographic location (city-level)
- Node software versions
- Node performance metrics
- Node operator profiles (if set to public)

This data is inherently public on P2P networks - any participant can discover it.

### We Never Share

- User email addresses
- User passwords
- Discord webhook URLs
- Private profile data
- API keys
- Verification challenge data

### Third-Party Services

| Service | Data Shared | Purpose |
|---------|-------------|---------|
| MaxMind GeoLite2 | Node IPs | Geolocation lookup |
| Resend | User emails | Sending alert notifications |
| Cloudflare Turnstile | None (privacy-focused) | Bot protection |
| Supabase | All stored data | Database hosting |

---

## Your Rights

### Access Your Data

You can view all your data at any time:
- Profile: Settings page
- Verified nodes: My Nodes page
- Alert subscriptions: Alert Settings page
- API keys: API Keys page

### Export Your Data

Currently available exports:
- Your verified nodes (via API)
- Your alert history (via API)

### Delete Your Data

You can:
- Delete individual alert subscriptions
- Revoke API keys
- Remove node profiles
- Request full account deletion (contact admin)

### Unsubscribe

- Email alerts include one-click unsubscribe links
- No login required to unsubscribe
- Token-based unsubscribe (secure, no tracking)

---

## Security Measures

### Data Protection

- All data encrypted in transit (TLS 1.3)
- Database encrypted at rest
- Passwords hashed with bcrypt
- API keys stored as SHA-256 hashes
- Rate limiting on all endpoints
- CORS restrictions

### Access Control

- Row-Level Security (RLS) on all tables
- Admin actions require explicit authorization
- All admin actions logged to audit trail
- Two-tier admin system (super admin + moderator)

### Audit Trail

Admin actions are logged with:
- Admin user ID and email
- Action type (approve, reject, ban, etc.)
- Target resource
- IP address and user agent
- Timestamp
- Detailed metadata

---

## Moderation

### What Gets Moderated

- Node verification requests (manual review option)
- Profile changes (display names, descriptions, avatars)
- Reported content

### Moderation Actions

- **Approve**: Content goes live
- **Reject**: Content denied with reason
- **Flag**: Marked for further review
- **Ban**: User account suspended

### Appeals

Users can contact administrators to appeal moderation decisions.

---

## Open Source Transparency

This entire codebase is open source. You can verify:

- **What data is collected**: See `apps/crawler/src/crawler.py`
- **How data is stored**: See `supabase/migrations/`
- **What APIs expose**: See `apps/web/src/app/api/`
- **Security measures**: See `apps/web/src/lib/security.ts`

Repository: [github.com/RaxTzu/AtlasP2P](https://github.com/RaxTzu/AtlasP2P)

---

## Contact

For privacy concerns or data requests:
- Open an issue on GitHub
- Contact the project maintainers

---

## Changes to This Policy

This document is versioned with the codebase. Check commit history for changes.

**Last Updated:** 2026-01-21
