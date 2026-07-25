type PergolaGuide = {
  number: string;
  href: string;
  title: string;
  prompt: string;
  summary: string;
  role: 'service' | 'product-guide' | 'decision-guide';
  label: 'Service guide' | 'Planning guide' | 'Material guide' | 'Roof-form guide' | 'Cost guide' | 'Integration guide' | 'Comparison guide';
};

type PergolaGuideChapter = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  introduction: string;
  guides: PergolaGuide[];
};

export const pergolaGuideEditorialReview = {
  reviewer: 'Sanctuary Pergolas',
  date: '2026-07-22',
  dateLabel: '22 July 2026',
  note: 'Pricing, warranty and technical performance remain subject to current written project and product evidence.',
} as const;

export const pergolaGuideChapters: PergolaGuideChapter[] = [
  {
    id: 'plan-the-project',
    number: '01',
    eyebrow: 'Start with the whole brief',
    title: 'Plan the project',
    introduction:
      'Use these guides when the important decision is the overall room, site response or project type, rather than one isolated component.',
    guides: [
      {
        number: '01',
        href: '/pergolas-auckland',
        title: 'Pergolas Auckland',
        prompt: 'Begin with the whole brief',
        summary:
          'A broad planning guide to roof form, daylight, weather edges and the relationship between a pergola and the home.',
        role: 'service',
        label: 'Service guide',
      },
      {
        number: '02',
        href: '/custom-pergolas-auckland',
        title: 'Custom Pergolas Auckland',
        prompt: 'Resolve a site-specific design',
        summary:
          'How a bespoke pergola develops from the house, outdoor area, constraints and way the finished space should be used.',
        role: 'service',
        label: 'Service guide',
      },
      {
        number: '03',
        href: '/outdoor-rooms-auckland',
        title: 'Outdoor Rooms Auckland',
        prompt: 'Design the life below the roof',
        summary:
          'Plan a more complete outdoor room around shelter, warmth, lighting, services, furniture and changing seasons.',
        role: 'service',
        label: 'Planning guide',
      },
      {
        number: '04',
        href: '/commercial-pergolas-auckland',
        title: 'Commercial Pergolas Auckland',
        prompt: 'Make more of the venue',
        summary:
          'How Sanctuary designs and builds commercial pergolas while coordinating engineering, consent and trades from the venue brief through installation.',
        role: 'service',
        label: 'Service guide',
      },
    ],
  },
  {
    id: 'choose-form-and-structure',
    number: '02',
    eyebrow: 'Shape the architecture',
    title: 'Choose form and structure',
    introduction:
      'Use these guides to understand how frame material and roof geometry influence proportion, drainage, volume and connection to the building.',
    guides: [
      {
        number: '05',
        href: '/aluminium-pergolas-auckland',
        title: 'Aluminium Pergolas Auckland',
        prompt: 'Understand the frame',
        summary:
          'Explore how aluminium structure, spans, posts, finishes and junctions shape an architectural pergola.',
        role: 'product-guide',
        label: 'Material guide',
      },
      {
        number: '06',
        href: '/gable-pergolas-auckland',
        title: 'Gable Pergolas Auckland',
        prompt: 'Plan ridge, eaves and volume',
        summary:
          'Consider the height, symmetry, light and spatial character created by a roof rising to a central ridge.',
        role: 'product-guide',
        label: 'Roof-form guide',
      },
      {
        number: '07',
        href: '/pitched-pergolas-auckland',
        title: 'Pitched Pergolas Auckland',
        prompt: 'Follow one roof plane',
        summary:
          'Understand when a single-slope roof can make a clean connection while managing height, fall, drainage and daylight.',
        role: 'product-guide',
        label: 'Roof-form guide',
      },
    ],
  },
  {
    id: 'compare-scope-and-components',
    number: '03',
    eyebrow: 'Test the important trade-offs',
    title: 'Compare scope and components',
    introduction:
      'Use these guides when cost, roof behaviour or a changing edge is the decision that will set the direction of the wider design.',
    guides: [
      {
        number: '08',
        href: '/pergola-cost-auckland',
        title: 'Pergola Cost Auckland',
        prompt: 'Compare scope before price',
        summary:
          'See which design and delivery choices shape project cost, and what information makes an early estimate more useful.',
        role: 'decision-guide',
        label: 'Cost guide',
      },
      {
        number: '09',
        href: '/pergolas-with-blinds',
        title: 'Pergolas With Blinds',
        prompt: 'Plan the changing edge',
        summary:
          'Consider blinds as part of the architecture, including wind, low sun, privacy, openings and how the edge works when raised.',
        role: 'product-guide',
        label: 'Integration guide',
      },
      {
        number: '10',
        href: '/acrylic-pergolas-vs-louvre-roofs',
        title: 'Acrylic Pergolas vs Louvre Roofs',
        prompt: 'Compare roof behaviour',
        summary:
          'Compare fixed acrylic roofing and opening louvres through daylight, rain detailing, ventilation, maintenance and use.',
        role: 'decision-guide',
        label: 'Comparison guide',
      },
    ],
  },
];

export const pergolaGuides = pergolaGuideChapters
  .flatMap((chapter) => chapter.guides)
  .sort((left, right) => left.number.localeCompare(right.number));

export function findPergolaGuide(href: string) {
  return pergolaGuides.find((guide) => guide.href === href);
}
