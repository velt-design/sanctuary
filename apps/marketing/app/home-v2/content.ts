import { buildEnquiryHref } from '@/lib/enquiryContext';

export const homepageDescription =
  'Sanctuary designs, builds and installs bespoke fixed-roof architectural pergolas for Auckland homes and selected commercial projects.';

export const proofPoints = [
  { value: 'Auckland based', label: 'Local design and installation' },
  { value: 'Design & Build', label: 'One team from concept to completion' },
  { value: 'Fixed-roof specialists', label: 'Residential and selected commercial projects' },
] as const;

export const designPrinciples = [
  {
    title: 'Start with the home and site',
    copy: 'Architecture, available space, orientation, exposure, access and connection points set the direction before a pergola form is chosen.',
  },
  {
    title: 'Design around intended use',
    copy: 'Dining, entertaining, shelter, light and privacy shape the layout while open edges remain part of the weather response.',
  },
  {
    title: 'Resolve structure and details together',
    copy: 'Roof form, drainage, materials, lighting, blinds, heating and house connections are considered as one project-specific system.',
  },
] as const;

export const visitorPathways = [
  {
    eyebrow: 'Residential planning',
    title: 'An Auckland pergola for your home',
    copy: 'Start with the home, outdoor area and intended use, then compare forms, roofs and scope.',
    href: '/pergolas-auckland',
    action: 'Plan an Auckland pergola',
    event: 'residential_pathway_click',
  },
  {
    eyebrow: 'Custom and complex',
    title: 'A site that needs a bespoke response',
    copy: 'Explore unusual sites, difficult connections, larger spans and integrated, design-led requirements.',
    href: '/custom-pergolas-auckland',
    action: 'Explore custom pergola design',
    event: 'custom_pathway_click',
  },
  {
    eyebrow: 'Commercial',
    title: 'Cover for a working environment',
    copy: 'Plan hospitality, accommodation, workplace and selected commercial projects around operations and delivery.',
    href: '/commercial-pergolas-auckland#project-details',
    action: 'Discuss a commercial project',
    event: 'commercial_pathway_click',
  },
  {
    eyebrow: 'Professional collaboration',
    title: 'Plans, specifications or an early brief',
    copy: 'Architects, designers and builders can share drawings, concepts, tender information and defined responsibilities.',
    href: buildEnquiryHref({
      enquiryType: 'professional',
      sourcePath: '/',
      sourceComponent: 'pathway',
    }),
    action: 'Send plans or a project brief',
    event: 'professional_pathway_click',
  },
] as const;

export const roofForms = [
  {
    title: 'Pitched',
    copy: 'One restrained roof plane suits sites where available height, fall and drainage support a quieter form.',
    href: '/products/pergolas/pitched',
    image: '/images/pitch-landing.jpg',
    alt: 'Attached pitched pergola following the roofline of a contemporary concrete and timber home',
    objectPosition: '50% 52%',
  },
  {
    title: 'Gable',
    copy: 'A central ridge creates height and can echo related roof geometry across wider outdoor rooms.',
    href: '/products/pergolas/gable',
    image: '/images/gable-landing.jpg',
    alt: 'Symmetrical gable pergola spanning a landscaped courtyard between two wings of a home',
    objectPosition: '50% 48%',
  },
  {
    title: 'Hip',
    copy: 'Several roof planes create a composed geometry for courtyards, corners and more complex rooflines.',
    href: '/products/pergolas/hip',
    image: '/images/hip-landing.jpg',
    alt: 'Hip-roof pergola integrated with the corner of a contemporary home',
    objectPosition: '50% 48%',
  },
  {
    title: 'Box perimeter',
    copy: 'A level outer edge conceals the fall and suits contemporary homes with clean rectangular plans.',
    href: '/products/pergolas/box-perimeter',
    image: '/images/box-landing.jpg',
    alt: 'Box-perimeter pergola with a level rectangular edge beside a modern home',
    objectPosition: '50% 48%',
  },
] as const;

