import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'What makes a covered area an outdoor room?', answer: ['An outdoor room is planned around use, circulation, furniture and the relationship to the home, not only around the area beneath a roof.', 'Roofing, structure, edges, lighting, heating and other features are selected to support that complete spatial brief.'] },
  { question: 'Can an outdoor room be attached or freestanding?', answer: ['Both can be considered. An attached room may continue directly from the home, while a freestanding pavilion can create an independent destination nearby.', 'Support, weather junctions, services, drainage and access need to be resolved for the chosen arrangement.'] },
  { question: 'Which roof is best for an outdoor room?', answer: ['Acrylic, solid and combination roofs create different light, shade and ceiling conditions. Gable, pitched, hip and box-perimeter forms also shape volume differently.', 'The useful choice depends on the activities below, adjoining-room daylight, orientation and desired character.'] },
  { question: 'Can an outdoor room include blinds or screens?', answer: ['Blinds, acrylic infill panels and slat screens can be considered where wind, low sun or privacy affects an edge.', 'More enclosure also changes outlook, airflow and how the room feels, so each edge should be decided deliberately.'] },
  { question: 'Can lighting and heating be integrated?', answer: ['Lighting and heating can be considered where they suit the structure and selected products. Mounting positions, wiring, controls, clearances and trade responsibilities should be planned before fabrication.'] },
  { question: 'Can a fireplace or outdoor kitchen be part of the design?', answer: ['Completed Sanctuary projects include broader outdoor-room work such as a fireplace and deck. Suitability for a new project depends on scope, professional coordination, clearances, services and any approvals required.', 'Include these ambitions early so the pergola structure and room layout can be planned around them.'] },
  { question: 'Will an outdoor room keep out all weather?', answer: ['An overhead roof provides cover from rain landing above, but open edges remain exposed to wind-driven rain, low sun and changing conditions.', 'Blinds or infill may add edge protection, but no open-sided room should be described as fully enclosed without a project-specific design.'] },
  { question: 'What should I send to start planning an outdoor room?', answer: ['Share the suburb, wide photos, rough dimensions and a list of the activities and furniture the room needs to support.', 'Interior views, plans and notes about wind, sun, privacy, services or existing structures make the first design conversation more useful.'] },
] as const;

