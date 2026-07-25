import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'What is a gable pergola?', answer: ['A gable pergola has two roof planes meeting at a central ridge. The form creates a defined centre and more height through the middle of the covered area.', 'Pitch, ridge height, eaves and gable-end treatment are developed for the specific home and site.'] },
  { question: 'When does a gable pergola suit an Auckland home?', answer: ['A gable can suit a wider deck, a space that benefits from a stronger central volume or a home whose existing roof geometry gives the new ridge a clear relationship.', 'Available height, doors, windows, drainage, outlook and the desired presence should be assessed before the form is selected.'] },
  { question: 'Does the gable pitch need to match the house?', answer: ['Not automatically. Matching or relating to an existing pitch can help in some designs, while other sites need a different proportion or a freestanding response.', 'The useful test is whether ridge, eaves, width and gable end feel coherent with the building and outdoor room.'] },
  { question: 'Can a gable pergola be attached or freestanding?', answer: ['Both arrangements can be considered. Attachment depends on support, cladding, clearances, flashing and drainage at the existing building. A freestanding gable can create an independent pavilion beside the house.', 'The final structure follows site assessment and the completed design.'] },
  { question: 'Can a gable pergola use acrylic roofing?', answer: ['Yes. Sanctuary project records include gable pergolas with clear and opal acrylic roofing. Solid and combination roof approaches can also be considered where they suit the project.', 'The exact products, roof zones, junctions and written information should be confirmed in the final scope.'] },
  { question: 'Can the gable end be open or infilled?', answer: ['An open end preserves the strongest visual connection beyond the roof. Infill or glazing may be considered where the design needs more edge definition or protection.', 'Any infill changes wind exposure, views, structure and the visual weight of the end, so it should be designed with the whole pergola.'] },
  { question: 'How is rainwater managed on a gable pergola?', answer: ['The two roof planes fall away from the ridge toward their gutters. Flashings, gutters, downpipes and discharge points need to be coordinated with the house connection and gable geometry.', 'Capacity and detailing must be resolved for the actual roof and site.'] },
] as const;

