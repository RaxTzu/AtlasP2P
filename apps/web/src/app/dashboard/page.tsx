'use client';

import { Suspense, useMemo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart3, Server, Globe, Activity, Zap, Loader2, TrendingUp, TrendingDown,
  Minus, Info, RefreshCw, Filter, Calendar, MapPin, Network, Clock
} from 'lucide-react';
import { getThemeConfig } from '@/config';
import { useNodes } from '@/hooks/useNodes';
import { Sparkline } from '@/components/dashboard/Sparkline';
import { Tooltip } from '@/components/dashboard/Tooltip';

// Lazy load chart components
const NetworkTrendsChart = dynamic(() => import('@/components/charts/NetworkTrendsChart').then(mod => ({ default: mod.NetworkTrendsChart })), {
  loading: () => <ChartSkeleton />,
  ssr: false
});
const VersionDistributionChart = dynamic(() => import('@/components/charts/VersionDistributionChart').then(mod => ({ default: mod.VersionDistributionChart })), {
  loading: () => <ChartSkeleton />,
  ssr: false
});
const CountryDistributionChart = dynamic(() => import('@/components/charts/CountryDistributionChart').then(mod => ({ default: mod.CountryDistributionChart })), {
  loading: () => <ChartSkeleton />,
  ssr: false
});
const TierDistributionChart = dynamic(() => import('@/components/charts/TierDistributionChart').then(mod => ({ default: mod.TierDistributionChart })), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

function ChartSkeleton() {
  return (
    <div className="glass-strong rounded-2xl p-6 shadow-2xl border border-border/50 animate-pulse">
      <div className="h-6 bg-muted/50 rounded-lg w-1/3 mb-6"></div>
      <div className="h-[300px] bg-muted/30 rounded-xl"></div>
    </div>
  );
}

// Animated counter
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <>{count}{suffix}</>;
}

// Live pulse indicator
function LivePulse({ color = '#10b981', size = 8 }: { color?: string; size?: number }) {
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ backgroundColor: color, width: size, height: size }}
      />
    </div>
  );
}

// Enhanced stat card with sparkline and tooltip
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: number[];
  tooltipContent?: React.ReactNode;
  iconColor?: string;
  pulse?: boolean;
  onClick?: () => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendValue,
  sparklineData,
  tooltipContent,
  iconColor,
  pulse,
  onClick
}: StatCardProps) {
  const theme = getThemeConfig();
  const color = iconColor || theme.primaryColor;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';

  return (
    <div
      className={`group relative glass-strong rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-2xl hover:border-border transition-all duration-300 overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at top right, ${color}10, transparent 70%)`
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl shadow-lg ${pulse ? 'animate-pulse' : ''} transition-transform group-hover:scale-110`}
              style={{
                backgroundColor: `${color}20`,
                boxShadow: `0 8px 16px -4px ${color}30`
              }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                {tooltipContent && (
                  <Tooltip content={tooltipContent} delay={200}>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                  </Tooltip>
                )}
              </div>
              {trend && trendValue && (
                <div className="flex items-center gap-1 mt-1" style={{ color: trendColor }}>
                  <TrendIcon className="h-3 w-3" />
                  <span className="text-xs font-medium">{trendValue}</span>
                </div>
              )}
            </div>
          </div>
          {pulse && <LivePulse color={color} />}
        </div>

        {/* Value */}
        <div className="mb-3">
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mb-3">
            <Sparkline data={sparklineData} width={160} height={40} color={color} smooth />
          </div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <div className="text-sm font-medium text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>

      {/* Decorative gradient */}
      <div
        className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// Quick filter chip
function FilterChip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const theme = getThemeConfig();

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'shadow-lg scale-105'
          : 'glass hover:glass-strong'
      }`}
      style={active ? {
        backgroundColor: theme.primaryColor,
        color: '#ffffff'
      } : {}}
    >
      {label}
    </button>
  );
}

