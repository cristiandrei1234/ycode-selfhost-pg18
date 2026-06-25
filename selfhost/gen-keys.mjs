import crypto from 'node:crypto';

/**
 * Mint an HS256 JWT the way Supabase does for its anon / service_role keys.
 * The same JWT_SECRET must be shared by GoTrue, PostgREST and the Storage API
 * so every component validates the same tokens.
 */
function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const data = `${head}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

// Fixed issued/expiry so re-running is deterministic (10-year validity).
const iat = 1750000000;            // ~2025-06-15
const exp = iat + 60 * 60 * 24 * 3650;

const secret = crypto.randomBytes(32).toString('hex'); // 64-char shared JWT secret

const anonKey = sign({ role: 'anon', iss: 'supabase', iat, exp }, secret);
const serviceKey = sign({ role: 'service_role', iss: 'supabase', iat, exp }, secret);

console.log(JSON.stringify({ secret, anonKey, serviceKey }, null, 2));
