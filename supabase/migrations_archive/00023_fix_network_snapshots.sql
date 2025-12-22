-- Fix Network Snapshots Architecture
--
-- Problems fixed:
-- 1. Name collision: materialized view and table both named 'network_snapshots'
-- 2. Redundant table: network_history has same data as network_snapshots
-- 3. Missing function: create_network_snapshot() for crawler integration
--
-- New architecture:
-- - Crawler creates snapshots automatically after each crawl pass
-- - SQL function handles deduplication (only create if >55 minutes since last)
-- - No external cron jobs required

-- Step 1: Drop conflicting materialized view
DROP MATERIALIZED VIEW IF EXISTS network_snapshots CASCADE;

-- Step 2: Drop redundant network_history table
DROP TABLE IF EXISTS network_history CASCADE;

-- Step 3: Ensure network_snapshots table has correct structure
-- (Table already exists from 00002_initial_schema.sql, just verify/update)
ALTER TABLE IF EXISTS network_snapshots
  ALTER COLUMN snapshot_time SET DEFAULT NOW(),
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Add index if not exists (for fast time-range queries)
CREATE INDEX IF NOT EXISTS idx_network_snapshots_chain_time
  ON network_snapshots(chain, snapshot_time DESC);

-- Step 4: Create the snapshot creation function
-- This function is called by the crawler after each crawl pass
-- It automatically deduplicates to prevent multiple snapshots within an hour
CREATE OR REPLACE FUNCTION create_network_snapshot(p_chain TEXT)
RETURNS TABLE (
    snapshot_id UUID,
    snapshot_ts TIMESTAMPTZ,
    total_nodes_count INTEGER,
    online_nodes_count INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_snapshot TIMESTAMPTZ;
    v_threshold INTERVAL := '55 minutes';
BEGIN
    -- Check when last snapshot was created
    SELECT MAX(snapshot_time) INTO v_last_snapshot
    FROM network_snapshots
    WHERE chain = p_chain;

    -- Only create if >55 minutes since last (prevents duplicates from frequent crawls)
    IF v_last_snapshot IS NULL OR (NOW() - v_last_snapshot) > v_threshold THEN
        -- Insert new snapshot with current network state
        INSERT INTO network_snapshots (
            chain,
            snapshot_time,
            total_nodes,
            online_nodes,
            countries,
            avg_latency,
            avg_uptime
        )
        SELECT
            p_chain,
            NOW(),
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'up') AS online,
            COUNT(DISTINCT country_code) AS countries,
            ROUND(AVG(latency_avg) FILTER (WHERE latency_avg IS NOT NULL), 2) AS avg_lat,
            ROUND(AVG(uptime), 2) AS avg_up
        FROM nodes
        WHERE chain = p_chain
        RETURNING id, snapshot_time, total_nodes, online_nodes
        INTO snapshot_id, snapshot_ts, total_nodes_count, online_nodes_count;

        RETURN NEXT;
    END IF;
    -- If within threshold, return nothing (indicates duplicate prevented)
END;
$$;

-- Grant execute permission to service_role (used by crawler)
GRANT EXECUTE ON FUNCTION create_network_snapshot(TEXT) TO service_role;

-- Also grant to authenticated for manual API calls
GRANT EXECUTE ON FUNCTION create_network_snapshot(TEXT) TO authenticated;

-- Step 5: Add comment explaining the architecture
COMMENT ON FUNCTION create_network_snapshot IS
'Creates network snapshot for historical tracking. Called automatically by crawler after each crawl pass. Deduplicates to hourly intervals (only creates if >55 minutes since last snapshot). Returns snapshot data if created, empty if duplicate prevented.';

COMMENT ON TABLE network_snapshots IS
'Historical network state snapshots. Created automatically by crawler every ~60 minutes for growth metrics (24h/7d/30d trends). Do NOT require external cron jobs.';
