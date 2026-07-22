export const designOutcomes = [
  {
    title: 'Make the outdoor area useful for real routines',
    text: 'Design around the table, barbecue, doors, paths and furniture that need to work below the roof. The goal is a space that supports ordinary days as well as larger gatherings.',
  },
  {
    title: 'Protect the rooms beside it',
    text: 'A new roof changes the view and daylight from the kitchen, lounge or dining room. Its depth, form and material should be judged from inside the home as well as from the deck.',
  },
  {
    title: 'Give the addition a reason to belong',
    text: 'Roof geometry, frame colour, post locations, drainage and the house connection should read as one resolved architectural response, not a collection of separate products.',
  },
] as const;

export const designQuestions = [
  {
    title: 'What cannot the space do today?',
    text: 'Rain may end meals, afternoon sun may make the deck difficult to use, or an exposed edge may leave the area feeling temporary. The design brief starts with that practical limitation.',
  },
  {
    title: 'What should remain open?',
    text: 'Identify the views, doors, paths and daylight that matter. This gives post placement, roof depth and side protection a clear boundary to work within.',
  },
  {
    title: 'What does the house suggest?',
    text: 'Existing roof pitch, eaves, cladding, window heads and architectural character help determine whether a pitched, gable, hip or box-perimeter form will feel at home.',
  },
  {
    title: 'Which weather reaches the site?',
    text: 'Overhead rain is only one part of the exposure. Wind direction, low sun, privacy and the open edges of the structure may need their own design response.',
  },
] as const;

export const roofForms = [
  {
    title: 'Mono-pitched pergola',
    href: '/products/pergolas/pitched',
    text: 'A single roof plane can extend quietly from the house and create a direct drainage path. Available height, the low edge and the connection to the existing building guide the proportions.',
  },
  {
    title: 'Gable pergola',
    href: '/products/pergolas/gable',
    text: 'A central ridge creates height and a stronger architectural centre. The pitch, gable end and relationship to the existing roofline need to be resolved together.',
  },
  {
    title: 'Hip roof pergola',
    href: '/products/pergolas/hip',
    text: 'Multiple roof planes can respond to a courtyard, corner or more complex house geometry. Every fall affects framing, drainage and the appearance from above and below.',
  },
  {
    title: 'Box-perimeter pergola',
    href: '/products/pergolas/box-perimeter',
    text: 'A crisp outer frame gives the roof a defined rectangular profile. The structure within it can then respond to the required fall, material and span.',
  },
] as const;

export const roofApproaches = [
  {
    title: 'Acrylic roofing',
    outcome: 'Prioritises transmitted daylight and a lighter visual connection overhead.',
    consider: 'Tint, roof depth, direct sun and the daylight available to adjacent rooms all change the result.',
    href: '/acrylic-roof-pergolas-auckland',
  },
  {
    title: 'Solid or lined roofing',
    outcome: 'Creates a more ceiling-like room and stronger overhead shade.',
    consider: 'The effect on adjoining rooms, roof build-up, drainage and the desired underside finish should be reviewed early.',
    href: '/projects/riverhead-gable-pavilion',
  },
  {
    title: 'Combination roofing',
    outcome: 'Places transparent and solid zones according to the use below and the light needed beside the deck.',
    consider: 'The transition between materials must be designed as part of the roof, not treated as an afterthought.',
    href: '/projects/tindalls-bay-pavilion',
  },
  {
    title: 'Unsure at the start',
    outcome: 'Keeps the brief focused on use, light, shelter and architecture before a product is selected.',
    consider: 'Photos, orientation, approximate dimensions and comparable projects make the first comparison more useful.',
    href: '#project-details',
  },
] as const;

export const edgeDecisions = [
  {
    title: 'Rain from above',
    text: 'Roof fall, flashings, gutters, downpipes and the discharge point form one rainwater path. The house connection and every change in roof plane need to support that path.',
  },
  {
    title: 'Wind and low sun',
    text: 'Open sides allow air and views, but they also admit wind-driven rain and low-angle sun. Blinds, infill panels or a change in layout may be considered where an edge needs more protection.',
  },
  {
    title: 'Privacy and enclosure',
    text: 'Screens can make an exposed boundary more comfortable, yet every added edge changes outlook, airflow and how enclosed the room feels. Decide which edges should stay open before adding products.',
  },
] as const;

export const processSteps = [
  {
    title: 'Share the site and the outcome',
    copy: 'Send the project suburb, photos and rough dimensions. Explain how the area is used now, which rooms sit beside it and what you want the pergola to make easier.',
  },
  {
    title: 'Receive a grounded first assessment',
    copy: 'Sanctuary reviews the known scope, identifies missing information and outlines a useful next step. Early assumptions stay visible instead of being presented as final decisions.',
  },
  {
    title: 'Review the site and design options',
    copy: 'The house connection, roof form, post locations, daylight, drainage, access and edge protection can then be considered together. Comparable projects and drawings help make the trade-offs tangible.',
  },
  {
    title: 'Confirm the design and quotation',
    copy: 'The agreed dimensions, structure, roofing, finish, accessories, inclusions and exclusions are brought into one defined scope. Revisions can be resolved before commitment.',
  },
  {
    title: 'Prepare and install',
    copy: 'After approval and any required preliminary work, the pergola is prepared and installed to the agreed design. Timing is confirmed for the actual project and current programme.',
  },
] as const;

