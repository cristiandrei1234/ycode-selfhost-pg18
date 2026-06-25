# CLAUDE.md

This project = **Ycode self-hosted on a lean Supabase-compatible stack on plain
Postgres 18**. `ycode/` is the app (upstream, keep merge-clean); `selfhost/` is
the backend stack (all our customization).

## Read this first

The full operating guide — stack, gotchas, first-user, MCP page-building rules,
UI verification — lives in **[AGENTS.md](./AGENTS.md)**. Everything there applies
to you. The single source of operational truth for the stack is
**`selfhost/README.md`**.

## Quick map

- Start backend: `cd selfhost && docker compose up -d`
- Run app (local): `cd ycode && npm run dev` → http://localhost:3002 (migrations:
  see AGENTS.md — the `npm run migrate:latest` script is broken on Windows).
- Containerised app (server): `cd selfhost && docker compose --profile app up -d`
- Backend manual: `selfhost/README.md`. Emails: Mailpit at http://localhost:8025.

## The traps that cost the most time (full list in AGENTS.md)

- **MCP page-building:** `add_layer` ignores its `design` arg — apply design in a
  second `update_design` op on the real layer id (two-phase). Sections nest under
  `body`. Design values: `display:"Flex"/"grid"/"hidden"`, `justifyContent:"between"`,
  px strings, hex colors, explicit `flexDirection`. **Publish then screenshot the
  public site `/`** — the `/ycode/preview` route doesn't compile arbitrary classes.
- **Migrations:** run `npx knex migrate:latest --knexfile knexfile.ts` with
  `NODE_OPTIONS="--conditions=react-server --require tsconfig-paths/register"` and
  `TS_NODE_TRANSPILE_ONLY=1`. After migrating: `docker kill --signal=SIGUSR1 ycode-rest`.
- **Native vs custom in the builder:** build static/visual sections custom
  (`add_layer` + `update_design`); for anything **interactive or standard**
  (nav + hamburger, accordion, carousel, modal, tabs, filters, forms, language
  switch) use Ycode's **native layouts/elements** — `add_layout navigation-001`
  (working hamburger), `faq-001` (accordion), or native `slider`/`lightbox`/
  `filter`/`form`/`localeSelector` elements. Do NOT hand-wire GSAP
  (`set_layer_interactions`) to fake these — a hand-built hamburger toggle does
  not work reliably. There is no prebuilt component library (`list_components` is
  empty; components are user-made). Full details in AGENTS.md.
- **Stack fixes go in `selfhost/`, never in Ycode source** (keep upstream clean).

## House rules

- Never add `Co-Authored-By` / AI-attribution trailers to commits.
- Prefix throwaway scripts with `_` and delete them when done.
- Persistent project facts are in `~/.claude/projects/D--Server-Y-code/memory/`
  (`MEMORY.md` index) — check there for prior decisions; update it when you learn
  something durable.

> To use these docs inside the fork, copy `CLAUDE.md` + `AGENTS.md` into `ycode/`.
