-- ===========================================
-- MIGRATION: Fix Alert System
-- ===========================================
-- Addresses critical issues found in security audit:
-- 1. Ensures alert tables exist (they may have been dropped)
-- 2. Fixes previous_status trigger to handle INSERT operations
-- 3. Adds previous_is_current_version for version change detection
-- 4. Fixes unique constraint for global subscriptions (NULL node_id)

-- ===========================================
-- 1. ENSURE ALERT TABLES EXIST
-- ===========================================

-- Alert subscriptions table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,  -- NULL = all user's verified nodes

  -- Alert types (what to notify about)
  alert_offline BOOLEAN DEFAULT true,
  alert_online BOOLEAN DEFAULT true,
  alert_version_outdated BOOLEAN DEFAULT false,
  alert_tier_change BOOLEAN DEFAULT false,

  -- Email notifications
  email_enabled BOOLEAN DEFAULT true,

  -- Webhook notifications (Discord, Slack, etc.)
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_type TEXT DEFAULT 'discord',  -- discord, slack, generic

  -- Throttling to prevent spam
  cooldown_minutes INT DEFAULT 60,
  last_alert_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history table (for tracking sent alerts)
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,  -- offline, online, version_outdated, tier_change

  -- Delivery status
  email_sent BOOLEAN DEFAULT false,
  email_error TEXT,
  webhook_sent BOOLEAN DEFAULT false,
  webhook_error TEXT,

  -- Alert details
  message TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_node ON alert_subscriptions(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_subscription ON alert_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_node ON alert_history(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at DESC);

-- ===========================================
-- 2. FIX UNIQUE CONSTRAINT FOR NULL node_id
-- ===========================================
-- The UNIQUE(user_id, node_id) constraint allows multiple NULLs in PostgreSQL
-- We need a partial unique index to properly handle global subscriptions

-- Drop old constraint if it exists (it may not properly handle NULLs)
ALTER TABLE alert_subscriptions DROP CONSTRAINT IF EXISTS alert_subscriptions_user_id_node_id_key;

-- Create proper unique constraint for specific node subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_subscriptions_user_node_unique
  ON alert_subscriptions(user_id, node_id)
  WHERE node_id IS NOT NULL;

-- Create unique constraint for global subscriptions (only one per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_subscriptions_user_global_unique
  ON alert_subscriptions(user_id)
  WHERE node_id IS NULL;

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS if not already enabled
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they exist correctly
DROP POLICY IF EXISTS "Users can view own subscriptions" ON alert_subscriptions;
DROP POLICY IF EXISTS "Users can create own subscriptions" ON alert_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON alert_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON alert_subscriptions;
DROP POLICY IF EXISTS "Users can view own alert history" ON alert_history;
DROP POLICY IF EXISTS "Service role full access to subscriptions" ON alert_subscriptions;
DROP POLICY IF EXISTS "Service role full access to history" ON alert_history;

-- Users can only manage their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON alert_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON alert_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON alert_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON alert_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Users can view their own alert history
CREATE POLICY "Users can view own alert history"
  ON alert_history FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM alert_subscriptions WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for crawler/background jobs)
CREATE POLICY "Service role full access to subscriptions"
  ON alert_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to history"
  ON alert_history FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.alert_subscriptions TO authenticator;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.alert_history TO authenticator;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_alert_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alert_subscriptions_updated_at ON alert_subscriptions;
CREATE TRIGGER alert_subscriptions_updated_at
  BEFORE UPDATE ON alert_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_subscription_timestamp();

-- Add to realtime publication (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alert_subscriptions;
EXCEPTION WHEN duplicate_object THEN
  -- Table already in publication, ignore
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alert_history;
EXCEPTION WHEN duplicate_object THEN
  -- Table already in publication, ignore
END $$;

-- ===========================================
-- 4. FIX PREVIOUS_STATUS TRACKING
-- ===========================================
-- The old trigger only runs on UPDATE, not INSERT
-- New nodes need previous_status initialized to 'unknown' so we can detect their first status

-- Ensure previous_status column exists
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- Add previous_is_current_version for version change detection
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS previous_is_current_version BOOLEAN;

-- Create improved trigger function that handles both INSERT and UPDATE
CREATE OR REPLACE FUNCTION track_node_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- For new nodes, set previous_status to 'unknown' so first status is detectable
    NEW.previous_status = 'unknown';
    -- Set previous_is_current_version to NULL (no previous version to compare)
    NEW.previous_is_current_version = NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only track if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.previous_status = OLD.status;
    END IF;
    -- Track version currency changes
    IF OLD.is_current_version IS DISTINCT FROM NEW.is_current_version THEN
      NEW.previous_is_current_version = OLD.is_current_version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers
DROP TRIGGER IF EXISTS node_status_change ON nodes;
DROP TRIGGER IF EXISTS node_status_change_insert ON nodes;

-- Create triggers for both INSERT and UPDATE
CREATE TRIGGER node_status_change_insert
  BEFORE INSERT ON nodes
  FOR EACH ROW
  EXECUTE FUNCTION track_node_status_change();

CREATE TRIGGER node_status_change
  BEFORE UPDATE ON nodes
  FOR EACH ROW
  EXECUTE FUNCTION track_node_status_change();

-- Index for efficient alert queries
DROP INDEX IF EXISTS idx_nodes_status_change;
CREATE INDEX idx_nodes_status_change ON nodes(status, previous_status, updated_at)
  WHERE previous_status IS NOT NULL;

-- Index for version change queries
CREATE INDEX IF NOT EXISTS idx_nodes_version_change ON nodes(is_current_version, previous_is_current_version, updated_at)
  WHERE previous_is_current_version IS NOT NULL;

-- ===========================================
-- 5. INITIALIZE EXISTING NODES
-- ===========================================
-- Set previous_status for existing nodes that don't have it set
-- This prevents false alerts for existing nodes

UPDATE nodes
SET previous_status = status
WHERE previous_status IS NULL;

UPDATE nodes
SET previous_is_current_version = is_current_version
WHERE previous_is_current_version IS NULL AND is_current_version IS NOT NULL;
