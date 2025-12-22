-- ============================================
-- Performance Metrics Calculation System
-- ============================================
-- Calculates: uptime, latency_avg, reliability, pix_score, tier, rank
-- Based on data from node_snapshots table

-- ============================================
-- FUNCTION: Calculate metrics for a specific node
-- ============================================
CREATE OR REPLACE FUNCTION calculate_node_metrics(target_node_id uuid)
RETURNS void AS $$
DECLARE
    snapshot_window_days integer := 7;  -- Use last 7 days for calculations
    days_since_first_seen numeric;
BEGIN
    -- Calculate uptime percentage from snapshots (last 7 days)
    UPDATE nodes n
    SET uptime = (
        SELECT COALESCE(
            (COUNT(*) FILTER (WHERE is_online = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
            0
        )
        FROM node_snapshots
        WHERE node_id = target_node_id
          AND snapshot_time > NOW() - (snapshot_window_days || ' days')::interval
    )
    WHERE n.id = target_node_id;

    -- Calculate average latency from snapshots (last 7 days, only when online)
    UPDATE nodes n
    SET latency_avg = (
        SELECT AVG(response_time_ms)
        FROM node_snapshots
        WHERE node_id = target_node_id
          AND is_online = true
          AND response_time_ms IS NOT NULL
          AND snapshot_time > NOW() - (snapshot_window_days || ' days')::interval
    )
    WHERE n.id = target_node_id;

    -- Calculate reliability (overall success rate since first seen)
    UPDATE nodes n
    SET reliability = (
        SELECT COALESCE(
            (COUNT(*) FILTER (WHERE is_online = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
            0
        )
        FROM node_snapshots
        WHERE node_id = target_node_id
    )
    WHERE n.id = target_node_id;

    -- Calculate PIX score
    -- Formula: (uptime% × 0.5) + ((100 - latency_avg_ms) × 0.3) + (reliability% × 0.2)
    -- Clamped to 0-1000 range
    UPDATE nodes n
    SET pix_score = LEAST(1000, GREATEST(0,
        (COALESCE(n.uptime, 0) * 0.5) +
        ((100 - COALESCE(n.latency_avg, 500)) * 0.3) +
        (COALESCE(n.reliability, 0) * 0.2)
    ))
    WHERE n.id = target_node_id;

    -- Calculate days since first seen
    SELECT EXTRACT(EPOCH FROM (NOW() - first_seen)) / 86400
    INTO days_since_first_seen
    FROM nodes
    WHERE id = target_node_id;

    -- Assign tier based on metrics
    UPDATE nodes n
    SET tier = CASE
        -- Diamond: 99.9%+ uptime, 90+ days online, verified, low latency
        WHEN n.uptime >= 99.9
             AND days_since_first_seen >= 90
             AND n.is_verified = true
             AND COALESCE(n.latency_avg, 1000) < 50
             AND n.status = 'up'
             THEN 'diamond'

        -- Gold: 99%+ uptime, 60+ days, current version, low latency
        WHEN n.uptime >= 99.0
             AND days_since_first_seen >= 60
             AND n.is_current_version = true
             AND COALESCE(n.latency_avg, 1000) < 100
             AND n.status = 'up'
             THEN 'gold'

        -- Silver: 95%+ uptime, 30+ days, verified
        WHEN n.uptime >= 95.0
             AND days_since_first_seen >= 30
             AND n.is_verified = true
             AND n.status = 'up'
             THEN 'silver'

        -- Bronze: Verified node with decent uptime
        WHEN n.is_verified = true
             AND n.uptime >= 90.0
             AND n.status = 'up'
             THEN 'bronze'

        -- Standard: Everything else
        ELSE 'standard'
    END
    WHERE n.id = target_node_id;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_node_metrics IS 'Calculate performance metrics (uptime, latency_avg, reliability, pix_score, tier) for a specific node based on snapshots';

-- ============================================
-- FUNCTION: Calculate metrics for ALL nodes
-- ============================================
CREATE OR REPLACE FUNCTION calculate_all_node_metrics()
RETURNS TABLE(updated_count integer) AS $$
DECLARE
    node_record RECORD;
    count integer := 0;
BEGIN
    -- Loop through all nodes
    FOR node_record IN SELECT id FROM nodes LOOP
        PERFORM calculate_node_metrics(node_record.id);
        count := count + 1;
    END LOOP;

    -- Assign ranks after all metrics calculated
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
            ORDER BY
                pix_score DESC NULLS LAST,
                uptime DESC NULLS LAST,
                latency_avg ASC NULLS LAST
        ) as new_rank
        FROM nodes
        WHERE status = 'up'
    )
    UPDATE nodes n
    SET rank = ranked.new_rank
    FROM ranked
    WHERE n.id = ranked.id;

    RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_all_node_metrics IS 'Calculate metrics for all nodes and assign ranks. Returns count of updated nodes.';

-- ============================================
-- TRIGGER: Auto-calculate metrics after snapshot insert
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_node_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate metrics for the node that just got a new snapshot
    PERFORM calculate_node_metrics(NEW.node_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS node_snapshot_metrics_update ON node_snapshots;

-- Create trigger on node_snapshots
CREATE TRIGGER node_snapshot_metrics_update
AFTER INSERT ON node_snapshots
FOR EACH ROW
EXECUTE FUNCTION trigger_update_node_metrics();

COMMENT ON TRIGGER node_snapshot_metrics_update ON node_snapshots IS 'Automatically recalculate node metrics when a new snapshot is inserted';

-- ============================================
-- Initial calculation for existing nodes
-- ============================================
-- Run metrics calculation for all existing nodes
SELECT calculate_all_node_metrics();

-- Verification query (commented out - uncomment to test)
-- SELECT
--     id, address, status, tier,
--     ROUND(uptime::numeric, 2) as uptime_pct,
--     ROUND(latency_avg::numeric, 2) as avg_latency_ms,
--     ROUND(pix_score::numeric, 2) as pix,
--     rank
-- FROM nodes
-- WHERE status = 'up'
-- ORDER BY rank
-- LIMIT 10;
