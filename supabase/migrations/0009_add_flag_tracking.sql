-- Add columns to track who flagged an item for multi-admin review workflow
-- flagged_by: admin who flagged the item
-- flagged_at: when the item was flagged

ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES auth.users(id);
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS flagged_at timestamp with time zone;

-- Add index for efficient querying of flagged items
CREATE INDEX IF NOT EXISTS idx_moderation_queue_flagged_by ON moderation_queue(flagged_by) WHERE flagged_by IS NOT NULL;
