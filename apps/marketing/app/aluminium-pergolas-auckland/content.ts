import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'Why use aluminium for a custom pergola frame?', answer: ['Aluminium can form clean, precise lines across posts, rafters, gutters and perimeter details. The value still depends on how those parts are proportioned and connected for the specific design.', 'The exact profiles, finish and any steel used within the structure should be identified in the project scope.'] },
  { question: 'Are Sanctuary aluminium pergolas made to standard sizes?', answer: ['No. Sanctuary develops bespoke pergolas around the house, site and intended use. Dimensions, roof form, post positions, roof material and finish are resolved for the actual project.'] },
  { question: 'Can aluminium pergolas use acrylic and solid roofing?', answer: ['Yes, acrylic, solid and combination roof approaches can be considered where they suit the design. The frame, fall, drainage, junctions and visual effect need to be coordinated with the selected roofing.', 'Product-specific information should be confirmed for the final selection.'] },
  { question: 'Can steel be used with an aluminium pergola?', answer: ['Some Sanctuary project records include aluminium framing with steel structural members where the design required them. Whether steel is needed depends on the completed structure, spans, loads and engineering.', 'The quotation should make the structural materials and finish clear.'] },
  { question: 'What colours are available for an aluminium pergola?', answer: ['Frame colour is selected as part of the project finish. The useful question is how the colour relates to joinery, roofing, cladding and the visual weight of the structure.', 'Current coating systems, colour availability, warranties and any site-specific limitations should be confirmed for the selected specification.'] },
  { question: 'Is aluminium suitable for a coastal Auckland site?', answer: ['Coastal exposure should be identified early because site conditions can affect material, finish, detailing and maintenance requirements.', 'Suitability, coating performance, exclusions and care instructions must be confirmed against the actual site and selected products rather than assumed from the material name alone.'] },
  { question: 'How far can an aluminium pergola span without posts?', answer: ['A span or post-free outcome cannot be confirmed generically. It depends on dimensions, roof form, loads, exposure, support conditions, member selection and any required engineering.', 'Share the site and desired openings first so the feasible arrangement can be assessed.'] },
  { question: 'How should an aluminium pergola be maintained?', answer: ['Follow the written care information supplied for the exact frame finish, roof products and accessories. Site exposure may change the recommended frequency or method.', 'Safe access and product-approved cleaning methods should be confirmed before maintenance work begins.'] },
] as const;

