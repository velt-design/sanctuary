import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'Why use aluminium for a pergola frame?',
    answer: ['It can create precise posts, beams, rafters and edges. The final result depends on the complete design and specification.'],
  },
  {
    question: 'Can aluminium use acrylic and solid roofing?',
    answer: ['Yes. The frame, fall, drainage and junctions must suit the selected roofing.'],
  },
  {
    question: 'Is aluminium suitable for a coastal site?',
    answer: ['Confirm the coating, detailing, maintenance and exclusions for the actual site and products.'],
  },
  {
    question: 'How far can it span?',
    answer: ['That depends on dimensions, loads, exposure, support and any engineering required.'],
  },
] as const;

export const aluminiumPergolasConfig = {
  marker: 'aluminium-pergolas-auckland',
  route: '/aluminium-pergolas-auckland',
  description: 'Plan an aluminium pergola around frame proportion, roofing, drainage, finish and the Auckland site.',
  schemaName: 'Aluminium Pergolas Auckland',
  serviceName: 'Custom aluminium pergola design and installation in Auckland',
  serviceType: 'Aluminium pergola design and installation',
  guideFirstLayer: {
    answerBlockId: 'aluminium-role',
    projectBlockId: 'aluminium-projects',
    projectSlug: 'dairy-flat-estate',
    returnHref: '/products',
    returnLabel: 'Compare pergola options',
    supportingAnswerTitle: 'More about aluminium frames',
    supportingProjectsTitle: 'Another aluminium project',
    supportingSummary: 'Frame decisions, project checks and questions',
  },
  hero: {
    image: '/images/project-ardmore-carport-03.jpg',
    imageAlt: 'Detailed aluminium rafters and custom pergola framing in Auckland',
    objectPosition: '50% 42%',
    eyebrow: 'Aluminium pergolas in Auckland',
    title: 'Aluminium pergolas for Auckland homes.',
    intro: 'Posts, beams, roof and drainage are designed as one structure.',
    primaryCta: 'Send project brief',
    secondaryCta: 'See frame decisions',
    secondaryHref: '#aluminium-specification',
    proof: ['Site-specific frame', 'Roof and drainage integrated', 'Finish chosen with the home'],
  },
  blocks: [
    {
      kind: 'split-intro',
      id: 'aluminium-role',
      eyebrow: 'The frame',
      title: 'Proportion matters more than the material name.',
      paragraphs: ['Post positions, beam depth, roof edges and junctions determine how the frame relates to the house and space below.'],
    },
    {
      kind: 'projects',
      id: 'aluminium-projects',
      eyebrow: 'Built examples',
      title: 'Aluminium in different forms.',
      items: [
        {
          slug: 'dairy-flat-estate',
          label: 'Gable extension',
          summary: 'An aluminium and acrylic gable follows the existing roofline.',
          facts: ['House-aligned gable', 'Acrylic roofing'],
        },
        {
          slug: 'st-heliers-townhouse',
          label: 'Open gable',
          summary: 'A custom street-facing frame gives the open gable a clear identity.',
          facts: ['Custom gable end', 'Opal acrylic'],
        },
      ],
    },
    {
      kind: 'decision-cards',
      id: 'aluminium-specification',
      tone: 'warm',
      eyebrow: 'Specification',
      title: 'Resolve three things together.',
      items: [
        { title: 'Structure', outcome: 'Set posts, beams and openings around the use.', consider: 'Dimensions, loads, support and engineering.' },
        { title: 'Roof and drainage', outcome: 'Coordinate fall, gutters and house junctions.', consider: 'Roofing, outlets and maintenance access.' },
        { title: 'Finish and options', outcome: 'Relate the finish and mounts to the home.', consider: 'Coating, exposure, lighting, blinds and wiring.' },
      ],
    },
    {
      kind: 'dark-cards',
      id: 'aluminium-claims',
      eyebrow: 'Project checks',
      title: 'Keep technical claims specific.',
      items: [
        { title: 'Spans', text: 'Confirm them from the final structure.' },
        { title: 'Exposure', text: 'Check the site, coating and maintenance requirements.' },
        { title: 'Warranty', text: 'Use current written terms for the exact products.' },
      ],
    },
    {
      kind: 'link-cards',
      id: 'aluminium-next-decisions',
      tone: 'neutral',
      eyebrow: 'Related guides',
      title: 'Continue with the next decision.',
      items: [
        { title: 'Difficult site?', text: 'Review restricted posts, levels and connections.', href: '/custom-pergolas-auckland', linkLabel: 'Custom pergola guide' },
        { title: 'Comparing scope?', text: 'See what shapes cost and a useful quote.', href: '/pergola-cost-auckland', linkLabel: 'Pergola cost guide' },
      ],
    },
    {
      kind: 'faq',
      id: 'aluminium-faq',
      tone: 'elevated',
      eyebrow: 'Questions',
      title: 'Aluminium pergola questions.',
      items: faqItems,
    },
  ],
  form: {
    ariaLabel: 'Aluminium pergola project enquiry form',
    eyebrow: 'Project brief',
    heading: 'Tell us about the project.',
    intro: 'Share the site, intended use and what the frame must keep open.',
    submitLabel: 'Send project brief',
    messageLabel: 'What should the frame resolve?',
    messagePlaceholder: 'Describe the openings, views or circulation that matter.',
    briefFields: [
      { name: 'openingPriorities', label: 'Openings to keep clear', type: 'textarea', placeholder: 'Doors, paths, views or vehicle access', wide: true },
      { name: 'finishReference', label: 'Finish reference', type: 'text', placeholder: 'Joinery, roof or cladding colour' },
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
