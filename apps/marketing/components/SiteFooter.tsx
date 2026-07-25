// components/SiteFooter.tsx
'use client';

import Link from 'next/link';
import ReviewBadge from '@/components/reviews/ReviewBadge';

type SiteFooterProps = {
  reviewRating: number;
  reviewCount: number;
};

export default function SiteFooter({ reviewRating, reviewCount }: SiteFooterProps) {
  return (
    <footer className="relative bg-[#121212] text-[#f5f6f7]">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 sm:px-8 md:grid-cols-2 md:gap-10 md:px-12 md:py-16 lg:grid-cols-[1.15fr_0.85fr_0.9fr]">
        <section aria-labelledby="footer-contact-heading" className="grid content-start gap-3 md:gap-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#f5f6f7]/65">
            Have a project in mind?
          </p>
          <h2 id="footer-contact-heading" className="max-w-lg text-3xl font-semibold tracking-[0.08em] uppercase sm:text-4xl">
            Start with the site and intended use.
          </h2>
          <Link
            href="/contact"
            className="inline-flex min-h-11 w-fit items-center justify-center border border-[#f5f6f7] px-6 py-3 text-sm font-medium tracking-[0.16em] uppercase lg:hover:bg-[#f5f6f7] lg:hover:text-[#121212]"
          >
            Discuss your project
          </Link>
          <div className="grid gap-1 text-sm">
            <a
              href="tel:+64228545633"
              className="inline-flex min-h-11 w-fit items-center underline underline-offset-4 lg:hover:opacity-80"
            >
              022 854 5633
            </a>
            <a
              href="mailto:info@sanctuarypergolas.co.nz"
              className="inline-flex min-h-11 w-fit items-center break-all underline underline-offset-4 lg:hover:opacity-80"
            >
              info@sanctuarypergolas.co.nz
            </a>
          </div>
        </section>

        <section aria-labelledby="footer-pathways-heading" className="grid content-start gap-2 md:gap-4">
          <h2 id="footer-pathways-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f5f6f7]/65">
            Project pathways
          </h2>
          <nav aria-label="Footer navigation" className="grid text-sm font-medium uppercase tracking-[0.12em]">
            <Link href="/commercial-pergolas-auckland" className="inline-flex min-h-11 items-center border-b border-white/15 lg:hover:opacity-80">
              Commercial
            </Link>
            <Link href="/architects-designers-builders" className="inline-flex min-h-11 items-center border-b border-white/15 lg:hover:opacity-80">
              Architects, designers &amp; builders
            </Link>
            <Link href="/pergola-guides" className="inline-flex min-h-11 items-center border-b border-white/15 lg:hover:opacity-80">
              Pergola Guides
            </Link>
          </nav>
          <ReviewBadge
            className="min-h-11"
            rating={reviewRating}
            count={reviewCount}
            variant="onDark"
          />
        </section>

        <section aria-labelledby="footer-details-heading" className="grid content-start gap-3 text-sm leading-relaxed md:gap-5">
          <div>
            <h2 id="footer-details-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f5f6f7]/65">
              Auckland warehouse
            </h2>
            <p>71G Montgomerie Road</p>
            <p>Mangere, Auckland 2022</p>
            <p>New Zealand</p>
          </div>
          <nav aria-label="Footer legal and social links" className="flex flex-wrap gap-x-5 text-xs uppercase tracking-[0.12em]">
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4 lg:hover:opacity-80">
              Privacy
            </Link>
            <a
              href="https://www.instagram.com/sanctuarypergolas/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-4 lg:hover:opacity-80"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/SanctuaryPergolas"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-4 lg:hover:opacity-80"
            >
              Facebook
            </a>
          </nav>
        </section>
      </div>
    </footer>
  );
}
