export const designPriorities = [
  {
    title: 'Make the deck useful more often',
    text: 'Start with the moments the current space cannot support. That might be dinner interrupted by rain, outdoor furniture that stays covered, or a deck that is too exposed for everyday use.',
  },
  {
    title: 'Protect the light inside',
    text: 'The proposed roof also changes the kitchen, lounge or dining room beside it. Roof depth, tint, orientation and nearby glazing should be considered before the acrylic is selected.',
  },
  {
    title: 'Make the addition belong',
    text: 'Roof form, frame colour, post placement, drainage and the house connection all affect whether the pergola looks resolved or simply attached.',
  },
] as const;

export const designQuestions = [
  {
    title: 'What should become easier?',
    text: 'Name the practical change first. More meals outside, a dry route through the house, room for the table and barbecue, or a sheltered place for children and pets gives the design a clear purpose.',
  },
  {
    title: 'Which light matters most?',
    text: 'Look from inside the adjoining rooms as well as from the deck. Decide whether sky views, morning light, afternoon shade or a softer overhead appearance should lead the roof decision.',
  },
  {
    title: 'How open should it feel?',
    text: 'Posts, beams, blinds and infill panels can all change sightlines and circulation. The cleanest feasible arrangement depends on the site, span, structure and level of side protection required.',
  },
  {
    title: 'Where should the water go?',
    text: 'Roof fall, gutters, downpipes, flashings and the discharge point need to work as one rainwater path. They should be resolved with the architecture, not added after the frame is decided.',
  },
] as const;

export const tintChoices = [
  {
    name: 'Clear acrylic',
    tone: 'clear',
    outcome: 'The strongest visual connection to the sky and generally the greatest relative daylight of these options.',
    consider: 'Direct sun can feel bright. Check the roof depth, nearby windows and whether low-angle sun reaches the seating area.',
  },
  {
    name: 'Light grey acrylic',
    tone: 'light-grey',
    outcome: 'A lightly tinted roof that remains visually open while softening some of the brightness of a fully clear sheet.',
    consider: 'Compare the tint against the house colour and assess how much daylight the adjoining rooms already receive.',
  },
  {
    name: 'Dark grey acrylic',
    tone: 'dark-grey',
    outcome: 'A more shaded visual character where reducing perceived brightness is a stronger priority.',
    consider: 'A deeper tint also changes the light below and inside. Review the total roof area and how the space feels on overcast days.',
  },
  {
    name: 'Opal acrylic',
    tone: 'opal',
    outcome: 'A translucent roof that spreads softer light rather than preserving a clear view through to the sky.',
    consider: 'Useful when diffusion matters more than transparency. Confirm the selected product and its visual effect before proceeding.',
  },
] as const;

export const roofForms = [
  {
    title: 'Mono-pitched',
    href: '/products/pergolas/pitched',
    text: 'One roof plane can create a restrained extension from the house and a clear direction for drainage. Available height, the low edge and the house connection shape the final proportions.',
  },
  {
    title: 'Gable',
    href: '/products/pergolas/gable',
    text: 'A central ridge adds height and gives the covered area a strong architectural centre. The gable end, ridge and relationship to the existing roofline all become visible design decisions.',
  },
  {
    title: 'Hip roof',
    href: '/products/pergolas/hip',
    text: 'Multiple roof falls can suit corner sites, courtyards and homes with more complex roof geometry. Tint and drainage need to be considered across every plane.',
  },
  {
    title: 'Box perimeter',
    href: '/products/pergolas/box-perimeter',
    text: 'A defined outer frame creates a crisp rectangular profile around the roof. It can give the addition more visual weight while keeping acrylic within the centre of the structure.',
  },
] as const;

export const edgeDecisions = [
  {
    title: 'Overhead cover has open edges',
    text: 'An acrylic roof manages rain that lands on the roof plane. Wind-driven rain can still enter from the sides, so the intended level of shelter needs to be described honestly.',
  },
  {
    title: 'Side protection changes the room',
    text: 'Blinds, screens and infill panels may help with wind, low-angle sun or privacy. They also affect outlook, air movement and how enclosed the space feels.',
  },
  {
    title: 'Plan accessories with the frame',
    text: 'If lighting, heating or blinds are likely, their mounting positions, wiring, controls and visual alignment are best considered before fabrication.',
  },
] as const;

export const processSteps = [
  {
    title: 'Send the useful context',
    copy: 'Share the project suburb, a few photos and rough width and projection. Include a view from inside the adjoining room if preserving daylight is important.',
  },
  {
    title: 'Receive a first assessment',
    copy: 'Sanctuary reviews the known scope, identifies the decisions that still need evidence and prepares the most useful next step. Early assumptions remain visible rather than being treated as settled facts.',
  },
  {
    title: 'Review the site and options',
    copy: 'The roof connection, post locations, sun, drainage, access and material choices can then be considered in context. Comparable projects, drawings or samples may help resolve the appearance.',
  },
  {
    title: 'Confirm design and scope',
    copy: 'The preferred form, dimensions, acrylic option, accessories, inclusions and exclusions are brought into one agreed design and quotation. Revisions can be made before commitment.',
  },
  {
    title: 'Prepare and install',
    copy: 'After approval and any required preliminary work, the pergola is prepared and installed to the agreed scope. Project timing is confirmed for the actual design and current programme.',
  },
] as const;

