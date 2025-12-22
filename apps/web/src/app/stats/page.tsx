'use client';

import { Activity, PieChart, LineChart, Globe } from 'lucide-react';
import { getThemeConfig } from '@/config';

export default function StatsPage() {
  const theme = getThemeConfig();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl shadow-lg" style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              boxShadow: `0 10px 25px -5px ${theme.primaryColor}40`
            }}>
              <Activity className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Statistics</h1>
          </div>
          <p className="text-muted-foreground">
            Detailed network statistics and visualizations
          </p>
        </div>

        {/* Coming Soon Card */}
        <div className="relative overflow-hidden rounded-2xl bg-card/80 backdrop-blur-xl shadow-2xl border border-border p-8 sm:p-12">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none" style={{
            background: `linear-gradient(135deg, ${theme.primaryColor}10 0%, transparent 50%, ${theme.secondaryColor}10 100%)`
          }} />

          <div className="relative text-center space-y-6">
            <div className="flex justify-center gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-muted">
                <PieChart className="h-12 w-12" style={{ color: theme.primaryColor }} />
              </div>
              <div className="p-4 rounded-2xl bg-muted">
                <LineChart className="h-12 w-12" style={{ color: theme.secondaryColor }} />
              </div>
              <div className="p-4 rounded-2xl bg-muted">
                <Globe className="h-12 w-12" style={{ color: theme.accentColor }} />
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Statistics Coming Soon
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Extended statistics page with version distributions, country breakdowns, ASN analytics, and geographic heatmaps.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8 max-w-3xl mx-auto">
              {[
                'Version Distribution',
                'Country Breakdown',
                'ASN Analytics',
                'Tier Distribution',
                'Geographic Heatmap',
                'Time Series Data'
              ].map((feature, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-muted border border-border">
                  <p className="font-semibold text-foreground">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
