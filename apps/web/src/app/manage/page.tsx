'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Server,
  ShieldCheck,
  Flag,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Plus,
  Settings,
  TrendingUp,
  Users
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

interface OverviewStats {
  myNodes: number;
  pendingVerifications: number;
  completedVerifications: number;
  pendingModeration?: number;
}

interface RecentActivity {
  id: string;
  type: 'verification' | 'node' | 'moderation';
  action: string;
  target: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
}

export default function ManageOverviewPage() {
  const theme = getThemeConfig();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats>({
    myNodes: 0,
    pendingVerifications: 0,
    completedVerifications: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Check admin status
      const adminCheck = await fetch('/api/admin/check');
      const adminStatus = adminCheck.ok;
      setIsAdmin(adminStatus);

      // Get user's verified nodes
      const { data: verifiedNodes } = await supabase
        .from('verified_nodes')
        .select('*')
        .eq('user_id', user.id);

      // Get user's verifications
      const { data: verifications } = await supabase
        .from('verifications')
        .select('*')
        .eq('user_id', user.id);

      const pendingVerifs = verifications?.filter(v =>
        ['pending', 'pending_approval'].includes(v.status)
      ).length || 0;
      const completedVerifs = verifications?.filter(v => v.status === 'verified').length || 0;

      // Get pending moderation count if admin
      let pendingMod = 0;
      if (adminStatus) {
        const modResponse = await fetch('/api/admin/moderation?status=pending');
        if (modResponse.ok) {
          const modData = await modResponse.json();
          pendingMod = modData.items?.length || 0;
        }
      }

      setStats({
        myNodes: verifiedNodes?.length || 0,
        pendingVerifications: pendingVerifs,
        completedVerifications: completedVerifs,
        pendingModeration: adminStatus ? pendingMod : undefined
      });

      // Build recent activity
      const activities: RecentActivity[] = [];

      verifications?.slice(0, 5).forEach(v => {
        activities.push({
          id: v.id,
          type: 'verification',
          action: v.status === 'verified' ? 'Verified' : v.status === 'pending_approval' ? 'Awaiting approval' : 'Initiated',
          target: `Node ${v.node_id.slice(0, 8)}...`,
          timestamp: v.updated_at || v.created_at,
          status: v.status === 'verified' ? 'success' : v.status === 'failed' ? 'failed' : 'pending'
        });
      });

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.primaryColor }} />
      </div>
    );
  }

  return (
    <div className="w-full animate-slide-in-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your nodes{stats.myNodes > 0 && `, track ${stats.myNodes} verified node${stats.myNodes > 1 ? 's' : ''}`}{isAdmin && ', and moderate platform content'}
        </p>
      </div>

      {/* Stats Grid - Auto-adjusts: 3 cols for users, 4 cols for admins */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 ${
        isAdmin && stats.pendingModeration !== undefined
          ? 'lg:grid-cols-4'
          : 'lg:grid-cols-3'
      }`}>
        {/* My Nodes */}
        <button
          onClick={() => router.push('/manage/nodes')}
          className="glass-strong rounded-2xl p-6 text-left hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div
                className="p-3 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Server className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <ArrowRight
                className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform translate-x-0 group-hover:translate-x-1"
              />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">My Nodes</p>
            <p className="text-4xl font-bold mb-1" style={{ color: theme.primaryColor }}>
              {stats.myNodes}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.myNodes === 0 ? 'No nodes yet' : `Active node${stats.myNodes > 1 ? 's' : ''}`}
            </p>
          </div>
        </button>

        {/* Pending Verifications */}
        <button
          onClick={() => router.push('/manage/verifications')}
          className="glass-strong rounded-2xl p-6 text-left hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div
                className="p-3 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ backgroundColor: `${theme.secondaryColor}20` }}
              >
                <Clock className="h-6 w-6" style={{ color: theme.secondaryColor }} />
              </div>
              {stats.pendingVerifications > 0 && (
                <span className="flex h-3 w-3">
                  <span
                    className="animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-75"
                    style={{ backgroundColor: theme.secondaryColor }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-3 w-3"
                    style={{ backgroundColor: theme.secondaryColor }}
                  />
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Pending</p>
            <p className="text-4xl font-bold mb-1" style={{ color: theme.secondaryColor }}>
              {stats.pendingVerifications}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.pendingVerifications === 0 ? 'All verified' : 'Awaiting verification'}
            </p>
          </div>
        </button>

        {/* Completed Verifications */}
        <div className="glass-strong rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-green-500/5" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-green-500/20">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              {stats.completedVerifications > 0 && (
                <TrendingUp className="h-5 w-5 text-green-500" />
              )}
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Verified</p>
            <p className="text-4xl font-bold text-green-500 mb-1">
              {stats.completedVerifications}
            </p>
            <p className="text-xs text-muted-foreground">
              Successfully verified
            </p>
          </div>
        </div>

        {/* Admin: Pending Moderation */}
        {isAdmin && stats.pendingModeration !== undefined && (
          <button
            onClick={() => router.push('/manage/moderation')}
            className="glass-strong rounded-2xl p-6 text-left hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden border-2 border-yellow-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-yellow-500/20 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Flag className="h-6 w-6 text-yellow-500" />
                </div>
                {stats.pendingModeration > 0 && (
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-yellow-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Moderation</p>
              <p className="text-4xl font-bold text-yellow-500 mb-1">
                {stats.pendingModeration}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.pendingModeration === 0 ? 'All clear' : 'Needs review'}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Verify Node Card */}
        <div className="glass-strong rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: `${theme.primaryColor}15` }}
            >
              <ShieldCheck className="h-7 w-7" style={{ color: theme.primaryColor }} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">Verify a Node</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Prove ownership to unlock custom profiles, accept tips, and display a verified badge on the network map.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/nodes')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <Plus className="h-5 w-5" />
            Start Verification
          </button>
        </div>

        {/* Recent Activity Card */}
        <div className="glass-strong rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
            <Clock className="h-6 w-6 text-muted-foreground" />
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">No recent activity</p>
              <p className="text-muted-foreground text-xs mt-1">Your verifications will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      activity.status === 'success'
                        ? 'bg-green-500/15'
                        : activity.status === 'failed'
                        ? 'bg-red-500/15'
                        : 'bg-yellow-500/15'
                    }`}
                  >
                    {activity.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : activity.status === 'failed' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {activity.action} · {activity.target}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <div className="glass-strong rounded-2xl p-8 border-2 border-primary/10">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Settings className="h-6 w-6" style={{ color: theme.primaryColor }} />
            </div>
            Admin Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/manage/moderation')}
              className="group p-6 rounded-xl border-2 border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all duration-200 text-left hover:scale-[1.02]"
            >
              <Flag className="h-6 w-6 text-yellow-500 mb-4 transition-transform group-hover:scale-110" />
              <p className="font-semibold mb-1">Moderation</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review and moderate content
              </p>
            </button>
            <button
              onClick={() => router.push('/manage/users')}
              className="group p-6 rounded-xl border-2 border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200 text-left hover:scale-[1.02]"
            >
              <Users className="h-6 w-6 text-blue-500 mb-4 transition-transform group-hover:scale-110" />
              <p className="font-semibold mb-1">Users</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manage user accounts
              </p>
            </button>
            <button
              onClick={() => router.push('/manage/audit')}
              className="group p-6 rounded-xl border-2 border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all duration-200 text-left hover:scale-[1.02]"
            >
              <Clock className="h-6 w-6 text-purple-500 mb-4 transition-transform group-hover:scale-110" />
              <p className="font-semibold mb-1">Audit Log</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                View system activity
              </p>
            </button>
            <button
              onClick={() => router.push('/manage/settings')}
              className="group p-6 rounded-xl border-2 border-border hover:border-green-500/50 hover:bg-green-500/5 transition-all duration-200 text-left hover:scale-[1.02]"
            >
              <Settings className="h-6 w-6 text-green-500 mb-4 transition-transform group-hover:scale-110" />
              <p className="font-semibold mb-1">Settings</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure system options
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
