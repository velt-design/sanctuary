import type { EnquiryAudience } from '@/lib/enquiryContext';
import {
  commercialProfessionalPathLabels,
  projectDirectionLabels,
  projectPriorityLabels,
  type CommercialProfessionalPath,
  type ProjectFinderHomeDirection,
  type ProjectPriority,
  type ResidentialProjectFinderHomeDirection,
} from '@/lib/projectFinderContract';

export type ProjectDirectionChoiceContent = {
  label: string;
  description: string;
};

export type ProjectResultContent = {
  responseHeading: string;
  responseExplanation: string;
  pathwayLabel: string;
  primaryDestination?: string;
  secondaryServiceLabel?: string;
  closeHeading: string;
  closeExplanation: string;
  evidenceReasonBySlug: Readonly<Record<string, string>>;
};

export type CommercialProfessionalPathContent =
  ProjectDirectionChoiceContent
  & ProjectResultContent
  & { enquiryType: EnquiryAudience };

export const projectDirectionContent: Record<
  ProjectFinderHomeDirection,
  ProjectDirectionChoiceContent
> = {
  cover: {
    label: projectDirectionLabels.cover,
    description:
      'A considered acrylic-roof cover for reliable shelter while preserving useful daylight.',
  },
  bespoke: {
    label: projectDirectionLabels.bespoke,
    description:
      'A more individual pergola or outdoor room shaped around the home, site and how the space will be used.',
  },
  'commercial-professional': {
    label: projectDirectionLabels['commercial-professional'],
    description:
      'For venues, builders, contractors, architects and designers who need a clear project pathway.',
  },
};

export const residentialProjectResultContent: Record<
  ResidentialProjectFinderHomeDirection,
  ProjectResultContent
> = {
  cover: {
    responseHeading: 'A simple acrylic pergola',
    responseExplanation:
      'Start with a simple, considered cover designed around shelter, daylight and a clean connection to the house.',
    pathwayLabel: 'Explore simple pergolas',
    closeHeading: 'Ready to discuss a simple cover?',
    closeExplanation:
      'Send the direction and priorities you selected so Sanctuary can review the site and shape a useful next step.',
    evidenceReasonBySlug: {
      'dairy-flat-estate':
        'An acrylic gable follows the house roofline while keeping daylight central to the brief.',
      'st-heliers-townhouse':
        'A compact opal-acrylic cover extends the home with a deliberate street-facing frame.',
    },
  },
  bespoke: {
    responseHeading: 'Custom pergola design',
    responseExplanation:
      'Start with a design-led pathway for an outdoor room, distinctive roof form or site that needs a more individual response.',
    pathwayLabel: 'Explore projects',
    primaryDestination: '/projects',
    secondaryServiceLabel: 'Explore custom pergolas',
    closeHeading: 'Ready to discuss your custom design?',
    closeExplanation:
      'Send the direction and priorities you selected so Sanctuary can review the design intent, site and useful next step.',
    evidenceReasonBySlug: {
      'tindalls-bay-pavilion':
        'Mixed roof zones resolve a combined patio and carport around complex house geometry.',
      'warkworth-outdoor-room':
        'Roofing, cedar lining, deck, fireplace and lighting were planned as one complete outdoor room.',
    },
  },
};

export const commercialProfessionalPathContent: Record<
  CommercialProfessionalPath,
  CommercialProfessionalPathContent
> = {
  venue: {
    label: commercialProfessionalPathLabels.venue,
    description:
      'Create more usable customer space while coordinating the building, operations, access and installation.',
    responseHeading: 'Extend your venue with confidence',
    responseExplanation:
      'Start with a commercial design-and-build pathway shaped around your venue, operating requirements and the experience beneath the roof.',
    pathwayLabel: 'Explore commercial pergolas',
    enquiryType: 'commercial',
    closeHeading: 'Ready to explore an extension to your venue?',
    closeExplanation:
      'Share the site, intended use and operating constraints so Sanctuary can help define a practical next step.',
    evidenceReasonBySlug: {
      'goodhome-commercial-terrace':
        'Two gables extend the restaurant courtyard while preserving the established villa-style facade.',
      'lilliput-mini-golf':
        'A straightforward pitched cover was coordinated within a wider customer-facing venue renovation.',
    },
  },
  'builder-contractor': {
    label: commercialProfessionalPathLabels['builder-contractor'],
    description:
      'A clearly defined pergola package coordinated with your programme, trades and site responsibilities.',
    responseHeading: 'A defined pergola package for your build',
    responseExplanation:
      'Start with clear scope, responsibilities and delivery coordination around the drawings, programme and wider build.',
    pathwayLabel: 'Explore builder collaboration',
    enquiryType: 'professional',
    closeHeading: 'Ready to define the pergola package?',
    closeExplanation:
      'Share the project stage, available documents and the scope Sanctuary should own so responsibilities are clear early.',
    evidenceReasonBySlug: {
      'lilliput-mini-golf':
        'Supply and installation were coordinated within a consultant-led venue renovation and wider trade sequence.',
      'kiwi-rail-platform':
        'A long aluminium and acrylic canopy was delivered around defined building and lighting interfaces.',
    },
  },
  'architects-designers': {
    label: commercialProfessionalPathLabels['architects-designers'],
    description:
      'Early design input, buildability, technical coordination or delivery of a developed package.',
    responseHeading: 'Pergola collaboration for architects and designers',
    responseExplanation:
      'Start with a professional pathway for design integration, buildability, scope and delivery within the wider project team.',
    pathwayLabel: 'Explore professional collaboration',
    enquiryType: 'professional',
    closeHeading: 'Ready to bring Sanctuary into the project?',
    closeExplanation:
      'Share the brief, drawings and open decisions so Sanctuary can define where design input or delivery support is most useful.',
    evidenceReasonBySlug: {
      'kiwi-rail-platform':
        'Sanctuary helped deliver an architect-led canopy with coordinated structure, roofing and lighting.',
      'goodhome-commercial-terrace':
        'The new gables align with the existing architecture while extending the customer-facing space.',
    },
  },
};

export const projectPriorityContent: Record<
  ProjectPriority,
  { label: string; description: string }
> = {
  daylight: {
    label: projectPriorityLabels.daylight,
    description:
      'Add shelter without making the adjoining interior or deck feel dark.',
  },
  shade: {
    label: projectPriorityLabels.shade,
    description:
      'Reduce direct sun and make the space more comfortable through warmer weather.',
  },
  'everyday-use': {
    label: projectPriorityLabels['everyday-use'],
    description:
      'Create reliable shelter for everyday dining, relaxing or changing weather.',
  },
  entertaining: {
    label: projectPriorityLabels.entertaining,
    description:
      'Allow for furniture, lighting, services, a kitchen, fireplace or gathering space.',
  },
  'open-structure': {
    label: projectPriorityLabels['open-structure'],
    description:
      'Protect views, circulation and key areas from unnecessary posts or visual weight.',
  },
  coordination: {
    label: projectPriorityLabels.coordination,
    description:
      'Work with renovations, drawings, consultants, builders or other trades.',
  },
};
