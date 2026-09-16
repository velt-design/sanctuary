import { ENQUIRY_AUDIENCE_OPTIONS } from '@/lib/enquiryFormContract';
import type { EnquiryAudience } from '@/lib/enquiryContext';
import type { EnquiryContext } from '@/lib/enquiryContext';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import { CONTACT_PATHWAY_OPTIONS, type ContactPathway } from './contactJourney';

type ContactPathwaySelectorProps = {
  isEnhanced: boolean;
  pathway: ContactPathway | null;
  hasError: boolean;
  errorId: string;
  initialAudience: EnquiryAudience | null;
  sourceContext?: EnquiryContext;
  onChange: (pathway: ContactPathway) => void;
};

export default function ContactPathwaySelector({
  isEnhanced,
  pathway,
  hasError,
  errorId,
  initialAudience,
  sourceContext,
  onChange,
}: ContactPathwaySelectorProps) {
  return (
    <>
      <fieldset
        className="contact-form__section contact-form__type contact-form__pathways"
        aria-describedby={hasError ? errorId : undefined}
        hidden={!isEnhanced}
      >
        <legend>
          <span>01</span>
          Choose your pathway
          <small>Required</small>
        </legend>
        <div className="contact-form__type-options">
          {CONTACT_PATHWAY_OPTIONS.map((option) => option.value === 'simple' ? (
            <a key={option.value} id="contact-pathway-simple" className="contact-form__design-entry" href={buildConfiguratorEnquiryHref(sourceContext)}>
              <span aria-hidden="true">↗</span>
              <span><small className="contact-form__pathway-eyebrow">{option.eyebrow}</small><strong>{option.label}</strong><small>{option.description}</small></span>
            </a>
          ) : (
            <label key={option.value}>
              <input
                id={`contact-pathway-${option.value}`}
                type="radio"
                name="contactPathway"
                value={option.value}
                checked={pathway === option.value}
                required
                disabled={!isEnhanced}
                aria-invalid={hasError}
                onChange={() => onChange(option.value)}
              />
              <span>
                <small className="contact-form__pathway-eyebrow">{option.eyebrow}</small>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <noscript>
        <fieldset className="contact-form__section contact-form__type">
          <legend>
            <span>01</span>
            Project type
            <small>Required</small>
          </legend>
          <div className="contact-form__type-options">
            {ENQUIRY_AUDIENCE_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  id={`contact-enquiry-type-${option.value}`}
                  type="radio"
                  name="enquiryType"
                  value={option.value}
                  defaultChecked={option.value === initialAudience}
                  required
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </noscript>
    </>
  );
}
