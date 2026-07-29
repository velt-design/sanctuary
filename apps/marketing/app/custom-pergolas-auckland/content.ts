import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What makes a pergola custom?',
    answer: [
      'Its form, structure, roofing and drainage are designed for the home, use and site.',
    ],
  },
  {
    question: 'Can custom design work around an unusual space?',
    answer: [
      'Yes. Feasibility still depends on measured dimensions and verified conditions.',
    ],
  },
  {
    question: 'Can a custom pergola be attached or freestanding?',
    answer: [
      'Both can be considered. Attachment depends on support, cladding, flashing and drainage.',
    ],
  },
  {
    question: 'Can roof materials be combined?',
    answer: [
      'Yes. Their junction and drainage must be designed as part of the complete roof.',
    ],
  },
  {
    question: 'What should I send to start?',
    answer: [
      'Send the suburb, wide photos, rough dimensions, plans and the difficult condition.',
    ],
  },
] as const;

export const customPergolasConfig = {
  marker: 'custom-pergolas-auckland',
  route: '/custom-pergolas-auckland',
  showGuideNavigation: false,
  description:
    'Plan a custom pergola for an Auckland home or site that needs more than a standard answer. See how Sanctuary resolves use, geometry, light, structure and scope.',
  schemaName: 'Custom Pergolas Auckland',
  serviceName: 'Custom pergola design and installation in Auckland',
  serviceType: 'Bespoke pergola design and installation',
  hero: {
    image: '/images/project-dairy-flat-03.jpg',
    imageAlt:
      'Custom aluminium pergola connection and roof form beside an Auckland home',
    objectPosition: '50% 44%',
    eyebrow: 'Custom pergolas in Auckland',
    title: 'Custom pergolas for difficult sites.',
    intro:
      'For unusual rooflines, tight post positions, changing levels and architect-led work.',
    primaryCta: 'Send site details',
    secondaryCta: 'See common constraints',
    secondaryHref: '#custom-conditions',
    proof: [
      'Site-specific design',
      'Plans welcome',
      'Design and installation',
    ],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'custom-meaning',
      eyebrow: 'Why custom',
      title: 'Solve the site, not a standard layout.',
      paragraphs: [
        'Custom design starts with the roofline, openings, levels, circulation and available support.',
      ],
    },
    {
      kind: 'projects',
      id: 'custom-project-evidence',
      eyebrow: 'Built examples',
      title: 'Three site-specific responses.',
      items: [
        {
          slug: 'tindalls-bay-pavilion',
          label: 'Layered home and mixed roof zones',
          summary: 'Mixed roof zones and blinds cover a layered patio and carport.',
          facts: [
            '108 m² across patio and carport',
            'Mixed roof and edge treatments',
          ],
        },
        {
          slug: 'warkworth-outdoor-room',
          label: 'A complete freestanding room',
          summary: 'A freestanding mixed-roof gable room with cedar lining and a fireplace.',
          facts: ['5.0 x 6.0 m footprint', '4.1 m high with a 30 degree roof'],
        },
        {
          slug: 'ardmore-box-carport',
          label: 'Gable geometry inside a box frame',
          summary: 'A box frame contains an internal gable, mixed structure and lighting.',
          facts: ['8.77 x 6.19 m footprint', 'Steel and aluminium structure'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'custom-conditions',
      tone: 'warm',
      eyebrow: 'Common constraints',
      title: 'Where custom work matters.',
      items: [
        {
          title: 'The house connection is restricted',
          outcome: 'Clear doors, windows, eaves and existing junctions.',
          consider: 'Support, flashing, cladding and the view from inside.',
        },
        {
          title: 'Posts or spans cannot follow a default grid',
          outcome: 'Arrange structure around circulation, views and support.',
          consider: 'Loads, foundations, exposure and engineering.',
        },
        {
          title: 'Levels or project interfaces must coordinate',
          outcome: 'Coordinate decks, drainage, drawings and project teams.',
          consider: 'Access, sequencing and responsibilities.',
        },
      ],
    },
    {
      kind: 'process',
      id: 'custom-process',
      eyebrow: 'The process',
      title: 'From constraints to agreed scope.',
      items: [
        {
          title: 'Share the context',
          copy: 'Send wide photos, rough dimensions, plans and the difficult condition.',
        },
        {
          title: 'Review constraints',
          copy: 'We review structure, roof form, drainage and project interfaces.',
        },
        {
          title: 'Confirm scope',
          copy: 'The design, responsibilities, inclusions and checks become one proposal.',
        },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'custom-boundaries',
      eyebrow: 'Project checks',
      title: 'Technical answers stay site-specific.',
      items: [
        {
          title: 'Structure follows verified conditions',
          text: 'Structure depends on the measured site and final design.',
        },
        {
          title: 'Approval follows the final design',
          text: 'Consent and property checks follow the final design.',
        },
        {
          title: 'Products stay product-specific',
          text: 'Use written information for the exact products selected.',
        },
      ],
      links: [
        {
          href: '/pergolas-auckland',
          label: 'Review the broader residential service',
        },
      ],
    },
    {
      kind: 'link-cards',
      id: 'custom-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Continue with the next decision.',
      items: [
        {
          title: 'Compare a complete project scope',
          text: 'See what shapes cost and makes proposals comparable.',
          href: '/pergola-cost-auckland',
          linkLabel: 'Open the cost guide',
        },
        {
          title: 'Plan the whole outdoor room',
          text: 'Coordinate shelter, furniture, services and edges.',
          href: '/outdoor-rooms-auckland',
          linkLabel: 'Open the outdoor room guide',
        },
        {
          title: 'Review current product forms',
          text: 'Compare the four core pergola forms.',
          href: '/products',
          linkLabel: 'Open the product overview',
        },
      ],
    },
    {
      kind: 'faq',
      id: 'custom-pergolas-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Custom pergola questions.',
      items: faqItems,
    },
  ],
  mobileDisclosureGroups: [
    {
      id: 'custom-planning-support',
    summary: 'Project checks, related guides and questions',
      blockIds: [
        'custom-boundaries',
        'custom-next-decisions',
        'custom-pergolas-faq',
      ],
    },
  ],
  form: {
    ariaLabel: 'Custom pergola project enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the site.',
    intro: 'Send wide photos, rough dimensions and plans. Show us what makes the site difficult.',
    submitLabel: 'Send project brief',
    messageLabel: 'What makes the site difficult?',
    messagePlaceholder: 'Describe the connection, footprint, post position, level or coordination issue.',
    briefFields: [
      {
        name: 'siteAddress',
        label: 'Project address',
        type: 'text',
        placeholder: 'Street address, if you are ready to share it',
        wide: true,
      },
      {
        name: 'projectStage',
        label: 'Project stage',
        type: 'select',
        options: [
          'Early feasibility',
          'Concept design',
          'Architectural plans underway',
          'Consent or documentation underway',
          'Ready for a detailed proposal',
        ],
      },
      {
        name: 'professionalInvolvement',
        label: 'Professional involvement',
        type: 'text',
        placeholder: 'Architect, designer, builder or engineer, if involved',
      },
      {
        name: 'knownConstraints',
        label: 'Known site and connection constraints',
        type: 'textarea',
        placeholder:
          'Include restricted posts, spans, levels, services, access, renovation sequencing or existing structure.',
        wide: true,
      },
      {
        name: 'intendedUse',
        label: 'Intended use of the finished space',
        type: 'text',
        placeholder:
          'For example: dining, cooking, poolside or everyday family use',
        wide: true,
      },
    ],
    roofPreference: {
      detailKey: 'roofPreference',
      options: [
        {
          label: 'Acrylic roofing',
          value: 'Acrylic roofing',
          roofMaterials: ['acrylic'],
        },
        {
          label: 'Solid or lined roofing',
          value: 'Solid or lined roofing',
          roofMaterials: ['timber'],
        },
        {
          label: 'Combination roofing',
          value: 'Combination roofing',
          roofMaterials: ['acrylic', 'timber'],
        },
        { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
      ],
    },
  },
} satisfies SeoLandingPageConfig;
