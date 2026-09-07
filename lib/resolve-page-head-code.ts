/**
 * Resolve document-level page chrome (custom `<head>` HTML + body classes)
 * from the request pathname so the site layout can bake them into the SSR
 * document. Body classes must be on `<body>` in the first HTML byte to avoid
 * a background/font flash (the FOUC twin of `<html lang>`).
 *
 * SERVER-ONLY: uses page-fetcher, page_layers, and CMS placeholder resolution.
 */

import 'server-only';

import { unstable_cache } from 'next/cache';
import { getBodyClasses } from '@/lib/body-classes';
import { fetchErrorPage, fetchHomepage, fetchPageByPathForMetadata } from '@/lib/page-fetcher';
import { parsePathnameForPageHead } from '@/lib/page-head-path';
import { getDraftLayers, getPublishedLayers } from '@/lib/repositories/pageLayersRepository';
import { resolveCustomCodePlaceholders } from '@/lib/resolve-cms-variables';
import { getSupabaseAdmin } from '@/lib/supabase-server';

import type { CollectionField, CollectionItemWithValues, Page } from '@/types';

export interface PageDocumentChrome {
  customHead: string;
  bodyClasses: string;
}

const EMPTY_CHROME: PageDocumentChrome = { customHead: '', bodyClasses: '' };

async function resolveHeadFromPage(
  page: Page,
  isPublished: boolean,
  collectionItem?: CollectionItemWithValues,
  collectionFields?: CollectionField[]
): Promise<string> {
  const raw = page.settings?.custom_code?.head || '';
  if (!raw) {
    return '';
  }

  if (page.is_dynamic && collectionItem && collectionFields && collectionFields.length > 0) {
    return resolveCustomCodePlaceholders(raw, collectionItem, collectionFields, isPublished);
  }

  return raw;
}

async function loadBodyClassesForPageId(
  pageId: string,
  isPublished: boolean
): Promise<string> {
  try {
    const pageLayers = isPublished
      ? await getPublishedLayers(pageId)
      : await getDraftLayers(pageId);
    return getBodyClasses(pageLayers?.layers);
  } catch {
    return '';
  }
}

async function loadBodyClassesForErrorPage(
  errorCode: number,
  isPublished: boolean
): Promise<string> {
  const client = await getSupabaseAdmin();
  if (!client) {
    return '';
  }

  const { data: errorPage } = await client
    .from('pages')
    .select('id')
    .eq('error_page', errorCode)
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .maybeSingle();

  if (!errorPage) {
    return '';
  }

  return loadBodyClassesForPageId(errorPage.id, isPublished);
}

async function loadPageDocumentChrome(
  slugPath: string,
  isPublished: boolean,
  errorCode: number | null
): Promise<PageDocumentChrome> {
  try {
    if (errorCode != null) {
      const data = await fetchErrorPage(errorCode, isPublished);
      if (!data?.page) {
        return EMPTY_CHROME;
      }

      return {
        customHead: await resolveHeadFromPage(
          data.page,
          isPublished,
          data.collectionItem,
          data.collectionFields
        ),
        bodyClasses: getBodyClasses(data.pageLayers?.layers),
      };
    }

    // Homepage lives at is_index, not an empty slug match.
    if (slugPath === '') {
      const data = await fetchHomepage(isPublished);
      if (!data?.page) {
        return EMPTY_CHROME;
      }

      return {
        customHead: await resolveHeadFromPage(data.page, isPublished),
        bodyClasses: getBodyClasses(data.pageLayers?.layers),
      };
    }

    const data = await fetchPageByPathForMetadata(slugPath, isPublished);
    if (!data?.page) {
      // Unknown URL renders not-found inside this layout — use the custom 404
      // body classes so the error page's background is in the first HTML byte.
      return {
        customHead: '',
        bodyClasses: await loadBodyClassesForErrorPage(404, isPublished),
      };
    }

    const fromFetchedLayers = getBodyClasses(data.pageLayers?.layers);
    return {
      customHead: await resolveHeadFromPage(
        data.page,
        isPublished,
        data.collectionItem,
        data.collectionFields
      ),
      bodyClasses: fromFetchedLayers || await loadBodyClassesForPageId(data.page.id, isPublished),
    };
  } catch (error) {
    console.error('[resolve-page-head-code] Failed to load page document chrome:', error);
    return EMPTY_CHROME;
  }
}

/**
 * Load custom head HTML and body-layer classes for the page at `pathname`.
 * Published lookups are cached until publish; preview is always fresh.
 */
export async function resolvePageDocumentChrome(
  pathname: string
): Promise<PageDocumentChrome> {
  const { isPreview, errorCode, slugPath } = parsePathnameForPageHead(pathname);
  const isPublished = !isPreview;

  if (isPreview) {
    return loadPageDocumentChrome(slugPath, false, errorCode);
  }

  const cacheKey = errorCode != null
    ? `error-${errorCode}`
    : (slugPath || '/');
  const routeTag = errorCode != null
    ? 'all-pages'
    : `route-${cacheKey === '/' ? '/' : `/${cacheKey}`}`;

  return unstable_cache(
    () => loadPageDocumentChrome(slugPath, true, errorCode),
    ['page-document-chrome', cacheKey],
    { tags: [routeTag, 'all-pages'], revalidate: false }
  )();
}

/**
 * Load the custom head HTML for the page at `pathname`.
 * Published lookups are cached until publish; preview is always fresh.
 */
export async function resolvePageCustomHeadCode(pathname: string): Promise<string> {
  const { customHead } = await resolvePageDocumentChrome(pathname);
  return customHead;
}
