-- ===========================================
-- MIGRATION: Sync tips_enabled on nodes table
-- ===========================================
-- This migration adds a trigger to automatically sync the tips_enabled
-- flag on the nodes table when node_tip_configs is modified.
-- This is necessary because RLS on the nodes table only allows
-- service_role to update, but users need to enable/disable tipping.

-- Function to sync tips_enabled from node_tip_configs to nodes
CREATE OR REPLACE FUNCTION sync_tips_enabled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as the function owner (superuser), bypassing RLS
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- When tip config is deleted, disable tips on the node
        UPDATE nodes
        SET tips_enabled = false,
            updated_at = NOW()
        WHERE id = OLD.node_id;
        RETURN OLD;
    ELSE
        -- When tip config is inserted or updated, sync the is_active flag
        UPDATE nodes
        SET tips_enabled = NEW.is_active,
            updated_at = NOW()
        WHERE id = NEW.node_id;
        RETURN NEW;
    END IF;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_tips_enabled_trigger ON node_tip_configs;

-- Create trigger to sync tips_enabled on any change to node_tip_configs
CREATE TRIGGER sync_tips_enabled_trigger
    AFTER INSERT OR UPDATE OR DELETE ON node_tip_configs
    FOR EACH ROW
    EXECUTE FUNCTION sync_tips_enabled();

-- Add comment for documentation
COMMENT ON FUNCTION sync_tips_enabled() IS 'Automatically syncs tips_enabled flag on nodes table when node_tip_configs changes';
