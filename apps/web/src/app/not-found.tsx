'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

// Force dynamic rendering to bypass Next.js 16 pre-rendering bug
export const dynamic = 'force-dynamic';

/**
 * Custom 404 Not Found page
 *
 * Provides a user-friendly error page when routes don't exist
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-primary">404</h1>
          <h2 className="text-3xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            <Home className="h-5 w-5" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>

        <div className="pt-8 text-sm text-muted-foreground">
          <p>Looking for something specific? Try:</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/" className="text-primary hover:underline">
                Network Map
              </Link>
            </li>
            <li>
              <Link href="/stats" className="text-primary hover:underline">
                Network Statistics
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className="text-primary hover:underline">
                Node Leaderboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
