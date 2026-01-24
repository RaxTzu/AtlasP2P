-- ===========================================
-- ATLASP2P - FUNCTIONS, VIEWS & TRIGGERS
-- ===========================================
-- Performance metrics, statistics views, automation
-- ===========================================

-- Performance Metrics
CREATE OR REPLACE FUNCTION calculate_node_metrics(target_node_id UUID)
RETURNS VOID AS $$
DECLARE
    snapshot_window_days INTEGER := 7;
    days_since_first_seen NUMERIC;
BEGIN
    UPDATE nodes n SET uptime = (SELECT COALESCE((COUNT(*) FILTER (WHERE is_online = true)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 0) FROM node_snapshots WHERE node_id = target_node_id AND snapshot_time > NOW() - (snapshot_window_days || ' days')::INTERVAL) WHERE n.id = target_node_id;
    UPDATE nodes n SET latency_avg = (SELECT AVG(response_time_ms) FROM node_snapshots WHERE node_id = target_node_id AND is_online = true AND response_time_ms IS NOT NULL AND snapshot_time > NOW() - (snapshot_window_days || ' days')::INTERVAL) WHERE n.id = target_node_id;
    UPDATE nodes n SET reliability = (SELECT COALESCE((COUNT(*) FILTER (WHERE is_online = true)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 0) FROM node_snapshots WHERE node_id = target_node_id) WHERE n.id = target_node_id;
    UPDATE nodes n SET pix_score = LEAST(1000, GREATEST(0, (COALESCE(n.uptime, 0) * 0.5) + ((100 - COALESCE(n.latency_avg, 500)) * 0.3) + (COALESCE(n.reliability, 0) * 0.2))) WHERE n.id = target_node_id;
    SELECT EXTRACT(EPOCH FROM (NOW() - first_seen)) / 86400 INTO days_since_first_seen FROM nodes WHERE id = target_node_id;
    UPDATE nodes n SET tier = CASE
        WHEN n.uptime >= 99.9 AND days_since_first_seen >= 90 AND n.is_verified = true AND COALESCE(n.latency_avg, 1000) < 50 AND n.status = 'up' THEN 'diamond'
        WHEN n.uptime >= 99.0 AND days_since_first_seen >= 60 AND n.is_current_version = true AND COALESCE(n.latency_avg, 1000) < 100 AND n.status = 'up' THEN 'gold'
        WHEN n.uptime >= 95.0 AND days_since_first_seen >= 30 AND n.is_verified = true AND n.status = 'up' THEN 'silver'
        WHEN n.is_verified = true AND n.uptime >= 90.0 AND n.status = 'up' THEN 'bronze'
        ELSE 'standard'
    END WHERE n.id = target_node_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_all_node_metrics()
RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE node_record RECORD; count INTEGER := 0;
BEGIN
    FOR node_record IN SELECT id FROM nodes LOOP PERFORM calculate_node_metrics(node_record.id); count := count + 1; END LOOP;
    WITH ranked AS (SELECT id, ROW_NUMBER() OVER (ORDER BY pix_score DESC NULLS LAST, uptime DESC NULLS LAST, latency_avg ASC NULLS LAST) as new_rank FROM nodes WHERE status = 'up')
    UPDATE nodes n SET rank = ranked.new_rank FROM ranked WHERE n.id = ranked.id;
    RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Views (chain-agnostic from 00030)
CREATE OR REPLACE VIEW network_stats AS
SELECT (SELECT chain FROM nodes LIMIT 1) as chain, NOW() as timestamp,
    COUNT(*) as total_nodes,
    COUNT(*) FILTER (WHERE status = 'up') as online_nodes,
    COUNT(*) FILTER (WHERE status = 'down') as offline_nodes,
    COUNT(DISTINCT country_code) FILTER (WHERE country_code IS NOT NULL) as countries,
    COUNT(*) FILTER (WHERE is_verified = true) as verified_nodes,
    COUNT(*) FILTER (WHERE tier = 'diamond') as diamond_nodes,
    COUNT(*) FILTER (WHERE tier = 'gold') as gold_nodes,
    COUNT(*) FILTER (WHERE tier = 'silver') as silver_nodes,
    COUNT(*) FILTER (WHERE tier = 'bronze') as bronze_nodes,
    COUNT(*) FILTER (WHERE tier = 'standard') as standard_nodes,
    ROUND(AVG(uptime) FILTER (WHERE status = 'up')::NUMERIC, 2) as avg_uptime,
    ROUND(AVG(latency_avg) FILTER (WHERE status = 'up')::NUMERIC, 2) as avg_latency,
    ROUND(AVG(pix_score) FILTER (WHERE status = 'up')::NUMERIC, 2) as avg_pix_score,
    COUNT(DISTINCT client_version) FILTER (WHERE client_version IS NOT NULL) as version_count,
    COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up') as up_to_date_nodes,
    ROUND((COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE status = 'up')::NUMERIC, 0)) * 100, 2) as version_adoption_rate,
    ROUND(((COUNT(*) FILTER (WHERE status = 'up')::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100 * 0.4) + (AVG(uptime) FILTER (WHERE status = 'up') * 0.3) + ((COUNT(*) FILTER (WHERE is_current_version = true AND status = 'up')::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE status = 'up')::NUMERIC, 0)) * 100 * 0.2) + ((AVG(pix_score) FILTER (WHERE status = 'up') / 10) * 0.1), 2) as network_health_score
FROM nodes;

