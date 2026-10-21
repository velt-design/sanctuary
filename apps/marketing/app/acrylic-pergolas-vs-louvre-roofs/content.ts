import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

export const COMPARISON_ROUTE = '/acrylic-pergolas-vs-louvre-roofs';

export const roofComparison = [
  { label: 'Daylight', acrylic: 'Light passes through the roofing. Tint, opacity and any solid roof zones are selected when you design it.', louvre: 'With solid blades, daylight enters through the gaps when they are open. Changing the angle changes the opening.' },
  { label: 'Shade', acrylic: 'Shade comes from the chosen roof material, framing and any planned solid zones or screens.', louvre: 'Tilting blades let you adjust overhead shade. The result also depends on the sun’s position and blade direction.' },
  { label: 'Sky view', acrylic: 'Clear acrylic allows a view through the roof, with the sheets and framing still overhead. Opal looks different.', louvre: 'You see between tilted blades. A retracting roof is a different system, so check which type is proposed.' },
  { label: 'Everyday use', acrylic: 'The roof stays in place. There is no roof-opening position to choose; blinds and other accessories operate separately.', louvre: 'You change the blade position using the specified controls. Confirm power, sensors and manual operation where offered.' },
  { label: 'Rain & care', acrylic: 'Check roof pitch, house junctions, flashings and drainage, plus cleaning access for the chosen sheets.', louvre: 'Check the closed-roof arrangement, drainage, operating limits, cleaning access and servicing for moving parts.' },
] as const;

export const roofQuestions = [
  { question: 'Will an acrylic pergola make the room beside it darker?', answer: 'The selected material and tint, roof depth, framing and window positions all matter. Look at the design from inside the house as well as from the garden. Clear and opal acrylic give different views through the roof.' },
  { question: 'Do all louvre roofs open the same way?', answer: 'No. A tilting roof changes the angle of its blades; a retracting system moves them back. Blade materials also vary, including specialist translucent options. Ask to see the exact proposed system in its different positions.' },
  { question: 'Is either roof completely waterproof?', answer: 'Rain performance depends on the complete installation: roof joints, house connections, flashings, gutters and outlets. Open sides can still admit wind-driven rain. Check the proposed assembly and its exposure limits rather than relying on the roof material alone.' },
  { question: 'Which type of roof costs less?', answer: 'Compare complete installed proposals for the same footprint and requirements. Include the structure, roof product, controls, site work, drainage, electrical work and any engineering or consent requirements. A category label alone is not a useful price comparison.' },
  { question: 'Do I need plans before getting in touch?', answer: 'No. A few photos, your suburb and what you want to use the space for are a useful start. Measurements and any proposal you are comparing are welcome, but you do not need a finished design.' },
] as const;

export const acrylicVsLouvreConfig = {
  marker: 'acrylic-pergolas-vs-louvre-roofs',
  route: COMPARISON_ROUTE,
  description: 'Considering louvres? Explore Sanctuary’s fixed acrylic, solid and combination pergolas, with a practical comparison of daylight, shade and everyday use. We do not supply louvre roofs.',
  schemaName: 'Acrylic Pergolas vs Louvre Roofs',
  serviceName: 'Pergola roof option consultation in Auckland',
  serviceType: 'Pergola roof design consultation',
  showGuideNavigation: false,
  hero: {
    image: '/images/project-dairy-flat-03.jpg',
    imageAlt: 'View through a fixed acrylic gable roof towards the sky and garden at Dairy Flat',
    eyebrow: 'Considering a louvre roof?',
    title: 'An acrylic alternative.',
    intro: 'Sanctuary builds fixed acrylic, solid and combination pergolas. We do not supply louvre roofs.',
    primaryCta: 'Discuss a fixed-roof pergola',
    secondaryCta: 'Compare everyday use',
    secondaryHref: '#roof-comparison',
    proof: [],
  },
  blocks: [],
  form: {
    ariaLabel: 'Pergola roof comparison enquiry form',
    eyebrow: 'Your space',
    heading: 'Let’s talk about a fixed roof.',
    intro: 'We can help you plan an acrylic, solid or combination pergola. Tell us about the light, the house and how you want to use the space. Photos and any proposal you are comparing are welcome, but not required.',
    submitLabel: 'Send project brief',
    messageLabel: 'What would you like the roof to change?',
    messagePlaceholder: 'Tell us about the space and what matters to you.',
    briefFields: [
      { name: 'externalProposal', label: 'External proposal', type: 'select', options: ['None yet', 'Initial proposal', 'Drawings and specification', 'Unsure'] },
      { name: 'comparisonPriorities', label: 'Main comparison priorities', type: 'text', placeholder: 'Daylight, shade, sky view or everyday use', wide: true },
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
