-- Migration: Add pending changes support for profile moderation
-- This allows profile edits to require admin approval

-- Add pending_changes column to node_profiles
ALTER TABLE node_profiles
ADD COLUMN IF NOT EXISTS pending_changes JSONB DEFAULT NULL;

-- Add has_pending_changes computed column (for easy querying)
ALTER TABLE node_profiles
ADD COLUMN IF NOT EXISTS has_pending_changes BOOLEAN GENERATED ALWAYS AS (pending_changes IS NOT NULL) STORED;

-- Add pending_submitted_at timestamp
ALTER TABLE node_profiles
ADD COLUMN IF NOT EXISTS pending_submitted_at TIMESTAMPTZ DEFAULT NULL;

-- Update moderation_queue to handle 'profile' item_type
COMMENT ON COLUMN moderation_queue.item_type IS 'Type of item: verification, avatar, profile';

-- Create index for finding profiles with pending changes
CREATE INDEX IF NOT EXISTS idx_node_profiles_has_pending
ON node_profiles(has_pending_changes)
WHERE has_pending_changes = true;
