'use client';

// ===========================================
// EXAMPLE: REACT COMPONENTS WITH FEATURE FLAGS
// ===========================================
// This file demonstrates various patterns for conditional rendering
// based on feature flags

import { ReactNode } from 'react';
import {
  useFeatureFlags,
  useAuthEnabled,
  useVerificationEnabled,
  useVerificationMethods,
  useProfilesEnabled,
  useTippingEnabled,
  useAdminEnabled,
  useTurnstileProtection,
  useTurnstileSiteKey,
  useLeaderboardEnabled,
  useStatsEnabled,
  // TODO: Add these hooks if needed:
  // useMapEnabled,
  // useDataExportEnabled,
  // useExportFormats,
  // useRealtimeEnabled,
  // useRealtimeInterval,
  // useLimits,
} from '@/hooks/use-feature-flags';

// ===========================================
// PATTERN 1: Simple conditional rendering
// ===========================================

export function SimpleExample() {
  const isLeaderboardEnabled = useLeaderboardEnabled();

  if (!isLeaderboardEnabled) {
    return null; // Don't render if feature is disabled
  }

  return (
    <div>
      <h2>Leaderboard</h2>
      <p>Top nodes by performance...</p>
    </div>
  );
}

// ===========================================
// PATTERN 2: Conditional navigation items
// ===========================================

