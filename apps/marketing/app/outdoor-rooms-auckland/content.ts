import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What makes a pergola an outdoor room?',
    answer: ['The roof, layout, edges, lighting and other services are planned around how the space will be used.'],
  },
  {
    question: 'Should furniture be planned early?',
    answer: ['Yes. Dining, lounging, cooking and circulation help set the dimensions and service positions.'],
  },
  {
    question: 'Can lighting, heating or blinds be included?',
    answer: ['Yes, where they suit the structure and selected products. Plan them before fabrication.'],
  },
  {
    question: 'Will it feel like an indoor room?',
    answer: ['It remains an outdoor space unless a different enclosure is designed. Exposure depends on the site and edges.'],
  },
] as const;

export const outdoorRoomsConfig = {
  marker: 'outdoor-rooms-auckland',
  route: '/outdoor-rooms-auckland',
  description: 'Plan an Auckland outdoor room around use, furniture, roofing, edges, lighting and services.',
  schemaName: 'Outdoor Rooms Auckland',
  serviceName: 'Outdoor room and pergola design in Auckland',
  serviceType: 'Outdoor room design and installation',
  guideFirstLayer: {
    answerBlockId: 'room-not-cover',
    projectBlockId: 'outdoor-room-projects',
    projectSlug: 'warkworth-outdoor-room',
    returnHref: '/pergolas-auckland',
    returnLabel: 'Return to pergola planning',
    supportingAnswerTitle: 'More about outdoor rooms',
    supportingProjectsTitle: 'More outdoor room projects',
    supportingSummary: 'Room planning, examples and questions',
  },
  hero: {
    image: '/images/project-warkworth-outdoor-room-02.jpg',
    imageAlt: 'Freestanding gable outdoor room with cedar lining and fireplace',
    objectPosition: '50% 50%',
    eyebrow: 'Outdoor rooms in Auckland',
    title: 'Outdoor rooms designed around how you use them.',
    intro: 'Plan the roof, layout, edges and services as one space.',
    primaryCta: 'Send project brief',
    secondaryCta: 'See room decisions',
    secondaryHref: '#outdoor-room-decisions',
    proof: ['Use-led layout', 'Roof and edges coordinated', 'Services planned early'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'room-not-cover',
      eyebrow: 'The room',
      title: 'Start with life below the roof.',
      paragraphs: ['Furniture, circulation, views and daily use should shape the roof, structure, edges and services.'],
    },
    {
      kind: 'projects',
      id: 'outdoor-room-projects',
      eyebrow: 'Built examples',
      title: 'Different uses create different rooms.',
      items: [
        {
          slug: 'warkworth-outdoor-room',
          label: 'Garden room',
          summary: 'A freestanding gable combines mixed roofing, cedar lining, deck, fireplace and lighting.',
          facts: ['Freestanding room', 'Mixed roofing'],
        },
        {
          slug: 'riverhead-gable-pavilion',
          label: 'Poolside pavilion',
          summary: 'A timber-lined gable creates a defined poolside room.',
          facts: ['Timber lining', 'Integrated lighting'],
        },
        {
          slug: 'tindalls-bay-pavilion',
          label: 'Layered patio',
          summary: 'Mixed roof and edge zones support different uses around the home.',
          facts: ['Mixed roofing', 'Blinds included'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'outdoor-room-decisions',
      tone: 'warm',
      eyebrow: 'Room planning',
      title: 'Coordinate three layers.',
      items: [
        { title: 'Use and layout', outcome: 'Place furniture, cooking and circulation first.', consider: 'People, paths, views and adjoining doors.' },
        { title: 'Roof and edges', outcome: 'Set daylight, shade and changing boundaries.', consider: 'Orientation, roofing, blinds and privacy.' },
        { title: 'Services', outcome: 'Plan lighting, heating and power early.', consider: 'Mounting, wiring, controls and clearances.' },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'room-expectations',
      eyebrow: 'Outdoor limits',
      title: 'Useful does not mean fully enclosed.',
      items: [
        { title: 'Weather', text: 'Conditions still reach an open outdoor room.' },
        { title: 'Products', text: 'Use written limits for the exact roof and edge systems.' },
        { title: 'Design', text: 'Comfort depends on orientation, exposure and the complete room.' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'room-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Continue with the next layer.',
      items: [
        { title: 'Changing edge', text: 'Plan blinds for one specific condition.', href: '/pergolas-with-blinds', linkLabel: 'Blinds guide' },
        { title: 'Project scope', text: 'See what shapes cost and a useful quote.', href: '/pergola-cost-auckland', linkLabel: 'Cost guide' },
      ],
    },
    {
      kind: 'faq',
      id: 'outdoor-rooms-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Outdoor room questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Outdoor room project enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the room.',
    intro: 'Share the site, intended use and what the room should improve.',
    submitLabel: 'Send project brief',
    messageLabel: 'How will you use the room?',
    messagePlaceholder: 'Describe dining, lounging, cooking, paths and views.',
    briefFields: [
      { name: 'roomActivities', label: 'Main activities', type: 'text', placeholder: 'Dining, cooking, lounging or poolside use', wide: true },
      { name: 'integratedFeatures', label: 'Options to consider', type: 'text', placeholder: 'Lighting, heating, blinds or screens', wide: true },
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
