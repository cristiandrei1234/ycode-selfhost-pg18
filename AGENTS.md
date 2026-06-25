# AGENTS.md — Ycode lean self-host

Operating guide for any AI agent working in this project. Read this before
touching the stack, running the app, or editing pages via MCP.

## What this is

[Ycode](https://github.com/ycode/ycode) (a visual website builder + CMS) is
self-hosted here on a **lean, Supabase-compatible backend running on plain
PostgreSQL 18** — instead of Supabase Cloud or the ~10-container Supabase bundle.
Motivation: avoid resource bloat, cost-at-traffic, and vendor lock-in.

```
D:\Server\Y code\
├── ycode/      ← the Ycode app (Next.js 16). Upstream repo — keep merge-clean.
└── selfhost/   ← the backend stack (docker compose). All our customization.
```

The Ycode app needs **zero source changes**: it talks to our stack exactly as it
would to Supabase. All customization lives in `selfhost/` + a gitignored
`ycode/.env`, so `git pull` from upstream never conflicts.

## The stack (selfhost/)

7 containers behind a Caddy router that replaces Supabase's Kong gateway:

| Service | Image | Purpose |
|---|---|---|
| db | postgres:18 | data + auth/storage/realtime schemas |
| auth | supabase/gotrue | authentication (login, invite, roles) |
| rest | postgrest/postgrest | REST API over Postgres (the `.from()` calls) |
| storage | supabase/storage-api | files/assets (local disk) |
| realtime | supabase/realtime | live updates / collaboration |
| gateway | caddy | path router + CORS (replaces Kong) |
| mailpit | axllent/mailpit | local email catcher (dev) |

Gateway `http://localhost:8000` == `SUPABASE_URL`. Postgres is also exposed on
`localhost:5433` for the app's direct knex connection. Full manual:
**`selfhost/README.md`**.

## Running it

```bash
# backend
cd selfhost && docker compose up -d

# app — local dev (use this locally, not the container; see split-horizon note)
cd ycode && npm install
# migrations: the npm script breaks on Windows + needs ts-node flags, run:
NODE_NO_WARNINGS=1 TS_NODE_TRANSPILE_ONLY=1 \
  NODE_OPTIONS="--conditions=react-server --require tsconfig-paths/register" \
  SUPABASE_CONNECTION_URL="postgresql://postgres:[YOUR-PASSWORD]@localhost:5433/postgres" \
  SUPABASE_DB_PASSWORD="ycode_pg_pw" SUPABASE_URL="http://localhost:8000" \
  SUPABASE_PUBLISHABLE_KEY=x SUPABASE_SECRET_KEY=x \
  npx knex migrate:latest --knexfile knexfile.ts
docker kill --signal=SIGUSR1 ycode-rest      # reload PostgREST schema cache after migrations
npm run dev                                   # http://localhost:3002

# app — containerised (for servers): builds ycode/Dockerfile, migrates on boot
cd selfhost && docker compose --profile app up -d --build
```

## Stack gotchas (already solved — don't re-break)

- **postgres:18 moved `PGDATA`** to `/var/lib/postgresql/18/docker`; the volume
  must mount `/var/lib/postgresql` (not `/data`).
- **`auth.uid()/role()/email()`** must be owned by `supabase_auth_admin` (GoTrue
  does `CREATE OR REPLACE` on them). Set in `init-db/01-init.sql`.
- **Stock extensions** the `supabase/postgres` image ships but vanilla pg lacks
  (`pgcrypto`, …) are ensured every `up` by the `db-bootstrap` service via
  `compat/extensions.sql`. Add new ones there when an upstream migration needs them.
- **Caddy adds CORS headers** (Kong's job). Without them the browser auth client
  fails every call with "Failed to fetch".
- **Realtime** needs: `_realtime` + `realtime` schemas (in init), `wal_level=logical`,
  `SEED_SELF_HOST=false`, the `realtime-dev` tenant registered via the API
  (`realtime-bootstrap` service, `db_user=postgres`), and Caddy forwarding with
  `Host: realtime-dev.localhost` so the tenant resolves.
- **Migrations** can't run via `npm run migrate:latest` (unix-only inline env on
  Windows; knexfile imports `server-only` + uses the `@/` alias). Use the
  `npx knex` command above.

## Creating the first user

No public register screen for the first owner. Use the **GoTrue admin API**
(reliable, no SMTP needed):

```bash
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@co.com","password":"ChangeMe123!","email_confirm":true,"app_metadata":{"role":"owner"}}'
```

Or the `/ycode/welcome` wizard on a fresh install (zero users). More users via
the builder's **Invite** button (emails land in Mailpit at http://localhost:8025).

## Ycode has a built-in MCP server

Ycode **hosts** an MCP server (it is not an MCP client). An AI agent connects to
it to build/edit the site. Endpoint: `/ycode/mcp` (token-scoped
`/ycode/mcp/<token>`), OAuth-protected, managed in builder → **Integrations → MCP**.
~114 tools covering the whole builder (pages, layers, components, collections/CMS,
assets, styles, fonts, publishing, …). Connect via the MCP **Streamable HTTP**
transport (`@modelcontextprotocol/sdk` `StreamableHTTPClientTransport`).

### Building pages via MCP — rules learned the hard way

1. **`add_layer` ignores the `design` param** — it applies the element's default
   design. Apply your design with a **separate `update_design` op using the REAL
   layer id**. So build in two phases per section:
   `batch_operations`(add_layer with `ref_id`) → read `ref_ids` map →
   `batch_operations`(update_design with `layer_id = map[ref]`).
2. **`ref_id` only resolves as `parent_layer_id` within the SAME batch.**
   `update_design.layer_id` needs a real id, not a ref.
3. **Sections nest under `body`** (`parent_layer_id: "body"`). `get_layers` returns
   a **flat array** of top-level layers; `body` is one element, your sections are
   its children. To wipe a page, delete `body`'s children (not top-level siblings).
4. **Design value formats** (each category object needs `isActive: true`):
   - `layout.display`: `"Flex" | "grid" | "block" | "inline-block" | "hidden"`
   - `layout.justifyContent`: `"between"` (NOT `"space-between"`), `"center"`, `"start"`
   - `layout.flexDirection`: must be set explicitly (`"row"`/`"column"`) — the
     section default is `column`.
   - `typography.fontSize` / `spacing.padding*`: px strings, e.g. `"60px"`, `"24px"`.
   - colors (`backgroundColor`, `color`): hex, e.g. `"#4f46e5"`.
   - `borders.borderRadius`: `"16px"` / `"0.5rem"`; `sizing.width`: `"100%"`, `"800px"`.
5. **Responsive**: `update_design` takes `breakpoint: "tablet" | "mobile"`
   (desktop-first cascade → `max-*` Tailwind classes). Override only what changes
   (e.g. grid `gridTemplateColumns: "1fr"` on mobile, smaller `fontSize`, reduced
   padding, `display: "hidden"` to hide desktop nav).
6. **Preview lies.** `/ycode/preview` uses a limited precompiled Tailwind CSS, so
   arbitrary classes (`bg-[#4f46e5]`, `text-[60px]`, custom padding) DON'T render
   there. **Call `publish`, then screenshot the public site (`/`)** — that path
   runs Ycode's `cssGenerator` which compiles all arbitrary classes.
7. `batch_operations` ≤ 50 ops. Op types: `add_layer`, `update_design`,
   `update_text`, `update_image`, `delete_layer`, `move_layer`, `apply_style`,
   `set_rich_text`.
8. **Interactions** (`set_layer_interactions`) are GSAP click/hover **one-shot**
   timelines. A stateful toggle (e.g. a hamburger that opens AND closes a menu) is
   not cleanly expressible; reveal-on-click over a CSS-hidden element is unreliable.
   For a real mobile nav, prefer Ycode's built-in navigation component/template.
9. `add_layout` inserts a prebuilt template block (`list_layouts` → keys like
   `hero-001`). Use it for speed; use raw `add_layer` + `update_design` for fully
   custom sections.

### Native components & interactive elements — USE THESE, don't hand-roll

There is **no prebuilt component library** (`list_components` is empty on a fresh
install — components are *your* reusable elements, made with `create_component`).
"Native" capability comes from two places:

**A. The layout library (`add_layout` / `list_layouts`)** — pre-built, already
responsive, and (where relevant) **already wired with interactions**. Categories:
Navigation, Header, Hero, Features, Blog header, Blog posts, Stats, Team,
Testimonials, Pricing, FAQ, Footer. Examples that ship working behavior:
- `navigation-001` / `navigation-002` → responsive nav **with a working hamburger
  + mobile dropdown** (the click toggle is pre-wired).
- `faq-001` → accordion with expand/collapse pre-wired.

**B. Native interactive element templates (`add_layer` `template`)** — widgets with
built-in behavior, no GSAP needed:
`slider` (carousel), `lightbox` (modal/popup), `filter` (+ `input`/`select`/
`checkbox`/`radio` for faceted filtering), `form`/`input`/`textarea` (forms),
`localeSelector` (language switch), `map`, `table`, `collection` (CMS list).

**Rule of thumb:** build *static / visual* sections custom (`add_layer` +
`update_design`) for unique design; for anything **interactive or standard
(nav+hamburger, accordion, carousel, modal, tabs, filters, forms, language
switch)** use the native layout or element and restyle its layers with
`update_design`. Do NOT hand-wire `set_layer_interactions` to fake these.

**Why:** a hand-built hamburger (custom button + custom hidden menu + a click
interaction) does **not** toggle reliably — even matching the native interaction
shape. The working toggle depends on the native layout's element structure, not
just the interaction config. The reference shape Ycode's nav uses (for awareness):
`trigger:"click"`, `timeline:{ yoyo:true, repeat:0, breakpoints:["mobile"] }`,
tween `from:{display:"hidden",autoAlpha:"0"}` → `to:{display:"visible",autoAlpha:"100"}`,
`apply_styles.display:"on-load"`. The runtime treats click-triggered timelines as
toggles (reverses on alternate clicks). Reproducing it standalone is unreliable —
**reach for `add_layout navigation-00x` instead.**

**Placing & fixing the native nav:**
- `add_layout` appends to the **page root** (a sibling of `body`) unless you pass
  `parent_layer_id: "body"`. Your custom sections live *inside* `body`, so add the
  nav with `{ parent_layer_id: "body", position: 0 }` to put it first in the page.
- The native mobile menu opens **in normal document flow → it pushes the content
  down.** To make it overlay instead, set the menu container (the hamburger
  interaction's tween `layer_id`) to `positioning: { position: "absolute",
  top: "100%", left: "0", zIndex: "50" }` (+ a background and width 100%) on the
  `mobile` breakpoint, and make the nav section its positioning context
  (`position: sticky/relative`).
- Rebrand template text with the `update_text` batch op (or `update_layer_text`).
  A template's logo is usually an `img` — to use a wordmark, add a `text` layer to
  the logo's parent and delete the image.

## Verifying UI work

Use the Playwright MCP. **Publish first**, then navigate to the public site (`/`),
not the builder. `browser_take_screenshot` saves to the workspace root
(`D:\Server\Y code\`). For responsive checks: `browser_resize` to 390×844 (mobile)
or 820×1180 (tablet), reload, screenshot.

## House rules

- **Commits:** never add `Co-Authored-By` / AI-attribution trailers (the user's
  Vercel-style deploys validate authors; AI attribution is unwanted).
- Keep all customization in `selfhost/` + gitignored `.env` so upstream stays
  merge-clean. Stack fixes go in `selfhost/`, never in Ycode source.
- Temp scripts: prefix with `_` and delete them when done (they sit in `ycode/`
  only to resolve `node_modules`).
