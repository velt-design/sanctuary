import Link from 'next/link';
import { buildEnquiryHref } from '@/lib/enquiryContext';

const homeProcessEnquiryHref = buildEnquiryHref({
  enquiryType: 'residential',
  sourcePath: '/',
  sourceComponent: 'final_cta',
});

export function HomeProcessCtaBar() {
  return (
    <Link
      href={homeProcessEnquiryHref}
      className="process-cta-bar"
      aria-label="Get an estimate"
    >
      <div className="container process-cta-bar__inner">
        Get an estimate
      </div>
    </Link>
  );
}
