export const residentialProjectProof = [
  {
    slug: 'warkworth-outdoor-room',
    label: 'Freestanding gable outdoor room',
    summary:
      'A gable roof, clear glazing, solid roof zone, cedar lining, deck and fireplace were resolved as one room.',
    facts: ['5.0 x 6.0 m footprint', '30 m² freestanding room'],
  },
  {
    slug: 'tindalls-bay-pavilion',
    label: 'Mixed roofing around a complex home',
    summary:
      'Acrylic and solid roof zones, timber battens and blinds respond to different uses and light conditions.',
    facts: ['108 m² patio and carport scope', 'Mixed roof and edge treatments'],
  },
  {
    slug: 'muriwai-courtyard',
    label: 'A new hip roof on a familiar footprint',
    summary:
      'A hipped aluminium pergola replaces an older structure while keeping the courtyard layout that worked.',
    facts: ['8.0 x 5.0 m footprint', '40 m² courtyard cover'],
  },
] as const;

export const residentialProcessSteps = [
  {
    title: 'Share the site and outcome',
    copy:
      'Send the suburb, wide photos and rough dimensions. Explain how the area should work and what must stay open.',
  },
  {
    title: 'Review fit and constraints',
    copy:
      'Sanctuary assesses the house connection, form, light, posts, drainage, access and open technical questions together.',
  },
  {
    title: 'Confirm design and scope',
    copy:
      'The agreed design, selected products, inclusions, exclusions and project-specific checks become one clear proposal.',
  },
] as const;

export const investmentDrivers = [
  {
    title: 'Size and structure',
    text: 'Width, projection, height, spans and post positions shape material and engineering scope.',
  },
  {
    title: 'Roof and connection',
    text: 'Form, roofing, attachment, flashings and foundations respond to the actual house.',
  },
  {
    title: 'Drainage and site',
    text: 'Fall, gutters, discharge, exposure, access and existing conditions affect the work.',
  },
  {
    title: 'Integrated options',
    text: 'Screens, lighting, heating, electrical work and approvals add scope when required.',
  },
] as const;

export const roofFormLinks = [
  {
    title: 'Pitched',
    href: '/products/pergolas/pitched',
    text: 'One roof plane where height, fall and discharge work together.',
  },
  {
    title: 'Gable',
    href: '/products/pergolas/gable',
    text: 'A central ridge where height and architectural presence are useful.',
  },
  {
    title: 'Hip',
    href: '/products/pergolas/hip',
    text: 'Several roof planes for courtyards, corners or views from several sides.',
  },
  {
    title: 'Box perimeter',
    href: '/products/pergolas/box-perimeter',
    text: 'A level outer frame that contains structure, roof fall and drainage.',
  },
] as const;

export const planningLinks = [
  {
    title: 'Complex or architect-led work',
    text: 'Review difficult connections, irregular sites, restricted posts, spans and changing levels.',
    href: '/custom-pergolas-auckland',
    label: 'Open the custom pergola guide',
  },
  {
    title: 'Compare a complete scope',
    text: 'See which inputs shape investment and what a useful proposal should include.',
    href: '/pergola-cost-auckland',
    label: 'Open the cost guide',
  },
  {
    title: 'Plan the room below',
    text: 'Coordinate use, furniture, light, roof, edges and services as one outdoor room.',
    href: '/outdoor-rooms-auckland',
    label: 'Open the outdoor room guide',
  },
] as const;

export const siteSpecificChecks = [
  {
    title: 'Structure follows verified conditions',
    text: 'Posts, spans and supports depend on dimensions, loads, exposure, existing construction and any engineering required.',
  },
  {
    title: 'Approval follows the final design',
    text: 'Property and consent requirements must be confirmed for the completed project.',
  },
  {
    title: 'Products stay product-specific',
    text: 'Performance, warranty and care information should come from the exact products selected.',
  },
] as const;

export const faqItems = [
  {
    question: 'Which pergola form should I start with?',
    answer: [
      'Start with the house, available height, drainage, area to cover and intended use. Pitched, gable, hip and box-perimeter forms suit different conditions.',
    ],
  },
  {
    question: 'Should the roof be acrylic or solid?',
    answer: [
      'Acrylic can retain more transmitted daylight, while a solid or lined roof creates stronger shade. A combination can place each effect where it is useful.',
      'The choice should be reviewed against orientation, roof depth, adjoining windows and the selected products.',
    ],
  },
  {
    question: 'Can the pergola attach to the house?',
    answer: [
      'Often, but support, cladding, clearances, flashing and drainage need review. A freestanding structure may be more suitable where attachment is constrained.',
    ],
  },
  {
    question: 'Can blinds, screens, lighting or heaters be included?',
    answer: [
      'They can be considered where they suit the structure and exact products. Mounting, wiring, controls, drainage and clearances are best planned before fabrication.',
    ],
  },
  {
    question: 'What should I send for a first assessment?',
    answer: [
      'Send the suburb, wide photos of the house and deck, rough width and projection, and a short explanation of the intended change.',
    ],
  },
] as const;

export const generalRoofPreference = {
  detailKey: 'roofPreference' as const,
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
} as const;
