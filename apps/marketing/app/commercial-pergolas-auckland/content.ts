import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'What kinds of commercial pergola projects does Sanctuary undertake?', answer: ['Sanctuary publishes completed work across hospitality courtyards, cafe frontage, recreation settings, workplace circulation and other selected commercial sites.', 'Suitability depends on the brief, site, programme, procurement context and the responsibilities Sanctuary is being asked to carry.'] },
  { question: 'Can a commercial pergola support an operating venue?', answer: ['The design can be planned around customer and staff routes, seating, doors, views, signage, services and access that must remain functional.', 'Construction staging and any operating constraints need to be agreed for the actual site; continuous operation should never be assumed without a confirmed programme.'] },
  { question: 'Does Sanctuary work with architects and engineers?', answer: ['Published Sanctuary projects include collaboration with client architects, engineers and wider trade teams.', 'The project scope should identify the design author, document owner, reviewers, producer statements or other professional inputs and the party responsible for each decision.'] },
  { question: 'Which roof types suit a commercial pergola?', answer: ['Acrylic, solid and combination roofs, along with pitched, gable and other forms, can serve different spatial and architectural briefs.', 'Selection depends on daylight, shade, building connection, drainage, services, appearance and the product evidence required for the project.'] },
  { question: 'Can lighting, heating, blinds or signage be integrated?', answer: ['These elements can be considered where they suit the structure, products and commercial brief. Completed projects show examples of coordinated lighting, blinds and future fixing zones.', 'Loads, clearances, power, controls, fixing details, trade interfaces, access and approvals need named owners before fabrication.'] },
  { question: 'Can the pergola align with an existing brand or building?', answer: ['Frame geometry, roof form, colour, sightlines and service placement can be developed in response to the building and venue identity.', 'Brand integration works best when exact colours, signage zones, landlord constraints and architectural references are supplied early.'] },
  { question: 'What maintenance information should a commercial project receive?', answer: ['Request care, inspection, drainage access, product and warranty documentation that matches the exact installed assembly.', 'The handover should also identify who maintains integrated elements supplied by other trades and how safe access is provided.'] },
  { question: 'What should be included in a commercial pergola enquiry?', answer: ['Share the site address, business or facility use, photos, drawings, approximate dimensions, required dates and the people involved in approval.', 'Include operating hours, customer and staff routes, services, signage, access, landlord conditions and any existing consultant documents.'] },
] as const;

