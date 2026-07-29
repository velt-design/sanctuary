import type { EnquiryAudience } from '@/lib/enquiryContext';

export const homepageTitle =
  'Architectural Pergola Design & Build | Sanctuary Pergolas';

export const homepageDescription =
  'Sanctuary designs, builds and installs bespoke fixed-roof architectural pergolas for Auckland homes and selected commercial projects.';

type AudiencePathway = {
  title: string;
  copy: string;
  href: string;
  action: string;
  enquiryType: EnquiryAudience;
  event: 'design_conversation_capability_open';
};

export const audiencePathways: readonly AudiencePathway[] = [
  {
    title: 'Auckland homes',
    copy: 'Plan the roof, structure and details around the house and outdoor area.',
    href: '/pergolas-auckland',
    action: 'Explore home pergolas',
    enquiryType: 'residential',
    event: 'design_conversation_capability_open',
  },
  {
    title: 'Commercial projects',
    copy: 'Plan the structure around operations, access and delivery.',
    href: '/commercial-pergolas-auckland#project-details',
    action: 'Explore commercial work',
    enquiryType: 'commercial',
    event: 'design_conversation_capability_open',
  },
  {
    title: 'Professional collaboration',
    copy: 'Share drawings, tender information and project responsibilities.',
    href: '/architects-designers-builders',
    action: 'Explore collaboration',
    enquiryType: 'professional',
    event: 'design_conversation_capability_open',
  },
] as const;

export const processSteps = [
  {
    title: 'Share the brief',
    copy: 'Send the suburb, photos, rough dimensions and intended use.',
  },
  {
    title: 'Confirm the design',
    copy: 'We confirm the form, materials, scope, price and current programme.',
  },
  {
    title: 'Build and install',
    copy: 'We prepare, install and hand over the completed pergola.',
  },
] as const;