export default function DashboardPage() {
  const theme = getThemeConfig();
  const { nodes, isLoading } = useNodes();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const total = nodes.length;
    const online = nodes.filter(n => n.status === 'up').length;
    const uptime = total > 0 ? (online / total) * 100 : 0;
    const avgLatency = nodes.length > 0
      ? nodes.reduce((acc, n) => acc + (n.latencyAvg || 0), 0) / nodes.length
      : 0;
    const countries = new Set(nodes.map(n => n.countryName).filter(Boolean)).size;

    // Calculate real country distribution
    const countryCount: Record<string, number> = {};
    nodes.forEach(node => {
      const country = node.countryName || 'Unknown';
      countryCount[country] = (countryCount[country] || 0) + 1;
    });

    const topCountries = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country, count]) => ({ country, count }));

    // Generate sparklines from actual latency distribution (last 20 nodes as sample)
    const latencySparkline = nodes.slice(-20).map(n => n.latencyAvg || 0);

    return {
      total,
      online,
      uptime,
      avgLatency,
      countries,
      topCountries,
      sparklines: {
        latency: latencySparkline.length > 0 ? latencySparkline : undefined
      }
    };
  }, [nodes]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-20 animate-pulse"
          style={{ backgroundColor: theme.primaryColor, animationDuration: '8s' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-15 animate-pulse"
          style={{ backgroundColor: theme.secondaryColor, animationDuration: '10s' }}
        />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header with controls */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div
                  className="p-4 rounded-2xl shadow-2xl animate-fade-in-scale"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
                    boxShadow: `0 20px 40px -10px ${theme.primaryColor}50`
                  }}
                >
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
                    Network Dashboard
                    <LivePulse color={theme.primaryColor} size={10} />
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Last updated {lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Time range filters */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <FilterChip label="24 Hours" active={timeRange === '24h'} onClick={() => setTimeRange('24h')} />
                <FilterChip label="7 Days" active={timeRange === '7d'} onClick={() => setTimeRange('7d')} />
                <FilterChip label="30 Days" active={timeRange === '30d'} onClick={() => setTimeRange('30d')} />
                <Tooltip content="Refresh dashboard data">
                  <button className="p-2 glass-strong rounded-xl hover:shadow-lg transition-all active:scale-95">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-strong rounded-2xl p-8 shadow-xl border border-border/50 animate-pulse">
                  <div className="h-12 w-12 bg-muted/50 rounded-xl mb-4"></div>
                  <div className="h-10 bg-muted/50 rounded-lg mb-3"></div>
                  <div className="h-10 bg-muted/30 rounded mb-2"></div>
                  <div className="h-4 bg-muted/50 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard
                  icon={Server}
                  label="Total Nodes"
                  value={stats.total}
                  subtitle={`${stats.online} currently online`}
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Total Network Nodes</div>
                      <div className="text-xs text-muted-foreground">
                        All nodes ever registered in the network
                      </div>
                    </div>
                  }
                  iconColor={theme.primaryColor}
                />

                <StatCard
                  icon={Activity}
                  label="Active Now"
                  value={stats.online}
                  subtitle={`${stats.uptime.toFixed(1)}% network uptime`}
                  trend="up"
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Currently Active Nodes</div>
                      <div className="text-xs text-muted-foreground">
                        Nodes responding to ping within last 5 minutes
                      </div>
                    </div>
                  }
                  iconColor="#10b981"
                  pulse
                />

                <StatCard
                  icon={Globe}
                  label="Countries"
                  value={stats.countries}
                  subtitle="Global network coverage"
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Geographic Distribution</div>
                      <div className="text-xs text-muted-foreground">
                        Number of countries with active nodes
                      </div>
                    </div>
                  }
                  iconColor={theme.secondaryColor}
                />

                <StatCard
                  icon={Zap}
                  label="Avg Latency"
                  value={`${stats.avgLatency.toFixed(0)}ms`}
                  subtitle={stats.avgLatency < 200 ? 'Excellent' : stats.avgLatency < 500 ? 'Good' : 'Fair'}
                  trend={stats.avgLatency < 200 ? 'up' : stats.avgLatency > 500 ? 'down' : 'neutral'}
                  trendValue={stats.avgLatency < 200 ? 'Optimal' : stats.avgLatency > 500 ? 'Slow' : 'Normal'}
                  sparklineData={stats.sparklines.latency}
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Average Network Latency</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Mean response time across all active nodes
                      </div>
                      <div className="text-xs">
                        <div className="text-success">• &lt;200ms: Excellent</div>
                        <div className="text-warning">• 200-500ms: Good</div>
                        <div className="text-destructive">• &gt;500ms: Fair</div>
                      </div>
                    </div>
                  }
                  iconColor={stats.avgLatency < 200 ? '#10b981' : stats.avgLatency < 500 ? '#f59e0b' : '#ef4444'}
                />

                {/* Additional info cards */}
                <div className="glass-strong rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-2xl transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme.primaryColor}20` }}>
                      <Network className="h-5 w-5" style={{ color: theme.primaryColor }} />
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Network Health
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Uptime</span>
                      <span className="text-sm font-bold text-success">{stats.uptime.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-1000"
                        style={{
                          width: `${stats.uptime}%`,
                          backgroundColor: stats.uptime >= 90 ? '#10b981' : stats.uptime >= 70 ? theme.primaryColor : '#ef4444'
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-sm text-muted-foreground">Response Rate</span>
                      <span className="text-sm font-bold text-foreground">
                        {((stats.online / stats.total) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                <Tooltip
                  content={
                    <div>
                      <div className="font-semibold mb-1">Geographic Coverage</div>
                      <div className="text-xs text-muted-foreground">
                        Top 3 countries by node count
                      </div>
                    </div>
                  }
                >
                  <div className="glass-strong rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-2xl transition-all cursor-help">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme.secondaryColor}20` }}>
                        <MapPin className="h-5 w-5" style={{ color: theme.secondaryColor }} />
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Top Regions
                      </div>
                    </div>

                    <div className="space-y-2">
                      {stats.topCountries.map(({ country, count }) => (
                        <div key={country} className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {country}
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {count}
                          </span>
                        </div>
                      ))}
                      {stats.topCountries.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Tooltip>
              </div>

              {/* Charts Section */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <div className="h-1 w-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                  Network Analytics
                  <span className="text-sm font-normal text-muted-foreground">({timeRange})</span>
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <Suspense fallback={<ChartSkeleton />}>
                    <NetworkTrendsChart />
                  </Suspense>
                  <Suspense fallback={<ChartSkeleton />}>
                    <VersionDistributionChart />
                  </Suspense>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Suspense fallback={<ChartSkeleton />}>
                    <CountryDistributionChart />
                  </Suspense>
                  <Suspense fallback={<ChartSkeleton />}>
                    <TierDistributionChart />
                  </Suspense>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