export const commercialPergolasConfig = {
  marker: 'commercial-pergolas-auckland', route: '/commercial-pergolas-auckland',
  enquiryType: 'commercial',
  description: 'Plan a commercial pergola in Auckland around customers, staff, circulation, frontage, services, staging and clear project responsibility. Review Sanctuary project evidence.',
  schemaName: 'Commercial Pergolas Auckland', serviceName: 'Commercial pergola design and installation in Auckland', serviceType: 'Commercial pergola design and installation',
  hero: { image: '/images/project-goodhome-04.jpg', imageAlt: 'Occupied Auckland hospitality courtyard beneath a lit acrylic gable pergola', objectPosition: '50% 42%', eyebrow: 'Commercial pergolas in Auckland', title: 'A commercial pergola has to work before, during and after service', intro: 'Sanctuary plans commercial cover around the people moving below it, the building behind it and the teams required to deliver it. Customer experience, staff circulation, services, staging and responsibility belong in the brief from the start.', primaryCta: 'Share the commercial brief', secondaryCta: 'Map the operation', secondaryHref: '#commercial-brief', proof: ['Use and circulation first', 'Consultant and trade interfaces named', 'Scope built for handover'] },
  blocks: [
    { kind: 'split-intro', id: 'commercial-cover', eyebrow: 'Cover changes the operation', title: 'The structure becomes part of a working place', paragraphs: [
      'At a restaurant it may sit over tables, queues and staff routes. At a workplace it may connect entrances. At a recreation site it may share space with visitors, signage and an active programme.',
      'Those relationships define more than the roof footprint. They influence clearances, posts, lighting, drainage, edges, access and the sequence in which work can happen.',
      'A commercial pergola should therefore be briefed as part of the operation and property, not as an isolated product purchase.',
    ] },
    { kind: 'numbered-cards', id: 'commercial-brief', eyebrow: 'Set three plans on the table', title: 'People, place and delivery need to agree', intro: 'The useful commercial brief connects daily use to architecture and procurement.', items: [
      { title: 'The operating plan', text: 'Map customers, staff, seating, doors, queues, circulation, opening hours and the moments that must not be obstructed.' },
      { title: 'The site plan', text: 'Locate the building, boundaries, services, drainage, foundations, access, signage and any landlord or consultant constraints.' },
      { title: 'The responsibility plan', text: 'Name who designs, reviews, approves, supplies, powers, installs, commissions and maintains every connected element.' },
    ] },
    { kind: 'editorial-image', id: 'commercial-circulation', tone: 'neutral', eyebrow: 'Follow the people through the plan', title: 'A covered route is still a route', image: { src: '/images/project-kiwi-rail-01.jpg', alt: 'Long commercial canopy framing a pedestrian route between Auckland office buildings', objectPosition: '50% 50%' }, lead: 'The footprint must make sense from the first approach to the final doorway.', items: [
      { title: 'Arrival and wayfinding', text: 'Protect the intended path without hiding entries, signs, frontage or the cues people use to understand the site.' },
      { title: 'Clear movement', text: 'Test post positions, headroom, thresholds, doors, seating and service routes against the actual users of the space.' },
      { title: 'Day and evening use', text: 'Coordinate daylight, artificial lighting and controls where the route or venue operates through changing conditions.' },
      { title: 'Maintenance access', text: 'Keep drainage, lights, controls and other serviceable elements reachable within the documented operating plan.' },
    ] },
    { kind: 'projects', id: 'commercial-projects', eyebrow: 'Commercial proof across different briefs', title: 'The operation changes the architecture', intro: 'These completed Sanctuary projects respond to hospitality, workplace, recreation and retail-facing contexts.', items: [
      { slug: 'goodhome-commercial-terrace', label: 'Hospitality courtyard', summary: 'A 10.09 by 6.7 metre, two-zone gable extends a restaurant courtyard while following the villa-style facade.', facts: ['67.7 m² hospitality cover', '25 degree gable relationship'] },
      { slug: 'kiwi-rail-platform', label: 'Workplace circulation', summary: 'A 30 metre long aluminium and acrylic canopy forms a covered link between important routes at the KiwiRail head office.', facts: ['115 m² circulation canopy', 'Architect-led project'] },
      { slug: 'lilliput-mini-golf', label: 'Recreation and staged renovation', summary: 'A 12.0 by 6.0 metre pitched pergola covers circulation and seating within a staged site refresh coordinated with the client design team.', facts: ['72 m² covered area', 'Existing levels and sightlines retained'] },
      {
        slug: 'atelier-shu-cafe',
        label: 'Cafe frontage',
        summary: 'A 9.0 by 4.0 metre aluminium gable creates a sheltered outdoor zone while responding to the existing cafe architecture and colours.',
        facts: ['36 m² frontage cover', '30 degree gable form'],
        image: {
          src: '/images/project-atelier-shu-02.jpg',
          alt: 'Front-on view of the dark-tint acrylic gable canopy over outdoor seating at Atelier Shu Cafe in Newmarket',
          objectPosition: '50% 42%',
        },
      },
    ] },
    { kind: 'decision-cards', id: 'commercial-decisions', tone: 'warm', eyebrow: 'Coordinate before fabrication', title: 'Four commercial decisions carry through the whole project', intro: 'Each one needs an owner, evidence and an agreed point of sign-off.', items: [
      { title: 'Use and capacity', outcome: 'A structure arranged around customers, staff, furniture, paths and required clear space.', consider: 'Peak use, accessibility, exits, doors, queues, service routes, sightlines and future layout changes.' },
      { title: 'Building and brand', outcome: 'A roof and frame that relate deliberately to the property and venue identity.', consider: 'Facade, roofline, colour references, signage, landlord requirements, boundaries and nearby windows.' },
      { title: 'Structure and services', outcome: 'A coordinated assembly rather than competing late-stage installations.', consider: 'Loads, drainage, lighting, heating, blinds, power, controls, cabling, fire or other consultant requirements and access.' },
      { title: 'Delivery and handover', outcome: 'A sequence and responsibility split the project team can act on.', consider: 'Approvals, procurement, site access, operating constraints, protection, other trades, commissioning, documents and maintenance.' },
    ] },
    { kind: 'dark-cards', id: 'commercial-risks', eyebrow: 'Protect the operation from ambiguity', title: 'The expensive gap is often between scopes', intro: 'A commercial project can look coordinated on a rendering while responsibilities remain unresolved.', items: [
      { title: 'A service without a fixing owner', text: 'Lighting, heating, blinds, signage and cabling need loads, locations, power and installers assigned before the frame is made.' },
      { title: 'A programme without operating rules', text: 'Access, noise, protection, public separation, shutdowns and other trades need an agreed site sequence.' },
      { title: 'A quote without handover boundaries', text: 'Commissioning, product documents, care, warranties, inspections and maintenance access need to be included or clearly excluded.' },
    ], links: [{ href: '/projects', label: 'Browse completed projects' }, { href: '/pergola-cost-auckland', label: 'Review commercial scope drivers' }] },
    { kind: 'process', id: 'commercial-process', eyebrow: 'A project-team sequence', title: 'Move from operational brief to documented handover', intro: 'The exact pathway varies with procurement and approvals, but the responsibilities should remain visible.', items: [
      { title: 'Establish use and stakeholders', copy: 'Confirm the business need, site users, decision-makers, property owner, consultants, operational constraints and desired outcome.' },
      { title: 'Review the site and documents', copy: 'Assess photos, surveys, plans, existing structure, services, access, drainage and the information still required.' },
      { title: 'Develop and coordinate the design', copy: 'Resolve geometry, structure, roof, edges, finishes, services and interfaces with the relevant project team.' },
      { title: 'Confirm scope and approvals', copy: 'Document drawings, products, responsibilities, professional inputs, inclusions, exclusions, programme assumptions and sign-offs.' },
      { title: 'Install and hand over', copy: 'Sequence procurement and site work around the agreed operating constraints, coordinate connected trades, then provide the agreed completion and product information.' },
    ] },
    { kind: 'link-cards', id: 'commercial-next-decisions', tone: 'neutral', eyebrow: 'Continue the procurement brief', title: 'Continue with the relevant specialist guidance', items: [
      { title: 'Resolve a bespoke interface', text: 'Use the custom guide for difficult connections, restricted supports and consultant-led geometry.', href: '/custom-pergolas-auckland', linkLabel: 'Open the custom guide' },
      { title: 'Compare commercial scope', text: 'Use the cost guide to align inclusions, exclusions, access, approvals and connected trades.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
      { title: 'Review completed work', text: 'See dimensions, constraints and design responses in the project library.', href: '/projects', linkLabel: 'Browse projects' },
    ] },
    { kind: 'faq', id: 'commercial-pergolas-faq', tone: 'elevated', eyebrow: 'Questions for the project team', title: 'What to resolve before procuring a commercial pergola in Auckland', intro: 'The answer depends on the business use, property, project team, products and completed design.', items: faqItems },
  ],
  finalCta: { eyebrow: 'Start with the operating brief', title: 'Give Sanctuary the site, stakeholders and constraints', text: 'A useful commercial enquiry explains who uses the space, what must keep working and which documents or project partners already exist.', button: 'Share the commercial brief', checklistTitle: 'Useful first inputs', checklist: ['Site address and business use', 'Photos, plans and rough dimensions', 'Customer and staff movement', 'Operating and access constraints', 'Property owner or landlord details', 'Architect and consultant contacts', 'Services and integrated features', 'Target dates and approval status'] },
  form: { ariaLabel: 'Commercial pergola project enquiry form', eyebrow: 'Start with the project team', heading: 'Share the commercial pergola brief', intro: 'Select Commercial in the enquiry type, then outline the site, use, stakeholders, documents and delivery constraints. Roof preferences can remain provisional.', submitLabel: 'Share the commercial brief', messageLabel: 'Commercial project brief', messagePlaceholder: 'Describe the site use, operational outcome, stakeholders, procurement context and what must keep working during delivery.', briefFields: [
    { name: 'siteAddress', label: 'Site address', type: 'text', placeholder: 'Street address', wide: true },
    { name: 'projectStage', label: 'Project stage', type: 'select', options: ['Early feasibility', 'Concept design', 'Consultant documentation', 'Procurement', 'Ready for a detailed proposal'] },
    { name: 'professionalInvolvement', label: 'Project team', type: 'text', placeholder: 'Client, architect, engineer, builder, landlord or other consultants' },
    { name: 'operatingConstraints', label: 'Operating, access and staging constraints', type: 'textarea', placeholder: 'Include opening hours, public routes, shutdown limits, delivery access and other trades.', wide: true },
  ], roofPreference: { label: 'Possible roof approach', detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
