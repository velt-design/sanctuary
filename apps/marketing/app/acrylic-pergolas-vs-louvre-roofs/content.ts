import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'Are acrylic pergolas better than louvre roofs?', answer: ['Neither roof type is universally better. The useful choice depends on the roof behaviour, daylight, shade, appearance, services and evidence required for the actual site.', 'Compare the completed design and supplier documents rather than relying on a category label.'] },
  { question: 'What is the main difference between acrylic and louvre roofing?', answer: ['An acrylic pergola uses fixed roof glazing selected for a particular daylight character. A louvre proposal is commonly considered because it offers a changing blade position, but the exact movement and operation must be confirmed for that system.', 'That difference affects how each design is specified, controlled and compared.'] },
  { question: 'Does Sanctuary install louvre roofs?', answer: ['Sanctuary\'s published roof offer is fixed acrylic, solid and combination roofs. This guide treats louvre systems as external supplier proposals.', 'The comparison does not present louvres as a Sanctuary product.'] },
  { question: 'Is either roof completely waterproof?', answer: ['Do not accept a universal waterproof claim for either category. Rain management depends on the exact product, roof geometry, joints, flashings, gutters, outlets, installation and site conditions.', 'Request written supplier evidence and design details for the proposed assembly.'] },
  { question: 'Which option is cooler or blocks more heat?', answer: ['That cannot be answered responsibly from the roof category alone. Acrylic tint and opacity vary, while louvre position, blade design and controls vary by system.', 'Ask for product-specific solar or thermal information that applies to the exact specification, and consider orientation, ventilation, shade and the rooms beside the pergola.'] },
  { question: 'Which roof lets in more natural light?', answer: ['Acrylic roof character depends on the selected clear, opal or tinted product and the layout around it. A proposed louvre system changes the overhead opening as its blades move.', 'The useful comparison is how each completed design affects the outdoor area and adjoining windows in the positions you expect to use.'] },
  { question: 'Do louvre roofs need more maintenance than acrylic roofs?', answer: ['Do not infer a maintenance schedule from the category name. A louvre proposal may include moving and control components, while a fixed acrylic assembly still has surfaces, joints and drainage that need care.', 'Compare the written maintenance, access, service and warranty requirements for each exact system.'] },
  { question: 'What should I send for an acrylic and louvre comparison?', answer: ['Send site photos, rough dimensions, orientation and the outcomes you want from rain cover, daylight, shade and appearance.', 'If you already have a louvre proposal, include its drawings, exact product specification, controls, drainage, warranties, maintenance information, inclusions and exclusions so the comparison has a common basis.'] },
] as const;

