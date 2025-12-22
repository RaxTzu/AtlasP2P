-- ============================================
-- ADMIN AND SECURITY FEATURES
-- ============================================
-- Adds admin roles, moderation tools, and security features

-- Create admin_users table for role management
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support')),
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create banned_users table
CREATE TABLE IF NOT EXISTS banned_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banned_by UUID REFERENCES auth.users(id),
    reason TEXT,
    banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_permanent BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create moderation_queue table for content review
CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN ('avatar', 'profile', 'verification')),
    item_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
    content_url TEXT,
    content_data JSONB,
    flagged_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit_log table for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    endpoint TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create default_avatars table
CREATE TABLE IF NOT EXISTS default_avatars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add moderation fields to node_profiles
ALTER TABLE node_profiles
ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
ADD COLUMN IF NOT EXISTS is_avatar_approved BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS avatar_rejected_reason TEXT;

-- Add security fields to verifications
ALTER TABLE verifications
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 1;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banned_users_user_id ON banned_users(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_item_type ON moderation_queue(item_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address, window_start);

-- Create partial unique constraints for rate_limits
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_user_unique
    ON rate_limits(user_id, endpoint, window_start)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_ip_unique
    ON rate_limits(ip_address, endpoint, window_start)
    WHERE user_id IS NULL;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = check_user_id
        AND is_active = true
        AND revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM banned_users
        WHERE user_id = check_user_id
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_log (admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
    VALUES (p_admin_id, p_action, p_resource_type, p_resource_id, p_details, p_ip_address, p_user_agent)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security Policies

-- admin_users: Only admins can view, super_admins can manage
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin users"
    ON admin_users FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "Super admins can manage admin users"
    ON admin_users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
            AND is_active = true
        )
    );

-- banned_users: Only admins can view/manage
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view banned users"
    ON banned_users FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "Admins can ban users"
    ON banned_users FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update bans"
    ON banned_users FOR UPDATE
    USING (is_admin(auth.uid()));

-- moderation_queue: Admins can view/manage
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation queue"
    ON moderation_queue FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "System can insert to moderation queue"
    ON moderation_queue FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can update moderation queue"
    ON moderation_queue FOR UPDATE
    USING (is_admin(auth.uid()));

-- audit_log: Only admins can view, cannot modify
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
    ON audit_log FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "System can insert audit log"
    ON audit_log FOR INSERT
    WITH CHECK (true);

-- default_avatars: Public read, admins can manage
ALTER TABLE default_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view default avatars"
    ON default_avatars FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage default avatars"
    ON default_avatars FOR ALL
    USING (is_admin(auth.uid()));

-- Insert some default avatars
INSERT INTO default_avatars (name, url, display_order) VALUES
    ('Robot 1', '/avatars/default/robot-1.png', 1),
    ('Robot 2', '/avatars/default/robot-2.png', 2),
    ('Doge 1', '/avatars/default/doge-1.png', 3),
    ('Doge 2', '/avatars/default/doge-2.png', 4),
    ('Shield', '/avatars/default/shield.png', 5)
ON CONFLICT DO NOTHING;

-- Create trigger to auto-moderate new profiles
CREATE OR REPLACE FUNCTION auto_moderate_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- If avatar is uploaded, add to moderation queue
    IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
        INSERT INTO moderation_queue (
            item_type,
            item_id,
            user_id,
            content_url,
            content_data
        ) VALUES (
            'avatar',
            NEW.node_id,
            NEW.user_id,
            NEW.avatar_url,
            jsonb_build_object(
                'display_name', NEW.display_name,
                'description', NEW.description
            )
        );

        -- Set avatar to pending moderation
        NEW.is_avatar_approved := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moderate_profile_on_insert
    BEFORE INSERT ON node_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_moderate_profile();

CREATE TRIGGER moderate_profile_on_update
    BEFORE UPDATE OF avatar_url ON node_profiles
    FOR EACH ROW
    WHEN (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url)
    EXECUTE FUNCTION auto_moderate_profile();

-- Comments
COMMENT ON TABLE admin_users IS 'Stores admin role assignments with granular permissions';
COMMENT ON TABLE banned_users IS 'Tracks banned users with temporary or permanent bans';
COMMENT ON TABLE moderation_queue IS 'Queue for content requiring manual review';
COMMENT ON TABLE audit_log IS 'Immutable log of all admin actions for compliance';
COMMENT ON TABLE rate_limits IS 'Rate limiting data per user/IP per endpoint';
COMMENT ON TABLE default_avatars IS 'System-provided default avatar options';
COMMENT ON FUNCTION is_admin IS 'Check if user has active admin privileges';
COMMENT ON FUNCTION is_user_banned IS 'Check if user is currently banned';
COMMENT ON FUNCTION log_admin_action IS 'Log admin action to audit trail';
