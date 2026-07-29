import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'Are acrylic roofs better than louvre roofs?',
    answer: ['Neither is universally better. Compare the exact designs, products, evidence and installed scope against one brief.'],
  },
  {
    question: 'Does Sanctuary install louvre roofs?',
    answer: [
      "Sanctuary's published roof offer is fixed acrylic, solid and combination roofs.",
      'This guide treats louvre systems as external supplier proposals, not a Sanctuary product.',
    ],
  },
  {
    question: 'Is either roof completely waterproof?',
    answer: ['Do not accept a category-wide claim. Review the exact roof, joints, flashings, drainage, installation and supplier evidence.'],
  },
  {
    question: 'Which option provides more light or shade?',
    answer: ['That depends on the acrylic product or louvre positions, orientation and completed design. Ask for product-specific evidence.'],
  },
] as const;

export const acrylicVsLouvreConfig = {
  marker: 'acrylic-pergolas-vs-louvre-roofs',
  route: '/acrylic-pergolas-vs-louvre-roofs',
  description: 'Compare Sanctuary fixed acrylic roofs with an external louvre proposal using one project brief and complete scope.',
  schemaName: 'Acrylic Pergolas vs Louvre Roofs',
  serviceName: 'Pergola roof option consultation in Auckland',
  serviceType: 'Pergola roof design consultation',
  guideFirstLayer: {
    answerBlockId: 'comparison-brief',
    projectBlockId: 'acrylic-comparison-projects',
    projectSlug: 'mt-maunganui-box',
    returnHref: '/products',
    returnLabel: 'Compare Sanctuary pergola options',
    supportingAnswerTitle: 'More about the comparison brief',
    supportingProjectsTitle: 'Another fixed-roof project',
    supportingSummary: 'Comparison table, evidence and questions',
  },
  hero: {
    image: '/images/box-landing.jpg',
    imageAlt: 'Fixed acrylic roof within a dark box-perimeter pergola',
    objectPosition: '50% 52%',
    eyebrow: 'Acrylic roof or louvre roof',
    title: 'Acrylic roof or louvre roof?',
    intro: 'Compare Sanctuary’s fixed roofs with an external louvre proposal against the same brief.',
    primaryCta: 'Send roof brief',
    secondaryCta: 'Compare the options',
    secondaryHref: '#roof-comparison',
    proof: ['Sanctuary fixed roofs identified', 'External louvre proposal', 'Complete scope compared'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'comparison-brief',
      eyebrow: 'The brief',
      title: 'Compare the roof behaviour you need.',
      paragraphs: ['Define the required rain cover, daylight, shade, sky view and controls before comparing product labels.'],
    },
    {
      kind: 'projects',
      id: 'acrylic-comparison-projects',
      eyebrow: 'Sanctuary fixed roofs',
      title: 'Acrylic in different forms.',
      intro: 'These projects are evidence for Sanctuary fixed roofs, not louvre systems.',
      items: [
        {
          slug: 'mt-maunganui-box',
          label: 'Box perimeter',
          summary: 'Opal acrylic sits within a low horizontal frame around a first-floor deck.',
          facts: ['Fixed acrylic roof', 'Box-perimeter form'],
        },
        {
          slug: 'dairy-flat-estate',
          label: 'Gable',
          summary: 'An acrylic gable follows the roofline with an infilled end and open garden side.',
          facts: ['Fixed acrylic roof', 'House-aligned gable'],
        },
      ],
    },
    {
      kind: 'numbered-cards',
      id: 'comparison-order',
      eyebrow: 'Comparison method',
      title: 'Start with three questions.',
      items: [
        { title: 'Required states', text: 'What should happen for rain, sun, daylight and sky view?' },
        { title: 'House impact', text: 'Which windows, doors, rooflines and rooms are affected?' },
        { title: 'Evidence', text: 'Which exact products, controls, warranties and exclusions are quoted?' },
      ],
    },
    {
      kind: 'comparison',
      id: 'roof-comparison',
      tone: 'warm',
      eyebrow: 'Like-for-like',
      title: 'Use one brief and two complete proposals.',
      intro: 'The louvre column describes questions for an external supplier.',
      options: [
        { title: 'Sanctuary fixed roof', text: 'A fixed acrylic, solid or combination roof designed for the site.' },
        { title: 'External louvre proposal', text: 'A supplier-specific moving-blade system and installed scope.' },
      ],
      rows: [
        { label: 'Roof state', values: ['Fixed by the selected design and products.', 'Confirm every proposed blade position and control.'] },
        { label: 'Daylight and shade', values: ['Confirm acrylic tint, opacity and roof zoning.', 'Assess each blade position and its effect on nearby rooms.'] },
        { label: 'Rain', values: ['Review joints, pitch, flashings, gutters and outlets.', 'Review the closed state, perimeter, drainage and supplier limits.'] },
        { label: 'Services', values: ['Coordinate lighting, heating and blinds where included.', 'Confirm motors, controls, sensors, power and commissioning.'] },
        { label: 'Support', values: ['Request care and warranty documents for each selected product.', 'Request maintenance, service, parts and warranty documents.'] },
      ],
      note: 'Do not infer waterproofing, heat, UV, wind, lifespan, maintenance, warranty or price from either category.',
    },
    {
      kind: 'dark-cards',
      id: 'comparison-traps',
      eyebrow: 'Common traps',
      title: 'A category claim is not project evidence.',
      items: [
        { title: 'Product', text: 'Name the exact roof, finish, controls and drainage.' },
        { title: 'Outcome', text: 'Test each proposed state against the intended use.' },
        { title: 'Scope', text: 'Align structure, site work, services and exclusions.' },
      ],
      links: [
        { href: '/acrylic-roof-pergolas-auckland', label: 'Acrylic roof pergolas' },
        { href: '/pergola-cost-auckland', label: 'Compare quote scope' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'comparison-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Continue with exact evidence.',
      items: [
        { title: 'Sanctuary acrylic roofs', text: 'Review fixed-roof options and project examples.', href: '/acrylic-roof-pergolas-auckland', linkLabel: 'Acrylic roof guide' },
        { title: 'Complete scope', text: 'Compare structure, controls, site work and exclusions.', href: '/pergola-cost-auckland', linkLabel: 'Pergola cost guide' },
      ],
    },
    {
      kind: 'faq',
      id: 'acrylic-vs-louvre-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Roof comparison questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Pergola roof comparison enquiry form',
    eyebrow: 'Roof brief',
    heading: 'Tell us about the roof decision.',
    intro: 'Share the site, required roof behaviour and any external proposal.',
    submitLabel: 'Send project brief',
    messageLabel: 'Required roof behaviour',
    messagePlaceholder: 'Describe the rain cover, daylight, shade, sky view and controls you value.',
    briefFields: [
      { name: 'externalProposal', label: 'External proposal', type: 'select', options: ['None yet', 'Initial proposal', 'Drawings and specification', 'Unsure'] },
      { name: 'comparisonPriorities', label: 'Main comparison priorities', type: 'text', placeholder: 'Daylight, drainage, controls, maintenance or scope', wide: true },
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
