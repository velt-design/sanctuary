import { ENQUIRY_ATTACHMENT_LIMITS, validateEnquiryAttachments } from './enquiryAttachments';
import type { EnquiryAudience, EnquiryContext } from './enquiryContext';

export type EnquiryFormField = 'enquiryType' | 'suburb' | 'message' | 'name' | 'phone' | 'email' | 'files';

export type EnquiryFormFieldErrors = Partial<Record<EnquiryFormField, string>>;

export const ENQUIRY_AUDIENCE_OPTIONS: ReadonlyArray<{
  value: EnquiryAudience;
  label: string;
  description: string;
}> = [
  {
    value: 'residential',
    label: 'Residential',
    description: 'A pergola for your home, deck or renovation.',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'A business, hospitality, property or multi-unit site.',
  },
  {
    value: 'professional',
    label: 'Architect, designer or builder',
    description: 'A project you are developing on behalf of a client.',
  },
];

export const ENQUIRY_FORM_FIELD_ORDER: readonly EnquiryFormField[] = ['enquiryType', 'suburb', 'message', 'name', 'phone', 'email', 'files'];

export const ENQUIRY_FORM_REQUIRED_NOTE = 'Fields marked Required are needed to send the enquiry.';

export const ENQUIRY_ATTACHMENT_HELP_TEXT =
  `PDF, JPG, JPEG, PNG or WebP. Add up to ${ENQUIRY_ATTACHMENT_LIMITS.maxFiles} files. ` + 'Each file can be up to 20 MB, with 20 MB total.';

export function validateEnquiryForm(formData: FormData, files: File[]): EnquiryFormFieldErrors {
  const errors: EnquiryFormFieldErrors = {};
  const enquiryType = String(formData.get('enquiryType') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (!enquiryType) errors.enquiryType = 'Choose a project type.';
  if (!name) errors.name = 'Enter your name.';
  if (!phone) errors.phone = 'Enter your phone number.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address or leave this field blank.';
  }

  const fileError = validateEnquiryAttachments(files);
  if (fileError) errors.files = fileError;
  return errors;
}

function getEnquiryAudienceLabel(audience: EnquiryAudience | null | undefined): string | null {
  if (!audience) return null;
  return {
    residential: 'Residential',
    commercial: 'Commercial',
    professional: 'Professional',
  }[audience];
}

function labelFromSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getEnquiryContextDisplay(
  context: EnquiryContext,
  labels: {
    sourceProjectLabel?: string;
    sourceProductLabel?: string;
  } = {},
) {
  const projectLabel = labels.sourceProjectLabel ?? labelFromSlug(context.sourceProject);
  const productLabel = labels.sourceProductLabel ?? labelFromSlug(context.sourceProduct);
  const itemLabel = projectLabel ? `Project: ${projectLabel}` : productLabel ? `Pergola option: ${productLabel}` : null;
  const itemDescription = projectLabel
    ? `${projectLabel.toLowerCase().startsWith('the ') ? '' : 'the '}${projectLabel} project`
    : productLabel
      ? `the ${productLabel} option`
      : null;
  const audienceLabel = getEnquiryAudienceLabel(context.enquiryType);

  return {
    isVisible: Boolean(context.enquiryType || context.sourcePath || context.sourceComponent || context.sourceProject || context.sourceProduct),
    heading: itemLabel ?? 'Your enquiry source is saved',
    audience: audienceLabel ? `${audienceLabel} enquiry` : 'Choose the project type that fits your enquiry',
    itemDescription,
  };
}
