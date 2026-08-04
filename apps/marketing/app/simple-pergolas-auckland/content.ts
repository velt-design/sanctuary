export const simpleCoverLevels = [
  {
    number: '01',
    title: 'Roof only',
    text: 'Add fixed overhead cover while leaving every side open to views, movement and air.',
    note: 'A useful fit when the main need is cover from above.',
  },
  {
    number: '02',
    title: 'Roof with one blind',
    text: 'Add a drop-down blind to the side most affected by low sun, privacy or exposure.',
    note: 'The frame, blind headbox, guides and operating clearance are resolved together.',
  },
  {
    number: '03',
    title: 'Roof with several blinds',
    text: 'Plan blinds on more than one side while retaining a focused fixed-roof brief.',
    note: 'Opening size, fabric and site exposure still determine what each blind can practically do.',
  },
] as const;

export const simpleCoverStrengths = [
  {
    title: 'Daylight remains part of the roof',
    text: 'Acrylic admits daylight through the roof. We select clear, grey or opal with the adjoining rooms, orientation and roof area in mind.',
  },
  {
    title: 'Cover is ready when you step outside',
    text: 'There is no roof-opening sequence. The fixed roof is already in place when you want to use the deck.',
  },
  {
    title: 'The sides can remain open',
    text: 'The structure can retain open views and easy movement while still resolving the frame, posts, connection and drainage.',
  },
  {
    title: 'Blinds are optional',
    text: 'Add them only to the edges that need another layer for low sun, privacy or exposure.',
  },
] as const;

export const simpleCoverConsiderations = [
  {
    title: 'It is a fixed roof',
    text: 'Choose this pathway when ongoing overhead cover matters more than opening the roof to the sky.',
  },
  {
    title: 'The acrylic finish matters',
    text: 'Clear, grey and opal differ in appearance and how they admit daylight. There is no useful default for every home.',
  },
  {
    title: 'Open sides are still open',
    text: 'Wind-driven rain and low sun can still reach an open side. A blind may help a selected edge, but it is not a universal weather seal.',
  },
  {
    title: 'Complex briefs need more design',
    text: 'Mixed roof zones, lined ceilings, extensive integrated services or difficult structural connections may need a more developed design response.',
  },
] as const;

export const simpleCoverScope = [
  {
    number: '01',
    title: 'Brief and site',
    text: 'We review the space, adjoining rooms, likely connection, levels, exposure and how you want to use the deck.',
  },
  {
    number: '02',
    title: 'Roof, frame and connection',
    text: 'We resolve the roof form, acrylic finish, aluminium frame, house connection and post positions together.',
  },
  {
    number: '03',
    title: 'Drainage and edge protection',
    text: 'Fall, guttering and outlets are considered alongside any selected blind, infill or open edge.',
  },
  {
    number: '04',
    title: 'A defined proposal and pathway',
    text: 'Your proposal records the agreed scope. We confirm consent requirements and the installation pathway for the actual project.',
  },
] as const;

export const simpleCoverProcess = [
  {
    number: '01',
    title: 'Send the basics',
    text: 'Share your suburb, a few photos and approximate dimensions if you know them.',
  },
  {
    number: '02',
    title: 'We check the fit',
    text: 'We assess whether a Simple cover suits the brief or whether the site needs a Custom response.',
  },
  {
    number: '03',
    title: 'Measure and propose',
    text: 'We develop the site, roof, connection, drainage and optional blinds into an agreed proposal.',
  },
  {
    number: '04',
    title: 'Resolve, then build',
    text: 'Once the design and project requirements are in place, we prepare the pergola for delivery and installation.',
  },
] as const;

export const simpleCoverProjects = [
  {
    slug: 'dairy-flat-estate',
    label: 'Clear acrylic / existing roofline',
    summary: 'The aluminium gable follows the existing roofline, with acrylic roofing selected in response to the daylight brief.',
    facts: ['8.6 m recorded width', '3.3 m recorded depth', 'Acrylic gable roof'],
  },
  {
    slug: 'muriwai-courtyard',
    label: 'Opal acrylic / retained footprint',
    summary: 'A new opal-acrylic hip roof replaces the earlier pergola while retaining the established courtyard footprint.',
    facts: ['8.0 m × 5.0 m recorded footprint', '5° recorded pitch', 'Opal acrylic'],
  },
  {
    slug: 'st-heliers-townhouse',
    label: 'Opal acrylic / compact gable',
    summary: 'This 6 m by 3 m gable uses opal acrylic in response to the daylight and glare brief, with a deliberate street-facing frame.',
    facts: ['6.0 m recorded width', '3.0 m recorded depth', 'Opal acrylic'],
  },
] as const;

export const simpleCoverFaqs = [
  {
    question: 'Can I start before I have plans?',
    answer: 'Yes. Send a few photos, your suburb and approximate dimensions if you know them. We first confirm whether a Simple cover is the right pathway and what else is needed for an initial estimate.',
  },
  {
    question: 'Will it darken the rooms beside it?',
    answer: 'Any new roof changes how daylight reaches the rooms beside it. Acrylic admits daylight, but the result still depends on the selected finish, roof depth, orientation and adjoining openings. We review those conditions before recommending clear, grey or opal.',
  },
  {
    question: 'Can I add side blinds?',
    answer: 'Yes. A Simple cover can include one or more drop-down blinds. Opening size, fabric, guides and site exposure are resolved with the frame.',
  },
  {
    question: 'Will it keep all rain out?',
    answer: 'No. The fixed roof provides overhead cover, but open sides can still admit wind-driven rain. Blinds are not a universal weather seal, so we identify the exposed edges and set realistic expectations for the arrangement.',
  },
  {
    question: 'Which acrylic finish should I choose?',
    answer: 'There is no universal best option. Clear, grey and opal change the appearance of the roof and admit daylight differently. The house, orientation, roof area and intended use should lead the decision.',
  },
  {
    question: 'Can the pergola be freestanding?',
    answer: 'Attached and freestanding arrangements are both possible in the wider Sanctuary range. The appropriate structure depends on the house, site, dimensions and project-specific engineering.',
  },
  {
    question: 'Will it need building consent?',
    answer: 'Consent requirements are project-specific. Size, height, boundaries, attachment, use and existing conditions can change the pathway, so we confirm this for the actual site and design.',
  },
] as const;

export const simpleCoverRoofPreference = {
  detailKey: 'acrylicOption' as const,
  options: [
    { label: 'Clear acrylic', value: 'Clear acrylic', roofMaterials: ['acrylic'] },
    { label: 'Light grey acrylic', value: 'Light grey acrylic', roofMaterials: ['acrylic'] },
    { label: 'Dark grey acrylic', value: 'Dark grey acrylic', roofMaterials: ['acrylic'] },
    { label: 'Opal acrylic', value: 'Opal acrylic', roofMaterials: ['acrylic'] },
    { label: 'Unsure: recommend the right option', value: 'Unsure', roofMaterials: [] },
  ],
} as const;
