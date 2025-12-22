'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getThemeConfig } from '@/config';

// Mock data - in production this would come from network_history table
const generateMockData = () => {
  const data = [];
  const now = Date.now();
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalNodes: Math.floor(65 + Math.random() * 15),
      onlineNodes: Math.floor(58 + Math.random() * 12),
      countries: Math.floor(18 + Math.random() * 8),
    });
  }
  return data;
};

export function NetworkTrendsChart() {
  const theme = getThemeConfig();
  const data = generateMockData();

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Network Trends (30 Days)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="date"
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px', fill: 'var(--color-foreground)' }}
          />
          <YAxis
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px', fill: 'var(--color-foreground)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-foreground)'
            }}
            labelStyle={{ color: 'var(--color-foreground)' }}
          />
          <Legend
            wrapperStyle={{
              color: 'var(--color-foreground)',
              fontSize: '14px'
            }}
          />
          <Line
            type="monotone"
            dataKey="totalNodes"
            stroke={theme.primaryColor}
            strokeWidth={2}
            name="Total Nodes"
            dot={{ fill: theme.primaryColor, r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="onlineNodes"
            stroke="var(--color-success)"
            strokeWidth={2}
            name="Online Nodes"
            dot={{ fill: 'var(--color-success)', r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="countries"
            stroke={theme.secondaryColor}
            strokeWidth={2}
            name="Countries"
            dot={{ fill: theme.secondaryColor, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
