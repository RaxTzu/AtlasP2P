'use client';

import { useState, useMemo } from 'react';
import {
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  List,
  MapPin,
  Activity,
  Shield,
} from 'lucide-react';
import { getChainConfig, getThemeConfig } from '@atlasp2p/config';
import type { NodeWithProfile, NodeTier } from '@atlasp2p/types';


interface NodeListSidebarProps {
  nodes: NodeWithProfile[];
  isOpen: boolean;
  onClose: () => void;
  onNodeClick: (node: NodeWithProfile) => void;
}

type SortField = 'address' | 'version' | 'country' | 'uptime' | 'tier' | 'latency' | 'status';
type SortOrder = 'asc' | 'desc';

export function NodeListSidebar({
  nodes,
  isOpen,
  onClose,
  onNodeClick,
}: NodeListSidebarProps) {
  const theme = getThemeConfig();
  const chainConfig = getChainConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('uptime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const tierOrder: Record<NodeTier, number> = {
    diamond: 5,
    gold: 4,
    silver: 3,
    bronze: 2,
    standard: 1,
  };

  const tierEmojis: Record<NodeTier, string> = {
    diamond: '💎',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
    standard: '⚡',
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedNodes = useMemo(() => {
    let filtered = nodes;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = nodes.filter(
        (node) =>
          node.address.toLowerCase().includes(query) ||
          node.ip.toLowerCase().includes(query) ||
          node.countryName?.toLowerCase().includes(query) ||
          node.city?.toLowerCase().includes(query) ||
          (node.clientVersion || node.version || '').toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'version':
          comparison = (a.clientVersion || a.version || '').localeCompare(
            b.clientVersion || b.version || ''
          );
          break;
        case 'country':
          comparison = (a.countryName || '').localeCompare(
            b.countryName || ''
          );
          break;
        case 'uptime':
          comparison = a.uptime - b.uptime;
          break;
        case 'tier':
          comparison = tierOrder[a.tier] - tierOrder[b.tier];
          break;
        case 'latency':
          comparison = (a.latencyAvg || 999999) - (b.latencyAvg || 999999);
          break;
        case 'status':
          // Online first ('up' = 1, 'down' = 0)
          comparison = (a.status === 'up' ? 1 : 0) - (b.status === 'up' ? 1 : 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [nodes, searchQuery, sortField, sortOrder]);

  const exportToCSV = () => {
    const headers = [
      'Address',
      'IP',
      'Port',
      'Version',
      'Country',
      'City',
      'Uptime',
      'Latency',
      'Tier',
      'Verified',
    ];

    const rows = filteredAndSortedNodes.map((node) => [
      node.address,
      node.ip,
      node.port,
      node.clientVersion || node.version || '',
      node.countryName || '',
      node.city || '',
      node.uptime.toFixed(2) + '%',
      node.latencyAvg?.toFixed(0) + 'ms' || 'N/A',
      node.tier,
      node.isVerified ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chainConfig.name.toLowerCase()}-nodes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks -- False positive: SortButton is a valid local component pattern
  const SortButton = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-semibold text-xs uppercase hover:text-primary transition-colors"
    >
      {label}
      {sortField === field &&
        (sortOrder === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  );

  // Helper to get version display string
  const getVersionDisplay = (node: NodeWithProfile) => {
    return node.clientVersion || node.version || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay - click to close */}
      <div
        className="fixed inset-0 z-[1499] bg-black/40 backdrop-blur-sm lg:bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed top-14 bottom-0 right-0 z-[1500] w-full sm:w-[400px] md:w-[500px] lg:w-[600px] bg-card shadow-2xl border-l border-border flex flex-col">
      {/* Header */}
      <div
        className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <List className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: theme.primaryColor }} />
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Node List</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {filteredAndSortedNodes.length} of {nodes.length} nodes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search and Export */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            style={{ backgroundColor: theme.primaryColor }}
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Sort options - Mobile friendly */}
      <div className="px-4 sm:px-6 py-2 border-b border-border bg-muted/30 flex items-center gap-2 overflow-x-auto scrollbar-thin">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Sort:</span>
        <SortButton field="status" label="Status" />
        <SortButton field="tier" label="Tier" />
        <SortButton field="uptime" label="Uptime" />
        <SortButton field="latency" label="Latency" />
        <SortButton field="country" label="Country" />
      </div>

      {/* Node List - Card based for mobile */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredAndSortedNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center p-4">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No nodes found</p>
              <p className="text-sm">Try adjusting your search</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAndSortedNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => onNodeClick(node)}
                className="px-4 sm:px-6 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                {/* Mobile-friendly card layout */}
                <div className="flex items-start gap-3">
                  {/* Tier icon */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    <span className="text-xl" title={`${node.tier} tier`}>
                      {tierEmojis[node.tier]}
                    </span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name/IP + Status */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        {node.displayName ? (
                          <p className="font-medium text-sm truncate">{node.displayName}</p>
                        ) : (
                          <p className="font-mono text-sm truncate">{node.ip}:{node.port}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {node.isVerified && (
                          <Shield className="h-3.5 w-3.5 text-success" />
                        )}
                        <span className={`w-2 h-2 rounded-full ${node.status === 'up' ? 'bg-success' : 'bg-destructive'}`} />
                      </div>
                    </div>

                    {/* Row 2: IP (if has display name) */}
                    {node.displayName && (
                      <p className="text-xs text-muted-foreground font-mono truncate mb-1">
                        {node.ip}:{node.port}
                      </p>
                    )}

                    {/* Row 3: Meta info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {/* Country */}
                      {node.countryCode && (
                        <span className="flex items-center gap-1">
                          <span>
                            {String.fromCodePoint(
                              ...[...node.countryCode.toUpperCase()].map(
                                (char) => 127397 + char.charCodeAt(0)
                              )
                            )}
                          </span>
                          <span className="truncate max-w-[80px]">
                            {node.city || node.countryCode}
                          </span>
                        </span>
                      )}

                      {/* Version */}
                      <span className="font-mono flex items-center gap-1">
                        v{getVersionDisplay(node).replace(/^.*?(\d)/, '$1').split('/')[0] || '?'}
                        {node.isCurrentVersion && (
                          <span className="text-[9px] px-1 py-0.5 bg-success/10 text-success rounded">
                            Latest
                          </span>
                        )}
                      </span>

                      {/* Uptime */}
                      <span className="flex items-center gap-1">
                        <Activity
                          className={`h-3 w-3 ${
                            node.uptime >= 99
                              ? 'text-success'
                              : node.uptime >= 95
                                ? 'text-warning'
                                : 'text-destructive'
                          }`}
                        />
                        {node.uptime.toFixed(0)}%
                      </span>

                      {/* Latency */}
                      {node.latencyAvg && (
                        <span className="font-mono">
                          {node.latencyAvg.toFixed(0)}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-3 border-t border-border bg-muted/30">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Online</p>
            <p className="font-bold text-success">
              {nodes.filter((n) => n.status === 'up').length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Verified</p>
            <p className="font-bold text-primary">
              {nodes.filter((n) => n.isVerified).length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Avg Uptime</p>
            <p className="font-bold" style={{ color: theme.primaryColor }}>
              {nodes.length > 0
                ? (
                    nodes.reduce((sum, n) => sum + n.uptime, 0) / nodes.length
                  ).toFixed(1)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
