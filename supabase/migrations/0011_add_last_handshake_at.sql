-- Track when a node last completed a full P2P version/verack handshake.
--
-- Why: status="reachable" means TCP succeeded but handshake did not. Without
-- a separate timestamp, we cannot distinguish a node that handshook 5 minutes
-- ago and is currently flapping (legit peer) from a node whose port has been
-- TCP-reachable for weeks but never speaks our chain (stale/wrong-chain).
-- The crawler uses this column to back off re-crawl cadence on long-stale
-- "reachable" nodes, cutting wasted connection attempts ~6x without altering
-- status semantics. Status remains observation truth.

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_handshake_at TIMESTAMPTZ;

-- Backfill: existing "up" and "reachable" rows almost certainly handshook at
-- or before last_seen; using last_seen as the seed avoids a one-time regression
-- that would push every current row into slow cadence on first deploy.
UPDATE nodes
SET last_handshake_at = last_seen
WHERE last_handshake_at IS NULL
  AND status IN ('up', 'reachable')
  AND last_seen IS NOT NULL;

-- Partial index: only "reachable" rows benefit from cadence lookup. Keeps the
-- index small and write-amplification negligible.
CREATE INDEX IF NOT EXISTS idx_nodes_reachable_handshake
  ON nodes (last_handshake_at)
  WHERE status = 'reachable';

-- Surface the new column through the public view so API consumers can build
-- their own "active = handshook within X" filter without re-deriving from
-- the protected nodes table.
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
  n.last_handshake_at,
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

GRANT SELECT ON nodes_public TO anon, authenticated;
