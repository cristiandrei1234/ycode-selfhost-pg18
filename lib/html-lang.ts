/**
 * Resolve the BCP-47 language for `<html lang>` from a public-site pathname.
 * Pure helper — used by the document layout and by unit tests.
 */

import { detectLocaleFromPath } from '@/lib/page-utils';

const FALLBACK_LANG = 'en';

export interface HtmlLangLocale {
  code: string;
  is_default: boolean;
}

/**
 * Pick the document language from a slug path and the site's locale list.
 * Default-locale URLs have no prefix; other locales are the first segment.
 */
export function htmlLangFromLocales(
  slugPath: string,
  locales: HtmlLangLocale[],
): string {
  const defaultCode = locales.find((locale) => locale.is_default)?.code
    || locales[0]?.code
    || FALLBACK_LANG;

  if (!slugPath) {
    return defaultCode;
  }

  const detected = detectLocaleFromPath(
    slugPath,
    locales.map((locale) => locale.code),
  );

  if (!detected) {
    return defaultCode;
  }

  const matched = locales.find(
    (locale) => locale.code.toLowerCase() === detected.localeCode.toLowerCase(),
  );

  return matched?.code || defaultCode;
}
