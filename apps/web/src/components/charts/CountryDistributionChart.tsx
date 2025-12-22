'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getThemeConfig } from '@/config';
import { useCountryStats } from '@/hooks/useCountryStats';
import { useMemo } from 'react';

export function CountryDistributionChart() {
  const theme = getThemeConfig();
  const { countries, isLoading, error } = useCountryStats();

  // Transform data for chart, take top 8 countries and group the rest as "Others"
  const chartData = useMemo(() => {
    if (!countries || countries.length === 0) {
      return [];
    }

    const topCountries = countries.slice(0, 8);
    const othersCount = countries.slice(8).reduce((sum, c) => sum + c.count, 0);

    const data = topCountries.map(c => ({
      country: c.countryName || c.countryCode,
      nodes: c.count
    }));

    if (othersCount > 0) {
      data.push({ country: 'Others', nodes: othersCount });
    }

    return data;
  }, [countries]);

  if (error) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
        <h3 className="text-lg font-semibold mb-4 text-foreground">
          Top Countries
        </h3>
        <div className="flex items-center justify-center h-[300px] text-error">
          Failed to load country data
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
        <h3 className="text-lg font-semibold mb-4 text-foreground">
          Top Countries
        </h3>
        <div className="flex items-center justify-center h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Top Countries
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            type="number"
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px', fill: 'var(--color-foreground)' }}
          />
          <YAxis
            dataKey="country"
            type="category"
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px', fill: 'var(--color-foreground)' }}
            width={80}
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
          <Bar
            dataKey="nodes"
            fill={theme.primaryColor}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
