-- ===========================================
-- MIGRATION: Add previous_status to nodes for alert tracking
-- ===========================================
-- This allows us to detect status changes (up→down or down→up)
-- for sending alerts

-- Add previous_status column
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- Create a trigger to track status changes
CREATE OR REPLACE FUNCTION track_node_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.previous_status = OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS node_status_change ON nodes;

-- Create trigger
CREATE TRIGGER node_status_change
  BEFORE UPDATE ON nodes
  FOR EACH ROW
  EXECUTE FUNCTION track_node_status_change();

-- Index for efficient alert queries
CREATE INDEX IF NOT EXISTS idx_nodes_status_change ON nodes(status, previous_status, updated_at)
  WHERE previous_status IS NOT NULL;
