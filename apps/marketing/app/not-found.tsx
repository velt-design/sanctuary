import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="nf-404 relative flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--headerH, 72px))' }}>
      {/* Background 404 */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-[#111]/6 font-extrabold"
        style={{ letterSpacing: '-0.04em' }}
      >
        <span className="block" style={{ fontSize: 'clamp(120px, 36vw, 560px)', lineHeight: 1 }}>
          404
        </span>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 text-center px-6">
        <p className="text-sm tracking-wide text-neutral-500 uppercase">Page not found</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-semibold underline underline-offset-4 lg:hover:opacity-80"
          >
            Home page
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black text-white" aria-hidden>
              →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
