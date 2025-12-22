'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LogIn, LogOut, Server, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getThemeConfig } from '@/config';
import { useAuthEnabled } from '@/hooks/use-feature-flags';
import { getSecondaryColor } from '@/lib/theme-utils';

export function AuthButton() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const theme = getThemeConfig();
  const isAuthEnabled = useAuthEnabled();

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);

      // Check admin status if logged in
      if (user) {
        fetch('/api/admin/check')
          .then(res => setIsAdmin(res.ok))
          .catch(() => setIsAdmin(false));
      }
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetch('/api/admin/check')
          .then(res => setIsAdmin(res.ok))
          .catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!isAuthEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="h-9 w-9 rounded-md bg-muted/40 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
        style={{
          backgroundColor: isHovered ? getSecondaryColor() : theme.primaryColor,
          color: '#ffffff'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign In</span>
      </Link>
    );
  }

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="relative">
      {/* User Avatar Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/60 transition-all duration-200"
        aria-label="User menu"
      >
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {user.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[120px] truncate">
          {user.email?.split('@')[0]}
        </span>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 rounded-xl glass-strong border border-border shadow-xl z-[100] overflow-hidden animate-fade-in-scale">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">
                {user.email}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAdmin ? 'Administrator' : 'Signed in'}
              </p>
            </div>

            <div className="py-2">
              {/* Profile/Settings - for everyone */}
              <Link
                href="/settings"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Profile & Settings
              </Link>

              {/* My Nodes - for everyone */}
              <Link
                href="/manage/nodes"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <Server className="h-4 w-4" />
                My Nodes
              </Link>

              {/* Admin Dashboard - only for admins */}
              {isAdmin && (
                <Link
                  href="/manage"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm font-medium hover:bg-muted/60 transition-colors"
                  style={{ color: theme.primaryColor }}
                >
                  <Shield className="h-4 w-4" />
                  Admin Dashboard
                </Link>
              )}
            </div>

            <div className="border-t border-border py-2">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors w-full"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
