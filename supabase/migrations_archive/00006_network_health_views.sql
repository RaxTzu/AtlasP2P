-- ============================================
-- Network Health & Statistics Views
-- ============================================
-- Provides aggregate network statistics and health metrics

-- ============================================
-- VIEW: Network Stats (Real-time aggregate)
-- ============================================
CREATE OR REPLACE VIEW network_stats AS
SELECT
    'dingocoin' as chain,
    NOW() as timestamp,

    -- Node counts
    COUNT(*) as total_nodes,
    COUNT(*) FILTER (WHERE status = 'up') as online_nodes,
    COUNT(*) FILTER (WHERE status = 'down') as offline_nodes,
    COUNT(DISTINCT country_code) FILTER (WHERE country_code IS NOT NULL) as countries,
    COUNT(*) FILTER (WHERE is_verified = true) as verified_nodes,

    -- Tier distribution
    COUNT(*) FILTER (WHERE tier = 'diamond') as diamond_nodes,
    COUNT(*) FILTER (WHERE tier = 'gold') as gold_nodes,
    COUNT(*) FILTER (WHERE tier = 'silver') as silver_nodes,
    COUNT(*) FILTER (WHERE tier = 'bronze') as bronze_nodes,
    COUNT(*) FILTER (WHERE tier = 'standard') as standard_nodes,

    -- Average metrics (only online nodes)
    ROUND(AVG(uptime) FILTER (WHERE status = 'up')::numeric, 2) as avg_uptime,
    ROUND(AVG(latency_avg) FILTER (WHERE status = 'up')::numeric, 2) as avg_latency,
    ROUND(AVG(pix_score) FILTER (WHERE status = 'up')::numeric, 2) as avg_pix_score,

    -- Version stats
    COUNT(DISTINCT client_version) FILTER (WHERE client_version IS NOT NULL) as version_count,
    COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up') as up_to_date_nodes,
    ROUND(
        (COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up')::numeric /
         NULLIF(COUNT(*) FILTER (WHERE status = 'up')::numeric, 0)) * 100,
        2
    ) as version_adoption_rate,

    -- Network health score (0-100)
    -- Formula: (online% × 0.4) + (avg_uptime × 0.3) + (version_adoption × 0.2) + (avg_pix/10 × 0.1)
    ROUND(
        ((COUNT(*) FILTER (WHERE status = 'up')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100 * 0.4) +
        (AVG(uptime) FILTER (WHERE status = 'up') * 0.3) +
        ((COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up')::numeric /
          NULLIF(COUNT(*) FILTER (WHERE status = 'up')::numeric, 0)) * 100 * 0.2) +
        ((AVG(pix_score) FILTER (WHERE status = 'up') / 10) * 0.1),
        2
    ) as network_health_score

FROM nodes
WHERE chain = 'dingocoin';

COMMENT ON VIEW network_stats IS 'Real-time aggregate network statistics including health score';

-- ============================================
-- VIEW: Version Distribution
-- ============================================
CREATE OR REPLACE VIEW version_distribution AS
SELECT
    client_version as version,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::numeric / (SELECT COUNT(*) FROM nodes WHERE chain = 'dingocoin')::numeric) * 100,
        2
    ) as percentage,
    COUNT(*) FILTER (WHERE status = 'up') as online_count,
    is_current_version
FROM nodes
WHERE chain = 'dingocoin'
  AND client_version IS NOT NULL
GROUP BY client_version, is_current_version
ORDER BY count DESC;

COMMENT ON VIEW version_distribution IS 'Distribution of client versions across the network';

-- ============================================
-- VIEW: Country Distribution
-- ============================================
CREATE OR REPLACE VIEW country_distribution AS
SELECT
    country_code,
    country_name,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::numeric / (SELECT COUNT(*) FROM nodes WHERE chain = 'dingocoin')::numeric) * 100,
        2
    ) as percentage,
    COUNT(*) FILTER (WHERE status = 'up') as online_count
FROM nodes
WHERE chain = 'dingocoin'
  AND country_code IS NOT NULL
GROUP BY country_code, country_name
ORDER BY count DESC;

COMMENT ON VIEW country_distribution IS 'Geographic distribution of nodes by country';

-- ============================================
-- VIEW: Tier Distribution with Stats
-- ============================================
CREATE OR REPLACE VIEW tier_distribution AS
SELECT
    tier,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::numeric / (SELECT COUNT(*) FROM nodes WHERE chain = 'dingocoin')::numeric) * 100,
        2
    ) as percentage,
    COUNT(*) FILTER (WHERE status = 'up') as online_count,
    ROUND(AVG(uptime)::numeric, 2) as avg_uptime,
    ROUND(AVG(latency_avg)::numeric, 2) as avg_latency,
    ROUND(AVG(pix_score)::numeric, 2) as avg_pix_score
