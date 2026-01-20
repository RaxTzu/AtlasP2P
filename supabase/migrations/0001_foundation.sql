-- ===========================================
-- ATLASP2P - SUPABASE FOUNDATION
-- ===========================================
-- System roles, schemas, extensions for Supabase
-- Consolidated from: 00000_supabase_core, 00000_supabase_schemas, 00001_supabase_auth
-- ===========================================

-- System Roles (NO passwords - migrate.js syncs passwords after creation)
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS LOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator NOINHERIT LOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin CREATEDB CREATEROLE LOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin CREATEROLE LOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN CREATE ROLE supabase_functions_admin CREATEROLE LOGIN; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_user') THEN CREATE ROLE dashboard_user NOSUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN; END IF; END $$;

-- Role Memberships (conditional to support both fresh and Supabase Postgres images)
-- The Supabase Postgres image has supabase_admin as a reserved role - skip grants that fail
DO $$ BEGIN GRANT anon TO authenticator; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT authenticated TO authenticator; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT service_role TO authenticator; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT supabase_admin TO authenticator; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT supabase_auth_admin TO authenticator; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON DATABASE postgres TO dashboard_user; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON SCHEMA public TO dashboard_user; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON ALL TABLES IN SCHEMA public TO dashboard_user; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO dashboard_user; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Role Configuration (defensive - skip if role configuration already exists)
DO $$ BEGIN ALTER ROLE anon SET statement_timeout = '30s'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE authenticated SET statement_timeout = '30s'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE service_role SET statement_timeout = '5min'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE supabase_auth_admin SET statement_timeout = '5min'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE anon SET search_path = public, extensions; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE authenticated SET search_path = public, extensions; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE service_role SET search_path = public, extensions, auth; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER ROLE supabase_auth_admin SET search_path = auth, public, extensions; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Schemas (idempotent - handle existing schemas from Supabase Postgres image)
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'storage') THEN
    CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE ON SCHEMA extensions TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE ON SCHEMA auth TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON SCHEMA auth TO supabase_auth_admin; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE ON SCHEMA storage TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT ALL ON SCHEMA storage TO supabase_storage_admin; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE ON SCHEMA public TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT CREATE ON SCHEMA public TO supabase_admin, service_role, supabase_auth_admin; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Default Privileges (defensive - skip failures from Supabase Postgres image setup)
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_admin, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_admin, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_admin, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_admin, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_admin, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON FUNCTIONS TO supabase_admin, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Auth Helper Functions (owned by supabase_auth_admin for GoTrue compatibility)
-- These may already exist in Supabase Postgres image, so make them defensive
DO $$
BEGIN
  SET ROLE supabase_auth_admin;

  CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $func$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  $func$;

  CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $func$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text
  $func$;

  CREATE OR REPLACE FUNCTION auth.email() RETURNS TEXT LANGUAGE sql STABLE AS $func$
    SELECT COALESCE(
      NULLIF(current_setting('request.jwt.claim.email', true), ''),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text
  $func$;

  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
END $$;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION auth.uid() TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION auth.role() TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION auth.email() TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.nanoid(size int DEFAULT 21) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE alphabet text := '_-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; id text := ''; i int; BEGIN FOR i IN 1..size LOOP id := id || substr(alphabet, floor(random() * 64 + 1)::int, 1); END LOOP; RETURN id; END; $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.nanoid(int) TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO supabase_admin, anon, authenticated, service_role; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Database Config
DO $$ BEGIN ALTER DATABASE postgres SET search_path TO public, auth, extensions; EXCEPTION WHEN OTHERS THEN NULL; END $$;
