'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Server,
  Clock,
  Activity,
  Shield,
  Globe,
  Network,
  Zap,
  Calendar,
  TrendingUp,
  Award,
  Trophy,
  Wifi,
  Radio,
  ExternalLink,
  Copy,
  Check,
  Coins,
} from 'lucide-react';
import { getThemeConfig, getChainConfig } from '@atlasp2p/config';
import { formatServices, getServicesWithDescriptions } from '@/lib/services-decoder';
import { LatencyChart } from '@/components/nodes/LatencyChart';
import { ServicesBreakdown } from '@/components/nodes/ServicesBreakdown';
import { VerificationModal } from '@/components/verification/VerificationModal';
import { TipModal } from '@/components/nodes/TipModal';
import type { NodeWithProfile } from '@atlasp2p/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Build social media URLs from usernames
function buildSocialUrl(platform: 'twitter' | 'github' | 'discord' | 'telegram' | 'website', value: string): string {
  if (!value) return '';

  // Remove @ prefix if present
  const cleanValue = value.replace(/^@/, '');

  // If it's already a full URL, return as-is (with protocol)
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.includes('.') && value.includes('/')) {
    // Looks like a URL without protocol
    return `https://${value}`;
  }

  switch (platform) {
    case 'twitter':
      return `https://x.com/${cleanValue}`;
    case 'github':
      return `https://github.com/${cleanValue}`;
    case 'telegram':
      return `https://t.me/${cleanValue}`;
    case 'discord':
      // Discord usernames can't be linked directly, but we can try discord.com
      // If it's a server invite, it might be like "discord.gg/invite"
      if (cleanValue.includes('discord.gg') || cleanValue.includes('discord.com')) {
        return `https://${cleanValue}`;
      }
      // Just show as text, no link - or link to Discord app
      return `https://discord.com/users/${cleanValue}`;
    case 'website':
      return value.startsWith('http') ? value : `https://${value}`;
    default:
      return value;
  }
}

