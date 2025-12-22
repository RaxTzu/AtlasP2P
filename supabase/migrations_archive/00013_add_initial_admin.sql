-- ============================================
-- MIGRATION: Add initial super admin
-- ============================================
-- This adds the first admin user to bootstrap the system.
-- Replace the email with your actual email address.

-- Insert the first super admin by email
INSERT INTO admin_users (user_id, role, is_active)
SELECT id, 'super_admin', true
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'  -- <-- CHANGE THIS TO YOUR EMAIL
ON CONFLICT (user_id) DO NOTHING;

-- Alternative: If you know your user_id directly
-- INSERT INTO admin_users (user_id, role, is_active)
-- VALUES ('your-uuid-here', 'super_admin', true)
-- ON CONFLICT (user_id) DO NOTHING;
