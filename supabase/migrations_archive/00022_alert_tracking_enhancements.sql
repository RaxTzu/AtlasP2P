/**
 * Alert Tracking Enhancements
 *
 * Adds columns and triggers needed for complete alert functionality:
 * - previous_status_changed_at: Track when status changed (for downtime calculation)
 * - previous_tier: Track tier changes (for tier change alerts)
 */

-- Add timestamp column to track when status last changed
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS previous_status_changed_at timestamp with time zone;

-- Add column to track previous tier for tier change detection
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS previous_tier text;

-- Add constraint to match tier values
ALTER TABLE nodes ADD CONSTRAINT nodes_previous_tier_check
  CHECK (previous_tier IS NULL OR previous_tier = ANY (ARRAY['diamond'::text, 'gold'::text, 'silver'::text, 'bronze'::text, 'standard'::text]));

-- Update the status change tracking function to include timestamp
CREATE OR REPLACE FUNCTION track_node_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- For new nodes, set previous_status to 'unknown' so first status is detectable
    NEW.previous_status = 'unknown';
    -- Set previous_is_current_version to NULL (no previous version to compare)
    NEW.previous_is_current_version = NULL;
    -- Set initial timestamp
    NEW.previous_status_changed_at = NOW();
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only track if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.previous_status = OLD.status;
      NEW.previous_status_changed_at = OLD.updated_at; -- When it was last in the old status
    END IF;
    -- Track version currency changes
    IF OLD.is_current_version IS DISTINCT FROM NEW.is_current_version THEN
      NEW.previous_is_current_version = OLD.is_current_version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to track tier changes
CREATE OR REPLACE FUNCTION track_node_tier_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track tier changes
    IF OLD.tier IS DISTINCT FROM NEW.tier THEN
      NEW.previous_tier = OLD.tier;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for tier change tracking
DROP TRIGGER IF EXISTS node_tier_change ON nodes;
CREATE TRIGGER node_tier_change
  BEFORE UPDATE ON nodes
  FOR EACH ROW
  EXECUTE FUNCTION track_node_tier_change();

-- Create index for tier change queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_nodes_tier_change
  ON nodes(tier, previous_tier, updated_at)
  WHERE previous_tier IS NOT NULL AND tier != previous_tier;

-- Populate initial values for existing nodes
UPDATE nodes
SET previous_status_changed_at = COALESCE(updated_at, created_at)
WHERE previous_status_changed_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN nodes.previous_status_changed_at IS 'Timestamp when the node last changed status (for downtime duration calculation)';
COMMENT ON COLUMN nodes.previous_tier IS 'Previous tier value before last change (for tier change alerts)';
