-- Extensions that the supabase/postgres image ships preinstalled but plain
-- postgres:18 does not. Applied idempotently on EVERY `docker compose up` by the
-- db-bootstrap service, so it also fixes pre-existing volumes (init-db only runs
-- on a fresh data dir). Add any extension a future upstream migration assumes.
--
-- Only stock postgres `contrib` extensions belong here — they're bundled in the
-- official image. Supabase-only extensions (pg_graphql, pg_net, vault, vector…)
-- are NOT installable on vanilla pg and would need a custom image; Ycode core
-- does not use them today.

CREATE EXTENSION IF NOT EXISTS pgcrypto    WITH SCHEMA public;  -- digest(), gen_salt() — used by token-hashing migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;  -- uuid_generate_v4() (gen_random_uuid is core, but be safe)
CREATE EXTENSION IF NOT EXISTS citext      WITH SCHEMA public;  -- case-insensitive text (common in CMS schemas)
CREATE EXTENSION IF NOT EXISTS pg_trgm     WITH SCHEMA public;  -- trigram search/indexes
CREATE EXTENSION IF NOT EXISTS unaccent    WITH SCHEMA public;  -- accent-insensitive search
