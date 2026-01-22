'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flag,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  User,
  Image,
  Server,
  MapPin,
  Mail,
  X,
  Coins
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

interface TipConfig {
  wallet_address?: string;
  accepted_coins?: string[];
  minimum_tip?: number | null;
  thank_you_message?: string;
  is_active?: boolean;
}

interface ProfileChanges {
  display_name?: string;
  description?: string;
  avatar_url?: string;
  website?: string;
  twitter?: string;
  github?: string;
  discord?: string;
  telegram?: string;
  is_public?: boolean;
  tip_config?: TipConfig;
}

interface ModerationItem {
  id: string;
  item_type: 'avatar' | 'profile' | 'verification';
  item_id: string;
  user_id: string;
  user_email: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  content_url: string | null;
  content_data: any;
  created_at: string;
  flagged_by: string | null;
  flagged_by_email: string | null;
  flagged_at: string | null;
  flagged_reason: string | null;
  node_info?: {
    ip: string;
    port: number;
    country_name: string;
    city: string;
    version: string;
    status: string;
  } | null;
  verification_info?: {
    method: string;
    created_at: string;
  } | null;
  profile_info?: {
    current: ProfileChanges;
    pending: ProfileChanges;
    submitted_at: string;
  } | null;
}

export default function ModerationPage() {
  const router = useRouter();
  const theme = getThemeConfig();
  const { toast, toasts, removeToast } = useToast();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'flagged' | 'all'>('pending');
  const [reasonModal, setReasonModal] = useState<{
    itemId: string;
    action: 'reject' | 'flag';
  } | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchModerationQueue();
  }, [filter]);

  const fetchModerationQueue = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/moderation?status=${filter}`);

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/manage');
          return;
        }
        throw new Error('Failed to fetch moderation queue');
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (itemId: string, action: 'approve' | 'reject' | 'flag', notes?: string) => {
    setReviewing(itemId);

    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action, notes }),
      });

      if (!response.ok) throw new Error('Failed to review item');

      const actionLabel = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged';
      toast.success('Done', `Item has been ${actionLabel}`);
      await fetchModerationQueue();
    } catch (err) {
      console.error(err);
      toast.error('Failed', 'Could not complete the review action');
    } finally {
      setReviewing(null);
    }
  };

  const handleReasonSubmit = () => {
    if (!reasonModal || !reason.trim()) return;
    handleReview(reasonModal.itemId, reasonModal.action, reason);
    setReasonModal(null);
    setReason('');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'avatar': return <Image className="h-4 w-4" />;
      case 'profile': return <User className="h-4 w-4" />;
      case 'verification': return <ShieldCheck className="h-4 w-4" />;
      default: return <Flag className="h-4 w-4" />;
    }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const flaggedCount = items.filter(i => i.status === 'flagged').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.primaryColor }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Content Moderation</h1>
        <p className="text-muted-foreground">
          Review and moderate user-submitted content
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'text-white'
              : 'bg-muted hover:bg-muted/80'
          }`}
          style={filter === 'pending' ? { backgroundColor: theme.primaryColor } : {}}
        >
          Pending
          {pendingCount > 0 && (
            <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
              filter === 'pending' ? 'bg-white/20' : 'bg-yellow-500 text-white'
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('flagged')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'flagged'
              ? 'text-white'
              : 'bg-muted hover:bg-muted/80'
          }`}
          style={filter === 'flagged' ? { backgroundColor: '#f59e0b' } : {}}
        >
          Flagged
          {flaggedCount > 0 && (
            <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
              filter === 'flagged' ? 'bg-white/20' : 'bg-orange-500 text-white'
            }`}>
              {flaggedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'text-white'
              : 'bg-muted hover:bg-muted/80'
          }`}
          style={filter === 'all' ? { backgroundColor: theme.primaryColor } : {}}
        >
          All ({items.length})
        </button>
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="glass-strong rounded-xl p-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-semibold mb-2">All Clear!</h2>
          <p className="text-muted-foreground">
            No items requiring moderation at this time
          </p>
        </div>
      )}

      {/* Moderation Queue */}
      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass-strong rounded-xl p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Content Preview */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full uppercase"
                      style={{
                        backgroundColor: `${theme.primaryColor}20`,
                        color: theme.primaryColor
                      }}
                    >
                      {getTypeIcon(item.item_type)}
                      {item.item_type}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'pending'
                          ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                          : item.status === 'approved'
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : item.status === 'flagged'
                          ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {/* Flagged Info */}
                  {item.status === 'flagged' && item.flagged_by_email && (
                    <div className="mb-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Flagged for review</span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span>By: </span>
                        <span className="font-medium">{item.flagged_by_email}</span>
                        {item.flagged_at && (
                          <span> on {new Date(item.flagged_at).toLocaleString()}</span>
                        )}
                      </div>
                      {item.flagged_reason && (
                        <div className="mt-1 text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span>{item.flagged_reason}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Avatar Preview */}
                  {item.item_type === 'avatar' && item.content_url && (
                    <div className="flex items-center gap-4 mb-3">
                      <img
                        src={item.content_url}
                        alt="Avatar preview"
                        className="h-20 w-20 rounded-xl object-cover border-2 border-border"
                      />
                      <div>
                        <p className="font-medium mb-1">
                          {item.content_data?.display_name || 'No display name'}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.content_data?.description || 'No description'}
                        </p>
                        <a
                          href={item.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm inline-flex items-center gap-1 mt-2 hover:underline"
                          style={{ color: theme.primaryColor }}
                        >
                          View full size <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Verification Preview */}
                  {item.item_type === 'verification' && (
                    <div className="mb-3 space-y-2">
                      <p className="font-medium">Node Verification Request</p>

                      {/* User Info */}
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">User:</span>
                        <span className="font-medium">{item.user_email || 'Unknown'}</span>
                      </div>

                      {/* Node Info */}
                      {item.node_info && (
                        <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-medium">
                              {item.node_info.ip}:{item.node_info.port}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              item.node_info.status === 'up'
                                ? 'bg-green-500/15 text-green-600'
                                : 'bg-red-500/15 text-red-600'
                            }`}>
                              {item.node_info.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {item.node_info.city && `${item.node_info.city}, `}
                            {item.node_info.country_name || 'Unknown location'}
                          </div>
                          {item.node_info.version && (
                            <div className="text-xs text-muted-foreground">
                              Version: {item.node_info.version}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Verification Method */}
                      {item.verification_info?.method && (
                        <div className="flex items-center gap-2 text-sm">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Method:</span>
                          <span
                            className="font-medium px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                          >
                            {item.verification_info.method}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Profile Changes Preview */}
                  {item.item_type === 'profile' && (
                    <div className="mb-3 space-y-2">
                      <p className="font-medium">Profile Change Request</p>

                      {/* User Info */}
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">User:</span>
                        <span className="font-medium">{item.user_email || 'Unknown'}</span>
                      </div>

                      {/* Node Info */}
                      {item.node_info && (
                        <div className="p-3 rounded-lg bg-muted/50 space-y-1.5 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-medium">
                              {item.node_info.ip}:{item.node_info.port}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {item.node_info.city && `${item.node_info.city}, `}
                            {item.node_info.country_name || 'Unknown location'}
                          </div>
                        </div>
                      )}

                      {/* Profile Changes Comparison */}
                      {item.profile_info && (() => {
                        // Check if there are any actual changes to display
                        const current = item.profile_info!.current;
                        const pending = item.profile_info!.pending;
                        const hasProfileChanges =
                          current?.display_name !== pending?.display_name ||
                          current?.description !== pending?.description ||
                          current?.avatar_url !== pending?.avatar_url ||
                          current?.website !== pending?.website ||
                          current?.twitter !== pending?.twitter ||
                          current?.github !== pending?.github ||
                          current?.discord !== pending?.discord ||
                          current?.telegram !== pending?.telegram ||
                          current?.is_public !== pending?.is_public;
                        const hasTipChanges = pending?.tip_config && (
                          current?.tip_config?.is_active !== pending?.tip_config?.is_active ||
                          current?.tip_config?.wallet_address !== pending?.tip_config?.wallet_address ||
                          JSON.stringify(current?.tip_config?.accepted_coins || []) !== JSON.stringify(pending?.tip_config?.accepted_coins || []) ||
                          current?.tip_config?.minimum_tip !== pending?.tip_config?.minimum_tip ||
                          current?.tip_config?.thank_you_message !== pending?.tip_config?.thank_you_message
                        );

                        if (!hasProfileChanges && !hasTipChanges) {
                          return (
                            <div className="p-3 rounded-lg bg-muted/30 text-center">
                              <p className="text-sm text-muted-foreground">
                                No visible changes detected. The user may need to resubmit their changes.
                              </p>
                            </div>
                          );
                        }

                        return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase">Current</div>
                            <div className="text-xs font-medium text-muted-foreground uppercase">Requested</div>
                          </div>

                          {/* Display Name */}
                          {(item.profile_info.current?.display_name !== item.profile_info.pending?.display_name) && (
                            <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30">
                              <div>
                                <div className="text-xs text-muted-foreground">Display Name</div>
                                <div className="text-sm font-medium truncate">{item.profile_info.current?.display_name || '(empty)'}</div>
                              </div>
                              <div className="bg-green-500/10 rounded px-2 py-1">
                                <div className="text-xs text-green-600 dark:text-green-400">Display Name</div>
                                <div className="text-sm font-medium truncate">{item.profile_info.pending?.display_name || '(empty)'}</div>
                              </div>
                            </div>
                          )}

                          {/* Description */}
                          {(item.profile_info.current?.description !== item.profile_info.pending?.description) && (
                            <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30">
                              <div>
                                <div className="text-xs text-muted-foreground">Description</div>
                                <div className="text-sm line-clamp-2">{item.profile_info.current?.description || '(empty)'}</div>
                              </div>
                              <div className="bg-green-500/10 rounded px-2 py-1">
                                <div className="text-xs text-green-600 dark:text-green-400">Description</div>
                                <div className="text-sm line-clamp-2">{item.profile_info.pending?.description || '(empty)'}</div>
                              </div>
                            </div>
                          )}

                          {/* Avatar */}
                          {(item.profile_info.current?.avatar_url !== item.profile_info.pending?.avatar_url) && (
                            <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30">
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Avatar</div>
                                {item.profile_info.current?.avatar_url ? (
                                  <img src={item.profile_info.current.avatar_url} alt="Current" className="h-12 w-12 rounded object-cover" />
                                ) : (
                                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">(none)</div>
                                )}
                              </div>
                              <div className="bg-green-500/10 rounded px-2 py-1">
                                <div className="text-xs text-green-600 dark:text-green-400 mb-1">Avatar</div>
                                {item.profile_info.pending?.avatar_url ? (
                                  <img src={item.profile_info.pending.avatar_url} alt="Pending" className="h-12 w-12 rounded object-cover" />
                                ) : (
                                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">(none)</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Website */}
                          {(item.profile_info.current?.website !== item.profile_info.pending?.website) && (
                            <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30">
                              <div>
                                <div className="text-xs text-muted-foreground">Website</div>
                                <div className="text-sm font-mono truncate">{item.profile_info.current?.website || '(empty)'}</div>
                              </div>
                              <div className="bg-green-500/10 rounded px-2 py-1">
                                <div className="text-xs text-green-600 dark:text-green-400">Website</div>
                                <div className="text-sm font-mono truncate">{item.profile_info.pending?.website || '(empty)'}</div>
                              </div>
                            </div>
                          )}

                          {/* Social Links Summary */}
                          {(['twitter', 'github', 'discord', 'telegram'] as const).map(social => {
                            const currentVal = item.profile_info?.current?.[social];
                            const pendingVal = item.profile_info?.pending?.[social];
                            if (currentVal === pendingVal) return null;
                            return (
                              <div key={social} className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30">
                                <div>
                                  <div className="text-xs text-muted-foreground capitalize">{social}</div>
                                  <div className="text-sm truncate">{currentVal || '(empty)'}</div>
                                </div>
                                <div className="bg-green-500/10 rounded px-2 py-1">
                                  <div className="text-xs text-green-600 dark:text-green-400 capitalize">{social}</div>
                                  <div className="text-sm truncate">{pendingVal || '(empty)'}</div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Visibility */}
                          {(item.profile_info.current?.is_public !== item.profile_info.pending?.is_public) && (
                            <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30">
                              <div>
                                <div className="text-xs text-muted-foreground">Visibility</div>
                                <div className="text-sm">{item.profile_info.current?.is_public ? 'Public' : 'Private'}</div>
                              </div>
                              <div className="bg-green-500/10 rounded px-2 py-1">
                                <div className="text-xs text-green-600 dark:text-green-400">Visibility</div>
                                <div className="text-sm">{item.profile_info.pending?.is_public ? 'Public' : 'Private'}</div>
                              </div>
                            </div>
                          )}

                          {/* Tipping Configuration */}
                          {item.profile_info.pending?.tip_config && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="flex items-center gap-2 mb-3">
                                <Coins className="h-4 w-4" style={{ color: theme.primaryColor }} />
                                <span className="text-sm font-medium">Tipping Configuration</span>
                              </div>

                              {/* Tipping Enabled */}
                              {(item.profile_info.current?.tip_config?.is_active !== item.profile_info.pending?.tip_config?.is_active) && (
                                <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30 mb-2">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Tipping</div>
                                    <div className="text-sm">{item.profile_info.current?.tip_config?.is_active ? 'Enabled' : 'Disabled'}</div>
                                  </div>
                                  <div className="bg-green-500/10 rounded px-2 py-1">
                                    <div className="text-xs text-green-600 dark:text-green-400">Tipping</div>
                                    <div className="text-sm">{item.profile_info.pending?.tip_config?.is_active ? 'Enabled' : 'Disabled'}</div>
                                  </div>
                                </div>
                              )}

                              {/* Wallet Address */}
                              {(item.profile_info.current?.tip_config?.wallet_address !== item.profile_info.pending?.tip_config?.wallet_address) && (
                                <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30 mb-2">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Wallet Address</div>
                                    <div className="text-sm font-mono truncate">{item.profile_info.current?.tip_config?.wallet_address || '(none)'}</div>
                                  </div>
                                  <div className="bg-green-500/10 rounded px-2 py-1">
                                    <div className="text-xs text-green-600 dark:text-green-400">Wallet Address</div>
                                    <div className="text-sm font-mono truncate">{item.profile_info.pending?.tip_config?.wallet_address || '(none)'}</div>
                                  </div>
                                </div>
                              )}

                              {/* Accepted Coins */}
                              {JSON.stringify(item.profile_info.current?.tip_config?.accepted_coins || []) !== JSON.stringify(item.profile_info.pending?.tip_config?.accepted_coins || []) && (
                                <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30 mb-2">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Accepted Coins</div>
                                    <div className="text-sm">{(item.profile_info.current?.tip_config?.accepted_coins || []).join(', ') || '(none)'}</div>
                                  </div>
                                  <div className="bg-green-500/10 rounded px-2 py-1">
                                    <div className="text-xs text-green-600 dark:text-green-400">Accepted Coins</div>
                                    <div className="text-sm">{(item.profile_info.pending?.tip_config?.accepted_coins || []).join(', ') || '(none)'}</div>
                                  </div>
                                </div>
                              )}

                              {/* Minimum Tip */}
                              {(item.profile_info.current?.tip_config?.minimum_tip !== item.profile_info.pending?.tip_config?.minimum_tip) && (
                                <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30 mb-2">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Minimum Tip</div>
                                    <div className="text-sm">{item.profile_info.current?.tip_config?.minimum_tip ?? '(no minimum)'}</div>
                                  </div>
                                  <div className="bg-green-500/10 rounded px-2 py-1">
                                    <div className="text-xs text-green-600 dark:text-green-400">Minimum Tip</div>
                                    <div className="text-sm">{item.profile_info.pending?.tip_config?.minimum_tip ?? '(no minimum)'}</div>
                                  </div>
                                </div>
                              )}

                              {/* Thank You Message */}
                              {(item.profile_info.current?.tip_config?.thank_you_message !== item.profile_info.pending?.tip_config?.thank_you_message) && (
                                <div className="grid grid-cols-2 gap-3 p-2 rounded bg-muted/30 mb-2">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Thank You Message</div>
                                    <div className="text-sm line-clamp-2">{item.profile_info.current?.tip_config?.thank_you_message || '(none)'}</div>
                                  </div>
                                  <div className="bg-green-500/10 rounded px-2 py-1">
                                    <div className="text-xs text-green-600 dark:text-green-400">Thank You Message</div>
                                    <div className="text-sm line-clamp-2">{item.profile_info.pending?.tip_config?.thank_you_message || '(none)'}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* User email for avatar items only (verification and profile show it inline) */}
                  {item.item_type === 'avatar' && item.user_email && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">User:</span>
                      <span className="font-medium">{item.user_email}</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                {(item.status === 'pending' || item.status === 'flagged') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(item.id, 'approve')}
                      disabled={reviewing === item.id}
                      className="p-3 bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-110 active:scale-95"
                      title="Approve"
                    >
                      {reviewing === item.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setReasonModal({ itemId: item.id, action: 'reject' })}
                      disabled={reviewing === item.id}
                      className="p-3 bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-110 active:scale-95"
                      title="Reject"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                    {/* Only show flag button for pending items (not already flagged) */}
                    {item.status === 'pending' && (
                      <button
                        onClick={() => setReasonModal({ itemId: item.id, action: 'flag' })}
                        disabled={reviewing === item.id}
                        className="p-3 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/25 rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-110 active:scale-95"
                        title="Flag for review"
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reason Modal */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {reasonModal.action === 'reject' ? 'Reject Item' : 'Flag for Review'}
              </h3>
              <button
                onClick={() => { setReasonModal(null); setReason(''); }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {reasonModal.action === 'reject'
                ? 'Provide a reason for rejecting this item:'
                : 'Provide a reason for flagging this item:'}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full h-24 px-3 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setReasonModal(null); setReason(''); }}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReasonSubmit}
                disabled={!reason.trim()}
                className={`px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
                  reasonModal.action === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {reasonModal.action === 'reject' ? 'Reject' : 'Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
