-- ============================================
-- Fix Hardcoded Chain Values
-- ============================================
-- This migration removes hardcoded 'dingocoin' references
-- to make the database truly chain-agnostic
--
-- Changes:
-- 1. Remove hardcoded chain filters from views
-- 2. Remove DEFAULT 'dingocoin' from tables
-- 3. Make all aggregations chain-agnostic
-- ============================================

-- ============================================
-- Drop and recreate network_stats view
-- ============================================
DROP VIEW IF EXISTS network_stats CASCADE;

CREATE OR REPLACE VIEW network_stats AS
SELECT
    -- Use actual chain from nodes table (assumes single-chain deployment)
    -- For multi-chain, you would GROUP BY chain
    (SELECT chain FROM nodes LIMIT 1) as chain,
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
    ROUND(
        ((COUNT(*) FILTER (WHERE status = 'up')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100 * 0.4) +
        (AVG(uptime) FILTER (WHERE status = 'up') * 0.3) +
        ((COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up')::numeric /
          NULLIF(COUNT(*) FILTER (WHERE status = 'up')::numeric, 0)) * 100 * 0.2) +
        ((AVG(pix_score) FILTER (WHERE status = 'up') / 10) * 0.1),
        2
    ) as network_health_score

FROM nodes;

COMMENT ON VIEW network_stats IS 'Real-time aggregate network statistics (chain-agnostic)';

-- ============================================
-- Drop and recreate version_distribution view
-- ============================================
DROP VIEW IF EXISTS version_distribution CASCADE;

CREATE OR REPLACE VIEW version_distribution AS
SELECT
    client_version as version,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::numeric / (SELECT COUNT(*) FROM nodes)::numeric) * 100,
        2
    ) as percentage,
    COUNT(*) FILTER (WHERE status = 'up') as online_count,
    is_current_version
FROM nodes
WHERE client_version IS NOT NULL
GROUP BY client_version, is_current_version
ORDER BY count DESC;

COMMENT ON VIEW version_distribution IS 'Distribution of client versions across the network (chain-agnostic)';

-- ============================================
-- Drop and recreate country_distribution view
-- ============================================
DROP VIEW IF EXISTS country_distribution CASCADE;

CREATE OR REPLACE VIEW country_distribution AS
SELECT
    country_code,
    country_name,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::numeric / (SELECT COUNT(*) FROM nodes)::numeric) * 100,
        2
    ) as percentage,
    COUNT(*) FILTER (WHERE status = 'up') as online_count
FROM nodes
WHERE country_code IS NOT NULL
GROUP BY country_code, country_name
ORDER BY count DESC;

COMMENT ON VIEW country_distribution IS 'Geographic distribution of nodes by country (chain-agnostic)';

-- ============================================
-- Drop and recreate tier_distribution view
-- ============================================
DROP VIEW IF EXISTS tier_distribution CASCADE;

CREATE OR REPLACE VIEW tier_distribution AS
SELECT
    tier,
    COUNT(*) as count,
    ROUND(
        (COUNT(*)::numeric / (SELECT COUNT(*) FROM nodes)::numeric) * 100,
        2
    ) as percentage,
    COUNT(*) FILTER (WHERE status = 'up') as online_count,
    ROUND(AVG(uptime)::numeric, 2) as avg_uptime,
    ROUND(AVG(latency_avg)::numeric, 2) as avg_latency,
    ROUND(AVG(pix_score)::numeric, 2) as avg_pix_score
FROM nodes
GROUP BY tier
ORDER BY
    CASE tier
        WHEN 'diamond' THEN 1
        WHEN 'gold' THEN 2
        WHEN 'silver' THEN 3
        WHEN 'bronze' THEN 4
        WHEN 'standard' THEN 5
    END;

COMMENT ON VIEW tier_distribution IS 'Node distribution by tier with performance averages (chain-agnostic)';

-- ============================================
-- Drop and recreate network_snapshots materialized view
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS network_snapshots CASCADE;

CREATE MATERIALIZED VIEW network_snapshots AS
SELECT
    NOW() as snapshot_time,
    (SELECT chain FROM nodes LIMIT 1) as chain,
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
        WHERE client_version IS NOT NULL
        GROUP BY client_version
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) as most_common_version

FROM nodes;

-- Create unique index for refreshing
CREATE UNIQUE INDEX IF NOT EXISTS network_snapshots_time_chain_idx
ON network_snapshots (snapshot_time, chain);

COMMENT ON MATERIALIZED VIEW network_snapshots IS 'Point-in-time network statistics (chain-agnostic). Refresh periodically.';

-- ============================================
-- Update network_history table default
-- ============================================
-- Remove the DEFAULT 'dingocoin' from network_history table
ALTER TABLE network_history ALTER COLUMN chain DROP DEFAULT;

-- Add comment explaining chain should come from nodes
COMMENT ON COLUMN network_history.chain IS 'Blockchain network identifier (must match nodes.chain)';

-- ============================================
-- Regrant permissions
-- ============================================
GRANT SELECT ON network_stats TO anon, authenticated;
GRANT SELECT ON version_distribution TO anon, authenticated;
GRANT SELECT ON country_distribution TO anon, authenticated;
GRANT SELECT ON tier_distribution TO anon, authenticated;
GRANT SELECT ON network_snapshots TO anon, authenticated;

-- ============================================
-- NOTE FOR FORKERS
-- ============================================
-- All views are now chain-agnostic!
-- They will automatically work with ANY blockchain as long as:
-- 1. NEXT_PUBLIC_CHAIN is set in your environment
-- 2. The crawler inserts nodes with the correct chain value
-- 3. All nodes in the database are for the same chain (single-chain deployment)
--
-- For multi-chain deployments, you would need to add GROUP BY chain
-- or create separate views per chain.
-- ============================================
