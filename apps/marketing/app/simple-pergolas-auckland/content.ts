export const simpleCoverFitCriteria = [
  {
    label: 'Projection',
    value: 'Up to 6 m',
    text: 'Measured out from the house, subject to the site and structure.',
  },
  {
    label: 'Post spacing',
    value: 'Generally up to 4 m',
    text: 'Post positions are resolved around the deck, outlook and structure.',
  },
  {
    label: 'House connection',
    value: 'Straightforward',
    text: 'A clear connection without difficult rooflines or unusual interfaces.',
  },
  {
    label: 'Site access',
    value: 'Workable',
    text: 'Enough access to deliver materials and install the pergola safely.',
  },
] as const;

export const simpleCoverStandard = [
  {
    number: '01',
    title: 'Proportioned for the house',
    text: 'The roof height, frame and post positions are set to sit calmly against the home.',
  },
  {
    number: '02',
    title: 'A resolved connection',
    text: 'The house junction, flashings and frame are considered as one finished detail.',
  },
  {
    number: '03',
    title: 'Drainage designed in',
    text: 'Roof fall, guttering and outlets are resolved with the structure rather than added later.',
  },
  {
    number: '04',
    title: 'Built and finished by Sanctuary',
    text: 'Sanctuary Pergolas offers a 10-year warranty on workmanship.',
  },
] as const;

export const simpleCoverInclusions = [
  'A pitched aluminium frame designed around the agreed dimensions',
  'Acrylic roofing, house flashings, guttering and outlets',
  'Post and house connections for the confirmed site',
  'Delivery and installation within the agreed proposal',
] as const;

export const simpleCoverOptions = [
  {
    number: '01',
    title: 'Acrylic roof',
    text: 'Choose clear, grey or opal with the home, outlook and adjoining rooms in mind.',
    note: 'Our acrylic roofing blocks 99% of UV light.',
  },
  {
    number: '02',
    title: 'Frame colour',
    text: 'Select a standard powder-coat colour that settles the frame into the house or makes it deliberate.',
    note: 'The exact finish is confirmed in your proposal.',
  },
  {
    number: '03',
    title: 'Optional blinds',
    text: 'Add a blind to one or more selected sides for low sun, privacy or an exposed edge.',
    note: 'Opening size, fabric and exposure still need to be checked.',
  },
] as const;

export const simpleCoverBoundary = {
  simple: [
    'One straightforward pitched acrylic roof',
    'Within the ground-level or elevated-deck size limits',
    'A clear house connection and workable installation access',
    'Roof only, or optional blinds on selected sides',
  ],
  custom: [
    'Gable, hip, mixed or lined roof forms',
    'Difficult structural or multi-level connections',
    'Integrated fireplaces, extensive services or unusual geometry',
    'A project outside the Simple cover size or access limits',
  ],
} as const;

export const simpleCoverRoofPreference = {
  detailKey: 'acrylicOption' as const,
  options: [
    { label: 'Clear acrylic', value: 'Clear acrylic', roofMaterials: ['acrylic'] },
    { label: 'Light grey acrylic', value: 'Light grey acrylic', roofMaterials: ['acrylic'] },
    { label: 'Dark grey acrylic', value: 'Dark grey acrylic', roofMaterials: ['acrylic'] },
    { label: 'Opal acrylic', value: 'Opal acrylic', roofMaterials: ['acrylic'] },
    { label: 'Unsure: recommend the right option', value: 'Unsure', roofMaterials: [] },
  ],
} as const;
