import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What can a pergola blind help with?',
    answer: ['A selected edge can be planned for low sun, privacy or exposure. Results depend on the site, opening and exact system.'],
  },
  {
    question: 'Should blinds be planned with a new pergola?',
    answer: ['Yes. Headboxes, guides, power and clearances are easier to coordinate before fabrication.'],
  },
  {
    question: 'Can blinds be added to an existing pergola?',
    answer: ['Possibly. The structure, opening, fixings, clearances and product limits need review.'],
  },
  {
    question: 'Can a blind stay down in strong wind?',
    answer: ['Follow the operating limits and guidance for the exact selected system.'],
  },
] as const;

export const pergolasWithBlindsConfig = {
  marker: 'pergolas-with-blinds',
  route: '/pergolas-with-blinds',
  description: 'Plan pergola blinds around one exposed edge, the measured opening and the selected system.',
  schemaName: 'Pergolas With Blinds',
  serviceName: 'Pergola and blind planning in Auckland',
  serviceType: 'Pergola blind planning and installation',
  guideFirstLayer: {
    answerBlockId: 'blind-is-an-edge',
    projectBlockId: 'blind-projects',
    projectSlug: 'tindalls-bay-pavilion',
    returnHref: '/products/screens-walls/drop-down-blinds',
    returnLabel: 'Review the blind option',
    supportingAnswerTitle: 'More about changing edges',
    supportingProjectsTitle: 'More screened projects',
    supportingSummary: 'Blind integration, examples and questions',
  },
  hero: {
    image: '/images/project-tindalls-bay.jpg',
    imageAlt: 'Pergola with a screened edge beside an Auckland home',
    objectPosition: '50% 42%',
    eyebrow: 'Pergolas with blinds',
    title: 'Plan blinds as part of the pergola.',
    intro: 'Start with the edge affected by low sun, privacy or exposure.',
    primaryCta: 'Send project brief',
    secondaryCta: 'See blind decisions',
    secondaryHref: '#blind-decisions',
    proof: ['One edge at a time', 'Openings measured', 'Product limits confirmed'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'blind-is-an-edge',
      eyebrow: 'The edge',
      title: 'A blind changes one boundary.',
      paragraphs: ['Identify the direction, time and activity affected before choosing the number or type of blinds.'],
    },
    {
      kind: 'projects',
      id: 'blind-projects',
      eyebrow: 'Built examples',
      title: 'Edges respond to the brief.',
      items: [
        {
          slug: 'tindalls-bay-pavilion',
          label: 'Coastal home',
          summary: 'Blinds were identified in the project brief for wind and privacy.',
          facts: ['Mixed roof zones', 'Selected screened edges'],
        },
        {
          slug: 'goodhome-commercial-terrace',
          label: 'Hospitality courtyard',
          summary: 'Screens were coordinated with two gables and the restaurant fit-out.',
          facts: ['Commercial setting', 'Integrated lighting'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'blind-decisions',
      tone: 'warm',
      eyebrow: 'Specification',
      title: 'Define the changing edge.',
      items: [
        { title: 'Condition', outcome: 'Name the sun, privacy or exposure issue.', consider: 'Direction, timing and affected activity.' },
        { title: 'Opening', outcome: 'Fit the selected system to the measured edge.', consider: 'Width, height, structure and obstructions.' },
        { title: 'Operation', outcome: 'Choose controls and an open position.', consider: 'Power, access and written operating limits.' },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'blind-boundaries',
      eyebrow: 'Product limits',
      title: 'A blind is not a permanent wall.',
      items: [
        { title: 'Wind', text: 'Follow the exact system’s operating guidance.' },
        { title: 'Weather', text: 'Do not treat an outdoor edge as complete enclosure.' },
        { title: 'Warranty', text: 'Use current written terms for the selected product.' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'blind-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Keep the edge connected to the room.',
      items: [
        { title: 'Whole outdoor room', text: 'Coordinate use, furniture, roof and services.', href: '/outdoor-rooms-auckland', linkLabel: 'Outdoor room guide' },
        { title: 'Blind product', text: 'Review fit, constraints and evidence.', href: '/products/screens-walls/drop-down-blinds', linkLabel: 'Drop-down blinds' },
      ],
    },
    {
      kind: 'faq',
      id: 'pergolas-with-blinds-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Pergola blind questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Pergola with blinds enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the edge.',
    intro: 'Share the opening and the condition you want to manage.',
    submitLabel: 'Send project brief',
    messageLabel: 'Which edge needs to change?',
    messagePlaceholder: 'Describe the low sun, privacy or exposure issue and when it occurs.',
    briefFields: [
      { name: 'pergolaStatus', label: 'Pergola status', type: 'select', options: ['New pergola', 'Existing Sanctuary pergola', 'Other existing pergola', 'Unsure'] },
      { name: 'openingDimensions', label: 'Opening size', type: 'text', placeholder: 'Width and height, if known' },
      { name: 'controlPreference', label: 'Control', type: 'select', options: ['Manual', 'Motorised', 'Compare both', 'Unsure'] },
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
