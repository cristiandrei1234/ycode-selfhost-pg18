import '@/app/site.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import HreflangAlternateLinks from '@/components/HreflangAlternateLinks';
import RootLayoutShell, { defaultMetadata } from '@/components/RootLayoutShell';
import { composeDocumentBodyClassName } from '@/lib/body-classes';
import { fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { renderRootLayoutHeadCode } from '@/lib/parse-head-html';
import { resolvePageDocumentChrome } from '@/lib/resolve-page-head-code';
import { runWithYcodeStamp } from '@/lib/ycode-html-comment';

const ycodeGeneratorMetadata: Metadata = {
  ...defaultMetadata,
  other: { generator: 'Ycode' },
};

interface SiteDocumentLayoutProps {
  children: ReactNode;
  /** BCP-47 language baked into `<html lang>` for the current URL. */
  lang: string;
  /**
   * Public pathname for this document (`/` or `/fr/about`). Used to inject
   * page-level custom `<head>` code, body-layer classes, and hreflang
   * without reading request headers.
   */
  pathname: string;
}

/**
 * Shared `<html>` document for published, preview, and pagination routes.
 * `lang`, `dir`, and `pathname` must come from route params (or a rewrite's
 * original path) so cloud ISR can still emit them in the first HTML byte.
 */
export default async function SiteDocumentLayout({
  children,
  lang,
  pathname,
}: SiteDocumentLayoutProps) {
  const headElements: ReactNode[] = [];
  let publishedAt: string | null = null;
  let bodyClasses = '';

  try {
    const [globalSettings, pageChrome] = await Promise.all([
      fetchGlobalPageSettings(),
      resolvePageDocumentChrome(pathname),
    ]);
    publishedAt = globalSettings.publishedAt ?? null;
    bodyClasses = pageChrome.bodyClasses;
    if (pageChrome.hreflang.length > 0) {
      headElements.push(
        <HreflangAlternateLinks
          key="hreflang"
          alternates={pageChrome.hreflang}
        />
      );
    }
    if (globalSettings.globalCustomCodeHead) {
      headElements.push(...renderRootLayoutHeadCode(globalSettings.globalCustomCodeHead));
    }
    if (pageChrome.customHead) {
      headElements.push(...renderRootLayoutHeadCode(pageChrome.customHead, 'page-head'));
    }
  } catch {
    // Supabase not configured — stamp still emits the Made in line
  }

  return runWithYcodeStamp(publishedAt, () => (
    <RootLayoutShell
      lang={lang}
      headElements={headElements}
      bodyClassName={composeDocumentBodyClassName(bodyClasses)}
    >
      {children}
    </RootLayoutShell>
  ));
}

export async function generateSiteMetadata(): Promise<Metadata> {
  if (process.env.SKIP_SETUP === 'true') {
    return ycodeGeneratorMetadata;
  }

  try {
    const globalSettings = await fetchGlobalPageSettings();
    const metadata: Metadata = { ...ycodeGeneratorMetadata };

    if (globalSettings.faviconUrl || globalSettings.webClipUrl) {
      metadata.icons = {};
      if (globalSettings.faviconUrl) {
        metadata.icons.icon = globalSettings.faviconUrl;
      }
      if (globalSettings.webClipUrl) {
        metadata.icons.apple = globalSettings.webClipUrl;
      }
    }

    return metadata;
  } catch {
    return ycodeGeneratorMetadata;
  }
}
