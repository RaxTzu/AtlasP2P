-- ===========================================
-- MIGRATION: API Keys System
-- ===========================================
-- Allows users to create API keys for programmatic access to public endpoints
-- Supports key generation, revocation, rotation, and usage tracking

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Key identification
  name TEXT NOT NULL,  -- User-friendly name for the key
  key_prefix TEXT NOT NULL,  -- First 8 chars of key for identification (e.g., "dingo_sk_")
  key_hash TEXT NOT NULL,  -- SHA-256 hash of the full key (we never store the raw key)

  -- Key metadata
  description TEXT,

  -- Permissions (bitfield or JSON for granular control)
  -- For now, we use simple scopes
  scopes TEXT[] DEFAULT ARRAY['read:nodes', 'read:stats', 'read:leaderboard'],

  -- Rate limiting
  rate_limit INT DEFAULT 1000,  -- Requests per hour

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,  -- Optional expiration
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique key hash
  UNIQUE(key_hash)
);

-- API key usage logs (for detailed analytics)
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request info
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  response_time_ms INT,

  -- Client info
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at DESC);

-- Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own API keys
CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Users can view their own API key usage
CREATE POLICY "Users can view own API key usage"
  ON api_key_usage FOR SELECT
  USING (
    key_id IN (
      SELECT id FROM api_keys WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for API middleware)
CREATE POLICY "Service role full access to api_keys"
  ON api_keys FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to api_key_usage"
  ON api_key_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.api_keys TO authenticator;
GRANT INSERT, SELECT ON TABLE public.api_key_usage TO authenticator;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_api_key_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_key_timestamp();

-- Function to validate API key and update usage
CREATE OR REPLACE FUNCTION validate_api_key(
  p_key_hash TEXT,
  p_endpoint TEXT DEFAULT NULL,
  p_method TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE(
  key_id UUID,
  user_id UUID,
  scopes TEXT[],
  rate_limit INT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key RECORD;
BEGIN
  -- Find the key
  SELECT * INTO v_key
  FROM api_keys k
  WHERE k.key_hash = p_key_hash
    AND k.is_active = true
    AND k.revoked_at IS NULL
    AND (k.expires_at IS NULL OR k.expires_at > NOW())
  LIMIT 1;

  IF v_key IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::TEXT[],
      NULL::INT,
      false;
    RETURN;
  END IF;

  -- Update usage stats
  UPDATE api_keys
  SET
    last_used_at = NOW(),
    request_count = request_count + 1
  WHERE id = v_key.id;

  -- Log usage if endpoint provided
  IF p_endpoint IS NOT NULL THEN
    INSERT INTO api_key_usage (key_id, endpoint, method, ip_address)
    VALUES (v_key.id, p_endpoint, COALESCE(p_method, 'GET'), p_ip_address);
  END IF;

  RETURN QUERY SELECT
    v_key.id,
    v_key.user_id,
    v_key.scopes,
    v_key.rate_limit,
    true;
END;
$$;
