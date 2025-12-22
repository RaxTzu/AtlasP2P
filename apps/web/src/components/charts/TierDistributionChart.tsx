'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getThemeConfig } from '@/config';

export function TierDistributionChart() {
  const theme = getThemeConfig();

  // Using semantic tier colors that match the tier system
  const data = [
    { tier: 'Diamond', nodes: 5, color: 'var(--color-chart-1)' }, // cyan for diamond
    { tier: 'Gold', nodes: 12, color: 'var(--color-warning)' }, // gold/amber
    { tier: 'Silver', nodes: 18, color: 'var(--color-muted-foreground)' }, // silver/gray
    { tier: 'Bronze', nodes: 25, color: 'var(--color-chart-3)' }, // orange for bronze
    { tier: 'Standard', nodes: 40, color: theme.primaryColor }, // theme color for standard
  ];

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Node Tier Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="tier"
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
          <Bar dataKey="nodes" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
