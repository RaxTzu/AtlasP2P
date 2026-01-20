-- ===========================================
-- ADMIN SETTINGS UPDATE FUNCTION
-- ===========================================
-- Function to update admin settings with SECURITY DEFINER
-- This bypasses RLS so the API can update settings for authenticated admins

CREATE OR REPLACE FUNCTION update_admin_setting(
    p_key TEXT,
    p_value JSONB,
    p_updated_by UUID
)
RETURNS admin_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result admin_settings;
BEGIN
    -- Update the setting
    UPDATE admin_settings
    SET
        value = p_value,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE key = p_key
    RETURNING * INTO v_result;

    -- Check if setting was found
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Setting not found: %', p_key;
    END IF;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (admin check happens in API)
GRANT EXECUTE ON FUNCTION update_admin_setting(TEXT, JSONB, UUID) TO authenticated;
