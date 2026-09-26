import {
  FORM_SPAM_SETTING_KEY,
  HONEYPOT_FIELD_NAME,
  RATE_LIMIT_WINDOW_MINUTES,
  resolveFormSpamSettings,
} from '@/lib/form-spam-settings';
import { getClientIp, isSameOriginRequest } from '@/lib/request-utils';
import { countRecentSubmissionsByIp } from '@/lib/repositories/formSubmissionRepository';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

/**
 * Spam protection for public form submissions.
 *
 * Layered so that no single check has to be perfect:
 * 1. Same-origin — blocks bots posting straight to the endpoint
 * 2. Payload caps — blocks oversized/abusive bodies
 * 3. Honeypot — catches bots that fill every field on the page
 * 4. Rate limit — caps how many submissions one IP can send
 *
 * Configured via Settings → Security; see `@/lib/form-spam-settings`.
 */

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_FIELD_COUNT = 100;
const MAX_VALUE_LENGTH = 10000;

export type FormSubmissionVerdict =
  /** Genuine submission — store and notify. */
  | { outcome: 'accept' }
  /** Store as spam, skip notifications, and report success so bots stop retrying. */
  | { outcome: 'spam' }
  /** Refuse outright. */
  | { outcome: 'reject'; status: number; error: string };

/**
 * Remove the honeypot field so it never reaches the inbox or notifications.
 */
export function stripHoneypotField(payload: Record<string, any>): Record<string, any> {
  const { [HONEYPOT_FIELD_NAME]: _honeypot, ...rest } = payload;
  return rest;
}

/**
 * A filled honeypot means a bot: the field is visually hidden and labelled
 * "do not fill in" for screen readers.
 */
function isHoneypotFilled(payload: Record<string, any>): boolean {
  const value = payload[HONEYPOT_FIELD_NAME];
  return typeof value === 'string' ? value.trim() !== '' : value != null;
}

/**
 * Reject payloads that are too large to be a real form, to cap storage abuse.
 */
function getPayloadSizeError(payload: Record<string, any>): string | null {
  const fields = Object.keys(payload);

  if (fields.length > MAX_FIELD_COUNT) {
    return 'Too many form fields';
  }

  for (const value of Object.values(payload)) {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((entry) => typeof entry === 'string' && entry.length > MAX_VALUE_LENGTH)) {
      return 'Form field value is too long';
    }
  }

  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) {
    return 'Form submission is too large';
  }

  return null;
}

/**
 * Screen a submission before it is stored.
 *
 * Runs against the raw payload (honeypot still included) — call
 * `stripHoneypotField` before persisting.
 */
export async function screenFormSubmission(
  headers: Headers,
  payload: Record<string, any>,
  tenantId?: string
): Promise<FormSubmissionVerdict> {
  const settings = resolveFormSpamSettings(
    await getSettingByKey(FORM_SPAM_SETTING_KEY, tenantId)
  );

  if (!settings.enabled) {
    return { outcome: 'accept' };
  }

  if (!settings.allowExternalSubmissions && !isSameOriginRequest(headers)) {
    return { outcome: 'reject', status: 403, error: 'Form submissions must originate from the site' };
  }

  const sizeError = getPayloadSizeError(payload);
  if (sizeError) {
    return { outcome: 'reject', status: 400, error: sizeError };
  }

  if (isHoneypotFilled(payload)) {
    return { outcome: 'spam' };
  }

  // Skipped when the IP is unknown (no proxy headers) rather than lumping
  // every visitor into a single shared bucket.
  const ip = settings.rateLimitEnabled ? getClientIp(headers) : null;
  if (ip) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const recentCount = await countRecentSubmissionsByIp(ip, since, tenantId);

    if (recentCount >= settings.rateLimitMaxSubmissions) {
      return { outcome: 'reject', status: 429, error: 'Too many submissions. Please try again later.' };
    }
  }

  return { outcome: 'accept' };
}
