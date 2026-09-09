import { ENQUIRY_FORM_REQUIRED_NOTE } from '@/lib/enquiryFormContract';

export default function ContactFormIntro({ configured, hasSourceContext, contextDisplay }: {
  configured: boolean; hasSourceContext: boolean;
  contextDisplay: { isVisible: boolean; heading: string; audience?: string | null };
}) {
  return <header className="contact-form__intro">
    <p className="contact-eyebrow">{configured ? 'Your project details' : 'Start here'}</p>
    <h2 id="contact-form-title">{configured ? 'Tell us about your space.' : 'Choose the right starting point.'}</h2>
    <p>{configured ? 'Your design is included. Add your site and contact details.' : 'We’ll ask only for the details that fit your project.'}</p>
    <p className="contact-form__required-note">{ENQUIRY_FORM_REQUIRED_NOTE}</p>
    {hasSourceContext && contextDisplay.isVisible ? (
      <div className="contact-form__context" aria-label="Enquiry context">
        <strong>{contextDisplay.heading}</strong>
        {contextDisplay.audience ? <span>{contextDisplay.audience}</span> : null}
      </div>
    ) : null}
  </header>;
}
