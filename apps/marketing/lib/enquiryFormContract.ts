import { ENQUIRY_ATTACHMENT_LIMITS, validateEnquiryAttachments } from './enquiryAttachments';
import {
  isPlausibleEnquiryPhone,
  isValidEnquiryEmail,
} from './enquiryContactValidation';
import type { EnquiryAudience, EnquiryContext } from './enquiryContext';
import {
  commercialProfessionalPathLabels,
  projectDirectionLabels,
  projectPriorityLabels,
} from './projectFinderContract';

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
    description: 'A home, deck or renovation.',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'A business or shared site.',
  },
  {
    value: 'professional',
    label: 'Architect, designer or builder',
    description: 'A client project.',
  },
];

export const ENQUIRY_FORM_FIELD_ORDER: readonly EnquiryFormField[] = ['enquiryType', 'suburb', 'message', 'name', 'phone', 'email', 'files'];

export const ENQUIRY_FORM_REQUIRED_NOTE = 'Required fields are marked.';

export const ENQUIRY_ATTACHMENT_HELP_TEXT =
  `Up to ${ENQUIRY_ATTACHMENT_LIMITS.maxFiles} PDF, JPG, JPEG, PNG or WebP files, 20 MB total.`;

export function validateEnquiryForm(formData: FormData, files: File[]): EnquiryFormFieldErrors {
  const errors: EnquiryFormFieldErrors = {};
  const enquiryType = String(formData.get('enquiryType') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (!enquiryType) errors.enquiryType = 'Choose a project type.';
  if (!name) errors.name = 'Enter your name.';
  if (!phone) errors.phone = 'Enter your phone number.';
  else if (!isPlausibleEnquiryPhone(phone)) errors.phone = 'Enter a valid phone number.';
  if (!email) errors.email = 'Enter your email address.';
  else if (!isValidEnquiryEmail(email)) errors.email = 'Enter a valid email address.';

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
  const audienceLabel = getEnquiryAudienceLabel(context.enquiryType);
  const isItemContext = Boolean(itemLabel);
  const directionLabel = context.projectDirection
    ? projectDirectionLabels[context.projectDirection]
    : null;
  const professionalPathLabel = context.projectProfessionalPath
    ? commercialProfessionalPathLabels[context.projectProfessionalPath]
    : null;
  const priorityLabel = context.projectPriorities?.length
    ? `Priorities: ${context.projectPriorities
      .map((priority) => projectPriorityLabels[priority])
      .join(', ')}`
    : null;
  const finderDetailLabel = [
    isItemContext || professionalPathLabel ? directionLabel : null,
    professionalPathLabel,
    priorityLabel,
    audienceLabel ? `${audienceLabel} enquiry` : null,
  ].filter(Boolean).join(' · ');

  return {
    isVisible: Boolean(
      isItemContext || directionLabel || professionalPathLabel || audienceLabel,
    ),
    heading: itemLabel
      ?? (professionalPathLabel || directionLabel
        ? `Starting brief: ${professionalPathLabel ?? directionLabel}`
        : audienceLabel
          ? `${audienceLabel} project`
          : ''),
    audience: directionLabel
      ? finderDetailLabel
      : isItemContext
        ? (audienceLabel ? `${audienceLabel} enquiry` : 'Choose a project type')
        : '',
  };
}
