'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent, type FormEventHandler } from 'react';
import { useConsent } from '@/components/ConsentProvider';
import EnquiryErrorSummary from '@/components/enquiry/EnquiryErrorSummary';
import { getBrowserMarketingAttribution } from '@/lib/attribution';
import { createEnquirySubmissionId, ENQUIRY_ATTACHMENT_ACCEPT, uploadEnquiryAttachments, validateEnquiryAttachments } from '@/lib/enquiryAttachments';
import {
  ENQUIRY_ATTACHMENT_HELP_TEXT,
  ENQUIRY_AUDIENCE_OPTIONS,
  ENQUIRY_FORM_FIELD_ORDER,
  ENQUIRY_FORM_REQUIRED_NOTE,
  getEnquiryContextDisplay,
} from '@/lib/enquiryFormContract';
import { getEnquiryAnalyticsProperties, getEnquiryContextProperties, type EnquiryAudience, type EnquiryContext } from '@/lib/enquiryContext';
import { validateContactForm, type ContactField, type ContactFieldErrors } from './contactFormModel';
import ContactTechnicalFields from './ContactTechnicalFields';

type ContactEnquiryFormProps = {
  initialEnquiryType: EnquiryAudience | null;
  initialContext: EnquiryContext;
  sourceProjectLabel?: string;
  sourceProductLabel?: string;
};

type SubmitState = 'idle' | 'sending' | 'success' | 'error';
type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown>>;
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

const contactFieldTargets: Record<ContactField, string> = {
  enquiryType: 'contact-enquiry-type-residential',
  suburb: 'contact-suburb',
  message: 'contact-message',
  name: 'contact-name',
  phone: 'contact-phone',
  email: 'contact-email',
  files: 'contact-files',
};

const contactFieldOrder: readonly ContactField[] = ENQUIRY_FORM_FIELD_ORDER;