CREATE OR REPLACE VIEW version_distribution AS
SELECT
  -- Normalize version: use parsed major.minor.patch if available, fallback to raw client_version
  -- This groups "/Gotoshi:1.18.0/" and "/Gotoshi:1.18.0(lucky-dingo)/" together as "1.18.0"
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

CREATE OR REPLACE VIEW country_distribution AS
SELECT country_code, country_name, COUNT(*) as count, ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM nodes)::NUMERIC) * 100, 2) as percentage, COUNT(*) FILTER (WHERE status = 'up') as online_count
FROM nodes WHERE country_code IS NOT NULL GROUP BY country_code, country_name ORDER BY count DESC;

CREATE OR REPLACE VIEW tier_distribution AS
SELECT tier, COUNT(*) as count, ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM nodes)::NUMERIC) * 100, 2) as percentage, COUNT(*) FILTER (WHERE status = 'up') as online_count, ROUND(AVG(uptime)::NUMERIC, 2) as avg_uptime, ROUND(AVG(latency_avg)::NUMERIC, 2) as avg_latency, ROUND(AVG(pix_score)::NUMERIC, 2) as avg_pix_score
FROM nodes GROUP BY tier ORDER BY CASE tier WHEN 'diamond' THEN 1 WHEN 'gold' THEN 2 WHEN 'silver' THEN 3 WHEN 'bronze' THEN 4 WHEN 'standard' THEN 5 END;

CREATE OR REPLACE VIEW nodes_public AS
SELECT n.id, host(n.ip) as ip, n.port, n.address, n.chain, n.status, (n.status = 'up') as is_online, n.country_code, n.country_name, n.city, n.latitude, n.longitude, n.region, n.timezone, n.isp, n.org, n.asn, n.asn_org, n.connection_type, n.version, n.client_version, n.client_name, n.protocol_version, n.is_current_version, n.version_major, n.version_minor, n.version_patch, n.services, n.start_height, n.times_seen, n.uptime as uptime_percentage, n.latency_avg, n.reliability, n.tier, n.pix_score, n.rank, n.is_verified, n.tips_enabled, n.first_seen, n.last_seen, p.display_name, p.description, p.avatar_url, p.website, p.twitter, p.discord, p.telegram, p.github, p.tags, COALESCE(p.is_public, true) as is_public
FROM nodes n LEFT JOIN node_profiles p ON n.id = p.node_id AND p.is_public = true;

CREATE OR REPLACE VIEW leaderboard AS
SELECT n.id, n.address, COALESCE(p.display_name, n.address) as name, p.avatar_url, n.tier, n.pix_score, n.rank, n.uptime, n.latency_avg, n.country_code, n.is_verified, n.first_seen, n.chain
FROM nodes n LEFT JOIN node_profiles p ON n.id = p.node_id WHERE n.status = 'up' ORDER BY n.pix_score DESC NULLS LAST;

-- Helper Functions
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

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Track status and tier changes for alerts
CREATE OR REPLACE FUNCTION track_node_changes() RETURNS TRIGGER AS $$
BEGIN
    -- Track status changes (for downtime calculations)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.previous_status = OLD.status;
        NEW.previous_status_changed_at = NOW();
    END IF;

    -- Track tier changes (for tier change alerts)
    IF NEW.tier IS DISTINCT FROM OLD.tier THEN
        NEW.previous_tier = OLD.tier;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_node_changes_trigger ON nodes;
CREATE TRIGGER track_node_changes_trigger BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION track_node_changes();

DROP TRIGGER IF EXISTS update_nodes_updated_at ON nodes;
CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_node_profiles_updated_at ON node_profiles;
CREATE TRIGGER update_node_profiles_updated_at BEFORE UPDATE ON node_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_alert_subscriptions_updated_at ON alert_subscriptions;
CREATE TRIGGER update_alert_subscriptions_updated_at BEFORE UPDATE ON alert_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION trigger_update_node_metrics() RETURNS TRIGGER AS $$ BEGIN PERFORM calculate_node_metrics(NEW.node_id); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS node_snapshot_metrics_update ON node_snapshots;
CREATE TRIGGER node_snapshot_metrics_update AFTER INSERT ON node_snapshots FOR EACH ROW EXECUTE FUNCTION trigger_update_node_metrics();

CREATE OR REPLACE FUNCTION sync_tips_enabled() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN UPDATE nodes SET tips_enabled = false, updated_at = NOW() WHERE id = OLD.node_id; RETURN OLD;
    ELSIF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN UPDATE nodes SET tips_enabled = NEW.is_active, updated_at = NOW() WHERE id = NEW.node_id; RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS sync_tips_enabled_trigger ON node_tip_configs;
CREATE TRIGGER sync_tips_enabled_trigger AFTER INSERT OR UPDATE OR DELETE ON node_tip_configs FOR EACH ROW EXECUTE FUNCTION sync_tips_enabled();

-- Permissions
GRANT SELECT ON network_stats TO anon, authenticated;
GRANT SELECT ON version_distribution TO anon, authenticated;
GRANT SELECT ON country_distribution TO anon, authenticated;
GRANT SELECT ON tier_distribution TO anon, authenticated;
GRANT SELECT ON nodes_public TO anon, authenticated;
GRANT SELECT ON leaderboard TO anon, authenticated;

-- Initialize (skip if no nodes exist yet)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM nodes LIMIT 1) THEN
        PERFORM calculate_all_node_metrics();
        PERFORM save_network_snapshot();
    END IF;
END $$;