FROM nodes
WHERE chain = 'dingocoin'
GROUP BY tier
ORDER BY
    CASE tier
        WHEN 'diamond' THEN 1
        WHEN 'gold' THEN 2
        WHEN 'silver' THEN 3
        WHEN 'bronze' THEN 4
        WHEN 'standard' THEN 5
    END;

COMMENT ON VIEW tier_distribution IS 'Node distribution by tier with performance averages';

-- ============================================
-- MATERIALIZED VIEW: Network History Snapshots
-- ============================================
-- This captures point-in-time network state for historical trending
-- Refresh manually or via scheduled job

CREATE MATERIALIZED VIEW IF NOT EXISTS network_snapshots AS
SELECT
    NOW() as snapshot_time,
    'dingocoin' as chain,
    COUNT(*) as total_nodes,
    COUNT(*) FILTER (WHERE status = 'up') as online_nodes,
    COUNT(DISTINCT country_code) as countries,
    ROUND(AVG(uptime) FILTER (WHERE status = 'up')::numeric, 2) as avg_uptime,
    ROUND(AVG(latency_avg) FILTER (WHERE status = 'up')::numeric, 2) as avg_latency,
    ROUND(AVG(pix_score) FILTER (WHERE status = 'up')::numeric, 2) as avg_pix_score,

    -- Tier counts
    COUNT(*) FILTER (WHERE tier = 'diamond') as diamond_nodes,
    COUNT(*) FILTER (WHERE tier = 'gold') as gold_nodes,
    COUNT(*) FILTER (WHERE tier = 'silver') as silver_nodes,
    COUNT(*) FILTER (WHERE tier = 'bronze') as bronze_nodes,

    -- Top version
    (
        SELECT client_version
        FROM nodes
        WHERE chain = 'dingocoin' AND client_version IS NOT NULL
        GROUP BY client_version
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) as most_common_version

FROM nodes
WHERE chain = 'dingocoin';

-- Create unique index for refreshing
CREATE UNIQUE INDEX IF NOT EXISTS network_snapshots_time_chain_idx
ON network_snapshots (snapshot_time, chain);

COMMENT ON MATERIALIZED VIEW network_snapshots IS 'Point-in-time network statistics for historical trending. Refresh periodically.';

-- ============================================
-- FUNCTION: Refresh network snapshots
-- ============================================
CREATE OR REPLACE FUNCTION refresh_network_snapshots()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY network_snapshots;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_network_snapshots IS 'Refresh the network_snapshots materialized view for historical data';

-- ============================================
-- TABLE: Network Snapshots History (persistent)
-- ============================================
-- Store historical snapshots permanently (materialized view is for caching)

CREATE TABLE IF NOT EXISTS network_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_time timestamptz NOT NULL DEFAULT NOW(),
    chain text NOT NULL DEFAULT 'dingocoin',
    total_nodes integer NOT NULL,
    online_nodes integer NOT NULL,
    countries integer NOT NULL,
    avg_uptime numeric,
    avg_latency numeric,
    avg_pix_score numeric,
    diamond_nodes integer DEFAULT 0,
    gold_nodes integer DEFAULT 0,
    silver_nodes integer DEFAULT 0,
    bronze_nodes integer DEFAULT 0,
    most_common_version text,
    created_at timestamptz DEFAULT NOW()
);

-- Create index for time-series queries
CREATE INDEX IF NOT EXISTS idx_network_history_time ON network_history(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_network_history_chain ON network_history(chain);

COMMENT ON TABLE network_history IS 'Historical network statistics stored permanently for trending analysis';

-- ============================================
-- FUNCTION: Save current network snapshot to history
-- ============================================
CREATE OR REPLACE FUNCTION save_network_snapshot()
RETURNS void AS $$
BEGIN
    INSERT INTO network_history (
        snapshot_time,
        chain,
        total_nodes,
        online_nodes,
        countries,
        avg_uptime,
        avg_latency,
        avg_pix_score,
        diamond_nodes,
        gold_nodes,
        silver_nodes,
        bronze_nodes,
        most_common_version
    )
    SELECT
        NOW(),
        chain,
        total_nodes,
        online_nodes,
        countries,
        avg_uptime,
        avg_latency,
        avg_pix_score,
        diamond_nodes,
        gold_nodes,
        silver_nodes,
        bronze_nodes,
        most_common_version
    FROM network_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION save_network_snapshot IS 'Save current network statistics to permanent history table';

-- ============================================
-- Grant permissions for API access
-- ============================================
GRANT SELECT ON network_stats TO anon, authenticated;
GRANT SELECT ON version_distribution TO anon, authenticated;
GRANT SELECT ON country_distribution TO anon, authenticated;
GRANT SELECT ON tier_distribution TO anon, authenticated;
GRANT SELECT ON network_snapshots TO anon, authenticated;
GRANT SELECT ON network_history TO anon, authenticated;

-- ============================================
-- Initial snapshot save
-- ============================================
SELECT save_network_snapshot();
