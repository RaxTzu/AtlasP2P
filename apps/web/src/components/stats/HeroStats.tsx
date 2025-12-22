'use client';

import { Server, CheckCircle, Globe, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { getThemeConfig } from '@/config';
import { useNodes } from '@/hooks/useNodes';
import { useMemo } from 'react';

export function HeroStats() {
  const theme = getThemeConfig();
  const { nodes, isLoading } = useNodes();

  const stats = useMemo(() => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.status === 'up').length;
    const countries = new Set(nodes.map(n => n.countryName).filter(Boolean)).size;
    const avgUptime = nodes.length > 0
      ? nodes.reduce((acc, n) => acc + (n.uptime || 0), 0) / nodes.length
      : 0;

    // Mock growth data (in production this would come from historical data)
    const growth = {
      nodes: 12,
      countries: 2,
      trend: 'up' as const
    };

    return {
      totalNodes,
      onlineNodes,
      countries,
      avgUptime: avgUptime.toFixed(1),
      growth,
      lastUpdate: new Date()
    };
  }, [nodes]);

  if (isLoading) {
    return (
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-8">
            <div className="h-16 w-32 bg-muted rounded animate-pulse" />
            <div className="h-16 w-32 bg-muted rounded animate-pulse" />
            <div className="h-16 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card/95 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-6 lg:py-8">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-center gap-8 lg:gap-16">
          {/* Total Nodes - Prominent */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Server className="h-8 w-8 lg:h-10 lg:w-10" style={{ color: theme.primaryColor }} />
              <div className="text-6xl lg:text-7xl font-bold" style={{ color: theme.primaryColor }}>
                {stats.totalNodes}
              </div>
            </div>
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Network Nodes
            </div>
            {stats.growth.trend === 'up' ? (
              <div className="flex items-center justify-center gap-1 mt-1 text-success">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold">+{stats.growth.nodes} today</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 mt-1 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs font-semibold">-{stats.growth.nodes} today</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-24 w-px bg-border" />

          {/* Secondary Stats */}
          <div className="grid grid-cols-3 gap-8 lg:gap-12">
            {/* Online Nodes */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="h-5 w-5 text-success" />
                <div className="text-3xl lg:text-4xl font-bold text-foreground">
                  {stats.onlineNodes}
                </div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                Online
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {((stats.onlineNodes / stats.totalNodes) * 100).toFixed(1)}%
              </div>
            </div>

            {/* Countries */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Globe className="h-5 w-5" style={{ color: theme.secondaryColor }} />
                <div className="text-3xl lg:text-4xl font-bold text-foreground">
                  {stats.countries}
                </div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                Countries
              </div>
              <div className="text-xs text-success mt-0.5">
                +{stats.growth.countries} new
              </div>
            </div>

            {/* Avg Uptime */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="h-5 w-5" style={{ color: theme.accentColor }} />
                <div className="text-3xl lg:text-4xl font-bold text-foreground">
                  {stats.avgUptime}%
                </div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                Avg Uptime
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                24h average
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Main Stat */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Server className="h-6 w-6" style={{ color: theme.primaryColor }} />
              <div className="text-5xl font-bold" style={{ color: theme.primaryColor }}>
                {stats.totalNodes}
              </div>
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">
              Network Nodes
            </div>
            <div className="flex items-center justify-center gap-1 mt-1 text-success">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-semibold">+{stats.growth.nodes} today</span>
            </div>
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-xl font-bold text-foreground">
                {stats.onlineNodes}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Online</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-xl font-bold text-foreground">
                {stats.countries}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Countries</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-xl font-bold text-foreground">
                {stats.avgUptime}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Uptime</div>
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="text-center mt-4 md:mt-3">
          <p className="text-xs text-muted-foreground">
            Last updated: {stats.lastUpdate.toLocaleTimeString()} • Live updates every 30 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
