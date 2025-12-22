-- ===========================================
-- Admin Settings Table
-- ===========================================
-- Allows admins to override project config values from the database
-- Values here take precedence over project.config.yaml

CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Common settings categories
COMMENT ON TABLE admin_settings IS 'Admin-configurable settings that override project config';
COMMENT ON COLUMN admin_settings.key IS 'Setting key (e.g., chain.currentVersion, chain.latestReleaseUrl)';
COMMENT ON COLUMN admin_settings.value IS 'JSON value - can be string, number, boolean, array, or object';
COMMENT ON COLUMN admin_settings.category IS 'Category: chain, theme, crawler, notifications, etc.';

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read settings
CREATE POLICY "Admins can view settings" ON admin_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Only admins can modify settings
CREATE POLICY "Admins can modify settings" ON admin_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Service role bypass for internal operations
CREATE POLICY "Service role full access to settings" ON admin_settings
    FOR ALL
    USING (auth.role() = 'service_role');

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_admin_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_settings_updated
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_settings_timestamp();

-- Insert default settings (these match the project.config.yaml values)
-- Admins can update these to override
INSERT INTO admin_settings (key, value, description, category) VALUES
    ('chain.currentVersion', '"1.18.0.0"', 'Current/latest version of the blockchain software', 'chain'),
    ('chain.minimumVersion', '"1.17.0.0"', 'Minimum acceptable version', 'chain'),
    ('chain.criticalVersion', '"1.16.0.0"', 'Critical security version - below this is dangerous', 'chain'),
    ('chain.protocolVersion', '70144', 'P2P protocol version number', 'chain'),
    ('chain.latestReleaseUrl', '"https://github.com/dingocoin/dingocoin/releases/tag/v1.18.0.0"', 'URL to latest release download page', 'chain'),
    ('chain.releasesUrl', '"https://github.com/dingocoin/dingocoin/releases"', 'URL to all releases page', 'chain'),
    ('crawler.scanIntervalMinutes', '5', 'How often to scan the network (minutes)', 'crawler'),
    ('crawler.pruneAfterHours', '168', 'Remove nodes not seen in this many hours', 'crawler'),
    ('notifications.maintenanceMode', 'false', 'When true, suppresses all alert notifications', 'notifications')
ON CONFLICT (key) DO NOTHING;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(category);

-- Grant access
GRANT SELECT ON admin_settings TO authenticated;
GRANT ALL ON admin_settings TO service_role;
