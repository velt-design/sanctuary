import type { Metadata } from 'next';
import Link from 'next/link';
import '../contact.css';

export const metadata: Metadata = {
  title: 'Enquiry received',
  description: 'Confirmation that Sanctuary Pergolas received your project enquiry.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EnquiryThanksPage() {
  return (
    <main className="contact-page contact-confirmation" data-contact-page>
      <section aria-labelledby="enquiry-thanks-title">
        <p className="contact-eyebrow">Sent</p>
        <h1 id="enquiry-thanks-title">Project brief received.</h1>
        <p>
          Thank you. We will review the details and contact you about the next
          step.
        </p>
        <div className="contact-confirmation__actions">
          <Link className="contact-action contact-action--primary" href="/projects">
            View projects
          </Link>
          <Link className="contact-action contact-action--text" href="/">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
