export const residentialProjectProof = [
  {
    slug: 'tindalls-bay-pavilion',
    label: 'Light where the house needs it',
    summary: 'A patio roof works around the house, combining solid shelter with acrylic over circulation areas.',
    facts: ['Insulated and acrylic roof zones', 'Timber sarking and battens'],
  },
  {
    slug: 'ardmore-box-carport',
    label: 'A clean perimeter',
    summary: 'A box-perimeter roof brings a level edge to an Auckland home.',
    facts: ['Box-perimeter form', 'Acrylic roofing'],
  },
  {
    slug: 'st-heliers-townhouse',
    label: 'Open gable townhouse cover',
    summary: 'Opal acrylic extends the roofline with a custom street-facing gable frame.',
    facts: ['6.0 x 3.0 m footprint', 'Open gable with opal acrylic'],
  },
] as const;

export const residentialProcessSteps = [
  {
    title: 'Share the site',
    copy: 'Share your suburb and what you want the space to do. Add photos or rough dimensions if you have them.',
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
    title: 'Included in the estimate',
    text: 'Your selected structure, roof and any options added in the designer, with standard installation allowances and GST. Your design details define the scope.',
  },
  {
    title: 'Confirmed for your site',
    text: 'Connections, foundations, drainage and access are reviewed against the measured site. Work beyond standard installation allowances may add cost.',
  },
  {
    title: 'Choose what to add',
    text: 'Blinds, screens and lighting are optional. Selected options are included when the designer can price them. New electrical supply, furniture, planting and other landscape work are not included.',
  },
  {
    title: 'Agreed before work starts',
    text: 'Any required engineering, consent and travel are assessed separately. The final proposal confirms scope and price before you commit.',
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
      'Start with your suburb and intended use. Wide photos and rough dimensions help if you have them, but you can enquire without them.',
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