export const scopeFactors = [
  ['Size, height and spans', 'Width, projection, roof height and the feasible post layout affect material quantities, structure and the experience below the roof.'],
  ['Roof form and materials', 'Pitched, gable, hip and box-perimeter forms use different geometry and detailing. Acrylic, solid and combination roofs also create different scopes.'],
  ['House connection and foundations', 'An attached structure, a freestanding structure or work around an existing deck requires different support, flashing and foundation decisions.'],
  ['Drainage and site exposure', 'Roof fall, gutters, downpipes, discharge, wind exposure and coastal conditions need to be understood for the actual site.'],
  ['Access and existing conditions', 'Restricted access, sloping ground, existing structures and services can change how the work is designed and installed.'],
  ['Integrated options and approvals', 'Blinds, infill panels, lighting, heating, engineering, documentation and council processes add scope where the design requires them.'],
] as const;

export const quoteChecklist = [
  'Agreed footprint, heights and roof form',
  'Frame, roof materials and finish',
  'Posts, foundations and house connections',
  'Flashings, gutters and downpipes',
  'Blinds, screens, lighting or heating',
  'Electrical and other trade responsibilities',
  'Engineering or approval work, where applicable',
  'Access assumptions, exclusions, GST and next steps',
] as const;

export const conditionalDecisions = [
  {
    title: 'Posts, spans and engineering',
    text: 'The cleanest feasible structure depends on dimensions, loads, site exposure, support conditions and the completed design. A specific span or post-free result should wait for proper assessment.',
  },
  {
    title: 'Consent and property requirements',
    text: 'Requirements depend on the property and final design. Sanctuary can identify likely checks, but the approval pathway must be confirmed for the actual project.',
  },
  {
    title: 'Products, warranties and maintenance',
    text: 'The quotation should identify the selected products and the current written information that applies to them. Generic material claims are not a substitute for project-specific documents.',
  },
] as const;

export const faqItems = [
  {
    question: 'What type of pergola is best for an Auckland home?',
    answer: [
      'There is no single best form. A pitched, gable, hip or box-perimeter pergola can each be appropriate depending on the house roofline, available height, area to cover, drainage and the architectural presence you want.',
      'Start with the site and intended use, then compare the forms against those constraints rather than choosing from appearance alone.',
    ],
  },
  {
    question: 'Does Sanctuary design and install aluminium pergolas?',
    answer: [
      'Yes. Sanctuary designs and installs aluminium pergolas around the home, site and intended use. The final structure may also incorporate steel where the project design requires it.',
      'Roof form, frame colour, post placement, drainage and integrated options are developed as parts of one design.',
    ],
  },
  {
    question: 'Should I choose acrylic or a solid pergola roof?',
    answer: [
      'Acrylic roofing can retain more transmitted daylight and visual openness, while a solid or lined roof creates stronger overhead shade and a more ceiling-like character. A combination roof can place each effect where it is most useful.',
      'The choice should be assessed against orientation, roof depth, adjoining windows, the activity below and the desired appearance from inside and outside.',
    ],
  },
  {
    question: 'Can a pergola attach to the existing house?',
    answer: [
      'Often, but the cladding, fascia, soffit, roof edge, available support, door clearances, flashing and drainage all need to be reviewed.',
      'If attachment is not suitable, a freestanding structure may be considered close to the house, subject to the site and final design.',
    ],
  },
  {
    question: 'Can outdoor blinds, screens, lighting or heaters be included?',
    answer: [
      'These options can be considered where they suit the structure and selected products. Blinds or screens may help an exposed edge, while lighting and heating can support evening or cooler-season use.',
      'Mounting, wiring, controls, drainage and clearances are best planned before fabrication.',
    ],
  },
  {
    question: 'Which parts of Auckland does Sanctuary service?',
    answer: [
      'Sanctuary is Auckland based. Include the project suburb in your enquiry so the team can confirm the current service area and any travel or access considerations.',
    ],
  },
  {
    question: 'What should I send for a useful first assessment?',
    answer: [
      'Send the project suburb, a few photos of the house and outdoor area, rough width and projection, and a short explanation of what you want the space to do.',
      'A view from inside the adjoining room, plus any plans or sketches already available, can help the team assess daylight, connections and likely design constraints.',
    ],
  },
] as const;

export const generalRoofPreference = {
  label: 'Preferred roof approach',
  detailKey: 'roofPreference' as const,
  options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] },
    { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] },
    { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] },
    { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ],
} as const;
