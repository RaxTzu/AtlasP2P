'use client';

import { BarChart3, Server, Globe, Activity, TrendingUp, Zap } from 'lucide-react';
import { getThemeConfig } from '@/config';
import { NetworkTrendsChart } from '@/components/charts/NetworkTrendsChart';
import { VersionDistributionChart } from '@/components/charts/VersionDistributionChart';
import { CountryDistributionChart } from '@/components/charts/CountryDistributionChart';
import { TierDistributionChart } from '@/components/charts/TierDistributionChart';
import { useNodes } from '@/hooks/useNodes';
import { useMemo } from 'react';

export default function DashboardPage() {
  const theme = getThemeConfig();
  const { nodes } = useNodes();

  const stats = useMemo(() => {
    const total = nodes.length;
    const online = nodes.filter(n => n.status === 'up').length;
    const uptime = total > 0 ? (online / total) * 100 : 0;
    const avgLatency = nodes.length > 0
      ? nodes.reduce((acc, n) => acc + (n.latencyAvg || 0), 0) / nodes.length
      : 0;

    return { total, online, uptime, avgLatency };
  }, [nodes]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl shadow-lg" style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              boxShadow: `0 10px 25px -5px ${theme.primaryColor}40`
            }}>
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Comprehensive network analytics and insights
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-card rounded-xl p-6 shadow-lg border border-border hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <Server className="h-8 w-8" style={{ color: theme.primaryColor }} />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Total Nodes</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats.total}</div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-lg border border-border hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <Activity className="h-8 w-8 text-success" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Online</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats.online}</div>
            <div className="text-sm text-success mt-1">
              {stats.uptime.toFixed(1)}% uptime
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-lg border border-border hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <Globe className="h-8 w-8" style={{ color: theme.secondaryColor }} />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Countries</span>
            </div>
            <div className="text-3xl font-bold text-foreground">
              {new Set(nodes.map(n => n.countryName).filter(Boolean)).size}
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-lg border border-border hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <Zap className="h-8 w-8" style={{ color: theme.accentColor }} />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Avg Latency</span>
            </div>
            <div className="text-3xl font-bold text-foreground">
              {stats.avgLatency.toFixed(0)}<span className="text-lg text-muted-foreground">ms</span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <NetworkTrendsChart />
          <VersionDistributionChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CountryDistributionChart />
          <TierDistributionChart />
        </div>
      </div>
    </div>
  );
}
