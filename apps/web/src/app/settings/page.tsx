'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Server,
  Sun,
  Moon,
  LogOut,
  Loader2,
  Copy,
  Check,
  BadgeCheck,
  Bell,
  ChevronRight,
  Key,
  Book
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface UserStats {
  verifiedNodesCount: number;
  pendingVerifications: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const themeConfig = getThemeConfig();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.push('/auth?redirectTo=/settings');
        return;
      }

      setUser(user);

      // Check admin status
      const adminCheck = await fetch('/api/admin/check');
      setIsAdmin(adminCheck.ok);

      // Get stats
      const { data: verifiedNodes } = await supabase
        .from('verified_nodes')
        .select('id')
        .eq('user_id', user.id);

      const { data: verifications } = await supabase
        .from('verifications')
        .select('id, status')
        .eq('user_id', user.id);

      const pending = verifications?.filter(v =>
        ['pending', 'pending_approval'].includes(v.status)
      ).length || 0;

      setStats({
        verifiedNodesCount: verifiedNodes?.length || 0,
        pendingVerifications: pending
      });
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          Profile
        </h2>

        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-3xl flex-shrink-0"
            style={{ backgroundColor: themeConfig.primaryColor }}
          >
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>

            {/* User ID */}
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">User ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm">{user.id}</p>
                  <button
                    onClick={copyUserId}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Copy ID"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Created */}
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Account Created</p>
                <p className="font-medium">{user.created_at ? formatDate(user.created_at) : 'Unknown'}</p>
              </div>
            </div>

            {/* Admin Badge */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full"
                  style={{ backgroundColor: `${themeConfig.primaryColor}20`, color: themeConfig.primaryColor }}
                >
                  <BadgeCheck className="h-4 w-4" />
                  Administrator
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          Your Nodes
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-3xl font-bold" style={{ color: themeConfig.primaryColor }}>
              {stats?.verifiedNodesCount || 0}
            </p>
            <p className="text-sm text-muted-foreground">Verified Nodes</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-3xl font-bold text-yellow-500">
              {stats?.pendingVerifications || 0}
            </p>
            <p className="text-sm text-muted-foreground">Pending Verifications</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/manage/nodes')}
          className="mt-4 w-full px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
        >
          Manage Your Nodes →
        </button>
      </div>

      {/* Alerts Section */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          Node Alerts
        </h2>

        <p className="text-sm text-muted-foreground mb-4">
          Get notified via email or Discord when your verified nodes go offline, come back online, or need updates.
        </p>

        <button
          onClick={() => router.push('/settings/alerts')}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <span className="font-medium">Configure Alerts</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* API Keys Section */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Key className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          API Keys
        </h2>

        <p className="text-sm text-muted-foreground mb-4">
          Create API keys for programmatic access to node data, statistics, and more.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push('/settings/api-keys')}
            className="flex-1 flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <span className="font-medium">Manage API Keys</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => router.push('/docs')}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <Book className="h-4 w-4" />
            <span className="font-medium">API Docs</span>
          </button>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {mounted && theme === 'dark' ? (
            <Moon className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          ) : (
            <Sun className="h-5 w-5" style={{ color: themeConfig.primaryColor }} />
          )}
          Appearance
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">Choose light or dark mode</p>
          </div>

          <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                mounted && theme === 'light'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                mounted && theme === 'dark'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>
        </div>
      </div>

      {/* Sign Out Section */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <LogOut className="h-5 w-5 text-red-500" />
          Session
        </h2>

        <p className="text-sm text-muted-foreground mb-4">
          Sign out of your account on this device.
        </p>

        <button
          onClick={handleSignOut}
          className="px-4 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
