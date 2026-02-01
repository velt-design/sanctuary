// components/SiteFooter.tsx
'use client';

import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="bg-[#121212] text-[#f5f6f7] min-h-[100dvh] flex items-center justify-center relative">
      <div className="mx-auto w-full max-w-5xl px-8 md:px-12 py-16 grid gap-16 md:grid-cols-2">
        {/* Left column: navigation + privacy + social */}
        <div className="flex flex-col items-start text-left gap-10 pl-2 md:pl-6">
          <nav
            aria-label="Footer navigation"
            className="space-y-5 text-lg md:text-3xl font-medium tracking-[0.18em] uppercase"
          >
            <div>
              <Link href="/" className="lg:hover:opacity-80">
                Home
              </Link>
            </div>
            <div>
              <Link href="/products" className="lg:hover:opacity-80">
                Products
              </Link>
            </div>
            <div>
              <Link href="/projects" className="lg:hover:opacity-80">
                Projects
              </Link>
            </div>
            <div>
              <Link href="/contact" className="lg:hover:opacity-80">
                Contact
              </Link>
            </div>
          </nav>

          <div className="space-y-3 text-xs md:text-base tracking-[0.22em] uppercase text-[#f5f6f7]/80">
            <div>
              <Link href="/privacy" className="underline underline-offset-4 lg:hover:opacity-80">
                Privacy Policy
              </Link>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://www.instagram.com/sanctuarypergolas/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 lg:hover:opacity-80"
              >
                Instagram
              </a>
              <a
                href="https://www.facebook.com/SanctuaryPergolas"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 lg:hover:opacity-80"
              >
                Facebook
              </a>
            </div>
          </div>
        </div>

        {/* Right column: CTA and warehouse address */}
        <div className="flex flex-col items-end text-right gap-10 pr-2 md:pr-6">
          <div className="space-y-6 md:space-y-8">
            <p className="text-xs md:text-base font-medium uppercase tracking-[0.2em] text-[#f5f6f7]/70">
              Have a project in mind?
            </p>
            <h2 className="text-3xl font-semibold tracking-[0.18em] uppercase sm:text-4xl md:text-5xl">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center border border-[#f5f6f7] px-7 py-3 text-sm md:text-lg font-medium tracking-[0.22em] uppercase lg:hover:bg-[#f5f6f7] lg:hover:text-[#121212]"
              >
                Let&apos;s talk
              </Link>
            </h2>
          </div>

          <div className="mt-auto space-y-1 text-sm md:text-lg leading-relaxed">
            <p className="font-semibold md:text-xl tracking-[0.18em] uppercase text-[#f5f6f7]/80">Warehouse</p>
            <p>71G Montgomerie Road</p>
            <p>Māngere, Auckland 2022</p>
            <p>New Zealand</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
