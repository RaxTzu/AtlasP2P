-- ============================================
-- Revert services column: bigint -> text
-- ============================================
-- PostgREST/Supabase JSON serialization doesn't handle bigint well
-- Keep as text and do bitwise operations in application layer

-- Step 1: Convert back to text
ALTER TABLE nodes
ALTER COLUMN services TYPE text USING services::text;

-- Step 2: Update comment
COMMENT ON COLUMN nodes.services IS 'Node capabilities bitmask as text (convert to int in app for bitwise ops). Values like "5", "1033", etc.';

-- Step 3: Drop the bigint index, create text index
DROP INDEX IF EXISTS idx_nodes_services;
CREATE INDEX IF NOT EXISTS idx_nodes_services ON nodes(services) WHERE services IS NOT NULL;

-- Note: The services-decoder in the web app already handles both string and number types
-- The crawler will now send services as number, but JSON will serialize it to string
-- PostgreSQL will store it as text
-- Web app will parse it back to number for bitwise operations
