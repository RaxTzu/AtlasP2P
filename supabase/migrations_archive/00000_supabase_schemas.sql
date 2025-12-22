-- ===========================================
-- SUPABASE SCHEMAS: Core Infrastructure
-- ===========================================
-- Creates required Supabase schemas and PostgreSQL extensions
-- Reference: https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts
--
-- Execution Order: LAYER 1 (Infrastructure)
-- Dependencies: 00000_supabase_core.sql (roles must exist)
-- ===========================================

-- ===========================================
-- EXTENSIONS SCHEMA
-- ===========================================
-- Isolate extensions in their own schema (Supabase best practice)

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO supabase_admin, anon, authenticated, service_role;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Cryptographic functions (password hashing, etc.)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- JWT token generation/validation
-- Note: pgjwt is not always available - auth service handles JWT
-- CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

-- PostGIS for spatial queries (if needed for geolocation features)
-- Uncomment if you want spatial indexes on lat/long
-- CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ===========================================
-- AUTH SCHEMA
-- ===========================================
-- GoTrue (auth service) will populate this with its own tables
-- We create the schema with proper ownership

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;

-- Grant access to auth schema
GRANT USAGE ON SCHEMA auth TO supabase_admin, anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

-- Allow future tables in auth schema to be accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_admin, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_admin, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_admin, service_role;

-- ===========================================
-- STORAGE SCHEMA
-- ===========================================
-- For file storage (if using Supabase Storage)

CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;

GRANT USAGE ON SCHEMA storage TO supabase_admin, anon, authenticated, service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_admin, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_admin, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON FUNCTIONS TO supabase_admin, service_role;

-- ===========================================
-- REALTIME PUBLICATION
-- ===========================================
-- Required for Supabase Realtime subscriptions
-- Tables must be explicitly added to this publication

CREATE PUBLICATION supabase_realtime;

-- ===========================================
-- PUBLIC SCHEMA PERMISSIONS
-- ===========================================
-- Ensure all roles can access public schema

GRANT USAGE ON SCHEMA public TO supabase_admin, anon, authenticated, service_role;

-- Allow creating tables/functions in public schema
GRANT CREATE ON SCHEMA public TO supabase_admin, service_role, supabase_auth_admin;

-- ===========================================
-- DEFAULT PRIVILEGES FOR PUBLIC SCHEMA
-- ===========================================
-- Any new tables/functions in public schema get these permissions automatically

-- Tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin, anon, authenticated, service_role;

-- Sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin, anon, authenticated, service_role;

-- Functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO supabase_admin, anon, authenticated, service_role;

-- ===========================================
-- HELPER FUNCTIONS (General Utility)
-- ===========================================

-- Generate nanoid (alternative to UUID for shorter IDs)
-- Useful for public-facing node identifiers
CREATE OR REPLACE FUNCTION public.nanoid(size int DEFAULT 21)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet text := '_-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  id text := '';
  i int;
BEGIN
  FOR i IN 1..size LOOP
    id := id || substr(alphabet, floor(random() * 64 + 1)::int, 1);
  END LOOP;
  RETURN id;
END;
$$;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.nanoid(int) TO supabase_admin, anon, authenticated, service_role;

-- ===========================================
-- SCHEMA SEARCH PATHS
-- ===========================================
-- Configure where PostgreSQL looks for objects

-- Ensure extensions are in search path for all databases
ALTER DATABASE postgres SET search_path TO public, extensions;

-- ===========================================
-- TRIGGER SETUP FOR UPDATED_AT
-- ===========================================
-- Common pattern: automatically update updated_at columns

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO supabase_admin, anon, authenticated, service_role;

-- ===========================================
-- COMMENTS & DOCUMENTATION
-- ===========================================

COMMENT ON SCHEMA extensions IS 'Supabase extensions namespace - isolates extensions from public schema';
COMMENT ON SCHEMA auth IS 'Supabase Auth (GoTrue) schema - managed by auth service';
COMMENT ON SCHEMA storage IS 'Supabase Storage schema - manages file storage';
COMMENT ON PUBLICATION supabase_realtime IS 'Realtime publication - tables must be explicitly added for live updates';

-- ===========================================
-- SUMMARY
-- ===========================================
-- Created:
--   - extensions schema (with uuid-ossp, pgcrypto)
--   - auth schema (for GoTrue)
--   - storage schema (for file storage)
--   - supabase_realtime publication
--   - Default privileges for public schema
--   - Helper functions (nanoid, handle_updated_at)
--
-- Next Layer: 00001_supabase_auth.sql (auth helper functions)
-- ===========================================
