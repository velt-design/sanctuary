import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'How much does a pergola cost in Auckland?', answer: ['There is no responsible single figure for a custom pergola without a defined scope. Size, form, spans, roofing, connections, foundations, drainage, access, finish, integrated options and any engineering or approval work all affect cost.', 'Send the suburb, photos and rough dimensions for a first indication based on visible assumptions.'] },
  { question: 'Can Sanctuary give a price from photos and rough dimensions?', answer: ['Photos and approximate dimensions can support an early assessment or indication where enough context is visible. It should state what has been assumed and what still needs site or design confirmation.', 'A final quotation follows a more complete scope.'] },
  { question: 'Is pergola cost based on square metres?', answer: ['Area affects material quantity, but square metres do not capture roof form, spans, height, supports, house connection, drainage, access or integrated features.', 'A square-metre shortcut can make two materially different projects look falsely comparable.'] },
  { question: 'Does a gable pergola cost more than a pitched pergola?', answer: ['Different roof forms use different geometry, framing and detailing, but form alone does not determine the final price. Size, spans, materials, connections and site conditions can outweigh the label.', 'Compare completed scopes rather than assuming a fixed premium for one form.'] },
  { question: 'Do acrylic and solid pergola roofs cost the same?', answer: ['Roof materials create different product, framing, junction and finish requirements. Combination roofs add transitions that also need to be resolved.', 'The quotation should identify the exact selected roof products and included roof zones.'] },
  { question: 'Are blinds, lighting and heating included in pergola pricing?', answer: ['Only if the quotation says they are included. Products, mounting, wiring, controls, trade responsibilities and clearances should be named rather than assumed.', 'Ask for optional items to be separated clearly when you are still deciding.'] },
  { question: 'Can existing decks or concrete be used for the pergola supports?', answer: ['Existing conditions need assessment before they can be relied on. Foundations, deck structure, support positions and any required strengthening depend on the actual site and completed design.', 'Do not compare quotations that make different unstated assumptions about support work.'] },
  { question: 'Are engineering and consent costs included?', answer: ['Inclusions vary with the project and should be stated. The need for engineering, documentation or council processes depends on the property and final design.', 'A quotation should identify what is included, excluded, provisional or still to be confirmed.'] },
  { question: 'Why can two pergola quotes be very different?', answer: ['They may describe different dimensions, structural assumptions, roofing, foundations, drainage, finishes, accessories, trade work or approval responsibilities.', 'Compare the finished outcome and scope line by line before comparing the total.'] },
  { question: 'What information helps Sanctuary prepare a useful estimate?', answer: ['Provide the project suburb, wide photos of the house and outdoor area, rough width and projection, the intended use and any known roof or accessory preferences.', 'Plans, interior views, access information and known constraints help reduce assumptions.'] },
] as const;

