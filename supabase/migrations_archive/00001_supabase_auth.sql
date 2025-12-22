-- ===========================================
-- SUPABASE AUTH: Enum Types & Helper Functions
-- ===========================================
-- This migration creates required enum types for GoTrue
-- GoTrue (auth service) creates all auth functions automatically:
--   - auth.uid() - Extract user UUID from JWT
--   - auth.role() - Extract role from JWT
--   - auth.email() - Extract email from JWT
--
-- We do NOT create these functions here to avoid ownership conflicts
-- GoTrue must own these functions for its migrations to succeed
--
-- Execution Order: LAYER 2 (Auth Functions)
-- Dependencies: 00000_supabase_schemas.sql (auth schema must exist)
-- ===========================================

-- ===========================================
-- ENUM TYPES REQUIRED BY GOTRUE
-- ===========================================
-- These enum types must exist before GoTrue runs its migrations
-- They must be owned by supabase_auth_admin

SET ROLE supabase_auth_admin;

-- Factor types for MFA (Multi-Factor Authentication)
CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');

-- AAL (Authenticator Assurance Level) for session security
CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');

-- Code challenge methods for PKCE (Proof Key for Code Exchange)
CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');

RESET ROLE;

-- ===========================================
-- AUTH FUNCTIONS
-- ===========================================
-- All auth functions are created by GoTrue during container startup

-- ===========================================
-- USAGE EXAMPLES
-- ===========================================
-- Once GoTrue is running, these functions are available for RLS policies:
--
-- CREATE POLICY "Users can update their own nodes"
--   ON nodes FOR UPDATE
--   USING (user_id = auth.uid());
--
-- CREATE POLICY "Only authenticated users can create nodes"
--   ON nodes FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
--
-- CREATE POLICY "Service role bypasses RLS"
--   ON nodes FOR ALL
--   USING (auth.role() = 'service_role');
-- ===========================================

-- ===========================================
-- SUMMARY
-- ===========================================
-- Functions available after GoTrue starts:
--   - auth.uid() - Extract user UUID from JWT
--   - auth.role() - Extract role from JWT (anon/authenticated/service_role)
--   - auth.email() - Extract email from JWT
--
-- Next Layer: 00002_initial_schema.sql (application tables)
-- ===========================================
