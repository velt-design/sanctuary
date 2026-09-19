import type { EnquiryAudience, EnquiryContext } from '@/lib/enquiryContext';

export type ContactPathway = 'simple' | 'configured' | 'help' | 'custom' | 'commercial-professional';

export const CONTACT_PATHWAY_OPTIONS: ReadonlyArray<{
  value: ContactPathway;
  eyebrow: string;
  label: string;
  description: string;
}> = [
  {
    value: 'simple',
    eyebrow: 'Explore your options',
    label: 'Design your pergola',
    description: 'Choose your size, roof and extras. See an installed estimate where pricing is available.',
  },
  {
    value: 'help',
    eyebrow: 'Talk it through',
    label: 'Help me choose',
    description: 'Tell us about your space. You do not need a design or dimensions to start.',
  },
  {
    value: 'custom',
    eyebrow: 'Start a brief',
    label: 'Bespoke design',
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
  intent?: 'help' | 'bespoke',
): ContactPathway | null {
  if (
    context.projectDirection === 'commercial-professional'
    || initialEnquiryType === 'commercial'
    || initialEnquiryType === 'professional'
  ) {
    return 'commercial-professional';
  }
  if (intent === 'help') return 'help';
  if (intent === 'bespoke') return 'custom';
  if (context.projectDirection === 'bespoke' || context.projectDirection === 'outdoor-room') {
    return 'custom';
  }
  if (context.projectDirection === 'cover' || (context.sourcePath && simpleSourcePaths.has(context.sourcePath))) {
    return 'simple';
  }
  if (context.sourceProject || context.sourceProduct) return 'help';
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
  if (pathway === 'simple' || pathway === 'configured' || pathway === 'help' || pathway === 'custom') return 'residential';
  if (pathway === 'commercial-professional') return businessAudience;
  return null;
}

/** Attaching a design must not turn a business discussion into a residential measure. */
export function resolveContactPathway(selected: ContactPathway | null, hasDesign: boolean): ContactPathway | null {
  if (!hasDesign || selected === 'custom' || selected === 'commercial-professional') return selected;
  return 'configured';
}