export const outdoorRoomsConfig = {
  marker: 'outdoor-rooms-auckland', route: '/outdoor-rooms-auckland',
  description: 'Plan an outdoor room in Auckland around dining, lounging, light, shelter and the home. Explore roof, edge, lighting and scope decisions with Sanctuary.',
  schemaName: 'Outdoor Rooms Auckland', serviceName: 'Custom outdoor room design and installation in Auckland', serviceType: 'Outdoor room and pergola design and installation',
  hero: { image: '/images/project-warkworth-outdoor-room-02.jpg', imageAlt: 'Cedar-lined custom outdoor room with lounge seating and integrated lighting', objectPosition: '50% 42%', eyebrow: 'Outdoor rooms in Auckland', title: 'Begin with the life inside the room, not the roof above it', intro: 'Sanctuary plans the structure around what should happen below it: dining, lounging, circulation, views and time together. The roof, edges, light and integrated features then support that use without losing the connection to the home and garden.', primaryCta: 'Describe the room you need', secondaryCta: 'Plan the layers', secondaryHref: '#room-layers', proof: ['Use leads the layout', 'Roof and edges planned together', 'Details coordinated before installation'] },
  blocks: [
    { kind: 'split-intro', id: 'room-not-cover', eyebrow: 'More than an area under cover', title: 'A roof creates shelter. A room needs relationships.', paragraphs: [
      'The table needs clearance around it. The barbecue needs a sensible position. Doors need to open, paths need to stay obvious and the main view should still feel available from inside the house.',
      'An outdoor room brings these decisions into one plan. It considers the ceiling above, the boundaries around, the ground below and the house beside it.',
      'That is how a covered space becomes somewhere with a clear purpose rather than leftover furniture placed beneath a roof.',
    ] },
    { kind: 'numbered-cards', id: 'room-use', eyebrow: 'Name the room before drawing it', title: 'Three activities can organise the whole plan', intro: 'The exact mix differs by household, but the layout should make priorities visible.', items: [
      { title: 'Everyday dining', text: 'Place the table, doors and cooking area so normal movement works without squeezing behind posts or crossing service zones.' },
      { title: 'A place to settle', text: 'Orient lounge seating toward the garden, view, fireplace or conversation, then decide which edges need protection and which should stay open.' },
      { title: 'Movement between inside and out', text: 'Protect thresholds, routes and sightlines so the new room strengthens the connection rather than blocking it.' },
    ] },
    { kind: 'editorial-image', id: 'room-layers', tone: 'neutral', eyebrow: 'Plan the room in layers', title: 'Four boundaries shape how the space feels and works', image: { src: '/images/project-riverhead-gable-03.png', alt: 'Timber ceiling, lighting and framed view within an Auckland outdoor room', objectPosition: '50% 20%' }, lead: 'The roof is only one of the surfaces that define comfort and character.', items: [
      { title: 'Above', text: 'Roof form, material, lining and lighting determine volume, daylight, shade and the ceiling character.' },
      { title: 'Around', text: 'Open views, blinds, infill and screens establish the balance between outlook, protection, privacy and air movement.' },
      { title: 'Below', text: 'Deck, paving, levels and drainage influence furniture, circulation, thresholds and how the structure meets the ground.' },
      { title: 'Beside', text: 'Doors, windows, cladding and indoor rooms decide how the new space connects back to the home.' },
    ] },
    { kind: 'projects', id: 'outdoor-room-projects', eyebrow: 'Rooms with different centres of gravity', title: 'The brief changes the architecture', intro: 'These completed projects organise roof, frame and integrated elements around distinct uses.', items: [
      { slug: 'warkworth-outdoor-room', label: 'Freestanding room with hearth and lounge', summary: 'A 5.0 by 6.0 metre gable, new deck, fireplace, mixed roofing, cedar ceiling and lighting create a complete room beside the home.', facts: ['30 m² room and deck', '4.1 m high freestanding structure'] },
      { slug: 'riverhead-gable-pavilion', label: 'Poolside lounge under a warm ceiling', summary: 'A 5.55 by 4.20 metre gable pavilion uses black framing, timber sarking, insulation and layered lighting to define the poolside seating area.', facts: ['23.3 m² poolside cover', 'Steel and aluminium frame'] },
      { slug: 'tindalls-bay-pavilion', label: 'Dining and circulation need different roofs', summary: 'Across 108 square metres, solid and acrylic roof zones, timber battens and blinds respond to changing uses and light around a complex home.', facts: ['108 m² patio and carport scope', 'Mixed roof zones and mesh blinds'] },
      { slug: 'goodhome-commercial-terrace', label: 'Hospitality room aligned to the facade', summary: 'A 67.7 square metre, two-zone gable extends the restaurant into a covered courtyard while following the existing facade rhythm.', facts: ['10.09 x 6.7 m footprint', '25 degree gable relationship'] },
    ] },
    { kind: 'decision-cards', id: 'outdoor-room-decisions', tone: 'warm', eyebrow: 'Coordinate the room before fabrication', title: 'Four decisions turn separate products into one place', intro: 'The strongest result comes when use, enclosure, services and architecture are planned together.', items: [
      { title: 'Zones and circulation', outcome: 'A layout for furniture, cooking, doors, paths and the view.', consider: 'Clearances, thresholds, post positions, steps, existing deck or paving and everyday movement.' },
      { title: 'Roof and ceiling', outcome: 'A volume and overhead condition suited to daylight, shade and the desired interior character.', consider: 'Form, roof zones, lining, orientation, adjoining windows, drainage and exact product requirements.' },
      { title: 'Edges and outlook', outcome: 'The right degree of openness at each side of the room.', consider: 'Wind, low sun, privacy, blinds, infill, screens, views, air movement and storage when elements retract.' },
      { title: 'Light, heat and services', outcome: 'Features positioned to support evening or cooler-season use without visual clutter.', consider: 'Mounting, wiring, controls, clearances, trade coordination and future maintenance access.' },
    ] },
    { kind: 'dark-cards', id: 'room-expectations', eyebrow: 'Set the outdoor boundary honestly', title: 'More usable does not mean indoors without walls', intro: 'An outdoor room remains connected to changing conditions unless its enclosure is designed differently.', items: [
      { title: 'Rain can arrive sideways', text: 'Roof cover manages what lands above. Wind-driven rain can still enter through open edges.' },
      { title: 'Comfort changes through the day', text: 'Sun direction, shade, airflow, surfaces and edge protection influence how the room feels at different times.' },
      { title: 'Features need project-specific checks', text: 'Heating, fireplaces, kitchens, electrical work and enclosure may require product, professional or approval coordination for the actual design.' },
    ], links: [{ href: '/products/screens-walls/drop-down-blinds', label: 'Review outdoor blinds' }, { href: '/products/lighting-heating/downlights', label: 'Review integrated downlights' }] },
    { kind: 'link-cards', id: 'room-next-decisions', tone: 'neutral', eyebrow: 'Continue the room brief', title: 'Explore each layer in more detail', items: [
      { title: 'Plan an exposed edge', text: 'Map low sun, wind and privacy before deciding where a blind belongs.', href: '/pergolas-with-blinds', linkLabel: 'Open the blinds guide' },
      { title: 'Compare roof behaviour', text: 'Separate fixed cover and opening-roof priorities before comparing proposals.', href: '/acrylic-pergolas-vs-louvre-roofs', linkLabel: 'Open the roof comparison' },
      { title: 'Define the complete investment', text: 'Compare how structure, surfaces, edges and services affect scope in the Pergola Cost guide.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
    ] },
    { kind: 'faq', id: 'outdoor-rooms-faq', tone: 'elevated', eyebrow: 'Questions beyond the roof', title: 'What to resolve when planning an Auckland outdoor room', intro: 'The final recommendation depends on the activities, site, products and completed design.', items: faqItems },
  ],
  mobileDisclosureGroups: [
    { id: 'outdoor-room-use-detail', summary: 'How everyday use shapes the room', blockIds: ['room-use'] },
    { id: 'outdoor-room-coordination-detail', summary: 'How the room decisions work together', blockIds: ['outdoor-room-decisions'] },
    { id: 'outdoor-room-planning-support', summary: 'Outdoor room planning links and common questions', blockIds: ['room-next-decisions', 'outdoor-rooms-faq'] },
  ],
  finalCta: { eyebrow: 'Describe a day, not a product list', title: 'Tell Sanctuary what should happen in the room', text: 'Photos and dimensions establish the site. A short account of meals, evenings, children, guests, views or weather problems establishes why the room should exist.', button: 'Describe the room you need', checklistTitle: 'Useful first inputs', checklist: ['Project suburb', 'Wide site and house photos', 'Views from inside', 'Rough dimensions', 'Furniture and activity list', 'Rain, wind, sun or privacy issues', 'Desired lighting, heating or screens', 'Plans or sketches'] },
  form: { ariaLabel: 'Outdoor room project enquiry form', eyebrow: 'Start with use', heading: 'Describe your outdoor room', intro: 'Share the site, rough dimensions and the activities the space needs to support. Include any roof, edge, lighting or heating ideas without treating them as fixed.', submitLabel: 'Describe the room you need', messageLabel: 'Describe a typical day in the room', messagePlaceholder: 'Tell us who uses the space, where dining, lounging or cooking should happen and which doors, paths or views need to remain open.', briefFields: [
    { name: 'furnitureAndUse', label: 'Furniture and activities', type: 'textarea', placeholder: 'List the table, lounge, barbecue, kitchen, fireplace or other elements the plan should allow for.', wide: true },
    { name: 'exposedEdges', label: 'Edges affected by sun, wind or privacy', type: 'text', placeholder: 'Note the condition and direction if known', wide: true },
  ], roofPreference: { detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
