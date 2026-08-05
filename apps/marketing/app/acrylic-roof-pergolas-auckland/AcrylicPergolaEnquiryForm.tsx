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
import type { SimpleCoverHandoff } from '@/lib/simpleCoverHandoff';
import type { EnquiryBriefField } from '@/components/seo-landing/types';
import SimpleCoverEnquirySummary from './SimpleCoverEnquirySummary';

type AcrylicPergolaEnquiryFormProps = {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  submitLabel?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  successHeading?: string;
  successMessage?: string;
  briefFields?: readonly EnquiryBriefField[];
  directContact?: {
    intro: string;
    phoneLabel: string;
    phoneHref: `tel:${string}`;
    emailLabel: string;
    emailHref: `mailto:${string}`;
  };
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
  variant?: 'default' | 'simple-cover';
  simpleCoverEstimate?: SimpleCoverHandoff | null;
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

function trackLeadSubmitted(
  context: EnquiryContext,
  eventId: string,
  landingPage: string,
  trackingConsent: {
    analytics: boolean;
    marketing: boolean;
    hasTrackingDecision: boolean;
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
    if (!trackingConsent.hasTrackingDecision) return;
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

function EnquiryMessageField({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <div className="acrylic-form__field acrylic-form__field--wide">
      <label htmlFor="acrylic-enquiry-message">
        {label} <span>Optional</span>
      </label>
      <textarea
        id="acrylic-enquiry-message"
        name="message"
        rows={5}
        placeholder={placeholder}
      />
    </div>
  );
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
  eyebrow = 'Start here',
  heading = 'Project brief',
  intro = 'Share the site, intended use and what you know so far.',
  submitLabel = 'Send project brief',
  messageLabel = 'Project brief',
  messagePlaceholder = 'How will you use the space? What should the pergola improve?',
  successHeading = 'Project brief sent.',
  successMessage = 'We’ll review it and contact you about the next step.',
  briefFields = [],
  directContact,
  initialEnquiryType,
  sourceContext = {},
  roofPreference = acrylicRoofPreference,
  variant = 'default',
  simpleCoverEstimate = null,
}: AcrylicPergolaEnquiryFormProps = {}) {
  const isSimpleCover = variant === 'simple-cover';
  const {
    consent,
    hasTrackingDecision,
    trackingBasis,
    trackingRegionPolicy,
  } = useConsent();
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [enquiryType, setEnquiryType] = useState<EnquiryAudience | null>(
    isSimpleCover ? 'residential' : initialEnquiryType ?? sourceContext.enquiryType ?? null,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<EnquiryFormFieldErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const attachmentErrorRef = useRef<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusErrorSummaryRef = useRef(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsEnhanced(true);
  }, []);

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
  const contextProperties = getEnquiryContextProperties(currentEnquiryContext);
  const contextDisplay = getEnquiryContextDisplay(currentEnquiryContext);

  const clearFieldError = (field: EnquiryFormField) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (submitState === 'error') setSubmitState('idle');
  };

  const handleFiles = (incoming: File[]) => {
    const nextFiles = [...files, ...incoming];
    const fileError = validateEnquiryAttachments(nextFiles);
    if (fileError) {
      attachmentErrorRef.current = fileError;
      setErrors((current) => ({ ...current, files: fileError }));
      return;
    }
    attachmentErrorRef.current = null;
    setFiles(nextFiles);
    clearFieldError('files');
  };

  const removeFile = (index: number) => {
    attachmentErrorRef.current = null;
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    clearFieldError('files');
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submittingRef.current || submitState === 'success') return;

    const form = event.currentTarget;
    const nextErrors = validateEnquiryForm(new FormData(form), files);
    if (attachmentErrorRef.current) {
      nextErrors.files = attachmentErrorRef.current;
    }
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as EnquiryFormField | undefined;
    if (firstError) {
      shouldFocusErrorSummaryRef.current = true;
      return;
    }

    const formData = new FormData(form);
    submittingRef.current = true;
    setSubmitError(null);
    setSubmitState('sending');

    try {
      const submissionId = submissionIdRef.current ?? createEnquirySubmissionId();
      submissionIdRef.current = submissionId;
      const attachments = await uploadEnquiryAttachments(files, submissionId);
      const selectedPriorities = formData.getAll('priorities').map(String);
      const selectedAccessories = formData.getAll('accessories').map(String);
      const selectedRoofPreference = isSimpleCover
        ? 'Pitched acrylic'
        : String(formData.get('roofPreference') ?? '');
      const selectedRoofOption = roofPreference.options.find((option) => option.value === selectedRoofPreference);
      const attribution = getBrowserMarketingAttribution({
        consent,
        trackingBasis,
        trackingRegionPolicy,
      });
      const addOns = {
        blinds: selectedAccessories.includes('Outdoor blinds'),
        lighting: selectedAccessories.includes('Lighting'),
        heating: selectedAccessories.includes('Heaters'),
        slats: selectedAccessories.includes('Slat screens'),
        acrylicInfillPanels: selectedAccessories.includes('Acrylic infill panels'),
        other: selectedAccessories.includes('Other'),
      };
      const roofMaterials = isSimpleCover
        ? ['acrylic']
        : selectedRoofOption ? [...selectedRoofOption.roofMaterials] : [];

      const preferredStyle = isSimpleCover ? 'pitched' : String(formData.get('style') ?? '');
      const pageSpecificDetails = Object.fromEntries(briefFields.map((field) => [field.name, String(formData.get(field.name) ?? '').trim() || null]));
      const simpleCoverInput = simpleCoverEstimate?.input ?? null;
      const hasPricedSimpleCoverReference = simpleCoverEstimate?.status === 'priced'
        && Boolean(simpleCoverEstimate.calculationRef);
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
            widthM: simpleCoverInput && !hasPricedSimpleCoverReference
              ? simpleCoverInput.widthMm / 1_000
              : isSimpleCover ? null : String(formData.get('widthM') ?? '').trim() || null,
            depthM: simpleCoverInput && !hasPricedSimpleCoverReference
              ? simpleCoverInput.projectionMm / 1_000
              : isSimpleCover ? null : String(formData.get('depthM') ?? '').trim() || null,
            heightM: isSimpleCover ? null : String(formData.get('heightM') ?? '').trim() || null,
          },
          style: preferredStyle === 'unsure' ? '' : preferredStyle,
          roofMaterials,
          addOns,
          calculationRef: hasPricedSimpleCoverReference
            ? simpleCoverEstimate.calculationRef
            : null,
          simpleCoverStatus: isSimpleCover
            ? simpleCoverEstimate?.status ?? 'unconfigured'
            : null,
          files: attachments.files,
          projectDetails: {
            [roofPreference.detailKey]: selectedRoofPreference || null,
            attachment: String(formData.get('attachment') ?? '') || null,
            priorities: selectedPriorities,
            accessories: selectedAccessories,
            consentStatus: String(formData.get('consentStatus') ?? '').trim() || null,
            timeframe: String(formData.get('timeframe') ?? '').trim() || null,
            ...(isSimpleCover ? {
              simpleCover: simpleCoverInput ? {
                status: simpleCoverEstimate?.status ?? 'unconfigured',
                calculationAttached: simpleCoverEstimate?.status === 'priced',
                ...(!hasPricedSimpleCoverReference ? {
                  deckLevel: simpleCoverInput.level,
                  connection: simpleCoverInput.connection,
                } : {}),
              } : null,
            } : {}),
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
      if (!response.ok || !responsePayload?.ok) {
        throw new Error(
          'Please try again or contact us directly.',
        );
      }

      submissionIdRef.current = null;
      setSubmitState('success');
      trackLeadSubmitted(currentEnquiryContext, submissionId, window.location.pathname, {
        analytics: consent.analytics,
        marketing: consent.marketing,
        hasTrackingDecision,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : 'Please try again or contact us directly.',
      );
      setSubmitState('error');
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <form
      className={`acrylic-form${isSimpleCover ? ' acrylic-form--simple-cover' : ''}`}
      method="post"
      action="/api/enquiry/fallback"
      noValidate={isEnhanced}
      onSubmit={handleSubmit}
      aria-labelledby="estimate-form-title"
    >
      <input
        type="hidden"
        name="page"
        value={sourceContext.sourcePath ?? '/contact'}
        readOnly
      />
      <input type="hidden" name="source" value="website" readOnly />
      {isSimpleCover ? <input type="hidden" name="enquiryType" value="residential" readOnly /> : null}
      <input
        type="hidden"
        name="enquiryContext"
        value={JSON.stringify(contextProperties)}
        readOnly
      />
      <div className="acrylic-form__intro">
        <Eyebrow className="acrylic-eyebrow">{eyebrow}</Eyebrow>
        <Heading id="estimate-form-title">{heading}</Heading>
        <p>{intro}</p>
        {directContact ? (
          <div className="acrylic-form__direct-contact">
            <span>{directContact.intro}</span>
            <a href={directContact.phoneHref}>{directContact.phoneLabel}</a>
            <a href={directContact.emailHref}>{directContact.emailLabel}</a>
          </div>
        ) : null}
        <p className="acrylic-form__required-note">{ENQUIRY_FORM_REQUIRED_NOTE}</p>
        {contextDisplay.isVisible ? (
          <div className="acrylic-form__context" aria-label="Enquiry context">
            <strong>{contextDisplay.heading}</strong>
            {contextDisplay.audience ? <span>{contextDisplay.audience}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="acrylic-form__fields">
        {isSimpleCover ? <SimpleCoverEnquirySummary estimate={simpleCoverEstimate} /> : null}
        <EnquiryErrorSummary className="acrylic-form__error-summary" id="acrylic-enquiry-error-summary" items={errorSummaryItems} ref={errorSummaryRef} />

        {!isSimpleCover ? <div className="acrylic-form__field">
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
        </div> : null}

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-suburb">
            Project suburb <span>Optional</span>
          </label>
          <input id="acrylic-enquiry-suburb" name="suburb" autoComplete="address-level2" />
        </div>

        {!isSimpleCover ? (
          <EnquiryMessageField label={messageLabel} placeholder={messagePlaceholder} />
        ) : null}

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
            pattern="(?=(?:\D*\d){7,15}\D*$)\+?(?:\d|\s|\(|\)|\.|-)+"
            title="Enter a phone number with 7 to 15 digits."
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
            Email <span>Required</span>
          </label>
          <input
            id="acrylic-enquiry-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
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

        {isSimpleCover ? (
          <EnquiryMessageField label={messageLabel} placeholder={messagePlaceholder} />
        ) : null}

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
            disabled={!isEnhanced}
            aria-describedby={`acrylic-enquiry-files-help${errors.files ? ` ${fieldErrorId('files')}` : ''}`}
            aria-invalid={Boolean(errors.files)}
            onChange={(event) => {
              handleFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
          <p className="acrylic-form__help" hidden={isEnhanced}>
            File upload needs JavaScript. You can email files to{' '}
            <a href="mailto:info@sanctuarypergolas.co.nz">
              info@sanctuarypergolas.co.nz
            </a>
            .
          </p>
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

        <details className="acrylic-form__optional acrylic-form__field--wide">
          <summary>{isSimpleCover ? 'Add optional preferences' : 'Add optional project details'}</summary>
          <div className="acrylic-form__optional-fields">
        {!isSimpleCover ? <fieldset className="acrylic-form__fieldset acrylic-form__field--wide">
          <legend>
            Dimensions <span>Optional</span>
          </legend>
          <div className="acrylic-form__dimensions">
            <label>
              Width
              <input name="widthM" inputMode="decimal" placeholder="Unknown" />
              <small>metres</small>
            </label>
            <label>
              Depth
              <input name="depthM" inputMode="decimal" placeholder="Unknown" />
              <small>metres</small>
            </label>
            <label>
              Height
              <input name="heightM" inputMode="decimal" placeholder="Unknown" />
              <small>metres</small>
            </label>
          </div>
        </fieldset> : null}

        {!isSimpleCover ? briefFields.map((field) => (
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
        )) : null}

        {!isSimpleCover ? <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-style">
            Pergola form <span>Optional</span>
          </label>
          <select id="acrylic-enquiry-style" name="style" defaultValue="">
            <option value="">Choose if known</option>
            {pergolaForms.map(([value, label]) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div> : null}

        {!isSimpleCover ? <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-attachment">
            Attachment <span>Optional</span>
          </label>
          <select id="acrylic-enquiry-attachment" name="attachment" defaultValue="">
            <option value="">Choose if known</option>
            <option value="attached">Attached</option>
            <option value="freestanding">Freestanding</option>
            <option value="unsure">Unsure</option>
          </select>
        </div> : null}

        {!isSimpleCover ? <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-roof">
            Roof <span>Optional</span>
          </label>
          <select id="acrylic-enquiry-roof" name="roofPreference" defaultValue="">
            <option value="">Choose if known</option>
            {roofPreference.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div> : null}

        <fieldset className="acrylic-form__fieldset">
          <legend>
            Priorities <span>Optional</span>
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
            Other options <span>Optional</span>
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

        {!isSimpleCover ? <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-consent">
            Plans or consent <span>Optional</span>
          </label>
          <input id="acrylic-enquiry-consent" name="consentStatus" placeholder="For example: early ideas or plans available" />
        </div> : null}

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-timeframe">
            Timeframe <span>Optional</span>
          </label>
          <input id="acrylic-enquiry-timeframe" name="timeframe" placeholder="Leave blank if unsure" />
        </div>

          </div>
        </details>

        <div className="acrylic-form__honeypot" aria-hidden="true" inert>
          <label htmlFor="acrylic-enquiry-website">Website</label>
          <input id="acrylic-enquiry-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      <div className="acrylic-form__submit">
        <p>
          We use your details and files to assess and respond. They are not published. See our <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <button type="submit" disabled={submitState === 'sending' || submitState === 'success'}>
          {submitState === 'sending' ? 'Sending brief' : submitState === 'success' ? 'Project brief sent' : submitLabel}
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
            <h3>{successHeading}</h3>
            <p>{successMessage}</p>
          </div>
        ) : null}
        {submitState === 'error' ? (
          <div className="acrylic-form__status-message acrylic-form__status-message--error" role="alert">
            <h3>Your enquiry was not sent.</h3>
            <p>{submitError}</p>
            <p>Your details are still here. Please try again.</p>
          </div>
        ) : null}
      </div>
    </form>
  );
}
