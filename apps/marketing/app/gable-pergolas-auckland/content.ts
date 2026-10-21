import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const gableQuestions = [
  {
    question: 'What is a gable pergola?',
    answer: ['Two sloping roof planes meet at a central ridge. That gives the covered space height through the middle, with a triangular end that can be left open or infilled.'],
  },
  {
    question: 'Does the pitch need to match the house?',
    answer: ['Not always. A gable can follow the existing roofline or form a separate pavilion. We consider ridge height, eaves, width and pitch together, including the view from inside the house.'],
  },
  {
    question: 'Can a gable be attached or freestanding?',
    answer: ['Both can be considered. An attached roof needs suitable support and carefully resolved cladding, flashing and drainage. A freestanding gable has its own supports and foundations. The measured site determines what is appropriate.'],
  },
  {
    question: 'Can the gable end be open or infilled?',
    answer: ['Yes. An open end keeps the triangular opening clear. An infilled end puts a panel within that frame, as at Dairy Flat. It changes the edge of the space, but does not enclose the open sides or guarantee weather exclusion.'],
  },
  { question: 'Which roof materials work with a gable?', answer: ['Our fixed-roof gables can use acrylic, solid roofing with a timber-lined underside, or a combination. Where you want daylight and shade, the rooms beside the pergola and the view from below help guide the choice.'] },
  { question: 'What if there is not much height above the doors?', answer: ['The eaves, door openings, ridge and house roof need to work together. A gable is not always the best fit. If the available height is tight, compare a single-slope pitched roof and discuss the site with us before settling on a form.'] },
] as const;

export const GABLE_ROUTE = '/gable-pergolas-auckland';
export const gableExamples = [
  { slug: 'dairy-flat-estate', location: 'Dairy Flat', label: 'Acrylic / house-aligned', title: 'Follow the roofline. Keep a view of the sky.',
    image: '/images/project-dairy-flat-03.jpg', alt: 'Clear acrylic roof and triangular infilled gable end beside the house at Dairy Flat', width: 1417, height: 1984,
    text: 'The acrylic gable continues the existing house form over the outdoor area. Clear sheets keep the roof visually open, while the framing gives it a defined outline.',
    detail: 'Infilled gable end. The garden side remains open.', caption: 'Dairy Flat. Aluminium framing and fixed acrylic roofing.', link: 'Explore the Dairy Flat project' },
  { slug: 'warkworth-outdoor-room', location: 'Warkworth', label: 'Combination / freestanding', title: 'A timber ceiling, with daylight alongside.',
    image: '/images/project-warkworth-outdoor-room-04.jpg', alt: 'Warkworth gable with cedar lining, clear acrylic roof strips and a glazed triangular end', width: 3000, height: 2562,
    text: 'At Warkworth, solid roofing and cedar lining sit beside clear acrylic zones. The freestanding gable makes a room beside the house without relying on the house for support.',
    detail: 'Acrylic through the roof and gable ends. Aluminium and steel framing.', caption: 'Warkworth. A completed room with its own agreed deck, fireplace and lighting scope.', link: 'Explore the Warkworth project' },
  { slug: 'riverhead-gable-pavilion', location: 'Riverhead', label: 'Timber-lined / poolside', title: 'Let the ceiling give the space its character.',
    image: '/images/project-riverhead-gable-03.webp', alt: 'Timber sarking following the Riverhead gable roof, with integrated ceiling lights', width: 2400, height: 1792,
    text: 'Timber sarking follows both roof planes at Riverhead. The open triangular end frames the garden, and the ceiling and lighting make a distinct place to sit beside the pool.',
    detail: 'Open gable end. Aluminium framing with steel beams.', caption: 'Riverhead. Timber-lined solid roof and project-specific lighting.', link: 'Explore the Riverhead project' },
] as const;

export const gablePergolasConfig = {
  marker: 'gable-pergolas-auckland',
  route: '/gable-pergolas-auckland',
  description: 'Explore real Auckland gable pergolas with acrylic, timber-lined and combination roofs. Plan the height, light and connection to your home with Sanctuary.',
  showGuideNavigation: false,
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
    image: '/images/project-riverhead-gable-01.jpg',
    imageAlt: 'Complete open gable roof with timber lining above a poolside lounge at Riverhead',
    objectPosition: '50% 50%',
    eyebrow: 'Designed and installed in Auckland',
    title: 'Gable pergolas. Room to look up.',
    intro: 'A roof that rises through the centre, with room for light, timber and an open outlook. Designed to feel part of your home.',
    primaryCta: 'Discuss your gable pergola',
    secondaryCta: 'Explore the roof options',
    secondaryHref: '#gable-projects',
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
      items: gableQuestions,
    },
  ],
  form: {
    ariaLabel: 'Gable pergola project enquiry form',
    eyebrow: 'Start with your home',
    heading: 'Let’s talk about your gable.',
    intro: 'Tell us what you would like to cover and how you want to use it. Photos or plans are helpful, but you do not need measurements or a finished design. We’ll review your enquiry and contact you about the next step.',
    submitLabel: 'Send your enquiry',
    messageLabel: 'What do you have in mind?',
    messagePlaceholder: 'Tell us about the space, the house and what you would like the pergola to change.',
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
