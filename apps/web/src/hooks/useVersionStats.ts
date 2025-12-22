'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClient } from '@/lib/supabase/client';
import type { VersionDistribution } from '@atlasp2p/types';

import { getProjectConfig } from '@/config';

export function useVersionStats() {
  const chain = getProjectConfig().chain;
  const [versions, setVersions] = useState<VersionDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersionStats = useCallback(async () => {
    const supabase = getClient();

    try {
      setIsLoading(true);
      setError(null);

      const { data: nodes, error: queryError } = await supabase
        .from('nodes_public')
        .select('version, status')
        .eq('chain', chain);

      if (queryError) throw queryError;

      // Aggregate versions
      const versionCounts = new Map<string, number>();
      const total = nodes?.length || 0;

      nodes?.forEach((node) => {
        const version = node.version || 'Unknown';
        versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
      });

      // Convert to array and sort by count
      const versionStats: VersionDistribution[] = Array.from(
        versionCounts.entries()
      )
        .map(([version, count]) => ({
          version,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      setVersions(versionStats);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching version stats:', err);
      }
      setError(
        err instanceof Error ? err.message : 'Failed to fetch version stats'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersionStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchVersionStats, 300000);
    return () => clearInterval(interval);
  }, [fetchVersionStats]);

  return {
    versions,
    isLoading,
    error,
    refetch: fetchVersionStats,
  };
}
