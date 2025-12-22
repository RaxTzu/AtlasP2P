'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, MapPin, TrendingUp, Globe } from 'lucide-react';
import { useCountryStats } from '@/hooks/useCountryStats';
import { useFilterStore } from '@/hooks/useFilters';

type SortField = 'count' | 'name';
type SortOrder = 'asc' | 'desc';

interface CountryTableProps {
  initialLimit?: number;
  showPercentage?: boolean;
  className?: string;
}

// Country flag emoji mapping (ISO 3166-1 alpha-2 to emoji)
const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode === 'Unknown') return '🌍';

  // Convert country code to flag emoji using regional indicator symbols
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};

export function CountryTable({
  initialLimit = 10,
  showPercentage = true,
  className = ''
}: CountryTableProps) {
  const { countries, isLoading, error } = useCountryStats();
  const { setCountry, filters } = useFilterStore();

  const [sortField, setSortField] = useState<SortField>('count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort and filter countries
  const sortedCountries = useMemo(() => {
    if (!countries || countries.length === 0) return [];

    const sorted = [...countries].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'count') {
        comparison = a.count - b.count;
      } else {
        // Sort by name alphabetically
        comparison = (a.countryName || a.countryCode).localeCompare(
          b.countryName || b.countryCode
        );
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [countries, sortField, sortOrder]);

  // Display countries (limited or all)
  const displayedCountries = useMemo(() => {
    if (isExpanded) return sortedCountries;
    return sortedCountries.slice(0, initialLimit);
  }, [sortedCountries, isExpanded, initialLimit]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending for count, ascending for name
      setSortField(field);
      setSortOrder(field === 'count' ? 'desc' : 'asc');
    }
  };

  const handleCountryClick = (countryCode: string) => {
    // Toggle filter: if already selected, clear it; otherwise set it
    if (filters.country === countryCode) {
      setCountry(undefined);
    } else {
      setCountry(countryCode);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortOrder === 'asc'
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  if (error) {
    return (
      <div className={`bg-card rounded-xl p-6 shadow-lg border border-border ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Country Distribution
          </h3>
        </div>
        <div className="flex items-center justify-center h-[300px] text-destructive">
          Failed to load country data
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-card rounded-xl p-6 shadow-lg border border-border ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Country Distribution
          </h3>
        </div>
        <div className="flex items-center justify-center h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const totalCountries = sortedCountries.length;
  const hasMore = totalCountries > initialLimit;

  return (
    <div className={`bg-card rounded-xl p-4 sm:p-6 shadow-lg border border-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Country Distribution
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="font-semibold">{totalCountries}</span>
          <span className="hidden sm:inline">countries</span>
        </div>
      </div>

      {/* Table Container - Responsive */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>Country</span>
                      {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort('count')}
                      className="flex items-center justify-end gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      <span>Nodes</span>
                      {getSortIcon('count')}
                    </button>
                  </th>
                  {showPercentage && (
                    <th className="hidden sm:table-cell px-3 sm:px-4 py-3 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Share
                      </span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {displayedCountries.map((country, index) => {
                  const isSelected = filters.country === country.countryCode;
                  const isTopThree = index < 3 && sortField === 'count' && sortOrder === 'desc';

                  return (
                    <tr
                      key={country.countryCode}
                      onClick={() => handleCountryClick(country.countryCode)}
                      className={`
                        cursor-pointer transition-all duration-200
                        ${isSelected
                          ? 'bg-primary/10 hover:bg-primary/15'
                          : 'hover:bg-muted/50'
                        }
                        ${isTopThree ? 'font-semibold' : ''}
                      `}
                      title={`Click to ${isSelected ? 'clear' : 'filter by'} ${country.countryName || country.countryCode}`}
                    >
                      {/* Country Name with Flag */}
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl" aria-label={`${country.countryName || country.countryCode} flag`}>
                            {getCountryFlag(country.countryCode)}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm truncate ${isSelected ? 'text-primary font-semibold' : 'text-foreground'}`}>
                              {country.countryName || country.countryCode}
                            </span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {country.countryCode}
                            </span>
                          </div>
                          {isTopThree && (
                            <div className="flex items-center gap-1 ml-auto">
                              <TrendingUp className="h-3.5 w-3.5 text-success" />
                              <span className="text-xs font-bold text-success">
                                #{index + 1}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Node Count */}
                      <td className="px-3 sm:px-4 py-3 text-right">
                        <span className={`text-sm font-semibold tabular-nums ${
                          isSelected ? 'text-primary' : 'text-foreground'
                        }`}>
                          {country.count.toLocaleString()}
                        </span>
                      </td>

                      {/* Percentage (hidden on mobile) */}
                      {showPercentage && (
                        <td className="hidden sm:table-cell px-3 sm:px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Percentage Bar */}
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${country.percentage}%` }}
                              />
                            </div>
                            {/* Percentage Text */}
                            <span className="text-xs font-medium text-muted-foreground tabular-nums min-w-[3rem]">
                              {country.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Empty State */}
            {displayedCountries.length === 0 && !isLoading && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No country data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show All / Show Less Button */}
      {hasMore && (
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2.5 text-sm font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show All ({totalCountries - initialLimit} more)
              </>
            )}
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {displayedCountries.length} of {totalCountries}
        </span>
        {filters.country && (
          <button
            onClick={() => setCountry(undefined)}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>
    </div>
  );
}
