'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Ban,
  Shield,
  ShieldCheck,
  Loader2,
  Mail,
  Calendar,
  UserCircle,
  X
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_banned: boolean;
  verified_nodes_count: number;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const theme = getThemeConfig();
  const { toast, toasts, removeToast } = useToast();

  // Semantic colors with fallbacks
  const colors = {
    success: theme.semanticColors?.success || '#22c55e',
    error: theme.semanticColors?.error || '#ef4444',
    warning: theme.semanticColors?.warning || '#f97316',
    admin: theme.semanticColors?.admin || '#a855f7',
    danger: theme.semanticColors?.danger || '#dc2626',
  };
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ userId: string; email: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [promoteModal, setPromoteModal] = useState<{ userId: string; email: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    // Get current user
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/admin/users?t=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/manage');
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      console.log('[Users Page] Fetched users:', data.users?.map((u: UserData) => ({ email: u.email, is_admin: u.is_admin })));
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId: string, ban: boolean, reason?: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: ban ? 'ban' : 'unban',
          reason: reason
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }

      toast.success(ban ? 'User Banned' : 'User Unbanned', ban ? 'The user has been banned' : 'The user has been unbanned');
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error('Failed', err instanceof Error ? err.message : 'Could not update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanSubmit = () => {
    if (!banModal || !banReason.trim()) return;
    handleBan(banModal.userId, true, banReason);
    setBanModal(null);
    setBanReason('');
  };

  const handleUnban = (userId: string) => {
    handleBan(userId, false);
  };

  const handlePromote = async (userId: string, promote: boolean) => {
    setActionLoading(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: promote ? 'promote' : 'demote'
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update admin status');
      }

      toast.success(
        promote ? 'User Promoted' : 'Admin Demoted',
        promote ? 'User promoted to admin successfully' : 'Admin privileges revoked'
      );
      await fetchUsers();
      setPromoteModal(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed', err instanceof Error ? err.message : 'Could not update admin status');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">
          View and manage user accounts
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme.primaryColor}15` }}>
              <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${colors.admin}15` }}>
              <ShieldCheck className="h-5 w-5" style={{ color: colors.admin }} />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.filter(u => u.is_admin).length}</p>
              <p className="text-sm text-muted-foreground">Admins</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${colors.error}15` }}>
              <Ban className="h-5 w-5" style={{ color: colors.error }} />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.filter(u => u.is_banned).length}</p>
              <p className="text-sm text-muted-foreground">Banned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No Users Found</h2>
          <p className="text-muted-foreground">
            {search ? 'No users match your search' : 'No users registered yet'}
          </p>
        </div>
      ) : (
        <div className="glass-strong rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nodes</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: user.is_banned ? colors.error : theme.primaryColor }}
                      >
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.email}</p>
                          {user.id === currentUserId && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">You</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {user.is_admin && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full"
                          style={{
                            backgroundColor: `${colors.admin}15`,
                            color: colors.admin
                          }}
                        >
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                      {user.is_banned && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full"
                          style={{
                            backgroundColor: `${colors.error}15`,
                            color: colors.error
                          }}
                        >
                          <Ban className="h-3 w-3" />
                          Banned
                        </span>
                      )}
                      {!user.is_admin && !user.is_banned && (
                        <span className="text-sm text-muted-foreground">Active</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-medium">{user.verified_nodes_count}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Never'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Promote/Demote button - hide for yourself and super admins */}
                      {user.id !== currentUserId && !user.is_banned && (
                        <button
                          onClick={() => setPromoteModal({ userId: user.id, email: user.email, isAdmin: user.is_admin })}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                          style={{
                            backgroundColor: user.is_admin ? `${colors.warning}15` : `${colors.admin}15`,
                            color: user.is_admin ? colors.warning : colors.admin
                          }}
                          onMouseEnter={(e) => {
                            if (actionLoading !== user.id) {
                              e.currentTarget.style.backgroundColor = user.is_admin ? `${colors.warning}25` : `${colors.admin}25`;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = user.is_admin ? `${colors.warning}15` : `${colors.admin}15`;
                          }}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              {user.is_admin ? 'Demote' : 'Promote'}
                            </>
                          )}
                        </button>
                      )}

                      {/* Ban button - hide for admins and yourself */}
                      {!user.is_admin && user.id !== currentUserId && (
                        <button
                          onClick={() => user.is_banned
                            ? handleUnban(user.id)
                            : setBanModal({ userId: user.id, email: user.email })
                          }
                          disabled={actionLoading === user.id}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                          style={{
                            backgroundColor: user.is_banned ? `${colors.success}15` : `${colors.error}15`,
                            color: user.is_banned ? colors.success : colors.error
                          }}
                          onMouseEnter={(e) => {
                            if (actionLoading !== user.id) {
                              e.currentTarget.style.backgroundColor = user.is_banned ? `${colors.success}25` : `${colors.error}25`;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = user.is_banned ? `${colors.success}15` : `${colors.error}15`;
                          }}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.is_banned ? (
                            'Unban'
                          ) : (
                            'Ban'
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Ban User</h3>
              <button
                onClick={() => { setBanModal(null); setBanReason(''); }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              You are about to ban:
            </p>
            <p className="font-medium mb-4">{banModal.email}</p>
            <label className="text-sm text-muted-foreground">Reason for ban:</label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full h-24 mt-2 px-3 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setBanModal(null); setBanReason(''); }}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBanSubmit}
                disabled={!banReason.trim()}
                className="px-4 py-2 rounded-lg text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: colors.error }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote/Demote Modal */}
      {promoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {promoteModal.isAdmin ? 'Demote Admin' : 'Promote to Admin'}
              </h3>
              <button
                onClick={() => setPromoteModal(null)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-2">
                {promoteModal.isAdmin
                  ? 'You are about to remove admin privileges from:'
                  : 'You are about to grant admin privileges to:'}
              </p>
              <p className="font-medium mb-4">{promoteModal.email}</p>
              {promoteModal.isAdmin ? (
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: `${colors.warning}10`,
                    borderWidth: '1px',
                    borderColor: `${colors.warning}20`
                  }}
                >
                  <p className="text-sm" style={{ color: colors.warning }}>
                    This user will lose access to the admin panel and all administrative functions.
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: `${colors.admin}10`,
                    borderWidth: '1px',
                    borderColor: `${colors.admin}20`
                  }}
                >
                  <p className="text-sm" style={{ color: colors.admin }}>
                    This user will gain access to the admin panel and user management features.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPromoteModal(null)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePromote(promoteModal.userId, !promoteModal.isAdmin)}
                className="px-4 py-2 rounded-lg text-white transition-all"
                style={{
                  backgroundColor: promoteModal.isAdmin ? colors.warning : colors.admin
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                {promoteModal.isAdmin ? 'Demote User' : 'Promote User'}
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