export const aluminiumPergolasConfig = {
  marker: 'aluminium-pergolas-auckland', route: '/aluminium-pergolas-auckland',
  description: 'Explore aluminium pergolas in Auckland. Understand frame proportion, roof integration, finish, structure and project scope before requesting a site-specific assessment.',
  schemaName: 'Aluminium Pergolas Auckland', serviceName: 'Custom aluminium pergola design and installation in Auckland', serviceType: 'Aluminium pergola design and installation',
  hero: {
    image: '/images/project-ardmore-carport-03.jpg', imageAlt: 'Detailed aluminium rafters and custom pergola framing in Auckland', objectPosition: '50% 42%',
    eyebrow: 'Aluminium pergolas in Auckland', title: 'The frame sets the rhythm long before the roof is noticed',
    intro: 'Aluminium gives a pergola its posts, rafters, edges and junctions. Sanctuary designs those lines around the house and outdoor room, then coordinates the roofing, drainage and integrated options within the same structure.',
    primaryCta: 'Send the project outline', secondaryCta: 'Read the frame decisions', secondaryHref: '#frame-decisions',
    proof: ['Bespoke aluminium geometry', 'Roof and drainage integrated', 'Finish considered with the home'],
  },
  blocks: [
    { kind: 'split-intro', id: 'aluminium-role', eyebrow: 'Material is not the design', title: 'Aluminium provides the language. Proportion decides how it speaks.', paragraphs: [
      'A dark frame can feel light when its openings, posts and roof edge are carefully placed. The same material can feel heavy when every member is treated in isolation.',
      'That is why the first questions are architectural. Where should the eye travel? Which doors and paths must stay clear? How should the roof meet the house? Where can drainage sit without becoming the dominant detail?',
      'Profile, colour and finish matter, but they work best after the frame has a clear relationship to the site.',
    ] },
    { kind: 'numbered-cards', id: 'frame-outcomes', eyebrow: 'What a resolved frame achieves', title: 'Structure, openness and order should arrive together', intro: 'The useful outcome is not aluminium on its own. It is a frame that supports the roof while organising the space below.', items: [
      { title: 'Open the right sightlines', text: 'Post and beam locations should respect doors, views, circulation and the furniture layout, subject to the feasible structure.' },
      { title: 'Give the roof a clear edge', text: 'Rafters, gutters, perimeter beams and flashings need a deliberate relationship so the roof reads as one coherent form.' },
      { title: 'Coordinate what comes later', text: 'Blinds, screens, lighting, heating and wiring are easier to integrate when their positions are considered with the frame.' },
    ] },
    { kind: 'editorial-image', id: 'frame-decisions', tone: 'neutral', eyebrow: 'Read the frame at four scales', title: 'A clean line is the result of several practical decisions', image: { src: '/images/project-st-heliers-02.jpg', alt: 'Custom aluminium gable-end framing and pergola connection at an Auckland townhouse', objectPosition: '50% 50%' }, lead: 'From the whole silhouette to the smallest junction, the frame should explain how the pergola belongs.', items: [
      { title: 'Silhouette', text: 'Pitched, gable, hip and box-perimeter forms create different height, shadow and presence beside the home.' },
      { title: 'Structural rhythm', text: 'Posts, rafters and beams establish the openings and repetition seen from the deck and adjoining rooms.' },
      { title: 'House junction', text: 'Support, cladding, roof edges, flashings and clearances shape how an attached structure meets the building.' },
      { title: 'Finish and hardware', text: 'Colour, visible fixings, drainage and accessory mounts influence whether the detailed result feels calm or cluttered.' },
    ] },
    { kind: 'projects', id: 'aluminium-projects', eyebrow: 'Aluminium in different architectural roles', title: 'The frame changes because the project changes', intro: 'These completed projects use aluminium within different forms, roof materials and site relationships.', items: [
      { slug: 'dairy-flat-estate', label: 'Roofline-led gable extension', summary: 'An 8.6 by 3.3 metre aluminium frame follows the house form while acrylic roofing and a gable-end infill complete the outdoor area.', facts: ['8.6 x 3.3 m footprint', '3.0 m high gable'] },
      { slug: 'st-heliers-townhouse', label: 'A visible custom gable end', summary: 'A 6.0 by 3.0 metre open gable uses bespoke aluminium end framing to give the street-facing addition a deliberate identity.', facts: ['18 m² covered area', 'Custom gable-end framing'] },
      { slug: 'ardmore-box-carport', label: 'Aluminium within a steel-supported frame', summary: 'Aluminium rafters and guttering sit with steel members, acrylic roofing and a box perimeter across a 54.3 square metre vehicle cover.', facts: ['8.77 x 6.19 m footprint', 'Steel PFCs with aluminium rafters'] },
      { slug: 'warkworth-outdoor-room', label: 'Frame for a complete outdoor room', summary: 'Aluminium and steel support a 5.0 by 6.0 metre gable room with acrylic glazing, solid roofing, cedar lining and integrated elements.', facts: ['30 m² freestanding room', '4.1 m overall height'] },
    ] },
    { kind: 'decision-cards', id: 'aluminium-specification', tone: 'warm', eyebrow: 'Specify the complete assembly', title: 'Four aluminium decisions that should not be separated', intro: 'A confident finish comes from knowing how the visible frame, hidden structure and attached systems work together.', items: [
      { title: 'Profiles and spans', outcome: 'Member sizes and layouts suited to the roof form and required openings.', consider: 'Dimensions, loads, exposure, supports and engineering for the completed design.' },
      { title: 'Roof and drainage', outcome: 'Rafters, fall, gutters, downpipes and flashings coordinated as one water-management path.', consider: 'Selected roofing, junctions, overflow approach, discharge and maintenance access.' },
      { title: 'Colour and coating', outcome: 'A finish selected in relation to the home and the visual weight of the frame.', consider: 'Current system, colour availability, site exposure, written warranty, exclusions and care information.' },
      { title: 'Integrated features', outcome: 'Mounting and service routes planned within the structure.', consider: 'Blind cassettes, screens, lighting, heating, wiring, controls and clearances before fabrication.' },
    ] },
    { kind: 'dark-cards', id: 'aluminium-claims', eyebrow: 'Keep material claims precise', title: 'The selected specification matters more than a generic promise about aluminium', intro: 'Performance and suitability depend on the whole assembly, site and written product information.', items: [
      { title: 'Do not promise a universal span', text: 'The feasible opening depends on the design, loads, support conditions, member selection and engineering.' },
      { title: 'Do not generalise coastal performance', text: 'Exposure, coating system, detailing, maintenance and product exclusions need to be checked for the actual property.' },
      { title: 'Do not detach warranty from product', text: 'The final scope should name the exact frame finish, roof products and current written warranties that apply.' },
    ], links: [{ href: '/custom-pergolas-auckland', label: 'Review the custom design approach' }, { href: '/pergolas-auckland', label: 'Review the broad planning guide' }] },
    { kind: 'link-cards', id: 'aluminium-next-decisions', tone: 'neutral', eyebrow: 'Continue the specification', title: 'Explore form, complexity and cost in more detail', items: [
      { title: 'Compare gable and pitched forms', text: 'See how ridge, pitch, fall and available height change the role of the aluminium frame.', href: '/gable-pergolas-auckland', linkLabel: 'Open the form guides' },
      { title: 'Resolve difficult connections', text: 'Use the custom guide for restricted posts, longer openings, changing levels and renovation coordination.', href: '/custom-pergolas-auckland', linkLabel: 'Open the custom guide' },
      { title: 'Compare complete scope', text: 'Review inclusions, exclusions and the information needed for a useful estimate in the Pergola Cost guide.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
    ] },
    { kind: 'faq', id: 'aluminium-faq', tone: 'elevated', eyebrow: 'Material questions in context', title: 'What to confirm before specifying an aluminium pergola', intro: 'These answers stay general until the site, structure, finish and exact products are known.', items: faqItems },
  ],
  mobileDisclosureGroups: [
    { id: 'aluminium-outcomes-detail', summary: 'What a resolved aluminium frame achieves', blockIds: ['frame-outcomes'] },
    { id: 'aluminium-specification-detail', summary: 'How the aluminium specification is resolved', blockIds: ['aluminium-specification'] },
    { id: 'aluminium-planning-support', summary: 'Aluminium planning links and common questions', blockIds: ['aluminium-next-decisions', 'aluminium-faq'] },
  ],
  finalCta: { eyebrow: 'Start with the openings', title: 'Show where the frame needs to be quiet', text: 'Photos of doors, views, eaves and circulation are more useful than a preferred profile on its own. Share the whole setting so the frame can be considered in context.', button: 'Send the project outline', checklistTitle: 'Include if available', checklist: ['Project suburb', 'Wide site and house photos', 'Views from adjoining rooms', 'Rough width, depth and height', 'Doors and paths to keep clear', 'Preferred roof effect, if known', 'Finish references from the home', 'Plans or sketches'] },
  form: { ariaLabel: 'Aluminium pergola project enquiry form', eyebrow: 'Show the frame context', heading: 'Send your aluminium pergola outline', intro: 'Add photos, rough dimensions and the openings the design needs to protect. You can leave the roof form and material undecided.', submitLabel: 'Send the project outline', messageLabel: 'What should the frame resolve?', messagePlaceholder: 'Describe the openings, connections, views or circulation that should shape the post and beam layout.', briefFields: [
    { name: 'openingPriorities', label: 'Openings and post positions to protect', type: 'textarea', placeholder: 'Note doors, paths, views, furniture or vehicle access that should remain clear.', wide: true },
    { name: 'finishReference', label: 'Existing finish reference', type: 'text', placeholder: 'For example: window joinery, roof or cladding colour' },
  ], roofPreference: { label: 'Possible roof approach', detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
