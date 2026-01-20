-- ===========================================
-- ATLASP2P - APPLICATION SCHEMA  
-- ===========================================
-- All tables in final state (chain-agnostic, production-ready)
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- Nodes
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip INET NOT NULL,
    port INTEGER NOT NULL DEFAULT 33117,
    address TEXT GENERATED ALWAYS AS (host(ip) || ':' || port) STORED,
    chain TEXT NOT NULL DEFAULT 'bitcoin',
    version TEXT,
    protocol_version INTEGER,
    services TEXT,
    start_height INTEGER,
    relay BOOLEAN,
    client_name TEXT,
    client_version TEXT,
    version_major INTEGER,
    version_minor INTEGER,
    version_patch INTEGER,
    is_current_version BOOLEAN DEFAULT FALSE,
    country_code TEXT,
    country_name TEXT,
    region TEXT,
    city TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    timezone TEXT,
    isp TEXT,
    org TEXT,
    asn INTEGER,
    asn_org TEXT,
    connection_type TEXT DEFAULT 'ipv4',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'up', 'down')),
    reachable BOOLEAN DEFAULT TRUE,
    previous_status TEXT,
    previous_status_changed_at TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    times_seen INTEGER DEFAULT 0,
    latency_ms DECIMAL,
    latency_avg DECIMAL,
    uptime DECIMAL DEFAULT 0,
    reliability DECIMAL DEFAULT 0,
    tier TEXT DEFAULT 'standard' CHECK (tier IN ('diamond', 'gold', 'silver', 'bronze', 'standard')),
    previous_tier TEXT,
    pix_score DECIMAL,
    rank INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    tips_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ip, port, chain)
);

CREATE INDEX IF NOT EXISTS idx_nodes_chain ON nodes(chain);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_country ON nodes(country_code);
CREATE INDEX IF NOT EXISTS idx_nodes_version ON nodes(client_version);
CREATE INDEX IF NOT EXISTS idx_nodes_tier ON nodes(tier);
CREATE INDEX IF NOT EXISTS idx_nodes_rank ON nodes(rank);
CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen);
CREATE INDEX IF NOT EXISTS idx_nodes_location ON nodes(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_nodes_address ON nodes(address);
CREATE INDEX IF NOT EXISTS idx_nodes_search ON nodes USING gin(address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nodes_services ON nodes(services) WHERE services IS NOT NULL;

-- Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_nodes INTEGER,
    reachable_nodes INTEGER,
    block_height INTEGER,
    stats JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_chain_time ON snapshots(chain, timestamp DESC);

CREATE TABLE IF NOT EXISTS node_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    snapshot_time TIMESTAMPTZ DEFAULT NOW(),
    is_online BOOLEAN DEFAULT FALSE,
    response_time_ms DECIMAL,
    block_height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_node_snapshots_node_time ON node_snapshots(node_id, snapshot_time DESC);

CREATE TABLE IF NOT EXISTS network_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chain TEXT NOT NULL,
    total_nodes INTEGER NOT NULL,
    online_nodes INTEGER NOT NULL,
    countries INTEGER NOT NULL,
    avg_uptime NUMERIC,
    avg_latency NUMERIC,
    avg_pix_score NUMERIC,
    diamond_nodes INTEGER DEFAULT 0,
    gold_nodes INTEGER DEFAULT 0,
    silver_nodes INTEGER DEFAULT 0,
    bronze_nodes INTEGER DEFAULT 0,
    most_common_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_network_history_time ON network_history(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_network_history_chain ON network_history(chain);

-- Verification
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    user_id UUID,
    method TEXT NOT NULL CHECK (method IN ('message_sign', 'user_agent', 'port_challenge', 'dns_txt')),
    challenge TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired', 'pending_approval')),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    attempts INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verifications_node ON verifications(node_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);

CREATE TABLE IF NOT EXISTS verified_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    user_id UUID,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    verification_method TEXT
);
CREATE INDEX IF NOT EXISTS idx_verified_nodes_user ON verified_nodes(user_id);

-- Profiles
CREATE TABLE IF NOT EXISTS node_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    user_id UUID,
    display_name TEXT,
    description TEXT,
    avatar_url TEXT,
    website TEXT,
    twitter TEXT,
    discord TEXT,
    telegram TEXT,
    github TEXT,
    tags TEXT[],
    is_public BOOLEAN DEFAULT TRUE,
    moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
    moderated_by UUID,
    moderated_at TIMESTAMPTZ,
    moderation_notes TEXT,
    is_avatar_approved BOOLEAN DEFAULT TRUE,
    avatar_rejected_reason TEXT,
    pending_changes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_node_profiles_node ON node_profiles(node_id);
CREATE INDEX IF NOT EXISTS idx_node_profiles_user ON node_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_node_profiles_moderation ON node_profiles(moderation_status) WHERE moderation_status != 'approved';

-- Tipping
CREATE TABLE IF NOT EXISTS node_tip_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    user_id UUID,
    wallet_address TEXT NOT NULL,
    accepted_coins TEXT[] DEFAULT ARRAY['DINGO'],
    minimum_tip DECIMAL,
    thank_you_message TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tip_configs_node ON node_tip_configs(node_id);

CREATE TABLE IF NOT EXISTS tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    tx_hash TEXT UNIQUE,
    amount DECIMAL NOT NULL,
    coin TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tips_node ON tips(node_id);
CREATE INDEX IF NOT EXISTS idx_tips_tx ON tips(tx_hash);

-- Admin
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support')),
    granted_by UUID,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS banned_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    banned_by UUID,
    reason TEXT,
    banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_permanent BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_banned_users_user_id ON banned_users(user_id);

CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN ('avatar', 'profile', 'verification')),
    item_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
    content_url TEXT,
    content_data JSONB,
    flagged_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_user_id ON moderation_queue(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    ip_address INET,
    endpoint TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address);

CREATE TABLE IF NOT EXISTS default_avatars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(category);

-- Alerts
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  alert_offline BOOLEAN DEFAULT true,
  alert_online BOOLEAN DEFAULT true,
  alert_version_outdated BOOLEAN DEFAULT false,
  alert_tier_change BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  email TEXT,
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_type TEXT DEFAULT 'discord',
  cooldown_minutes INT DEFAULT 60,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_node ON alert_subscriptions(node_id);

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  email_error TEXT,
  webhook_sent BOOLEAN DEFAULT false,
  webhook_error TEXT,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_history_subscription ON alert_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  description TEXT,
  scopes TEXT[] DEFAULT ARRAY['read:nodes', 'read:stats', 'read:leaderboard'],
  rate_limit INT DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key_hash)
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  response_time_ms INT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at DESC);

-- Enable RLS
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_tip_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
