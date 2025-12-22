'use client';

import { useState, useMemo } from 'react';
import { TipModal } from './TipModal';
import {
  X,
  MapPin,
  Server,
  Clock,
  Activity,
  Shield,
  Globe,
  Network,
  Zap,
  Calendar,
  Copy,
  ExternalLink,
  Coins,
  TrendingUp,
  Wifi,
  Layers,
  Radio,
} from 'lucide-react';
import { getChainConfig, getThemeConfig, getMarkerCategories } from '@atlasp2p/config';
import { decodeServices, formatServices, getServicesWithDescriptions } from '@/lib/services-decoder';
import type { NodeWithProfile } from '@atlasp2p/types';


interface NodeDetailModalProps {
  node: NodeWithProfile;
  isOpen: boolean;
  onClose: () => void;
}

export function NodeDetailModal({
  node,
  isOpen,
  onClose,
}: NodeDetailModalProps) {
  const theme = getThemeConfig();
  const chainConfig = getChainConfig();
  const markerCategories = getMarkerCategories();
  const [copied, setCopied] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const category = markerCategories[node.tier];

  if (!isOpen) return null;

  const lastSeenDate = node.lastSeen ? new Date(node.lastSeen) : null;
  const firstSeenDate = new Date(node.firstSeen);
  const daysSinceFirstSeen = Math.floor(
    (Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Decode services
  const services = useMemo(() => getServicesWithDescriptions(node.services), [node.services]);
  const servicesFormatted = formatServices(node.services);

  // Calculate connection duration
  const connectionDuration = useMemo(() => {
    const diffMs = Date.now() - firstSeenDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
  }, [firstSeenDate]);

  // Calculate block height sync percentage (approximation based on time)
  // Note: Block time varies by chain. Default 60s works for many altcoins.
  const blockSyncPercentage = useMemo(() => {
    if (!node.startHeight) return null;

    // Estimate current network height based on first seen date
    // TODO: Make configurable via chain config (60s default for altcoins)
    const blockTimeSeconds = 60;
    const secondsSinceFirstSeen = (Date.now() - firstSeenDate.getTime()) / 1000;
    const estimatedBlocksSinceFirstSeen = Math.floor(secondsSinceFirstSeen / blockTimeSeconds);
    const estimatedCurrentHeight = node.startHeight + estimatedBlocksSinceFirstSeen;

    // Calculate percentage (if node is at reported height)
    const percentage = (node.startHeight / estimatedCurrentHeight) * 100;

    // Clamp to reasonable range (shouldn't exceed 100%)
    return Math.min(percentage, 100);
  }, [node.startHeight, firstSeenDate]);

  const tierColors: Record<string, string> = {
    diamond: 'bg-chart-1 text-white',
    gold: 'bg-warning text-white',
    silver: 'bg-muted-foreground text-white',
    bronze: 'bg-chart-3 text-white',
    standard: 'bg-primary text-white',
  };

  const tierEmojis: Record<string, string> = {
    diamond: '💎',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
    standard: '⚡',
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'bg-success';
      case 'reachable':
        return 'bg-warning';
      case 'down':
        return 'bg-destructive';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'up':
        return 'ONLINE';
      case 'reachable':
        return 'REACHABLE';
      case 'down':
        return 'OFFLINE';
      default:
        return 'PENDING';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'text-success';
      case 'reachable':
        return 'text-warning';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-success';
    if (uptime >= 95) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-border"
          style={{
            background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{tierEmojis[node.tier]}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${tierColors[node.tier]}`}
                    >
                      {category?.name || 'Standard Node'}
                    </span>
                    {node.isVerified && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                        <Shield className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                    <span
                      className={`h-2 w-2 rounded-full ${getStatusColor(node.status)}`}
                      title={`Status: ${node.status}`}
                    />
                  </div>
                  {node.displayName ? (
                    <div>
                      <h2 className="text-2xl font-bold">{node.displayName}</h2>
                      <p className="text-sm text-muted-foreground font-mono">
                        {node.address}
                      </p>
                    </div>
                  ) : (
                    <h2 className="text-xl font-bold font-mono">
                      {node.address}
                    </h2>
                  )}
                </div>
              </div>

              {/* Connection Status - Bitnodes style */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wide ${getStatusTextColor(node.status)}`}>
                    {getStatusLabel(node.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">-</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {node.status === 'reachable' ? 'TCP only (handshake failed)' : `Connected since ${connectionDuration}`}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Connection Details
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    IP Address
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{node.ip}</span>
                    <button
                      onClick={() => copyToClipboard(node.ip)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Copy IP"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Port</span>
                  <span className="font-mono font-medium">{node.port}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Connection Type
                  </span>
                  <span className="uppercase text-xs font-semibold px-2 py-1 bg-background rounded">
                    {node.connectionType}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    User Agent
                  </span>
                  <span className="text-sm font-mono truncate max-w-[180px]" title={node.version || 'N/A'}>
                    {node.version || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Version Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Server className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Version Information
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Client Version
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {node.clientVersion || 'Unknown'}
                    </span>
                    {node.isCurrentVersion && (
                      <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Protocol Version
                  </span>
                  <span className="font-medium">
                    {node.protocolVersion || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Client Name
                  </span>
                  <span className="font-medium">
                    {node.clientName || chainConfig.name}
                  </span>
                </div>
                {node.startHeight && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Block Height
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">
                        {node.startHeight.toLocaleString()}
                      </span>
                      {blockSyncPercentage !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          blockSyncPercentage >= 99.9
                            ? 'bg-success/10 text-success'
                            : blockSyncPercentage >= 95
                            ? 'bg-warning/10 text-warning'
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          ({blockSyncPercentage.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Services
                  </span>
                  <span className="font-mono text-xs" title={servicesFormatted}>
                    {servicesFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Location Details
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Country</span>
                  <div className="flex items-center gap-2">
                    {node.countryCode && (
                      <span className="text-2xl">
                        {String.fromCodePoint(
                          ...[...node.countryCode.toUpperCase()].map(
                            (char) => 127397 + char.charCodeAt(0)
                          )
                        )}
                      </span>
                    )}
                    <span className="font-medium">
                      {node.countryName || node.countryCode || 'Unknown'}
                    </span>
                  </div>
                </div>
                {node.city && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">City</span>
                    <span className="font-medium">{node.city}</span>
                  </div>
                )}
                {node.region && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Region
                    </span>
                    <span className="font-medium">{node.region}</span>
                  </div>
                )}
                {node.timezone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Timezone
                    </span>
                    <span className="text-sm font-mono">{node.timezone}</span>
                  </div>
                )}
                {node.isp && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ISP</span>
                    <span className="text-sm truncate max-w-[180px]" title={node.isp}>
                      {node.isp}
                    </span>
                  </div>
                )}
                {(node.asn || node.asnOrg) && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <span className="text-sm text-right max-w-[200px] truncate" title={node.asnOrg ? `${node.asnOrg} (AS${node.asn})` : `AS${node.asn}`}>
                      {node.asnOrg ? (
                        <>{node.asnOrg} <span className="font-mono text-xs text-muted-foreground">(AS{node.asn})</span></>
                      ) : (
                        <span className="font-mono">AS{node.asn}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Performance Metrics
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Uptime Percentage
                  </span>
                  <span className={`font-bold text-lg ${getUptimeColor(node.uptime)}`}>
                    {node.uptime.toFixed(2)}%
                  </span>
                </div>
                {node.latencyAvg !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Average Latency
                    </span>
                    <span className="font-semibold flex items-center gap-1">
                      <Zap className="h-4 w-4 text-warning" />
                      {node.latencyAvg.toFixed(0)}ms
                    </span>
                  </div>
                )}
                {node.latencyMs !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Current Latency
                    </span>
                    <span className="font-medium">{node.latencyMs}ms</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Times Seen
                  </span>
                  <span className="font-medium">
                    {node.timesSeen.toLocaleString()}
                  </span>
                </div>
                {node.pixScore !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      PIX Score
                    </span>
                    <span className="font-bold text-lg" style={{ color: theme.primaryColor }}>
                      {node.pixScore.toFixed(1)}
                    </span>
                  </div>
                )}
                {node.rank && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Network Rank
                    </span>
                    <span className="font-bold flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-success" />
                      #{node.rank}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Timeline
              </h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        First Seen
                      </span>
                    </div>
                    <p className="font-medium">
                      {firstSeenDate.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {daysSinceFirstSeen} days ago
                    </p>
                  </div>
                  {lastSeenDate && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Wifi className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Last Seen
                        </span>
                      </div>
                      <p className="font-medium">
                        {lastSeenDate.toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lastSeenDate.toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Status
                      </span>
                    </div>
                    <p className="font-medium capitalize">{node.status}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(node.updatedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => copyToClipboard(node.address)}
              className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            <a
              href={`${chainConfig.explorerUrl}/address/${node.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View in Explorer
            </a>
            {node.tipsEnabled && (
              <button
                onClick={() => setIsTipModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Coins className="h-4 w-4" />
                Send Tip
              </button>
            )}
            <div className="flex-1" />
            <a
              href={`/node/${node.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
            >
              <Globe className="h-4 w-4" />
              Full Profile
            </a>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      <TipModal
        nodeId={node.id}
        nodeName={node.displayName || node.address}
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
      />
    </div>
  );
}
