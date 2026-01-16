'use client';

import { Suspense, useMemo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart3, Server, Globe, Activity, Zap, TrendingUp, TrendingDown,
  Minus, Info, RefreshCw, Filter, Clock, MapPin, Network, Download,
  CheckCircle, XCircle, AlertTriangle
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

// Stat card
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
}: StatCardProps) {
  const theme = getThemeConfig();
  const color = iconColor || theme.primaryColor;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';

  return (
    <div className="group relative glass-strong rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-2xl hover:border-border transition-all duration-300">
      <div className="relative">
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

        <div className="mb-3">
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </div>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="mb-3">
            <Sparkline data={sparklineData} width={160} height={40} color={color} smooth />
          </div>
        )}

        {subtitle && (
          <div className="text-sm font-medium text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// Filter chip
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const theme = getThemeConfig();

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
        active ? 'shadow-lg scale-105' : 'glass hover:glass-strong'
      }`}
      style={active ? { backgroundColor: theme.primaryColor, color: '#ffffff' } : {}}
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'trends' | 'distribution'>('trends');

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const stats = useMemo(() => {
    const total = nodes.length;
    const online = nodes.filter(n => n.status === 'up').length;
    const offline = total - online;
    const uptime = total > 0 ? (online / total) * 100 : 0;
    const avgLatency = nodes.length > 0
      ? nodes.reduce((acc, n) => acc + (n.latencyAvg || 0), 0) / nodes.length
      : 0;
    const countries = new Set(nodes.map(n => n.countryName).filter(Boolean)).size;

    const countryCount: Record<string, number> = {};
    nodes.forEach(node => {
      const country = node.countryName || 'Unknown';
      countryCount[country] = (countryCount[country] || 0) + 1;
    });

    const topCountries = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country, count]) => ({ country, count }));

    const latencySparkline = nodes.slice(-20).map(n => n.latencyAvg || 0);

    // Node health status
    const healthy = nodes.filter(n => n.status === 'up' && (n.latencyAvg || 0) < 200).length;
    const degraded = nodes.filter(n => n.status === 'up' && (n.latencyAvg || 0) >= 200 && (n.latencyAvg || 0) < 500).length;
    const unhealthy = nodes.filter(n => n.status === 'up' && (n.latencyAvg || 0) >= 500).length + offline;

    return {
      total,
      online,
      offline,
      uptime,
      avgLatency,
      countries,
      topCountries,
      healthy,
      degraded,
      unhealthy,
      sparklines: {
        latency: latencySparkline.length > 0 ? latencySparkline : undefined
      }
    };
  }, [nodes]);

  const handleExport = () => {
    const data = {
      timestamp: new Date().toISOString(),
      stats,
      nodes: nodes.map(n => ({
        ip: n.ip,
        status: n.status,
        country: n.countryName,
        latency: n.latencyAvg
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-stats-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen relative">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
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
                  <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2" suppressHydrationWarning>
                    <Clock className="h-3 w-3" />
                    Last updated {lastUpdate.toLocaleTimeString()}
                    {autoRefresh && <span className="text-xs">(auto-refresh)</span>}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <FilterChip label="24 Hours" active={timeRange === '24h'} onClick={() => setTimeRange('24h')} />
                <FilterChip label="7 Days" active={timeRange === '7d'} onClick={() => setTimeRange('7d')} />
                <FilterChip label="30 Days" active={timeRange === '30d'} onClick={() => setTimeRange('30d')} />

                <Tooltip content={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}>
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`p-2 rounded-xl transition-all active:scale-95 ${
                      autoRefresh ? 'glass-strong shadow-lg' : 'glass'
                    }`}
                    style={autoRefresh ? { backgroundColor: `${theme.primaryColor}20` } : {}}
                  >
                    <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { color: theme.primaryColor } : {}} />
                  </button>
                </Tooltip>

                <Tooltip content="Export dashboard data">
                  <button
                    onClick={handleExport}
                    className="p-2 glass-strong rounded-xl hover:shadow-lg transition-all active:scale-95"
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[...Array(4)].map((_, i) => (
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
              {/* HERO STATS - 4 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={Server}
                  label="Total Nodes"
                  value={stats.total}
                  subtitle={`${stats.online} online, ${stats.offline} offline`}
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Total Network Nodes</div>
                      <div className="text-xs text-muted-foreground">
                        All nodes registered in the network
                      </div>
                    </div>
                  }
                  iconColor={theme.primaryColor}
                />

                <StatCard
                  icon={Activity}
                  label="Active Nodes"
                  value={stats.online}
                  subtitle={`${stats.uptime.toFixed(1)}% uptime`}
                  trend="up"
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Currently Active</div>
                      <div className="text-xs text-muted-foreground">
                        Nodes responding to ping
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
                  subtitle="Global reach"
                  tooltipContent={
                    <div>
                      <div className="font-semibold mb-1">Geographic Coverage</div>
                      <div className="text-xs text-muted-foreground">
                        Countries with active nodes
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
                      <div className="font-semibold mb-1">Network Latency</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Mean response time across nodes
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
              </div>

              {/* INFO CARDS - 2 Wide Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Node Health Status */}
                <div className="glass-strong rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-2xl transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme.primaryColor}20` }}>
                      <Network className="h-5 w-5" style={{ color: theme.primaryColor }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Node Health Status</h3>
                      <p className="text-xs text-muted-foreground">Performance distribution</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm text-muted-foreground">Healthy (&lt;200ms)</span>
                      </div>
                      <span className="text-lg font-bold text-success">{stats.healthy}</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-success transition-all duration-1000"
                        style={{ width: `${(stats.healthy / stats.total) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm text-muted-foreground">Degraded (200-500ms)</span>
                      </div>
                      <span className="text-lg font-bold text-warning">{stats.degraded}</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-warning transition-all duration-1000"
                        style={{ width: `${(stats.degraded / stats.total) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-muted-foreground">Unhealthy/Offline</span>
                      </div>
                      <span className="text-lg font-bold text-destructive">{stats.unhealthy}</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-destructive transition-all duration-1000"
                        style={{ width: `${(stats.unhealthy / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Top Regions */}
                <div className="glass-strong rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-2xl transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme.secondaryColor}20` }}>
                      <MapPin className="h-5 w-5" style={{ color: theme.secondaryColor }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Top Regions</h3>
                      <p className="text-xs text-muted-foreground">Geographic distribution</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {stats.topCountries.map(({ country, count }) => (
                      <div key={country} className="flex justify-between items-center p-3 glass rounded-xl hover:glass-strong transition-all">
                        <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                          {country}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${(count / stats.total) * 100}%`,
                                backgroundColor: theme.secondaryColor
                              }}
                            />
                          </div>
                          <span className="text-lg font-bold text-foreground min-w-[30px] text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                    {stats.topCountries.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No geographic data available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CHARTS SECTION */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <div className="h-1 w-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                    Network Analytics
                    <span className="text-sm font-normal text-muted-foreground">({timeRange})</span>
                  </h2>

                  {/* Chart tabs */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('trends')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'trends'
                          ? 'shadow-lg'
                          : 'glass hover:glass-strong'
                      }`}
                      style={activeTab === 'trends' ? { backgroundColor: theme.primaryColor, color: '#ffffff' } : {}}
                    >
                      Trends & History
                    </button>
                    <button
                      onClick={() => setActiveTab('distribution')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'distribution'
                          ? 'shadow-lg'
                          : 'glass hover:glass-strong'
                      }`}
                      style={activeTab === 'distribution' ? { backgroundColor: theme.primaryColor, color: '#ffffff' } : {}}
                    >
                      Distribution
                    </button>
                  </div>
                </div>

                {activeTab === 'trends' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Suspense fallback={<ChartSkeleton />}>
                      <div className="glass-strong rounded-2xl p-6 shadow-xl border-2 border-primary/30">
                        <NetworkTrendsChart />
                      </div>
                    </Suspense>
                    <Suspense fallback={<ChartSkeleton />}>
                      <VersionDistributionChart />
                    </Suspense>
                  </div>
                )}

                {activeTab === 'distribution' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Suspense fallback={<ChartSkeleton />}>
                      <div className="glass-strong rounded-2xl p-6 shadow-xl border-2 border-primary/30">
                        <CountryDistributionChart />
                      </div>
                    </Suspense>
                    <Suspense fallback={<ChartSkeleton />}>
                      <TierDistributionChart />
                    </Suspense>
                  </div>
                )}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
