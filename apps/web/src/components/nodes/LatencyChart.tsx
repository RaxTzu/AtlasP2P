'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getThemeConfig } from '@/config';

interface Snapshot {
  snapshot_time: string;
  is_online: boolean;
  response_time_ms: number | null;
}

interface LatencyChartProps {
  snapshots: Snapshot[];
  period: '1' | '7' | '30';
}

export function LatencyChart({ snapshots, period }: LatencyChartProps) {
  const theme = getThemeConfig();

  const chartData = useMemo(() => {
    return snapshots
      .filter(s => s.is_online && s.response_time_ms !== null)
      .map(s => ({
        time: new Date(s.snapshot_time).getTime(),
        latency: s.response_time_ms,
        date: new Date(s.snapshot_time).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: period === '1' ? '2-digit' : undefined,
          minute: period === '1' ? '2-digit' : undefined,
        }),
      }));
  }, [snapshots, period]);

  const avgLatency = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, d) => acc + (d.latency || 0), 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
        No latency data available for this period
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Response Time (RTT)
        </h3>
        <div className="text-sm">
          <span className="text-muted-foreground">Avg: </span>
          <span className="font-bold" style={{ color: theme.primaryColor }}>
            {avgLatency}ms
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: theme.primaryColor }}
            axisLine={{ stroke: theme.primaryColor }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: theme.primaryColor }}
            axisLine={{ stroke: theme.primaryColor }}
            label={{
              value: 'ms',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12 }
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--card-foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke={theme.primaryColor}
            strokeWidth={2}
            dot={false}
            name="Latency"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
