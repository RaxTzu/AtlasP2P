'use client';

import { useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as LucideIcons from 'lucide-react';
import { getTierColor, getTierIcon, getTierLabel } from '@/lib/theme-colors';
import { getAccentColor } from '@/lib/theme-utils';
import type { NodeWithProfile } from '@atlasp2p/types';

interface NodeHoverPreviewProps {
  node: NodeWithProfile;
}

// Convert kebab-case to PascalCase for icon lookup
function iconNameToComponent(iconName: string): any {
  const pascalCase = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return (LucideIcons as any)[pascalCase];
}

export default function NodeHoverPreview({ node }: NodeHoverPreviewProps) {
  const tierColor = getTierColor(node.tier, node.status);
  const tierIconName = getTierIcon(node.tier);
  const tierLabel = getTierLabel(node.tier);

  // Format uptime percentage
  const uptimeDisplay = node.uptime !== null ? `${node.uptime.toFixed(1)}%` : 'N/A';

  // Get country flag emoji (using Unicode regional indicators)
  const countryFlag = useMemo(() => {
    if (!node.countryCode || node.countryCode.length !== 2) return '';
    try {
      const codePoints = node.countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return '';
    }
  }, [node.countryCode]);

  // Get tier icon component
  const TierIconComponent = iconNameToComponent(tierIconName);

  // Status icon and color
  const statusIcon = node.status === 'up' ? 'CheckCircle' : node.status === 'reachable' ? 'AlertCircle' : 'XCircle';
  const StatusIconComponent = (LucideIcons as any)[statusIcon];
  const statusColor = node.status === 'up' ? '#22c55e' : node.status === 'reachable' ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        minWidth: '240px',
        maxWidth: '280px',
        backgroundColor: 'var(--color-card)',
        border: `2px solid ${tierColor}`,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        lineHeight: '1.4',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* Header with IP and status */}
      <div style={{ marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: 'var(--color-card-foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {node.displayName || `${node.ip}:${node.port}`}
          </div>
          {StatusIconComponent && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: '8px',
              }}
              dangerouslySetInnerHTML={{
                __html: renderToStaticMarkup(
                  <StatusIconComponent size={16} color={statusColor} strokeWidth={2.5} />
                ),
              }}
            />
          )}
        </div>
        {node.displayName && (
          <div style={{
            fontSize: '11px',
            color: 'var(--color-muted-foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {node.ip}:{node.port}
          </div>
        )}
      </div>

      {/* Tier info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          {TierIconComponent && (
            <div
              style={{ display: 'inline-flex', alignItems: 'center' }}
              dangerouslySetInnerHTML={{
                __html: renderToStaticMarkup(
                  <TierIconComponent
                    size={16}
                    color={tierColor}
                    strokeWidth={2.5}
                    fill={node.tier === 'diamond' ? tierColor : 'none'}
                  />
                ),
              }}
            />
          )}
          <span style={{
            fontWeight: '600',
            color: tierColor,
            fontSize: '13px',
          }}>
            {tierLabel}
          </span>
        </div>
        {node.isVerified && (
          <div
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: renderToStaticMarkup(
                  <LucideIcons.BadgeCheck size={12} color="white" strokeWidth={2.5} />
                ),
              }}
            />
            Verified
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '8px',
      }}>
        {/* Country */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-muted-foreground)', marginBottom: '2px' }}>
            Country
          </div>
          <div style={{
            fontWeight: '600',
            color: 'var(--color-card-foreground)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {countryFlag && <span>{countryFlag}</span>}
            <span>{node.countryCode || 'Unknown'}</span>
          </div>
        </div>

        {/* Uptime */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-muted-foreground)', marginBottom: '2px' }}>
            Uptime
          </div>
          <div style={{
            fontWeight: '600',
            color: node.uptime >= 99 ? '#22c55e' : node.uptime >= 95 ? '#f59e0b' : '#ef4444',
            fontSize: '12px',
          }}>
            {uptimeDisplay}
          </div>
        </div>

        {/* Version */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-muted-foreground)', marginBottom: '2px' }}>
            Version
          </div>
          <div style={{
            fontWeight: '600',
            color: 'var(--color-card-foreground)',
            fontSize: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {node.version || 'Unknown'}
          </div>
        </div>

        {/* Latency */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-muted-foreground)', marginBottom: '2px' }}>
            Latency
          </div>
          <div style={{
            fontWeight: '600',
            color: node.latencyAvg && node.latencyAvg < 100 ? '#22c55e' : node.latencyAvg && node.latencyAvg < 300 ? '#f59e0b' : '#ef4444',
            fontSize: '12px',
          }}>
            {node.latencyAvg ? `${Math.round(node.latencyAvg)}ms` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div style={{
        fontSize: '10px',
        color: 'var(--color-muted-foreground)',
        textAlign: 'center',
        marginTop: '8px',
        paddingTop: '8px',
        borderTop: '1px solid var(--color-border)',
      }}>
        Click for full details
      </div>
    </div>
  );
}
