import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  {
    question: 'What makes a Sanctuary pergola custom?',
    answer: [
      'The pergola is developed around the specific home, outdoor area, intended use and site conditions rather than selected from a fixed kit size.',
      'Dimensions, roof form, structure, post locations, roofing, drainage, colour and integrated options are resolved as parts of one project.',
    ],
  },
  {
    question: 'Can a custom pergola work around an unusual or difficult space?',
    answer: [
      'A site-specific design can respond to changes in roofline, restricted height, corners, existing decks, circulation and other constraints. Feasibility still depends on the actual structure, dimensions and site.',
      'Photos, rough measurements and any available plans help identify which constraints need closer assessment.',
    ],
  },
  {
    question: 'How do you make a new pergola look connected to the house?',
    answer: [
      'The relationship comes from more than matching a colour. Roof pitch, eave lines, frame depth, post rhythm, cladding junctions, drainage and the view from inside all affect whether the addition feels resolved.',
      'Comparable projects and drawings can help test those relationships before the scope is confirmed.',
    ],
  },
  {
    question: 'Can a custom pergola be attached or freestanding?',
    answer: [
      'Both approaches can be considered. Attachment depends on the existing building, support, cladding, clearances, flashing and drainage. A freestanding structure may be more suitable where the house connection is constrained or independence is useful.',
      'The final arrangement should follow the site and completed design rather than a preference set in advance.',
    ],
  },
  {
    question: 'Can different roof materials be combined in one custom pergola?',
    answer: [
      'Acrylic and solid roof zones can be considered together where different parts of the space need different light or shade conditions. The junction, drainage and appearance need to be designed as part of the complete roof.',
      'The selected products and their current written information should be confirmed in the final scope.',
    ],
  },
  {
    question: 'What should I send to start a custom pergola conversation?',
    answer: [
      'Send the suburb, photos from outside and inside, rough width and projection, and a short description of how the area should work.',
      'Include plans or sketches if available, plus any constraints you already know about. You do not need to solve the design before making contact.',
    ],
  },
] as const;

