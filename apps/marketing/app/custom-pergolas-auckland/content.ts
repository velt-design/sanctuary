import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What makes a Sanctuary pergola custom?',
    answer: [
      'The dimensions, form, structure, posts, roofing, drainage and integrated options are developed around the specific home, use and site conditions rather than a fixed kit size.',
    ],
  },
  {
    question: 'Can custom design work around an unusual space?',
    answer: [
      'It can investigate difficult rooflines, corners, existing decks, changing levels, circulation and restricted posts. Feasibility still depends on measured dimensions and verified conditions.',
    ],
  },
  {
    question: 'Can a custom pergola be attached or freestanding?',
    answer: [
      'Both can be considered. Attachment depends on support, cladding, clearances, flashing and drainage. A freestanding structure may be more useful where the house connection is constrained.',
    ],
  },
  {
    question: 'Can roof materials be combined?',
    answer: [
      'Acrylic and solid zones can be considered where the space needs different light or shade conditions. Their junction and drainage must be designed as part of the complete roof.',
    ],
  },
  {
    question: 'What should I send to start?',
    answer: [
      'Send the suburb, wide photos from outside and inside, rough dimensions, available plans and the reason a standard answer may not work.',
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
    title: 'Custom pergolas for sites where the obvious answer does not fit',
    intro:
      'Sanctuary develops bespoke pergolas around difficult connections, irregular footprints, restricted posts, changing levels and work already planned around the home.',
    primaryCta: 'Request a design review',
    secondaryCta: 'See the custom conditions',
    secondaryHref: '#custom-conditions',
    proof: [
      'Difficult connections resolved early',
      'Posts, spans and levels coordinated',
      'Plans and project teams welcomed',
    ],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'custom-meaning',
      eyebrow: 'Custom should solve something',
      title: 'Use a bespoke response when a standard layout creates a new problem',
      paragraphs: [
        'A roof can cover the deck yet collide with a window, interrupt the main path with a post or remove too much light from the adjoining room.',
        'Custom design starts with those conflicts. It gives each major line, material and connection a reason tied to the home and intended use.',
      ],
    },
    {
      kind: 'projects',
      id: 'custom-project-evidence',
      eyebrow: 'Constrained conditions, built',
      title: 'Three projects with three different reasons to be custom',
      intro:
        'The common thread is not one roof style. It is a response shaped by a real site boundary.',
      items: [
        {
          slug: 'tindalls-bay-pavilion',
          label: 'Layered home and mixed roof zones',
          summary:
            'Acrylic and solid zones, timber battens and blinds respond to different uses across a layered patio and carport.',
          facts: [
            '108 m² across patio and carport',
            'Mixed roof and edge treatments',
          ],
        },
        {
          slug: 'warkworth-outdoor-room',
          label: 'A complete freestanding room',
          summary:
            'A gable, clear glazing, solid roof zone, cedar lining, deck and fireplace were developed as one freestanding room.',
          facts: ['5.0 x 6.0 m footprint', '4.1 m high with a 30 degree roof'],
        },
        {
          slug: 'ardmore-box-carport',
          label: 'Gable geometry inside a box frame',
          summary:
            'A defined perimeter contains an internal gable, steel beams, aluminium rafters, acrylic roofing and lighting.',
          facts: ['8.77 x 6.19 m footprint', 'Steel and aluminium structure'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'custom-conditions',
      tone: 'warm',
      eyebrow: 'When custom earns its place',
      title: 'The custom work happens where conditions collide',
      intro:
        'Each condition changes the whole arrangement, not just one product choice.',
      items: [
        {
          title: 'The house connection is restricted',
          outcome:
            'A roof form and height that clear doors, windows, eaves and existing junctions.',
          consider:
            'Available support, flashing, cladding, rooflines and the view from inside.',
        },
        {
          title: 'Posts or spans cannot follow a default grid',
          outcome:
            'Structure arranged around circulation, furniture, views and feasible support.',
          consider:
            'Loads, foundations, exposure, services and any engineering required.',
        },
        {
          title: 'Levels or project interfaces must coordinate',
          outcome:
            'One scope across decks, drainage, renovation work, drawings and project teams.',
          consider:
            'Ground conditions, access, sequencing, responsibilities and open assumptions.',
        },
      ],
    },
    {
      kind: 'process',
      id: 'custom-process',
      eyebrow: 'Three clear stages',
      title: 'Move from constraints to a buildable answer',
      intro: 'Each stage should make the unknowns more visible and more useful.',
      items: [
        {
          title: 'Show the whole context',
          copy:
            'Send wide photos, rough dimensions, plans and the outcome. Include the awkward connection, level or restricted post position.',
        },
        {
          title: 'Map constraints and connected options',
          copy:
            'Sanctuary reviews structure, roof form, light, drainage, edges and interfaces together while keeping open technical questions explicit.',
        },
        {
          title: 'Confirm responsibilities and scope',
          copy:
            'The agreed design, selections, assumptions, inclusions, exclusions and project-specific checks become one proposal.',
        },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'custom-boundaries',
      eyebrow: 'Site-specific evidence stays essential',
      title: 'Custom does not make technical boundaries disappear',
      intro: 'A bespoke service should be more careful with promises, not less.',
      items: [
        {
          title: 'Structure follows verified conditions',
          text:
            'Spans, posts and supports depend on dimensions, loads, exposure, existing construction and any engineering required.',
        },
        {
          title: 'Approval follows the final design',
          text:
            'Property and consent requirements must be confirmed for the completed project.',
        },
        {
          title: 'Products stay product-specific',
          text:
            'Performance, warranty and care information should come from the exact products selected.',
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
      eyebrow: 'Useful support, when needed',
      title: 'Continue with the next question, not another broad article',
      items: [
        {
          title: 'Compare a complete project scope',
          text:
            'See what makes an early investment discussion useful and a proposal comparable.',
          href: '/pergola-cost-auckland',
          linkLabel: 'Open the cost guide',
        },
        {
          title: 'Plan the whole outdoor room',
          text:
            'Coordinate shelter, furniture, services and changing edges around the life below the roof.',
          href: '/outdoor-rooms-auckland',
          linkLabel: 'Open the outdoor room guide',
        },
        {
          title: 'Review current product forms',
          text:
            'Compare the four canonical pergola forms before testing non-standard junctions and geometry.',
          href: '/products',
          linkLabel: 'Open the product overview',
        },
      ],
    },
    {
      kind: 'faq',
      id: 'custom-pergolas-faq',
      tone: 'elevated',
      eyebrow: 'Questions about bespoke work',
      title: 'What to resolve when the answer is site-specific',
      intro:
        'The final response depends on the actual property, selected products and agreed design.',
      items: faqItems,
    },
  ],
  mobileDisclosureGroups: [
    {
      id: 'custom-planning-support',
      summary: 'Technical boundaries, useful guides and questions',
      blockIds: [
        'custom-boundaries',
        'custom-next-decisions',
        'custom-pergolas-faq',
      ],
    },
  ],
  finalCta: {
    eyebrow: 'Bring the awkward parts',
    title: 'The useful first message shows why the site is specific',
    text:
      'Do not crop out the roofline, corner, doorway or level change that makes the project difficult.',
    button: 'Request a design review',
    checklistTitle: 'Useful context includes',
    checklist: [
      'Project suburb and current stage',
      'Wide photos from outside and inside',
      'Plans or renovation drawings, if available',
      'Rough dimensions and known constraints',
      'Intended use and professional involvement',
    ],
  },
  form: {
    ariaLabel: 'Custom pergola project enquiry form',
    eyebrow: 'Start with the real site',
    heading: 'Send your custom pergola brief',
    intro:
      'Share photos, rough dimensions and the reason a standard answer may not work. Explain what should improve and what must stay open.',
    submitLabel: 'Request a design review',
    messageLabel: 'Why does the site need a custom response?',
    messagePlaceholder:
      'Describe the difficult connection, irregular footprint, restricted post position, changing level, span or coordination issue.',
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
