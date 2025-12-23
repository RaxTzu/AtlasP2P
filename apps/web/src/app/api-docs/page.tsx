'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Book,
  Code2,
  Key,
  Zap,
  Shield,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Terminal,
  Globe,
  Lock,
  Unlock,
  Server,
  Activity,
  Trophy,
  User,
  Play,
  ArrowRight,
  Hash,
  FileJson,
  AlertCircle,
  Bell,
} from 'lucide-react';
import { getThemeConfig, getChainConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

// Get API key prefix example based on configured chain ticker
const chainConfig = getChainConfig();
const API_KEY_PREFIX = `${chainConfig.ticker.toLowerCase()}_sk_`;
const TICKER = chainConfig.ticker;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

interface EndpointDetail {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  auth: 'none' | 'api-key' | 'jwt';
  category: 'nodes' | 'stats' | 'auth' | 'keys' | 'profiles' | 'alerts';
  parameters?: Parameter[];
  requestBody?: string;
  responseExample: string;
  responseFields?: { name: string; type: string; description: string }[];
}

const endpoints: EndpointDetail[] = [
  {
    id: 'list-nodes',
    method: 'GET',
    path: '/api/nodes',
    title: 'List Nodes',
    description: 'Retrieve a paginated list of all discovered nodes with optional filtering and sorting.',
    auth: 'none',
    category: 'nodes',
    parameters: [
      { name: 'page', type: 'integer', required: false, description: 'Page number for pagination', default: '1' },
      { name: 'limit', type: 'integer', required: false, description: 'Number of results per page (max 100)', default: '50' },
      { name: 'online', type: 'string', required: false, description: 'Filter by online status: "true" for online nodes only' },
      { name: 'tier', type: 'string', required: false, description: 'Filter by tier: diamond, gold, silver, bronze, standard' },
      { name: 'country', type: 'string', required: false, description: 'Filter by country code (ISO 3166-1 alpha-2)' },
      { name: 'version', type: 'string', required: false, description: 'Filter by client version' },
      { name: 'verified', type: 'string', required: false, description: 'Filter by verification status: "true" for verified only' },
      { name: 'sort', type: 'string', required: false, description: 'Sort field: pix_score, uptime, latency, last_seen', default: 'pix_score' },
      { name: 'order', type: 'string', required: false, description: 'Sort order: asc, desc', default: 'desc' },
    ],
    responseExample: `{
  "nodes": [
    {
      "id": "uuid",
      "ip": "192.168.1.1",
      "port": 33117,
      "status": "online",
      "tier": "gold",
      "pix_score": 925,
      "uptime": 99.5,
      "latency_ms": 45,
      "version": "1.16.0",
      "country_code": "US",
      "country_name": "United States",
      "city": "New York",
      "is_verified": true,
      "last_seen": "2024-01-15T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "pages": 25
  }
}`,
  },
  {
    id: 'get-node',
    method: 'GET',
    path: '/api/nodes/{id}',
    title: 'Get Node Details',
    description: 'Retrieve detailed information about a specific node including profile data and 30-day uptime history.',
    auth: 'none',
    category: 'nodes',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The unique identifier of the node' },
    ],
    responseExample: `{
  "node": {
    "id": "uuid",
    "ip": "192.168.1.1",
    "port": 33117,
    "address": "192.168.1.1:33117",
    "status": "up",
    "tier": "gold",
    "pixScore": 925,
    "uptime": 99.5,
    "latencyMs": 45,
    "latencyAvg": 52,
    "version": "1.16.0",
    "protocolVersion": 70015,
    "services": "NODE_NETWORK",
    "startHeight": 4500000,
    "countryCode": "US",
    "countryName": "United States",
    "city": "New York",
    "region": "NY",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "isp": "Example ISP",
    "asn": 12345,
    "isVerified": true,
    "firstSeen": "2023-06-01T00:00:00Z",
    "lastSeen": "2024-01-15T12:00:00Z",
    "timesSeen": 15000,
    "displayName": "My Node",
    "description": "A reliable community node"
  },
  "uptimeHistory": [
    {
      "snapshot_time": "2024-01-14T00:00:00Z",
      "is_online": true,
      "response_time_ms": 45
    }
  ]
}`,
  },
  {
    id: 'get-stats',
    method: 'GET',
    path: '/api/stats',
    title: 'Network Statistics',
    description: 'Get aggregated network statistics including node counts, version distribution, and geographic data.',
    auth: 'none',
    category: 'stats',
    responseExample: `{
  "network": {
    "total_nodes": 1234,
    "online_nodes": 1150,
    "offline_nodes": 84,
    "countries": 45,
    "health_score": 93.2
  },
  "tiers": {
    "diamond": 12,
    "gold": 89,
    "silver": 234,
    "bronze": 456,
    "standard": 443
  },
  "versions": [
    { "version": "1.16.0", "count": 800, "percentage": 64.8 },
    { "version": "1.15.2", "count": 300, "percentage": 24.3 }
  ],
  "countries": [
    { "code": "US", "name": "United States", "count": 450 },
    { "code": "DE", "name": "Germany", "count": 200 }
  ],
  "updated_at": "2024-01-15T12:00:00Z"
}`,
  },
  {
    id: 'get-leaderboard',
    method: 'GET',
    path: '/api/leaderboard',
    title: 'Node Leaderboard',
    description: 'Get the top-performing nodes ranked by PIX score with pagination.',
    auth: 'none',
    category: 'stats',
    parameters: [
      { name: 'page', type: 'integer', required: false, description: 'Page number for pagination', default: '1' },
      { name: 'limit', type: 'integer', required: false, description: 'Number of results per page (max 100)', default: '100' },
    ],
    responseExample: `{
  "leaderboard": [
    {
      "rank": 1,
      "node_id": "uuid",
      "display_name": "Champion Node",
      "ip": "192.168.1.1",
      "port": 33117,
      "tier": "diamond",
      "pix_score": 985,
      "uptime": 99.99,
      "latency_avg": 12,
      "country_code": "US",
      "is_verified": true,
      "rank_change": 0
    }
  ],
  "updated_at": "2024-01-15T12:00:00Z"
}`,
  },
  {
    id: 'list-keys',
    method: 'GET',
    path: '/api/keys',
    title: 'List API Keys',
    description: 'List all API keys associated with your account.',
    auth: 'jwt',
    category: 'keys',
    responseExample: `{
  "keys": [
    {
      "id": "uuid",
      "name": "Production Key",
      "keyPrefix": "${API_KEY_PREFIX}abc...",
      "description": "My production API key",
      "scopes": ["read:nodes", "read:stats"],
      "rateLimit": 1000,
      "lastUsedAt": "2024-01-15T12:00:00Z",
      "requestCount": 5000,
      "isActive": true,
      "expiresAt": null,
      "revokedAt": null,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}`,
  },
  {
    id: 'create-key',
    method: 'POST',
    path: '/api/keys',
    title: 'Create API Key',
    description: 'Create a new API key with specified permissions and optional expiration. Maximum 10 active keys per user.',
    auth: 'jwt',
    category: 'keys',
    requestBody: `{
  "name": "My API Key",
  "description": "Optional description",
  "scopes": ["read:nodes", "read:stats"],
  "rateLimit": 1000,
  "expiresAt": "2025-01-15T00:00:00Z"
}`,
    responseExample: `{
  "key": {
    "id": "uuid",
    "name": "My API Key",
    "keyPrefix": "${API_KEY_PREFIX}abc...",
    "scopes": ["read:nodes", "read:stats"],
    "rateLimit": 1000,
    "expiresAt": "2025-01-15T00:00:00Z",
    "createdAt": "2024-01-15T00:00:00Z"
  },
  "rawKey": "${API_KEY_PREFIX}live_abc123...",
  "warning": "Store this key securely. It will not be shown again."
}`,
  },
  {
    id: 'get-key',
    method: 'GET',
    path: '/api/keys/{id}',
    title: 'Get API Key Details',
    description: 'Get details of a specific API key including usage stats.',
    auth: 'jwt',
    category: 'keys',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The API key ID' },
    ],
    responseExample: `{
  "key": {
    "id": "uuid",
    "name": "My API Key",
    "keyPrefix": "${API_KEY_PREFIX}abc...",
    "description": "Production key",
    "scopes": ["read:nodes", "read:stats"],
    "rateLimit": 1000,
    "lastUsedAt": "2024-01-15T12:00:00Z",
    "requestCount": 1234,
    "isActive": true,
    "expiresAt": null,
    "revokedAt": null,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}`,
  },
  {
    id: 'update-key',
    method: 'PUT',
    path: '/api/keys/{id}',
    title: 'Update API Key',
    description: 'Update API key settings like name, scopes, or rate limit.',
    auth: 'jwt',
    category: 'keys',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The API key ID' },
    ],
    requestBody: `{
  "name": "Updated Key Name",
  "description": "New description",
  "scopes": ["read:nodes"],
  "rateLimit": 500,
  "isActive": true
}`,
    responseExample: `{
  "key": {
    "id": "uuid",
    "name": "Updated Key Name",
    "keyPrefix": "${API_KEY_PREFIX}abc...",
    "scopes": ["read:nodes"],
    "rateLimit": 500,
    "isActive": true,
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}`,
  },
  {
    id: 'delete-key',
    method: 'DELETE',
    path: '/api/keys/{id}',
    title: 'Revoke API Key',
    description: 'Revoke an API key. Add ?permanent=true to permanently delete instead of just revoking.',
    auth: 'jwt',
    category: 'keys',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The API key ID to revoke' },
      { name: 'permanent', type: 'boolean', required: false, description: 'If true, permanently deletes the key', default: 'false' },
    ],
    responseExample: `{
  "success": true,
  "message": "API key revoked"
}`,
  },
  // Profile endpoints
  {
    id: 'get-profile',
    method: 'GET',
    path: '/api/profiles/{id}',
    title: 'Get Node Profile',
    description: 'Get the public profile for a verified node including display name, description, and social links.',
    auth: 'none',
    category: 'profiles',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The node ID' },
    ],
    responseExample: `{
  "profile": {
    "node_id": "uuid",
    "display_name": "Community Node #1",
    "description": "A reliable node serving the network since 2023",
    "avatar_url": "https://...",
    "website": "https://example.com",
    "twitter": "@nodeoperator",
    "discord": "nodeop#1234",
    "is_public": true,
    "created_at": "2023-06-01T00:00:00Z"
  }
}`,
  },
  {
    id: 'update-profile',
    method: 'PUT',
    path: '/api/profiles/{id}',
    title: 'Update Node Profile',
    description: 'Submit profile changes for review. Changes go to a moderation queue and require admin approval before going live.',
    auth: 'jwt',
    category: 'profiles',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The node ID (must be owned by you)' },
    ],
    requestBody: `{
  "displayName": "My Awesome Node",
  "description": "Running 24/7 with 99.9% uptime",
  "website": "https://mynode.example.com",
  "twitter": "@mynode",
  "github": "mynode",
  "discord": "mynode#1234",
  "telegram": "@mynode",
  "isPublic": true,
  "tipConfig": {
    "walletAddress": "D...",
    "acceptedCoins": ["${TICKER}"],
    "isActive": true
  }
}`,
    responseExample: `{
  "success": true,
  "message": "Your changes have been submitted for review.",
  "pending": true,
  "pendingChanges": {
    "display_name": "My Awesome Node",
    "description": "Running 24/7 with 99.9% uptime"
  }
}`,
  },
  // Alert endpoints
  {
    id: 'list-alerts',
    method: 'GET',
    path: '/api/alerts',
    title: 'List Alert Subscriptions',
    description: 'List all your alert subscriptions for node monitoring.',
    auth: 'jwt',
    category: 'alerts',
    responseExample: `{
  "subscriptions": [
    {
      "id": "uuid",
      "node_id": "uuid",
      "alert_offline": true,
      "alert_online": true,
      "alert_version_outdated": false,
      "email_enabled": true,
      "email_address": "alerts@example.com",
      "webhook_enabled": true,
      "webhook_url": "https://discord.com/api/webhooks/...",
      "cooldown_minutes": 60,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`,
  },
  {
    id: 'create-alert',
    method: 'POST',
    path: '/api/alerts',
    title: 'Create Alert Subscription',
    description: 'Subscribe to alerts for a verified node. Get notified via email or Discord webhook. At least one channel must be enabled.',
    auth: 'jwt',
    category: 'alerts',
    requestBody: `{
  "nodeId": "uuid",
  "alertOffline": true,
  "alertOnline": true,
  "alertVersionOutdated": false,
  "alertTierChange": false,
  "emailEnabled": true,
  "webhookEnabled": true,
  "webhookUrl": "https://discord.com/api/webhooks/...",
  "webhookType": "discord",
  "cooldownMinutes": 60
}`,
    responseExample: `{
  "subscription": {
    "id": "uuid",
    "node_id": "uuid",
    "alert_offline": true,
    "alert_online": true,
    "email_enabled": true,
    "webhook_enabled": true,
    "created_at": "2024-01-15T00:00:00Z"
  }
}`,
  },
  {
    id: 'update-alert',
    method: 'PUT',
    path: '/api/alerts/{id}',
    title: 'Update Alert Subscription',
    description: 'Update an existing alert subscription settings.',
    auth: 'jwt',
    category: 'alerts',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The subscription ID' },
    ],
    requestBody: `{
  "alert_offline": true,
  "alert_online": false,
  "email_enabled": true,
  "email_address": "newemail@example.com",
  "webhook_enabled": false,
  "cooldown_minutes": 120
}`,
    responseExample: `{
  "subscription": {
    "id": "uuid",
    "alert_offline": true,
    "alert_online": false,
    "updated_at": "2024-01-15T12:00:00Z"
  }
}`,
  },
  {
    id: 'delete-alert',
    method: 'DELETE',
    path: '/api/alerts/{id}',
    title: 'Delete Alert Subscription',
    description: 'Remove an alert subscription. You will no longer receive notifications for this node.',
    auth: 'jwt',
    category: 'alerts',
    parameters: [
      { name: 'id', type: 'uuid', required: true, description: 'The subscription ID' },
    ],
    responseExample: `{
  "success": true
}`,
  },
  {
    id: 'test-alert',
    method: 'POST',
    path: '/api/alerts/test',
    title: 'Send Test Notification',
    description: 'Send a test notification to verify your email or Discord webhook is configured correctly. Type must be "email" or "discord".',
    auth: 'jwt',
    category: 'alerts',
    requestBody: `{
  "type": "email",
  "email": "optional@example.com"
}
// OR for Discord:
{
  "type": "discord",
  "webhookUrl": "https://discord.com/api/webhooks/..."
}`,
    responseExample: `{
  "success": true,
  "message": "Test email sent successfully to your@email.com"
}`,
  },
  // My Nodes
  {
    id: 'my-nodes',
    method: 'GET',
    path: '/api/my-nodes',
    title: 'List My Verified Nodes',
    description: 'Get all nodes that you have verified ownership of.',
    auth: 'jwt',
    category: 'profiles',
    responseExample: `{
  "nodes": [
    {
      "id": "uuid",
      "ip": "192.168.1.1",
      "port": 33117,
      "status": "online",
      "tier": "gold",
      "pix_score": 925,
      "is_verified": true,
      "verified_at": "2024-01-01T00:00:00Z"
    }
  ]
}`,
  },
];

