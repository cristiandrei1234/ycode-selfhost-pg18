/**
 * Server-only lookup of `<html lang>` from published/draft locales.
 * Kept off the pure helper so unit tests don't load Next.js cache APIs.
 */

import 'server-only';

import { unstable_cache } from 'next/cache';
import { htmlLangFromLocales } from '@/lib/html-lang';
import { getAllLocales } from '@/lib/repositories/localeRepository';

const FALLBACK_LANG = 'en';

const getCachedPublishedLocales = unstable_cache(
  async () => getAllLocales(true),
  ['published-html-lang-locales'],
  { tags: ['all-pages'], revalidate: false },
);

/**
 * Resolve `<html lang>` for a public pathname (no leading slash).
 * Falls back to `en` when locales cannot be loaded.
 */
export async function resolveHtmlLang(
  slugPath: string,
  isPublished = true,
): Promise<string> {
  try {
    const locales = isPublished
      ? await getCachedPublishedLocales()
      : await getAllLocales(false);

    return htmlLangFromLocales(slugPath, locales);
  } catch {
    return FALLBACK_LANG;
  }
}
