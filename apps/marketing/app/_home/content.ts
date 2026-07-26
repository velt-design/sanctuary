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
    title: 'For Auckland homes',
    copy:
      'Begin with the home, outdoor area and intended use. Complex sites and integrated details stay within the same residential design process.',
    href: '/pergolas-auckland',
    action: 'Plan a home pergola',
    enquiryType: 'residential',
    event: 'design_conversation_capability_open',
  },
  {
    title: 'Commercial projects',
    copy:
      'Plan hospitality, accommodation, workplace and selected commercial structures around operations, access and delivery.',
    href: '/commercial-pergolas-auckland#project-details',
    action: 'Review commercial capability',
    enquiryType: 'commercial',
    event: 'design_conversation_capability_open',
  },
  {
    title: 'Professional collaboration',
    copy:
      'Architects, designers and builders can share drawings, concepts, tender information and defined project responsibilities.',
    href: '/architects-designers-builders',
    action: 'Work with Sanctuary',
    enquiryType: 'professional',
    event: 'design_conversation_capability_open',
  },
] as const;

export const processSteps = [
  {
    title: 'Share a useful brief',
    copy:
      'Send the suburb, project photos, approximate dimensions and intended use. Sanctuary reviews the information and identifies a useful next step.',
  },
  {
    title: 'Develop and confirm the design',
    copy:
      'The site, exposure, connections and access inform the form, materials, inclusions, price and current programme confirmed in writing.',
  },
  {
    title: 'Build, install and hand over',
    copy:
      'The pergola is prepared and installed by the Sanctuary team, then handed over with applicable care, warranty and support information.',
  },
] as const;
