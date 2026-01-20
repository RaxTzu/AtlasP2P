-- ===========================================
-- ADD PENDING SUBMITTED TIMESTAMP TO NODE PROFILES
-- ===========================================
-- Track when pending changes were submitted for moderation

ALTER TABLE node_profiles
ADD COLUMN IF NOT EXISTS pending_submitted_at TIMESTAMPTZ;

-- Add index for efficient moderation queue queries
CREATE INDEX IF NOT EXISTS idx_node_profiles_pending_submitted
ON node_profiles(pending_submitted_at)
WHERE pending_submitted_at IS NOT NULL;
