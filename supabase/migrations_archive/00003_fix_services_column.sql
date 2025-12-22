-- ============================================
-- Fix services column type: text -> bigint
-- ============================================
-- Services is a bitmask (uint64) that should be stored as bigint for efficient bitwise operations

-- Step 1: Convert existing text values to bigint
-- Current values are already numeric strings like "5", "1033", etc.
ALTER TABLE nodes
ALTER COLUMN services TYPE bigint USING COALESCE(services::bigint, 0);

-- Step 2: Add comment explaining the field
COMMENT ON COLUMN nodes.services IS 'Bitmask of node capabilities from Bitcoin P2P protocol (NODE_NETWORK=1, NODE_BLOOM=4, NODE_WITNESS=8, etc.)';

-- Step 3: Create index for efficient service flag queries
CREATE INDEX IF NOT EXISTS idx_nodes_services ON nodes(services) WHERE services IS NOT NULL;

-- Verification query to test bitwise operations now work
-- Example: Find all nodes with NODE_NETWORK (bit 0 = 1)
-- SELECT COUNT(*) FROM nodes WHERE (services & 1) = 1;
