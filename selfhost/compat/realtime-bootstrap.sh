#!/bin/sh
# Idempotently registers the single self-host Realtime tenant ("realtime-dev").
# We run Realtime with SEED_SELF_HOST=false because its built-in seed hardcodes a
# db password that doesn't match a vanilla-pg role. Instead we create the tenant
# via the API with db_user=postgres so it connects with credentials we control.
set -e

API="http://realtime:4000/api"
AUTH="Authorization: Bearer ${SERVICE_KEY}"

echo "[realtime-bootstrap] waiting for realtime..."
until [ "$(curl -s -o /dev/null -w '%{http_code}' "${API}/ping")" != "000" ]; do
  sleep 2
done

if [ "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" "${API}/tenants/realtime-dev")" = "200" ]; then
  echo "[realtime-bootstrap] tenant 'realtime-dev' already exists"
  exit 0
fi

curl -s -o /dev/null -X POST "${API}/tenants" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "tenant": {
    "name": "realtime-dev",
    "external_id": "realtime-dev",
    "jwt_secret": "'"${JWT_SECRET}"'",
    "extensions": [{
      "type": "postgres_cdc_rls",
      "settings": {
        "db_host": "db",
        "db_name": "postgres",
        "db_user": "postgres",
        "db_password": "'"${POSTGRES_PASSWORD}"'",
        "db_port": "5432",
        "region": "us-east-1",
        "poll_interval_ms": 100,
        "poll_max_record_bytes": 1048576,
        "ssl_enforced": false
      }
    }]
  }
}'
echo "[realtime-bootstrap] tenant 'realtime-dev' created"
