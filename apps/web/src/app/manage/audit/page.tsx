'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Search,
  Filter,
  Loader2,
  Shield,
  User,
  Flag,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { getThemeConfig } from '@/config';

export const dynamic = 'force-dynamic';

interface AuditDetails {
  action?: string;
  item_type?: string;
  notes?: string | null;
  verification?: {
    method: string;
    node_id: string;
    node_address: string | null;
    node_location: string | null;
    submitted_by: string;
  };
  profile?: {
    node_id: string;
    node_address: string | null;
    node_location: string | null;
    submitted_by: string;
    changes?: {
      display_name?: string;
      description?: string | null;
      has_avatar?: boolean;
      website?: string;
      twitter?: string;
      github?: string;
      discord?: string;
      telegram?: string;
      is_public?: boolean;
      tip_enabled?: boolean;
      tip_wallet?: string | null;
    };
  };
  avatar?: {
    url: string;
    node_id: string;
  };
  submitted_by?: string;
  count?: number;
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_email?: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: AuditDetails | string | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogPage() {
  const router = useRouter();
  const theme = getThemeConfig();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchAuditLog();
  }, [filter]);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/audit?filter=${filter}`);

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/manage');
          return;
        }
        throw new Error('Failed to fetch audit log');
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('approve')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('reject') || action.includes('ban')) return <XCircle className="h-4 w-4 text-red-500" />;
    if (action.includes('flag')) return <Flag className="h-4 w-4 text-yellow-500" />;
    return <Activity className="h-4 w-4 text-blue-500" />;
  };

  const getResourceIcon = (type: string) => {
    if (type === 'user') return <User className="h-4 w-4" />;
    if (type === 'verification') return <Shield className="h-4 w-4" />;
    if (type === 'moderation') return <Flag className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatAction = (action: string) => {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const parseDetails = (details: AuditDetails | string | null): AuditDetails | null => {
    if (!details) return null;
    if (typeof details === 'string') {
      try {
        return JSON.parse(details);
      } catch {
        return null;
      }
    }
    return details;
  };

  const renderDetails = (log: AuditLogEntry) => {
    const details = parseDetails(log.details);
    if (!details) return null;

    // For moderation actions, show rich details
    if (log.action.startsWith('moderation_')) {
      const actionType = log.action.replace('moderation_', '');
      const actionColor = actionType === 'approve' ? 'text-green-600 dark:text-green-400' :
                         actionType === 'reject' ? 'text-red-600 dark:text-red-400' :
                         'text-yellow-600 dark:text-yellow-400';

      return (
        <div className="mt-3 space-y-2">
          {/* Verification details */}
          {details.verification && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Verification ({details.verification.method})</span>
              </div>
              {details.verification.node_address && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Node: </span>
                  <span className="font-mono">{details.verification.node_address}</span>
                  {details.verification.node_location && (
                    <span className="text-muted-foreground ml-2">({details.verification.node_location})</span>
                  )}
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Submitted by: </span>
                <span className="font-medium">{details.verification.submitted_by}</span>
              </div>
            </div>
          )}

          {/* Profile change details */}
          {details.profile && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Profile Changes</span>
              </div>
              {details.profile.node_address && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Node: </span>
                  <span className="font-mono">{details.profile.node_address}</span>
                  {details.profile.node_location && (
                    <span className="text-muted-foreground ml-2">({details.profile.node_location})</span>
                  )}
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Submitted by: </span>
                <span className="font-medium">{details.profile.submitted_by}</span>
              </div>
              {details.profile.changes && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-medium">Changed Fields:</div>
                  <div className="flex flex-wrap gap-1">
                    {details.profile.changes.display_name && (
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        Name: {details.profile.changes.display_name}
                      </span>
                    )}
                    {details.profile.changes.description && (
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        Description
                      </span>
                    )}
                    {details.profile.changes.has_avatar && (
                      <span className="px-2 py-0.5 text-xs rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                        Avatar
                      </span>
                    )}
                    {details.profile.changes.website && (
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-500/15 text-gray-600 dark:text-gray-400">
                        Website
                      </span>
                    )}
                    {details.profile.changes.twitter && (
                      <span className="px-2 py-0.5 text-xs rounded bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        Twitter
                      </span>
                    )}
                    {details.profile.changes.github && (
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-500/15 text-gray-600 dark:text-gray-400">
                        GitHub
                      </span>
                    )}
                    {details.profile.changes.discord && (
                      <span className="px-2 py-0.5 text-xs rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                        Discord
                      </span>
                    )}
                    {details.profile.changes.telegram && (
                      <span className="px-2 py-0.5 text-xs rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                        Telegram
                      </span>
                    )}
                    {typeof details.profile.changes.is_public !== 'undefined' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-orange-500/15 text-orange-600 dark:text-orange-400">
                        Visibility: {details.profile.changes.is_public ? 'Public' : 'Private'}
                      </span>
                    )}
                    {typeof details.profile.changes.tip_enabled !== 'undefined' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-500/15 text-green-600 dark:text-green-400">
                        Tips: {details.profile.changes.tip_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
                    {details.profile.changes.tip_wallet && (
                      <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                        Wallet: {details.profile.changes.tip_wallet}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avatar details */}
          {details.avatar && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Avatar Upload</span>
              </div>
              {details.submitted_by && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Submitted by: </span>
                  <span className="font-medium">{details.submitted_by}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {details.notes && (
            <div className="p-2 rounded bg-muted/30 text-sm">
              <span className="text-muted-foreground">Notes: </span>
              {details.notes}
            </div>
          )}
        </div>
      );
    }

    // For ban/unban actions
    if (log.action === 'ban_user' || log.action === 'unban_user') {
      const isBan = log.action === 'ban_user';
      return (
        <div className="mt-3">
          <div className={`p-3 rounded-lg ${isBan ? 'bg-red-500/10' : 'bg-green-500/10'} space-y-2`}>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className={isBan ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {isBan ? 'User Banned' : 'User Unbanned'}
              </span>
            </div>
            {(details as any).target_email && (
              <div className="text-sm">
                <span className="text-muted-foreground">Target: </span>
                <span className="font-medium">{(details as any).target_email}</span>
              </div>
            )}
            {(details as any).reason && (
              <div className="text-sm">
                <span className="text-muted-foreground">Reason: </span>
                <span>{(details as any).reason}</span>
              </div>
            )}
            {(details as any).duration && (
              <div className="text-sm">
                <span className="text-muted-foreground">Duration: </span>
                <span>{(details as any).duration} hours</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // For other actions, show simple count or raw details
    if (details.count !== undefined) {
      return (
        <div className="mt-2 text-sm text-muted-foreground">
          Viewed {details.count} users
        </div>
      );
    }

    // Fallback: show raw JSON for old/unknown formats
    const detailsStr = JSON.stringify(details, null, 2);
    if (detailsStr === '{}' || detailsStr === '"{}"') {
      return null; // Don't show empty details
    }

    return (
      <div className="mt-2 p-2 rounded-lg bg-muted/50 text-xs font-mono overflow-auto max-h-32">
        {detailsStr}
      </div>
    );
  };

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
        <h1 className="text-3xl font-bold mb-2">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all admin actions and system events
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'moderation', 'user', 'verification'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'text-white'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
            style={filter === f ? { backgroundColor: theme.primaryColor } : {}}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {logs.length === 0 && (
        <div className="glass-strong rounded-xl p-12 text-center">
          <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No Audit Logs</h2>
          <p className="text-muted-foreground">
            No admin actions have been recorded yet
          </p>
        </div>
      )}

      {/* Audit Log List */}
      {logs.length > 0 && (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="glass-strong rounded-xl p-4 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                {/* Action Icon */}
                <div className="mt-1">
                  {getActionIcon(log.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{formatAction(log.action)}</span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                    >
                      {getResourceIcon(log.resource_type)}
                      {log.resource_type}
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <span>By </span>
                    <span className="font-medium text-foreground">
                      {log.admin_email || log.admin_id}
                    </span>
                    {log.resource_id && (
                      <>
                        <span> on resource </span>
                        <span className="font-mono text-xs">
                          {log.resource_id}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Render rich details */}
                  {renderDetails(log)}
                </div>

                {/* Timestamp */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(log.created_at).toLocaleDateString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </p>
                  {log.ip_address && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {log.ip_address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
