import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'How much does a pergola cost in Auckland?',
    answer: ['A useful figure needs a defined site, design and scope. Sanctuary does not publish an unqualified generic price.'],
  },
  {
    question: 'What shapes the price?',
    answer: ['Size, structure, roofing, house connections, drainage, site work, access and selected options.'],
  },
  {
    question: 'Can I get an early estimate?',
    answer: ['Send photos, rough dimensions and intended use. Any early indication remains subject to site and scope confirmation.'],
  },
  {
    question: 'How should I compare quotes?',
    answer: ['Compare the design, materials, site work, approvals, services, inclusions, exclusions and responsibilities.'],
  },
] as const;

export const pergolaCostConfig = {
  marker: 'pergola-cost-auckland',
  route: '/pergola-cost-auckland',
  description: 'Understand the design, structure, roofing, site work and options that shape an Auckland pergola quote.',
  schemaName: 'Pergola Cost Auckland',
  serviceName: 'Pergola scope and estimate review in Auckland',
  serviceType: 'Pergola project scoping',
  guideFirstLayer: {
    answerBlockId: 'price-with-context',
    projectBlockId: 'cost-projects',
    projectSlug: 'warkworth-outdoor-room',
    returnHref: '/pergolas-auckland',
    returnLabel: 'Return to pergola planning',
    supportingAnswerTitle: 'More about scope and price',
    supportingProjectsTitle: 'More scope examples',
    supportingSummary: 'Cost drivers, quote checks and questions',
  },
  hero: {
    image: '/images/project-tindalls-bay.jpg',
    imageAlt: 'Complex pergola scope with mixed roof zones beside an Auckland home',
    objectPosition: '50% 42%',
    eyebrow: 'Pergola cost in Auckland',
    title: 'Pergola cost starts with scope.',
    intro: 'Size, structure, roofing, site work and extras shape the price.',
    primaryCta: 'Send project brief',
    secondaryCta: 'See cost drivers',
    secondaryHref: '#cost-drivers',
    proof: ['No generic square-metre price', 'Scope before comparison', 'Project-specific quote'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'price-with-context',
      eyebrow: 'The answer',
      title: 'A price is useful only when the scope is clear.',
      paragraphs: ['Two similar footprints can need different structures, connections, site work and integrated options.'],
    },
    {
      kind: 'projects',
      id: 'cost-projects',
      eyebrow: 'Scope examples',
      title: 'Photos reveal what area alone cannot.',
      intro: 'These are scope examples, not price examples.',
      items: [
        {
          slug: 'warkworth-outdoor-room',
          label: 'Complete outdoor room',
          summary: 'Mixed roofing, cedar lining, deck, fireplace and lighting sit within one scope.',
          facts: ['Freestanding gable', 'Integrated features'],
        },
        {
          slug: 'tindalls-bay-pavilion',
          label: 'Layered home',
          summary: 'Patio and carport zones use different roofing and edge treatments.',
          facts: ['Multiple zones', 'Blinds included'],
        },
        {
          slug: 'ardmore-box-carport',
          label: 'Vehicle cover',
          summary: 'A box-perimeter form combines steel, aluminium, acrylic and lighting.',
          facts: ['Mixed structure', 'Integrated lighting'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'cost-drivers',
      tone: 'warm',
      eyebrow: 'Cost drivers',
      title: 'Trace cost to four decisions.',
      items: [
        { title: 'Size and structure', outcome: 'Define the footprint, height, spans and posts.', consider: 'Loads, supports, foundations and engineering.' },
        { title: 'Roof and connection', outcome: 'Choose the form, roofing and house junction.', consider: 'Fall, flashing, gutters and discharge.' },
        { title: 'Site work', outcome: 'Plan access, protection and connected work.', consider: 'Existing conditions, trades and approvals.' },
        { title: 'Options', outcome: 'Include only the features the brief needs.', consider: 'Blinds, lighting, heating, power and controls.' },
      ],
    },
    {
      kind: 'numbered-cards',
      id: 'quote-comparison',
      eyebrow: 'Quote comparison',
      title: 'Compare like with like.',
      items: [
        { title: 'Same outcome', text: 'Check usable area, form, roofing and finish.' },
        { title: 'Same scope', text: 'Check site work, services, approvals and exclusions.' },
        { title: 'Same confidence', text: 'Check which dimensions and assumptions are verified.' },
      ],
    },
    {
      kind: 'process',
      id: 'cost-process',
      eyebrow: 'Price confidence',
      title: 'Replace assumptions with evidence.',
      items: [
        { title: 'Initial brief', copy: 'Photos, rough dimensions and intended use frame the likely scope.' },
        { title: 'Site and design', copy: 'Measured conditions and selected products reduce uncertainty.' },
        { title: 'Final proposal', copy: 'The agreed design, scope, inclusions and exclusions support the quote.' },
      ],
    },
    {
      kind: 'scope',
      id: 'cost-checklist',
      eyebrow: 'Quote scope',
      title: 'Read what sits behind the total.',
      lead: 'A bare number is not enough.',
      paragraphs: ['Check what will be built, what remains optional and who owns connected work.'],
      factors: [
        ['Design', 'Form, dimensions, materials and finish'],
        ['Delivery', 'Site work, installation and approvals'],
        ['Boundaries', 'Assumptions, exclusions and responsibilities'],
      ],
      checklistLead: 'A useful quote identifies',
      checklist: ['The agreed design', 'Included products and site work', 'Allowances and exclusions', 'Project responsibilities'],
    },
    {
      kind: 'faq',
      id: 'pergola-cost-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Pergola cost questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Pergola cost enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the scope.',
    intro: 'Share the site, rough dimensions and intended use.',
    submitLabel: 'Send project brief',
    messageLabel: 'Project scope',
    messagePlaceholder: 'Describe the structure, roof, edges and options you want considered.',
    briefFields: [
      { name: 'scopePriorities', label: 'Main scope priorities', type: 'textarea', placeholder: 'Structure, roofing, edges, lighting or other work', wide: true },
      { name: 'existingWork', label: 'Existing or connected work', type: 'text', placeholder: 'Deck, renovation, landscaping or other trades', wide: true },
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
