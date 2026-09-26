'use client';

interface ErrorFallbackProps {
  /** True for the published error boundary, false for the preview one. */
  published: boolean;
  /** Reset callback from the Next.js error boundary. */
  reset?: () => void;
}

/**
 * Minimal static 500 shown by the error boundaries. Deliberately free of the
 * heavy renderer graph (LayerRendererPublic, YcodeBadge) so the boundary chunk
 * stays tiny and never bloats a page's errorScripts.
 */
export default function ErrorFallback({ published, reset }: ErrorFallbackProps) {
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
        {reset && (
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
