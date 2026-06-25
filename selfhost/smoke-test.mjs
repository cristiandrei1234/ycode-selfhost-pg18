// End-to-end smoke test for the lean stack, all traffic through the Caddy
// gateway at :8000 — exactly how supabase-js (and therefore Ycode) talks to it.
// Keys come from the environment in CI (fresh per run); fall back to the local
// demo keys for ad-hoc runs against the dev stack.
const GW = process.env.GATEWAY_URL || 'http://localhost:8000';
const ANON = process.env.ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDAwMDAwLCJleHAiOjIwNjUzNjAwMDB9.L4bm4pEonNipxBA3eDyyyKh6XHgsReMuns239jNhAbo';
const SERVICE = process.env.SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMDAwMDAsImV4cCI6MjA2NTM2MDAwMH0.XZoV3bdE4zyK_qhj45yMdMqZU-oevXUJPdZ9hQohr1I';

let pass = 0, fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); c ? pass++ : fail++; };

// 1. Gateway → PostgREST: read the seed row using the service_role key
{
  const r = await fetch(`${GW}/rest/v1/healthcheck?select=note`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const body = await r.json();
  ok(`PostgREST via /rest/v1 (service_role) → ${JSON.stringify(body)}`,
     r.ok && body[0]?.note === 'lean-stack-ok');
}

// 2. Gateway → GoTrue admin: create a user (this is auth.admin.createUser)
const email = `owner_${process.pid}_${process.ppid}@ycode.local`;
const password = 'Test123456!';
let userId = null;
{
  const r = await fetch(`${GW}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role: 'owner' } }),
  });
  const body = await r.json();
  userId = body.id;
  ok(`GoTrue admin create user → id=${userId} role=${body.app_metadata?.role}`,
     r.ok && !!userId && body.app_metadata?.role === 'owner');
}

// 3. Gateway → GoTrue: password login (this is auth.signInWithPassword)
let userJwt = null;
{
  const r = await fetch(`${GW}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await r.json();
  userJwt = body.access_token;
  ok(`GoTrue password login → got access_token=${!!userJwt} token_role embedded`,
     r.ok && !!userJwt);
}

// 4. The session JWT from GoTrue is accepted by PostgREST (SAME shared secret)
{
  const r = await fetch(`${GW}/rest/v1/healthcheck?select=note`, {
    headers: { apikey: ANON, Authorization: `Bearer ${userJwt}` },
  });
  const body = await r.json();
  ok(`GoTrue-issued JWT validated by PostgREST (cross-service secret) → ${JSON.stringify(body)}`,
     r.ok && Array.isArray(body));
}

// 5. Gateway → GoTrue: verify the session (this is auth.getUser, used everywhere)
{
  const r = await fetch(`${GW}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${userJwt}` },
  });
  const body = await r.json();
  ok(`GoTrue getUser(session) → ${body.email} role=${body.app_metadata?.role}`,
     r.ok && body.email === email && body.app_metadata?.role === 'owner');
}

// 6. Gateway → Storage API reachable + DB-migrated (admin.listBuckets path)
{
  const r = await fetch(`${GW}/storage/v1/bucket`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const body = await r.json();
  ok(`Storage API via /storage/v1/bucket → HTTP ${r.status} ${JSON.stringify(body).slice(0,80)}`,
     r.ok && Array.isArray(body));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
