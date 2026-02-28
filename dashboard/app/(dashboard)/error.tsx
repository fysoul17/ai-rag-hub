'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Next.js error boundaries already report errors to the framework.
  // Avoid redundant console.error in production.
  useEffect(() => {}, []);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="glass rounded-xl border border-neon-red/30 p-8 text-center max-w-md">
        <h2 className="text-lg font-bold text-neon-red mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-neon-red px-4 py-2 text-sm font-medium text-white hover:bg-neon-red/80 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
