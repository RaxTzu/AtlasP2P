-- ===========================================
-- MIGRATION: Alert Subscriptions System
-- ===========================================
-- Allows users to subscribe to node alerts via email or webhook (Discord)

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
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one subscription per user per node (or global)
  UNIQUE(user_id, node_id)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_node ON alert_subscriptions(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_subscription ON alert_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_node ON alert_history(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at DESC);

-- Row Level Security
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

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

-- Grant permissions to the authenticator role
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

CREATE TRIGGER alert_subscriptions_updated_at
  BEFORE UPDATE ON alert_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_subscription_timestamp();

-- Add to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE alert_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE alert_history;
