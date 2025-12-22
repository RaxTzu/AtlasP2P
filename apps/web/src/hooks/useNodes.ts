'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClient } from '@/lib/supabase/client';
import { useFilterStore } from './useFilters';
import { getProjectConfig } from '@/config';
import type { NodeWithProfile, NodeFilters } from '@atlasp2p/types';

export function useNodes() {
  const chain = getProjectConfig().chain;
  const [nodes, setNodes] = useState<NodeWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { filters } = useFilterStore();

  const fetchNodes = useCallback(async (silent = false) => {
    const supabase = getClient();

    try {
      // Only show loading state on initial fetch, not on background polls
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      let query = supabase
        .from('nodes_public')
        .select('*')
        .eq('chain', chain);

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.tier) {
        query = query.eq('tier', filters.tier);
      }

      if (filters.country) {
        query = query.eq('country_code', filters.country);
      }

      if (filters.isVerified) {
        query = query.eq('is_verified', true);
      }

      if (filters.search && filters.search.trim()) {
        // Escape special characters for safe search
        const searchTerm = filters.search.trim().replace(/[%_]/g, '\\$&');
        // Search across IP, address, city, country, and version fields
        // Note: column names match the nodes_public view
        query = query.or(
          `ip.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,country_name.ilike.%${searchTerm}%,country_code.ilike.%${searchTerm}%,version.ilike.%${searchTerm}%`
        );
      }

      // Order and limit
      query = query
        .order(filters.sortBy || 'rank', {
          ascending: filters.sortOrder === 'asc',
          nullsFirst: false,
        })
        .limit(filters.limit || 1000);

      if (filters.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 1000) - 1
        );
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      // Transform snake_case to camelCase
      const transformedNodes: NodeWithProfile[] = (data || []).map((node) => ({
        id: node.id,
        ip: node.ip || '',
        port: node.port || 0,
        address: node.address || '',
        chain: node.chain || '',
        version: node.version,
        protocolVersion: node.protocol_version,
        services: node.services,
        startHeight: node.start_height,
        clientName: node.client_name,
        clientVersion: node.client_version,
        versionMajor: node.version_major,
        versionMinor: node.version_minor,
        versionPatch: node.version_patch,
        isCurrentVersion: node.is_current_version || false,
        countryCode: node.country_code,
        countryName: node.country_name,
        region: node.region,
        city: node.city,
        latitude: node.latitude,
        longitude: node.longitude,
        timezone: node.timezone,
        isp: node.isp,
        org: node.org,
        asn: node.asn,
        asnOrg: node.asn_org,
        connectionType: node.connection_type || 'ipv4',
        status: node.status || 'pending',
        lastSeen: node.last_seen,
        firstSeen: node.first_seen || new Date().toISOString(),
        timesSeen: node.times_seen || 0,
        latencyMs: node.latency_ms,
        latencyAvg: node.latency_avg,
        uptime: node.uptime_percentage || node.uptime || 0,
        tier: node.tier || 'standard',
        pixScore: node.pix_score,
        rank: node.rank,
        isVerified: node.is_verified || false,
        tipsEnabled: node.tips_enabled || false,
        createdAt: node.created_at || new Date().toISOString(),
        updatedAt: node.updated_at || new Date().toISOString(),
        displayName: node.display_name,
        avatarUrl: node.avatar_url,
        isPublic: node.is_public ?? true,
        description: node.description || null,
        website: node.website || null,
        twitter: node.twitter || null,
        github: node.github || null,
        discord: node.discord || null,
        telegram: node.telegram || null,
      }));

      setNodes(transformedNodes);
    } catch (err: unknown) {
      // Extract meaningful error message from various error types
      let errorMessage = 'Failed to fetch nodes';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object') {
        // Handle Supabase PostgrestError which has message, details, hint, code properties
        const pgError = err as { message?: string; details?: string; hint?: string; code?: string };
        errorMessage = pgError.message || pgError.details || pgError.hint || 'Database query failed';
        if (pgError.code) {
          errorMessage += ` (code: ${pgError.code})`;
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching nodes:', errorMessage, err);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Auto-refresh: Poll for updates every 30 seconds (silent background refresh)
  useEffect(() => {
    // Initial fetch is handled by the fetchNodes useEffect above
    // Set up polling interval for auto-updates
    const interval = setInterval(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useNodes] Background refresh...');
      }
      fetchNodes(true); // Silent refresh - no loading flicker
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [fetchNodes]);

  return {
    nodes,
    isLoading,
    error,
    refetch: fetchNodes,
  };
}
