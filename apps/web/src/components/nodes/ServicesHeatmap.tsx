'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { getThemeConfig } from '@atlasp2p/config';
import { getServicesWithDescriptions } from '@/lib/services-decoder';

interface Snapshot {
  snapshot_time: string;
  is_online: boolean;
  services: number | null;
}

interface ServicesHeatmapProps {
  snapshots: Snapshot[];
  period: '7' | '30' | '90';
}

export function ServicesHeatmap({ snapshots, period }: ServicesHeatmapProps) {
  const theme = getThemeConfig();

  const heatmapData = useMemo(() => {
    if (snapshots.length === 0) return { grid: [], services: [] };

    // Get all unique services from snapshots
    const servicesSet = new Set<string>();
    snapshots.forEach((s) => {
      if (s.is_online && s.services !== null && s.services !== undefined) {
        const serviceList = getServicesWithDescriptions(s.services);
        serviceList.forEach((svc) => servicesSet.add(svc.name));
      }
    });

    const services = Array.from(servicesSet).sort();

    // Group snapshots by day
    const dayMap = new Map<string, Map<string, boolean>>();

    snapshots.forEach((snapshot) => {
      if (!snapshot.is_online) return;

      const date = new Date(snapshot.snapshot_time);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, new Map());
      }

      const dayServices = dayMap.get(dayKey)!;

      if (snapshot.services !== null && snapshot.services !== undefined) {
        const serviceList = getServicesWithDescriptions(snapshot.services);
        serviceList.forEach((svc) => {
          dayServices.set(svc.name, true);
        });
      }
    });

    // Convert to grid array (sorted by date)
    const grid = Array.from(dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Newest first
      .slice(0, parseInt(period)) // Limit to period
      .map(([date, servicesMap]) => ({
        date,
        services: services.map((service) => ({
          name: service,
          active: servicesMap.has(service),
        })),
      }));

    return { grid, services };
  }, [snapshots, period]);

  if (heatmapData.grid.length === 0 || heatmapData.services.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
        No services data available for this period
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" style={{ color: theme.primaryColor }} />
          Services Activity
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {heatmapData.grid.length} days of service monitoring
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header with service names */}
          <div className="flex items-start mb-2">
            <div className="w-24 flex-shrink-0" /> {/* Spacer for dates column */}
            <div className="flex gap-1 flex-1">
              {heatmapData.services.map((service) => (
                <div
                  key={service}
                  className="flex-1 text-xs text-muted-foreground font-medium text-center min-w-[60px]"
                  title={service}
                >
                  <div className="truncate">{service.replace('NODE_', '')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid rows */}
          <div className="space-y-1">
            {heatmapData.grid.map((row) => {
              const date = new Date(row.date);
              return (
                <div key={row.date} className="flex items-center gap-1">
                  <div className="w-24 flex-shrink-0 text-xs text-muted-foreground">
                    {date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex gap-1 flex-1">
                    {row.services.map((service) => (
                      <div
                        key={service.name}
                        className="flex-1 h-8 rounded min-w-[60px] transition-colors"
                        style={{
                          backgroundColor: service.active
                            ? `${theme.primaryColor}${service.active ? '' : '20'}`
                            : 'hsl(var(--muted))',
                        }}
                        title={`${service.name}: ${service.active ? 'Active' : 'Inactive'} on ${row.date}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: theme.primaryColor }}
              />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted" />
              <span>Inactive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
