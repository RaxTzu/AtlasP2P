# Dingocoin Nodes Map - API Quick Reference

## Endpoints Overview

| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `GET /api/nodes.json` | List all nodes with filtering | `country`, `tier`, `verified`, `online`, `page`, `limit` |
| `GET /api/stats.json` | Network-wide statistics | None |
| `GET /api/countries.json` | Country distribution & stats | `sort`, `order`, `online_only` |

## Quick Examples

### 1. Get All Diamond Tier Nodes
```bash
curl "https://nodes.dingocoin.org/api/nodes.json?tier=diamond&online=true"
```

### 2. Get Network Health
```bash
curl "https://nodes.dingocoin.org/api/stats.json" | jq '.network_health'
```

### 3. Get Top 10 Countries
```bash
curl "https://nodes.dingocoin.org/api/countries.json?sort=count&order=desc" | jq '.countries[:10]'
```

### 4. Get Verified Nodes in USA
```bash
curl "https://nodes.dingocoin.org/api/nodes.json?country=US&verified=true"
```

### 5. Get Nodes Sorted by PIX Score
```bash
curl "https://nodes.dingocoin.org/api/nodes.json?sort=pix_score&order=desc&limit=50"
```

## Response Headers

All responses include:
- `Access-Control-Allow-Origin: *` (CORS enabled)
- `X-RateLimit-Limit: 1000` (requests per hour)
- `X-RateLimit-Remaining: <remaining>`
- `X-RateLimit-Reset: <timestamp>`
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`

## Filter Parameters

### /api/nodes.json

| Parameter | Type | Values | Example |
|-----------|------|--------|---------|
| `country` | string | ISO 3166-1 alpha-2 | `US`, `DE`, `CN` |
| `tier` | string | diamond, gold, silver, bronze, standard | `tier=diamond` |
| `verified` | boolean | true, false | `verified=true` |
| `online` | boolean | true, false | `online=true` |
| `version` | string | Any version string | `version=1.16.0` |
| `sort` | string | last_seen, first_seen, pix_score, tier, uptime_percentage | `sort=pix_score` |
| `order` | string | asc, desc | `order=desc` |
| `page` | integer | 1+ | `page=1` |
| `limit` | integer | 1-500 | `limit=100` |

### /api/countries.json

| Parameter | Type | Values | Example |
|-----------|------|--------|---------|
| `sort` | string | code, name, count | `sort=count` |
| `order` | string | asc, desc | `order=desc` |
| `online_only` | boolean | true, false | `online_only=true` |

## Node Tiers

| Tier | PIX Score | Uptime | Latency |
|------|-----------|--------|---------|
| Diamond | > 950 | > 99% | < 50ms |
| Gold | > 900 | > 98% | < 100ms |
| Silver | > 850 | > 95% | < 200ms |
| Bronze | > 800 | > 90% | < 500ms |
| Standard | Any | Any | Any |

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Integration Snippets

### Python
```python
import requests
r = requests.get('https://nodes.dingocoin.org/api/nodes.json',
                 params={'tier': 'diamond', 'online': 'true'})
print(r.json())
```

### JavaScript
```javascript
const response = await fetch('https://nodes.dingocoin.org/api/stats.json');
const stats = await response.json();
console.log(stats.network_health);
```

### cURL + jq
```bash
curl -s "https://nodes.dingocoin.org/api/countries.json" | jq '.countries[:5]'
```

## Common Use Cases

1. **Monitor Network Health**: Poll `/api/stats.json` every 5 minutes
2. **Find Reliable Nodes**: Filter by `tier=diamond&verified=true`
3. **Geographic Distribution**: Use `/api/countries.json` for visualization
4. **Track Uptime**: Sort by `uptime_percentage` in descending order
5. **Version Adoption**: Check `versions` field in `/api/stats.json`

## Rate Limits

- **Default**: 1000 requests/hour per IP
- **Caching**: 60 seconds CDN cache, 120 seconds stale-while-revalidate
- **Best Practice**: Cache responses locally, poll no more than once per minute

## Support

- **Documentation**: [Full API Docs](./API.md)
- **Issues**: [GitHub Issues](https://github.com/RaxTzu/AtlasP2P/issues)
- **Community**: [Discord](https://discord.gg/dingocoin)
