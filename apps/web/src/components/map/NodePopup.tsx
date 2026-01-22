'use client';

import Link from 'next/link';
import {
  MapPin,
  Server,
  Clock,
  Activity,
  Shield,
  ExternalLink,
  Coins,
  Twitter,
  Globe,
  Github,
  MessageCircle,
} from 'lucide-react';
import { getChainConfig, getMarkerCategories } from '@atlasp2p/config';
import type { NodeWithProfile } from '@atlasp2p/types';
import { getThemeConfig } from '@/config';

interface NodePopupProps {
  node: NodeWithProfile;
}

export function NodePopup({ node }: NodePopupProps) {
  const markerCategories = getMarkerCategories();
  const category = markerCategories[node.tier];
  const theme = getThemeConfig();
  const lastSeenDate = node.lastSeen ? new Date(node.lastSeen) : null;
  const firstSeenDate = new Date(node.firstSeen);

  // Tier-specific gradients using CSS custom properties
  const tierGradients: Record<string, string> = {
    diamond: 'linear-gradient(135deg, hsl(var(--chart-1)) 0%, hsl(var(--chart-2)) 100%)',
    gold: 'linear-gradient(135deg, hsl(var(--warning)) 0%, hsl(var(--warning) / 0.8) 100%)',
    silver: 'linear-gradient(135deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground) / 0.7) 100%)',
    bronze: 'linear-gradient(135deg, hsl(var(--chart-3)) 0%, hsl(var(--chart-4)) 100%)',
    standard: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
  };

  const tierColors: Record<string, string> = {
    diamond: 'hsl(var(--chart-1))',
    gold: 'hsl(var(--warning))',
    silver: 'hsl(var(--muted-foreground))',
    bronze: 'hsl(var(--chart-3))',
    standard: theme.primaryColor,
  };

  // Calculate uptime bar color using semantic tokens
  const getUptimeColor = () => {
    if (node.uptime > 95) return 'hsl(var(--success))';
    if (node.uptime > 80) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };
  const uptimeColor = getUptimeColor();

  return (
    <div className="w-[280px] sm:min-w-[320px] sm:max-w-[380px] overflow-hidden rounded-lg shadow-xl">
      {/* Tier-specific header with gradient */}
      <div
        className="p-4 text-white relative overflow-hidden"
        style={{
          background: tierGradients[node.tier],
          boxShadow: `0 4px 20px ${tierColors[node.tier]}40`,
        }}
      >
        <div className="relative z-10 flex items-start gap-3">
          {/* Avatar for verified nodes */}
          {node.isVerified && node.avatarUrl && (
            <div className="flex-shrink-0">
              <img
                src={node.avatarUrl}
                alt={node.displayName || 'Node avatar'}
                className="w-14 h-14 rounded-full border-3 border-white shadow-lg object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Tier badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm">
                {node.tier === 'diamond' ? '💎' : node.tier === 'gold' ? '🥇' : node.tier === 'silver' ? '🥈' : node.tier === 'bronze' ? '🥉' : '⚡'} {category?.name || 'Standard'}
              </span>
              {node.isVerified && (
                <span className="flex items-center gap-1 text-xs bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Shield className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>

            {/* Display name or address */}
            <h3 className="font-bold text-base mb-1 truncate drop-shadow-lg">
              {node.displayName || node.address}
            </h3>

            {/* Location */}
            <div className="flex items-center gap-1 text-xs opacity-90">
              <MapPin className="h-3 w-3" />
              <span>
                {node.city && `${node.city}, `}
                {node.countryName || node.countryCode || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Decorative pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
      </div>

      {/* Content */}
      <div className="p-4 bg-card space-y-3">
        {/* Description for verified nodes */}
        {node.isVerified && node.description && (
          <p className="text-sm text-muted-foreground italic">
            "{node.description}"
          </p>
        )}

        {/* Performance metrics */}
        <div className="grid grid-cols-2 gap-3">
          {/* Uptime */}
          <div>
            <div className="flex items-center justify-between text-sm font-medium text-foreground mb-1">
              <span className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Uptime
              </span>
              <span className="font-bold text-base" style={{ color: uptimeColor }}>
                {node.uptime?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${node.uptime || 0}%`,
                  background: uptimeColor,
                }}
              />
            </div>
          </div>

          {/* Latency */}
          <div>
            <div className="flex items-center justify-between text-sm font-medium text-foreground mb-1">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Latency
              </span>
              <span className="font-bold text-base text-primary">
                {node.latencyAvg ? `${node.latencyAvg.toFixed(0)}ms` : 'N/A'}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.max(0, 100 - (node.latencyAvg || 0) / 5)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Rank & PIX Score */}
        {(node.rank || node.pixScore) && (
          <div className="flex items-center gap-3 mb-3 p-2 bg-muted/50 rounded-lg">
            {node.rank && (
              <div className="flex-1 text-center">
                <div className="text-xs text-muted-foreground">Rank</div>
                <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                  #{node.rank}
                </div>
              </div>
            )}
            {node.pixScore && (
              <div className="flex-1 text-center">
                <div className="text-xs text-muted-foreground">PIX Score</div>
                <div className="text-lg font-bold text-foreground">
                  {node.pixScore.toFixed(0)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Version info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span className="font-mono text-xs">
            {node.clientVersion || node.version || 'Unknown'} • Protocol {node.protocolVersion || 'N/A'}
          </span>
        </div>

        {/* Social links for verified nodes */}
        {node.isVerified && (node.website || node.twitter || node.github || node.discord) && (
          <div className="flex items-center gap-2 flex-wrap">
            {node.website && (
              <a
                href={node.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/60 hover:text-foreground rounded text-xs transition-colors"
              >
                <Globe className="h-4 w-4" />
                Website
              </a>
            )}
            {node.twitter && (
              <a
                href={`https://twitter.com/${node.twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/60 hover:text-foreground rounded text-xs transition-colors"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </a>
            )}
            {node.github && (
              <a
                href={`https://github.com/${node.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/60 hover:text-foreground rounded text-xs transition-colors"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            )}
            {node.discord && (
              <a
                href={node.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/60 hover:text-foreground rounded text-xs transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Discord
              </a>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="text-sm text-muted-foreground space-y-1 border-t border-border pt-2">
          {lastSeenDate && (
            <div>Last seen: {lastSeenDate.toLocaleString()}</div>
          )}
          <div>First seen: {firstSeenDate.toLocaleDateString()}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/node/${node.id}`}
            className="flex-1 text-center py-2 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View Details
          </Link>
          {node.tipsEnabled && (
            <button
              className="flex items-center gap-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
                color: 'white',
              }}
            >
              <Coins className="h-4 w-4" />
              Tip Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
