'use client';

import { useState } from 'react';
import {
  Globe,
  Server,
  CheckCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useStats } from '@/hooks/useStats';
import { useVersionStats } from '@/hooks/useVersionStats';
import { useCountryStats } from '@/hooks/useCountryStats';
import { useNodes } from '@/hooks/useNodes';
import { getThemeConfig } from '@atlasp2p/config';
import { useMemo } from 'react';

export function StatsPanel() {
  const theme = getThemeConfig();
  const { stats, isLoading, error } = useStats();
  const { versions } = useVersionStats();
  const { countries } = useCountryStats();
  const { nodes } = useNodes();
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Calculate IPv4/IPv6 breakdown
  const ipVersionStats = useMemo(() => {
    const ipv4Count = nodes.filter(node => !node.ip.includes(':')).length;
    const ipv6Count = nodes.filter(node => node.ip.includes(':')).length;
    return { ipv4: ipv4Count, ipv6: ipv6Count };
  }, [nodes]);

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl border border-border/50">
        <div className="p-6 space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gradient-to-r from-muted to-muted/80 rounded-lg w-40" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gradient-to-br from-muted/70 to-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl border border-border/50">
        <div className="p-6">
          <p className="text-sm text-red-500">Failed to load stats</p>
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Total Nodes',
      value: stats.totalNodes.toLocaleString(),
      icon: Server,
      color: theme.primaryColor,
    },
    {
      label: 'Online',
      value: stats.onlineNodes.toLocaleString(),
      icon: CheckCircle,
      color: '#22c55e', // Keep green for online status (semantic)
    },
    {
      label: 'Countries',
      value: stats.countries.toLocaleString(),
      icon: Globe,
      color: theme.secondaryColor,
    },
    {
      label: 'Avg Uptime',
      value: `${stats.avgUptime.toFixed(1)}%`,
      icon: Activity,
      color: theme.accentColor,
    },
  ];

  // Prepare version data for chart (top 5)
  const topVersions = versions.slice(0, 5);
  const versionChartData = topVersions.map((v, idx) => ({
    name: v.version,
    value: v.count,
    percentage: v.percentage,
    color: idx === 0 ? theme.primaryColor : `hsl(${(idx * 60) % 360}, 70%, 60%)`,
  }));

  // Prepare country data for chart (top 8)
  const topCountries = countries.slice(0, 8);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl border border-border/50">
      {/* Decorative gradient overlay using theme colors */}
      <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none" style={{
        background: `linear-gradient(135deg, ${theme.primaryColor}10 0%, transparent 50%, ${theme.secondaryColor}10 100%)`
      }} />

      <div className="relative">
        {/* Header - responsive */}
        <div className="px-3 pt-3 pb-2.5 lg:px-4 lg:pt-4 lg:pb-3">
          <div className="flex items-center gap-2 mb-3 lg:mb-4">
            <div className="p-1.5 lg:p-2 rounded-lg shadow-md flex-shrink-0" style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
            }}>
              <BarChart3 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-foreground truncate">
              Network Overview
            </h2>
          </div>

          {/* Main Stats Grid - responsive 2x2 */}
          <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
            {statItems.map((item) => (
              <div
                key={item.label}
                className="relative overflow-hidden rounded-lg bg-muted/50 p-2.5 lg:p-3 border border-border/50 transition-all duration-200 hover:bg-muted/70 group"
              >
                <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
                  <item.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: item.color }} />
                  <p className="text-xs font-medium text-muted-foreground leading-tight">
                    {item.label}
                  </p>
                </div>
                <p className="text-lg lg:text-xl font-bold tabular-nums" style={{ color: item.color }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Tier Stats - responsive row */}
          <div className="mt-2 lg:mt-3 flex items-center justify-around bg-muted/50 rounded-lg p-1.5 lg:p-2 border border-border/50">
            <div className="flex items-center gap-1 lg:gap-1.5 text-center">
              <span className="text-xs lg:text-sm">💎</span>
              <span className="text-xs font-bold text-foreground">{stats.diamondNodes}</span>
            </div>
            <div className="w-px h-3 lg:h-4 bg-border/50" />
            <div className="flex items-center gap-1 lg:gap-1.5 text-center">
              <span className="text-xs lg:text-sm">🥇</span>
              <span className="text-xs font-bold text-foreground">{stats.goldNodes}</span>
            </div>
            <div className="w-px h-3 lg:h-4 bg-border/50" />
            <div className="flex items-center gap-1 lg:gap-1.5 text-center">
              <span className="text-xs lg:text-sm">✓</span>
              <span className="text-xs font-bold text-foreground">{stats.verifiedNodes}</span>
            </div>
          </div>

          {/* IP Version Stats - responsive row */}
          <div className="mt-1.5 lg:mt-2 flex items-center justify-around bg-muted/50 rounded-lg p-1.5 lg:p-2 border border-border/50">
            <div className="flex flex-col items-center text-center flex-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">IPv4</span>
              <span className="text-xs lg:text-sm font-bold text-foreground">{ipVersionStats.ipv4}</span>
            </div>
            <div className="w-px h-5 lg:h-6 bg-border/50" />
            <div className="flex flex-col items-center text-center flex-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">IPv6</span>
              <span className="text-xs lg:text-sm font-bold text-foreground">{ipVersionStats.ipv6}</span>
            </div>
          </div>
        </div>

        {/* Version Distribution - responsive */}
        {topVersions.length > 0 && (
          <div className="border-t border-border/50">
            <button
              onClick={() => toggleSection('versions')}
              className="w-full px-3 py-2.5 lg:px-4 lg:py-3 flex items-center justify-between hover:bg-muted/50 transition-all duration-200"
            >
              <div className="flex items-center gap-1.5 lg:gap-2">
                <div className="p-1 rounded" style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`
                }}>
                  <TrendingUp className="h-3 w-3 text-white" />
                </div>
                <span className="font-semibold text-xs text-foreground">Versions</span>
              </div>
              {expandedSection === 'versions' ? (
                <ChevronUp className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground" />
              )}
            </button>
            {expandedSection === 'versions' && (
              <div className="px-3 pb-2.5 pt-1 lg:px-4 lg:pb-3">
                <div className="space-y-1.5 lg:space-y-2">
                  {topVersions.map((version, idx) => (
                    <div key={version.version}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-foreground truncate flex-1 mr-2">
                          {version.version}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {version.count}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${version.percentage}%`,
                            background: idx === 0
                              ? `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`
                              : `hsl(${(idx * 60) % 360}, 70%, 60%)`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {versions.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    +{versions.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Geographic Distribution - responsive */}
        {topCountries.length > 0 && (
          <div className="border-t border-border/50">
            <button
              onClick={() => toggleSection('countries')}
              className="w-full px-3 py-2.5 lg:px-4 lg:py-3 flex items-center justify-between hover:bg-muted/50 transition-all duration-200"
            >
              <div className="flex items-center gap-1.5 lg:gap-2">
                <div className="p-1 rounded" style={{
                  background: `linear-gradient(135deg, ${theme.secondaryColor}, ${theme.accentColor})`
                }}>
                  <MapPin className="h-3 w-3 text-white" />
                </div>
                <span className="font-semibold text-xs text-foreground">Countries</span>
              </div>
              {expandedSection === 'countries' ? (
                <ChevronUp className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground" />
              )}
            </button>
            {expandedSection === 'countries' && (
              <div className="px-3 pb-2.5 pt-1 lg:px-4 lg:pb-3 space-y-1.5 lg:space-y-2">
                {topCountries.slice(0, 5).map((country, idx) => (
                  <div key={country.countryCode} className="flex items-center gap-2">
                    <span className="text-base flex-shrink-0">
                      {country.countryCode !== 'Unknown'
                        ? String.fromCodePoint(
                            ...[...country.countryCode.toUpperCase()].map(
                              (char) => 127397 + char.charCodeAt(0)
                            )
                          )
                        : '🌐'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground truncate">
                          {country.countryName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1 flex-shrink-0">
                          {country.count}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${country.percentage}%`,
                            background: idx < 3
                              ? `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})`
                              : `hsl(${(idx * 40) % 360}, 60%, 55%)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {countries.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    +{countries.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer - responsive */}
        <div className="px-3 py-1.5 lg:px-4 lg:py-2 border-t border-border/50 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Updated {new Date(stats.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
