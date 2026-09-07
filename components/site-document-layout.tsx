import '@/app/site.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import RootLayoutShell, { defaultMetadata } from '@/components/RootLayoutShell';
import { fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { renderRootLayoutHeadCode } from '@/lib/parse-head-html';
import { resolvePageCustomHeadCode } from '@/lib/resolve-page-head-code';
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
   * page-level custom `<head>` code without reading request headers.
   */
  pathname: string;
}

/**
 * Shared `<html>` document for published, preview, and pagination routes.
 * `lang` and `pathname` must come from route params (or a rewrite's original
 * path) so cloud ISR can still emit the attribute in the first HTML byte.
 */
export default async function SiteDocumentLayout({
  children,
  lang,
  pathname,
}: SiteDocumentLayoutProps) {
  const headElements: ReactNode[] = [];
  let publishedAt: string | null = null;

  try {
    const [globalSettings, pageCustomHead] = await Promise.all([
      fetchGlobalPageSettings(),
      resolvePageCustomHeadCode(pathname),
    ]);
    publishedAt = globalSettings.publishedAt ?? null;
    if (globalSettings.globalCustomCodeHead) {
      headElements.push(...renderRootLayoutHeadCode(globalSettings.globalCustomCodeHead));
    }
    if (pageCustomHead) {
      headElements.push(...renderRootLayoutHeadCode(pageCustomHead, 'page-head'));
    }
  } catch {
    // Supabase not configured — stamp still emits the Made in line
  }

  return runWithYcodeStamp(publishedAt, () => (
    <RootLayoutShell
      lang={lang}
      headElements={headElements}
      bodyClassName="font-sans"
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
