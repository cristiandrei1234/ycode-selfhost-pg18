'use client';

import { useEffect, useState, type ComponentType } from 'react';
import ErrorFallback from '@/components/ErrorFallback';

interface ErrorPageContentProps {
  published: boolean;
  reset: () => void;
}

interface DeferredErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** True for the published error boundary, false for the preview one. */
  published: boolean;
}

/**
 * Renders a minimal static 500 immediately, then loads the custom 500 renderer
 * lazily via a runtime import() (only after an error occurs). Using a bare
 * import() instead of next/dynamic keeps the heavy renderer chunks out of every
 * published page's errorScripts.
 */
export default function DeferredErrorPage({ error, reset, published }: DeferredErrorPageProps) {
  const [ErrorPageContent, setErrorPageContent] =
    useState<ComponentType<ErrorPageContentProps> | null>(null);

  useEffect(() => {
    console.error(published ? 'Published page error:' : 'Preview page error:', error);

    let isActive = true;
    import('@/components/ErrorPageContent').then((mod) => {
      if (isActive) setErrorPageContent(() => mod.default);
    });

    return () => {
      isActive = false;
    };
  }, [error, published]);

  if (ErrorPageContent) {
    return <ErrorPageContent published={published} reset={reset} />;
  }

  return <ErrorFallback published={published} reset={reset} />;
}
