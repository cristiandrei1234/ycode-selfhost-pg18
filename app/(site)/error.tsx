'use client';

import DeferredErrorPage from '@/components/DeferredErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary for published pages. Shows a minimal static 500 and only
 * loads the custom 500 page after an error occurs.
 */
export default function Error({ error, reset }: ErrorProps) {
  return (
    <DeferredErrorPage
      error={error}
      reset={reset}
      published={true}
    />
  );
}
