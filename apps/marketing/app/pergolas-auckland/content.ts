export const residentialProjectProof = [
  {
    slug: 'warkworth-outdoor-room',
    label: 'Freestanding gable outdoor room',
    summary: 'A mixed-roof gable room with cedar lining, deck and fireplace.',
    facts: ['5.0 x 6.0 m footprint', '30 m² freestanding room'],
  },
  {
    slug: 'tindalls-bay-pavilion',
    label: 'Mixed roofing around a complex home',
    summary: 'Acrylic and solid zones cover a layered patio and carport.',
    facts: ['108 m² patio and carport scope', 'Mixed roof and edge treatments'],
  },
  {
    slug: 'muriwai-courtyard',
    label: 'A new hip roof on a familiar footprint',
    summary: 'A new hip roof keeps the courtyard’s established footprint.',
    facts: ['8.0 x 5.0 m footprint', '40 m² courtyard cover'],
  },
] as const;

export const residentialProcessSteps = [
  {
    title: 'Share the site',
    copy: 'Send the suburb, wide photos, rough dimensions and intended use.',
  },
  {
    title: 'Review the fit',
    copy: 'We review the connection, form, posts, drainage and access.',
  },
  {
    title: 'Confirm the scope',
    copy: 'The design, products, inclusions and checks become one proposal.',
  },
] as const;

export const investmentDrivers = [
  {
    title: 'Size and structure',
    text: 'Width, height, spans and posts shape the structure.',
  },
  {
    title: 'Roof and connection',
    text: 'Roofing, attachment and foundations respond to the house.',
  },
  {
    title: 'Drainage and site',
    text: 'Drainage, exposure, access and existing conditions affect the work.',
  },
  {
    title: 'Integrated options',
    text: 'Screens, lighting, heating and approvals add scope.',
  },
] as const;

export const roofFormLinks = [
  {
    title: 'Pitched',
    href: '/products/pergolas/pitched',
    text: 'One roof plane with one drainage direction.',
  },
  {
    title: 'Gable',
    href: '/products/pergolas/gable',
    text: 'A central ridge adds height.',
  },
  {
    title: 'Hip',
    href: '/products/pergolas/hip',
    text: 'Several planes suit corners and courtyards.',
  },
  {
    title: 'Box perimeter',
    href: '/products/pergolas/box-perimeter',
    text: 'A level outer frame hides fall and drainage.',
  },
] as const;

export const planningLinks = [
  {
    title: 'Complex or architect-led work',
    text: 'For difficult connections, restricted posts and changing levels.',
    href: '/custom-pergolas-auckland',
    label: 'Open the custom pergola guide',
  },
  {
    title: 'Compare a complete scope',
    text: 'See what shapes cost and makes proposals comparable.',
    href: '/pergola-cost-auckland',
    label: 'Open the cost guide',
  },
  {
    title: 'Plan the room below',
    text: 'Coordinate use, furniture, edges and services.',
    href: '/outdoor-rooms-auckland',
    label: 'Open the outdoor room guide',
  },
] as const;

export const siteSpecificChecks = [
  {
    title: 'Structure follows verified conditions',
    text: 'Structure depends on the measured site and final design.',
  },
  {
    title: 'Approval follows the final design',
    text: 'Consent and property checks follow the final design.',
  },
  {
    title: 'Products stay product-specific',
    text: 'Use written information for the exact products selected.',
  },
] as const;

export const faqItems = [
  {
    question: 'Which pergola form should I start with?',
    answer: [
      'Start with the house, available height, drainage and intended use.',
    ],
  },
  {
    question: 'Should the roof be acrylic or solid?',
    answer: [
      'Acrylic, solid and mixed roofs create different daylight and shade. Review the choice against the house and selected products.',
    ],
  },
  {
    question: 'Can the pergola attach to the house?',
    answer: [
      'Often, but support, cladding, flashing and drainage need review.',
    ],
  },
  {
    question: 'Can blinds, screens, lighting or heaters be included?',
    answer: [
      'Yes, where they suit the structure and selected products. Plan them before fabrication.',
    ],
  },
  {
    question: 'What should I send for a first assessment?',
    answer: [
      'Send the suburb, wide photos, rough dimensions and intended use.',
    ],
  },
  {
    question: 'Where does Sanctuary work?',
    answer: [
      'Sanctuary is based in Auckland and considers selected projects up to about a three-hour drive away when the scope is a good fit.',
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
