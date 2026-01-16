'use client';

import { useMemo, memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { getThemeConfig } from '@/config';
import { useVersionStats } from '@/hooks/useVersionStats';

// Memoized tooltip
const CustomTooltip = memo(({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
        <p className="text-foreground font-semibold">{payload[0].name}</p>
      </div>
      <p className="text-foreground text-sm ml-5">
        Nodes: <strong>{payload[0].value}</strong> ({payload[0].payload.percentage.toFixed(1)}%)
      </p>
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

// Memoized legend
const CustomLegend = memo(({ payload }: any) => {
  if (!payload || !payload.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
});
CustomLegend.displayName = 'CustomLegend';

export const VersionDistributionChart = memo(function VersionDistributionChart() {
  const theme = getThemeConfig();
  const { versions, isLoading, error } = useVersionStats();

  // Chart colors array (static, no need for state)
  const chartColors = useMemo(() => [
    theme.primaryColor,
    theme.secondaryColor,
    theme.accentColor,
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--muted-foreground))',
  ], [theme.primaryColor, theme.secondaryColor, theme.accentColor]);

  // Transform data for chart with theme colors (memoized for performance)
  const chartData = useMemo(() => {
    return versions.slice(0, 8).map((v, index) => ({
      name: v.version,
      value: v.count,
      percentage: v.percentage,
      color: chartColors[index % chartColors.length],
    }));
  }, [versions, chartColors]);

  if (error) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Version Distribution</h3>
        <div className="h-[280px] flex items-center justify-center">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0 && !isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Version Distribution</h3>
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No version data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Version Distribution
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill={theme.primaryColor}
            dataKey="value"
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
