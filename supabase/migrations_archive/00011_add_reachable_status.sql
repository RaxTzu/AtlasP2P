-- ===========================================
-- MIGRATION: Add 'reachable' status for nodes
-- ===========================================
-- This allows distinguishing between:
-- - 'up': Full P2P handshake successful
-- - 'reachable': TCP connects but handshake fails
-- - 'down': TCP connection fails
-- - 'pending': Not yet checked

-- Update the status column to allow 'reachable' value
-- (PostgreSQL doesn't have enums for this column, it's just varchar/text)

-- Add a comment to document the status values
COMMENT ON COLUMN nodes.status IS 'Node status: pending (not checked), up (full handshake), reachable (TCP only), down (unreachable)';

-- Update any views that filter by status to include reachable
-- The leaderboard view already filters by status = ''up'' which is correct
-- (we only want fully working nodes on the leaderboard)

-- Update nodes_public view to expose status properly (no changes needed, already exposes status)
