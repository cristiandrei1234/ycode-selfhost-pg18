import { getRequestOrigin } from '@/lib/url-utils';

/**
 * Extract the client IP from reverse-proxy headers.
 * Returns null when no forwarding header is present (e.g. local dev).
 */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || null;
}

/**
 * Check that a request was issued by the site itself.
 *
 * Compares the Origin (or Referer) host against the request host, so it holds
 * for any domain the site is served on without configuration. Only the host is
 * compared because a reverse proxy may terminate TLS and leave the forwarded
 * protocol unset. Requests missing both headers count as cross-origin —
 * browsers always send Origin on POST.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const requestOrigin = getRequestOrigin(headers);
  const source = headers.get('origin') || headers.get('referer');

  if (!requestOrigin || !source) {
    return false;
  }

  try {
    return new URL(source).host === new URL(requestOrigin).host;
  } catch {
    return false;
  }
}
