'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Trash2,
  RefreshCw,
  Loader2,
  Plus
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

interface Verification {
  id: string;
  node_id: string;
  user_id: string;
  method: string;
  status: 'pending' | 'verified' | 'failed' | 'expired' | 'pending_approval';
  challenge: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  node?: {
    ip: string;
    port: number;
    country_name: string;
  };
}

export default function VerificationsPage() {
  const theme = getThemeConfig();
  const router = useRouter();
  const { toast, toasts, removeToast } = useToast();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth?redirectTo=/manage/verifications');
        return;
      }

      const { data, error } = await supabase
        .from('verifications')
        .select(`
          *,
          node:nodes(ip, port, country_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVerifications(data || []);
    } catch (err) {
      console.error('Failed to fetch verifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    // If not confirmed yet, show confirmation
    if (cancelConfirm !== id) {
      setCancelConfirm(id);
      // Auto-clear confirmation after 3 seconds
      setTimeout(() => setCancelConfirm(null), 3000);
      return;
    }

    setCancelConfirm(null);
    setActionLoading(id);
    try {
      const response = await fetch(`/api/verify?verificationId=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      toast.success('Cancelled', 'Verification has been cancelled');
      await fetchVerifications();
    } catch (err) {
      console.error('Cancel failed:', err);
      toast.error('Failed to cancel', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
      case 'expired':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending_approval':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified': return 'Verified';
      case 'failed': return 'Failed';
      case 'expired': return 'Expired';
      case 'pending_approval': return 'Awaiting Admin Approval';
      default: return 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-500/15 text-green-600 dark:text-green-400';
      case 'failed':
      case 'expired': return 'bg-red-500/15 text-red-600 dark:text-red-400';
      case 'pending_approval': return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
      default: return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
    }
  };

  const filteredVerifications = verifications.filter(v => {
    if (filter === 'pending') return ['pending', 'pending_approval'].includes(v.status);
    if (filter === 'completed') return ['verified', 'failed', 'expired'].includes(v.status);
    return true;
  });

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Verifications</h1>
          <p className="text-muted-foreground">
            Track and manage your node verification requests
          </p>
        </div>
        <button
          onClick={() => router.push('/nodes')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <Plus className="h-4 w-4" />
          New Verification
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'completed'] as const).map((f) => (
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
            <span className="ml-2 text-sm opacity-70">
              ({verifications.filter(v => {
                if (f === 'pending') return ['pending', 'pending_approval'].includes(v.status);
                if (f === 'completed') return ['verified', 'failed', 'expired'].includes(v.status);
                return true;
              }).length})
            </span>
          </button>
        ))}
      </div>

      {/* Verifications List */}
      {filteredVerifications.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 text-center">
          <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">
            {filter === 'all' ? 'No Verifications' : `No ${filter} verifications`}
          </h2>
          <p className="text-muted-foreground mb-6">
            {filter === 'all'
              ? "You haven't started any verifications yet."
              : `You don't have any ${filter} verifications.`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => router.push('/nodes')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all duration-200 hover:shadow-lg"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <ShieldCheck className="h-5 w-5" />
              Start Verification
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVerifications.map((v) => (
            <div
              key={v.id}
              className="glass-strong rounded-xl p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getStatusIcon(v.status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">
                        {v.node?.ip}:{v.node?.port}
                      </h3>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(v.status)}`}>
                        {getStatusLabel(v.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Method: <strong className="text-foreground">{v.method}</strong></span>
                      {v.node?.country_name && (
                        <span>Location: <strong className="text-foreground">{v.node.country_name}</strong></span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(v.created_at).toLocaleString()}
                      {v.status === 'pending' && v.expires_at && (
                        <> · Expires {new Date(v.expires_at).toLocaleString()}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {v.status === 'verified' && (
                    <button
                      onClick={() => router.push(`/node/${v.node_id}`)}
                      className="p-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                      title="View Node"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                  {['pending', 'pending_approval'].includes(v.status) && (
                    <>
                      <button
                        onClick={() => router.push(`/node/${v.node_id}`)}
                        className="p-2.5 rounded-lg text-white transition-colors"
                        style={{ backgroundColor: theme.primaryColor }}
                        title="Complete Verification"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleCancel(v.id)}
                        disabled={actionLoading === v.id}
                        className={`rounded-lg transition-all disabled:opacity-50 ${
                          cancelConfirm === v.id
                            ? 'px-3 py-2 bg-red-500 text-white text-xs font-medium'
                            : 'p-2.5 bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25'
                        }`}
                        title={cancelConfirm === v.id ? 'Click again to confirm' : 'Cancel'}
                      >
                        {actionLoading === v.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : cancelConfirm === v.id ? (
                          'Confirm?'
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Pending Approval Message */}
              {v.status === 'pending_approval' && (
                <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">
                        Awaiting Admin Approval
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your verification has been submitted and is waiting for admin review.
                        You'll be notified once it's approved.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