export const gablePergolasConfig = {
  marker: 'gable-pergolas-auckland', route: '/gable-pergolas-auckland',
  description: 'Explore gable pergolas in Auckland. Understand ridge height, pitch, gable ends, roofing, drainage and house integration before planning your project.',
  schemaName: 'Gable Pergolas Auckland', serviceName: 'Custom gable pergola design and installation in Auckland', serviceType: 'Gable pergola design and installation',
  hero: { image: '/images/project-riverhead-gable-02.jpg', imageAlt: 'Custom black gable pergola beside a pool and Auckland home', objectPosition: '50% 45%', eyebrow: 'Gable pergolas in Auckland', title: 'A gable should borrow the home’s logic, not simply copy its pitch', intro: 'The central ridge gives an outdoor room height and presence. Sanctuary balances that volume with the existing roofline, available clearances, the view through the end and the practical path for structure and drainage.', primaryCta: 'Send the gable project', secondaryCta: 'Read the gable decisions', secondaryHref: '#gable-anatomy', proof: ['Ridge and eaves proportioned together', 'Openings protected where feasible', 'Roof and gable end resolved as one form'] },
  blocks: [
    { kind: 'split-intro', id: 'gable-volume', eyebrow: 'Height changes the room', title: 'The ridge is not decoration. It reorganises the space below.', paragraphs: [
      'A gable introduces a clear centreline. From beneath, it can give a dining table, lounge or circulation zone a stronger sense of place. From outside, it adds a visible silhouette that needs to sit comfortably beside the home.',
      'That makes width, pitch, ridge height and eave height inseparable. Raise one without considering the others and the roof can feel steep, squat or disconnected.',
      'The design should also work at the ends, where views, infill, framing and weather exposure become most visible.',
    ] },
    { kind: 'editorial-image', id: 'gable-anatomy', tone: 'neutral', eyebrow: 'Read the whole section', title: 'Four lines determine whether the gable feels resolved', image: { src: '/images/project-st-heliers-01.jpg', alt: 'Street-facing gable pergola with custom end framing in St Heliers', objectPosition: '50% 50%' }, lead: 'The gable is understood in section as much as in plan.', items: [
      { title: 'Ridge height', text: 'The highest point establishes scale, interior volume and the relationship to the house roof beyond.' },
      { title: 'Eave lines', text: 'The lower edges must work with doors, windows, headroom, gutters and the view from inside.' },
      { title: 'Pitch and width', text: 'These dimensions set the roof proportion and influence the framing, sheet layout and visual weight of the end.' },
      { title: 'Gable end', text: 'Open framing, custom pattern or infill changes outlook, exposure and how strongly the roof presents from the garden or street.' },
    ] },
    { kind: 'projects', id: 'gable-projects', eyebrow: 'One form, several architectural roles', title: 'A gable can extend, stand apart or address the street', intro: 'Completed projects show why the ridge alone does not define the design.', items: [
      { slug: 'dairy-flat-estate', label: 'Continue the existing roofline', summary: 'An 8.6 by 3.3 metre aluminium and acrylic gable extends the house form, with the end treatment adding shelter while retaining the garden connection.', facts: ['28.4 m² covered area', '3.0 m overall height'] },
      { slug: 'st-heliers-townhouse', label: 'Give the end a visible identity', summary: 'A 6.0 by 3.0 metre cover uses opal acrylic roofing and bespoke aluminium end framing for a deliberate street-facing presence.', facts: ['18 m² covered area', 'Custom gable-end pattern'] },
      { slug: 'warkworth-outdoor-room', label: 'Create an independent pavilion', summary: 'A 5.0 by 6.0 metre freestanding gable combines glazed and solid roof areas with cedar lining, a deck, fireplace and lighting.', facts: ['30 m² freestanding room', '30 degree pitch'] },
      { slug: 'goodhome-commercial-terrace', label: 'Repeat a commercial facade rhythm', summary: 'A 10.09 by 6.7 metre, two-zone gable relates to the 25 degree pitch and repeated gables of the hospitality building.', facts: ['67.7 m² courtyard cover', '25 degree roof relationship'] },
    ] },
    { kind: 'decision-cards', id: 'gable-decisions', tone: 'warm', eyebrow: 'Design the form in section', title: 'Four gable decisions arrive before material colour', intro: 'The gable works when its volume, support, end and water path tell the same story.', items: [
      { title: 'Attached or freestanding', outcome: 'A clear structural relationship to the existing home.', consider: 'Support, cladding, roof edge, clearances, flashing, foundations and whether independence is preferable.' },
      { title: 'Pitch and height', outcome: 'A ridge and eaves proportioned to the covered width and the architecture nearby.', consider: 'Door heads, windows, rooflines, outlook, internal scale and any project-specific constraints.' },
      { title: 'Roof and end treatment', outcome: 'Acrylic, solid or combined roof zones coordinated with an open, framed or infilled gable end.', consider: 'Light, shade, views, weather edges, product junctions and the visual weight of the elevation.' },
      { title: 'Structure and drainage', outcome: 'Ridge, rafters, beams, gutters and downpipes resolved as one buildable assembly.', consider: 'Spans, supports, loads, fall, discharge, access and any engineering required.' },
    ] },
    { kind: 'numbered-cards', id: 'gable-fit', eyebrow: 'When the form earns its place', title: 'A gable is useful for more than making the roof taller', intro: 'Choose it when the central volume and visible end help solve the actual brief.', items: [
      { title: 'The room needs a clear centre', text: 'The ridge can organise a wider dining or lounge area and give the covered space a legible main volume.' },
      { title: 'The house offers a strong relationship', text: 'Existing gables, roof pitch or facade rhythm may give the new form an architectural line to continue or interpret.' },
      { title: 'The end view matters', text: 'An open or carefully framed gable can preserve outlook and make the roof feel more connected to the landscape beyond.' },
    ] },
    { kind: 'dark-cards', id: 'gable-boundaries', eyebrow: 'Do not promise from the silhouette', title: 'The gable label does not settle structure, weather or approval', intro: 'The visible form is only the beginning of the technical answer.', items: [
      { title: 'Height needs property context', text: 'Ridge and eave dimensions interact with the house, boundary conditions and any relevant planning or approval requirements.' },
      { title: 'Open ends remain open to weather', text: 'A roof manages rain landing on its planes. Wind-driven rain and low sun can still reach the space through the gable and side edges.' },
      { title: 'Spans need the completed design', text: 'Post locations and member sizes depend on dimensions, loads, supports, exposure and any engineering required.' },
    ], links: [{ href: '/products/pergolas/gable', label: 'Review the existing gable product page' }, { href: '/pergola-cost-auckland', label: 'Review gable cost drivers in context' }] },
    { kind: 'link-cards', id: 'gable-next-decisions', tone: 'neutral', eyebrow: 'Compare before choosing', title: 'Place the gable decision in the wider brief', items: [
      { title: 'Compare a single roof plane', text: 'Review the quieter silhouette and one-direction fall of a mono-pitched pergola.', href: '/pitched-pergolas-auckland', linkLabel: 'Open the pitched guide' },
      { title: 'Resolve a difficult gable connection', text: 'Use the custom guide when ridge, supports, levels or the existing roof make the obvious section unworkable.', href: '/custom-pergolas-auckland', linkLabel: 'Open the custom guide' },
      { title: 'Compare the complete scope', text: 'Review price factors, inclusions and approval allowances in the Pergola Cost guide.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
    ] },
    { kind: 'faq', id: 'gable-faq', tone: 'elevated', eyebrow: 'Questions about the central ridge', title: 'What to resolve before choosing a gable pergola', intro: 'The final answer depends on the house, dimensions, products and completed design.', items: faqItems },
  ],
  mobileDisclosureGroups: [
    { id: 'gable-decisions-detail', summary: 'How the main gable decisions work together', blockIds: ['gable-decisions'] },
    { id: 'gable-planning-support', summary: 'Gable planning links and common questions', blockIds: ['gable-next-decisions', 'gable-faq'] },
  ],
  finalCta: { eyebrow: 'Show the roofline', title: 'A side-on photo can be as useful as the deck dimensions', text: 'Include the existing eaves, doors, windows and roof beyond the proposed area. That context helps Sanctuary assess whether a gable has a convincing place to begin and end.', button: 'Send the gable project', checklistTitle: 'Useful first inputs', checklist: ['Project suburb', 'Wide front and side photos', 'Views from inside the house', 'Rough width and projection', 'Approximate available height', 'Preferred open or treated gable end', 'Roof material preference, if known', 'Plans or sketches'] },
  form: { ariaLabel: 'Gable pergola project enquiry form', eyebrow: 'Start with the section', heading: 'Send your gable pergola project', intro: 'Share the roofline, openings, rough dimensions and intended use. You can leave the final pitch, ridge and roof material open for assessment.', submitLabel: 'Send the gable project', messageLabel: 'Why are you considering a gable?', messagePlaceholder: 'Describe the volume, roofline relationship, view or room arrangement you want the central ridge to support.', briefFields: [
    { name: 'gableEndPreference', label: 'Gable-end preference', type: 'select', options: ['Open end', 'Framed end', 'Infill to be explored', 'Unsure'] },
    { name: 'rooflineContext', label: 'Existing roofline and opening context', type: 'textarea', placeholder: 'Note door heads, eaves, windows, approximate ridge relationship or other height constraints.', wide: true },
  ], roofPreference: { detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
