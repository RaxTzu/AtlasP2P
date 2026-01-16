'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, Users, CheckCircle2, Wifi } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getClient } from '@/lib/supabase/client';
import { getProjectConfig, getThemeConfig } from '@/config';

interface NetworkSnapshot {
  snapshot_time: string;
  total_nodes: number;
  online_nodes: number;
  countries: number;
  avg_latency: number | null;
  avg_uptime: number | null;
}

interface GrowthMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  changePercentage: number;
  changeAbsolute: number;
  isPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  sparklineData: number[];
}

type TimePeriod = '24h' | '7d' | '30d';

export function GrowthMetrics() {
  const chain = getProjectConfig().chain;
  const theme = getThemeConfig();

  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('24h');
  const [metrics, setMetrics] = useState<GrowthMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrowthData = useCallback(async (showLoading = true) => {
    const supabase = getClient();

    try {
      // Only show loading if we don't have data yet (prevents flickering on refresh)
      if (showLoading && metrics.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      // Calculate time ranges
      const now = new Date();
      const periodHours = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 168 : 720;
      const startTime = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
      const midTime = new Date(now.getTime() - (periodHours / 2) * 60 * 60 * 1000);

      // Fetch snapshots for the selected period
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('network_history')
        .select('*')
        .eq('chain', chain)
        .gte('snapshot_time', startTime.toISOString())
        .order('snapshot_time', { ascending: true });

      if (snapshotsError) throw snapshotsError;

      if (!snapshots || snapshots.length === 0) {
        // Fallback to current nodes data if no snapshots
        const { data: currentNodes, error: nodesError } = await supabase
          .from('nodes')
          .select('connection_type, is_verified, status')
          .eq('chain', chain);

        if (nodesError) throw nodesError;

        const totalNodes = currentNodes?.length || 0;
        const ipv4Nodes = currentNodes?.filter(n => n.connection_type === 'ipv4').length || 0;
        const ipv6Nodes = currentNodes?.filter(n => n.connection_type === 'ipv6').length || 0;
        const verifiedNodes = currentNodes?.filter(n => n.is_verified).length || 0;

        // No historical data, show zeros
        setMetrics([
          {
            label: 'Total Nodes',
            currentValue: totalNodes,
            previousValue: totalNodes,
            changePercentage: 0,
            changeAbsolute: 0,
            isPositive: true,
            icon: Activity,
            sparklineData: [totalNodes],
          },
          {
            label: 'IPv4 Nodes',
            currentValue: ipv4Nodes,
            previousValue: ipv4Nodes,
            changePercentage: 0,
            changeAbsolute: 0,
            isPositive: true,
            icon: Wifi,
            sparklineData: [ipv4Nodes],
          },
          {
            label: 'IPv6 Nodes',
            currentValue: ipv6Nodes,
            previousValue: ipv6Nodes,
            changePercentage: 0,
            changeAbsolute: 0,
            isPositive: true,
            icon: Users,
            sparklineData: [ipv6Nodes],
          },
          {
            label: 'Verified Nodes',
            currentValue: verifiedNodes,
            previousValue: verifiedNodes,
            changePercentage: 0,
            changeAbsolute: 0,
            isPositive: true,
            icon: CheckCircle2,
            sparklineData: [verifiedNodes],
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Get current and previous snapshots
      const currentSnapshot = snapshots[snapshots.length - 1];
      const previousSnapshots = snapshots.filter(
        s => new Date(s.snapshot_time) <= midTime
      );
      const previousSnapshot = previousSnapshots.length > 0
        ? previousSnapshots[previousSnapshots.length - 1]
        : snapshots[0];

      // Fetch current detailed node data for IPv4/IPv6/verified breakdown
      const { data: currentNodes, error: nodesError } = await supabase
        .from('nodes')
        .select('connection_type, is_verified')
        .eq('chain', chain);

      if (nodesError) throw nodesError;

      const currentIpv4 = currentNodes?.filter(n => n.connection_type === 'ipv4').length || 0;
      const currentIpv6 = currentNodes?.filter(n => n.connection_type === 'ipv6').length || 0;
      const currentVerified = currentNodes?.filter(n => n.is_verified).length || 0;

      // Estimate previous values (proportional to total nodes change)
      const totalNodesRatio = previousSnapshot.total_nodes > 0
        ? currentSnapshot.total_nodes / previousSnapshot.total_nodes
        : 1;

      const previousIpv4 = Math.round(currentIpv4 / totalNodesRatio);
      const previousIpv6 = Math.round(currentIpv6 / totalNodesRatio);
      const previousVerified = Math.round(currentVerified / totalNodesRatio);

      // Generate sparkline data (sample 10 points from snapshots)
      const sampleSize = Math.min(10, snapshots.length);
      const step = Math.max(1, Math.floor(snapshots.length / sampleSize));
      const sparklineSnapshots = snapshots.filter((_, i) => i % step === 0);

      const totalNodesSparkline = sparklineSnapshots.map(s => s.total_nodes);
      const ipv4Sparkline = sparklineSnapshots.map((s, i) => {
        const ratio = s.total_nodes > 0 ? currentSnapshot.total_nodes / s.total_nodes : 1;
        return Math.round(currentIpv4 / ratio);
      });
      const ipv6Sparkline = sparklineSnapshots.map((s, i) => {
        const ratio = s.total_nodes > 0 ? currentSnapshot.total_nodes / s.total_nodes : 1;
        return Math.round(currentIpv6 / ratio);
      });
      const verifiedSparkline = sparklineSnapshots.map((s, i) => {
        const ratio = s.total_nodes > 0 ? currentSnapshot.total_nodes / s.total_nodes : 1;
        return Math.round(currentVerified / ratio);
      });

      // Calculate metrics
      const calculateChange = (current: number, previous: number) => {
        const absolute = current - previous;
        const percentage = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        return { absolute, percentage, isPositive: absolute >= 0 };
      };

      const totalChange = calculateChange(currentSnapshot.total_nodes, previousSnapshot.total_nodes);
      const ipv4Change = calculateChange(currentIpv4, previousIpv4);
      const ipv6Change = calculateChange(currentIpv6, previousIpv6);
      const verifiedChange = calculateChange(currentVerified, previousVerified);

      setMetrics([
        {
          label: 'Total Nodes',
          currentValue: currentSnapshot.total_nodes,
          previousValue: previousSnapshot.total_nodes,
          changePercentage: totalChange.percentage,
          changeAbsolute: totalChange.absolute,
          isPositive: totalChange.isPositive,
          icon: Activity,
          sparklineData: totalNodesSparkline,
        },
        {
          label: 'IPv4 Nodes',
          currentValue: currentIpv4,
          previousValue: previousIpv4,
          changePercentage: ipv4Change.percentage,
          changeAbsolute: ipv4Change.absolute,
          isPositive: ipv4Change.isPositive,
          icon: Wifi,
          sparklineData: ipv4Sparkline,
        },
        {
          label: 'IPv6 Nodes',
          currentValue: currentIpv6,
          previousValue: previousIpv6,
          changePercentage: ipv6Change.percentage,
          changeAbsolute: ipv6Change.absolute,
          isPositive: ipv6Change.isPositive,
          icon: Users,
          sparklineData: ipv6Sparkline,
        },
        {
          label: 'Verified Nodes',
          currentValue: currentVerified,
          previousValue: previousVerified,
          changePercentage: verifiedChange.percentage,
          changeAbsolute: verifiedChange.absolute,
          isPositive: verifiedChange.isPositive,
          icon: CheckCircle2,
          sparklineData: verifiedSparkline,
        },
      ]);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching growth data:', err);
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch growth data');
    } finally {
      setIsLoading(false);
    }
  }, [chain, selectedPeriod]);

  useEffect(() => {
    // On period change, don't show loading if we already have data
    const hasData = metrics.length > 0;
    fetchGrowthData(!hasData);

    // Refresh every 5 minutes (don't show loading)
    const interval = setInterval(() => fetchGrowthData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchGrowthData]); // Depend on fetchGrowthData which already depends on selectedPeriod and chain

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl border border-border/50">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gradient-to-r from-muted to-muted/80 rounded-lg w-32" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gradient-to-br from-muted/70 to-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl border border-border/50">
        <div className="p-6">
          <p className="text-sm text-red-500">Failed to load growth metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl border border-border/50">
      {/* Decorative gradient overlay */}
      <div
        className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}10 0%, transparent 50%, ${theme.secondaryColor}10 100%)`
        }}
      />

      <div className="relative">
        {/* Header with Period Selector - responsive */}
        <div className="px-3 pt-3 pb-2.5 lg:px-4 lg:pt-4 lg:pb-3">
          <div className="flex items-center justify-between gap-2 mb-2.5 lg:mb-3">
            <div className="flex items-center gap-1.5 lg:gap-2 min-w-0">
              <div
                className="p-1.5 lg:p-2 rounded-lg shadow-md flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
                }}
              >
                <TrendingUp className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">Network Growth</h2>
              </div>
            </div>

            {/* Period Selector - responsive */}
            <div className="flex gap-0.5 bg-muted/50 rounded-md p-0.5 border border-border/50 flex-shrink-0">
              {(['24h', '7d', '30d'] as TimePeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-1.5 lg:px-2 py-0.5 lg:py-1 text-xs font-semibold rounded transition-all duration-200 ${
                    selectedPeriod === period
                      ? 'text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  style={selectedPeriod === period ? { backgroundColor: theme.primaryColor } : {}}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Growth Metrics Grid - responsive 2x2 layout */}
          <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
            {metrics.map((metric) => {
              const IconComponent = metric.icon;
              const trendColor = metric.isPositive ? '#22c55e' : '#ef4444';
              const TrendIcon = metric.isPositive ? TrendingUp : TrendingDown;

              return (
                <div
                  key={metric.label}
                  className="relative overflow-hidden rounded-lg bg-muted/50 p-2.5 lg:p-3 border border-border/50 transition-all duration-200 hover:bg-muted/70 group"
                >
                  {/* Header - icon and label - responsive */}
                  <div className="flex items-center gap-1.5 lg:gap-2 mb-1.5 lg:mb-2">
                    <div
                      className="p-1 lg:p-1.5 rounded-md flex-shrink-0"
                      style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground leading-tight break-words">
                      {metric.label}
                    </p>
                  </div>

                  {/* Value - responsive */}
                  <p className="text-lg lg:text-xl font-bold text-foreground tabular-nums mb-1">
                    {metric.currentValue.toLocaleString()}
                  </p>

                  {/* Change indicator - responsive */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <TrendIcon className="h-3 w-3 flex-shrink-0" style={{ color: trendColor }} />
                    <span className="text-xs font-semibold" style={{ color: trendColor }}>
                      {metric.changeAbsolute > 0 ? '+' : ''}{metric.changeAbsolute}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({metric.changePercentage > 0 ? '+' : ''}{metric.changePercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Info - responsive */}
          <div className="mt-2 lg:mt-3 pt-1.5 lg:pt-2 border-t border-border/30 text-xs text-muted-foreground">
            <span>vs {selectedPeriod === '24h' ? '12h' : selectedPeriod === '7d' ? '3.5d' : '15d'} ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
