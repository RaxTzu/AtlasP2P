'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Server, Download, Search, Filter } from 'lucide-react';
import { NodesTable } from '@/components/tables/NodesTable';
import { useNodes } from '@/hooks/useNodes';
import { getChainConfig } from '@/config';
import type { NodeWithProfile } from '@atlasp2p/types';

type StatusFilter = 'all' | 'online' | 'reachable' | 'offline';

export default function NodesPage() {
  const router = useRouter();
  const chainConfig = getChainConfig();
  const { nodes, isLoading } = useNodes();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const handleNodeClick = (node: NodeWithProfile) => {
    // Navigate to node detail page
    router.push(`/node/${node.id}`);
  };

  // Filter nodes only - NodesTable handles pagination internally
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // Apply status filter
      if (statusFilter === 'online' && node.status !== 'up') return false;
      if (statusFilter === 'reachable' && node.status !== 'reachable') return false;
      if (statusFilter === 'offline' && node.status !== 'down') return false;

      // Apply search filter
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        node.ip.toLowerCase().includes(search) ||
        node.displayName?.toLowerCase().includes(search) ||
        node.version?.toLowerCase().includes(search) ||
        node.countryName?.toLowerCase().includes(search) ||
        node.city?.toLowerCase().includes(search)
      );
    });
  }, [nodes, statusFilter, searchTerm]);

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(filteredNodes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const ticker = chainConfig.ticker.toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    link.download = `${ticker}-nodes-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {chainConfig.name} Nodes
            </h1>
            <p className="text-muted-foreground">
              Complete list of reachable {chainConfig.ticker} network nodes
            </p>
          </div>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
            title="Export as JSON"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Export JSON</span>
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : filteredNodes.length}
                </p>
                <p className="text-xs text-muted-foreground">Total Nodes</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Server className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : nodes.filter(n => n.status === 'up').length}
                </p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Server className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : nodes.filter(n => n.status === 'reachable').length}
                </p>
                <p className="text-xs text-muted-foreground">Reachable</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-chart-1/10 rounded-lg">
                <Server className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : new Set(nodes.map(n => n.countryName).filter(Boolean)).size}
                </p>
                <p className="text-xs text-muted-foreground">Countries</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar and Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by IP, hostname, version, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex rounded-lg border border-border bg-card overflow-hidden">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('online')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                  statusFilter === 'online'
                    ? 'bg-success text-white'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Online
              </button>
              <button
                onClick={() => setStatusFilter('reachable')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                  statusFilter === 'reachable'
                    ? 'bg-warning text-white'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                title="TCP connects but P2P handshake fails"
              >
                Reachable
              </button>
              <button
                onClick={() => setStatusFilter('offline')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                  statusFilter === 'offline'
                    ? 'bg-destructive text-white'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Offline
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <NodesTable nodes={filteredNodes} onNodeClick={handleNodeClick} />
      )}

    </div>
  );
}
