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
    question: 'Do I need to know the roof form before making an enquiry?',
    answer: [
      'No. It is enough to explain what the space needs to do, what should remain open and which conditions are causing the problem today.',
      'Sanctuary can then compare pitched, gable, hip or box-perimeter forms against the available height, house geometry, drainage and desired character.',
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
    question: 'Can blinds, lighting and heating be designed in from the start?',
    answer: [
      'These options can be considered where they suit the structure and selected products. Planning them early allows mounting positions, wiring, controls, clearances and visual alignment to be coordinated before fabrication.',
    ],
  },
  {
    question: 'How much does a custom pergola cost in Auckland?',
    answer: [
      'Cost depends on the defined scope, including dimensions, spans, form, roof materials, connection, foundations, drainage, access, finish, integrated options and any engineering or approval work.',
      'A useful first indication needs the project suburb, photos and rough dimensions, with assumptions stated clearly.',
    ],
  },
  {
    question: 'Will a custom pergola require building consent?',
    answer: [
      'Requirements depend on the property and completed design. Area, height, structure, attachment and planning controls may all be relevant.',
      'Sanctuary can identify likely checks from the early information, but the approval pathway must be confirmed for the actual project.',
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
    title: 'When the house is not standard, the pergola should not be either',
    intro: 'Sanctuary develops the structure around the actual home, the outdoor room and the constraints that make the site specific. Custom means the decisions are connected, not simply that more options are added.',
    primaryCta: 'Show us the site',
    secondaryCta: 'See what gets tailored',
    secondaryHref: '#custom-decisions',
    proof: ['Designed to the actual site', 'Roof, structure and edges resolved together', 'One design-to-installation scope'],
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
        { title: 'Existing geometry', text: 'Roof pitch, eaves, corners, door heads and cladding junctions set the physical context for the new structure.' },
        { title: 'Movement and views', text: 'Doors, steps, furniture, garden paths and outlooks show where posts or screens would become disruptive.' },
        { title: 'Light and exposure', text: 'Orientation, adjoining windows, wind and low sun help decide where openness, shade or edge protection matters most.' },
        { title: 'Access and construction', text: 'Ground conditions, existing decks, services and site access influence foundations, sequencing and the feasible scope.' },
      ],
    },
    {
      kind: 'projects', id: 'custom-project-evidence', eyebrow: 'Site-specific decisions, built', title: 'Four projects with four different reasons to be custom',
      intro: 'The common thread is not one roof style. It is a design response shaped by the existing place and the intended use.',
      items: [
        { slug: 'tindalls-bay-pavilion', label: 'Layered home and mixed roof zones', summary: 'The patio and carport weave around the existing house using insulated panels, acrylic zones, timber battens and mesh blinds where each condition calls for a different response.' },
        { slug: 'warkworth-outdoor-room', label: 'A complete freestanding room', summary: 'The gable structure, clear glazing, solid roof zone, cedar lining, deck and fireplace were developed as one outdoor-room project beside the home.' },
        { slug: 'ardmore-box-carport', label: 'Gable geometry inside a box frame', summary: 'A wide vehicle cover combines a defined perimeter, internal gable form, steel beams, aluminium rafters, acrylic roofing and integrated lighting.' },
        { slug: 'goodhome-commercial-terrace', label: 'Existing architecture extended', summary: 'A two-zone gable roof follows the building pitch and facade rhythm while coordinating a large covered hospitality courtyard.' },
      ],
    },
    {
      kind: 'decision-cards', id: 'custom-decisions', tone: 'warm', eyebrow: 'What gets tailored', title: 'Custom design happens at the joins between decisions',
      intro: 'Each choice affects the next. The work is to resolve the system, not to assemble a shopping list.',
      items: [
        { title: 'Form and proportion', outcome: 'A roof shape and volume that respond to the existing house, available height and intended presence.', consider: 'Pitch, ridge or low-edge height, roof depth, surrounding rooflines and how the structure is seen from inside.' },
        { title: 'Structure and openings', outcome: 'Posts and beams arranged around circulation, views, furniture and the feasible span.', consider: 'Loads, supports, foundations, house connection, site exposure and any engineering required for the completed design.' },
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
        { title: 'Frame the real design problem', copy: 'Sanctuary identifies the relationships and constraints that matter, plus any missing information needed before useful options can be compared.' },
        { title: 'Develop the connected options', copy: 'Form, structure, roofing, drainage, edges and integrated features are assessed in the context of the site rather than as independent upgrades.' },
        { title: 'Resolve and document the scope', copy: 'Drawings, selections, assumptions, inclusions, exclusions and project-specific checks are brought into an agreed design and quotation.' },
        { title: 'Prepare and install', copy: 'After approval and required preliminary work, the pergola is prepared and installed to the agreed scope. Timing is confirmed for the actual project.' },
      ],
    },
    {
      kind: 'scope', id: 'custom-scope', eyebrow: 'Price reflects the defined design', title: 'Custom cost is the sum of project decisions, not a premium label',
      lead: 'A more tailored project may be simple or complex. Cost follows what the site and agreed outcome actually require.',
      paragraphs: ['A useful estimate states what is known and assumed. A final quotation should make it possible to understand where the scope comes from.'],
      factors: [
        ['Geometry and spans', 'Dimensions, height, roof form and the feasible support layout define the structural starting point.'],
        ['Materials and finish', 'Roof zones, framing, lining, colour and visible detailing shape both cost and architectural character.'],
        ['Connections and foundations', 'Attachment, freestanding supports, existing decks and ground conditions change the work below and beside the roof.'],
        ['Integrated requirements', 'Drainage, blinds, screens, electrical provisions, engineering, documentation and access add project-specific scope.'],
      ],
      checklistLead: 'Compare whether each proposal describes the same custom outcome.',
      checklist: ['Agreed dimensions and roof geometry', 'Frame, roofing, lining and finish', 'Posts, foundations and house connections', 'Drainage and discharge responsibilities', 'Screens, blinds and electrical options', 'Engineering or approval work where applicable', 'Site access, assumptions and exclusions', 'GST, revision status and the next action'],
    },
    {
      kind: 'faq', id: 'custom-pergolas-faq', tone: 'elevated', eyebrow: 'Questions about bespoke work', title: 'What to resolve when the answer is site-specific',
      intro: 'These answers describe the design approach. The final response depends on the actual property and agreed project.', items: faqItems,
    },
  ],
  finalCta: {
    eyebrow: 'Bring the awkward parts', title: 'The useful first message shows what makes the site specific',
    text: 'Do not crop out the roofline, corner, doorway or level change that makes the project difficult. Those details help Sanctuary understand why a custom response may be worthwhile.',
    button: 'Show us the site', checklistTitle: 'Useful context includes',
    checklist: ['Project suburb', 'Wide photos of the house and outdoor area', 'Views from inside adjoining rooms', 'Rough width, projection and height', 'Known constraints or existing structures', 'How the space should be used', 'Plans or sketches, if available', 'Desired timeframe, if known'],
  },
  form: {
    ariaLabel: 'Custom pergola project enquiry form', eyebrow: 'Start with the real site', heading: 'Send your custom pergola brief',
    intro: 'Share photos, rough dimensions and the reason a standard answer may not work. Explain what should improve, what must stay open and any constraints you already know about.',
    submitLabel: 'Show us the site',
    roofPreference: {
      label: 'Possible roof approach', detailKey: 'roofPreference', options: [
        { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] },
        { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] },
        { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] },
        { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
      ],
    },
  },
} satisfies SeoLandingPageConfig;
