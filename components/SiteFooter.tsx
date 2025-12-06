// components/SiteFooter.tsx
/* eslint-disable @next/next/no-img-element */

'use client';

import Link from 'next/link';

export default function SiteFooter() {

  return (
    <footer className="bg-[#121212] text-[#f5f6f7] min-h-[100dvh] flex justify-center relative">
      <div className="relative mx-auto flex w-full max-w-5xl flex-col md:flex-row items-start md:items-center justify-center md:justify-between gap-12 px-6 py-16">
        {/* Accurate NZ silhouette from Natural Earth, simplified for clean lines */}
        <div className="site-footer__map w-full md:w-auto md:max-w-[420px] md:flex-shrink-0 justify-center">
          <div className="relative w-full max-w-[420px] mx-auto">
            <img
              src="/nz-main.svg"
              alt=""
              aria-hidden="true"
              className="w-full h-auto max-h-[70vh] opacity-85"
            />

            {/* Auckland highlight ring overlay */}
            <div
              aria-hidden="true"
              className="site-footer__auckland-ring pointer-events-none hidden md:block"
            />

            {/* Desktop/tablet: red line + address overlaid on the map itself */}
            <div className="pointer-events-none absolute inset-0 hidden md:block">
              <div
                aria-hidden="true"
                className="absolute left-0 top-[56%] h-[2px] bg-[var(--accentRed,#813F39)]"
                style={{ width: '55%' }}
              />
              <div className="absolute left-0 top-[60%] text-left text-[14px] leading-snug whitespace-pre-line">
                Warehouse
                {'\n'}71G Montgomerie Road
                {'\n'}Māngere, Auckland 2022
                {'\n'}New Zealand
              </div>
            </div>
          </div>
        </div>

        {/* Right-hand CTA + footer links */}
        <div className="flex w-full md:flex-1 md:max-w-md flex-col items-center md:items-start gap-12 text-center md:text-left">
          <div className="space-y-10">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#f5f6f7]/70">
              Have a project in mind?
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center border border-[#f5f6f7] px-7 py-3 text-sm font-medium uppercase tracking-[0.22em] lg:hover:bg-[#f5f6f7] lg:hover:text-[#121212]"
              >
                Let&apos;s talk
              </Link>
            </h2>
          </div>

          {/* Mobile: simple stacked address below the map */}
          <div className="mt-2 w-full text-center text-sm leading-relaxed md:hidden">
            <p className="font-semibold tracking-[0.18em] uppercase text-[#f5f6f7]/80">Warehouse</p>
            <p>71G Montgomerie Road</p>
            <p>Māngere, Auckland 2022</p>
            <p>New Zealand</p>
          </div>

          {/* Footer links (privacy + social) */}
          <nav aria-label="Footer" className="mt-6 text-sm opacity-85 w-full">
            <div className="flex flex-col items-center md:items-start gap-3">
              <Link href="/privacy" className="underline underline-offset-4 lg:hover:opacity-80">
                Privacy Policy
              </Link>
              <div className="flex gap-4">
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
          </nav>
        </div>
      </div>
    </footer>
  );
}
