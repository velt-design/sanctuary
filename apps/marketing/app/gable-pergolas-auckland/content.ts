import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What is a gable pergola?',
    answer: ['Two roof planes meet at a central ridge, adding height through the middle.'],
  },
  {
    question: 'Does the pitch need to match the house?',
    answer: ['Not always. Ridge, eaves, width and pitch should form a coherent relationship with the house.'],
  },
  {
    question: 'Can a gable be attached or freestanding?',
    answer: ['Both can be considered. Attachment depends on support, cladding, flashing and drainage.'],
  },
  {
    question: 'Can the gable end be open or infilled?',
    answer: ['Yes. The choice affects views, exposure, structure and visual weight.'],
  },
] as const;

export const gablePergolasConfig = {
  marker: 'gable-pergolas-auckland',
  route: '/gable-pergolas-auckland',
  description: 'Plan a gable pergola around ridge height, pitch, eaves, roofing, drainage and the Auckland home.',
  schemaName: 'Gable Pergolas Auckland',
  serviceName: 'Custom gable pergola design and installation in Auckland',
  serviceType: 'Gable pergola design and installation',
  guideFirstLayer: {
    answerBlockId: 'gable-volume',
    projectBlockId: 'gable-projects',
    projectSlug: 'warkworth-outdoor-room',
    returnHref: '/products/pergolas/gable',
    returnLabel: 'Review the gable option',
    supportingAnswerTitle: 'More about gable volume',
    supportingProjectsTitle: 'More gable projects',
    supportingSummary: 'Gable decisions, examples and questions',
  },
  hero: {
    image: '/images/project-riverhead-gable-02.jpg',
    imageAlt: 'Custom black gable pergola beside a pool and Auckland home',
    objectPosition: '50% 45%',
    eyebrow: 'Gable pergolas in Auckland',
    title: 'Gable pergolas for Auckland homes.',
    intro: 'A central ridge adds height. Its pitch and proportions must fit the house.',
    primaryCta: 'Send project brief',
    secondaryCta: 'See gable decisions',
    secondaryHref: '#gable-decisions',
    proof: ['Ridge and eaves planned together', 'Open or infilled ends', 'Site-specific structure'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'gable-volume',
      eyebrow: 'The form',
      title: 'The ridge reorganises the room.',
      paragraphs: ['Width, pitch, ridge height and eave height determine the volume below and the silhouette beside the house.'],
    },
    {
      kind: 'projects',
      id: 'gable-projects',
      eyebrow: 'Built examples',
      title: 'One form. Different roles.',
      items: [
        {
          slug: 'warkworth-outdoor-room',
          label: 'Freestanding outdoor room',
          summary: 'A mixed-roof gable forms a complete garden room.',
          facts: ['Freestanding structure', 'Mixed roofing'],
        },
        {
          slug: 'dairy-flat-estate',
          label: 'House-aligned gable',
          summary: 'An acrylic gable follows the roofline with an infilled end and open garden side.',
          facts: ['House-aligned form', 'Acrylic roofing'],
        },
        {
          slug: 'riverhead-gable-pavilion',
          label: 'Poolside pavilion',
          summary: 'A timber-lined gable creates a clear centre beside the pool.',
          facts: ['Timber lining', 'Integrated lighting'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'gable-decisions',
      tone: 'warm',
      eyebrow: 'Design decisions',
      title: 'Resolve the whole section.',
      items: [
        { title: 'Ridge and eaves', outcome: 'Set a balanced volume.', consider: 'Width, height, pitch and house relationship.' },
        { title: 'Ends and views', outcome: 'Choose an open, framed or infilled end.', consider: 'Views, exposure and structural effect.' },
        { title: 'Roof and water', outcome: 'Coordinate roofing, gutters and discharge.', consider: 'Products, junctions and maintenance access.' },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'gable-boundaries',
      eyebrow: 'Project checks',
      title: 'The roof label is not the technical answer.',
      items: [
        { title: 'Structure', text: 'Confirm it from the measured site and final design.' },
        { title: 'Weather', text: 'Review roofing, edges, gutters and house junctions together.' },
        { title: 'Approval', text: 'Consent and property checks follow the completed design.' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'gable-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Compare before choosing.',
      items: [
        { title: 'Prefer one roof plane?', text: 'Compare a single-slope form.', href: '/pitched-pergolas-auckland', linkLabel: 'Pitched pergola guide' },
        { title: 'Need the wider brief?', text: 'Plan form, roofing and use together.', href: '/pergolas-auckland', linkLabel: 'Pergola planning guide' },
      ],
    },
    {
      kind: 'faq',
      id: 'gable-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Gable pergola questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Gable pergola project enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the gable project.',
    intro: 'Share the roofline, openings, rough dimensions and intended use.',
    submitLabel: 'Send project brief',
    messageLabel: 'Why a gable?',
    messagePlaceholder: 'Describe the height, view or room arrangement the ridge should support.',
    briefFields: [
      { name: 'gableRelationship', label: 'Roofline relationship', type: 'text', placeholder: 'Match, relate or stand apart' },
      { name: 'gableEndPreference', label: 'Gable end', type: 'select', options: ['Open', 'Infilled or glazed', 'Compare both', 'Unsure'] },
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
