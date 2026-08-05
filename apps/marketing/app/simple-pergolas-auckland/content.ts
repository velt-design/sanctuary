export const simpleCoverStandard = [
  {
    number: '01',
    title: 'Proportioned for the house',
    text: 'Roof height, frame and post positions are set to sit calmly against the home.',
  },
  {
    number: '02',
    title: 'Connection and drainage resolved',
    text: 'The house junction, flashings, roof fall, guttering and outlets are resolved together.',
  },
  {
    number: '03',
    title: 'Built and finished by Sanctuary',
    text: 'Sanctuary Pergolas offers a 10-year warranty on workmanship.',
  },
] as const;

export const simpleCoverInclusions = [
  'Pitched aluminium frame and acrylic roofing',
  'Confirmed house and post connections, flashings and drainage',
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
    text: 'Select a standard powder-coat colour to settle the frame into the house or make it deliberate.',
    note: 'The exact finish is confirmed in your proposal.',
  },
  {
    number: '03',
    title: 'Optional blinds',
    text: 'Add blinds to selected sides for low sun, privacy or an exposed edge.',
    note: 'Opening size, fabric and exposure still need to be checked.',
  },
] as const;

export const simpleCoverBoundary = {
  simple: [
    'One pitched acrylic roof within the calculator limits',
    'A straightforward house connection and workable site access',
  ],
  custom: [
    'Different roof forms, unusual geometry or complex connections',
    'A project outside the Simple limits or needing integrated features',
  ],
} as const;
