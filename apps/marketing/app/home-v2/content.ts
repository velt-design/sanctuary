export const proofPoints = [
  { value: '4', label: 'roof forms' },
  { value: '10', label: 'design guides' },
  { value: '3', label: 'planning chapters' },
  { value: '1', label: 'connected brief' },
] as const;

export const designPrinciples = [
  {
    title: 'Start with the home',
    copy: 'Rooflines, openings, views and circulation set the direction before a pergola form is chosen.',
  },
  {
    title: 'Shape the room',
    copy: 'Shelter, daylight and proportion are resolved around how the outdoor space should feel and function.',
  },
  {
    title: 'Resolve the details',
    copy: 'Structure, drainage, lighting, screens and material junctions are considered as one permanent addition.',
  },
] as const;

export const processSteps = [
  {
    title: 'Enquiry',
    copy: 'Tell us about the site, how you use the space and what you want the new outdoor room to achieve.',
  },
  {
    title: 'Initial estimate',
    copy: 'We prepare an early price range from your dimensions, photos, material direction and preferred roof form.',
  },
  {
    title: 'Site visit and design',
    copy: 'We measure the site and resolve proportion, structure, drainage, views and connection to the home.',
  },
  {
    title: 'Documentation and sign-off',
    copy: 'A clear design pack records dimensions, finishes, lighting and the agreed construction scope.',
  },
  {
    title: 'Manufacture',
    copy: 'Your pergola is prepared for the site with the agreed structural and finish details.',
  },
  {
    title: 'Installation',
    copy: 'The Sanctuary team sets out and builds the structure to the signed-off design and agreed site sequence.',
  },
  {
    title: 'Completion and support',
    copy: 'We complete final checks and provide the care, workmanship and manufacturer information that applies to the project.',
  },
] as const;

export const materialItems = [
  {
    name: 'Aluminium',
    guidance: 'Crisp structure with powder-coated colours selected for the design, site exposure and the home.',
    image: '/images/project-riverhead-gable-02.jpg',
    alt: 'Black aluminium pergola structure in Riverhead',
  },
  {
    name: 'Acrylic roofing',
    guidance: 'Fixed clear, opal or tinted roofing with daylight and solar characteristics tied to the exact sheet.',
    image: '/images/product-gable-01.jpg',
    alt: 'Acrylic roof over an outdoor courtyard',
  },
  {
    name: 'Timber sarking',
    guidance: 'Warm, tactile lining that makes the pergola read as a permanent outdoor room.',
    image: '/images/timber-gable-ceiling.jpg',
    alt: 'Timber sarking beneath a gable pergola',
  },
  {
    name: 'Integrated features',
    guidance: 'Lighting, blinds and heating are coordinated when they support how the space will be used.',
    image: '/images/project-warkworth-outdoor-room-04.jpg',
    alt: 'Integrated lighting in a finished Warkworth outdoor room',
  },
] as const;

export const roofForms = [
  {
    title: 'Pitched',
    copy: 'A clean single roof plane coordinated with available height, fall and drainage.',
    href: '/products/pergolas/pitched',
  },
  {
    title: 'Gable',
    copy: 'Height, daylight and a strong centreline for larger outdoor rooms.',
    href: '/products/pergolas/gable',
  },
  {
    title: 'Hip',
    copy: 'Three-sided roof geometry for more complex house connections.',
    href: '/products/pergolas/hip',
  },
  {
    title: 'Box perimeter',
    copy: 'A level architectural edge that conceals the roof fall within.',
    href: '/products/pergolas/box-perimeter',
  },
] as const;

export const featuredProjectSlugs = [
  'warkworth-outdoor-room',
  'dairy-flat-estate',
  'tindalls-bay-pavilion',
  'velskov-forest',
  'goodhome-commercial-terrace',
] as const;
