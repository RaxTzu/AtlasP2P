---
layout: default
title: API Reference - AtlasP2P
---

# Dingocoin Nodes Map - JSON API Documentation

This document describes the JSON API endpoints for programmatic access to node data. The API structure matches [Bitnodes.io](https://bitnodes.io) for compatibility while adding extended features specific to the Dingocoin network.

## Base URL

```
http://localhost:4000/api  (Development)
https://nodes.dingocoin.org/api  (Production)
```

## Authentication

### Public Endpoints
The JSON endpoints (`/api/*.json`) are **public** and do not require authentication. Rate limiting headers are included in responses.

### Authenticated Endpoints
Some endpoints require authentication via JWT (user session) or API key:

**API Key Authentication:**
```bash
# Via Authorization header (recommended)
curl -H "Authorization: Bearer {ticker}_sk_xxxxxxxx" https://nodes.example.com/api/nodes.json

# Via X-API-Key header
curl -H "X-API-Key: {ticker}_sk_xxxxxxxx" https://nodes.example.com/api/nodes.json
```

**Session Authentication:**
Requires valid Supabase session cookie (for browser-based access).

## CORS Support

All endpoints include proper CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Rate Limiting

Rate limit information is provided in response headers:
- `X-RateLimit-Limit`: Maximum requests per hour (1000)
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Endpoints

### 1. GET /api/nodes.json

Retrieve a list of nodes with filtering, sorting, and pagination support.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number for pagination |
| `limit` | integer | `100` | Results per page (max: 500) |
| `country` | string | - | Filter by ISO 3166-1 alpha-2 country code (e.g., `US`, `DE`) |
| `tier` | string | - | Filter by tier: `diamond`, `gold`, `silver`, `bronze`, `standard` |
| `version` | string | - | Filter by specific client version |
| `verified` | boolean | - | Filter by verification status: `true` or `false` |
| `online` | boolean | - | Filter by online status: `true` or `false` |
| `sort` | string | `last_seen` | Sort field: `last_seen`, `first_seen`, `pix_score`, `tier`, `uptime_percentage` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |

#### Example Request

```bash
curl "https://nodes.dingocoin.org/api/nodes.json?country=US&tier=diamond&page=1&limit=50"
```

#### Response Format

```json
{
  "timestamp": 1702345678,
  "total_nodes": 1234,
  "latest_height": 5678901,
  "nodes": {
    "192.168.1.1:33117": {
      "protocol_version": 70015,
      "user_agent": "/Dingocoin:1.16.0/",
      "connected_since": 1702345678,
      "services": "0000000000000001",
      "height": 5678901,
      "hostname": null,
      "city": "San Francisco",
      "country": "US",
      "country_name": "United States",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "timezone": "America/Los_Angeles",
      "asn": "AS15169",
      "organization_name": "Google LLC",
      "isp": "Google LLC",
      "status": "up",
      "last_seen": 1702345678,
      "latency_ms": 45.2,
      "uptime_percentage": 99.8,
      "reliability": 98.5,
      "tier": "diamond",
      "pix_score": 965.3,
      "rank": 1,
      "is_verified": true,
      "tips_enabled": true
    }
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "total_pages": 25
  }
}
```

#### Response Fields

**Standard Fields (Bitnodes-compatible):**
- `protocol_version`: Bitcoin protocol version number
- `user_agent`: Node client version string
- `connected_since`: Unix timestamp of first discovery
- `services`: Service flags as hex string
- `height`: Current blockchain height
- `hostname`: Reverse DNS hostname (if available)
- `city`: City name from GeoIP
- `country`: ISO 3166-1 alpha-2 country code
- `latitude`/`longitude`: Geographic coordinates
- `timezone`: IANA timezone identifier
- `asn`: Autonomous System Number
- `organization_name`: ASN organization name

**Extended Fields (Dingocoin-specific):**
- `status`: Current node status (`up`, `down`, `pending`)
- `last_seen`: Unix timestamp of last successful connection
- `latency_ms`: Average connection latency in milliseconds
- `uptime_percentage`: Uptime percentage (0-100)
- `reliability`: Reliability score (0-100)
- `tier`: Node tier classification
- `pix_score`: Performance Index Score (PIX)
- `rank`: Global rank based on PIX score
- `is_verified`: Whether node ownership is verified
- `tips_enabled`: Whether tipping is enabled for this node

---

### 2. GET /api/stats.json

Retrieve comprehensive network statistics including node counts, distributions, and health metrics.

#### Query Parameters

None.

#### Example Request

```bash
curl "https://nodes.dingocoin.org/api/stats.json"
```

#### Response Format

```json
{
  "timestamp": 1702345678,
  "total_nodes": 1234,
  "available_nodes": 1200,
  "countries": 89,
  "versions": {
    "/Dingocoin:1.16.0/": 850,
    "/Dingocoin:1.15.0/": 350,
    "unknown": 34
  },
  "countries_distribution": {
    "US": {
      "count": 450,
      "name": "United States"
    },
    "DE": {
      "count": 280,
      "name": "Germany"
    },
    "CN": {
      "count": 150,
      "name": "China"
    }
  },
  "tiers_distribution": {
    "diamond": 45,
    "gold": 120,
    "silver": 230,
    "bronze": 305,
    "standard": 500
  },
  "network_health": {
    "health_score": 92.5,
    "average_uptime": 98.3,
    "average_latency": 125.4,
    "verified_nodes": 678,
    "tips_enabled_nodes": 234
  },
  "latest_height": 5678901,
  "historical_data": [
    {
      "timestamp": 1702259278,
      "total_nodes": 1220,
      "available_nodes": 1190,
      "average_uptime": 98.1,
      "countries": 87
    }
  ]
}
```

#### Response Fields

**Standard Fields (Bitnodes-compatible):**
- `timestamp`: Unix timestamp of data generation
- `total_nodes`: Total number of discovered nodes
- `available_nodes`: Number of currently online nodes
- `countries`: Number of unique countries
- `versions`: Version distribution (version string → count)
- `countries_distribution`: Country distribution (country code → {count, name})
- `latest_height`: Highest blockchain height observed

**Extended Fields (Dingocoin-specific):**
- `tiers_distribution`: Distribution of nodes across tiers
- `network_health`: Aggregate network health metrics
  - `health_score`: Overall health (0-100) based on uptime, availability, latency, and verification
  - `average_uptime`: Network-wide average uptime percentage
  - `average_latency`: Network-wide average latency in ms
  - `verified_nodes`: Number of verified nodes
  - `tips_enabled_nodes`: Number of nodes with tipping enabled
- `historical_data`: 7-day historical snapshots

---

### 3. GET /api/countries.json

Retrieve detailed country-based distribution of nodes with performance metrics.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | string | `count` | Sort field: `code`, `name`, `count` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |
| `online_only` | boolean | `true` | Filter to only online nodes |

#### Example Request

```bash
curl "https://nodes.dingocoin.org/api/countries.json?sort=count&order=desc"
```

#### Response Format

```json
{
  "timestamp": 1702345678,
  "total_countries": 89,
  "total_nodes": 1234,
  "countries": [
    {
      "code": "US",
      "name": "United States",
      "count": 450,
      "percentage": 36.4,
      "online_count": 445,
      "verified_count": 123,
      "tiers": {
        "diamond": 15,
        "gold": 45,
        "silver": 89,
        "bronze": 130,
        "standard": 171
      },
      "average_uptime": 98.5,
      "average_latency": 125.3
    },
    {
      "code": "DE",
      "name": "Germany",
      "count": 280,
      "percentage": 22.7,
      "online_count": 275,
      "verified_count": 87,
      "tiers": {
        "diamond": 10,
        "gold": 35,
        "silver": 70,
        "bronze": 90,
        "standard": 75
      },
      "average_uptime": 97.8,
      "average_latency": 98.6
    }
  ]
}
```

#### Response Fields

- `timestamp`: Unix timestamp of data generation
- `total_countries`: Number of unique countries represented
- `total_nodes`: Total number of nodes (filtered by online_only if set)
- `countries`: Array of country objects, each containing:
  - `code`: ISO 3166-1 alpha-2 country code
  - `name`: Full country name
  - `count`: Total number of nodes in this country
  - `percentage`: Percentage of total nodes
  - `online_count`: Number of currently online nodes
  - `verified_count`: Number of verified nodes
  - `tiers`: Distribution across node tiers
  - `average_uptime`: Average uptime percentage for country
  - `average_latency`: Average latency in milliseconds for country

---

## Error Handling

All endpoints return standard HTTP status codes and error responses in JSON format:

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Detailed error description"
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `400 Bad Request`: Invalid query parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Example Error Response

```bash
curl "https://nodes.dingocoin.org/api/nodes.json?tier=invalid"
```

```json
{
  "error": "Invalid query parameters",
  "details": "Validation failed: tier: Invalid enum value. Expected 'diamond' | 'gold' | 'silver' | 'bronze' | 'standard'"
}
```

---

## Caching

All endpoints include cache headers:
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`

Data is cached for 60 seconds at the edge, with stale content served for up to 120 seconds while revalidating in the background.

---

## Usage Examples

### Fetch All Diamond Nodes in the United States

```bash
curl "https://nodes.dingocoin.org/api/nodes.json?country=US&tier=diamond&online=true"
```

### Get Network Statistics

```bash
curl "https://nodes.dingocoin.org/api/stats.json"
```

### Fetch Top 10 Countries by Node Count

```bash
curl "https://nodes.dingocoin.org/api/countries.json?sort=count&order=desc" | jq '.countries[:10]'
```

### Fetch Verified Nodes with High Uptime

```bash
curl "https://nodes.dingocoin.org/api/nodes.json?verified=true&sort=uptime_percentage&order=desc&limit=100"
```

### Monitor Network Health Over Time

```bash
# Fetch current stats
curl "https://nodes.dingocoin.org/api/stats.json" | jq '.network_health'

# Output:
{
  "health_score": 92.5,
  "average_uptime": 98.3,
  "average_latency": 125.4,
  "verified_nodes": 678,
  "tips_enabled_nodes": 234
}
```

---

## Node Tier System

Nodes are classified into tiers based on performance metrics:

| Tier | Requirements |
|------|--------------|
| **Diamond** | PIX > 950, Uptime > 99%, Latency < 50ms |
| **Gold** | PIX > 900, Uptime > 98%, Latency < 100ms |
| **Silver** | PIX > 850, Uptime > 95%, Latency < 200ms |
| **Bronze** | PIX > 800, Uptime > 90%, Latency < 500ms |
| **Standard** | All other nodes |

**PIX Score Formula:**
```
PIX = (uptime% × 0.5) + ((100 - latency_ms) × 0.3) + (reliability% × 0.2)
```

---

## Integration Examples

### Python

```python
import requests

# Fetch all diamond nodes
response = requests.get(
    'https://nodes.dingocoin.org/api/nodes.json',
    params={'tier': 'diamond', 'online': 'true'}
)
data = response.json()

print(f"Total diamond nodes: {len(data['nodes'])}")
for address, node in data['nodes'].items():
    print(f"{address}: {node['user_agent']} (PIX: {node['pix_score']})")
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function getNetworkStats() {
  const response = await axios.get('https://nodes.dingocoin.org/api/stats.json');
  const stats = response.data;

  console.log(`Total Nodes: ${stats.total_nodes}`);
  console.log(`Online Nodes: ${stats.available_nodes}`);
  console.log(`Health Score: ${stats.network_health.health_score}`);
}

getNetworkStats();
```

### cURL + jq

```bash
# Get top 5 countries
curl -s "https://nodes.dingocoin.org/api/countries.json" | \
  jq -r '.countries[:5] | .[] | "\(.code): \(.count) nodes (\(.percentage)%)"'

# Output:
# US: 450 nodes (36.4%)
# DE: 280 nodes (22.7%)
# CN: 150 nodes (12.2%)
# ...
```

---

## Differences from Bitnodes.io

While maintaining compatibility with Bitnodes.io's API structure, this API includes several enhancements:

1. **Extended Node Data**: Additional fields like `tier`, `pix_score`, `rank`, `reliability`, `is_verified`, `tips_enabled`
2. **Advanced Filtering**: Filter by tier, verification status, and more
3. **Performance Metrics**: Detailed uptime, latency, and reliability tracking
4. **Network Health**: Aggregate health scoring and historical trends
5. **Country Statistics**: Per-country performance metrics and tier distribution
6. **Pagination**: Efficient pagination for large result sets

---

---

## Authenticated Endpoints

The following endpoints require authentication (session or API key).

---

### 4. GET /api/my-nodes

Retrieve all nodes verified by the authenticated user.

**Authentication:** Required (session)

#### Example Request

```bash
curl -H "Cookie: sb-xxx-auth-token=xxx" "https://nodes.example.com/api/my-nodes"
```

#### Response Format

```json
{
  "nodes": [
    {
      "id": "uuid",
      "ip": "192.168.1.1",
      "port": 33117,
      "status": "up",
      "tier": "gold",
      "pixScore": 920,
      "isVerified": true,
      "verificationMethod": "message_sign",
      "verifiedAt": "2025-01-15T10:30:00Z",
      "displayName": "My Node",
      "avatarUrl": "/avatars/xxx.png",
      "countryName": "United States",
      "city": "San Francisco"
    }
  ]
}
```

---

### 5. API Keys Management

Create and manage API keys for programmatic access.

#### Available Scopes

| Scope | Description |
|-------|-------------|
| `read:nodes` | Read node information |
| `read:stats` | Read network statistics |
| `read:leaderboard` | Read leaderboard data |
| `read:profiles` | Read node profiles |

#### GET /api/keys

List user's API keys (key values are masked).

**Authentication:** Required (session)

```bash
curl -H "Cookie: sb-xxx-auth-token=xxx" "https://nodes.example.com/api/keys"
```

**Response:**
```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "Production Key",
      "keyPrefix": "dingo_sk_abc12345",
      "description": "For my dashboard",
      "scopes": ["read:nodes", "read:stats"],
      "rateLimit": 1000,
      "lastUsedAt": "2025-01-20T15:00:00Z",
      "requestCount": 5420,
      "isActive": true,
      "expiresAt": null,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/keys

Create a new API key.

**Authentication:** Required (session)

**Request Body:**
```json
{
  "name": "My API Key",
  "description": "Optional description",
  "scopes": ["read:nodes", "read:stats"],
  "rateLimit": 1000,
  "expiresAt": "2026-01-01T00:00:00Z"
}
```

**Response (201 Created):**
```json
{
  "key": {
    "id": "uuid",
    "name": "My API Key",
    "keyPrefix": "dingo_sk_abc12345",
    "scopes": ["read:nodes", "read:stats"],
    "rateLimit": 1000,
    "isActive": true,
    "createdAt": "2025-01-21T00:00:00Z"
  },
  "rawKey": "dingo_sk_abc12345xyzfullkeyhere",
  "warning": "Store this key securely. It will not be shown again."
}
```

**Limits:**
- Maximum 10 active API keys per user
- Rate limit: 10-10000 requests per hour

#### DELETE /api/keys/[id]

Delete an API key.

**Authentication:** Required (session)

```bash
curl -X DELETE "https://nodes.example.com/api/keys/{keyId}"
```

#### POST /api/keys/[id]/rotate

Rotate an API key (revokes old key, creates new with same settings).

**Authentication:** Required (session)

```bash
curl -X POST "https://nodes.example.com/api/keys/{keyId}/rotate"
```

---

### 6. Alert Subscriptions

Subscribe to node status change notifications.

#### GET /api/alerts

List user's alert subscriptions.

**Authentication:** Required (session)

```bash
curl -H "Cookie: sb-xxx-auth-token=xxx" "https://nodes.example.com/api/alerts"
```

**Response:**
```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "node_id": "uuid",
      "alert_offline": true,
      "alert_online": true,
      "alert_version_outdated": false,
      "alert_tier_change": false,
      "email_enabled": true,
      "webhook_enabled": true,
      "webhook_url": "https://discord.com/api/webhooks/xxx",
      "webhook_type": "discord",
      "cooldown_minutes": 60,
      "created_at": "2025-01-15T00:00:00Z",
      "node": {
        "id": "uuid",
        "ip": "192.168.1.1",
        "port": 33117,
        "status": "up",
        "country_name": "United States"
      }
    }
  ]
}
```

#### POST /api/alerts

Create a new alert subscription.

**Authentication:** Required (session)

**Request Body:**
```json
{
  "nodeId": "uuid",
  "alertOffline": true,
  "alertOnline": true,
  "alertVersionOutdated": false,
  "alertTierChange": false,
  "emailEnabled": true,
  "webhookEnabled": true,
  "webhookUrl": "https://discord.com/api/webhooks/xxx/yyy",
  "webhookType": "discord",
  "cooldownMinutes": 60
}
```

**Notes:**
- `nodeId` must be a node you have verified ownership of
- At least one notification channel (email or webhook) must be enabled
- Cooldown prevents duplicate alerts within the specified time window

#### PUT /api/alerts/[id]

Update an existing subscription.

#### DELETE /api/alerts/[id]

Delete a subscription.

#### GET /api/alerts/unsubscribe?token=xxx

Unsubscribe from email alerts without logging in (token from email link).

**Authentication:** None (token-based)

```bash
curl "https://nodes.example.com/api/alerts/unsubscribe?token=64hexchars"
```

**Response:**
```json
{
  "success": true,
  "message": "You have been successfully unsubscribed from email alerts.",
  "nodeInfo": {
    "ip": "192.168.1.1",
    "port": 33117
  }
}
```

#### GET /api/alerts/history

Get user's alert history (sent notifications).

**Authentication:** Required (session)

**Query Parameters:**
- `limit`: Max results (default: 50)
- `offset`: Pagination offset (default: 0)
- `nodeId`: Filter by specific node

**Response:**
```json
{
  "history": [
    {
      "id": "uuid",
      "subscription_id": "uuid",
      "node_id": "uuid",
      "alert_type": "offline",
      "email_sent": true,
      "webhook_sent": true,
      "message": "Node MyNode offline",
      "created_at": "2025-01-20T15:30:00Z",
      "node": {
        "ip": "192.168.1.1",
        "port": 33117,
        "country_name": "United States"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 125
  }
}
```

---

### 7. Node Registration

Manually register a node (if not discovered by crawler).

#### POST /api/nodes/register

**Authentication:** Required (session)

**Request Body:**
```json
{
  "ip": "192.168.1.1",
  "port": 33117
}
```

**Process:**
1. Validates IP and port format
2. Probes the node to verify it's reachable (TCP connection test)
3. If reachable, adds to database with `source: "manual"`
4. Crawler will update full details on next pass

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Node registered successfully! The crawler will update its details shortly.",
  "node": {
    "id": "uuid",
    "ip": "192.168.1.1",
    "port": 33117,
    "status": "up"
  }
}
```

**Errors:**
- `409 Conflict`: Node already registered
- `422 Unprocessable`: Node not reachable

#### GET /api/nodes/register

Get nodes registered by the authenticated user.

**Authentication:** Required (session)

---

### 8. Admin Endpoints

Administrative endpoints for moderation and user management.

**Authentication:** Required (admin session - email must be in ADMIN_EMAILS or admin_users table)

#### GET /api/admin/check

Check if current user is an admin.

```json
{
  "isAdmin": true,
  "role": "super_admin"
}
```

#### GET /api/admin/moderation

Get moderation queue (pending verifications, profile changes, avatars).

**Query Parameters:**
- `status`: `pending`, `approved`, `rejected`, `all` (default: `pending`)
- `type`: `verification`, `profile`, `avatar`, `all` (default: `all`)
- `page`, `limit`: Pagination

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "item_type": "verification",
      "item_id": "uuid",
      "user_id": "uuid",
      "user_email": "user@example.com",
      "status": "pending",
      "created_at": "2025-01-20T00:00:00Z",
      "node_info": {
        "ip": "192.168.1.1",
        "port": 33117,
        "country_name": "United States"
      },
      "verification_info": {
        "method": "http_file",
        "created_at": "2025-01-20T00:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "pages": 1
  }
}
```

