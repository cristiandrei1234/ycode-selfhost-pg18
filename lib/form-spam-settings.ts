/**
 * Spam protection configuration for public form submissions.
 *
 * Unlike security headers, protection is ON by default: a site with no saved
 * configuration gets the defaults below. The settings UI only ever loosens
 * them, so a fresh install is never left unprotected.
 */

/** Hidden decoy field rendered on every public form; only bots fill it in. */
export const HONEYPOT_FIELD_NAME = 'ycode_hp';

/** The settings key under which the configuration is stored. */
export const FORM_SPAM_SETTING_KEY = 'form_spam_protection';

/** Window the per-IP submission limit is measured over. */
export const RATE_LIMIT_WINDOW_MINUTES = 10;

const MIN_RATE_LIMIT = 1;
const MAX_RATE_LIMIT = 1000;

export interface FormSpamSettings {
  /** Master toggle. When false, every submission is accepted. */
  enabled: boolean;
  /** Cap submissions per IP within the rate limit window. */
  rateLimitEnabled: boolean;
  /** Maximum submissions allowed from one IP per window. */
  rateLimitMaxSubmissions: number;
  /** Accept submissions posted from other origins (headless frontends, apps). */
  allowExternalSubmissions: boolean;
}

/** Defaults applied when a site has saved no configuration. */
export function getDefaultFormSpamSettings(): FormSpamSettings {
  return {
    enabled: true,
    rateLimitEnabled: true,
    // Low enough to blunt a flood, high enough for a shared office IP.
    rateLimitMaxSubmissions: 10,
    allowExternalSubmissions: false,
  };
}

/**
 * Merge a stored configuration over the defaults, clamping the rate limit to
 * a sane range so a bad value can't disable or lock out submissions.
 */
export function resolveFormSpamSettings(
  stored: Partial<FormSpamSettings> | null,
): FormSpamSettings {
  const settings = { ...getDefaultFormSpamSettings(), ...(stored || {}) };

  settings.rateLimitMaxSubmissions = Math.min(
    MAX_RATE_LIMIT,
    Math.max(MIN_RATE_LIMIT, Math.round(settings.rateLimitMaxSubmissions) || MIN_RATE_LIMIT),
  );

  return settings;
}
