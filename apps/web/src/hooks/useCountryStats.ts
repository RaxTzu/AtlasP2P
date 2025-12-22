'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClient } from '@/lib/supabase/client';
import type { CountryDistribution } from '@atlasp2p/types';

import { getProjectConfig } from '@/config';

export function useCountryStats() {
  const chain = getProjectConfig().chain;
  const [countries, setCountries] = useState<CountryDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCountryStats = useCallback(async () => {
    const supabase = getClient();

    try {
      setIsLoading(true);
      setError(null);

      const { data: nodes, error: queryError } = await supabase
        .from('nodes_public')
        .select('country_code, country_name, status')
        .eq('chain', chain);

      if (queryError) throw queryError;

      // Aggregate countries
      const countryCounts = new Map<
        string,
        { name: string; count: number }
      >();
      const total = nodes?.length || 0;

      nodes?.forEach((node) => {
        const code = node.country_code || 'Unknown';
        const name = node.country_name || 'Unknown';
        const existing = countryCounts.get(code);
        countryCounts.set(code, {
          name,
          count: (existing?.count || 0) + 1,
        });
      });

      // Convert to array and sort by count
      const countryStats: CountryDistribution[] = Array.from(
        countryCounts.entries()
      )
        .map(([countryCode, data]) => ({
          countryCode,
          countryName: data.name,
          count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      setCountries(countryStats);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching country stats:', err);
      }
      setError(
        err instanceof Error ? err.message : 'Failed to fetch country stats'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountryStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchCountryStats, 300000);
    return () => clearInterval(interval);
  }, [fetchCountryStats]);

  return {
    countries,
    isLoading,
    error,
    refetch: fetchCountryStats,
  };
}
