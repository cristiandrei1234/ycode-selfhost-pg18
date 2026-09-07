import type { ReactNode } from 'react';
import SiteDocumentLayout, { generateSiteMetadata } from '@/components/site-document-layout';
import { resolveHtmlLang } from '@/lib/resolve-html-lang';

export const generateMetadata = generateSiteMetadata;

interface PublishedLayoutProps {
  children: ReactNode;
  params: Promise<{ slug?: string[] }>;
}

/**
 * Root layout for published pages. Lives inside the optional catch-all so it
 * receives the URL slug at static-generation time and can set `<html lang>`,
 * `dir`, and `<body class>` in the first HTML byte — required for SEO / a11y
 * (no after-paint script). Cloud ISR stays intact because this does not call
 * headers().
 */
export default async function PublishedLayout({
  children,
  params,
}: PublishedLayoutProps) {
  const { slug } = await params;
  const slugPath = slug?.join('/') ?? '';
  const lang = await resolveHtmlLang(slugPath, true);
  const pathname = slugPath ? `/${slugPath}` : '/';

  return (
    <SiteDocumentLayout
      lang={lang}
      pathname={pathname}
    >
      {children}
    </SiteDocumentLayout>
  );
}