export const customPergolasConfig = {
  marker: 'custom-pergolas-auckland',
  route: '/custom-pergolas-auckland',
  description: 'Plan a custom pergola for an Auckland home or site that needs more than a standard answer. See how Sanctuary resolves use, geometry, light, structure and scope.',
  schemaName: 'Custom Pergolas Auckland',
  serviceName: 'Custom pergola design and installation in Auckland',
  serviceType: 'Bespoke pergola design and installation',
  hero: {
    image: '/images/project-dairy-flat-03.jpg',
    imageAlt: 'Custom aluminium pergola connection and roof form beside an Auckland home',
    objectPosition: '50% 44%',
    eyebrow: 'Custom pergolas in Auckland',
    title: 'Custom pergolas for sites where the obvious answer does not fit',
    intro: 'Sanctuary develops bespoke pergolas around difficult connections, irregular footprints, restricted post positions, changing levels and the work already happening around the home. The design can coordinate with a renovation, new build or architect-led brief from the start.',
    primaryCta: 'Request a design review',
    secondaryCta: 'See what gets tailored',
    secondaryHref: '#custom-decisions',
    proof: ['Difficult connections resolved early', 'Posts, spans and levels coordinated', 'Plans and project teams welcomed'],
  },
  blocks: [
    {
      kind: 'split-intro', id: 'custom-meaning', eyebrow: 'Custom should solve something', title: 'Bespoke is useful when the obvious answer creates a new problem',
      paragraphs: [
        'A fixed roof size might cover the deck but collide with a window head. A convenient post position might interrupt the main path outside. A single roof material might solve shade over the table while taking too much light from the kitchen.',
        'Custom design begins with those relationships. It looks at what the outdoor room needs to do, what the home needs to keep and where the site sets a real boundary.',
        'The result is not complexity for its own sake. It is a clearer reason for every major line, material and connection.',
      ],
    },
    {
      kind: 'editorial-image', id: 'read-the-site', tone: 'neutral', eyebrow: 'Read before drawing', title: 'The site already contains most of the design brief',
      image: { src: '/images/project-ardmore-carport-04.jpg', alt: 'Top view of custom pergola roof geometry within a box-perimeter frame', objectPosition: '50% 46%' },
      lead: 'Good custom work starts by noticing the conditions a generic plan would ignore.',
      items: [
        { title: 'Existing geometry', text: 'Roof pitch, eaves, corners, door heads, cladding junctions and changing levels set the physical context for the new structure.' },
        { title: 'Movement and restricted posts', text: 'Doors, steps, furniture, garden paths and outlooks show where posts or screens would interrupt the space and where a different span strategy needs investigation.' },
        { title: 'Light and exposure', text: 'Orientation, adjoining windows, wind and low sun help decide where openness, shade or edge protection matters most.' },
        { title: 'Project coordination', text: 'Ground conditions, existing decks, services, renovation sequencing, architectural drawings and site access influence the feasible scope and who needs to resolve each interface.' },
      ],
    },
    {
      kind: 'projects', id: 'custom-project-evidence', eyebrow: 'Site-specific decisions, built', title: 'Four projects with four different reasons to be custom',
      intro: 'The common thread is not one roof style. It is a design response shaped by the existing place and the intended use.',
      items: [
        { slug: 'tindalls-bay-pavilion', label: 'Layered home and mixed roof zones', summary: 'A 108 square metre patio and carport response uses insulated panels, acrylic zones, timber battens and blinds where the existing home creates different conditions.', facts: ['108 m² across patio and carport', 'Mixed roof and edge treatments'] },
        { slug: 'warkworth-outdoor-room', label: 'A complete freestanding room', summary: 'The 5.0 by 6.0 metre gable, clear glazing, solid roof zone, cedar lining, deck and fireplace were developed as one freestanding outdoor room.', facts: ['5.0 x 6.0 m footprint', '4.1 m high with a 30 degree roof'] },
        { slug: 'ardmore-box-carport', label: 'Gable geometry inside a box frame', summary: 'A 54.3 square metre vehicle cover combines a defined perimeter, internal gable, steel beams, aluminium rafters, acrylic roofing and integrated lighting.', facts: ['8.77 x 6.19 m footprint', 'Steel and aluminium structure'] },
        { slug: 'goodhome-commercial-terrace', label: 'Existing architecture extended', summary: 'A 10.09 by 6.7 metre, two-zone gable follows the building pitch and facade rhythm across a hospitality courtyard.', facts: ['67.7 m² covered area', '25 degree gable aligned to the facade'] },
      ],
    },
    {
      kind: 'decision-cards', id: 'custom-decisions', tone: 'warm', eyebrow: 'What gets tailored', title: 'Custom design happens at the joins between decisions',
      intro: 'Each choice affects the next. The work is to resolve the system, not to assemble a shopping list.',
      items: [
        { title: 'Form and proportion', outcome: 'A roof shape and volume that respond to the existing house, available height and intended presence.', consider: 'Pitch, ridge or low-edge height, roof depth, surrounding rooflines and how the structure is seen from inside.' },
        { title: 'Structure and restricted posts', outcome: 'Posts and beams arranged around circulation, views, furniture and the feasible span rather than a default grid.', consider: 'Loads, supports, foundations, house connection, site exposure and any engineering required for the completed design.' },
        { title: 'Light and roof zones', outcome: 'Acrylic, solid or combined roofing placed according to the conditions needed below and beside the roof.', consider: 'Orientation, direct sun, adjoining glazing, total roof depth, underside character and product-specific information.' },
        { title: 'Edges and integration', outcome: 'Drainage, blinds, screens, lighting and heating coordinated with the frame instead of added after fabrication.', consider: 'Wind direction, privacy, low sun, mounting, wiring, controls, gutters, downpipes and discharge.' },
      ],
    },
    {
      kind: 'dark-cards', id: 'custom-clarity', eyebrow: 'Bespoke does not mean vague', title: 'A custom project should become more defined at every step',
      intro: 'The design may be unique, but the route from first enquiry to agreed scope should remain calm and legible.',
      items: [
        { title: 'Separate facts from assumptions', text: 'Early dimensions and ideas are useful inputs, not final technical conclusions. Unknowns should stay visible until the site or design resolves them.' },
        { title: 'Use evidence to compare options', text: 'Photos, drawings, samples and relevant completed projects make form, material and proportion decisions easier to judge at the right scale.' },
        { title: 'Name the finished scope', text: 'The quotation should identify the agreed design, included work, excluded work, options and project-specific next steps.' },
      ],
      links: [{ href: '/pergolas-auckland', label: 'Review the broad pergola planning guide' }, { href: '/acrylic-roof-pergolas-auckland', label: 'Review acrylic roof decisions' }],
    },
    {
      kind: 'numbered-cards', id: 'custom-boundaries', tone: 'neutral', eyebrow: 'Custom still has boundaries', title: 'Site-specific answers need site-specific evidence',
      intro: 'A bespoke service should be more careful with promises, not less.',
      items: [
        { title: 'Structure follows verified conditions', text: 'Spans, post locations and support details depend on dimensions, loads, exposure, existing construction and any engineering required.' },
        { title: 'Approval follows the final design', text: 'Consent and property requirements cannot be settled from one generic rule. The relevant pathway must be confirmed for the completed project.' },
        { title: 'Products stay product-specific', text: 'Performance, warranty and maintenance information should come from the exact products selected for the quotation, not broad material claims.' },
      ],
    },
    {
      kind: 'process', id: 'custom-process', eyebrow: 'From constraints to a buildable answer', title: 'A custom process should reduce uncertainty, not hide it',
      intro: 'Each stage adds the evidence needed for the next decision.',
      items: [
        { title: 'Show the whole context', copy: 'Send the suburb, photos, rough dimensions and the practical outcome. Include views from inside and any plans if they are available.' },
        { title: 'Map constraints and interfaces', copy: 'Sanctuary identifies restricted posts, connection limits, level changes, spans, drainage and the work that needs coordination with an architect, builder or engineer.' },
        { title: 'Develop the connected response', copy: 'Form, structure, roofing, drainage, edges and integrated features are tested together, with open technical questions kept visible.' },
        { title: 'Resolve responsibilities and scope', copy: 'Drawings, selections, assumptions, inclusions, exclusions and project-specific checks are brought into an agreed design and quotation.' },
      ],
    },
    { kind: 'link-cards', id: 'custom-next-decisions', tone: 'neutral', eyebrow: 'Continue the brief', title: 'Continue with the guide that answers the next question', intro: 'Keep the bespoke problem separate from detailed cost, form, room and commercial-coordination decisions.', items: [
      { title: 'Compare a defined project scope', text: 'See which inputs make an early cost discussion useful and which items must be shown in the total.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
      { title: 'Test a central ridge', text: 'Review how ridge height, pitch, eaves and end conditions shape a gable around the existing architecture.', href: '/gable-pergolas-auckland', linkLabel: 'Open the gable guide' },
      { title: 'Test a single roof plane', text: 'Review how the high edge, low edge, fall and drainage direction affect a mono-pitched connection.', href: '/pitched-pergolas-auckland', linkLabel: 'Open the pitched guide' },
      { title: 'Plan the whole outdoor room', text: 'Coordinate shelter, furniture, services and changing edges around the life below the roof.', href: '/outdoor-rooms-auckland', linkLabel: 'Open the outdoor room guide' },
      { title: 'Coordinate a commercial project', text: 'Review operating constraints, stakeholder interfaces, access and handover requirements in the commercial pergola guide.', href: '/commercial-pergolas-auckland', linkLabel: 'Open the commercial guide' },
    ] },
    { kind: 'link-cards', id: 'custom-product-context', tone: 'warm', eyebrow: 'Current product pages', title: 'Take product-level questions to the configuration being considered', intro: 'These pages describe current gable, pitched, box-perimeter and acrylic roof information. The custom review remains responsible for resolving non-standard junctions, supports and geometry.', items: [
      { title: 'Gable pergola configuration', text: 'Review Sanctuary\'s current gable product presentation before testing bespoke ridge, end and connection conditions.', href: '/products/pergolas/gable', linkLabel: 'Open the gable product' },
      { title: 'Pitched pergola configuration', text: 'Review Sanctuary\'s current pitched product presentation before testing bespoke high-edge, low-edge and drainage conditions.', href: '/products/pergolas/pitched', linkLabel: 'Open the pitched product' },
      { title: 'Box-perimeter configuration', text: 'Review the fixed-roof perimeter form before testing bespoke internal geometry, post positions and concealed drainage conditions.', href: '/products/pergolas/box-perimeter', linkLabel: 'Open box-perimeter' },
      { title: 'Acrylic roof approach', text: 'Review Sanctuary fixed acrylic roof options before testing bespoke glazing zones, daylight, house junctions and drainage.', href: '/acrylic-roof-pergolas-auckland', linkLabel: 'Open the acrylic page' },
    ] },
    {
      kind: 'faq', id: 'custom-pergolas-faq', tone: 'elevated', eyebrow: 'Questions about bespoke work', title: 'What to resolve when the answer is site-specific',
      intro: 'These answers describe the design approach. The final response depends on the actual property and agreed project.', items: faqItems,
    },
  ],
  mobileDisclosureGroups: [
    {
      id: 'custom-site-reading-detail',
      summary: 'How Sanctuary reads a custom site',
      blockIds: ['read-the-site'],
    },
    {
      id: 'custom-definition-detail',
      summary: 'How custom decisions become a clear scope',
      blockIds: ['custom-clarity', 'custom-boundaries'],
    },
    {
      id: 'custom-planning-support',
      summary: 'Custom planning links and common questions',
      blockIds: ['custom-next-decisions', 'custom-product-context', 'custom-pergolas-faq'],
    },
  ],
  finalCta: {
    eyebrow: 'Bring the awkward parts', title: 'The useful first message shows what makes the site specific',
    text: 'Do not crop out the roofline, corner, doorway or level change that makes the project difficult. Those details help Sanctuary understand why a custom response may be worthwhile.',
    button: 'Request a design review', checklistTitle: 'Useful context includes',
    checklist: ['Project address and current stage', 'Wide photos of the house and outdoor area', 'Plans, sketches or renovation drawings', 'Rough width, projection and height', 'Restricted posts, spans or level changes', 'Intended use and integrated features', 'Architect, designer or builder involvement', 'Desired timeframe, if known'],
  },
  form: {
    ariaLabel: 'Custom pergola project enquiry form', eyebrow: 'Start with the real site', heading: 'Send your custom pergola brief',
    intro: 'Share photos, rough dimensions and the reason a standard answer may not work. Explain what should improve, what must stay open and any constraints you already know about.',
    submitLabel: 'Request a design review',
    messageLabel: 'Why does the site need a custom response?',
    messagePlaceholder: 'Describe the difficult connection, irregular footprint, restricted post position, changing level, span or coordination issue that shapes the project.',
    briefFields: [
      { name: 'siteAddress', label: 'Project address', type: 'text', placeholder: 'Street address, if you are ready to share it', wide: true },
      { name: 'projectStage', label: 'Project stage', type: 'select', options: ['Early feasibility', 'Concept design', 'Architectural plans underway', 'Consent or documentation underway', 'Ready for a detailed proposal'] },
      { name: 'professionalInvolvement', label: 'Professional involvement', type: 'text', placeholder: 'Architect, designer, builder or engineer, if involved' },
      { name: 'knownConstraints', label: 'Known site and connection constraints', type: 'textarea', placeholder: 'Include restricted posts, spans, levels, services, access, renovation sequencing or existing structure.', wide: true },
      { name: 'intendedUse', label: 'Intended use of the finished space', type: 'text', placeholder: 'For example: dining, cooking, poolside or commercial service', wide: true },
    ],
    roofPreference: {
      detailKey: 'roofPreference', options: [
        { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] },
        { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] },
        { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] },
        { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
      ],
    },
  },
} satisfies SeoLandingPageConfig;
