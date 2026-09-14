import { ENQUIRY_FORM_REQUIRED_NOTE } from '@/lib/enquiryFormContract';

export default function ContactFormIntro({ configured, bespoke, business = false, hasSourceContext, contextDisplay }: {
  configured: boolean; bespoke: boolean; business?: boolean; hasSourceContext: boolean;
  contextDisplay: { isVisible: boolean; heading: string; audience?: string | null };
}) {
  if (configured) return <header className="contact-form__intro">
    <h2 id="contact-form-title">Tell us about your space.</h2>
    <p className="contact-form__required-note">Your design is included. Required fields are marked.</p>
    <p>{business
      ? 'Tell us about the project and your role. We’ll review your design and brief, then usually respond within the working day to discuss the next step.'
      : bespoke
      ? 'Tell us how your space or design needs to differ. We’ll review your brief and usually respond within the working day to discuss the next step.'
      : 'Request a free site measure and evaluation in Auckland. Outside Auckland, we’ll confirm availability and any travel cost before arranging a visit.'}</p>
  </header>;
  return <header className="contact-form__intro">
    <p className="contact-eyebrow">Start here</p>
    <h2 id="contact-form-title">Choose the right starting point.</h2>
    <p>We’ll ask only for the details that fit your project.</p>
    <p className="contact-form__required-note">{ENQUIRY_FORM_REQUIRED_NOTE}</p>
    {hasSourceContext && contextDisplay.isVisible ? (
      <div className="contact-form__context" aria-label="Enquiry context">
        <strong>{contextDisplay.heading}</strong>
        {contextDisplay.audience ? <span>{contextDisplay.audience}</span> : null}
      </div>
    ) : null}
  </header>;
}