function errorId(field: ContactField): string {
  return `contact-${field}-error`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContactEnquiryForm({
  initialEnquiryType,
  initialContext,
  sourceProjectLabel,
  sourceProductLabel,
}: ContactEnquiryFormProps) {
  const { consent, hasStoredChoice } = useConsent();
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [enquiryType, setEnquiryType] = useState<EnquiryAudience | null>(initialEnquiryType);
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const attachmentErrorRef = useRef<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusErrorSummaryRef = useRef(false);
  const successRef = useRef<HTMLElement | null>(null);
  const submitErrorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsEnhanced(true);
  }, []);

  useEffect(() => {
    if (submitState === 'success') successRef.current?.focus();
    if (submitState === 'error' && submitError) submitErrorRef.current?.focus();
  }, [submitError, submitState]);

  useEffect(() => {
    if (shouldFocusErrorSummaryRef.current && Object.values(fieldErrors).some(Boolean)) {
      shouldFocusErrorSummaryRef.current = false;
      errorSummaryRef.current?.focus();
    }
  }, [fieldErrors]);

  const currentContext: EnquiryContext = {
    ...initialContext,
    ...(enquiryType ? { enquiryType } : {}),
  };
  const contextProperties = getEnquiryContextProperties(currentContext);
  const contextDisplay = getEnquiryContextDisplay(currentContext, {
    sourceProjectLabel,
    sourceProductLabel,
  });
  const errorSummaryItems = contactFieldOrder.flatMap((field) => {
    const message = fieldErrors[field];
    return message ? [{ field, message, targetId: contactFieldTargets[field] }] : [];
  });

  const clearFieldError = (field: ContactField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const trackSubmitEvent = (
    phase: 'start' | 'success' | 'error',
    selectedRoofs: string[],
    selectedAddOns: string[],
    extra?: Record<string, unknown>,
    eventId?: string,
  ) => {
    const trackingWindow = window as TrackingWindow;
    const canonicalAudience = contextProperties.enquiry_type ?? 'unknown';
    const base = getEnquiryAnalyticsProperties(currentContext, {
      event_category: 'contact',
      event_label: canonicalAudience,
      roof_count: selectedRoofs.length,
      addons_count: selectedAddOns.length,
      ...extra,
    });

    try {
      if (hasStoredChoice && consent.analytics && typeof trackingWindow.gtag === 'function') {
        trackingWindow.gtag('event', `contact_${phase}`, base);
      }
      if (phase === 'success' && hasStoredChoice && consent.marketing && typeof trackingWindow.fbq === 'function') {
        trackingWindow.fbq('track', 'Lead', base, eventId ? { eventID: eventId } : undefined);
      }
      if (phase === 'success' && hasStoredChoice && (consent.analytics || consent.marketing)) {
        trackingWindow.dataLayer = trackingWindow.dataLayer || [];
        trackingWindow.dataLayer.push({
          event: 'lead_submitted',
          ...base,
          lead_event_id: eventId,
        });
      }
    } catch {
      // Optional analytics must never interrupt the enquiry.
    }
  };

  const handleEnquiryType = (type: EnquiryAudience) => {
    setEnquiryType(type);
    clearFieldError('enquiryType');
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!incoming.length) return;

    const nextFiles = [...files, ...incoming];
    const fileError = validateEnquiryAttachments(nextFiles);
    if (fileError) {
      attachmentErrorRef.current = fileError;
      setFieldErrors((current) => ({ ...current, files: fileError }));
      return;
    }

    attachmentErrorRef.current = null;
    setFiles(nextFiles);
    clearFieldError('files');
  };

  const removeFile = (index: number) => {
    attachmentErrorRef.current = null;
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    clearFieldError('files');
  };

  const handleFormInput: FormEventHandler<HTMLFormElement> = (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const field = target.name as ContactField;
      if (field in fieldErrors) clearFieldError(field);
    }
    if (submitState === 'error') {
      setSubmitState('idle');
      setSubmitError(null);
    }
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextErrors = validateContactForm(formData, files);
    if (attachmentErrorRef.current) {
      nextErrors.files = attachmentErrorRef.current;
    }
    setFieldErrors(nextErrors);

    const firstError = Object.keys(nextErrors)[0] as ContactField | undefined;
    if (firstError) {
      shouldFocusErrorSummaryRef.current = true;
      return;
    }

    const selectedRoofs = formData.getAll('roofMaterials').map(String);
    const selectedAddOns = formData.getAll('addOns').map(String);
    const submissionId = submissionIdRef.current ?? createEnquirySubmissionId();
    submissionIdRef.current = submissionId;
    submittingRef.current = true;
    setSubmitError(null);
    setSubmitState('sending');
    trackSubmitEvent('start', selectedRoofs, selectedAddOns);

    try {
      const attachmentUpload = await uploadEnquiryAttachments(files, submissionId);
      const attribution = getBrowserMarketingAttribution({ consent, hasStoredChoice });
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          uploadSessionToken: attachmentUpload.uploadSessionToken,
          enquiryType: enquiryType ?? '',
          name: String(formData.get('name') ?? '').trim(),
          email: String(formData.get('email') ?? '').trim(),
          phone: String(formData.get('phone') ?? '').trim(),
          suburb: String(formData.get('suburb') ?? '').trim(),
          message: String(formData.get('message') ?? '').trim(),
          dimensions: {
            widthM: String(formData.get('widthM') ?? '').trim() || null,
            depthM: String(formData.get('depthM') ?? '').trim() || null,
            heightM: String(formData.get('heightM') ?? '').trim() || null,
          },
          style: String(formData.get('style') ?? '').trim(),
          roofMaterials: selectedRoofs,
          addOns: {
            blinds: selectedAddOns.includes('blinds'),
            slats: selectedAddOns.includes('slats'),
            lighting: selectedAddOns.includes('lighting'),
            heating: selectedAddOns.includes('heating'),
          },
          company: enquiryType && enquiryType !== 'residential' ? String(formData.get('company') ?? '').trim() || null : null,
          files: attachmentUpload.files,
          utm: attribution.utm,
          attribution,
          enquiryContext: contextProperties,
          page: window.location.pathname,
          source: 'website',
          honeypot: String(formData.get('website') ?? ''),
        }),
      });
      const responsePayload = await response.json().catch(() => null);

      if (!response.ok || !responsePayload?.ok) {
        const message =
          typeof responsePayload?.error === 'string' && responsePayload.error.trim()
            ? responsePayload.error
            : 'We could not reach the enquiry service.';
        setSubmitError(message);
        setSubmitState('error');
        trackSubmitEvent('error', selectedRoofs, selectedAddOns, {
          status: response.status,
          error: message,
        });
        return;
      }

      submissionIdRef.current = null;
      setSubmitState('success');
      trackSubmitEvent('success', selectedRoofs, selectedAddOns, undefined, submissionId);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'We could not reach the enquiry service.';
      setSubmitError(message);
      setSubmitState('error');
      trackSubmitEvent('error', selectedRoofs, selectedAddOns, {
        error: 'network',
      });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <form
      className="contact-form"
      id="contact-form"
      method="post"
      action="/api/enquiry/fallback"
      noValidate={isEnhanced}
      onInput={handleFormInput}
      onSubmit={handleSubmit}
      aria-labelledby="contact-form-title"
    >
      <input type="hidden" name="page" value="/contact" readOnly />
      <input type="hidden" name="source" value="website" readOnly />
      <input
        type="hidden"
        name="enquiryContext"
        value={JSON.stringify(contextProperties)}
        readOnly
      />
      <header className="contact-form__intro">
        <p className="contact-eyebrow">Start here</p>
        <h2 id="contact-form-title">Project brief</h2>
        <p>Share the site, intended use and what you know so far.</p>
        <p className="contact-form__required-note">{ENQUIRY_FORM_REQUIRED_NOTE}</p>
        {contextDisplay.isVisible ? (
          <div className="contact-form__context" aria-label="Enquiry context">
            <strong>{contextDisplay.heading}</strong>
            {contextDisplay.audience ? <span>{contextDisplay.audience}</span> : null}
          </div>
        ) : null}
      </header>

      <EnquiryErrorSummary className="contact-form__error-summary" id="contact-error-summary" items={errorSummaryItems} ref={errorSummaryRef} />

      <fieldset className="contact-form__section contact-form__type" aria-describedby={fieldErrors.enquiryType ? errorId('enquiryType') : undefined}>
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
                checked={enquiryType === option.value}
                required
                aria-invalid={Boolean(fieldErrors.enquiryType)}
                onChange={() => handleEnquiryType(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
        {fieldErrors.enquiryType ? (
          <p className="contact-form__error" id={errorId('enquiryType')}>
            {fieldErrors.enquiryType}
          </p>
        ) : null}
      </fieldset>

      <section className="contact-form__section" aria-labelledby="contact-project-details-title">
        <div className="contact-form__section-heading">
          <span>02</span>
          <div>
            <h3 id="contact-project-details-title">Your project</h3>
          </div>
        </div>

        <div className="contact-form__grid">
          <div className="contact-form__field contact-form__field--wide">
            <label htmlFor="contact-suburb">
              Project suburb <span>Optional</span>
            </label>
            <input id="contact-suburb" name="suburb" autoComplete="address-level2" placeholder="For example, Warkworth" />
          </div>

          <div className="contact-form__field contact-form__field--wide">
            <label htmlFor="contact-message">
              Project brief <span>Optional</span>
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={6}
              placeholder="How will you use the space? What should the pergola improve?"
            />
          </div>

          <div className="contact-form__field contact-form__field--wide">
            <label htmlFor="contact-files">
              Photos, plans or sketches <span>Optional</span>
            </label>
            <p className="contact-form__help" id="contact-files-help">
              {ENQUIRY_ATTACHMENT_HELP_TEXT}
            </p>
            <input
              id="contact-files"
              name="files"
              type="file"
              accept={ENQUIRY_ATTACHMENT_ACCEPT}
              multiple
              disabled={!isEnhanced}
              aria-invalid={Boolean(fieldErrors.files)}
              aria-describedby={`contact-files-help${fieldErrors.files ? ` ${errorId('files')}` : ''}`}
              onChange={handleFiles}
            />
            <p className="contact-form__help" hidden={isEnhanced}>
              File upload needs JavaScript. You can email files to{' '}
              <a href="mailto:info@sanctuarypergolas.co.nz">
                info@sanctuarypergolas.co.nz
              </a>
              .
            </p>
            {files.length ? (
              <ul className="contact-form__files" aria-label="Selected files">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <span>
                      <strong>{file.name}</strong>
                      <small>{formatFileSize(file.size)}</small>
                    </span>
                    <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {fieldErrors.files ? (
              <p className="contact-form__error" id={errorId('files')}>
                {fieldErrors.files}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="contact-form__section" aria-labelledby="contact-details-title">
        <div className="contact-form__section-heading">
          <span>03</span>
          <div>
            <h3 id="contact-details-title">Your details</h3>
          </div>
        </div>

        <div className="contact-form__grid">
          {enquiryType && enquiryType !== 'residential' ? (
            <div className="contact-form__field contact-form__field--wide">
              <label htmlFor="contact-company">
                Company or practice <span>Optional</span>
              </label>
              <input id="contact-company" name="company" autoComplete="organization" />
            </div>
          ) : null}

          <div className="contact-form__field">
            <label htmlFor="contact-name">
              Name <span>Required</span>
            </label>
            <input
              id="contact-name"
              name="name"
              autoComplete="name"
              required
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? errorId('name') : undefined}
            />
            {fieldErrors.name ? (
              <p className="contact-form__error" id={errorId('name')}>
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="contact-form__field">
            <label htmlFor="contact-phone">
              Phone <span>Required</span>
            </label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              pattern="(?=(?:\D*\d){7,15}\D*$)\+?(?:\d|\s|\(|\)|\.|-)+"
              title="Enter a phone number with 7 to 15 digits."
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? errorId('phone') : undefined}
            />
            {fieldErrors.phone ? (
              <p className="contact-form__error" id={errorId('phone')}>
                {fieldErrors.phone}
              </p>
            ) : null}
          </div>

          <div className="contact-form__field contact-form__field--wide">
            <label htmlFor="contact-email">
              Email <span>Required</span>
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? errorId('email') : undefined}
            />
            {fieldErrors.email ? (
              <p className="contact-form__error" id={errorId('email')}>
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <details className="contact-form__section contact-form__optional">
        <summary>Add optional project details</summary>
        <div className="contact-form__grid">
          <ContactTechnicalFields />
        </div>
      </details>

      <div className="contact-form__honeypot" aria-hidden="true" inert>
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="contact-form__submit">
        <div>
          <p>
            We use your details and files to assess and respond. They are not published. See our{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
          <div className="contact-form__live" aria-live="polite" aria-atomic="true">
            {submitState === 'sending' ? 'Sending project brief.' : ''}
          </div>
        </div>
        <button className="contact-action contact-action--primary" type="submit" disabled={submitState === 'sending' || submitState === 'success'}>
          {submitState === 'sending' ? 'Sending brief' : submitState === 'success' ? 'Project brief sent' : 'Send project brief'}
        </button>
      </div>

      {submitState === 'error' && submitError ? (
        <div className="contact-form__submit-error" ref={submitErrorRef} role="alert" tabIndex={-1}>
          <h3>Your enquiry was not sent.</h3>
          <p>{submitError}</p>
          <p>Your details are still here. Please try again.</p>
        </div>
      ) : null}

      {submitState === 'success' ? (
        <section className="contact-success" ref={successRef} role="status" aria-live="polite" tabIndex={-1}>
          <p className="contact-eyebrow">Sent</p>
          <h2>Project brief sent.</h2>
          <p>We’ll review it and contact you about the next step.</p>
        </section>
      ) : null}
    </form>
  );
}
