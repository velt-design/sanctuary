import { ENQUIRY_FORM_REQUIRED_NOTE } from '@/lib/enquiryFormContract';

export default function ContactFormIntro({ configured, hasSourceContext, contextDisplay }: {
  configured: boolean; hasSourceContext: boolean;
  contextDisplay: { isVisible: boolean; heading: string; audience?: string | null };
}) {
  if (configured) return <header className="contact-form__intro">
    <h2 id="contact-form-title">Tell us about your space.</h2>
    <p className="contact-form__required-note">Your design is included. Required fields are marked.</p>
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