export function NavigationMenu() {
  const isLeaderboardEnabled = useLeaderboardEnabled();
  const isStatsEnabled = useStatsEnabled();
  const isAdminEnabled = useAdminEnabled();

  const menuItems = [
    { name: 'Map', href: '/', enabled: true },
    { name: 'Leaderboard', href: '/leaderboard', enabled: isLeaderboardEnabled },
    { name: 'Statistics', href: '/stats', enabled: isStatsEnabled },
    { name: 'Admin', href: '/admin', enabled: isAdminEnabled },
  ].filter(item => item.enabled);

  return (
    <nav>
      <ul>
        {menuItems.map(item => (
          <li key={item.name}>
            <a href={item.href}>{item.name}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ===========================================
// PATTERN 3: Feature gate wrapper component
// ===========================================

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const flags = useFeatureFlags();

  // Parse feature path (e.g., "core.authentication")
  const keys = feature.split('.');
  let current: any = flags;

  for (const key of keys) {
    if (current === undefined || current === null) {
      return <>{fallback}</>;
    }
    current = current[key];
  }

  const isEnabled = Boolean(current);

  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// Usage example:
export function FeatureGateExample() {
  return (
    <div>
      <FeatureGate feature="core.tipping" fallback={<p>Tipping is disabled</p>}>
        <button>Send Tip</button>
      </FeatureGate>

      <FeatureGate feature="community.leaderboard">
        <a href="/leaderboard">View Leaderboard</a>
      </FeatureGate>
    </div>
  );
}

// ===========================================
// PATTERN 4: Node actions with multiple feature checks
// ===========================================

interface NodeActionsProps {
  nodeId: string;
  isVerified: boolean;
}

export function NodeActions({ nodeId, isVerified }: NodeActionsProps) {
  const isAuthEnabled = useAuthEnabled();
  const isVerificationEnabled = useVerificationEnabled();
  const isProfilesEnabled = useProfilesEnabled();
  const isTippingEnabled = useTippingEnabled();

  return (
    <div className="flex gap-2">
      {/* Verify button: only show if auth + verification enabled and not yet verified */}
      {isAuthEnabled && isVerificationEnabled && !isVerified && (
        <button>Verify Ownership</button>
      )}

      {/* Edit profile: only show if profiles enabled and node is verified */}
      {isProfilesEnabled && isVerified && (
        <button>Edit Profile</button>
      )}

      {/* Send tip: only show if tipping enabled and node is verified */}
      {isTippingEnabled && isVerified && (
        <button>Send Tip</button>
      )}

      {/* View details: always available */}
      <button>View Details</button>
    </div>
  );
}

// ===========================================
// PATTERN 5: Verification method selector
// ===========================================

export function VerificationMethodSelector() {
  const isVerificationEnabled = useVerificationEnabled();
  const methods = useVerificationMethods();

  if (!isVerificationEnabled) {
    return (
      <div className="alert alert-warning">
        Node verification is currently disabled
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="alert alert-error">
        No verification methods are configured
      </div>
    );
  }

  return (
    <div>
      <h3>Choose Verification Method</h3>
      <div className="grid grid-cols-2 gap-4">
        {methods.includes('message_sign') && (
          <button className="btn">Message Signature</button>
        )}
        {methods.includes('user_agent') && (
          <button className="btn">User Agent</button>
        )}
        {methods.includes('port_challenge') && (
          <button className="btn">Port Challenge</button>
        )}
        {methods.includes('dns_txt') && (
          <button className="btn">DNS TXT Record</button>
        )}
      </div>
    </div>
  );
}

// ===========================================
// PATTERN 6: Turnstile widget integration
// ===========================================

export function TurnstileWidget({ action }: { action: 'verification' | 'tipping' | 'profile_update' | 'contact' }) {
  const isRequired = useTurnstileProtection(action);
  const siteKey = useTurnstileSiteKey();

  if (!isRequired) {
    return null; // Turnstile not required for this action
  }

  if (!siteKey) {
    console.error('Turnstile is enabled but site key is not configured');
    return null;
  }

  return (
    <div className="turnstile-container">
      {/* In a real implementation, you would use the Cloudflare Turnstile widget here */}
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-callback="onTurnstileSuccess"
      />
    </div>
  );
}

// ===========================================
// PATTERN 7: Data export with format selection
// ===========================================

// TODO: Implement these hooks in use-feature-flags.tsx
/*
export function DataExportButton() {
  const isExportEnabled = useDataExportEnabled();
  const formats = useExportFormats();

  if (!isExportEnabled) {
    return null;
  }

  return (
    <div className="dropdown">
      <button className="btn">Export Data</button>
      <ul className="dropdown-menu">
        {formats.map((format: string) => (
          <li key={format}>
            <button onClick={() => handleExport(format)}>
              Export as {format.toUpperCase()}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function handleExport(format: string) {
  console.log(`Exporting as ${format}`);
  // Implementation here
}
*/

// ===========================================
// PATTERN 8: Realtime updates with configuration
// ===========================================

// TODO: Implement these hooks in use-feature-flags.tsx
/*
export function RealtimeIndicator() {
  const isRealtimeEnabled = useRealtimeEnabled();
  const updateInterval = useRealtimeInterval();

  if (!isRealtimeEnabled) {
    return (
      <div className="badge badge-secondary">
        Static Data
      </div>
    );
  }

  return (
    <div className="badge badge-success">
      Live (updates every {updateInterval / 1000}s)
    </div>
  );
}
*/

// ===========================================
// PATTERN 9: Limits-aware form validation
// ===========================================

// TODO: Implement these hooks in use-feature-flags.tsx
/*
export function AvatarUpload() {
  const limits = useLimits();
  const { maxAvatarSizeMB, allowedAvatarFormats } = limits;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    const maxSizeBytes = maxAvatarSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`File size must not exceed ${maxAvatarSizeMB}MB`);
      return;
    }

    // Check file format
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedAvatarFormats.includes(extension)) {
      alert(`File format must be one of: ${allowedAvatarFormats.join(', ')}`);
      return;
    }

    // Upload file
    console.log('Uploading file:', file.name);
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        accept={allowedAvatarFormats.map((f: string) => `.${f}`).join(',')}
      />
      <p className="text-sm text-gray-500">
        Max size: {maxAvatarSizeMB}MB. Formats: {allowedAvatarFormats.join(', ')}
      </p>
    </div>
  );
}
*/

// ===========================================
// PATTERN 10: Complete node card with all features
// ===========================================

interface NodeCardProps {
  node: {
    id: string;
    displayName: string | null;
    isVerified: boolean;
    tier: string;
    country: string;
  };
}

export function NodeCard({ node }: NodeCardProps) {
  const isAuthEnabled = useAuthEnabled();
  const isVerificationEnabled = useVerificationEnabled();
  const isProfilesEnabled = useProfilesEnabled();
  const isTippingEnabled = useTippingEnabled();

  return (
    <div className="card">
      <div className="card-header">
        <h3>{node.displayName || `Node ${node.id.slice(0, 8)}`}</h3>
        {node.isVerified && <span className="badge badge-success">Verified</span>}
      </div>

      <div className="card-body">
        <p>Tier: {node.tier}</p>
        <p>Location: {node.country}</p>
      </div>

      <div className="card-footer">
        {/* Show verification button if not verified and feature is enabled */}
        {isAuthEnabled && isVerificationEnabled && !node.isVerified && (
          <button className="btn btn-primary">Verify This Node</button>
        )}

        {/* Show profile edit if verified and profiles enabled */}
        {isProfilesEnabled && node.isVerified && (
          <button className="btn btn-secondary">Edit Profile</button>
        )}

        {/* Show tipping if verified and tipping enabled */}
        {isTippingEnabled && node.isVerified && (
          <button className="btn btn-accent">Send Tip</button>
        )}
      </div>
    </div>
  );
}

// ===========================================
// PATTERN 11: Admin panel with permission checks
// ===========================================

export function AdminPanel() {
  const isAdminEnabled = useAdminEnabled();
  const flags = useFeatureFlags();

  if (!isAdminEnabled) {
    return (
      <div className="alert alert-error">
        Admin features are disabled in the application configuration
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <h2>Admin Dashboard</h2>

      <div className="grid grid-cols-3 gap-4">
        {/* Verification management */}
        {flags.core.nodeVerification && (
          <div className="card">
            <h3>Verification Queue</h3>
            <p>Pending: 5</p>
            <button className="btn">Review</button>
          </div>
        )}

        {/* User management */}
        {flags.core.authentication && (
          <div className="card">
            <h3>User Management</h3>
            <p>Total Users: 42</p>
            <button className="btn">Manage</button>
          </div>
        )}

        {/* Analytics */}
        {flags.analytics.enabled && (
          <div className="card">
            <h3>Analytics</h3>
            <p>Provider: {flags.analytics.provider}</p>
            <button className="btn">View Stats</button>
          </div>
        )}
      </div>
    </div>
  );
}
