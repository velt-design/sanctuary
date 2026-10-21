import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const PITCHED_ROUTE = '/pitched-pergolas-auckland';
export const pitchedQuestions = [
  { question: 'What is a pitched pergola?', answer: 'A mono-pitched pergola has one sloping roof plane, running from a high edge to a low edge. It can connect to a house or stand separately. A gable has two roof planes meeting at a central ridge.' },
  { question: 'Will a pitched roof fit below my eaves?', answer: 'The eaves are one part of the picture. Doors, windows, the connection, roof depth and clearance at the outer edge all need to work together. Photos from both ends of the proposed cover help us assess the starting point; the final arrangement follows measured levels and structural review.' },
  { question: 'How much roof fall does it need?', answer: 'There is no single pitch that suits every roof. The selected roofing, roof depth, framing, junctions and drainage arrangement determine the design. A shallow-looking roof still needs a resolved path for water to collect and discharge.' },
  { question: 'Can I keep light coming into the house?', answer: 'Acrylic, solid and combination roofs offer different starting points. Consider the windows and rooms behind the pergola, the roof depth and orientation, as well as the space underneath. We can compare those choices around your home rather than assume one material suits every room.' },
  { question: 'Does it have to attach to the house?', answer: 'No. A freestanding pitched structure can be considered where a separate shelter makes sense. Posts, foundations, exposure and any junction with the house still need assessment. Being close to a wall does not by itself establish a suitable attachment.' },
  { question: 'Will the sides keep out wind and rain?', answer: 'The roof provides overhead cover, but open sides remain exposed. Blinds or screens can be considered as part of the design, with their own operating and exposure limits. Roofing, flashings, gutters and outlets need to be resolved together for the actual site.' },
  { question: 'What do I need before enquiring?', answer: 'Start with your suburb, what you want to cover and how you would like to use it. Photos of the house and both ends of the space are useful. Rough dimensions or plans are welcome, but you do not need a finished design.' },
] as const;

export const pitchedPergolasConfig = {
  marker: 'pitched-pergolas-auckland',
  route: PITCHED_ROUTE,
  description: 'Plan a pitched pergola around the house connection, available height, roof fall and drainage.',
  schemaName: 'Pitched Pergolas Auckland',
  serviceName: 'Custom pitched pergola design and installation in Auckland',
  serviceType: 'Pitched pergola design and installation',
  showGuideNavigation: false,
  hero: {
    image: '/images/simple-pergolas/pitched-01.webp',
    imageAlt: 'White single-pitch acrylic pergola connecting a weatherboard home to its garden patio',
    eyebrow: 'Pitched pergolas · Auckland',
    title: 'Pitched pergolas. One clean roofline.',
    intro: 'A single sloping roof, designed around the doors, windows and outdoor space you already have.',
    primaryCta: 'Discuss your pergola',
    secondaryCta: 'See how the roof fits',
    secondaryHref: '#pitched-section',
    proof: [],
  },
  blocks: [],
  form: {
    ariaLabel: 'Pitched pergola project enquiry form',
    eyebrow: 'Start with the space',
    heading: 'Tell us what you want to cover.',
    intro: 'A few photos of the house and both ends of the space are a useful start. Measurements or plans are welcome, but you do not need a finished design. We’ll review your enquiry and contact you about the next step.',
    submitLabel: 'Send your enquiry',
    messageLabel: 'What do you have in mind?',
    messagePlaceholder: 'Tell us about the house, the outdoor space and what you would like the pergola to change.',
    briefFields: [
      { name: 'highEdgeContext', label: 'House connection', type: 'text', placeholder: 'Eaves, wall, doors or windows, if known' },
      { name: 'drainageDirection', label: 'Preferred drainage side', type: 'text', placeholder: 'If known' },
    ],
    roofPreference: {
      detailKey: 'roofPreference',
      options: [
        { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] },
        { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] },
        { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] },
        { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
      ],
    },
  },
} satisfies SeoLandingPageConfig;
