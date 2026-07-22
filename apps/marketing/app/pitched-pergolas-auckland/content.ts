import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'What is a pitched pergola?', answer: ['A mono-pitched pergola uses one roof plane falling from a high edge to a low edge. The simple silhouette places more emphasis on the exact height, fall, connection and drainage path.', 'Sanctuary develops those dimensions around the home, site and intended use.'] },
  { question: 'When does a mono-pitched pergola suit an Auckland home?', answer: ['A single roof plane can suit a restrained extension, a narrow eave condition or a site where drainage needs one clear direction.', 'Available attachment height, the low edge, doors, windows, roof depth and appearance from inside should be checked before the form is selected.'] },
  { question: 'Can a pitched pergola sit above existing doors or sliders?', answer: ['Often, but the high and low edges must be considered against door heads, eaves, soffits, cladding, flashings and the required roof fall.', 'Actual clearances and support conditions need site assessment.'] },
  { question: 'Can a pitched pergola be freestanding?', answer: ['Yes. A freestanding mono-pitched structure may be considered where attachment is unsuitable or an independent cover better serves the site.', 'Foundations, stability, drainage and the relationship to the nearby home still need to be resolved for the completed design.'] },
  { question: 'Which roofing works on a pitched pergola?', answer: ['Acrylic, solid and combination roof approaches can be considered where they suit the design. The selected product, required fall, support, junctions and drainage need to work together.', 'Acrylic decisions should also account for roof depth, orientation and adjoining-room daylight.'] },
  { question: 'Where does water go on a mono-pitched roof?', answer: ['Water travels down the single roof plane to the low-edge gutter, then through downpipes to the agreed discharge point.', 'Fall, guttering, flashings, overflow and discharge are project-specific design decisions.'] },
  { question: 'Can blinds or screens be added to a pitched pergola?', answer: ['Blinds, acrylic infill panels or slat screens can be considered where an exposed edge needs more protection or privacy.', 'Mounting, headboxes, controls, clearances and the effect on openness should be coordinated with the frame before fabrication.'] },
] as const;

