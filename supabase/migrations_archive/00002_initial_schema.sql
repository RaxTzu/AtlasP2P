-- ===========================================
-- NODES MAP - APPLICATION SCHEMA
-- ===========================================
-- Application-specific tables for the Dingocoin Nodes Map
--
-- Execution Order: LAYER 3 (Application)
-- Dependencies:
--   - 00000_supabase_core.sql (roles must exist)
--   - 00000_supabase_schemas.sql (extensions already created)
--   - 00001_supabase_auth.sql (auth.uid() function available)
-- ===========================================

-- Extensions are already created in 00000_supabase_schemas.sql
-- Just ensure they're available
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;  -- For text search

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Nodes (discovered by crawler)
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Network Identity
    ip INET NOT NULL,
    port INTEGER NOT NULL DEFAULT 33117,
    address TEXT GENERATED ALWAYS AS (host(ip) || ':' || port) STORED,

    -- Chain identifier (set via NEXT_PUBLIC_CHAIN environment variable)
    -- IMPORTANT: For forkers, this will be auto-populated by the crawler
    -- Examples: 'bitcoin', 'litecoin', 'dogecoin', 'dingocoin', etc.
    chain TEXT NOT NULL DEFAULT 'bitcoin',

    -- From P2P handshake
    version TEXT,
    protocol_version INTEGER,
    services TEXT,
    start_height INTEGER,
    relay BOOLEAN,

    -- Parsed version
    client_name TEXT,
    client_version TEXT,
    version_major INTEGER,
    version_minor INTEGER,
    version_patch INTEGER,
    is_current_version BOOLEAN DEFAULT FALSE,

    -- GeoIP
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

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'up', 'down')),
    last_seen TIMESTAMPTZ,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    times_seen INTEGER DEFAULT 0,

    -- Performance
    latency_ms DECIMAL,
    latency_avg DECIMAL,
    uptime DECIMAL DEFAULT 0,
    reliability DECIMAL DEFAULT 0,

    -- Computed
    tier TEXT DEFAULT 'standard' CHECK (tier IN ('diamond', 'gold', 'silver', 'bronze', 'standard')),
    pix_score DECIMAL,
    rank INTEGER,

    -- Verification & Customization
    is_verified BOOLEAN DEFAULT FALSE,
    tips_enabled BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(ip, port, chain)
);

-- Indexes for common queries
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

-- ===========================================
-- HISTORICAL DATA
-- ===========================================

-- Snapshots (point-in-time network state)
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

-- Node snapshots (for uptime/latency tracking)
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

-- Network snapshots (aggregate network state over time)
CREATE TABLE IF NOT EXISTS network_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain TEXT NOT NULL DEFAULT 'bitcoin',
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_nodes INTEGER,
    online_nodes INTEGER,
    countries INTEGER,
    avg_latency DECIMAL,
    avg_uptime DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain, snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_network_snapshots_chain_time ON network_snapshots(chain, snapshot_time DESC);

-- ===========================================
-- USER & VERIFICATION
-- ===========================================

-- Note: Uses Supabase Auth (auth.users)

-- Verification challenges
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    user_id UUID,  -- FK to auth.users added after auth service initializes
    method TEXT NOT NULL CHECK (method IN ('message_sign', 'user_agent', 'port_challenge', 'dns_txt')),
    challenge TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_node ON verifications(node_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);

-- Verified node ownership
CREATE TABLE IF NOT EXISTS verified_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    user_id UUID,  -- FK to auth.users added after auth service initializes
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    verification_method TEXT
);

CREATE INDEX IF NOT EXISTS idx_verified_nodes_user ON verified_nodes(user_id);

-- ===========================================
-- NODE CUSTOMIZATION
-- ===========================================

-- Node profiles (for verified nodes)
CREATE TABLE IF NOT EXISTS node_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    user_id UUID,  -- FK to auth.users added after auth service initializes
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_profiles_node ON node_profiles(node_id);
CREATE INDEX IF NOT EXISTS idx_node_profiles_user ON node_profiles(user_id);

-- ===========================================
-- TIPPING
-- ===========================================

-- Tip configuration
CREATE TABLE IF NOT EXISTS node_tip_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    user_id UUID,  -- FK to auth.users added after auth service initializes
    wallet_address TEXT NOT NULL,
    accepted_coins TEXT[] DEFAULT ARRAY['DINGO'],
    minimum_tip DECIMAL,
    thank_you_message TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tip_configs_node ON node_tip_configs(node_id);

-- Tracked tips (optional)
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

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_tip_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Nodes: Public read
CREATE POLICY "Nodes are viewable by everyone"
    ON nodes FOR SELECT
    USING (true);

-- Nodes: Only service role can insert/update
CREATE POLICY "Service role can manage nodes"
    ON nodes FOR ALL
    USING (auth.role() = 'service_role');