export default function NodePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const theme = getThemeConfig();
  const chainConfig = getChainConfig();
  const [node, setNode] = useState<NodeWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'1' | '7' | '30'>('7');
  const [copied, setCopied] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);

  const fetchNode = async () => {
    try {
      const response = await fetch(`/api/nodes/${id}`);
      if (!response.ok) {
        throw new Error('Node not found');
      }
      const data = await response.json();
      // API returns { node, uptimeHistory }
      setNode(data.node);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load node');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNode();
  }, [id]);

  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const response = await fetch(`/api/nodes/${id}/snapshots?period=${chartPeriod}`);
        if (response.ok) {
          const data = await response.json();
          setSnapshots(data);
        }
      } catch (err) {
        console.error('Failed to fetch snapshots:', err);
      }
    }

    if (id) {
      fetchSnapshots();
    }
  }, [id, chartPeriod]);

  const copyAddress = () => {
    if (node) {
      navigator.clipboard.writeText(`${node.ip}:${node.port}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64 mb-6"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="bg-destructive/10 border border-destructive text-destructive rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Node Not Found</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const services = node.services ? getServicesWithDescriptions(node.services) : [];
  const servicesFormatted = node.services ? formatServices(node.services) : 'None';
  const lastSeenDate = node.lastSeen ? new Date(node.lastSeen) : null;
  const firstSeenDate = node.firstSeen ? new Date(node.firstSeen) : null;

  const tierColors: Record<string, string> = {
    diamond: theme.tierColors?.diamond.color || '#00d4ff',
    gold: theme.tierColors?.gold.color || '#ffd700',
    silver: theme.tierColors?.silver.color || '#c0c0c0',
    bronze: theme.tierColors?.bronze.color || '#cd7f32',
    standard: theme.tierColors?.standard.color || theme.primaryColor,
  };

  const tierEmojis: Record<string, string> = {
    diamond: '💎',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
    standard: '⚪',
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-success';
    if (uptime >= 95) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Map
        </button>

        {/* Title Section */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {node.avatarUrl ? (
              <img
                src={node.avatarUrl}
                alt={node.displayName || 'Node avatar'}
                className="h-16 w-16 rounded-xl shadow-lg object-cover"
              />
            ) : (
              <div
                className="p-3 rounded-xl shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
                }}
              >
                <Server className="h-8 w-8 text-white" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">
                  {node.displayName || (node.ip && node.port ? `${node.ip}:${node.port}` : 'Unknown Node')}
                </h1>
                {node.ip && node.port && (
                  <button
                    onClick={copyAddress}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : (
                      <Copy className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
              {node.displayName && node.ip && node.port && (
                <p className="text-muted-foreground font-mono">{node.ip}:{node.port}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* Tier Badge */}
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-sm"
                  style={{
                    backgroundColor: `${tierColors[node.tier || 'standard']}20`,
                    color: tierColors[node.tier || 'standard'],
                    border: `2px solid ${tierColors[node.tier || 'standard']}40`,
                  }}
                >
                  {tierEmojis[node.tier || 'standard']} {(node.tier || 'standard').toUpperCase()}
                </span>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-sm ${
                    node.status === 'up'
                      ? 'bg-success/20 text-success border-2 border-success/40'
                      : node.status === 'reachable'
                      ? 'bg-warning/20 text-warning border-2 border-warning/40'
                      : 'bg-destructive/20 text-destructive border-2 border-destructive/40'
                  }`}
                >
                  <Wifi className="h-4 w-4" />
                  {(node.status || 'unknown').toUpperCase()}
                </span>

                {/* Verified Badge */}
                {node.isVerified && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-sm bg-green-500/20 text-green-600 dark:text-green-400 border-2 border-green-500/40">
                    <Shield className="h-4 w-4" />
                    Verified
                  </span>
                )}

                {/* Verify Button */}
                {!node.isVerified && (
                  <button
                    onClick={() => setShowVerifyModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    <Shield className="h-4 w-4" />
                    Verify Ownership
                  </button>
                )}

                {/* Tip Button */}
                {node.tipsEnabled && (
                  <button
                    onClick={() => setShowTipModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: theme.secondaryColor || theme.primaryColor }}
                  >
                    <Coins className="h-4 w-4" />
                    Send Tip
                  </button>
                )}

                {/* Rank Badge - only show if rank is a positive number */}
                {node.rank !== null && node.rank !== undefined && node.rank > 0 && (
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-sm"
                    style={{
                      backgroundColor: `${theme.primaryColor}20`,
                      color: theme.primaryColor,
                      border: `2px solid ${theme.primaryColor}40`,
                    }}
                  >
                    <Trophy className="h-4 w-4" />
                    #{node.rank}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {node.description && (
            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="text-muted-foreground">{node.description}</p>
            </div>
          )}
        </div>

        {/* Stats Grid - auto-fit ensures items expand when fewer than 4 */}
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {/* Uptime */}
          {node.uptime !== null && node.uptime !== undefined && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <h3 className="text-sm font-medium text-muted-foreground">Uptime</h3>
              </div>
              <p className={`text-3xl font-bold ${getUptimeColor(node.uptime)}`}>
                {node.uptime.toFixed(2)}%
              </p>
            </div>
          )}

          {/* Average Latency */}
          {node.latencyAvg !== null && node.latencyAvg !== undefined && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <h3 className="text-sm font-medium text-muted-foreground">Avg Latency</h3>
              </div>
              <p className="text-3xl font-bold">{node.latencyAvg.toFixed(0)}ms</p>
            </div>
          )}

          {/* PIX Score */}
          {node.pixScore !== null && node.pixScore !== undefined && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <h3 className="text-sm font-medium text-muted-foreground">PIX Score</h3>
              </div>
              <p className="text-3xl font-bold" style={{ color: theme.primaryColor }}>
                {node.pixScore.toFixed(1)}
              </p>
            </div>
          )}

          {/* Times Seen */}
          {node.timesSeen !== null && node.timesSeen !== undefined && node.timesSeen > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Award className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <h3 className="text-sm font-medium text-muted-foreground">Times Seen</h3>
              </div>
              <p className="text-3xl font-bold">{node.timesSeen.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Latency Chart */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Performance History</h2>
            <div className="flex gap-2">
              {(['1', '7', '30'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    chartPeriod === period
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  style={chartPeriod === period ? { backgroundColor: theme.primaryColor } : {}}
                >
                  {period === '1' ? '24h' : `${period}d`}
                </button>
              ))}
            </div>
          </div>
          <LatencyChart snapshots={snapshots} period={chartPeriod} />
        </div>

        {/* Services Breakdown */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <ServicesBreakdown services={node.services} />
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Network Information */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Network className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Network Information
            </h2>
            <div className="space-y-4">
              {node.version && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Version</p>
                  <p className="font-mono font-medium">{node.version}</p>
                </div>
              )}
              {node.protocolVersion && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Protocol Version</p>
                  <p className="font-mono font-medium">{node.protocolVersion}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Services</p>
                <p className="font-mono text-sm">{servicesFormatted}</p>
                {services.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {services.map((service) => (
                      <li key={service.name} className="text-xs text-muted-foreground flex items-center gap-2">
                        <Radio className="h-3 w-3" />
                        {service.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {node.startHeight && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Block Height</p>
                  <p className="font-mono font-medium">{node.startHeight.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Location Information
            </h2>
            <div className="space-y-4">
              {node.countryName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Country</p>
                  <p className="font-medium">
                    {node.countryCode && node.countryCode.length === 2 && `${String.fromCodePoint(...node.countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)))} `}
                    {node.countryName}
                  </p>
                </div>
              )}
              {node.city && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">City</p>
                  <p className="font-medium">{node.city}</p>
                </div>
              )}
              {node.isp && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ISP</p>
                  <p className="font-medium">{node.isp}</p>
                </div>
              )}
              {node.asn && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ASN</p>
                  <p className="font-mono font-medium">{node.asn}</p>
                </div>
              )}
              {(node.latitude !== null && node.latitude !== undefined && node.longitude !== null && node.longitude !== undefined) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Coordinates</p>
                  <p className="font-mono text-sm">
                    {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Timeline
            </h2>
            <div className="space-y-4">
              {firstSeenDate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">First Seen</p>
                  <p className="font-medium">{firstSeenDate.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.floor((Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24))} days ago
                  </p>
                </div>
              )}
              {lastSeenDate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Last Seen</p>
                  <p className="font-medium">{lastSeenDate.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.floor((Date.now() - lastSeenDate.getTime()) / 1000 / 60)} minutes ago
                  </p>
                </div>
              )}
              {node.timesSeen !== null && node.timesSeen !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Times Seen</p>
                  <p className="font-medium">{node.timesSeen.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          {(node.website || node.github || node.twitter || node.discord || node.telegram) && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Links
              </h2>
              <div className="space-y-3">
                {node.website && (
                  <a
                    href={buildSocialUrl('website', node.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {node.website}
                  </a>
                )}
                {node.github && (
                  <a
                    href={buildSocialUrl('github', node.github)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    GitHub: {node.github.replace(/^@/, '')}
                  </a>
                )}
                {node.twitter && (
                  <a
                    href={buildSocialUrl('twitter', node.twitter)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    X: @{node.twitter.replace(/^@/, '')}
                  </a>
                )}
                {node.discord && (
                  <a
                    href={buildSocialUrl('discord', node.discord)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Discord: {node.discord}
                  </a>
                )}
                {node.telegram && (
                  <a
                    href={buildSocialUrl('telegram', node.telegram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Telegram: @{node.telegram.replace(/^@/, '')}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {node && (
        <VerificationModal
          nodeId={node.id}
          nodeIp={node.ip}
          nodePort={node.port}
          isOpen={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
          onSuccess={() => {
            setShowVerifyModal(false);
            // Refresh node data to show verified status
            fetchNode();
          }}
        />
      )}

      {/* Tip Modal */}
      {node && (
        <TipModal
          nodeId={node.id}
          nodeName={node.displayName || node.address}
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}
