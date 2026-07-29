export const tintOptions = [
  {
    name: 'Clear acrylic',
    tone: 'clear',
    visual: 'Transparent with the clearest view of the sky.',
    daylight: 'Usually the highest relative daylight of these options.',
    assess: 'Direct sun, glare, roof depth and nearby windows.',
  },
  {
    name: 'Light grey acrylic',
    tone: 'light-grey',
    visual: 'A subtle tint that remains visually open.',
    daylight: 'Usually retains more daylight than a darker tint.',
    assess: 'Sun timing, house colour and existing shade.',
  },
  {
    name: 'Dark grey acrylic',
    tone: 'dark-grey',
    visual: 'A darker roof with a stronger shaded character.',
    daylight: 'Allows less daylight through than clear or light grey.',
    assess: 'Nearby rooms, roof area and overcast conditions.',
  },
  {
    name: 'Opal acrylic',
    tone: 'opal',
    visual: 'Diffused light without a clear view through the roof.',
    daylight: 'Creates softer, more even light, subject to the product.',
    assess: 'Sky-view priorities, orientation and adjoining windows.',
  },
] as const;

export const comfortFactors = [
  'Orientation and sun path',
  'Acrylic tint and roof area',
  'Adjoining windows and rooms',
  'Air movement through open sides',
  'Low-angle sun at the edges',
  'Seating position and intended use',
] as const;

export const weatherDetails = [
  {
    title: 'Roof and drainage',
    text: 'Coordinate the selected roofing, fall, joints, gutters, outlets and discharge.',
  },
  {
    title: 'House connection',
    text: 'Support, cladding, clearances and flashings depend on the existing building.',
  },
  {
    title: 'Open edges',
    text: 'Wind-driven rain can enter through open sides. Plan any blind or infill as part of the design.',
  },
] as const;

export const faqItems = [
  {
    question: 'Are acrylic roof pergolas waterproof?',
    answer: [
      'Avoid a universal waterproof claim for an open-sided structure. Rain management depends on the exact roof, pitch, joints, flashings, drainage and installation.',
    ],
  },
  {
    question: 'Will an acrylic pergola make my house dark?',
    answer: [
      'It depends on the tint, roof area, depth, orientation and nearby windows. Review the effect from inside the adjoining rooms.',
    ],
  },
  {
    question: 'Which acrylic tint should I choose?',
    answer: [
      'Choose for the site, sun path, adjoining rooms, roof area and intended use—not the sample colour alone.',
    ],
  },
  {
    question: 'Can acrylic be combined with a solid roof?',
    answer: [
      'Yes, where the selected systems and design permit it. The junction and drainage must be resolved as one roof.',
    ],
  },
] as const;
