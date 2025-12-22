'use client';

import { useEffect } from 'react';

// Force dynamic rendering to bypass Next.js 16 pre-rendering bug
export const dynamic = 'force-dynamic';

/**
 * Root error boundary
 *
 * Catches and displays errors that occur during rendering
 * in the application root.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We encountered an error while loading the page.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-left">
            <p className="text-sm font-mono text-destructive break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-2 border border-input bg-background rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
