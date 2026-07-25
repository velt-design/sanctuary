'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Eyebrow, Heading } from '@/components/marketing-foundation';
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
  validateEnquiryForm,
  type EnquiryFormField,
  type EnquiryFormFieldErrors,
} from '@/lib/enquiryFormContract';
import { getEnquiryAnalyticsProperties, getEnquiryContextProperties, type EnquiryAudience, type EnquiryContext } from '@/lib/enquiryContext';
import type { EnquiryBriefField } from '@/components/seo-landing/types';

type AcrylicPergolaEnquiryFormProps = {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  submitLabel?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  briefFields?: readonly EnquiryBriefField[];
  initialEnquiryType?: EnquiryAudience;
  sourceContext?: EnquiryContext;
  roofPreference?: {
    detailKey: 'acrylicOption' | 'roofPreference';
    options: ReadonlyArray<{
      label: string;
      value: string;
      roofMaterials: ReadonlyArray<string>;
    }>;
  };
};

const pergolaForms = [
  ['pitched', 'Mono-pitched'],
  ['gable', 'Gable'],
  ['hip', 'Hip roof'],
  ['box_perimeter', 'Box perimeter'],
  ['unsure', 'Unsure'],
] as const;

const acrylicRoofPreference = {
  detailKey: 'acrylicOption' as const,
  options: [
    { label: 'Clear', value: 'Clear', roofMaterials: ['acrylic'] },
    { label: 'Light grey', value: 'Light grey', roofMaterials: ['acrylic'] },
    { label: 'Dark grey', value: 'Dark grey', roofMaterials: ['acrylic'] },
    { label: 'Opal', value: 'Opal', roofMaterials: ['acrylic'] },
    {
      label: 'Combination roof',
      value: 'Combination roof',
      roofMaterials: ['acrylic', 'timber'],
    },
    { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ],
} satisfies NonNullable<AcrylicPergolaEnquiryFormProps['roofPreference']>;
const priorities = [
  'Retain daylight',
  'Rain protection',
  'Reduce glare',
  'Add shade',
  'Preserve sky views',
  'Wind protection',
  'Privacy',
  'Architectural integration',
];
const accessories = ['Outdoor blinds', 'Lighting', 'Heaters', 'Slat screens', 'Acrylic infill panels', 'Other'];

function makeEventId(): string {
  try {
    if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
  } catch {}
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function trackLeadSubmitted(
  context: EnquiryContext,
  eventId: string,
  landingPage: string,
  trackingConsent: {
    analytics: boolean;
    marketing: boolean;
    hasStoredChoice: boolean;
  },
): void {
  type TrackingWindow = typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  const trackingWindow = window as TrackingWindow;
  const contextProperties = getEnquiryContextProperties(context);
  const eventData = getEnquiryAnalyticsProperties(context, {
    event_category: 'contact',
    event_label: contextProperties.enquiry_type ?? 'unknown',
    landing_page: landingPage,
  });

  try {
    if (!trackingConsent.hasStoredChoice) return;
    if (trackingConsent.analytics) {
      trackingWindow.gtag?.('event', 'contact_success', eventData);
    }
    if (trackingConsent.marketing) {
      trackingWindow.fbq?.('track', 'Lead', eventData, { eventID: eventId });
    }
    if (trackingConsent.analytics || trackingConsent.marketing) {
      trackingWindow.dataLayer = trackingWindow.dataLayer || [];
      trackingWindow.dataLayer.push({
        event: 'lead_submitted',
        ...eventData,
        lead_event_id: eventId,
      });
    }
  } catch {
    // Analytics must never prevent a completed enquiry.
  }
}

function fieldErrorId(field: EnquiryFormField): string {
  return `acrylic-enquiry-${field}-error`;
}

const fieldTargets: Record<EnquiryFormField, string> = {
  enquiryType: 'acrylic-enquiry-type',
  name: 'acrylic-enquiry-name',
  phone: 'acrylic-enquiry-phone',
  email: 'acrylic-enquiry-email',
  suburb: 'acrylic-enquiry-suburb',
  message: 'acrylic-enquiry-message',
  files: 'acrylic-enquiry-files',
};

const fieldOrder: readonly EnquiryFormField[] = ENQUIRY_FORM_FIELD_ORDER;

export default function AcrylicPergolaEnquiryForm({
  eyebrow = 'Tell us about the site',
  heading = 'Request an initial estimate',
  intro = 'Share your suburb, approximate dimensions and a few photos of the area. Tell us what matters most, whether that is preserving daylight, adding rain cover, reducing glare or creating a more sheltered outdoor room.',
  submitLabel = 'Request my initial estimate',
  messageLabel = 'Brief project description',
  messagePlaceholder = 'Tell us how you use the space, which rooms sit beside it and what you would like the roof to improve.',
  briefFields = [],
  initialEnquiryType,
  sourceContext = {},
  roofPreference = acrylicRoofPreference,
}: AcrylicPergolaEnquiryFormProps = {}) {
  const { consent, hasStoredChoice } = useConsent();
  const [enquiryType, setEnquiryType] = useState<EnquiryAudience | null>(initialEnquiryType ?? sourceContext.enquiryType ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<EnquiryFormFieldErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const submissionIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusErrorSummaryRef = useRef(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldFocusErrorSummaryRef.current && Object.values(errors).some(Boolean)) {
      shouldFocusErrorSummaryRef.current = false;
      errorSummaryRef.current?.focus();
    }
  }, [errors]);

  useEffect(() => {
    if (submitState === 'success' || submitState === 'error') {
      resultRef.current?.focus();
    }
  }, [submitState]);

  const errorSummaryItems = fieldOrder.flatMap((field) => {
    const message = errors[field];
    return message ? [{ field, message, targetId: fieldTargets[field] }] : [];
  });

  const currentEnquiryContext: EnquiryContext = {
    ...sourceContext,
    ...(enquiryType ? { enquiryType } : {}),
  };
  const contextDisplay = getEnquiryContextDisplay(currentEnquiryContext);

  const clearFieldError = (field: EnquiryFormField) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (submitState === 'error') setSubmitState('idle');
  };

  const handleFiles = (incoming: File[]) => {
    const nextFiles = [...files, ...incoming];
    const fileError = validateEnquiryAttachments(nextFiles);
    if (fileError) {
      setErrors((current) => ({ ...current, files: fileError }));
      return;
    }
    setFiles(nextFiles);
    clearFieldError('files');
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    clearFieldError('files');
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submittingRef.current || submitState === 'success') return;

    const form = event.currentTarget;
    const nextErrors = validateEnquiryForm(new FormData(form), files);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as EnquiryFormField | undefined;
    if (firstError) {
      shouldFocusErrorSummaryRef.current = true;
      return;
    }

    const formData = new FormData(form);
    submittingRef.current = true;
    setSubmitState('sending');

    try {
      const submissionId = submissionIdRef.current ?? createEnquirySubmissionId();
      submissionIdRef.current = submissionId;
      const attachments = await uploadEnquiryAttachments(files, submissionId);
      const selectedPriorities = formData.getAll('priorities').map(String);
      const selectedAccessories = formData.getAll('accessories').map(String);
      const selectedRoofPreference = String(formData.get('roofPreference') ?? '');
      const selectedRoofOption = roofPreference.options.find((option) => option.value === selectedRoofPreference);
      const contextProperties = getEnquiryContextProperties(currentEnquiryContext);
      const attribution = getBrowserMarketingAttribution();
      const addOns = {
        blinds: selectedAccessories.includes('Outdoor blinds'),
        lighting: selectedAccessories.includes('Lighting'),
        heating: selectedAccessories.includes('Heaters'),
        slats: selectedAccessories.includes('Slat screens'),
        acrylicInfillPanels: selectedAccessories.includes('Acrylic infill panels'),
        other: selectedAccessories.includes('Other'),
      };
      const roofMaterials = selectedRoofOption ? [...selectedRoofOption.roofMaterials] : [];

      const preferredStyle = String(formData.get('style') ?? '');
      const pageSpecificDetails = Object.fromEntries(briefFields.map((field) => [field.name, String(formData.get(field.name) ?? '').trim() || null]));
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          uploadSessionToken: attachments.uploadSessionToken,
          enquiryType: enquiryType ?? '',
          name: String(formData.get('name') ?? '').trim(),
          phone: String(formData.get('phone') ?? '').trim(),
          email: String(formData.get('email') ?? '').trim(),
          suburb: String(formData.get('suburb') ?? '').trim(),
          message: String(formData.get('message') ?? '').trim(),
          dimensions: {
            widthM: String(formData.get('widthM') ?? '').trim() || null,
            depthM: String(formData.get('depthM') ?? '').trim() || null,
            heightM: String(formData.get('heightM') ?? '').trim() || null,
          },
          style: preferredStyle === 'unsure' ? '' : preferredStyle,
          roofMaterials,
          addOns,
          files: attachments.files,
          projectDetails: {
            [roofPreference.detailKey]: selectedRoofPreference || null,
            attachment: String(formData.get('attachment') ?? '') || null,
            priorities: selectedPriorities,
            accessories: selectedAccessories,
            consentStatus: String(formData.get('consentStatus') ?? '').trim() || null,
            timeframe: String(formData.get('timeframe') ?? '').trim() || null,
            ...pageSpecificDetails,
          },
          utm: attribution.utm,
          attribution,
          enquiryContext: contextProperties,
          page: window.location.pathname,
          source: 'website',
          honeypot: String(formData.get('website') ?? ''),
        }),
      });

      const responsePayload = await response.json().catch(() => null);
      if (!response.ok || !responsePayload?.ok) throw new Error('SUBMIT_FAILED');

      submissionIdRef.current = null;
      setSubmitState('success');
      trackLeadSubmitted(currentEnquiryContext, makeEventId(), window.location.pathname, {
        analytics: consent.analytics,
        marketing: consent.marketing,
        hasStoredChoice,
      });
    } catch {
      setSubmitState('error');
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <form className="acrylic-form" noValidate onSubmit={handleSubmit} aria-labelledby="estimate-form-title">
      <div className="acrylic-form__intro">
        <Eyebrow className="acrylic-eyebrow">{eyebrow}</Eyebrow>
        <Heading id="estimate-form-title">{heading}</Heading>
        <p>{intro}</p>
        <p className="acrylic-form__required-note">{ENQUIRY_FORM_REQUIRED_NOTE}</p>
        {contextDisplay.isVisible ? (
          <div className="acrylic-form__context" aria-label="Enquiry context">
            <strong>{contextDisplay.heading}</strong>
            <span>{contextDisplay.audience}</span>
          </div>
        ) : null}
      </div>

      <div className="acrylic-form__fields">
        <EnquiryErrorSummary className="acrylic-form__error-summary" id="acrylic-enquiry-error-summary" items={errorSummaryItems} ref={errorSummaryRef} />

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-type">
            Project type <span>Required</span>
          </label>
          <select
            id="acrylic-enquiry-type"
            name="enquiryType"
            value={enquiryType ?? ''}
            required
            aria-invalid={Boolean(errors.enquiryType)}
            aria-describedby={errors.enquiryType ? fieldErrorId('enquiryType') : undefined}
            onChange={(event) => {
              setEnquiryType(event.currentTarget.value as EnquiryAudience);
              clearFieldError('enquiryType');
            }}
          >
            <option value="" disabled>
              Choose a project type
            </option>
            {ENQUIRY_AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.enquiryType ? (
            <p className="acrylic-form__error" id={fieldErrorId('enquiryType')}>
              {errors.enquiryType}
            </p>
          ) : null}
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-suburb">
            Project suburb <span>Optional</span>
          </label>
          <input id="acrylic-enquiry-suburb" name="suburb" autoComplete="address-level2" />
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-message">
            Project brief <span>Optional</span>
          </label>
          <p className="acrylic-form__help" id="acrylic-enquiry-message-help">
            {messageLabel}
          </p>
          <textarea id="acrylic-enquiry-message" name="message" rows={5} placeholder={messagePlaceholder} aria-describedby="acrylic-enquiry-message-help" />
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-name">
            Name <span>Required</span>
          </label>
          <input
            id="acrylic-enquiry-name"
            name="name"
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? fieldErrorId('name') : undefined}
            onChange={() => clearFieldError('name')}
          />
          {errors.name ? (
            <p className="acrylic-form__error" id={fieldErrorId('name')}>
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-phone">
            Phone <span>Required</span>
          </label>
          <input
            id="acrylic-enquiry-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? fieldErrorId('phone') : undefined}
            onChange={() => clearFieldError('phone')}
          />
          {errors.phone ? (
            <p className="acrylic-form__error" id={fieldErrorId('phone')}>
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-email">
            Email <span>Optional</span>
          </label>
          <input
            id="acrylic-enquiry-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? fieldErrorId('email') : undefined}
            onChange={() => clearFieldError('email')}
          />
          {errors.email ? (
            <p className="acrylic-form__error" id={fieldErrorId('email')}>
              {errors.email}
            </p>
          ) : null}
        </div>

        <fieldset className="acrylic-form__fieldset acrylic-form__field--wide">
          <legend>
            Approximate dimensions <span>Optional</span>
          </legend>
          <div className="acrylic-form__dimensions">
            <label>
              Width
              <input name="widthM" inputMode="decimal" placeholder="Unknown" />
              <small>metres</small>
            </label>
            <label>
              Projection or depth
              <input name="depthM" inputMode="decimal" placeholder="Unknown" />
              <small>metres</small>
            </label>
            <label>
              Approximate height
              <input name="heightM" inputMode="decimal" placeholder="Unknown" />
              <small>metres</small>
            </label>
          </div>
        </fieldset>

        {briefFields.map((field) => (
          <div className={`acrylic-form__field${field.wide ? ' acrylic-form__field--wide' : ''}`} key={field.name}>
            <label htmlFor={`acrylic-enquiry-${field.name}`}>
              {field.label} <span>Optional</span>
            </label>
            {field.type === 'textarea' ? (
              <textarea id={`acrylic-enquiry-${field.name}`} name={field.name} rows={4} placeholder={field.placeholder} />
            ) : field.type === 'select' ? (
              <select id={`acrylic-enquiry-${field.name}`} name={field.name} defaultValue="">
                <option value="">Choose if known</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input id={`acrylic-enquiry-${field.name}`} name={field.name} placeholder={field.placeholder} />
            )}
          </div>
        ))}

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-style">
            Preferred pergola form <span>Optional</span>
          </label>
          <select id="acrylic-enquiry-style" name="style" defaultValue="">
            <option value="">Choose if known</option>
            {pergolaForms.map(([value, label]) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-attachment">
            Attached, freestanding or unsure <span>Optional</span>
          </label>
          <select id="acrylic-enquiry-attachment" name="attachment" defaultValue="">
            <option value="">Choose if known</option>
            <option value="attached">Attached</option>
            <option value="freestanding">Freestanding</option>
            <option value="unsure">Unsure</option>
          </select>
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-roof">
            Roof approach <span>Optional</span>
          </label>
          <select id="acrylic-enquiry-roof" name="roofPreference" defaultValue="">
            <option value="">Choose if known</option>
            {roofPreference.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="acrylic-form__fieldset">
          <legend>
            Main priorities <span>Optional</span>
          </legend>
          <div className="acrylic-form__checks">
            {priorities.map((priority) => (
              <label key={priority}>
                <input type="checkbox" name="priorities" value={priority} />
                <span>{priority}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="acrylic-form__fieldset">
          <legend>
            Desired accessories <span>Optional</span>
          </legend>
          <div className="acrylic-form__checks">
            {accessories.map((accessory) => (
              <label key={accessory}>
                <input type="checkbox" name="accessories" value={accessory} />
                <span>{accessory}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-consent">
            Current plans or consent status <span>Optional</span>
          </label>
          <input id="acrylic-enquiry-consent" name="consentStatus" placeholder="For example: early ideas or plans available" />
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-timeframe">
            Intended project timeframe <span>Optional</span>
          </label>
          <input id="acrylic-enquiry-timeframe" name="timeframe" placeholder="Leave blank if unsure" />
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-files">
            Photos, plans or sketches <span>Optional</span>
          </label>
          <p className="acrylic-form__help" id="acrylic-enquiry-files-help">
            {ENQUIRY_ATTACHMENT_HELP_TEXT}
          </p>
          <input
            id="acrylic-enquiry-files"
            name="files"
            type="file"
            accept={ENQUIRY_ATTACHMENT_ACCEPT}
            multiple
            aria-describedby={`acrylic-enquiry-files-help${errors.files ? ` ${fieldErrorId('files')}` : ''}`}
            aria-invalid={Boolean(errors.files)}
            onChange={(event) => {
              handleFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
          {files.length ? (
            <ul className="acrylic-form__file-list" aria-label="Selected files">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}-${index}`}>
                  <span>
                    {file.name} <small>{Math.ceil(file.size / 1024)} KB</small>
                  </span>
                  <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {errors.files ? (
            <p className="acrylic-form__error" id={fieldErrorId('files')}>
              {errors.files}
            </p>
          ) : null}
        </div>

        <div className="acrylic-form__honeypot" aria-hidden="true" inert>
          <label htmlFor="acrylic-enquiry-website">Website</label>
          <input id="acrylic-enquiry-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      <div className="acrylic-form__submit">
        <p>
          We use your details and uploads to assess and respond to your enquiry. They will not be published. See our <Link href="/privacy">Privacy Policy</Link>{' '}
          for more information.
        </p>
        <button type="submit" disabled={submitState === 'sending' || submitState === 'success'}>
          {submitState === 'sending' ? 'Sending project details...' : submitState === 'success' ? 'Project details sent' : submitLabel}
        </button>
      </div>

      <div
        className="acrylic-form__status"
        aria-live="polite"
        aria-atomic="true"
        ref={resultRef}
        tabIndex={submitState === 'success' || submitState === 'error' ? -1 : undefined}
      >
        {submitState === 'success' ? (
          <div className="acrylic-form__status-message acrylic-form__status-message--success" role="status">
            <h3>Thanks, we have received your project details.</h3>
            <p>
              We received your {enquiryType} enquiry
              {contextDisplay.itemDescription ? ` about ${contextDisplay.itemDescription}` : ''}. Your entered details remain above while the Sanctuary team
              reviews the information and next step.
            </p>
          </div>
        ) : null}
        {submitState === 'error' ? (
          <div className="acrylic-form__status-message acrylic-form__status-message--error" role="alert">
            <h3>We could not send your enquiry.</h3>
            <p>Your entered details remain on the page. Please try again, call Sanctuary or email the project information directly.</p>
          </div>
        ) : null}
      </div>
    </form>
  );
}