export const roofApproaches = [
  {
    title: 'Acrylic roofing',
    copy: 'Transparent or translucent zones retain daylight, with tint and roof depth selected for the site.',
    href: '/acrylic-roof-pergolas-auckland',
    action: 'Review acrylic roofing',
    image: '/images/project-dairy-flat-02.jpg',
    alt: 'View from below a clear acrylic gable roof transmitting daylight at Dairy Flat',
    objectPosition: '50% 42%',
  },
  {
    title: 'Solid roofing',
    copy: 'Solid zones provide deeper shade and can create a warm, ceiling-like treatment below.',
    href: '/projects/riverhead-gable-pavilion',
    action: 'See a solid-roof project',
    image: '/images/project-riverhead-gable-03.webp',
    alt: 'View from below the timber-lined solid roof and integrated lighting at Riverhead',
    objectPosition: '50% 50%',
  },
  {
    title: 'Combination roofing',
    copy: 'Transparent and solid zones place daylight and shelter where each is most useful.',
    href: '/projects/tindalls-bay-pavilion',
    action: 'See a combination-roof project',
    image: '/images/project-warkworth-outdoor-room-04.jpg',
    alt: 'Clear acrylic roof strips transitioning into cedar-lined solid roof zones at Warkworth',
    objectPosition: '50% 25%',
  },
] as const;

export const integratedOptions = [
  {
    title: 'Blinds and screens',
    copy: 'Exposure, opening size, mounting, enclosure and the selected system determine what edge protection is appropriate. Open-sided pergolas remain affected by wind-driven rain.',
    href: '/pergolas-with-blinds',
    action: 'Explore pergola blinds',
  },
  {
    title: 'Integrated lighting',
    copy: 'Fittings, channels, drivers, wiring and switching can be coordinated with the frame and ceiling where the design and electrical scope allow.',
    href: '/products/lighting-heating/downlights',
    action: 'Explore integrated lighting',
  },
  {
    title: 'Heating',
    copy: 'Heater selection depends on the area, mounting position, clearances, power and intended use. The exact product requirements are checked before installation.',
    href: '/products/lighting-heating/patio-heaters',
    action: 'Explore patio heating',
  },
] as const;

export const selectedProjectProfiles = [
  {
    slug: 'dairy-flat-estate',
    configuration: 'Attached gable extension',
    roofApproach: 'Acrylic roof',
  },
  {
    slug: 'tindalls-bay-pavilion',
    configuration: 'Layered patio and carport',
    roofApproach: 'Combination roof',
  },
  {
    slug: 'velskov-forest',
    configuration: 'Freestanding pitched structure',
    roofApproach: 'Commercial setting',
  },
  {
    slug: 'goodhome-commercial-terrace',
    configuration: 'Attached two-zone gable',
    roofApproach: 'Acrylic roof',
  },
] as const;

export const processSteps = [
  {
    title: 'Share the initial brief',
    copy: 'Send the suburb, project photos, approximate dimensions, intended use and any preferred form or roof approach.',
  },
  {
    title: 'Initial assessment',
    copy: 'Sanctuary reviews the information, identifies a likely approach and may provide an indicative price range where the brief allows.',
  },
  {
    title: 'Site review and design development',
    copy: 'The home, site, measurements, exposure, connections, access and project requirements are assessed together.',
  },
  {
    title: 'Documented scope, approval and scheduling',
    copy: 'The agreed design, materials, inclusions, exclusions, price, current programme and applicable warranty information are confirmed before manufacture or site work proceeds.',
  },
  {
    title: 'Manufacture, installation and handover',
    copy: 'The pergola is prepared, installed by the Sanctuary team and handed over with the care and warranty information that applies.',
  },
] as const;

export const reviewAuthors = ['Scott Fitchett', 'Kate Walker', 'Rod Clough'] as const;

export const guidePathways = [
  {
    title: 'What affects pergola cost?',
    copy: 'See which site, structure and finish decisions shape the investment.',
    href: '/pergola-cost-auckland',
  },
  {
    title: 'Fixed roof or opening louvres?',
    copy: 'Compare permanent fixed-roof shelter with an opening-roof proposal.',
    href: '/acrylic-pergolas-vs-louvre-roofs',
  },
  {
    title: 'Planning the complete outdoor room',
    copy: 'Coordinate the roof, comfort, use and adjoining home as one brief.',
    href: '/outdoor-rooms-auckland',
  },
] as const;

export const finalEnquiryChecklist = [
  'Project suburb',
  'Photographs of the site and adjoining home',
  'Approximate width and projection',
  'How the space should be used',
  'Preferred form or roof approach, if known',
  'Plans or sketches, where available',
] as const;
