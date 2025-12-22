'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getThemeConfig } from '@/config';

export function VersionDistributionChart() {
  const theme = getThemeConfig();

  // Mock data - in production from version_distributions view
  // Using theme colors dynamically
  const data = [
    { name: 'v1.16.0', value: 45, color: theme.primaryColor },
    { name: 'v1.15.1', value: 28, color: theme.secondaryColor },
    { name: 'v1.14.7', value: 15, color: theme.accentColor },
    { name: 'v1.14.6', value: 8, color: 'var(--color-chart-2)' },
    { name: 'Others', value: 4, color: 'var(--color-muted-foreground)' },
  ];

  // Custom label component for proper theme styling
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="var(--color-foreground)"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fontSize: '12px', fontWeight: 600 }}
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Version Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={80}
            fill={theme.primaryColor}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-foreground)'
            }}
            labelStyle={{ color: 'var(--color-foreground)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
