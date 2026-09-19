'use client';

import { useEffect, useState } from 'react';
import LayerRendererPublic from '@/components/LayerRendererPublic';
import YcodeBadge from '@/components/YcodeBadge';
import type { PageData } from '@/lib/page-fetcher';

interface ErrorPageContentProps {
  /** True for the published error boundary, false for the preview one. */
  published: boolean;
  /** Reset callback from the Next.js error boundary. */
  reset: () => void;
}

/**
 * Shared custom-500 renderer for the published and preview error boundaries.
 * Isolated in its own module so the heavy LayerRendererPublic graph is loaded
 * lazily (via next/dynamic) only when an error renders — never shipped in
 * every route's error-boundary chunk.
 */
export default function ErrorPageContent({ published, reset }: ErrorPageContentProps) {
  const [errorPageData, setErrorPageData] = useState<PageData | null>(null);
  const [generatedCss, setGeneratedCss] = useState<string>('');
  const [colorVariablesCss, setColorVariablesCss] = useState<string>('');
  const [showBadge, setShowBadge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchErrorPage() {
      try {
        const response = await fetch(`/ycode/api/error-page?code=500&published=${published}`);
        if (response.ok) {
          const data = await response.json();
          setErrorPageData(data.pageData);
          setGeneratedCss(data.css || '');
          setColorVariablesCss(data.colorVariablesCss || '');
          if (published) {
            setShowBadge(data.ycodeBadge ?? true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch custom 500 page:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchErrorPage();
  }, [published]);

  if (isLoading) return null;

  if (errorPageData) {
    const customCodeHead = errorPageData.page.settings?.custom_code?.head || '';
    const customCodeBody = errorPageData.page.settings?.custom_code?.body || '';

    return (
      <>
        {generatedCss && (
          <style
            id="ycode-styles"
            dangerouslySetInnerHTML={{ __html: generatedCss }}
          />
        )}
        {colorVariablesCss && (
          <style
            id="ycode-color-vars"
            dangerouslySetInnerHTML={{ __html: colorVariablesCss }}
          />
        )}
        {customCodeHead && (
          <div dangerouslySetInnerHTML={{ __html: customCodeHead }} />
        )}
        <div className="min-h-screen bg-white">
          <LayerRendererPublic
            layers={errorPageData.pageLayers.layers || []}
            isPublished={published}
            pageCollectionItemId={errorPageData.collectionItem?.id}
            pageCollectionItemData={errorPageData.collectionItem?.values || undefined}
          />
        </div>
        {customCodeBody && (
          <div dangerouslySetInnerHTML={{ __html: customCodeBody }} />
        )}
        {showBadge && <YcodeBadge />}
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {published ? 'Server Error' : 'Preview Error'}
        </h2>
        <p className="text-gray-600 mb-8">
          {published
            ? 'Something went wrong on our end. Please try again later.'
            : 'An error occurred while rendering the preview. Please check your page configuration.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
      {showBadge && <YcodeBadge />}
    </div>
  );
}
