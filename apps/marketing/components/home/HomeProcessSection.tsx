import Link from 'next/link';

export function HomeProcessCtaBar() {
  return (
    <Link
      href="/contact?enquiry=residential#contact-form"
      className="process-cta-bar"
      aria-label="Get an estimate"
    >
      <div className="container process-cta-bar__inner">
        Get an estimate
      </div>
    </Link>
  );
}