export const pergolaCostConfig = {
  marker: 'pergola-cost-auckland', route: '/pergola-cost-auckland',
  description: 'Understand pergola cost in Auckland without a misleading square-metre shortcut. See the real scope drivers, compare quotations and send details for an informed first assessment.',
  schemaName: 'Pergola Cost Auckland', serviceName: 'Custom pergola project assessment and quotation in Auckland', serviceType: 'Custom pergola design and quotation',
  hero: {
    image: '/images/project-waiheke-02.jpg', imageAlt: 'Custom pergola structure showing roof, frame and site-specific scope', objectPosition: '50% 46%',
    eyebrow: 'Pergola cost in Auckland', title: 'A useful pergola price starts with a defined scope, not a square-metre guess',
    intro: 'Sanctuary prices the structure that will actually be designed and installed. Photos and rough dimensions can begin the conversation, but form, spans, roofing, connections, drainage and site work explain the number.',
    primaryCta: 'Request a scoped first look', secondaryCta: 'See what changes cost', secondaryHref: '#cost-drivers',
    proof: ['Assumptions stated early', 'Complete installed scope compared', 'No unsupported starting price'],
  },
  blocks: [
    { kind: 'split-intro', id: 'price-with-context', eyebrow: 'Price needs a denominator', title: 'The total is only meaningful when the finished outcome is clear', paragraphs: [
      'Two pergolas can cover a similar area and still be different projects. One may attach simply to a suitable building edge. Another may need independent supports, complex geometry, mixed roofing or work around an existing deck.',
      'The useful question is not only “how much?” It is “how much for which dimensions, structure, materials, site work and responsibilities?”',
      'A calm estimate makes early assumptions visible. A final quotation replaces those assumptions with an agreed design and scope.',
    ] },
    { kind: 'decision-cards', id: 'cost-drivers', tone: 'warm', eyebrow: 'Four groups of cost drivers', title: 'Trace the price back to the decisions that create it', intro: 'These groups make an early conversation more useful without pretending every detail is already known.', items: [
      { title: 'Geometry and structure', outcome: 'The footprint, height, roof form, spans and support layout.', consider: 'Dimensions, loads, post positions, existing support, foundations and any engineering required.' },
      { title: 'Roof and water path', outcome: 'Acrylic, solid or combination roofing with the required fall and edges.', consider: 'Products, junctions, flashings, gutters, downpipes, discharge and the house connection.' },
      { title: 'Site and installation', outcome: 'The work needed to safely prepare, access and install the agreed design.', consider: 'Existing decks, ground, services, restricted access, demolition, protection and sequencing.' },
      { title: 'Finish and integrations', outcome: 'The visible finish and features that complete how the room works.', consider: 'Frame coating, lining, blinds, screens, lighting, heating, wiring and other trade responsibilities.' },
    ] },
    { kind: 'editorial-image', id: 'estimate-quality', tone: 'neutral', eyebrow: 'Improve the estimate before refining the design', title: 'Four pieces of context remove avoidable guesswork', image: { src: '/images/project-tindalls-bay.jpg', alt: 'Complex pergola scope around an Auckland home with multiple roof zones', objectPosition: '50% 42%' }, lead: 'You do not need construction drawings to make the first reply more grounded.', items: [
      { title: 'Wide site photos', text: 'Show the house edge, deck or patio, ground, access and obstacles rather than only the empty area.' },
      { title: 'Rough dimensions', text: 'Width, projection and approximate height establish scale while remaining clearly provisional.' },
      { title: 'Intended use', text: 'Dining, circulation, vehicle cover or a complete outdoor room leads to different spatial and integration needs.' },
      { title: 'Known preferences', text: 'Roof effect, form, blinds, lining or lighting can be noted as preferences without treating them as settled.' },
    ] },
    { kind: 'projects', id: 'cost-projects', eyebrow: 'Similar labels, different scopes', title: 'Project photography reveals what an area figure leaves out', intro: 'These projects are not price examples. They show why geometry, materials and integrated work need to be understood before a number is compared.', items: [
      { slug: 'st-heliers-townhouse', label: 'Compact gable with custom end framing', summary: 'A 6 m by 3 m gable uses opal acrylic roofing and a bespoke aluminium pattern where street-facing appearance is part of the scope.' },
      { slug: 'warkworth-outdoor-room', label: 'Complete freestanding outdoor room', summary: 'A larger gable project brings together structure, mixed roofing, cedar lining, a new deck, fireplace and lighting.' },
      { slug: 'ardmore-box-carport', label: 'Wide box-perimeter carport', summary: 'Steel beams, aluminium rafters, acrylic roofing, internal gable geometry and integrated lighting serve a vehicle-cover brief.' },
      { slug: 'goodhome-commercial-terrace', label: 'Commercial courtyard coordination', summary: 'A two-zone gable roof follows the existing architecture across a hospitality setting with commercial access and coordination needs.' },
    ] },
    { kind: 'dark-cards', id: 'estimate-boundary', eyebrow: 'Know what kind of number you are reading', title: 'An early indication and a final quotation do different jobs', intro: 'Confidence comes from matching the number to the level of evidence behind it.', items: [
      { title: 'Early indication', text: 'Useful for testing broad fit when it names dimensions, preferences, assumptions and the information still missing.' },
      { title: 'Developed estimate', text: 'Useful after more site and design context has narrowed the geometry, materials, support and integrated options.' },
      { title: 'Final quotation', text: 'Useful for commitment when the agreed design, inclusions, exclusions, options, responsibilities and next steps are explicit.' },
    ], links: [{ href: '/custom-pergolas-auckland', label: 'See how a custom scope is developed' }, { href: '/projects', label: 'Compare completed project scopes' }] },
    { kind: 'numbered-cards', id: 'quote-comparison', eyebrow: 'Compare like with like', title: 'Three checks before treating one quote as cheaper', intro: 'A lower total may be a smaller scope, a different assumption or a genuinely different proposal.', items: [
      { title: 'Match the finished design', text: 'Confirm dimensions, roof form, materials, finish, post layout and integrated features describe the same intended result.' },
      { title: 'Match the site work', text: 'Check foundations, connections, flashings, drainage, access, demolition and protection are included or excluded consistently.' },
      { title: 'Match the responsibilities', text: 'Identify engineering, approvals, electrical work, GST, provisional items and who owns each unresolved step.' },
    ] },
    { kind: 'process', id: 'cost-process', eyebrow: 'From rough context to a reliable scope', title: 'Let the number become more precise as the evidence improves', intro: 'The process should reduce assumptions rather than hide them inside a headline figure.', items: [
      { title: 'Send the pricing context', copy: 'Provide suburb, photos, rough dimensions, intended use and known options. Include access or existing-structure concerns.' },
      { title: 'Receive a first assessment', copy: 'Sanctuary identifies the likely scope, material decisions, missing evidence and whether a useful early indication can be prepared.' },
      { title: 'Review site and design', copy: 'Connections, structure, roof form, drainage, access and integrations are assessed in context.' },
      { title: 'Confirm the comparable scope', copy: 'Dimensions, materials, inclusions, exclusions, options and project-specific requirements are documented together.' },
      { title: 'Decide with the whole proposal visible', copy: 'The quotation provides the agreed basis for proceeding, with timing confirmed for the actual project and current programme.' },
    ] },
    { kind: 'scope', id: 'cost-checklist', eyebrow: 'The quotation is a design document too', title: 'A trustworthy total has a readable scope behind it', lead: 'The more important the decision, the less useful a bare number becomes.', paragraphs: ['Use the scope to understand what will be built, what remains optional and which responsibilities sit outside the proposal.'], factors: [
      ['Measured geometry', 'Footprint, height, roof form, falls and openings.'], ['Specified assembly', 'Frame, structural mix, roof products, finish and visible details.'], ['Site work', 'Connections, foundations, drainage, access and existing conditions.'], ['Project requirements', 'Integrations, trades, engineering, approvals and programme assumptions.'],
    ], checklistLead: 'A final comparison should make these items visible.', checklist: ['Dimensions and drawing revision', 'Frame, roof and finish specification', 'Posts, supports and foundations', 'Flashings, gutters and downpipes', 'Blinds, screens and electrical items', 'Engineering and approval responsibility', 'Access assumptions and exclusions', 'GST, options, validity and next step'] },
    { kind: 'faq', id: 'pergola-cost-faq', tone: 'elevated', eyebrow: 'Questions behind the total', title: 'How to ask better questions about Auckland pergola cost', intro: 'No price is published here without an approved dated scope. These answers explain how to reach a project-specific number.', items: faqItems },
  ],
  finalCta: { eyebrow: 'Trade guesswork for useful context', title: 'A few photos can make the first price conversation much better', text: 'Show the house, ground, access and adjoining rooms. Add rough dimensions and intended use so Sanctuary can explain what is known, what is assumed and what needs a closer look.', button: 'Request a scoped first look', checklistTitle: 'Send if available', checklist: ['Project suburb', 'Wide photos of the site and house', 'Rough width, projection and height', 'A view from inside', 'Intended use of the space', 'Roof or form preferences', 'Known access or support constraints', 'Plans or sketches'] },
  form: { ariaLabel: 'Pergola cost enquiry form', eyebrow: 'Price the actual project', heading: 'Request a scoped first look', intro: 'Share the site, rough dimensions and intended use. Sanctuary can then assess the likely scope and explain what still needs confirmation before a final quotation.', submitLabel: 'Request a scoped first look', roofPreference: { label: 'Possible roof approach', detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
