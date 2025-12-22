-- ============================================
-- FIX: Add missing columns to nodes_public view
-- ============================================
-- The view was missing ip, port, services, times_seen, start_height
-- and other important fields that are used by the frontend

-- Drop and recreate to avoid column ordering issues
DROP VIEW IF EXISTS nodes_public CASCADE;

CREATE VIEW nodes_public AS
SELECT
    n.id,
    host(n.ip) as ip,  -- Convert INET to text
    n.port,
    n.address,
    n.chain,
    n.status,
    (n.status = 'up') as is_online,

    -- GeoIP
    n.country_code,
    n.country_name,
    n.city,
    n.latitude,
    n.longitude,
    n.isp,
    n.asn,
    n.connection_type,

    -- Version info
    n.version as version,  -- Already renamed in original view
    n.protocol_version,
    n.services,
    n.start_height,
    n.is_current_version,

    -- Performance metrics
    n.uptime as uptime_percentage,  -- Frontend expects uptime_percentage
    n.latency_avg,
    n.tier,
    n.pix_score,
    n.rank,

    -- Verification
    n.is_verified,
    n.tips_enabled,

    -- Timestamps
    n.first_seen,
    n.last_seen,
    n.times_seen,

    -- Profile data (from join)
    p.display_name,
    p.avatar_url,
    p.description,
    p.website,
    p.twitter,
    p.github,
    p.discord,
    p.telegram,
    COALESCE(p.is_public, true) as is_public
FROM nodes n
LEFT JOIN node_profiles p ON n.id = p.node_id AND p.is_public = true;

COMMENT ON VIEW nodes_public IS 'Public node data with profile information - includes ALL fields needed by frontend';
