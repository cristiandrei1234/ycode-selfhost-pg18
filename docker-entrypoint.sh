#!/bin/sh
# Applies pending DB migrations (idempotent — knex tracks what ran), then starts
# the Next.js server. Disable the migration step with RUN_MIGRATIONS=false if you
# run migrations as a separate one-shot job.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[ycode] applying migrations..."
  NODE_NO_WARNINGS=1 TS_NODE_TRANSPILE_ONLY=1 \
    NODE_OPTIONS="--conditions=react-server --require tsconfig-paths/register" \
    npx knex migrate:latest --knexfile knexfile.ts
fi

echo "[ycode] starting Next.js on :${PORT:-3002}"
exec "$@"
