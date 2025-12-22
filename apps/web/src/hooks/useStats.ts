'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClient } from '@/lib/supabase/client';
import type { NetworkStats } from '@atlasp2p/types';

import { getProjectConfig } from '@/config';

export function useStats() {
  const chain = getProjectConfig().chain;
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    const supabase = getClient();

    try {
      // Only show loading state on initial fetch, not on background polls
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      const { data, error: queryError } = await supabase
        .from('network_stats')
        .select('*')
        .eq('chain', chain)
        .single();

      if (queryError) {
        // If view doesn't exist, calculate from nodes
        const { data: nodesData, error: nodesError } = await supabase
          .from('nodes')
          .select('status, country_code, uptime, latency_avg, is_verified, tier')
          .eq('chain', chain);

        if (nodesError) throw nodesError;

        const nodes = nodesData || [];
        const onlineNodes = nodes.filter((n) => n.status === 'up');
        const countries = new Set(nodes.map((n) => n.country_code).filter(Boolean));

        setStats({
          chain,
          totalNodes: nodes.length,
          onlineNodes: onlineNodes.length,
          countries: countries.size,
          avgUptime:
            nodes.length > 0
              ? nodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodes.length
              : 0,
          avgLatency:
            nodes.filter((n) => n.latency_avg).length > 0
              ? nodes.reduce((sum, n) => sum + (n.latency_avg || 0), 0) /
                nodes.filter((n) => n.latency_avg).length
              : 0,
          verifiedNodes: nodes.filter((n) => n.is_verified).length,
          diamondNodes: nodes.filter((n) => n.tier === 'diamond').length,
          goldNodes: nodes.filter((n) => n.tier === 'gold').length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      setStats({
        chain: data.chain,
        totalNodes: data.total_nodes,
        onlineNodes: data.online_nodes,
        countries: data.countries,
        avgUptime: data.avg_uptime || 0,
        avgLatency: data.avg_latency || 0,
        verifiedNodes: data.verified_nodes || 0,
        diamondNodes: data.diamond_nodes || 0,
        goldNodes: data.gold_nodes || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching stats:', err);
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    fetchStats();

    // Refresh stats every 60 seconds (silent background refresh)
    const interval = setInterval(() => fetchStats(true), 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
