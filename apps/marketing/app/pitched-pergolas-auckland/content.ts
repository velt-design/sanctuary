import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What is a pitched pergola?',
    answer: ['One roof plane falls from a high edge to a low edge.'],
  },
  {
    question: 'When does a pitched roof suit a home?',
    answer: ['It can suit a tight house connection or a design needing one clear drainage direction.'],
  },
  {
    question: 'Can it be attached or freestanding?',
    answer: ['Both can be considered. Support, cladding, flashing and drainage determine the fit.'],
  },
  {
    question: 'How much fall does it need?',
    answer: ['That depends on the selected roofing, dimensions, junctions and drainage design.'],
  },
] as const;

export const pitchedPergolasConfig = {
  marker: 'pitched-pergolas-auckland',
  route: '/pitched-pergolas-auckland',
  description: 'Plan a pitched pergola around the house connection, available height, roof fall and drainage.',
  schemaName: 'Pitched Pergolas Auckland',
  serviceName: 'Custom pitched pergola design and installation in Auckland',
  serviceType: 'Pitched pergola design and installation',
  guideFirstLayer: {
    answerBlockId: 'pitched-discipline',
    projectBlockId: 'pitched-projects',
    projectSlug: 'velskov-forest',
    returnHref: '/products/pergolas/pitched',
    returnLabel: 'Review the pitched option',
    supportingAnswerTitle: 'More about the roof plane',
    supportingProjectsTitle: 'More pitched projects',
    supportingSummary: 'Pitched-roof decisions, examples and questions',
  },
  hero: {
    image: '/images/project-velskov-02.jpg',
    imageAlt: 'Shallow-pitch pergola beneath a forest canopy',
    objectPosition: '50% 48%',
    eyebrow: 'Pitched pergolas in Auckland',
    title: 'Pitched pergolas for Auckland homes.',
    intro: 'A single roof plane can suit a tight connection and give water one clear direction.',
    primaryCta: 'Send project brief',
    secondaryCta: 'See pitched-roof decisions',
    secondaryHref: '#pitched-decisions',
    proof: ['One clear roof plane', 'Height and fall coordinated', 'Site-specific drainage'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'pitched-discipline',
      eyebrow: 'The form',
      title: 'One plane makes every edge visible.',
      paragraphs: ['The high edge, low edge, house connection and drainage direction must work as one section.'],
    },
    {
      kind: 'projects',
      id: 'pitched-projects',
      eyebrow: 'Built examples',
      title: 'One plane in different settings.',
      items: [
        {
          slug: 'velskov-forest',
          label: 'Forest shelter',
          summary: 'A low-profile shelter covers a working space below the forest canopy.',
          facts: ['Shallow profile', 'Freestanding structure'],
        },
        {
          slug: 'lilliput-mini-golf',
          label: 'Venue renovation',
          summary: 'A pitched pergola was supplied and installed within a consultant-led project.',
          facts: ['Consultant-led package', 'Venue setting'],
        },
        {
          slug: 'kiwi-rail-platform',
          label: 'Workplace canopy',
          summary: 'A long aluminium and acrylic canopy follows a workplace route.',
          facts: ['Long canopy', 'Integrated lighting'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'pitched-decisions',
      tone: 'warm',
      eyebrow: 'Design decisions',
      title: 'Follow the fall through the design.',
      items: [
        { title: 'High edge', outcome: 'Set the house connection and available height.', consider: 'Eaves, doors, windows and support.' },
        { title: 'Low edge', outcome: 'Keep clearance and place the gutter.', consider: 'Views, circulation and discharge.' },
        { title: 'Roof plane', outcome: 'Coordinate structure, roofing and rhythm.', consider: 'Product requirements, spans and junctions.' },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'pitched-boundaries',
      eyebrow: 'Project checks',
      title: 'Simple form. Site-specific answer.',
      items: [
        { title: 'Fall', text: 'Confirm it for the exact roof product and design.' },
        { title: 'Structure', text: 'Confirm spans and supports from the completed design.' },
        { title: 'Approval', text: 'Consent and property checks follow the final project.' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'pitched-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Compare before choosing.',
      items: [
        { title: 'Want a central ridge?', text: 'Compare the height and symmetry of a gable.', href: '/gable-pergolas-auckland', linkLabel: 'Gable pergola guide' },
        { title: 'Need the wider brief?', text: 'Plan the form around the home and use.', href: '/pergolas-auckland', linkLabel: 'Pergola planning guide' },
      ],
    },
    {
      kind: 'faq',
      id: 'pitched-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Pitched pergola questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Pitched pergola project enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the pitched project.',
    intro: 'Share the connection, side views, rough dimensions and intended use.',
    submitLabel: 'Send project brief',
    messageLabel: 'What should the roof plane resolve?',
    messagePlaceholder: 'Describe the connection, available height and preferred drainage direction.',
    briefFields: [
      { name: 'highEdgeContext', label: 'High-edge context', type: 'text', placeholder: 'Eaves, wall, doors or windows' },
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
