# Ycode lean self-host stack

A lightweight, Supabase-compatible backend for self-hosting [Ycode](https://github.com/ycode/ycode)
on **plain PostgreSQL 18** — without the ~10-container Supabase bundle and without
the Supabase Cloud bill.

It runs the four Supabase services Ycode actually uses (Auth, REST, Storage,
Realtime) as small standalone containers behind a tiny [Caddy](https://caddyserver.com)
router that replaces Supabase's Kong gateway. Ycode itself needs **zero code
changes** — it talks to this stack exactly as it would to Supabase.

---

## Table of contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick start (local)](#quick-start-local)
4. [Environment variables](#environment-variables)
5. [Creating the first user](#creating-the-first-user)
6. [Inviting more users](#inviting-more-users)
7. [SMTP / email](#smtp--email)
8. [Operating the stack](#operating-the-stack)
9. [Running migrations](#running-migrations)
10. [Updating Ycode from upstream](#updating-ycode-from-upstream)
11. [Deploying to a server](#deploying-to-a-server)
12. [Troubleshooting](#troubleshooting)
13. [How it maps to Supabase](#how-it-maps-to-supabase)

---

## Architecture

```
                          ┌────────────────────────────────────────────┐
  Browser / Ycode  ─────► │  gateway (Caddy)  :8000  == SUPABASE_URL    │
                          │   /auth/v1/*     → auth      (GoTrue)        │
                          │   /rest/v1/*     → rest      (PostgREST)     │
                          │   /storage/v1/*  → storage   (Storage API)   │
                          │   /realtime/v1/* → realtime  (Realtime)      │
                          │   + CORS headers (Kong's job in stock SB)   │
                          └───────────────┬────────────────────────────┘
                                          │
  Ycode (knex, direct) ──► postgres:18  :5433   (data + auth/storage/realtime schemas)
```

| Service              | Image                       | Purpose                              | Host port |
|----------------------|-----------------------------|--------------------------------------|-----------|
| `db`                 | `postgres:18`               | Database (all data + service schemas)| `5433`    |
| `db-bootstrap`       | `postgres:18`               | One-shot: ensures stock extensions   | —         |
| `auth`               | `supabase/gotrue`           | Authentication (login, invite, roles)| `9999`*   |
| `rest`               | `postgrest/postgrest`       | Auto REST API over Postgres (`.from`)| `3001`*   |
| `storage`            | `supabase/storage-api`      | File/asset storage (local disk)      | `5001`*   |
| `realtime`           | `supabase/realtime`         | Live updates / collaboration         | —         |
| `realtime-bootstrap` | `curlimages/curl`           | One-shot: registers the RT tenant    | —         |
| `mailpit`            | `axllent/mailpit`           | Local email catcher (dev only)       | `8025`/`1025` |
| `gateway`            | `caddy`                     | Path router + CORS (replaces Kong)   | `8000`    |

\* Host ports `9999/3001/5001` are exposed only for local debugging. **Remove
them in production** — Ycode only needs the gateway (`8000`) and a direct DB
connection (`5433`). See [Deploying to a server](#deploying-to-a-server).

Total footprint: ~350 MB RAM, vs ~1.5–2 GB for the full Supabase bundle.

---

## Prerequisites

- Docker Engine + Docker Compose v2
- Node.js ≥ 18 (to run Ycode and the key generator)
- A clone of `ycode/ycode` next to this folder:
  ```
  <parent>/
  ├── ycode/        ← the Ycode app (git clone https://github.com/ycode/ycode)
  └── selfhost/     ← this folder
  ```

---

## Quick start (local)

```bash
# 1. Generate secrets + the anon/service keys (all share one JWT secret)
cd selfhost
node gen-keys.mjs           # prints { secret, anonKey, serviceKey }

# 2. Create .env from the example and paste the three values in
cp .env.example .env
#    set JWT_SECRET, ANON_KEY, SERVICE_KEY
#    set REALTIME_SECRET_KEY_BASE:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Start the stack
docker compose up -d

# 4. Point Ycode at the stack (in ../ycode/.env):
#    SUPABASE_URL="http://localhost:8000"
#    SUPABASE_PUBLISHABLE_KEY="<ANON_KEY>"
#    SUPABASE_SECRET_KEY="<SERVICE_KEY>"
#    SUPABASE_CONNECTION_URL="postgresql://postgres:[YOUR-PASSWORD]@localhost:5433/postgres"
#    SUPABASE_DB_PASSWORD="ycode_pg_pw"
#    PAGE_AUTH_SECRET="$(openssl rand -hex 32)"

# 5. Install + migrate + run Ycode
cd ../ycode
npm install
# (see "Running migrations" for the exact command on Windows / ts-node)
npm run dev                 # http://localhost:3002
```

Then [create the first user](#creating-the-first-user) and open
**http://localhost:3002/ycode**.

Verify the backend independently any time with `node smoke-test.mjs`.

---

## Environment variables

All live in `selfhost/.env` (see `.env.example` for the template).

| Variable                   | What it is                                                        |
|----------------------------|-------------------------------------------------------------------|
| `JWT_SECRET`               | Shared HS256 secret — GoTrue, PostgREST, Storage, Realtime all verify with it |
| `ANON_KEY`                 | Public JWT (role `anon`), minted from `JWT_SECRET`                |
| `SERVICE_KEY`              | Admin JWT (role `service_role`), minted from `JWT_SECRET`         |
| `POSTGRES_PASSWORD`        | Superuser password — **must match `init-db/01-init.sql`**         |
| `REALTIME_SECRET_KEY_BASE` | 64-char secret for the Realtime (Phoenix) app                     |
| `REALTIME_DB_ENC_KEY`      | 16-char key Realtime uses to encrypt tenant settings              |
| `PUBLIC_API_URL`           | Gateway URL Ycode calls (== `SUPABASE_URL`)                       |
| `SITE_URL`                 | Ycode app URL (used in invite/reset email links)                 |
| `URI_ALLOW_LIST`           | Allowed redirect targets for auth emails                          |
| `MAILER_AUTOCONFIRM`       | `true` skips email confirmation (local); set `false` in prod      |
| `DISABLE_SIGNUP`           | `true` = invite-only (recommended in prod)                        |
| `SMTP_*`                   | Outgoing email — see [SMTP](#smtp--email)                         |

The database passwords for the internal roles (`authenticator`,
`supabase_auth_admin`, `supabase_storage_admin`) are defined in
`init-db/01-init.sql` and referenced in `docker-compose.yml`. Change them
together for production.

---

## Creating the first user

Ycode has no public "register" screen for the first owner — you create it once.
Two ways:

### A. Admin API (recommended, reliable)

Guarantees the `owner` role and needs no SMTP. Run from anywhere that can reach
the gateway:

```bash
SVC="<SERVICE_KEY>"
curl -X POST "http://localhost:8000/auth/v1/admin/users" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@company.com","password":"ChangeMe123!","email_confirm":true,"app_metadata":{"role":"owner"}}'
```

`email_confirm: true` marks the address as verified immediately. Then sign in at
`/ycode`.

### B. Setup wizard (UI)

On a **fresh install with no users**, open `/ycode/welcome`. It collects the
Supabase credentials (already in your `.env`), runs migrations, then asks for an
email + password and makes that first account the **owner**. Only works while
zero users exist (the app checks this via `/ycode/api/setup/status`).

> Why A is recommended for self-host: the wizard's role-assignment endpoint
> requires the caller to already be an owner/admin, and a brand-new account has
> no role (defaults to `designer`). The admin API sets `role: owner` directly.

---

## Inviting more users

Once you have an owner, add teammates from the builder:

1. Open `/ycode`, click **Invite** (top-right).
2. Enter their email + role (`admin` / `designer` / `editor`).
3. GoTrue sends an invite email (locally it lands in **Mailpit** —
   http://localhost:8025). The link points at `SITE_URL/...`, where they set a
   password and join.

Invites require working [SMTP](#smtp--email) in production.

---

## SMTP / email

Email is used for **invites**, **password resets** and **email confirmations**.

### Local development — Mailpit (default)

The stack ships Mailpit, a fake SMTP server that captures every outgoing mail.
Nothing leaves your machine. Open the inbox at **http://localhost:8025**.
The default `.env` already points GoTrue at it (`SMTP_HOST=mailpit`).

### Production — a real provider

Set these in `selfhost/.env`, then `docker compose up -d auth`:

```ini
MAILER_AUTOCONFIRM=false               # enforce the email confirmation/invite flow
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587                          # 587 = STARTTLS, 465 = implicit TLS
SMTP_USER=...                          # provider username / API key id
SMTP_PASS=...                          # provider password / API key
SMTP_ADMIN_EMAIL=no-reply@yourdomain.com   # the "From" address (must be a verified sender)
SMTP_SENDER_NAME=Your Brand
```

Common providers:

| Provider     | `SMTP_HOST`                          | `SMTP_PORT` | `SMTP_USER` | `SMTP_PASS`        |
|--------------|--------------------------------------|-------------|-------------|--------------------|
| Resend       | `smtp.resend.com`                    | 465 or 587  | `resend`    | API key            |
| SendGrid     | `smtp.sendgrid.net`                  | 587         | `apikey`    | API key            |
| Postmark     | `smtp.postmarkapp.com`               | 587         | server token| server token       |
| Amazon SES   | `email-smtp.<region>.amazonaws.com`  | 587         | SMTP user   | SMTP password      |
| Mailgun      | `smtp.mailgun.org`                   | 587         | SMTP login  | SMTP password      |

Notes:
- The **From** address (`SMTP_ADMIN_EMAIL`) must be a domain/sender you have
  verified with the provider, or mail will bounce.
- Port `587` uses STARTTLS, `465` uses implicit TLS — GoTrue picks the mode from
  the port automatically.
- Test after configuring: send yourself an invite from the builder and confirm
  it arrives (not in Mailpit anymore — in the real inbox).
- You can drop the `mailpit` service in production (it is dev-only).

---

## Operating the stack

All commands run from `selfhost/`.

```bash
docker compose up -d            # start everything
docker compose ps               # status of all services
docker compose logs -f auth     # tail one service's logs (auth | rest | storage | realtime | gateway | db)
docker compose restart auth     # restart one service (e.g. after changing SMTP env)
docker compose down             # stop (KEEPS data)
docker compose down -v          # stop and WIPE all data (fresh start)
docker compose pull             # update images to the pinned tags
```

### Health checks

```bash
curl http://localhost:8000/health                       # gateway
curl http://localhost:8000/auth/v1/health               # auth
node smoke-test.mjs                                      # full end-to-end (auth+rest+storage)
```

### Backups

The data lives in two named volumes: `ycode-lean_db-data` (Postgres) and
`ycode-lean_storage-data` (uploaded files).

```bash
# Database dump
docker exec ycode-db pg_dump -U postgres postgres > backup_$(date +%F).sql

# Restore
cat backup.sql | docker exec -i ycode-db psql -U postgres postgres

# Files (storage volume)
docker run --rm -v ycode-lean_storage-data:/data -v "$PWD":/out alpine \
  tar czf /out/storage_$(date +%F).tar.gz -C /data .
```

---

## Running migrations

Ycode's schema is managed by knex migrations in `ycode/database/migrations`.
The bundled `npm run migrate:latest` script uses unix-only inline env syntax and
the knexfile imports `server-only` + uses the `@/` path alias, so on Windows (and
in CI) run knex directly with the right flags:

```bash
cd ycode
export NODE_NO_WARNINGS=1 TS_NODE_TRANSPILE_ONLY=1 \
  NODE_OPTIONS="--conditions=react-server --require tsconfig-paths/register" \
  SUPABASE_CONNECTION_URL="postgresql://postgres:[YOUR-PASSWORD]@localhost:5433/postgres" \
  SUPABASE_DB_PASSWORD="ycode_pg_pw" \
  SUPABASE_URL="http://localhost:8000" \
  SUPABASE_PUBLISHABLE_KEY="x" SUPABASE_SECRET_KEY="x"
npx knex migrate:latest --knexfile knexfile.ts
```

After migrations that add tables, tell PostgREST to reload its schema cache:

```bash
docker kill --signal=SIGUSR1 ycode-rest
```

---

## Updating Ycode from upstream

Your customisation lives entirely in `selfhost/` + a gitignored `ycode/.env`, so
`git pull` from upstream never conflicts. Two GitHub Actions automate this
(in `ycode/.github/workflows/`):

- **`upstream-sync.yml`** — daily: merges `ycode/ycode` into a branch and opens a PR.
- **`validate-upstream.yml`** — on that PR: boots this stack, runs migrations,
  the smoke test, type-check and build. Green = safe to merge/deploy; red (e.g. a
  new migration needs an extension) = fix it in `selfhost/` first.

To enable: fork `ycode/ycode`, commit `selfhost/` + `.github/workflows/` to your
fork, and add `upstream` as a remote. (The auto-PR may need a PAT to trigger CI —
GitHub does not run workflows on PRs opened by the default token.)

When a new upstream migration assumes a Postgres extension the stock image lacks,
add it to `compat/extensions.sql` — the `db-bootstrap` service applies it on
every `up`, idempotently.

---

## Deploying to a server

### 1. Server prep
- A Linux box with Docker + Compose.
- DNS: point e.g. `api.example.com` (the gateway) and `app.example.com` (Ycode)
  at the server.
- Firewall: allow `80`/`443` only. **Do not** expose Postgres (`5433`) or the
  internal service ports to the internet.

### 2. Harden the config
- Regenerate secrets: `node gen-keys.mjs` → new `JWT_SECRET`/`ANON_KEY`/`SERVICE_KEY`.
- Change **every** password: `POSTGRES_PASSWORD` (+ the matching values in
  `init-db/01-init.sql`), and the role passwords in `init-db/01-init.sql`.
- Set production env in `.env`:
  ```ini
  PUBLIC_API_URL=https://api.example.com
  SITE_URL=https://app.example.com
  URI_ALLOW_LIST=https://app.example.com
  MAILER_AUTOCONFIRM=false
  DISABLE_SIGNUP=true
  # + real SMTP_* values
  ```
- In `docker-compose.yml`, remove the host `ports:` from `auth`, `rest`,
  `storage`, `mailpit` (keep them internal). Keep only the `gateway` published.

### 3. TLS at the gateway
Replace the local `Caddyfile` site block so Caddy serves your domain and
auto-provisions a Let's Encrypt certificate (drop `auto_https off`):

```caddyfile
{
    # email you@example.com   # optional, for ACME notices
}

api.example.com {
    route {
        header {
            Access-Control-Allow-Origin "https://app.example.com"
            Access-Control-Allow-Credentials "true"
            Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            Access-Control-Allow-Headers "apikey, authorization, content-type, x-client-info, x-supabase-api-version, prefer, range, accept-profile, content-profile"
            Access-Control-Expose-Headers "content-range, content-encoding, x-supabase-api-version"
            defer
        }
        @options method OPTIONS
        respond @options 204

        handle_path /auth/v1/*    { reverse_proxy auth:9999 }
        handle_path /rest/v1/*    { reverse_proxy rest:3000 }
        handle_path /storage/v1/* { reverse_proxy storage:5000 }
        handle_path /realtime/v1/api/* { rewrite * /api{uri}    reverse_proxy realtime:4000 { header_up Host realtime-dev.localhost } }
        handle_path /realtime/v1/*     { rewrite * /socket{uri} reverse_proxy realtime:4000 { header_up Host realtime-dev.localhost } }
    }
}
```
Publish ports `80` and `443` on the `gateway` service instead of `8000`.
Tighten `Access-Control-Allow-Origin` to your app domain (shown above).

### 4. Run the Ycode app

**Option A — containerised (recommended for servers).** A `Dockerfile` ships in
the `ycode/` repo and an `app` service (compose profile `app`) builds it:

```bash
cd selfhost
# Set PUBLIC_API_URL to your public gateway domain and PAGE_AUTH_SECRET in .env
docker compose --profile app up -d --build
```
The container applies DB migrations on startup, then serves Next.js on `:3002`.
Reverse-proxy `app.example.com → app:3002` with Caddy (auto-TLS).

> **Important:** `SUPABASE_URL` (= `PUBLIC_API_URL`) must resolve from **both** the
> browser and the app container. On a server with a real domain this is automatic.
> Locally it can't (container `localhost` ≠ host), so for local work run the app
> with `npm run dev` instead of the `app` profile.

`RUN_MIGRATIONS=false` on the `app` service skips the startup migration step (run
them as a separate job instead).

**Option B — bare Node.** Point Ycode's `ycode/.env` at the production gateway:
```ini
SUPABASE_URL="https://api.example.com"
SUPABASE_PUBLISHABLE_KEY="<new ANON_KEY>"
SUPABASE_SECRET_KEY="<new SERVICE_KEY>"
SUPABASE_CONNECTION_URL="postgresql://postgres:[YOUR-PASSWORD]@db:5432/postgres"  # if same host/network
SUPABASE_DB_PASSWORD="<new POSTGRES_PASSWORD>"
PAGE_AUTH_SECRET="$(openssl rand -hex 32)"
```
Build and serve it (behind Caddy on `app.example.com`):
```bash
cd ycode && npm ci && npm run build && npm run start   # next start -p 3002
```
Run it under a process manager (systemd / pm2) or containerise it. Reverse-proxy
`app.example.com → localhost:3002` with Caddy (auto-TLS).

### 5. Bring it up & seed
```bash
cd selfhost && docker compose up -d
# run migrations (see above), then create the first owner via the Admin API
```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login fails with **"Failed to fetch"** | CORS. The gateway must send `Access-Control-Allow-Origin`. Check the `header` block in `Caddyfile` and that `SITE_URL`/origin match. |
| Auth/REST calls return **"invalid JWT"** | `JWT_SECRET` differs between services or the keys weren't minted from it. Regenerate with `gen-keys.mjs` and restart all services. |
| Migration error **`function digest does not exist`** (or similar) | A stock extension is missing. Add it to `compat/extensions.sql`; `db-bootstrap` applies it on next `up`. |
| Postgres data not persisting | `postgres:18` uses `/var/lib/postgresql` as its volume (not `/data`). Already handled in compose — don't change it. |
| Realtime container **crash-loops** | Needs `_realtime`+`realtime` schemas (in `init-db`), `SEED_SELF_HOST=false`, and the tenant registered by `realtime-bootstrap`. `wal_level=logical` must be on (it is). |
| Browser console: **`ws://.../realtime/v1/websocket` failed** | The realtime tenant isn't registered or the gateway route/`Host` header is wrong. Re-run `docker compose up -d realtime-bootstrap` and check `Caddyfile`. |
| Invite emails never arrive (prod) | Wrong `SMTP_*`, or `SMTP_ADMIN_EMAIL` isn't a verified sender. Check `docker compose logs auth`. |
| New tables not visible to the app | PostgREST schema cache is stale: `docker kill --signal=SIGUSR1 ycode-rest`. |

---

## How it maps to Supabase

| Ycode expects (Supabase) | This stack provides |
|---|---|
| Supabase API URL (`SUPABASE_URL`) | Caddy gateway on `:8000` |
| Auth (`/auth/v1`) | GoTrue container |
| PostgREST (`/rest/v1`, the `.from()` calls) | PostgREST container |
| Storage (`/storage/v1`) | Storage API container (local disk; swap for S3/R2) |
| Realtime (`/realtime/v1`) | Realtime container + registered tenant |
| Kong gateway + CORS | Caddy router with CORS headers |
| `supabase/postgres` (roles, schemas, extensions) | `init-db/01-init.sql` + `compat/extensions.sql` on `postgres:18` |

Everything Supabase-specific that the managed image pre-bakes (the `anon` /
`authenticated` / `service_role` roles, the `auth`/`storage`/`_realtime`/`realtime`
schemas, the `auth.uid()`/`auth.role()` helpers, and stock extensions) is
recreated by the SQL in `init-db/` and `compat/` so it all works on vanilla
Postgres 18.
