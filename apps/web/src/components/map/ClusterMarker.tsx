'use client';

import { useMemo } from 'react';
import { getTierColor } from '@/lib/theme-colors';
import { getThemeConfig } from '@/config';
import type { NodeWithProfile, NodeTier } from '@atlasp2p/types';

interface ClusterMarkerProps {
  count: number;
  nodes: NodeWithProfile[];
  onClick?: () => void;
}

export default function ClusterMarker({ count, nodes, onClick }: ClusterMarkerProps) {
  const theme = getThemeConfig();

  // Count online nodes
  const onlineCount = useMemo(() => {
    return nodes.filter(node => node.status === 'up').length;
  }, [nodes]);

  // Get the highest tier node to represent the cluster
  const topNode = useMemo(() => {
    const tierPriority: Record<NodeTier, number> = {
      diamond: 1,
      gold: 2,
      silver: 3,
      bronze: 4,
      standard: 5,
    };

    return [...nodes].sort((a, b) => {
      const priorityA = tierPriority[a.tier] || 999;
      const priorityB = tierPriority[b.tier] || 999;
      return priorityA - priorityB;
    })[0];
  }, [nodes]);

  // Determine cluster size based on count
  const { size, badgeSize, fontSize } = useMemo(() => {
    if (count > 100) {
      return { size: 64, badgeSize: 28, fontSize: '14px' };
    } else if (count > 10) {
      return { size: 56, badgeSize: 24, fontSize: '12px' };
    } else {
      return { size: 48, badgeSize: 22, fontSize: '11px' };
    }
  }, [count]);

  // Get tier color for the badge border
  const tierColor = getTierColor(topNode?.tier || 'standard', true);

  // Image source - avatar or default marker
  const imageSrc = topNode?.avatarUrl || '/logos/dingocoin.png';
  const isCustomAvatar = !!topNode?.avatarUrl;

  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      style={{
        position: 'relative',
        width: size,
        height: size,
        cursor: 'pointer',
        transition: 'transform 0.2s ease-out',
      }}
    >
      {/* Main node icon */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
        }}
      >
        <img
          src={imageSrc}
          alt={`Cluster of ${count} nodes`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isCustomAvatar ? 'cover' : 'contain',
            backgroundColor: isCustomAvatar ? 'transparent' : 'white',
          }}
        />
      </div>

      {/* Count badge */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          minWidth: badgeSize,
          height: badgeSize,
          padding: '0 6px',
          borderRadius: badgeSize / 2,
          backgroundColor: theme.primaryColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize,
          border: '2px solid white',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          zIndex: 10,
        }}
      >
        {count}
      </div>

      {/* Online indicator - show when there are offline nodes */}
      {onlineCount > 0 && onlineCount < count && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: badgeSize * 0.85,
            height: badgeSize * 0.85,
            padding: '0 4px',
            borderRadius: (badgeSize * 0.85) / 2,
            backgroundColor: '#22c55e',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: fontSize === '14px' ? '12px' : fontSize === '12px' ? '10px' : '9px',
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            zIndex: 11,
          }}
          title={`${onlineCount} online nodes out of ${count}`}
        >
          {onlineCount}
        </div>
      )}
    </div>
  );
}
