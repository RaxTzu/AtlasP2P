'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Server,
  ExternalLink,
  Settings,
  MapPin,
  Clock,
  Zap,
  ShieldCheck,
  Plus,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { getThemeConfig } from '@/config';

export const dynamic = 'force-dynamic';

interface VerifiedNode {
  id: string;
  node_id: string;
  user_id: string;
  verified_at: string;
  verification_method: string;
  node?: {
    id: string;
    ip: string;
    port: number;
    status: string;
    version: string;
    country_name: string;
    city: string;
    latency_avg: number;
    uptime_percent: number;
    tier: string;
    pix_score: number;
  };
  profile?: {
    display_name: string;
    description: string;
    avatar_url: string;
    is_public: boolean;
  };
}

export default function MyNodesPage() {
  const theme = getThemeConfig();
  const router = useRouter();
  const [nodes, setNodes] = useState<VerifiedNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyNodes();
  }, []);

  const fetchMyNodes = async () => {
    try {
      const response = await fetch('/api/my-nodes');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth?redirectTo=/manage/nodes');
          return;
        }
        throw new Error('Failed to fetch nodes');
      }

      const data = await response.json();

      // Transform API response to match our interface
      const transformedNodes: VerifiedNode[] = (data.nodes || []).map((node: any) => ({
        id: node.id,
        node_id: node.id,
        user_id: '', // Not needed for display
        verified_at: node.verifiedAt || '',
        verification_method: node.verificationMethod || '',
        node: {
          id: node.id,
          ip: node.ip,
          port: node.port,
          status: node.status,
          version: node.version,
          country_name: node.countryName,
          city: node.city,
          latency_avg: node.latencyAvg,
          uptime_percent: node.uptime,
          tier: node.tier,
          pix_score: node.pixScore
        },
        profile: node.displayName || node.avatarUrl ? {
          display_name: node.displayName,
          description: node.description,
          avatar_url: node.avatarUrl,
          is_public: node.isPublic
        } : null
      }));

      setNodes(transformedNodes);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case 'diamond': return '#a855f7';
      case 'gold': return '#eab308';
      case 'silver': return '#94a3b8';
      case 'bronze': return '#cd7c32';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.primaryColor }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Nodes</h1>
          <p className="text-muted-foreground">
            Nodes you have verified ownership of
          </p>
        </div>
        <button
          onClick={() => router.push('/nodes')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <Plus className="h-4 w-4" />
          Verify New Node
        </button>
      </div>

      {/* Nodes List */}
      {nodes.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 text-center">
          <Server className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No Verified Nodes</h2>
          <p className="text-muted-foreground mb-6">
            You haven't verified any nodes yet. Verify a node to manage it here.
          </p>
          <button
            onClick={() => router.push('/nodes')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all duration-200 hover:shadow-lg"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <ShieldCheck className="h-5 w-5" />
            Verify Your First Node
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {nodes.map((vn) => (
            <div
              key={vn.id}
              className="glass-strong rounded-xl p-6 hover:shadow-lg transition-all duration-200"
            >
              {/* Node Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {vn.profile?.avatar_url ? (
                    <img
                      src={vn.profile.avatar_url}
                      alt="Node avatar"
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${theme.primaryColor}20` }}
                    >
                      <Server className="h-6 w-6" style={{ color: theme.primaryColor }} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {vn.profile?.display_name || (vn.node ? `${vn.node.ip}:${vn.node.port}` : 'Node Unavailable')}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {!vn.node ? (
                        <>
                          <XCircle className="h-4 w-4 text-yellow-500" />
                          <span>Node not found</span>
                        </>
                      ) : vn.node.status === 'up' ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Online</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>Offline</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {vn.node?.tier && (
                  <span
                    className="px-2.5 py-1 text-xs font-bold rounded-full uppercase"
                    style={{
                      backgroundColor: `${getTierColor(vn.node.tier)}20`,
                      color: getTierColor(vn.node.tier)
                    }}
                  >
                    {vn.node.tier}
                  </span>
                )}
              </div>

              {/* Node Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    Location
                  </div>
                  <p className="text-sm font-medium truncate">
                    {vn.node?.city || vn.node?.country_name || 'Unknown'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Zap className="h-3 w-3" />
                    Latency
                  </div>
                  <p className="text-sm font-medium">
                    {vn.node?.latency_avg?.toFixed(0) || '—'}ms
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock className="h-3 w-3" />
                    Uptime
                  </div>
                  <p className="text-sm font-medium">
                    {vn.node?.uptime_percent?.toFixed(1) || '—'}%
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/node/${vn.node_id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Details
                </button>
                <button
                  onClick={() => router.push(`/my-nodes/${vn.node_id}/edit`)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white transition-colors"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <Settings className="h-4 w-4" />
                  Edit Profile
                </button>
              </div>

              {/* Verified Badge */}
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                Verified {new Date(vn.verified_at).toLocaleDateString()} via {vn.verification_method}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
