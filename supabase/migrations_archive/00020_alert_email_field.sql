-- ===========================================
-- MIGRATION: Add custom email field to alert subscriptions
-- ===========================================
-- Allow users to specify a custom email address for receiving alerts
-- instead of always using their account email.

ALTER TABLE alert_subscriptions
ADD COLUMN IF NOT EXISTS email_address TEXT;

-- Add a comment explaining the field
COMMENT ON COLUMN alert_subscriptions.email_address IS
  'Optional custom email for alerts. If NULL, uses the user account email.';
