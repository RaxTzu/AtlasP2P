'use client';

import { useMemo, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { getThemeConfig } from '@/config';
import { useNetworkHistory } from '@/hooks/useNetworkHistory';

// Memoized tooltip - prevents re-renders on hover
const CustomTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-foreground font-semibold mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 mt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <p className="text-foreground text-sm">
            {entry.name}: <strong>{entry.value}</strong>
          </p>
        </div>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

// Memoized custom legend - shows colored text labels
const CustomLegend = memo(({ payload }: any) => {
  if (!payload || !payload.length) return null;

  return (
    <div className="flex justify-center gap-6 mt-3">
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
});
CustomLegend.displayName = 'CustomLegend';

export const NetworkTrendsChart = memo(function NetworkTrendsChart() {
  const theme = getThemeConfig();
  const { history, isLoading, error } = useNetworkHistory(30);

  // Transform data for chart (memoized for performance)
  const chartData = useMemo(() => {
    return history.map((point) => ({
      date: new Date(point.snapshotTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalNodes: point.totalNodes,
      onlineNodes: point.onlineNodes,
      countries: point.countries,
    }));
  }, [history]);

  if (error) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Network Trends (30 Days)</h3>
        <div className="h-[320px] flex items-center justify-center">
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
        <h3 className="text-lg font-semibold mb-4 text-foreground">Network Trends (30 Days)</h3>
        <div className="h-[320px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No historical data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Network Trends (30 Days)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border opacity-30" />
          <XAxis
            dataKey="date"
            className="text-muted-foreground"
            style={{ fontSize: 12 }}
            height={50}
          />
          <YAxis
            className="text-muted-foreground"
            style={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          <Line
            type="monotone"
            dataKey="totalNodes"
            stroke={theme.primaryColor}
            strokeWidth={2}
            name="Total Nodes"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="onlineNodes"
            stroke="#22c55e"
            strokeWidth={2}
            name="Online Nodes"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="countries"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Countries"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
