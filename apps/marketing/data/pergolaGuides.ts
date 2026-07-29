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
    introduction: 'Plan the room, site and project type.',
    guides: [
      {
        number: '01',
        href: '/pergolas-auckland',
        title: 'Pergolas Auckland',
        prompt: 'Begin with the whole brief',
        summary: 'Plan roof form, daylight and weather edges around the home.',
        role: 'service',
        label: 'Service guide',
      },
      {
        number: '02',
        href: '/custom-pergolas-auckland',
        title: 'Custom Pergolas Auckland',
        prompt: 'Resolve a site-specific design',
        summary: 'Resolve difficult connections, levels, posts and project interfaces.',
        role: 'service',
        label: 'Service guide',
      },
      {
        number: '03',
        href: '/outdoor-rooms-auckland',
        title: 'Outdoor Rooms Auckland',
        prompt: 'Design the life below the roof',
        summary: 'Coordinate shelter, furniture, lighting and services.',
        role: 'service',
        label: 'Planning guide',
      },
      {
        number: '04',
        href: '/commercial-pergolas-auckland',
        title: 'Commercial Pergolas Auckland',
        prompt: 'Make more of the venue',
        summary: 'Define Sanctuary’s role, site coordination and delivery scope.',
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
    introduction: 'Compare frame material and roof geometry.',
    guides: [
      {
        number: '05',
        href: '/aluminium-pergolas-auckland',
        title: 'Aluminium Pergolas Auckland',
        prompt: 'Understand the frame',
        summary: 'See how posts, spans, finishes and junctions shape the frame.',
        role: 'product-guide',
        label: 'Material guide',
      },
      {
        number: '06',
        href: '/gable-pergolas-auckland',
        title: 'Gable Pergolas Auckland',
        prompt: 'Plan ridge, eaves and volume',
        summary: 'Plan ridge height, pitch, eaves and gable ends.',
        role: 'product-guide',
        label: 'Roof-form guide',
      },
      {
        number: '07',
        href: '/pitched-pergolas-auckland',
        title: 'Pitched Pergolas Auckland',
        prompt: 'Follow one roof plane',
        summary: 'Plan one roof plane around height, fall and drainage.',
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
    introduction: 'Compare scope, roof behaviour and changing edges.',
    guides: [
      {
        number: '08',
        href: '/pergola-cost-auckland',
        title: 'Pergola Cost Auckland',
        prompt: 'Compare scope before price',
        summary: 'See what shapes cost and makes quotes comparable.',
        role: 'decision-guide',
        label: 'Cost guide',
      },
      {
        number: '09',
        href: '/pergolas-with-blinds',
        title: 'Pergolas With Blinds',
        prompt: 'Plan the changing edge',
        summary: 'Plan one changing edge for low sun, privacy or exposure.',
        role: 'product-guide',
        label: 'Integration guide',
      },
      {
        number: '10',
        href: '/acrylic-pergolas-vs-louvre-roofs',
        title: 'Acrylic Pergolas vs Louvre Roofs',
        prompt: 'Compare roof behaviour',
        summary: 'Compare a Sanctuary fixed roof with an external louvre proposal.',
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
