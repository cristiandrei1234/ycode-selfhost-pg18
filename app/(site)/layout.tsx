import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import SiteDocumentLayout, { generateSiteMetadata } from '@/components/site-document-layout';
import { parsePathnameForPageHead } from '@/lib/page-head-path';
import { resolveHtmlLang } from '@/lib/resolve-html-lang';

export const generateMetadata = generateSiteMetadata;

/**
 * Root layout for preview, pagination rewrites, and other non-published-page
 * public routes. Published pages use `(published)/[[...slug]]` so they can
 * set `<html lang>` from static params without calling headers().
 */
export default async function SiteLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  const { isPreview, slugPath } = parsePathnameForPageHead(pathname);
  const lang = await resolveHtmlLang(slugPath, !isPreview);

  return (
    <SiteDocumentLayout
      lang={lang}
      pathname={pathname}
    >
      {children}
    </SiteDocumentLayout>
  );
}
