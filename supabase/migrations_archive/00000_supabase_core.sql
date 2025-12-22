-- ===========================================
-- SUPABASE CORE: Database Roles & Users
-- ===========================================
-- This migration creates all required Supabase system users and roles
-- Reference: https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000000-initial-schema.sql
--
-- Execution Order: LAYER 0 (Foundation)
-- Dependencies: None - must run first
-- ===========================================

-- Postgres superuser (if not exists from Docker image)
-- Required by GoTrue auth service for grants
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- Supabase super admin
-- Used for privileged operations and system management
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- Authenticator - PostgREST connection user
-- This role "switches" to anon/authenticated/service_role based on JWT
-- NOINHERIT is critical - prevents automatic privilege escalation
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- Auth service admin - GoTrue database user
-- Manages auth schema and user tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin CREATEDB CREATEROLE LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- Storage service admin - File storage management
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin CREATEROLE LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- Functions admin - Edge functions/stored procedures
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    CREATE ROLE supabase_functions_admin CREATEROLE LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- ===========================================
-- API ROLES (Non-login roles for JWT switching)
-- ===========================================

-- Anonymous role - Unauthenticated API access
-- Used for public endpoints
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Authenticated role - Logged-in users
-- Standard user access after authentication
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Service role - Backend/admin access
-- BYPASSRLS allows service to bypass Row Level Security
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

-- ===========================================
-- ROLE MEMBERSHIPS
-- ===========================================
-- Allow authenticator to switch to API roles based on JWT claims

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO authenticator;

-- Allow auth admin to manage auth schema
GRANT supabase_auth_admin TO authenticator;

-- ===========================================
-- DASHBOARD USER (Supabase Studio)
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_user') THEN
    CREATE ROLE dashboard_user NOSUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN PASSWORD 'postgres';
  END IF;
END $$;

GRANT ALL ON DATABASE postgres TO dashboard_user;
GRANT ALL ON SCHEMA public TO dashboard_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO dashboard_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO dashboard_user;

-- ===========================================
-- CONNECTION LIMITS & STATEMENT TIMEOUTS
-- ===========================================
-- Prevent resource exhaustion and long-running queries

-- API roles should have statement timeout (30s default)
ALTER ROLE anon SET statement_timeout = '30s';
ALTER ROLE authenticated SET statement_timeout = '30s';

-- Service role can run longer queries (5min)
ALTER ROLE service_role SET statement_timeout = '5min';

-- ===========================================
-- SEARCH PATH CONFIGURATION
-- ===========================================
-- Ensure roles can access extensions and auth schemas

ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions, auth;

-- ===========================================
-- GRANT PUBLIC SCHEMA ACCESS
-- ===========================================
-- Allow all roles to use the public schema

GRANT USAGE ON SCHEMA public TO supabase_admin, anon, authenticated, service_role;

-- ===========================================
-- SUMMARY
-- ===========================================
-- Created:
--   - supabase_admin (superuser)
--   - authenticator (PostgREST connection user)
--   - supabase_auth_admin (GoTrue user)
--   - supabase_storage_admin (Storage user)
--   - supabase_functions_admin (Functions user)
--   - anon, authenticated, service_role (API roles)
--   - dashboard_user (Studio user)
--
-- Next Layer: 00000_supabase_schemas.sql (schemas & extensions)
-- ===========================================
