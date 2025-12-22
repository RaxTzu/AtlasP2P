'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Activity,
  Shield,
  Loader2,
  ChevronLeft,
  X
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  description?: string;
  scopes: string[];
  rateLimit: number;
  lastUsedAt?: string;
  requestCount: number;
  isActive: boolean;
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
}

interface ConfirmAction {
  type: 'revoke' | 'rotate';
  keyId: string;
  keyName: string;
}

const AVAILABLE_SCOPES = [
  { id: 'read:nodes', label: 'Read Nodes', description: 'Access node information' },
  { id: 'read:stats', label: 'Read Stats', description: 'Access network statistics' },
  { id: 'read:leaderboard', label: 'Read Leaderboard', description: 'Access node rankings' },
  { id: 'read:profiles', label: 'Read Profiles', description: 'Access node profiles' },
];

export default function ApiKeysPage() {
  const router = useRouter();
  const themeConfig = getThemeConfig();
  const { toast, toasts, removeToast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: ApiKey; rawKey: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScopes, setFormScopes] = useState<string[]>(['read:nodes', 'read:stats', 'read:leaderboard']);
  const [formRateLimit, setFormRateLimit] = useState(1000);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth?redirectTo=/settings/api-keys');
      return;
    }

    fetchKeys();
  };

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (!response.ok) throw new Error('Failed to fetch keys');
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      toast.error('Failed to load', 'Could not fetch API keys');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (!formName.trim()) {
      setFormError('Key name is required');
      return;
    }

    setCreating(true);
    setFormError(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          scopes: formScopes,
          rateLimit: formRateLimit,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create key');
      }

      const data = await response.json();
      setNewKeyResult({ key: data.key, rawKey: data.rawKey });
      setShowCreateModal(false);
      resetForm();
      fetchKeys();
      toast.success('API key created', 'Copy your key now - it won\'t be shown again');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    setActionLoading(keyId);
    setConfirmAction(null);
    try {
      const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to revoke key');
      fetchKeys();
      toast.success('Key revoked', 'The API key has been permanently revoked');
    } catch (err) {
      toast.error('Revoke failed', 'Could not revoke the API key');
    } finally {
      setActionLoading(null);
    }
  };

  const rotateKey = async (keyId: string) => {
    setActionLoading(keyId);
    setConfirmAction(null);
    try {
      const response = await fetch(`/api/keys/${keyId}/rotate`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to rotate key');
      const data = await response.json();
      setNewKeyResult({ key: data.key, rawKey: data.rawKey });
      fetchKeys();
      toast.success('Key rotated', 'New key generated - copy it now');
    } catch (err) {
      toast.error('Rotation failed', 'Could not rotate the API key');
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormScopes(['read:nodes', 'read:stats', 'read:leaderboard']);
    setFormRateLimit(1000);
    setFormError(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied', 'API key copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeConfig.primaryColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} position="top-right" />

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${confirmAction.type === 'revoke' ? 'text-red-500' : 'text-yellow-500'}`} />
              {confirmAction.type === 'revoke' ? 'Revoke API Key?' : 'Rotate API Key?'}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              <strong>{confirmAction.keyName}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmAction.type === 'revoke'
                ? 'This will permanently revoke the key. Any applications using it will stop working immediately.'
                : 'This will revoke the current key and generate a new one. The old key will stop working immediately.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmAction.type === 'revoke' ? revokeKey(confirmAction.keyId) : rotateKey(confirmAction.keyId)}
                className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${
                  confirmAction.type === 'revoke' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {confirmAction.type === 'revoke' ? 'Revoke' : 'Rotate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/settings')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Settings
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Key className="h-8 w-8" style={{ color: themeConfig.primaryColor }} />
              API Keys
            </h1>
            <p className="text-muted-foreground">
              Create and manage API keys for programmatic access
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: themeConfig.primaryColor, color: '#000' }}
          >
            <Plus className="h-4 w-4" />
            Create Key
          </button>
        </div>
      </div>

      {/* New Key Result */}
      {newKeyResult && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Check className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-500 mb-1">API Key Created!</h3>
              <p className="text-sm text-muted-foreground">
                Copy your API key now. You won't be able to see it again.
              </p>
            </div>
          </div>
          <div className="bg-background rounded-lg p-4">
            <div className="flex items-center gap-3">
              <code className="flex-1 font-mono text-sm break-all">{newKeyResult.rawKey}</code>
              <button
                onClick={() => copyToClipboard(newKeyResult.rawKey, 'new-key')}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex-shrink-0"
              >
                {copied === 'new-key' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <button
            onClick={() => setNewKeyResult(null)}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ backgroundColor: `${themeConfig.primaryColor}20` }}
          >
            <Key className="h-8 w-8" style={{ color: themeConfig.primaryColor }} />
          </div>
          <h3 className="text-xl font-semibold mb-2">No API Keys Yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first API key to get started with programmatic access.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: themeConfig.primaryColor, color: '#000' }}
          >
            <Plus className="h-4 w-4" />
            Create Your First Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`bg-card border rounded-xl p-6 transition-colors ${
                key.isActive && !key.revokedAt
                  ? 'border-border hover:border-primary/30'
                  : 'border-red-500/20 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-lg">{key.name}</h3>
                    {key.revokedAt ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
                        Revoked
                      </span>
                    ) : !key.isActive ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400">
                        Inactive
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-muted-foreground">{key.keyPrefix}...</code>
                    <button
                      onClick={() => copyToClipboard(key.keyPrefix, key.id)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      {copied === key.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                {key.isActive && !key.revokedAt && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmAction({ type: 'rotate', keyId: key.id, keyName: key.name })}
                      disabled={actionLoading === key.id}
                      className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                      title="Rotate key"
                    >
                      {actionLoading === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'revoke', keyId: key.id, keyName: key.name })}
                      disabled={actionLoading === key.id}
                      className="p-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {key.description && (
                <p className="text-sm text-muted-foreground mb-4">{key.description}</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Scopes
                  </p>
                  <p className="font-medium">{key.scopes.length} permissions</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Requests
                  </p>
                  <p className="font-medium">{key.requestCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last Used
                  </p>
                  <p className="font-medium">
                    {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Created</p>
                  <p className="font-medium">{formatDate(key.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}
          />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Create API Key</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My API Key"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium mb-2">Permissions</label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formScopes.includes(scope.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormScopes([...formScopes, scope.id]);
                          } else {
                            setFormScopes(formScopes.filter((s) => s !== scope.id));
                          }
                        }}
                        className="rounded"
                        style={{ accentColor: themeConfig.primaryColor }}
                      />
                      <div>
                        <p className="font-medium text-sm">{scope.label}</p>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rate Limit (requests/hour)
                </label>
                <input
                  type="number"
                  value={formRateLimit}
                  onChange={(e) => setFormRateLimit(Math.min(10000, Math.max(10, parseInt(e.target.value) || 10)))}
                  min={10}
                  max={10000}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Between 10 and 10,000</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createKey}
                disabled={creating || !formName.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: themeConfig.primaryColor, color: '#000' }}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Create Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
