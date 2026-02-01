'use client';

import Link from 'next/link';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="nf-404 relative flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--headerH, 72px))' }}>
      <div className="relative z-10 text-center px-6">
        <h1 className="text-xl font-semibold mb-3">Something went wrong</h1>
        <p className="text-sm text-neutral-500 mb-6">An unexpected error occurred. Please try again, or return to the home page.</p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 font-semibold underline underline-offset-4 lg:hover:opacity-80"
            onClick={() => reset()}
          >
            Try again
          </button>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold underline underline-offset-4 lg:hover:opacity-80">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