export const acrylicVsLouvreConfig = {
  marker: 'acrylic-pergolas-vs-louvre-roofs', route: '/acrylic-pergolas-vs-louvre-roofs',
  description: 'Compare acrylic pergolas and louvre roof proposals by roof behaviour, daylight, shade, rain detailing, controls, maintenance evidence and complete installed scope.',
  schemaName: 'Acrylic Pergolas vs Louvre Roofs', serviceName: 'Pergola roof option consultation in Auckland', serviceType: 'Pergola roof design consultation',
  guideFirstLayer: {
    answerBlockId: 'comparison-brief',
    projectBlockId: 'acrylic-comparison-projects',
    projectSlug: 'mt-maunganui-box',
    returnHref: '/products',
    returnLabel: 'Compare Sanctuary pergola options',
    supportingAnswerTitle: 'Roof comparison detail',
    supportingProjectsTitle: 'More completed roof examples',
    supportingSummary: 'Explore roof behaviour, examples and comparison detail',
  },
  hero: { image: '/images/box-landing.jpg', imageAlt: 'Fixed acrylic roof within a dark box-perimeter pergola between modern house wings', objectPosition: '50% 52%', eyebrow: 'Acrylic pergolas vs louvre roofs', title: 'Choose the roof behaviour before choosing the roof label', intro: 'Sanctuary designs fixed acrylic, solid and combination roof approaches. This guide compares those fixed roofs with an external proposal for movable louvres, using the rain, daylight, shade, view and control your site actually needs.', primaryCta: 'Compare your roof brief', secondaryCta: 'Review the matrix', secondaryHref: '#roof-comparison', proof: ['Sanctuary fixed roofs identified', 'External louvre proposals tested', 'Complete scope before headline price'] },
  blocks: [
    { kind: 'split-intro', id: 'comparison-brief', eyebrow: 'Define the required states', title: 'The decision starts with what the roof must do at 8am, 2pm and during rain', paragraphs: [
      'A category comparison is too blunt if it ignores the daily sequence. Some owners want a stable, light-transmitting roof condition. Others place more value on changing the overhead opening.',
      'Write down what should happen to daylight, sky view, shade and rain cover at the moments that matter. Include the effect on windows and rooms beside the pergola.',
      'Only then can an acrylic design and a louvre proposal be compared as two complete assemblies rather than two product names.',
    ] },
    { kind: 'numbered-cards', id: 'comparison-order', eyebrow: 'A fair order of enquiry', title: 'Ask three questions before reading the sales claims', intro: 'A disciplined brief makes product evidence easier to interpret.', items: [
      { title: 'Which roof states matter?', text: 'Describe the fixed or changing overhead conditions you expect for rain, sun, daylight and sky view.' },
      { title: 'What touches the house?', text: 'Identify windows, doors, rooflines, cladding, drainage and interior rooms affected by the new structure.' },
      { title: 'What proof travels with the quote?', text: 'Request the exact product, drawings, controls, engineering, maintenance, warranty, inclusions and exclusions.' },
    ] },
    { kind: 'comparison', id: 'roof-comparison', tone: 'warm', eyebrow: 'Compare like with like', title: 'Use one brief and two columns of evidence', intro: 'The louvre column describes questions for a supplier proposal, not a universal promise about every louvre system.', options: [
      { title: 'Fixed acrylic roof', text: 'A Sanctuary roof approach demonstrated in published residential and commercial projects.' },
      { title: 'Louvre-roof proposal', text: 'A supplier-specific option to assess from its exact drawings, product documents and installed scope.' },
    ], rows: [
      { label: 'Roof state', values: ['The glazing position is fixed. Product, tint, layout, pitch and surrounding form are selected during design.', 'If movable blades are proposed, confirm their usable positions, control method and operating guidance for the exact system.'] },
      { label: 'Daylight', values: ['Daylight character is set through the specified acrylic and the relationship to nearby solid roof zones, battens and rooms.', 'Assess daylight and sky view in each blade position being proposed, including the effect on adjoining windows.'] },
      { label: 'Shade and control', values: ['The overhead condition does not change day to day. Tint, opacity, roof zoning, blinds and orientation are design decisions.', 'Clarify what the moving roof is intended to control, how it is operated and which outcomes are documented by the supplier.'] },
      { label: 'Rain detailing', values: ['Review glazing joints, pitch, house junctions, gutters, outlets and the complete fixed assembly.', 'Review the closed-blade condition, perimeter, internal drainage, overflows, controls and supplier limits in writing.'] },
      { label: 'Services', values: ['Coordinate lighting, heating or blinds with the frame where they form part of the project.', 'Confirm power, motors, controls, sensors, commissioning and service access where included in the proposed system.'] },
      { label: 'Care and support', values: ['Request cleaning, inspection, drainage access and warranty documents for the selected roof and installation.', 'Request maintenance intervals, moving-component access, service responsibilities, parts support and warranty documents.'] },
      { label: 'Quote test', values: ['Confirm frame, acrylic specification, flashings, drainage, fixings, site work, professional work and exclusions.', 'Confirm the same base scope plus every motor, control, sensor, electrical item, commissioning task and service exclusion.'] },
    ], note: 'Claim gate: do not infer waterproofing, heat, UV, wind, lifespan, maintenance, warranty or price performance from either category. Verify the exact product and completed design.' },
    { kind: 'editorial-image', id: 'acrylic-fixed-condition', tone: 'neutral', eyebrow: 'Understand the fixed option', title: 'Acrylic is chosen as part of a roof composition', image: { src: '/images/materials-acrylic.jpg', alt: 'Close view through acrylic pergola roofing and its supporting frame', objectPosition: '50% 48%' }, lead: 'Clear, opal and tinted acrylic choices can create different visual conditions, but the exact product still needs to be named.', items: [
      { title: 'Transparency or diffusion', text: 'Decide whether the design should preserve a clearer sky relationship, soften it, or combine more than one overhead condition.' },
      { title: 'Pane and frame rhythm', text: 'Panel layout, roof form and supporting members determine how the roof reads as architecture.' },
      { title: 'House-side daylight', text: 'Review the rooms and windows beside the pergola, not only the brightness directly beneath it.' },
      { title: 'Fixed does not mean unexamined', text: 'Product documentation, joints, fall, drainage, cleaning access and project-specific checks still belong in the scope.' },
    ] },
    { kind: 'projects', id: 'acrylic-comparison-projects', eyebrow: 'Evidence for what Sanctuary builds', title: 'Acrylic roofs can belong to very different architectures', intro: 'These completed projects demonstrate fixed acrylic used in different forms and contexts. They are not evidence about a louvre product.', items: [
      { slug: 'mt-maunganui-box', label: 'Box-perimeter courtyard', summary: 'A 26.9 square metre first-floor deck cover uses opal acrylic glazing within a low horizontal frame related to the house.', facts: ['8.67 x 3.1 m footprint', '5 degree fixed roof fall'] },
      { slug: 'dairy-flat-estate', label: 'Gable aligned to the home', summary: 'An 8.6 by 3.3 metre aluminium and acrylic gable follows the existing house geometry, with an infilled gable end and open garden side.', facts: ['28.4 m² covered area', '3.0 m overall height'] },
      { slug: 'muriwai-courtyard', label: 'Hipped courtyard roof', summary: 'A 40 square metre opal acrylic roof sits within a hipped form designed as a replacement on the existing footprint.', facts: ['8.0 x 5.0 m footprint', '5 degree fixed roof pitch'] },
      { slug: 'atelier-shu-cafe', label: 'Commercial gable canopy', summary: 'A 36 square metre acrylic roof and aluminium frame form a sheltered zone aligned with the cafe frontage.', facts: ['9.0 x 4.0 m footprint', '30 degree gable form'] },
    ] },
    { kind: 'dark-cards', id: 'comparison-traps', eyebrow: 'Three comparison traps', title: 'A broad product claim is not a project answer', intro: 'The useful evidence belongs to the exact system, site and installed design.', items: [
      { title: 'Category versus specification', text: 'Words such as acrylic or louvre do not identify the product, finish, controls, drainage or warranty being quoted.' },
      { title: 'Feature versus outcome', text: 'A moving roof is a feature. The comparison still needs to show how each proposed state serves your actual use.' },
      { title: 'Headline versus responsibility', text: 'A total is incomplete without the structure, site work, electrical work, professional input, exclusions and owner of each task.' },
    ], links: [{ href: '/acrylic-roof-pergolas-auckland', label: 'Explore acrylic roof pergolas' }, { href: '/pergola-cost-auckland', label: 'Compare pergola quote scope' }] },
    { kind: 'process', id: 'comparison-process', eyebrow: 'Four steps to a fair comparison', title: 'Build the brief, collect the evidence, then choose', intro: 'This sequence keeps the comparison centred on fit rather than competitor criticism.', items: [
      { title: 'Describe the required roof states', copy: 'Record how the space should behave for daily light, sun, sky view and rain, including the effect on the home.' },
      { title: 'Set a common geometry', copy: 'Compare proposals for the same usable area, heights, connections, supports, drainage context and edge requirements.' },
      { title: 'Name every exact system', copy: 'Collect product, control, finish, maintenance, warranty and performance documents tied to each quote.' },
      { title: 'Align the installed scope', copy: 'Check structure, site work, services, engineering, approvals, commissioning, exclusions and next steps side by side before choosing.' },
    ] },
    { kind: 'link-cards', id: 'comparison-next-decisions', tone: 'neutral', eyebrow: 'Continue with exact evidence', title: 'Move from category language to current products and comparable scope', items: [
      { title: 'Review Sanctuary acrylic roofs', text: 'See Sanctuary\'s fixed acrylic approach, current options and product-specific questions.', href: '/acrylic-roof-pergolas-auckland', linkLabel: 'Open the acrylic page' },
      { title: 'Compare complete quotations', text: 'Use the cost guide to align structure, controls, site work, approvals and exclusions.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
      { title: 'Plan the room below', text: 'Test how either roof choice affects furniture, adjoining rooms, edges and services.', href: '/outdoor-rooms-auckland', linkLabel: 'Open the outdoor room guide' },
    ] },
    { kind: 'faq', id: 'acrylic-vs-louvre-faq', tone: 'elevated', eyebrow: 'Questions before preference becomes specification', title: 'A practical acrylic pergola and louvre roof comparison', intro: 'The responsible answer stays tied to the actual product, drawings, site and complete installed scope.', items: faqItems },
  ],
  mobileDisclosureGroups: [
    { id: 'roof-comparison-method', summary: 'How to frame a fair roof comparison', blockIds: ['comparison-order'] },
    { id: 'acrylic-fixed-detail', summary: 'How the fixed acrylic condition is resolved', blockIds: ['acrylic-fixed-condition'] },
    { id: 'roof-comparison-support', summary: 'Roof comparison links and common questions', blockIds: ['comparison-next-decisions', 'acrylic-vs-louvre-faq'] },
  ],
  finalCta: { eyebrow: 'Bring the brief and proposal evidence', title: 'Ask Sanctuary to test the roof decision against your site', text: 'Share the outcomes you want and any proposal you are comparing. Sanctuary can frame its own verified roof scope without pretending every product category performs the same way.', button: 'Compare your roof brief', checklistTitle: 'Useful comparison inputs', checklist: ['Project suburb', 'Wide site and interior photos', 'Rough dimensions and orientation', 'Required roof states', 'Daylight and shade priorities', 'Existing proposal drawings', 'Product and control documents', 'Inclusions, exclusions and warranties'] },
  form: { ariaLabel: 'Pergola roof comparison enquiry form', eyebrow: 'Start with the outcome', heading: 'Describe the roof decision', intro: 'Share the site, the fixed and changing conditions you value, and attach any external louvre proposal. The options below are Sanctuary fixed-roof approaches.', submitLabel: 'Compare your roof brief', messageLabel: 'Required roof behaviour', messagePlaceholder: 'Describe what should happen to rain cover, daylight, shade, sky view and ventilation at the times that matter.', briefFields: [
    { name: 'externalProposal', label: 'External louvre proposal status', type: 'select', options: ['No proposal yet', 'Initial proposal received', 'Drawings and specification available', 'Unsure'] },
    { name: 'roofStates', label: 'Fixed and changing conditions you value', type: 'textarea', placeholder: 'Describe which overhead states matter and when you expect to use them.', wide: true },
    { name: 'comparisonPriorities', label: 'Most important comparison evidence', type: 'text', placeholder: 'For example: adjoining-room daylight, drainage, controls, maintenance or scope', wide: true },
  ], roofPreference: { detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
