'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Mail,
  Webhook,
  Server,
  Loader2,
  Plus,
  Trash2,
  Send,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

interface Node {
  id: string;
  ip: string;
  port: number;
  country_name: string | null;
  city: string | null;
  status: string;
}

interface AlertSubscription {
  id: string;
  user_id: string;
  node_id: string | null;
  alert_offline: boolean;
  alert_online: boolean;
  alert_version_outdated: boolean;
  alert_tier_change: boolean;
  email_enabled: boolean;
  email_address: string | null;
  webhook_enabled: boolean;
  webhook_url: string | null;
  webhook_type: string;
  cooldown_minutes: number;
  last_alert_at: string | null;
  created_at: string;
  node?: Node;
}

// Editable fields for a subscription
interface EditableSubscription {
  alert_offline: boolean;
  alert_online: boolean;
  alert_version_outdated: boolean;
  alert_tier_change: boolean;
  email_enabled: boolean;
  email_address: string;
  webhook_enabled: boolean;
  webhook_url: string;
  cooldown_minutes: number;
}

interface VerifiedNode {
  node_id: string;
  node: Node;
}

// Cooldown duration in seconds
const TEST_COOLDOWN_SECONDS = 30;

export default function AlertSettingsPage() {
  const router = useRouter();
  const themeConfig = getThemeConfig();
  const { toast, toasts, removeToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ type: string; success: boolean; message: string } | null>(null);
  const [testWebhookUrl, setTestWebhookUrl] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [emailTestCooldown, setEmailTestCooldown] = useState(0);
  const [discordTestCooldown, setDiscordTestCooldown] = useState(0);
  const [subscriptions, setSubscriptions] = useState<AlertSubscription[]>([]);
  const [verifiedNodes, setVerifiedNodes] = useState<VerifiedNode[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, EditableSubscription>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  // Email cooldown timer effect
  useEffect(() => {
    if (emailTestCooldown <= 0) return;

    const timer = setInterval(() => {
      setEmailTestCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [emailTestCooldown]);

  // Discord cooldown timer effect
  useEffect(() => {
    if (discordTestCooldown <= 0) return;

    const timer = setInterval(() => {
      setDiscordTestCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [discordTestCooldown]);

  const [newSubscription, setNewSubscription] = useState({
    nodeId: '',
    alertOffline: true,
    alertOnline: true,
    alertVersionOutdated: false,
    alertTierChange: false,
    emailEnabled: true,
    webhookEnabled: false,
    webhookUrl: '',
    webhookType: 'discord',
    cooldownMinutes: 60,
  });

  // Refetch subscriptions (called after add/update/delete)
  const refetchSubscriptions = async () => {
    try {
      const subResponse = await fetch('/api/alerts');
      if (subResponse.ok) {
        const data = await subResponse.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (err) {
      console.error('Failed to refetch subscriptions:', err);
    }
  };

  // Fetch data only once on mount
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/auth?redirectTo=/settings/alerts');
          return;
        }

        if (!mounted) return;

        const email = user.email || '';
        setTestEmail(email);
        setUserEmail(email);

        // Fetch subscriptions
        const subResponse = await fetch('/api/alerts');
        if (subResponse.ok && mounted) {
          const data = await subResponse.json();
          setSubscriptions(data.subscriptions || []);
        }

        // Fetch verified nodes via API
        const nodesResponse = await fetch('/api/my-nodes');
        if (nodesResponse.ok && mounted) {
          const nodesData = await nodesResponse.json();
          if (nodesData.nodes && nodesData.nodes.length > 0) {
            const verified = nodesData.nodes.map((n: { id: string; ip: string; port: number; countryName?: string; city?: string; status: string }) => ({
              node_id: n.id,
              node: {
                id: n.id,
                ip: n.ip,
                port: n.port,
                country_name: n.countryName || null,
                city: n.city || null,
                status: n.status,
              }
            }));
            setVerifiedNodes(verified);
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        if (mounted) {
          toast.error('Failed to load data', 'Please refresh the page');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSubscription = async () => {
    setFormError(null);
    setSaving(true);

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubscription),
      });

      if (response.ok) {
        setShowAddForm(false);
        setNewSubscription({
          nodeId: '',
          alertOffline: true,
          alertOnline: true,
          alertVersionOutdated: false,
          alertTierChange: false,
          emailEnabled: true,
          webhookEnabled: false,
          webhookUrl: '',
          webhookType: 'discord',
          cooldownMinutes: 60,
        });
        await refetchSubscriptions();
        toast.success('Alert created', 'You will receive notifications for this subscription');
      } else {
        const error = await response.json();
        setFormError(error.error || 'Failed to create subscription');
      }
    } catch (err) {
      console.error('Failed to add subscription:', err);
      setFormError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Initialize editing state when expanding a subscription
  const startEditing = (sub: AlertSubscription) => {
    if (!editingData[sub.id]) {
      setEditingData(prev => ({
        ...prev,
        [sub.id]: {
          alert_offline: sub.alert_offline,
          alert_online: sub.alert_online,
          alert_version_outdated: sub.alert_version_outdated,
          alert_tier_change: sub.alert_tier_change,
          email_enabled: sub.email_enabled,
          email_address: sub.email_address || '',
          webhook_enabled: sub.webhook_enabled,
          webhook_url: sub.webhook_url || '',
          cooldown_minutes: sub.cooldown_minutes,
        }
      }));
    }
  };

  // Update local editing state
  const updateEditingField = (id: string, field: keyof EditableSubscription, value: boolean | string | number) => {
    setEditingData(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      }
    }));
  };

  // Check if there are unsaved changes
  const hasChanges = (sub: AlertSubscription): boolean => {
    const edit = editingData[sub.id];
    if (!edit) return false;
    return (
      edit.alert_offline !== sub.alert_offline ||
      edit.alert_online !== sub.alert_online ||
      edit.alert_version_outdated !== sub.alert_version_outdated ||
      edit.alert_tier_change !== sub.alert_tier_change ||
      edit.email_enabled !== sub.email_enabled ||
      edit.email_address !== (sub.email_address || '') ||
      edit.webhook_enabled !== sub.webhook_enabled ||
      edit.webhook_url !== (sub.webhook_url || '') ||
      edit.cooldown_minutes !== sub.cooldown_minutes
    );
  };

  // Save subscription changes
  const handleSaveSubscription = async (id: string) => {
    const edit = editingData[id];
    if (!edit) return;

    setSavingId(id);
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_offline: edit.alert_offline,
          alert_online: edit.alert_online,
          alert_version_outdated: edit.alert_version_outdated,
          alert_tier_change: edit.alert_tier_change,
          email_enabled: edit.email_enabled,
          email_address: edit.email_address || null,
          webhook_enabled: edit.webhook_enabled,
          webhook_url: edit.webhook_url || null,
          cooldown_minutes: edit.cooldown_minutes,
        }),
      });

      if (response.ok) {
        await refetchSubscriptions();
        toast.success('Saved', 'Alert settings updated');
        // Clear editing state for this subscription
        setEditingData(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        const error = await response.json();
        toast.error('Save failed', error.error || 'Could not save changes');
      }
    } catch (err) {
      console.error('Failed to update subscription:', err);
      toast.error('Network error', 'Please try again');
    } finally {
      setSavingId(null);
    }
  };

  // Cancel editing and revert changes
  const cancelEditing = (id: string) => {
    setEditingData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDeleteSubscription = async (id: string) => {
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refetchSubscriptions();
        toast.success('Deleted', 'Alert subscription removed');
      } else {
        toast.error('Delete failed', 'Could not remove subscription');
      }
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      toast.error('Network error', 'Please try again');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleTestNotification = async (type: 'email' | 'discord', value?: string) => {
    // Check cooldown for the specific channel
    const cooldown = type === 'email' ? emailTestCooldown : discordTestCooldown;
    if (cooldown > 0) return;

    setTesting(type);
    setTestResult(null);
    try {
      const body = type === 'email'
        ? { type, email: value }
        : { type, webhookUrl: value };

      const response = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setTestResult({ type, success: data.success, message: data.message || data.error });

      // Set cooldown for only the channel that was tested
      if (type === 'email') {
        setEmailTestCooldown(TEST_COOLDOWN_SECONDS);
      } else {
        setDiscordTestCooldown(TEST_COOLDOWN_SECONDS);
      }
    } catch (err) {
      setTestResult({ type, success: false, message: 'Failed to send test. Please try again.' });
      // Set cooldown for the failed channel
      if (type === 'email') {
        setEmailTestCooldown(10);
      } else {
        setDiscordTestCooldown(10);
      }
    } finally {
      setTesting(null);
    }
  };

  const getNodeLabel = (sub: AlertSubscription) => {
    if (!sub.node_id) return 'All Verified Nodes';
    if (sub.node) {
      const location = sub.node.city ? `${sub.node.city}, ${sub.node.country_name}` : sub.node.country_name;
      return `${sub.node.ip}:${sub.node.port}${location ? ` (${location})` : ''}`;
    }
    return 'Unknown Node';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeConfig.primaryColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} position="top-right" />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Delete Subscription?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              You will no longer receive alerts for this node. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSubscription(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/settings')}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
        >
          ← Back to Settings
        </button>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Bell className="h-8 w-8" style={{ color: themeConfig.primaryColor }} />
          Alert Settings
        </h1>
        <p className="text-muted-foreground">
          Get notified when your verified nodes go offline, come back online, or need updates.
        </p>
      </div>

      {/* Test Notifications */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          Test Notifications
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Send a test notification to verify your email and webhook are configured correctly.
        </p>

        {(emailTestCooldown > 0 || discordTestCooldown > 0) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4" />
            <span>
              {emailTestCooldown > 0 && discordTestCooldown > 0
                ? `Both channels on cooldown (Email: ${emailTestCooldown}s, Discord: ${discordTestCooldown}s)`
                : emailTestCooldown > 0
                ? `Email test on cooldown (${emailTestCooldown}s)`
                : `Discord test on cooldown (${discordTestCooldown}s)`
              }
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Your test email address"
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
              <button
                onClick={() => handleTestNotification('email', testEmail)}
                disabled={testing !== null || !testEmail || emailTestCooldown > 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 min-w-[130px] justify-center"
              >
                {testing === 'email' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {emailTestCooldown > 0 ? `Wait ${emailTestCooldown}s` : 'Test Email'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Discord Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={testWebhookUrl}
                onChange={(e) => setTestWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
              <button
                onClick={() => handleTestNotification('discord', testWebhookUrl)}
                disabled={testing !== null || !testWebhookUrl || discordTestCooldown > 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 min-w-[130px] justify-center"
              >
                {testing === 'discord' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Webhook className="h-4 w-4" />
                )}
                {discordTestCooldown > 0 ? `Wait ${discordTestCooldown}s` : 'Test Discord'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste your Discord webhook URL to test. Get one from Discord Server Settings → Integrations → Webhooks.
            </p>
          </div>
        </div>

        {testResult && (
          <div
            className={`mt-6 p-3 rounded-lg flex items-start gap-2 text-sm ${
              testResult.success
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {testResult.success ? <Check className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Active Subscriptions */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
            Alert Subscriptions ({subscriptions.length})
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={verifiedNodes.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: themeConfig.primaryColor }}
            title={verifiedNodes.length === 0 ? 'You need at least one verified node to create alerts' : undefined}
          >
            <Plus className="h-4 w-4" />
            Add Alert
          </button>
        </div>

        {verifiedNodes.length === 0 && (
          <div className="p-4 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              You need to verify at least one node before you can set up alerts.{' '}
              <button
                onClick={() => router.push('/manage/nodes')}
                className="underline hover:no-underline"
              >
                Verify a node
              </button>
            </p>
          </div>
        )}

        {subscriptions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">
            No alert subscriptions yet. Click &quot;Add Alert&quot; to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    if (expandedId === sub.id) {
                      setExpandedId(null);
                    } else {
                      setExpandedId(sub.id);
                      startEditing(sub);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${themeConfig.primaryColor}20` }}
                    >
                      <Server className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
                    </div>
                    <div>
                      <p className="font-medium">{getNodeLabel(sub)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {sub.email_enabled && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                        )}
                        {sub.webhook_enabled && (
                          <span className="flex items-center gap-1">
                            <Webhook className="h-3 w-3" /> Discord
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {sub.cooldown_minutes}m cooldown
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(sub.id);
                      }}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {expandedId === sub.id ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedId === sub.id && editingData[sub.id] && (
                  <div className="border-t border-border p-4 bg-muted/30 space-y-4">
                    {/* Alert Types */}
                    <div>
                      <p className="text-sm font-medium mb-2">Alert Types</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary transition-colors">
                          <input
                            type="checkbox"
                            checked={editingData[sub.id].alert_offline}
                            onChange={(e) => updateEditingField(sub.id, 'alert_offline', e.target.checked)}
                            className="rounded"
                          />
                          <WifiOff className="h-4 w-4 text-red-500" />
                          <span className="text-sm">Node Offline</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary transition-colors">
                          <input
                            type="checkbox"
                            checked={editingData[sub.id].alert_online}
                            onChange={(e) => updateEditingField(sub.id, 'alert_online', e.target.checked)}
                            className="rounded"
                          />
                          <Wifi className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Node Online</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary transition-colors">
                          <input
                            type="checkbox"
                            checked={editingData[sub.id].alert_version_outdated}
                            onChange={(e) => updateEditingField(sub.id, 'alert_version_outdated', e.target.checked)}
                            className="rounded"
                          />
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">Version Outdated</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary transition-colors">
                          <input
                            type="checkbox"
                            checked={editingData[sub.id].alert_tier_change}
                            onChange={(e) => updateEditingField(sub.id, 'alert_tier_change', e.target.checked)}
                            className="rounded"
                          />
                          <TrendingUp className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">Tier Change</span>
                        </label>
                      </div>
                    </div>

                    {/* Notification Channels */}
                    <div>
                      <p className="text-sm font-medium mb-2">Notification Channels</p>
                      <div className="space-y-3">
                        {/* Email */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary transition-colors">
                            <input
                              type="checkbox"
                              checked={editingData[sub.id].email_enabled}
                              onChange={(e) => updateEditingField(sub.id, 'email_enabled', e.target.checked)}
                              className="rounded"
                            />
                            <Mail className="h-4 w-4" />
                            <span className="text-sm">Email Notifications</span>
                          </label>
                          {editingData[sub.id].email_enabled && (
                            <div className="ml-6">
                              <input
                                type="email"
                                value={editingData[sub.id].email_address}
                                onChange={(e) => updateEditingField(sub.id, 'email_address', e.target.value)}
                                placeholder={userEmail || 'your@email.com'}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Leave empty to use your account email ({userEmail})
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Discord */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary transition-colors">
                            <input
                              type="checkbox"
                              checked={editingData[sub.id].webhook_enabled}
                              onChange={(e) => updateEditingField(sub.id, 'webhook_enabled', e.target.checked)}
                              className="rounded"
                            />
                            <Webhook className="h-4 w-4" />
                            <span className="text-sm">Discord Webhook</span>
                          </label>
                          {editingData[sub.id].webhook_enabled && (
                            <div className="ml-6">
                              <input
                                type="url"
                                value={editingData[sub.id].webhook_url}
                                onChange={(e) => updateEditingField(sub.id, 'webhook_url', e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cooldown */}
                    <div>
                      <p className="text-sm font-medium mb-2">Cooldown Period</p>
                      <select
                        value={editingData[sub.id].cooldown_minutes}
                        onChange={(e) => updateEditingField(sub.id, 'cooldown_minutes', parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={120}>2 hours</option>
                        <option value={360}>6 hours</option>
                        <option value={1440}>24 hours</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Minimum time between repeated alerts for the same issue
                      </p>
                    </div>

                    {/* Save/Cancel Buttons */}
                    {hasChanges(sub) && (
                      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                        <button
                          onClick={() => cancelEditing(sub.id)}
                          disabled={savingId === sub.id}
                          className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveSubscription(sub.id)}
                          disabled={savingId === sub.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                          style={{ backgroundColor: themeConfig.primaryColor }}
                        >
                          {savingId === sub.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Subscription Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
                New Alert Subscription
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Node</label>
                <select
                  value={newSubscription.nodeId}
                  onChange={(e) => setNewSubscription({ ...newSubscription, nodeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                >
                  <option value="">All Verified Nodes</option>
                  {verifiedNodes.map((v) => (
                    <option key={v.node_id} value={v.node_id}>
                      {`${v.node?.ip}:${v.node?.port}`}
                      {v.node?.city && ` (${v.node.city}, ${v.node.country_name})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Alert Types</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={newSubscription.alertOffline}
                      onChange={(e) => setNewSubscription({ ...newSubscription, alertOffline: e.target.checked })}
                      className="rounded"
                    />
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Offline</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={newSubscription.alertOnline}
                      onChange={(e) => setNewSubscription({ ...newSubscription, alertOnline: e.target.checked })}
                      className="rounded"
                    />
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Online</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={newSubscription.alertVersionOutdated}
                      onChange={(e) => setNewSubscription({ ...newSubscription, alertVersionOutdated: e.target.checked })}
                      className="rounded"
                    />
                    <Tag className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Outdated</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={newSubscription.alertTierChange}
                      onChange={(e) => setNewSubscription({ ...newSubscription, alertTierChange: e.target.checked })}
                      className="rounded"
                    />
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Tier Change</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Notification Channels</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={newSubscription.emailEnabled}
                      onChange={(e) => setNewSubscription({ ...newSubscription, emailEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Email Notifications</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={newSubscription.webhookEnabled}
                      onChange={(e) => setNewSubscription({ ...newSubscription, webhookEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <Webhook className="h-4 w-4" />
                    <span className="text-sm">Discord Webhook</span>
                  </label>
                  {newSubscription.webhookEnabled && (
                    <input
                      type="url"
                      value={newSubscription.webhookUrl}
                      onChange={(e) => setNewSubscription({ ...newSubscription, webhookUrl: e.target.value })}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Cooldown Period</label>
                <select
                  value={newSubscription.cooldownMinutes}
                  onChange={(e) => setNewSubscription({ ...newSubscription, cooldownMinutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour (recommended)</option>
                  <option value={120}>2 hours</option>
                  <option value={360}>6 hours</option>
                  <option value={1440}>24 hours</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubscription}
                disabled={saving || (!newSubscription.emailEnabled && !newSubscription.webhookEnabled)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: themeConfig.primaryColor }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
