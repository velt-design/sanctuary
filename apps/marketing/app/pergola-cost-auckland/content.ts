import type { SeoLandingPageConfig } from '@/components/seo-landing/types';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';

const faqItems = [
  {
    question: 'How much does a pergola cost in Auckland?',
    answer: ['Start with your dimensions and roof choices in the pergola designer. Supported configurations can show an initial installed estimate; other designs need an individual quote. A complete outdoor room or complex connection needs a brief covering the whole project.'],
  },
  {
    question: 'What shapes the price?',
    answer: ['Size, structure, roofing, house connections, drainage, site work, access and selected options.'],
  },
  {
    question: 'Can I get an early estimate?',
    answer: ['Use the designer to explore the available forms, dimensions and options. It shows an initial installed estimate where pricing is available; some designs need an individual quote. For a bespoke project or help choosing, send photos, rough dimensions and intended use. Any early indication remains subject to site and scope confirmation.'],
  },
  {
    question: 'How should I compare quotes?',
    answer: ['Check whether GST, installation, foundations, house connections, drainage, engineering, consent work and selected extras are included. Ask each supplier to identify exclusions and allowances so you can compare the complete work.'],
  },
] as const;

export const pergolaCostConfig = {
  marker: 'pergola-cost-auckland',
  showDesignNextSteps: true,
  route: '/pergola-cost-auckland',
  description: 'Explore an initial pergola estimate for supported designs, understand Auckland installation cost drivers and compare what each quote includes.',
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
    title: 'What will your pergola cost?',
    intro: 'Explore an initial estimate for a supported design, or send us your brief for a project-specific quote.',
    primaryCta: 'Design and estimate',
    primaryHref: buildConfiguratorEnquiryHref({ sourcePath: '/pergola-cost-auckland', sourceComponent: 'hero' }),
    secondaryCta: 'See cost drivers',
    secondaryHref: '#cost-drivers',
    proof: ['Your dimensions and choices', 'Estimate where supported', 'Site and scope confirmed before quoting'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'price-with-context',
      eyebrow: 'Find your starting budget',
      title: 'Start with a design, or start with a brief.',
      paragraphs: ['Use the designer to explore your size, roof and optional extras. Where an estimate is available, it applies to that configuration. For a bespoke outdoor room, a difficult house connection or work beyond the pergola, send photos and rough dimensions below so we can assess the complete scope.'],
    },
    {
      kind: 'projects',
      id: 'cost-projects',
      eyebrow: 'Scope examples',
      title: 'What your budget needs to cover.',
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
      title: 'Four things that change the total.',
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
      title: 'Check what the quoted price includes.',
      lead: 'Compare the complete installed scope.',
      paragraphs: ['Check GST, installation, foundations, house connections and drainage. Ask whether engineering, consent work, electrical work and selected accessories are included, excluded or allowed for.'],
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
