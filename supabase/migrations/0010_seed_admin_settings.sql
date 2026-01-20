-- ===========================================
-- SEED ADMIN SETTINGS
-- ===========================================
-- Pre-populate configurable settings that admins can override via UI
-- Values here are NULL (meaning: use YAML default)
-- Admin can set a value to override the YAML

-- Chain Configuration (can be changed without redeploy)
INSERT INTO admin_settings (key, value, category, description, is_public)
VALUES 
  ('chain.currentVersion', 'null'::jsonb, 'chain', 'Current/latest version of the node software. Used to mark nodes as current or outdated.', true),
  ('chain.minimumVersion', 'null'::jsonb, 'chain', 'Minimum acceptable version. Nodes below this are marked as outdated.', true),
  ('chain.criticalVersion', 'null'::jsonb, 'chain', 'Critical version threshold. Nodes below this are marked as critical/vulnerable.', true),
  ('chain.protocolVersion', 'null'::jsonb, 'chain', 'P2P protocol version number used by the crawler.', false)
ON CONFLICT (key) DO NOTHING;

-- Crawler Configuration
INSERT INTO admin_settings (key, value, category, description, is_public)
VALUES
  ('crawler.scanIntervalMinutes', 'null'::jsonb, 'crawler', 'How often the crawler scans the network (in minutes).', false),
  ('crawler.pruneAfterHours', 'null'::jsonb, 'crawler', 'Hours of inactivity before a node is pruned from the database.', false),
  ('crawler.maxConcurrentConnections', 'null'::jsonb, 'crawler', 'Maximum concurrent connections during crawl.', false)
ON CONFLICT (key) DO NOTHING;

-- Notification Configuration
INSERT INTO admin_settings (key, value, category, description, is_public)
VALUES
  ('notifications.maintenanceMode', 'false'::jsonb, 'notifications', 'When enabled, suppresses alert notifications (useful during maintenance).', false),
  ('notifications.alertCooldownHours', 'null'::jsonb, 'notifications', 'Minimum hours between repeated alerts for the same node.', false)
ON CONFLICT (key) DO NOTHING;

-- API Configuration
INSERT INTO admin_settings (key, value, category, description, is_public)
VALUES
  ('api.anonymousRateLimit', 'null'::jsonb, 'api', 'Rate limit for anonymous API requests (requests per minute).', false),
  ('api.authenticatedRateLimit', 'null'::jsonb, 'api', 'Rate limit for authenticated API requests (requests per minute).', false)
ON CONFLICT (key) DO NOTHING;
