'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  Save,
  RefreshCw,
  ArrowLeft,
  Server,
  Bell,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  Code,
} from 'lucide-react';
import { getThemeConfig } from '@/config';

interface AdminSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
  updated_at: string;
  yaml_default?: any;  // Value from project.config.yaml
  is_override?: boolean;  // True if DB value differs from YAML
}

const CATEGORY_ICONS: Record<string, any> = {
  chain: Server,
  crawler: RefreshCw,
  notifications: Bell,
  general: Settings,
};

const CATEGORY_LABELS: Record<string, string> = {
  chain: 'Chain Configuration',
  crawler: 'Crawler Settings',
  notifications: 'Notifications',
  general: 'General',
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const theme = getThemeConfig();

  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data.settings || []);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    setSaveStatus(prev => ({ ...prev, [key]: null }));
  };

  const saveSetting = async (key: string) => {
    const value = editedValues[key];
    if (value === undefined) return;

    setSaving(key);
    try {
      console.log('[Settings] Saving:', key, '=', value);
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Settings] Save failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to save (${response.status})`);
      }

      setSaveStatus(prev => ({ ...prev, [key]: 'success' }));

      // Update local state
      setSettings(prev =>
        prev.map(s => (s.key === key ? { ...s, value, updated_at: new Date().toISOString() } : s))
      );

      // Clear edited value
      setEditedValues(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      // Clear success status after 3 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [key]: null }));
      }, 3000);
    } catch (error) {
      console.error('Failed to save setting:', error);
      setSaveStatus(prev => ({ ...prev, [key]: 'error' }));
    } finally {
      setSaving(null);
    }
  };

  const getCurrentValue = (setting: AdminSetting) => {
    return editedValues[setting.key] !== undefined ? editedValues[setting.key] : setting.value;
  };

  const hasChanges = (key: string) => {
    return editedValues[key] !== undefined;
  };

  const renderValueEditor = (setting: AdminSetting) => {
    const value = getCurrentValue(setting);
    const isEdited = hasChanges(setting.key);

    // Determine input type based on value
    if (typeof value === 'boolean') {
      return (
        <button
          onClick={() => handleValueChange(setting.key, !value)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {value ? 'Enabled' : 'Disabled'}
        </button>
      );
    }

    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={e => handleValueChange(setting.key, parseInt(e.target.value) || 0)}
          className={`w-32 px-3 py-2 rounded-lg bg-muted border transition-colors ${
            isEdited ? 'border-yellow-500' : 'border-border'
          } focus:outline-none focus:ring-2 focus:ring-primary`}
        />
      );
    }

    // String value
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    const isUrl = strValue.startsWith('http');

    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={strValue}
          onChange={e => handleValueChange(setting.key, e.target.value)}
          className={`flex-1 px-3 py-2 rounded-lg bg-muted border transition-colors ${
            isEdited ? 'border-yellow-500' : 'border-border'
          } focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm`}
        />
        {isUrl && (
          <a
            href={strValue}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  };

  // Group settings by category
  const groupedSettings = settings.reduce(
    (acc, setting) => {
      const cat = setting.category || 'general';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(setting);
      return acc;
    },
    {} as Record<string, AdminSetting[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/manage"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="h-6 w-6" style={{ color: theme.primaryColor }} />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure chain parameters, versions, and system behavior
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Refresh settings"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-400">Database Overrides</p>
            <p className="text-muted-foreground mt-1">
              Values here override <code className="text-xs bg-muted px-1 py-0.5 rounded">project.config.yaml</code>.
              The YAML default is shown for each setting. Settings marked <span className="text-yellow-400">Override</span> differ from YAML.
              Changes take effect immediately. Click "Reset to default" to use the YAML value.
            </p>
          </div>
        </div>
      </div>

      {/* Settings by Category */}
      {Object.entries(groupedSettings).map(([category, categorySettings]) => {
        const Icon = CATEGORY_ICONS[category] || Settings;
        const label = CATEGORY_LABELS[category] || category;

        return (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Icon className="h-5 w-5 text-muted-foreground" />
              {label}
            </h2>

            <div className="space-y-4">
              {categorySettings.map(setting => (
                <div
                  key={setting.id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-primary">
                          {setting.key}
                        </code>
                        {saveStatus[setting.key] === 'success' && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Check className="h-3 w-3" />
                            Saved
                          </span>
                        )}
                        {saveStatus[setting.key] === 'error' && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      {setting.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {setting.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {renderValueEditor(setting)}

                      {hasChanges(setting.key) && (
                        <button
                          onClick={() => saveSetting(setting.key)}
                          disabled={saving === setting.key}
                          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {saving === setting.key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                    <div className="text-xs text-muted-foreground">
                      Last updated: {new Date(setting.updated_at).toLocaleString()}
                    </div>
                    {setting.yaml_default !== undefined && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          YAML default: <code className="bg-muted px-1 rounded">{JSON.stringify(setting.yaml_default)}</code>
                        </span>
                        {setting.is_override && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                            Override
                          </span>
                        )}
                        {setting.is_override && (
                          <button
                            onClick={() => handleValueChange(setting.key, setting.yaml_default)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {settings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No settings found</p>
        </div>
      )}

      {/* Developer Info */}
      <div className="mt-12 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Code className="h-4 w-4" />
          <span>
            Settings are stored in the <code className="bg-muted px-1 rounded">admin_settings</code> table
            and can be accessed via API at <code className="bg-muted px-1 rounded">/api/admin/settings</code>
          </span>
        </div>
      </div>
    </div>
  );
}
