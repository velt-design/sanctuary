'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eyebrow, Heading } from '@/components/marketing-foundation';
import { getBrowserMarketingAttribution } from '@/lib/attribution';
import {
  ENQUIRY_ATTACHMENT_LIMITS,
  uploadEnquiryAttachments,
  validateEnquiryAttachments,
} from '@/lib/enquiryAttachments';

type RequiredField = 'enquiryType' | 'name' | 'phone' | 'email' | 'suburb' | 'message';
type FieldErrors = Partial<Record<RequiredField | 'files', string>>;
type AcrylicPergolaEnquiryFormProps = {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  submitLabel?: string;
  roofPreference?: {
    label: string;
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
  label: 'Preferred acrylic option',
  detailKey: 'acrylicOption' as const,
  options: [
    { label: 'Clear', value: 'Clear', roofMaterials: ['acrylic'] },
    { label: 'Light grey', value: 'Light grey', roofMaterials: ['acrylic'] },
    { label: 'Dark grey', value: 'Dark grey', roofMaterials: ['acrylic'] },
    { label: 'Opal', value: 'Opal', roofMaterials: ['acrylic'] },
    { label: 'Combination roof', value: 'Combination roof', roofMaterials: ['acrylic', 'timber'] },
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

function trackLeadSubmitted(enquiryType: string, eventId: string, landingPage: string): void {
  type TrackingWindow = typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  const trackingWindow = window as TrackingWindow;
  const eventData = {
    event_category: 'contact',
    event_label: enquiryType,
    enquiry_type: enquiryType,
    landing_page: landingPage,
  };

  try {
    trackingWindow.gtag?.('event', 'contact_success', eventData);
    trackingWindow.fbq?.('track', 'Lead', eventData, { eventID: eventId });
    trackingWindow.dataLayer = trackingWindow.dataLayer || [];
    trackingWindow.dataLayer.push({ event: 'lead_submitted', ...eventData, lead_event_id: eventId });
  } catch {
    // Analytics must never prevent a completed enquiry.
  }
}

function fieldErrorId(field: keyof FieldErrors): string {
  return `acrylic-enquiry-${field}-error`;
}

export default function AcrylicPergolaEnquiryForm({
  eyebrow = 'Tell us about the site',
  heading = 'Request an initial estimate',
  intro = 'Share your suburb, approximate dimensions and a few photos of the area. Tell us what matters most, whether that is preserving daylight, adding rain cover, reducing glare or creating a more sheltered outdoor room.',
  submitLabel = 'Request my initial estimate',
  roofPreference = acrylicRoofPreference,
}: AcrylicPergolaEnquiryFormProps = {}) {
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const clearFieldError = (field: keyof FieldErrors) => {
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

  const validate = (form: HTMLFormElement): FieldErrors => {
    const formData = new FormData(form);
    const nextErrors: FieldErrors = {};
    const requiredFields: Array<[RequiredField, string]> = [
      ['enquiryType', 'Choose an enquiry type.'],
      ['name', 'Enter your name.'],
      ['phone', 'Enter your phone number.'],
      ['email', 'Enter your email address.'],
      ['suburb', 'Enter the project suburb.'],
      ['message', 'Add a brief project description.'],
    ];

    for (const [field, message] of requiredFields) {
      if (!String(formData.get(field) ?? '').trim()) nextErrors[field] = message;
    }

    const email = String(formData.get('email') ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    const fileError = validateEnquiryAttachments(files);
    if (fileError) nextErrors.files = fileError;
    return nextErrors;
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submitState === 'sending') return;

    const form = event.currentTarget;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as keyof FieldErrors | undefined;
    if (firstError) {
      const target = form.elements.namedItem(firstError);
      if (target instanceof HTMLElement) target.focus();
      return;
    }

    const formData = new FormData(form);
    setSubmitState('sending');

    try {
      const attachments = await uploadEnquiryAttachments(files);
      const selectedPriorities = formData.getAll('priorities').map(String);
      const selectedAccessories = formData.getAll('accessories').map(String);
      const selectedRoofPreference = String(formData.get('roofPreference') ?? '');
      const selectedRoofOption = roofPreference.options.find((option) => option.value === selectedRoofPreference);
      const enquiryType = String(formData.get('enquiryType') ?? '');
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
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiryType,
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
          files: attachments,
          projectDetails: {
            [roofPreference.detailKey]: selectedRoofPreference || null,
            attachment: String(formData.get('attachment') ?? '') || null,
            priorities: selectedPriorities,
            accessories: selectedAccessories,
            consentStatus: String(formData.get('consentStatus') ?? '').trim() || null,
            timeframe: String(formData.get('timeframe') ?? '').trim() || null,
          },
          utm: attribution.utm,
          attribution,
          page: window.location.pathname,
          source: 'website',
          honeypot: String(formData.get('website') ?? ''),
        }),
      });

      const responsePayload = await response.json().catch(() => null);
      if (!response.ok || !responsePayload?.ok) throw new Error('SUBMIT_FAILED');

      setSubmitState('success');
      trackLeadSubmitted(enquiryType, makeEventId(), window.location.pathname);
    } catch {
      setSubmitState('error');
    }
  };

  return (
    <form className="acrylic-form" noValidate onSubmit={handleSubmit} aria-labelledby="estimate-form-title">
      <div className="acrylic-form__intro">
        <Eyebrow className="acrylic-eyebrow">{eyebrow}</Eyebrow>
        <Heading id="estimate-form-title">{heading}</Heading>
        <p>{intro}</p>
        <p className="acrylic-form__required-note">Fields marked required are needed before the enquiry can be assessed.</p>
      </div>

      <div className="acrylic-form__fields">
        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-type">Enquiry type <span aria-hidden="true">*</span></label>
          <select id="acrylic-enquiry-type" name="enquiryType" defaultValue="" required aria-invalid={Boolean(errors.enquiryType)} aria-describedby={errors.enquiryType ? fieldErrorId('enquiryType') : undefined} onChange={() => clearFieldError('enquiryType')}>
            <option value="" disabled>Choose an enquiry type</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="professional">Architect, designer or builder</option>
          </select>
          {errors.enquiryType ? <p className="acrylic-form__error" id={fieldErrorId('enquiryType')}>{errors.enquiryType}</p> : null}
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-name">Name <span aria-hidden="true">*</span></label>
          <input id="acrylic-enquiry-name" name="name" autoComplete="name" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? fieldErrorId('name') : undefined} onChange={() => clearFieldError('name')} />
          {errors.name ? <p className="acrylic-form__error" id={fieldErrorId('name')}>{errors.name}</p> : null}
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-phone">Phone <span aria-hidden="true">*</span></label>
          <input id="acrylic-enquiry-phone" name="phone" type="tel" autoComplete="tel" required aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? fieldErrorId('phone') : undefined} onChange={() => clearFieldError('phone')} />
          {errors.phone ? <p className="acrylic-form__error" id={fieldErrorId('phone')}>{errors.phone}</p> : null}
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-email">Email <span aria-hidden="true">*</span></label>
          <input id="acrylic-enquiry-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? fieldErrorId('email') : undefined} onChange={() => clearFieldError('email')} />
          {errors.email ? <p className="acrylic-form__error" id={fieldErrorId('email')}>{errors.email}</p> : null}
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-suburb">Project suburb <span aria-hidden="true">*</span></label>
          <input id="acrylic-enquiry-suburb" name="suburb" autoComplete="address-level2" required aria-invalid={Boolean(errors.suburb)} aria-describedby={errors.suburb ? fieldErrorId('suburb') : undefined} onChange={() => clearFieldError('suburb')} />
          {errors.suburb ? <p className="acrylic-form__error" id={fieldErrorId('suburb')}>{errors.suburb}</p> : null}
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-message">Brief project description <span aria-hidden="true">*</span></label>
          <textarea id="acrylic-enquiry-message" name="message" rows={5} required placeholder="Tell us how you use the space, which rooms sit beside it and what you would like the roof to improve." aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? fieldErrorId('message') : undefined} onChange={() => clearFieldError('message')} />
          {errors.message ? <p className="acrylic-form__error" id={fieldErrorId('message')}>{errors.message}</p> : null}
        </div>

        <fieldset className="acrylic-form__fieldset acrylic-form__field--wide">
          <legend>Approximate dimensions <span>Optional</span></legend>
          <div className="acrylic-form__dimensions">
            <label>Width in metres<input name="widthM" inputMode="decimal" placeholder="Unknown" /></label>
            <label>Projection or depth<input name="depthM" inputMode="decimal" placeholder="Unknown" /></label>
            <label>Height in metres<input name="heightM" inputMode="decimal" placeholder="Unknown" /></label>
          </div>
        </fieldset>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-style">Preferred pergola form <span>Optional</span></label>
          <select id="acrylic-enquiry-style" name="style" defaultValue="">
            <option value="">Choose if known</option>
            {pergolaForms.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-attachment">Attached, freestanding or unsure <span>Optional</span></label>
          <select id="acrylic-enquiry-attachment" name="attachment" defaultValue="">
            <option value="">Choose if known</option>
            <option value="attached">Attached</option>
            <option value="freestanding">Freestanding</option>
            <option value="unsure">Unsure</option>
          </select>
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-roof">{roofPreference.label} <span>Optional</span></label>
          <select id="acrylic-enquiry-roof" name="roofPreference" defaultValue="">
            <option value="">Choose if known</option>
            {roofPreference.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <fieldset className="acrylic-form__fieldset">
          <legend>Main priorities <span>Optional</span></legend>
          <div className="acrylic-form__checks">
            {priorities.map((priority) => <label key={priority}><input type="checkbox" name="priorities" value={priority} /><span>{priority}</span></label>)}
          </div>
        </fieldset>

        <fieldset className="acrylic-form__fieldset">
          <legend>Desired accessories <span>Optional</span></legend>
          <div className="acrylic-form__checks">
            {accessories.map((accessory) => <label key={accessory}><input type="checkbox" name="accessories" value={accessory} /><span>{accessory}</span></label>)}
          </div>
        </fieldset>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-consent">Current plans or consent status <span>Optional</span></label>
          <input id="acrylic-enquiry-consent" name="consentStatus" placeholder="For example: early ideas or plans available" />
        </div>

        <div className="acrylic-form__field">
          <label htmlFor="acrylic-enquiry-timeframe">Intended project timeframe <span>Optional</span></label>
          <input id="acrylic-enquiry-timeframe" name="timeframe" placeholder="Leave blank if unsure" />
        </div>

        <div className="acrylic-form__field acrylic-form__field--wide">
          <label htmlFor="acrylic-enquiry-files">Photos, plans or sketches <span>Optional</span></label>
          <p className="acrylic-form__help" id="acrylic-enquiry-files-help">
            Add photos of the proposed area from inside and outside. You can also add plans, sketches or renovation drawings.
            Up to {ENQUIRY_ATTACHMENT_LIMITS.maxFiles} files and 20 MB in total.
          </p>
          <input id="acrylic-enquiry-files" name="files" type="file" multiple aria-describedby={`acrylic-enquiry-files-help${errors.files ? ` ${fieldErrorId('files')}` : ''}`} aria-invalid={Boolean(errors.files)} onChange={(event) => { handleFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
          {files.length ? (
            <ul className="acrylic-form__file-list" aria-label="Selected files">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}-${index}`}>
                  <span>{file.name} <small>{Math.ceil(file.size / 1024)} KB</small></span>
                  <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>Remove</button>
                </li>
              ))}
            </ul>
          ) : null}
          {errors.files ? <p className="acrylic-form__error" id={fieldErrorId('files')}>{errors.files}</p> : null}
        </div>

        <div className="acrylic-form__honeypot" aria-hidden="true">
          <label htmlFor="acrylic-enquiry-website">Website</label>
          <input id="acrylic-enquiry-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      <div className="acrylic-form__submit">
        <p>
          We use your details and uploads to assess and respond to your enquiry. They will not be published. See our{' '}
          <Link href="/privacy">Privacy Policy</Link> for more information.
        </p>
        <button type="submit" disabled={submitState === 'sending'}>
          {submitState === 'sending' ? 'Sending project details...' : submitLabel}
        </button>
      </div>

      <div className="acrylic-form__status" aria-live="polite" aria-atomic="true">
        {submitState === 'success' ? (
          <div className="acrylic-form__status-message acrylic-form__status-message--success">
            <h3>Thanks, we have received your project details.</h3>
            <p>The Sanctuary team will review the information and contact you about the next step. If more detail is needed before an initial estimate can be prepared, we will let you know what to provide.</p>
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