const categories = [
  { id: 'nodes', label: 'Nodes', icon: Server },
  { id: 'stats', label: 'Statistics', icon: Activity },
  { id: 'profiles', label: 'Profiles', icon: User },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'keys', label: 'API Keys', icon: Key },
];

export default function ApiDocsPage() {
  const router = useRouter();
  const themeConfig = getThemeConfig();
  const chainConfig = getChainConfig();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript' | 'python'>('javascript');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>('list-nodes');
  const [activeCategory, setActiveCategory] = useState<string>('nodes');
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    checkAuth();
    // Set base URL from window.location.origin (works for both dev and prod)
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const methodStyles: Record<HttpMethod, { bg: string; text: string; border: string }> = {
    GET: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    POST: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
    PUT: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
    DELETE: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
  };

  const generateCodeExample = (endpoint: EndpointDetail) => {
    const url = `${baseUrl}${endpoint.path.replace('{id}', 'node-uuid-here')}`;
    const hasAuth = endpoint.auth !== 'none';

    const examples = {
      curl: `curl -X ${endpoint.method} "${url}"${hasAuth ? ` \\
  -H "Authorization: Bearer YOUR_TOKEN"` : ''}${endpoint.requestBody ? ` \\
  -H "Content-Type: application/json" \\
  -d '${endpoint.requestBody.replace(/\n/g, '')}'` : ''}`,

      javascript: `const response = await fetch('${url}', {
  method: '${endpoint.method}',${hasAuth ? `
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',${endpoint.requestBody ? `
    'Content-Type': 'application/json',` : ''}
  },` : ''}${endpoint.requestBody ? `
  body: JSON.stringify(${endpoint.requestBody}),` : ''}
});