export const pitchedPergolasConfig = {
  marker: 'pitched-pergolas-auckland', route: '/pitched-pergolas-auckland',
  description: 'Explore pitched pergolas in Auckland. Plan the high edge, low edge, roof fall, daylight, drainage and house connection as one restrained roof form.',
  schemaName: 'Pitched Pergolas Auckland', serviceName: 'Custom pitched pergola design and installation in Auckland', serviceType: 'Mono-pitched pergola design and installation',
  hero: { image: '/images/product-pitched-01.jpg', imageAlt: 'Custom mono-pitched pergola with a clean single roof plane', objectPosition: '50% 46%', eyebrow: 'Pitched pergolas in Auckland', title: 'One roof plane leaves nowhere for a weak line to hide', intro: 'A mono-pitched pergola looks simple because the high edge, low edge, fall and frame have been resolved together. Sanctuary sets that plane around the house connection, the doors below, the daylight inside and the path for rainwater.', primaryCta: 'Send the pitched project', secondaryCta: 'Follow the roof plane', secondaryHref: '#pitched-anatomy', proof: ['High and low edges resolved together', 'One clear drainage direction', 'Custom attached or freestanding design'] },
  blocks: [
    { kind: 'split-intro', id: 'pitched-discipline', eyebrow: 'Simple is not automatic', title: 'The fewer the lines, the more each line matters', paragraphs: [
      'A mono-pitched roof is read from the high attachment or support down to one low edge. Its restraint can suit a contemporary home, but only when the plane has enough fall without pushing the lower beam into doors, views or circulation.',
      'Roof depth matters too. A deeper plane increases the distance between its high and low points and changes the light reaching rooms beside the deck.',
      'The design task is to find a fall, height and proportion that work technically and still feel calm from inside and outside.',
    ] },
    { kind: 'editorial-image', id: 'pitched-anatomy', tone: 'neutral', eyebrow: 'Read it from high edge to low edge', title: 'Four conditions define the single roof plane', image: { src: '/images/project-velskov-02.jpg', alt: 'Side view of a shallow-pitch pergola beneath a forest canopy', objectPosition: '50% 48%' }, lead: 'A section drawing tells more than the roof label.', items: [
      { title: 'High edge', text: 'Attachment height or independent support establishes where the plane begins and how it relates to the house.' },
      { title: 'Low edge', text: 'The lower beam and gutter need clear headroom, a controlled view and enough space for the intended use below.' },
      { title: 'Fall and depth', text: 'Roof projection and required fall work together, affecting height difference, drainage and the visual slope.' },
      { title: 'Direction', text: 'The roof sends water, shade and the eye toward one edge, so that edge must be deliberately placed and detailed.' },
    ] },
    { kind: 'projects', id: 'pitched-projects', eyebrow: 'One plane in different settings', title: 'Pitched pergolas can be quiet, layered or highly site-specific', intro: 'These projects show how the same basic roof logic changes with use, location and adjacent architecture.', items: [
      { slug: 'tindalls-bay-pavilion', label: 'Layered patio and carport roof', summary: 'Pitched roof zones weave around 108 square metres of patio and carport using different roof and edge treatments where conditions change.', facts: ['108 m² combined scope', 'Existing-house nooks coordinated'] },
      { slug: 'velskov-forest', label: 'Shallow profile beneath the canopy', summary: 'A freestanding 7.0 by 6.0 metre pergola uses a shallow pitched roof to provide cover without competing with the forest canopy.', facts: ['42 m² freestanding cover', '7 degree pitch'] },
      { slug: 'waiheke-holiday-home', label: 'One fall hidden behind a perimeter', summary: 'A 5.0 by 4.0 metre coastal deck cover conceals its roof fall and gutters behind a straight perimeter beam line.', facts: ['20 m² covered deck', '4 degree fall'] },
      { slug: 'kiwi-rail-platform', label: 'Commercial circulation cover', summary: 'A 30 metre long pitched canopy shows how one roof plane can organise a long, operationally focused covered route.', facts: ['30.0 x 3.0 m plan', '115 m² total area'] },
    ] },
    { kind: 'decision-cards', id: 'pitched-decisions', tone: 'warm', eyebrow: 'Follow the fall through the whole design', title: 'Four decisions keep a pitched roof precise', intro: 'The form succeeds when height, structure, material and water all move in the same direction.', items: [
      { title: 'Connection and high edge', outcome: 'A clear starting height and structural relationship to the home or independent supports.', consider: 'Cladding, fascia, soffit, roof edge, support, flashing, door heads and whether freestanding is preferable.' },
      { title: 'Low edge and outlook', outcome: 'A lower beam and gutter positioned without unnecessarily closing the room.', consider: 'Headroom, view, circulation, furniture, boundary conditions and the total roof depth.' },
      { title: 'Roofing and daylight', outcome: 'Acrylic, solid or combined roofing placed for the light and shade required.', consider: 'Orientation, adjoining windows, direct sun, underside character and exact product requirements.' },
      { title: 'Fall and drainage', outcome: 'One coordinated route from the high edge to gutter, downpipe and discharge.', consider: 'Required fall, roof junctions, flashings, guttering, overflow, discharge and maintenance access.' },
    ] },
    { kind: 'dark-cards', id: 'pitched-boundaries', eyebrow: 'A clean form still needs careful qualifications', title: 'The roof plane cannot answer every site question on its own', intro: 'Structure, weather edges and approval remain project-specific.', items: [
      { title: 'The low edge has a limit', text: 'A long projection and required fall may lower the outer edge. Feasible height must be checked against the actual house and use below.' },
      { title: 'The sides remain open', text: 'Overhead roofing manages rain on the plane, while wind-driven rain and low sun can enter at the open edges.' },
      { title: 'The span needs evidence', text: 'Post positions and member sizes depend on dimensions, loads, supports, exposure and any engineering required.' },
    ], links: [{ href: '/products/pergolas/pitched', label: 'Review the existing pitched product page' }, { href: '/acrylic-roof-pergolas-auckland', label: 'Review acrylic roof and daylight decisions' }] },
    { kind: 'numbered-cards', id: 'pitched-fit', eyebrow: 'Where restraint helps', title: 'A mono-pitch works best when its direction supports the brief', intro: 'Choose the form for what its single plane resolves.', items: [
      { title: 'A quiet extension is preferred', text: 'The roof can project from the building with a restrained silhouette and one clearly defined outer edge.' },
      { title: 'Height is available in the right place', text: 'The house or independent supports allow a useful high edge while preserving adequate height at the low edge.' },
      { title: 'Drainage benefits from one direction', text: 'The site provides a sensible low side for guttering, downpipes and the agreed discharge path.' },
    ] },
    { kind: 'link-cards', id: 'pitched-next-decisions', tone: 'neutral', eyebrow: 'Compare before choosing', title: 'Place the single plane in the wider brief', items: [
      { title: 'Compare a central ridge', text: 'Review the added volume and end condition of a gable pergola.', href: '/gable-pergolas-auckland', linkLabel: 'Open the gable guide' },
      { title: 'Resolve difficult high and low edges', text: 'Use the custom guide for constrained attachments, level changes, longer openings and renovation coordination.', href: '/custom-pergolas-auckland', linkLabel: 'Open the custom guide' },
      { title: 'Compare the complete scope', text: 'Review price factors, drainage responsibilities and approval allowances in the Pergola Cost guide.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
    ] },
    { kind: 'faq', id: 'pitched-faq', tone: 'elevated', eyebrow: 'Questions along the roof plane', title: 'What to confirm before choosing a pitched pergola', intro: 'The final section depends on the house, site, selected products and completed design.', items: faqItems },
  ],
  finalCta: { eyebrow: 'Photograph both edges', title: 'Show where the roof could start and where it needs to finish', text: 'A straight-on photo can hide the height problem. Include side views, door heads, eaves, ground and the preferred drainage edge so the first assessment can follow the whole plane.', button: 'Send the pitched project', checklistTitle: 'Useful first inputs', checklist: ['Project suburb', 'House-edge and side-view photos', 'Views from inside', 'Rough width and projection', 'Approximate high and low clearances', 'Preferred drainage side, if known', 'Roof material preference', 'Plans or sketches'] },
  form: { ariaLabel: 'Pitched pergola project enquiry form', eyebrow: 'Start with both edges', heading: 'Send your pitched pergola project', intro: 'Share the house connection, doors, side views and rough dimensions. You can leave the exact fall, support and roof material open for assessment.', submitLabel: 'Send the pitched project', messageLabel: 'What should the single roof plane resolve?', messagePlaceholder: 'Describe the house connection, available height, desired low edge, drainage direction and view you want to preserve.', briefFields: [
    { name: 'drainageEdge', label: 'Preferred drainage edge', type: 'text', placeholder: 'Note the side if known, or leave open' },
    { name: 'heightConstraints', label: 'High and low edge constraints', type: 'textarea', placeholder: 'Note eaves, soffits, door heads, windows, steps or boundaries that affect the section.', wide: true },
  ], roofPreference: { label: 'Possible roof approach', detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
