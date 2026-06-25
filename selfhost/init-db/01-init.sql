-- ============================================================================
-- Ycode lean self-host — Postgres bootstrap
-- Runs once on first init of a clean `postgres:18` data dir.
-- Recreates the roles, schemas and helper functions that the `supabase/postgres`
-- image normally ships with, so GoTrue / PostgREST / Storage can run on vanilla pg.
--
-- Passwords here MUST match the connection strings in docker-compose.yml.
-- (Plain .sql so dollar-quoted function bodies work — no shell $$ expansion.)
-- ============================================================================

-- --- Extensions that supabase/postgres ships preinstalled ------------------
-- Plain postgres:18 does not have these enabled. Ycode migrations call
-- pgcrypto's digest() (e.g. 20260528000002_hash_mcp_refresh_tokens), so enable
-- it up front. Add any future extension an upstream migration assumes here.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- --- PostgREST / API roles -------------------------------------------------
CREATE ROLE anon          NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role  NOLOGIN NOINHERIT BYPASSRLS;

-- The login role PostgREST connects as; it SET ROLEs to one of the above
-- depending on the `role` claim in the JWT.
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator_pw';
GRANT anon, authenticated, service_role TO authenticator;

-- --- GoTrue (auth) admin ---------------------------------------------------
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD 'auth_admin_pw';
GRANT anon, authenticated, service_role TO supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
ALTER ROLE supabase_auth_admin SET search_path = 'auth';

-- --- Storage admin ---------------------------------------------------------
CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE PASSWORD 'storage_admin_pw';
GRANT anon, authenticated, service_role TO supabase_storage_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
ALTER ROLE supabase_storage_admin SET search_path = 'storage';

-- --- Supabase auth helper functions (used by RLS / Storage policies) -------
-- These read the JWT claims that PostgREST injects as GUCs per request.
-- They MUST be owned by supabase_auth_admin: GoTrue's own migration does a
-- CREATE OR REPLACE on auth.uid()/role(), which fails unless it owns them.
-- Pre-creating them also guarantees they exist before the Storage migration.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.email', true), '')::text;
$$;

ALTER FUNCTION auth.uid()   OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role()  OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

-- --- Public schema access for the API roles --------------------------------
-- Ycode's knex migrations create its tables in `public` as the superuser
-- (`postgres`). Grant present + future objects to the API roles so the
-- service_role key (used by getSupabaseAdmin) and anon key can reach them.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL    ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL    ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES    TO anon, authenticated;

-- --- Realtime schemas (the supabase/postgres image pre-creates these) -------
-- `_realtime` holds tenant metadata; `realtime` holds per-tenant objects.
-- Realtime's Ecto migrations need them to exist before it boots.
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS realtime  AUTHORIZATION postgres;

-- --- Smoke-test table so PostgREST has something to expose immediately ------
CREATE TABLE IF NOT EXISTS public.healthcheck (
  id   int PRIMARY KEY DEFAULT 1,
  note text NOT NULL DEFAULT 'lean-stack-ok'
);
INSERT INTO public.healthcheck (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.healthcheck TO anon, authenticated, service_role;