const data = await response.json();
console.log(data);`,

      python: `import requests

response = requests.${endpoint.method.toLowerCase()}(
    '${url}',${hasAuth ? `
    headers={'Authorization': 'Bearer YOUR_TOKEN'},` : ''}${endpoint.requestBody ? `
    json=${endpoint.requestBody.replace(/"/g, "'")},` : ''}
)

data = response.json()
print(data)`,
    };

    return examples;
  };

  const filteredEndpoints = endpoints.filter(e => e.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: `${themeConfig.primaryColor}15` }}
            >
              <Book className="h-8 w-8" style={{ color: themeConfig.primaryColor }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">API Reference</h1>
              <p className="text-muted-foreground">Build powerful integrations with our REST API</p>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Base URL</p>
                <code className="text-sm font-mono">{baseUrl || '...'}/api</code>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Rate Limit</p>
                <p className="text-sm font-medium">60/min <span className="text-muted-foreground">• 120/min with key</span></p>
              </div>
            </div>
            <button
              onClick={() => router.push(isAuthenticated ? '/settings/api-keys' : '/auth?redirectTo=/settings/api-keys')}
              className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: `${themeConfig.primaryColor}10`,
                borderColor: `${themeConfig.primaryColor}30`,
              }}
            >
              <Key className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
              <div className="text-left flex-1">
                <p className="text-xs text-muted-foreground">Authentication</p>
                <p className="text-sm font-medium" style={{ color: themeConfig.primaryColor }}>
                  {isAuthenticated ? 'Manage API Keys' : 'Get API Key'} →
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <nav className="sticky top-24 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Endpoints
                </h3>
                <div className="space-y-1">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const count = endpoints.filter(e => e.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeCategory === cat.id
                            ? 'bg-primary/10 text-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                        style={activeCategory === cat.id ? { color: themeConfig.primaryColor } : {}}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {cat.label}
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Resources
                </h3>
                <div className="space-y-1">
                  <a
                    href="/openapi.yaml"
                    download
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <FileJson className="h-4 w-4" />
                    OpenAPI Spec
                  </a>
                </div>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Category Tabs */}
            <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-primary/10 font-medium'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    style={activeCategory === cat.id ? { color: themeConfig.primaryColor } : {}}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Endpoints */}
            <div className="space-y-4">
              {filteredEndpoints.map((endpoint) => {
                const isExpanded = expandedEndpoint === endpoint.id;
                const styles = methodStyles[endpoint.method];
                const codeExamples = generateCodeExample(endpoint);

                return (
                  <div
                    key={endpoint.id}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      isExpanded ? 'border-border bg-card' : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    {/* Header */}
                    <button
                      onClick={() => setExpandedEndpoint(isExpanded ? null : endpoint.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className={`px-2 py-1 rounded text-xs font-bold ${styles.bg} ${styles.text}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono flex-1">{endpoint.path}</code>
                      <div className="flex items-center gap-3">
                        {endpoint.auth === 'none' ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-500">
                            <Unlock className="h-3 w-3" />
                            Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-500">
                            <Lock className="h-3 w-3" />
                            Auth
                          </span>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        <div className="p-6 space-y-6">
                          {/* Description */}
                          <div>
                            <h3 className="font-semibold text-lg mb-2">{endpoint.title}</h3>
                            <p className="text-muted-foreground">{endpoint.description}</p>
                          </div>

                          {/* Parameters */}
                          {endpoint.parameters && endpoint.parameters.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Hash className="h-4 w-4" style={{ color: themeConfig.primaryColor }} />
                                Parameters
                              </h4>
                              <div className="border border-border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="text-left px-4 py-2 font-medium">Name</th>
                                      <th className="text-left px-4 py-2 font-medium">Type</th>
                                      <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Required</th>
                                      <th className="text-left px-4 py-2 font-medium">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {endpoint.parameters.map((param) => (
                                      <tr key={param.name}>
                                        <td className="px-4 py-2 font-mono text-xs">{param.name}</td>
                                        <td className="px-4 py-2 text-muted-foreground">{param.type}</td>
                                        <td className="px-4 py-2 hidden sm:table-cell">
                                          {param.required ? (
                                            <span className="text-amber-500 text-xs">required</span>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">optional</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">
                                          {param.description}
                                          {param.default && (
                                            <span className="text-xs ml-1">(default: {param.default})</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Request Body */}
                          {endpoint.requestBody && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <ArrowRight className="h-4 w-4" style={{ color: themeConfig.primaryColor }} />
                                Request Body
                              </h4>
                              <div className="relative bg-zinc-950 rounded-lg overflow-hidden">
                                <pre className="p-4 overflow-x-auto text-sm text-zinc-300">
                                  <code>{endpoint.requestBody}</code>
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* Code Examples */}
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Terminal className="h-4 w-4" style={{ color: themeConfig.primaryColor }} />
                              Example Request
                            </h4>
                            <div className="bg-zinc-950 rounded-lg overflow-hidden">
                              <div className="flex border-b border-zinc-800">
                                {(['javascript', 'curl', 'python'] as const).map((lang) => (
                                  <button
                                    key={lang}
                                    onClick={() => setActiveTab(lang)}
                                    className={`px-4 py-2 text-xs font-medium transition-colors ${
                                      activeTab === lang
                                        ? 'text-white bg-zinc-800'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                  >
                                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <div className="relative">
                                <pre className="p-4 overflow-x-auto text-sm text-zinc-300">
                                  <code>{codeExamples[activeTab]}</code>
                                </pre>
                                <button
                                  onClick={() => copyToClipboard(codeExamples[activeTab], `${endpoint.id}-${activeTab}`)}
                                  className="absolute top-3 right-3 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                >
                                  {copied === `${endpoint.id}-${activeTab}` ? (
                                    <Check className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-zinc-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Response */}
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Code2 className="h-4 w-4" style={{ color: themeConfig.primaryColor }} />
                              Example Response
                            </h4>
                            <div className="relative bg-zinc-950 rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                                <span className="text-xs text-emerald-500 font-medium">200 OK</span>
                                <button
                                  onClick={() => copyToClipboard(endpoint.responseExample, `${endpoint.id}-response`)}
                                  className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                >
                                  {copied === `${endpoint.id}-response` ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                                  )}
                                </button>
                              </div>
                              <pre className="p-4 overflow-x-auto text-sm text-zinc-300 max-h-80">
                                <code>{endpoint.responseExample}</code>
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Auth Info Section */}
            {activeCategory === 'keys' && (
              <div className="mt-8 p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-500 mb-2">Authentication Required</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      API key management endpoints require authentication. Sign in to your account
                      and use a session token or existing API key with the <code className="px-1 py-0.5 bg-muted rounded">write:keys</code> scope.
                    </p>
                    <button
                      onClick={() => router.push(isAuthenticated ? '/settings/api-keys' : '/auth?redirectTo=/settings/api-keys')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ backgroundColor: themeConfig.primaryColor, color: '#000' }}
                    >
                      <Key className="h-4 w-4" />
                      {isAuthenticated ? 'Manage API Keys' : 'Sign In'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
