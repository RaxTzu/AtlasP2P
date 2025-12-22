'use client';

import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { getThemeConfig } from '@atlasp2p/config';
import { getServicesWithDescriptions, formatServices } from '@/lib/services-decoder';

interface ServicesBreakdownProps {
  services: number | null;
}

export function ServicesBreakdown({ services }: ServicesBreakdownProps) {
  const theme = getThemeConfig();

  if (services === null || services === undefined) {
    return (
      <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
        No services information available
      </div>
    );
  }

  const servicesList = getServicesWithDescriptions(services);
  const servicesFormatted = formatServices(services);

  // Known Bitcoin P2P services
  const allKnownServices = [
    { bit: 0, name: 'NODE_NETWORK', description: 'Full node - can serve full blocks' },
    { bit: 2, name: 'NODE_BLOOM', description: 'Supports bloom filtered connections' },
    { bit: 3, name: 'NODE_WITNESS', description: 'Supports witness data (SegWit)' },
    { bit: 5, name: 'NODE_COMPACT_FILTERS', description: 'Supports compact block filters' },
    { bit: 6, name: 'NODE_NETWORK_LIMITED', description: 'Limited node - serves last ~2 days of blocks' },
    { bit: 10, name: 'NODE_P2P_V2', description: 'Supports P2P v2 encrypted connections' },
  ];

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" style={{ color: theme.primaryColor }} />
          Services
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Network services advertised by this node
        </p>
      </div>

      {/* Services Bitmask */}
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Services Bitmask</span>
          <code className="font-mono font-semibold">{servicesFormatted}</code>
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-2">
        {allKnownServices.map((service) => {
          const isActive = (services & (1 << service.bit)) !== 0;

          return (
            <div
              key={service.bit}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-card border-border'
                  : 'bg-muted/30 border-border/50 opacity-60'
              }`}
            >
              <div className="pt-0.5">
                {isActive ? (
                  <CheckCircle2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{service.name}</span>
                  <code className="text-xs text-muted-foreground">
                    (1 &lt;&lt; {service.bit})
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">{service.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note about historical tracking */}
      <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Historical services activity tracking requires database schema updates.
          Currently showing active services snapshot. Full heatmap visualization coming soon.
        </p>
      </div>
    </div>
  );
}