export const costDrivers = [
  ['Footprint and spans', 'Width, projection, height and the feasible post arrangement affect both material quantities and structural requirements.'],
  ['Roof form and frame', 'A pitched, gable, hip or box-perimeter design has a different frame, geometry and level of detailing.'],
  ['House connection or supports', 'Attaching to the home, building independently, or working around existing decks and foundations changes the scope.'],
  ['Acrylic and integrated options', 'The confirmed roof product, tint, combination roofing, blinds, infills, lighting and heating all need to be priced as part of the actual design.'],
  ['Drainage, access and exposure', 'Flashings, gutters, downpipes, discharge points, restricted access and site exposure can materially change the work required.'],
  ['Design and approval requirements', 'Site-specific engineering, documentation or council processes may add work where the completed design requires them.'],
] as const;

export const quoteChecklist = [
  'Agreed dimensions and pergola form',
  'Frame, acrylic roofing and finish',
  'Flashings, gutters and downpipes',
  'Posts, foundations and house connections',
  'Accessories and electrical responsibilities',
  'Engineering or consent work, where applicable',
  'Site access assumptions and exclusions',
  'GST and the exact next step',
] as const;

export const faqItems = [
  {
    question: 'Will an acrylic roof make the lounge or kitchen darker?',
    answer: [
      'Any new roof can change the light in the rooms beside it. The result depends on the tint, roof depth, orientation, existing eaves and the position of doors and windows.',
      'Clear and lighter options generally retain more relative daylight than darker or opaque roofing, but the whole roof should be assessed from inside the home before a recommendation is made.',
    ],
  },
  {
    question: 'Which acrylic tint is best for an Auckland pergola?',
    answer: [
      'There is no single best tint. Clear prioritises transparency, light grey introduces a subtle tint, dark grey has a more shaded character, and opal diffuses light without a clear view through the roof.',
      'The choice should respond to sun direction, roof area, nearby glazing, the desired outlook and how the deck will be used.',
    ],
  },
  {
    question: 'Can an acrylic-covered deck become too hot?',
    answer: [
      'It can feel bright or warm when the roof choice does not account for sustained direct sun, roof depth, airflow, nearby walls and heat retained by paving or decking.',
      'A different tint, a mixed roof, ventilation or edge protection may provide a better balance. The right response depends on the site rather than the acrylic colour alone.',
    ],
  },
  {
    question: 'Is an acrylic pergola waterproof?',
    answer: [
      'An acrylic roof is intended to provide overhead rain cover, but waterproof can be misleading for an open-sided outdoor structure. Wind-driven rain can enter through the edges.',
      'Roof fall, joints, house connections, flashings, gutters and downpipes all influence how water is managed. These details need to be resolved for the specific design.',
    ],
  },
  {
    question: 'Is acrylic the same as polycarbonate?',
    answer: [
      'No. Acrylic and polycarbonate are different plastic materials with different properties.',
      'The final quotation should name the exact roofing material, product, grade, thickness, tint and applicable written warranty rather than relying on a generic clear-roof description.',
    ],
  },
  {
    question: 'Can the pergola attach directly to my house?',
    answer: [
      'Often, but the existing cladding, fascia, soffit, roof edge, available support, door clearances, flashing and drainage all need to be reviewed.',
      'Where attachment is not suitable, a freestanding structure may be considered close to the house, subject to the final site and design assessment.',
    ],
  },
  {
    question: 'Can blinds, lighting or heaters be included?',
    answer: [
      'These options can be considered where they suit the selected structure and products. Blinds may help with wind, low-angle sun or privacy, while lighting and heating can support evening or cooler-season use.',
      'Mounting positions, wiring, controls and clearances should be planned before fabrication where possible.',
    ],
  },
  {
    question: 'Will an acrylic pergola need building consent?',
    answer: [
      'Requirements depend on the complete design and property, not one dimension alone. Site, area, height, structural design, house connection and planning controls may all be relevant.',
      'Sanctuary can review the early information and identify where further assessment is likely to be needed. The approval pathway must be confirmed for the completed design.',
    ],
  },
  {
    question: 'How much does a custom acrylic roof pergola cost?',
    answer: [
      'Cost depends on the full scope, including dimensions, spans, form, connection, foundations, access, drainage, acrylic selection, integrated options and any engineering or approval work.',
      'Send the suburb, photos and rough dimensions for a useful first indication based on the known project details and stated assumptions.',
    ],
  },
  {
    question: 'How long does the design and installation process take?',
    answer: [
      'Timing depends on design development, site assessment, approvals, engineering, material availability, fabrication, access and the current installation schedule.',
      'A project-specific indication can be given once the early scope is understood. A fixed programme should not be assumed before then.',
    ],
  },
  {
    question: 'Which parts of Auckland does Sanctuary service?',
    answer: [
      'Sanctuary is Auckland based. Include the project suburb in your enquiry so the team can confirm the current service area and any relevant travel or access considerations.',
    ],
  },
  {
    question: 'How should an acrylic pergola roof be cleaned?',
    answer: [
      'Follow the maintenance instructions supplied for the exact acrylic product. Product-specific guidance should take precedence over general advice.',
      'As a general principle, avoid abrasive equipment and harsh solvents that may mark the surface. Safe access and the approved cleaning method should be confirmed before work begins.',
    ],
  },
] as const;
