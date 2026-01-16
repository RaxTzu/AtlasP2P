'use client';

import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, X, Filter, Sparkles, Layers, Gem, Trophy, Medal, Award, Circle } from 'lucide-react';
import { useFilterStore } from '@/hooks/useFilters';
import { getThemeConfig } from '@/config';
import type { NodeStatus, NodeTier } from '@atlasp2p/types';

const statusOptions: { value: NodeStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: '#6b7280' },
  { value: 'up', label: 'Online', color: '#10b981' }, // Keep green (semantic)
  { value: 'reachable', label: 'Reachable', color: '#f59e0b' }, // Orange for TCP-only
  { value: 'down', label: 'Offline', color: '#ef4444' }, // Keep red (semantic)
];

// Using Lucide icons for consistency and better recognition
const tierOptions: { value: NodeTier | 'all'; label: string; icon: typeof Layers; color: string }[] = [
  { value: 'all', label: 'All', icon: Layers, color: '#6b7280' },
  { value: 'diamond', label: 'Diamond', icon: Gem, color: '#06b6d4' },
  { value: 'gold', label: 'Gold', icon: Trophy, color: '#f59e0b' },
  { value: 'silver', label: 'Silver', icon: Medal, color: '#94a3b8' },
  { value: 'bronze', label: 'Bronze', icon: Award, color: '#f97316' },
  { value: 'standard', label: 'Standard', icon: Circle, color: '#64748b' },
];

export function FilterPanel() {
  const theme = getThemeConfig();
  const [isExpanded, setIsExpanded] = useState(true);
  const {
    filters,
    setSearch,
    setStatus,
    setTier,
    setVerifiedOnly,
    clearFilters,
    hasActiveFilters,
  } = useFilterStore();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/95 backdrop-blur-xl shadow-2xl border border-border/50">
      {/* Decorative gradient overlay using theme colors */}
      <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none" style={{
        background: `linear-gradient(135deg, ${theme.primaryColor}10 0%, transparent 50%, ${theme.secondaryColor}10 100%)`
      }} />

      <div className="relative">
        {/* Header - responsive */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          data-drag-handle
          className="w-full flex items-center justify-between px-3 py-2.5 lg:px-4 lg:py-3 hover:bg-muted/50 transition-all duration-200 group cursor-move"
        >
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className="p-1.5 lg:p-2 rounded-lg shadow-md" style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
            }}>
              <Filter className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Filters</span>
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 text-white text-xs rounded-full font-semibold" style={{
                  backgroundColor: theme.primaryColor
                }}>
                  On
                </span>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </button>

        {/* Filters Content - responsive */}
        {isExpanded && (
          <div className="px-3 pb-2.5 lg:px-4 lg:pb-3 space-y-2.5 lg:space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search IP, city, country..."
                value={filters.search || ''}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-muted rounded-lg text-sm focus:outline-none transition-all border border-border text-foreground placeholder:text-muted-foreground"
                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${theme.primaryColor}50`}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
            </div>

            {/* Status - compact row */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Status
              </label>
              <div className="flex gap-1.5">
                {statusOptions.map((option) => {
                  const isActive = (filters.status || 'all') === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() =>
                        setStatus(option.value === 'all' ? undefined : option.value)
                      }
                      className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        isActive
                          ? 'text-white shadow-md'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                      }`}
                      style={isActive ? { backgroundColor: option.color } : {}}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tier - 2x3 grid with icons and labels - responsive */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Tier
              </label>
              <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
                {tierOptions.map((option) => {
                  const isActive = (filters.tier || 'all') === option.value;
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() =>
                        setTier(option.value === 'all' ? undefined : option.value)
                      }
                      className={`px-2.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-start gap-2 ${
                        isActive
                          ? 'text-white shadow-md'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                      }`}
                      style={isActive ? { backgroundColor: option.color } : {}}
                    >
                      <IconComponent className="h-4 w-4 flex-shrink-0" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Verified Only - compact */}
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-foreground">Verified</label>
              </div>
              <button
                onClick={() => setVerifiedOnly(!filters.isVerified)}
                className={`relative w-9 h-5 rounded-full transition-all duration-300 ${
                  filters.isVerified ? '' : 'bg-muted-foreground/30'
                }`}
                style={
                  filters.isVerified
                    ? { backgroundColor: theme.primaryColor }
                    : {}
                }
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${
                    filters.isVerified ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg hover:bg-muted group"
              >
                <X className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-200" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
