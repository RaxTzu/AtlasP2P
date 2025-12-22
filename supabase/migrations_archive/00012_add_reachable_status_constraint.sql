-- ============================================
-- MIGRATION: Update nodes status constraint to allow 'reachable'
-- ============================================
-- The original constraint only allowed: pending, up, down
-- We need to add 'reachable' for nodes where TCP connects but P2P handshake fails

-- Drop the old constraint and add the new one
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_status_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_status_check
    CHECK (status IN ('pending', 'up', 'down', 'reachable'));

-- Update comment to document the status values
COMMENT ON COLUMN nodes.status IS 'Node status: pending (not checked), up (full P2P handshake), reachable (TCP only, handshake failed), down (connection failed)';
