// components/SiteFooter.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ReviewBadge from '@/components/reviews/ReviewBadge';
import {
  buildEnquiryHref,
  getCanonicalMarketingPathname,
  getEnquiryRouteContext,
} from '@/lib/enquiryContext';
import styles from './SiteFooter.module.css';

type SiteFooterProps = {
  reviewRating: number;
  reviewCount: number;
};

export default function SiteFooter({ reviewRating, reviewCount }: SiteFooterProps) {
  const pathname = getCanonicalMarketingPathname(usePathname());
  const enquiryHref = buildEnquiryHref({
    ...getEnquiryRouteContext(pathname),
    sourcePath: pathname,
    sourceComponent: 'footer',
  });

  return (
    <footer className="relative bg-[#121212] text-[#f5f6f7]">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 sm:px-8 md:grid-cols-2 md:gap-10 md:px-12 md:py-16 lg:grid-cols-[1.15fr_0.85fr_0.9fr]">
        <section aria-labelledby="footer-contact-heading" className="grid content-start gap-3 md:gap-5">
          <h2 id="footer-contact-heading" className="max-w-lg text-3xl font-semibold tracking-[0.08em] uppercase sm:text-4xl">
            Tell us about your project.
          </h2>
          <Link
            href={enquiryHref}
            className={`inline-flex min-h-11 w-fit items-center justify-center border border-[#f5f6f7] px-6 py-3 text-sm font-medium tracking-[0.16em] uppercase ${styles.primaryAction}`}
          >
            Start your project
          </Link>
          <div className="grid gap-1 text-sm">
            <a
              href="tel:+64228545633"
              className={`inline-flex min-h-11 w-fit items-center underline underline-offset-4 ${styles.quietLink}`}
            >
              022 854 5633
            </a>
            <a
              href="mailto:info@sanctuarypergolas.co.nz"
              className={`inline-flex min-h-11 w-fit items-center break-all underline underline-offset-4 ${styles.quietLink}`}
            >
              info@sanctuarypergolas.co.nz
            </a>
          </div>
        </section>

        <section className="grid content-start gap-2 md:gap-4">
          <nav aria-label="Footer navigation" className="grid text-sm font-medium uppercase tracking-[0.12em]">
            <Link href="/commercial-pergolas-auckland" className={`inline-flex min-h-11 items-center border-b border-white/15 ${styles.navigationLink}`}>
              Commercial
            </Link>
            <Link href="/architects-designers-builders" className={`inline-flex min-h-11 items-center border-b border-white/15 ${styles.navigationLink}`}>
              Architects, designers &amp; builders
            </Link>
            <Link href="/pergola-guides" className={`inline-flex min-h-11 items-center border-b border-white/15 ${styles.navigationLink}`}>
              Pergola Guides
            </Link>
          </nav>
          <ReviewBadge
            className={`min-h-11 ${styles.reviewAction}`}
            rating={reviewRating}
            count={reviewCount}
            variant="onDark"
          />
        </section>

        <section aria-labelledby="footer-details-heading" className="grid content-start gap-3 text-sm leading-relaxed md:gap-5">
          <div>
            <h2 id="footer-details-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f5f6f7]/65">
              Auckland base
            </h2>
            <p>71G Montgomerie Road</p>
            <p>Mangere, Auckland 2022</p>
            <p>New Zealand</p>
            <p className="mt-3 max-w-xs text-[#f5f6f7]/75">
              Our staffed base of operations. Please contact us before visiting.
            </p>
            <p className="mt-2 max-w-xs text-[#f5f6f7]/75">
              Selected projects up to about a three-hour drive from Auckland,
              depending on project fit.
            </p>
          </div>
          <nav aria-label="Footer legal and social links" className="flex flex-wrap gap-x-5 text-xs uppercase tracking-[0.12em]">
            <Link href="/privacy" className={`inline-flex min-h-11 items-center underline underline-offset-4 ${styles.quietLink}`}>
              Privacy
            </Link>
            <a
              href="https://www.instagram.com/sanctuarypergolas/"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex min-h-11 items-center underline underline-offset-4 ${styles.quietLink}`}
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/SanctuaryPergolas"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex min-h-11 items-center underline underline-offset-4 ${styles.quietLink}`}
            >
              Facebook
            </a>
          </nav>
        </section>
      </div>
    </footer>
  );
}
