-- ===========================================
-- MIGRATION: Fix Alert Permissions
-- ===========================================
-- The authenticated role needs permissions to insert/update/delete alert subscriptions.
-- Previously only granted to 'authenticator' but the JWT role is 'authenticated'.

-- Grant permissions to the authenticated role (the actual JWT role for logged-in users)
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.alert_subscriptions TO authenticated;
GRANT INSERT, SELECT ON TABLE public.alert_history TO authenticated;

-- Also grant to anon for read-only access if needed in future
GRANT SELECT ON TABLE public.alert_subscriptions TO anon;
GRANT SELECT ON TABLE public.alert_history TO anon;

-- Ensure the tables are in the right schema search path
ALTER TABLE IF EXISTS alert_subscriptions SET SCHEMA public;
ALTER TABLE IF EXISTS alert_history SET SCHEMA public;