-- Profiles: Public read for public profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON node_profiles FOR SELECT
    USING (is_public = true);

CREATE POLICY "Users can view own profiles"
    ON node_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
    ON node_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles"
    ON node_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Tip configs: Public read for active, owner write
CREATE POLICY "Active tip configs are viewable by everyone"
    ON node_tip_configs FOR SELECT
    USING (is_active = true);

CREATE POLICY "Users can manage own tip configs"
    ON node_tip_configs FOR ALL
    USING (auth.uid() = user_id);

-- Verifications: Owner only
CREATE POLICY "Users can view own verifications"
    ON verifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create verifications"
    ON verifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Verified nodes: Public read
CREATE POLICY "Verified nodes are viewable by everyone"
    ON verified_nodes FOR SELECT
    USING (true);

-- Snapshots: Public read
CREATE POLICY "Snapshots are viewable by everyone"
    ON snapshots FOR SELECT
    USING (true);

-- Node snapshots: Public read
CREATE POLICY "Node snapshots are viewable by everyone"
    ON node_snapshots FOR SELECT
    USING (true);

-- Network snapshots: Public read
CREATE POLICY "Network snapshots are viewable by everyone"
    ON network_snapshots FOR SELECT
    USING (true);

-- Tips: Public read
CREATE POLICY "Tips are viewable by everyone"
    ON tips FOR SELECT
    USING (true);

-- ===========================================
-- VIEWS
-- ===========================================

-- Public node view (with profile data)
CREATE OR REPLACE VIEW nodes_public AS
SELECT
    n.id,
    n.address,
    n.chain,
    n.status,
    (n.status = 'up') as is_online,
    n.country_code,
    n.country_name,
    n.city,
    n.latitude,
    n.longitude,
    n.client_version as version,
    n.protocol_version,
    n.is_current_version,
    n.uptime as uptime_percentage,
    n.latency_avg,
    n.tier,
    n.pix_score,
    n.rank,
    n.is_verified,
    n.tips_enabled,
    n.first_seen,
    n.last_seen,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_public, true) as is_public
FROM nodes n
LEFT JOIN node_profiles p ON n.id = p.node_id AND p.is_public = true;

-- Network stats view
CREATE OR REPLACE VIEW network_stats AS
SELECT
    chain,
    COUNT(*) as total_nodes,
    COUNT(*) FILTER (WHERE status = 'up') as online_nodes,
    COUNT(DISTINCT country_code) as countries,
    AVG(uptime) as avg_uptime,
    AVG(latency_avg) FILTER (WHERE latency_avg IS NOT NULL) as avg_latency,
    COUNT(*) FILTER (WHERE is_verified) as verified_nodes,
    COUNT(*) FILTER (WHERE tier = 'diamond') as diamond_nodes,
    COUNT(*) FILTER (WHERE tier = 'gold') as gold_nodes
FROM nodes
GROUP BY chain;

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard AS
SELECT
    n.id,
    n.address,
    COALESCE(p.display_name, n.address) as name,
    p.avatar_url,
    n.tier,
    n.pix_score,
    n.rank,
    n.uptime,
    n.latency_avg,
    n.country_code,
    n.is_verified,
    n.first_seen,
    n.chain
FROM nodes n
LEFT JOIN node_profiles p ON n.id = p.node_id
WHERE n.status = 'up'
ORDER BY n.pix_score DESC NULLS LAST;

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to nodes
DROP TRIGGER IF EXISTS update_nodes_updated_at ON nodes;
CREATE TRIGGER update_nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply trigger to node_profiles
DROP TRIGGER IF EXISTS update_node_profiles_updated_at ON node_profiles;
CREATE TRIGGER update_node_profiles_updated_at
    BEFORE UPDATE ON node_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- SEED DATA (for testing)
-- ===========================================

-- Insert some sample nodes for development
-- (Remove in production)
/*
INSERT INTO nodes (ip, port, chain, version, protocol_version, status, country_code, country_name, city, latitude, longitude, uptime, tier)
VALUES
    ('1.2.3.4', 33117, 'dingocoin', '/Dingocoin:1.16.0/', 70017, 'up', 'US', 'United States', 'New York', 40.7128, -74.0060, 99.5, 'gold'),
    ('5.6.7.8', 33117, 'dingocoin', '/Dingocoin:1.16.0/', 70017, 'up', 'DE', 'Germany', 'Berlin', 52.5200, 13.4050, 98.2, 'silver'),
    ('9.10.11.12', 33117, 'dingocoin', '/Dingocoin:1.15.0/', 70016, 'up', 'JP', 'Japan', 'Tokyo', 35.6762, 139.6503, 95.0, 'bronze')
ON CONFLICT (ip, port, chain) DO NOTHING;
*/
