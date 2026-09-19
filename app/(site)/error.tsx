'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load the renderer graph so it never ships in the page's error-boundary
// chunk — it only downloads if an error actually renders a custom 500 page.
const ErrorPageContent = dynamic(() => import('@/components/ErrorPageContent'), {
  loading: () => null,
});

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary for published pages.
 * Shows the custom 500 page if available.
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Published page error:', error);
  }, [error]);

  return <ErrorPageContent published={true} reset={reset} />;
}
