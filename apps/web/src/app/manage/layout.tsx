'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  ShieldCheck,
  Flag,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Settings,
  BadgeCheck
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  adminOnly?: boolean;
  badge?: number;
}

interface UserInfo {
  id: string;
  email: string;
  isAdmin: boolean;
}

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const theme = getThemeConfig();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push('/auth?redirectTo=/manage');
        return;
      }

      // Check if admin
      const response = await fetch('/api/admin/check');
      const isAdmin = response.ok;

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        isAdmin
      });

      // Get pending moderation count if admin
      if (isAdmin) {
        const modResponse = await fetch('/api/admin/moderation?status=pending');
        if (modResponse.ok) {
          const data = await modResponse.json();
          setPendingCount(data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: '/manage'
    },
    {
      id: 'nodes',
      label: 'My Nodes',
      icon: <Server className="h-5 w-5" />,
      href: '/manage/nodes'
    },
    {
      id: 'verifications',
      label: 'Verifications',
      icon: <ShieldCheck className="h-5 w-5" />,
      href: '/manage/verifications'
    },
    {
      id: 'moderation',
      label: 'Moderation',
      icon: <Flag className="h-5 w-5" />,
      href: '/manage/moderation',
      adminOnly: true,
      badge: pendingCount
    },
    {
      id: 'users',
      label: 'Users',
      icon: <Users className="h-5 w-5" />,
      href: '/manage/users',
      adminOnly: true
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: <Activity className="h-5 w-5" />,
      href: '/manage/audit',
      adminOnly: true
    }
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || user?.isAdmin);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.primaryColor }} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-card border-r border-border transition-all duration-300 z-40 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-6 p-1.5 bg-card border border-border rounded-full shadow-md hover:bg-muted transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {/* User Section */}
            {!collapsed && (
              <div className="px-3 py-4 mb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                    {user.isAdmin && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                      >
                        <BadgeCheck className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Admin Badge (collapsed) */}
            {collapsed && user.isAdmin && (
              <div className="flex justify-center py-2 mb-2 border-b border-border">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${theme.primaryColor}20` }}
                  title="Admin"
                >
                  <BadgeCheck className="h-5 w-5" style={{ color: theme.primaryColor }} />
                </div>
              </div>
            )}

            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/manage' && pathname.startsWith(item.href));

              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                    isActive
                      ? 'text-white shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  style={isActive ? { backgroundColor: theme.primaryColor } : {}}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="font-medium">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-white/20 text-white' : ''
                          }`}
                          style={!isActive ? { backgroundColor: theme.primaryColor, color: 'white' } : {}}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white rounded-full"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-3 border-t border-border space-y-1">
            <button
              onClick={() => router.push('/settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'Settings' : undefined}
            >
              <Settings className="h-5 w-5" />
              {!collapsed && <span className="font-medium">Settings</span>}
            </button>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'Logout' : undefined}
            >
              <LogOut className="h-5 w-5" />
              {!collapsed && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="p-6 flex justify-center">
          <div className="w-full max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
