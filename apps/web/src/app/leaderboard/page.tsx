'use client';

import { Trophy, Medal, Award, Shield, Crown, Star, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getThemeConfig } from '@/config';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useNodes } from '@/hooks/useNodes';
import type { NodeWithProfile } from '@atlasp2p/types';

// Format PIX score to 2 decimal places
const formatPixScore = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return '0.00';
  return score.toFixed(2);
};

const TIER_COLORS: Record<string, string> = {
  diamond: '#06b6d4',
  gold: '#f59e0b',
  silver: '#94a3b8',
  bronze: '#f97316',
  standard: '#6b7280',
};

// Tier icon components
const TierIcon = ({ tier }: { tier: string }) => {
  const iconClass = "h-3.5 w-3.5";
  switch (tier) {
    case 'diamond':
      return <Star className={iconClass} fill="currentColor" />;
    case 'gold':
      return <Crown className={iconClass} fill="currentColor" />;
    case 'silver':
      return <Medal className={iconClass} />;
    case 'bronze':
      return <Award className={iconClass} />;
    default:
      return <Circle className={iconClass} />;
  }
};

const ITEMS_PER_PAGE = 50;

export default function LeaderboardPage() {
  const theme = getThemeConfig();
  const { nodes, isLoading } = useNodes();
  const [sortBy, setSortBy] = useState<'pix' | 'uptime' | 'latency'>('pix');
  const [currentPage, setCurrentPage] = useState(1);

  // Sort and paginate - ALWAYS show podium, paginate the rest
  const { sortedNodes, podiumNodes, paginatedNodes, totalPages } = useMemo(() => {
    // Filter and sort nodes
    const sorted = [...nodes]
      .filter(node => node.status === 'up') // Only online nodes in leaderboard
      .sort((a, b) => {
        switch (sortBy) {
          case 'uptime':
            return (b.uptime || 0) - (a.uptime || 0);
          case 'latency':
            return (a.latencyAvg || Infinity) - (b.latencyAvg || Infinity);
          default: // 'pix'
            return (b.pixScore || 0) - (a.pixScore || 0);
        }
      });

    // Top 3 for podium (always shown)
    const podium = sorted.slice(0, 3);

    // Remaining nodes after top 3
    const remaining = sorted.slice(3);

    // Paginate the remaining nodes (NOT including podium)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = remaining.slice(startIndex, endIndex);

    // Total pages based on remaining nodes
    const total = Math.max(1, Math.ceil(remaining.length / ITEMS_PER_PAGE));

    return {
      sortedNodes: sorted,
      podiumNodes: podium,
      paginatedNodes: paginated,
      totalPages: total
    };
  }, [nodes, sortBy, currentPage]);

  const getCountryFlag = (countryCode: string | null) => {
    if (!countryCode || countryCode.length !== 2) return '';
    return String.fromCodePoint(
      ...countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
    );
  };

  const renderPodium = () => {
    if (podiumNodes.length < 3) return null;

    const [first, second, third] = podiumNodes;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 max-w-4xl mx-auto">
        {/* Second Place */}
        <div className="sm:pt-12 order-2 sm:order-1">
          <div className="bg-card border-2 border-border rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Medal className="h-12 w-12 sm:h-14 sm:w-14 text-[#94a3b8]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">2</div>
              <Link href={`/node/${second.id}`} className="block hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {second.avatarUrl && (
                    <img src={second.avatarUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                  )}
                  <span className="text-sm font-medium truncate max-w-[120px] text-foreground" title={second.displayName || second.ip}>
                    {second.displayName || second.ip}
                  </span>
                  {second.isVerified && <Shield className="h-3 w-3 text-success flex-shrink-0" />}
                </div>
              </Link>
              <div className="text-xs text-muted-foreground">
                {getCountryFlag(second.countryCode)} {second.countryCode || 'Unknown'}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{
                  backgroundColor: `${TIER_COLORS[second.tier || 'standard']}20`,
                  color: TIER_COLORS[second.tier || 'standard']
                }}>
                  <TierIcon tier={second.tier || 'standard'} />
                  {(second.tier || 'standard').toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-xl sm:text-2xl font-bold" style={{ color: theme.primaryColor }}>
                {formatPixScore(second.pixScore)}
              </div>
              <div className="text-xs text-muted-foreground">PIX Score</div>
            </div>
          </div>
        </div>

        {/* First Place */}
        <div className="order-1 sm:order-2">
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-4 sm:p-6 shadow-2xl sm:transform sm:scale-110 hover:shadow-3xl transition-shadow">
            <div className="text-center text-white">
              <div className="flex justify-center mb-2">
                <Trophy className="h-14 w-14 sm:h-16 sm:w-16 text-white" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold mb-2">1</div>
              <Link href={`/node/${first.id}`} className="block hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {first.avatarUrl && (
                    <img src={first.avatarUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                  )}
                  <span className="text-sm font-medium truncate max-w-[120px]" title={first.displayName || first.ip}>
                    {first.displayName || first.ip}
                  </span>
                  {first.isVerified && <Shield className="h-3 w-3 text-white/80 flex-shrink-0" />}
                </div>
              </Link>
              <div className="text-xs opacity-90">
                {getCountryFlag(first.countryCode)} {first.countryCode || 'Unknown'}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <TierIcon tier={first.tier || 'standard'} />
                  {(first.tier || 'standard').toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold">
                {formatPixScore(first.pixScore)}
              </div>
              <div className="text-xs opacity-90">PIX Score</div>
            </div>
          </div>
        </div>

        {/* Third Place */}
        <div className="sm:pt-12 order-3">
          <div className="bg-card border-2 border-border rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Award className="h-12 w-12 sm:h-14 sm:w-14 text-[#f97316]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">3</div>
              <Link href={`/node/${third.id}`} className="block hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {third.avatarUrl && (
                    <img src={third.avatarUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                  )}
                  <span className="text-sm font-medium truncate max-w-[120px] text-foreground" title={third.displayName || third.ip}>
                    {third.displayName || third.ip}
                  </span>
                  {third.isVerified && <Shield className="h-3 w-3 text-success flex-shrink-0" />}
                </div>
              </Link>
              <div className="text-xs text-muted-foreground">
                {getCountryFlag(third.countryCode)} {third.countryCode || 'Unknown'}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{
                  backgroundColor: `${TIER_COLORS[third.tier || 'standard']}20`,
                  color: TIER_COLORS[third.tier || 'standard']
                }}>
                  <TierIcon tier={third.tier || 'standard'} />
                  {(third.tier || 'standard').toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-xl sm:text-2xl font-bold" style={{ color: theme.primaryColor }}>
                {formatPixScore(third.pixScore)}
              </div>
              <div className="text-xs text-muted-foreground">PIX Score</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primaryColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl shadow-lg" style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              boxShadow: `0 10px 25px -5px ${theme.primaryColor}40`
            }}>
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">
            Top nodes ranked by PIX score, uptime, and performance
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSortBy('pix')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === 'pix'
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            style={sortBy === 'pix' ? { backgroundColor: theme.primaryColor } : {}}
          >
            PIX Score
          </button>
          <button
            onClick={() => setSortBy('uptime')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === 'uptime'
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            style={sortBy === 'uptime' ? { backgroundColor: theme.primaryColor } : {}}
          >
            Uptime
          </button>
          <button
            onClick={() => setSortBy('latency')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === 'latency'
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            style={sortBy === 'latency' ? { backgroundColor: theme.primaryColor } : {}}
          >
            Latency
          </button>
        </div>

        {/* Podium (always shown for top 3) */}
        {renderPodium()}

        {/* Leaderboard Table */}
        <div className="glass-strong rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Node</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">PIX Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Uptime</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedNodes.map((node, idx) => {
                  // Rank is always after top 3, so add 3 + current page offset
                  const rank = 4 + (currentPage - 1) * ITEMS_PER_PAGE + idx;
                  return (
                    <tr key={node.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            #{rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/node/${node.id}`} className="block hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-2">
                            {node.avatarUrl && (
                              <img src={node.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground max-w-[200px] truncate" title={node.displayName || node.ip}>
                                  {node.displayName || node.ip}
                                </span>
                                {node.isVerified && <Shield className="h-3.5 w-3.5 text-success" />}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {getCountryFlag(node.countryCode)} {node.countryCode || 'Unknown'}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold" style={{
                          backgroundColor: `${TIER_COLORS[node.tier || 'standard']}20`,
                          color: TIER_COLORS[node.tier || 'standard']
                        }}>
                          <TierIcon tier={node.tier || 'standard'} />
                          {(node.tier || 'standard').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold" style={{ color: theme.primaryColor }}>
                          {formatPixScore(node.pixScore)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-foreground">
                          {node.uptime?.toFixed(1) || '0.0'}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-foreground">
                          {node.latencyAvg?.toFixed(0) || 'N/A'}ms
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {sortedNodes.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium text-foreground">No nodes on the leaderboard yet</p>
              <p className="text-sm">Nodes will appear here once they're online and tracked</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 glass-strong rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Page{' '}
              <span className="font-medium text-foreground">{currentPage}</span>{' '}
              of{' '}
              <span className="font-medium text-foreground">{totalPages}</span>
              {' '}•{' '}
              <span className="font-medium text-foreground">{sortedNodes.length}</span> total nodes
              {' '}(top 3 always shown above)
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'text-white'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      style={currentPage === pageNum ? { backgroundColor: theme.primaryColor } : {}}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