#### POST /api/admin/moderation

Review a moderation item.

**Request Body:**
```json
{
  "itemId": "uuid",
  "action": "approve",
  "notes": "Optional review notes"
}
```

**Actions:** `approve`, `reject`, `flag`

#### GET /api/admin/users

List all users with admin management options.

#### POST /api/admin/users/[id]/ban

Ban a user.

#### GET /api/admin/audit

Get admin audit logs.

#### GET /api/admin/settings

Get admin settings.

---

### 9. Internal/Cron Endpoints

These endpoints are called by internal services (crawler, cron jobs). Protected by API keys set in environment variables.

#### POST /api/alerts/process

Process pending alerts based on node status changes. Called by crawler after each pass.

**Authentication:** Bearer token (`ALERTS_PROCESS_KEY` env var)

```bash
curl -X POST -H "Authorization: Bearer $ALERTS_PROCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"checkMinutes": 10}' \
  "https://nodes.example.com/api/alerts/process"
```

**Request Body:**
```json
{
  "checkMinutes": 10
}
```

**Process:**
1. Finds nodes with status changes in the last N minutes
2. Matches against alert subscriptions
3. Sends email and/or webhook notifications
4. Records alert history
5. Respects cooldown settings

**Response:**
```json
{
  "processed": 5,
  "sent": 3,
  "details": ["192.168.1.1:offline:sub-uuid", "..."]
}
```

#### POST /api/cron/snapshots

Create a network snapshot for historical tracking. **Deprecated** - snapshots are now created automatically by the crawler.

**Authentication:** Bearer token (`CRON_SECRET` env var)

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://nodes.example.com/api/cron/snapshots"
```

**Response:**
```json
{
  "success": true,
  "message": "Snapshot created",
  "timestamp": "2025-01-21T00:00:00Z",
  "totalNodes": 1234,
  "onlineNodes": 1200
}
```

#### GET /api/cron/snapshots

Get the latest snapshot information.

**Authentication:** None

```json
{
  "lastSnapshot": "2025-01-21T00:00:00Z",
  "totalNodes": 1234,
  "onlineNodes": 1200
}
```

---

### 10. GET /api/health

Health check endpoint for monitoring.

**Authentication:** None

```bash
curl "https://nodes.example.com/api/health"
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T00:00:00Z"
}
```

---

## Support

For issues or questions about the API:
- GitHub: [RaxTzu/AtlasP2P](https://github.com/RaxTzu/AtlasP2P)
- Discord: [Dingocoin Community](https://discord.gg/dingocoin)

---

**Last Updated:** 2026-01-21
**API Version:** 1.1.0
