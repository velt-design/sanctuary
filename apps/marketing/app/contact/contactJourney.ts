import type { EnquiryAudience, EnquiryContext } from '@/lib/enquiryContext';

export type ContactPathway = 'simple' | 'custom' | 'commercial-professional';

export const CONTACT_PATHWAY_OPTIONS: ReadonlyArray<{
  value: ContactPathway;
  eyebrow: string;
  label: string;
  description: string;
}> = [
  {
    value: 'simple',
    eyebrow: 'Price first',
    label: 'Simple cover',
    description: 'Configure a straightforward acrylic cover and see a live installed estimate.',
  },
  {
    value: 'custom',
    eyebrow: 'Start a brief',
    label: 'Custom design',
    description: 'For tailored forms, outdoor rooms or a site that needs a more considered response.',
  },
  {
    value: 'commercial-professional',
    eyebrow: 'Project team',
    label: 'Commercial / Professional',
    description: 'For organisations, venues, architects, designers and builders.',
  },
];

const simpleSourcePaths = new Set([
  '/simple-pergolas-auckland',
  '/simple-cover-calculator',
]);

export function getInitialContactPathway(
  initialEnquiryType: EnquiryAudience | null,
  context: EnquiryContext,
): ContactPathway | null {
  if (context.projectDirection === 'cover' || (context.sourcePath && simpleSourcePaths.has(context.sourcePath))) {
    return 'simple';
  }
  if (context.projectDirection === 'bespoke' || context.projectDirection === 'outdoor-room') {
    return 'custom';
  }
  if (
    context.projectDirection === 'commercial-professional'
    || initialEnquiryType === 'commercial'
    || initialEnquiryType === 'professional'
  ) {
    return 'commercial-professional';
  }
  return null;
}

export function getInitialBusinessAudience(
  initialEnquiryType: EnquiryAudience | null,
  context: EnquiryContext,
): Exclude<EnquiryAudience, 'residential'> | null {
  if (initialEnquiryType === 'commercial' || initialEnquiryType === 'professional') {
    return initialEnquiryType;
  }
  if (context.projectProfessionalPath === 'venue') return 'commercial';
  if (
    context.projectProfessionalPath === 'builder-contractor'
    || context.projectProfessionalPath === 'architects-designers'
  ) {
    return 'professional';
  }
  return null;
}

export function getContactEnquiryAudience(
  pathway: ContactPathway | null,
  businessAudience: Exclude<EnquiryAudience, 'residential'> | null,
): EnquiryAudience | null {
  if (pathway === 'simple' || pathway === 'custom') return 'residential';
  if (pathway === 'commercial-professional') return businessAudience;
  return null;
}
