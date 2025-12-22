'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { getThemeConfig } from '@atlasp2p/config';

interface Snapshot {
  snapshot_time: string;
  version: string | null;
}

interface UserAgentHistoryProps {
  snapshots: Snapshot[];
}

export function UserAgentHistory({ snapshots }: UserAgentHistoryProps) {
  const theme = getThemeConfig();

  // Group snapshots by version and track version changes
  const versionChanges = useMemo(() => {
    const changes: Array<{
      version: string;
      firstSeen: string;
      lastSeen: string;
      count: number;
    }> = [];

    if (snapshots.length === 0) return changes;

    // Sort by time descending (newest first)
    const sorted = [...snapshots].sort((a, b) =>
      new Date(b.snapshot_time).getTime() - new Date(a.snapshot_time).getTime()
    );

    let currentVersion = sorted[0].version || 'Unknown';
    let firstSeen = sorted[0].snapshot_time;
    let count = 1;

    for (let i = 1; i < sorted.length; i++) {
      const version = sorted[i].version || 'Unknown';

      if (version === currentVersion) {
        count++;
      } else {
        // Version changed, record the previous version
        changes.push({
          version: currentVersion,
          firstSeen,
          lastSeen: sorted[i - 1].snapshot_time,
          count,
        });

        // Start tracking new version
        currentVersion = version;
        firstSeen = sorted[i].snapshot_time;
        count = 1;
      }
    }

    // Add the last version
    changes.push({
      version: currentVersion,
      firstSeen,
      lastSeen: sorted[sorted.length - 1].snapshot_time,
      count,
    });

    return changes;
  }, [snapshots]);

  if (versionChanges.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
        No version history available
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
          User Agent History
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Version changes detected over time ({versionChanges.length} change{versionChanges.length !== 1 ? 's' : ''})
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Version</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">First Seen</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Last Seen</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Snapshots</th>
            </tr>
          </thead>
          <tbody>
            {versionChanges.map((change, index) => {
              const isLatest = index === 0;
              return (
                <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {change.version}
                      </code>
                      {isLatest && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${theme.primaryColor}20`,
                            color: theme.primaryColor,
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {new Date(change.firstSeen).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {new Date(change.lastSeen).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {change.count.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
