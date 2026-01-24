-- Add version_major, version_minor, version_patch to nodes_public view
-- These fields are needed for frontend version status detection (outdated/critical rings)
-- Also fixes version_distribution to normalize versions with custom suffixes
-- E.g., "/Gotoshi:1.18.0/" and "/Gotoshi:1.18.0(lucky-dingo)/" both become "1.18.0"

CREATE OR REPLACE VIEW nodes_public AS
SELECT
  n.id,
  host(n.ip) as ip,
  n.port,
  n.address,
  n.chain,
  n.status,
  (n.status = 'up') as is_online,
  n.country_code,
  n.country_name,
  n.city,
  n.latitude,
  n.longitude,
  n.region,
  n.timezone,
  n.isp,
  n.org,
  n.asn,
  n.asn_org,
  n.connection_type,
  n.version,
  n.client_version,
  n.client_name,
  n.protocol_version,
  n.is_current_version,
  n.version_major,
  n.version_minor,
  n.version_patch,
  n.services,
  n.start_height,
  n.times_seen,
  n.uptime as uptime_percentage,
  n.latency_avg,
  n.reliability,
  n.tier,
  n.pix_score,
  n.rank,
  n.is_verified,
  n.tips_enabled,
  n.first_seen,
  n.last_seen,
  p.display_name,
  p.description,
  p.avatar_url,
  p.website,
  p.twitter,
  p.discord,
  p.telegram,
  p.github,
  p.tags,
  COALESCE(p.is_public, true) as is_public
FROM nodes n
LEFT JOIN node_profiles p ON n.id = p.node_id AND p.is_public = true;

-- Grant permissions (unchanged from original)
GRANT SELECT ON nodes_public TO anon, authenticated;

-- Fix version_distribution view to normalize versions with custom suffixes
-- This groups nodes with same version but different suffixes together
-- E.g., "/Gotoshi:1.18.0/" and "/Gotoshi:1.18.0(lucky-dingo)/" both become "1.18.0"
CREATE OR REPLACE VIEW version_distribution AS
SELECT
  -- Normalize version: use parsed major.minor.patch if available, fallback to raw client_version
  CASE
    WHEN version_major IS NOT NULL AND version_minor IS NOT NULL
    THEN CONCAT(version_major, '.', version_minor, '.', COALESCE(version_patch, 0))
    ELSE client_version
  END as version,
  COUNT(*) as count,
  ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM nodes)::NUMERIC) * 100, 2) as percentage,
  COUNT(*) FILTER (WHERE status = 'up') as online_count,
  is_current_version
FROM nodes
WHERE client_version IS NOT NULL
GROUP BY
  CASE
    WHEN version_major IS NOT NULL AND version_minor IS NOT NULL
    THEN CONCAT(version_major, '.', version_minor, '.', COALESCE(version_patch, 0))
    ELSE client_version
  END,
  is_current_version
ORDER BY count DESC;

-- Also update save_network_snapshot function to use normalized version for most_common_version
CREATE OR REPLACE FUNCTION save_network_snapshot(p_chain TEXT DEFAULT NULL) RETURNS VOID AS $$
BEGIN
    INSERT INTO network_history (snapshot_time, chain, total_nodes, online_nodes, countries, avg_uptime, avg_latency, avg_pix_score, diamond_nodes, gold_nodes, silver_nodes, bronze_nodes, most_common_version)
    SELECT NOW(), chain, total_nodes, online_nodes, countries, avg_uptime, avg_latency, avg_pix_score, diamond_nodes, gold_nodes, silver_nodes, bronze_nodes,
      (SELECT
        CASE
          WHEN version_major IS NOT NULL AND version_minor IS NOT NULL
          THEN CONCAT(version_major, '.', version_minor, '.', COALESCE(version_patch, 0))
          ELSE client_version
        END
      FROM nodes
      WHERE client_version IS NOT NULL AND (p_chain IS NULL OR chain = p_chain)
      GROUP BY
        CASE
          WHEN version_major IS NOT NULL AND version_minor IS NOT NULL
          THEN CONCAT(version_major, '.', version_minor, '.', COALESCE(version_patch, 0))
          ELSE client_version
        END
      ORDER BY COUNT(*) DESC LIMIT 1)
    FROM network_stats WHERE p_chain IS NULL OR chain = p_chain;
END;
$$ LANGUAGE plpgsql;
