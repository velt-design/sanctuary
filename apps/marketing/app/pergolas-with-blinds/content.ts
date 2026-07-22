import type { SeoLandingPageConfig } from '@/components/seo-landing/types';

const faqItems = [
  { question: 'What does a blind add to a pergola?', answer: ['A roof manages the area above. A blind can change one open edge when low sun, wind or privacy affects how the space is used.', 'The result still depends on direction, fabric, opening size, fixing method and the conditions at the actual site.'] },
  { question: 'Should blinds be planned with a new pergola?', answer: ['Planning them early allows the opening, head position, supports, controls and nearby services to be coordinated with the frame.', 'A later addition may still be possible, but the existing structure and suitable fixing points need to be checked first.'] },
  { question: 'Can an existing pergola have blinds added later?', answer: ['Sometimes. The opening dimensions, frame, attachment points, clearance, access and exposure all need a site-specific review.', 'A blind should not be selected from width alone because the surrounding structure determines how it can be installed.'] },
  { question: 'Are pergola blinds manual or motorised?', answer: ['Sanctuary lists manual and motorised options. The appropriate operation depends on the opening, frequency of use, access and selected product.', 'Motorised options also require early coordination of power, controls and trade responsibilities.'] },
  { question: 'Will a pergola blind stop all wind and rain?', answer: ['A blind can add protection at a selected edge, but an outdoor blind is not the same as a permanent wall and an open-sided pergola should not be described as fully weatherproof.', 'Wind-driven rain and changing wind direction can still affect the space. The exact product limits and operating guidance need to be confirmed.'] },
  { question: 'Can a blind help with low afternoon sun?', answer: ['A blind may be useful where low-angle sun enters through a particular side. The relevant edge changes with orientation, season and time of day.', 'Site photos taken when the issue occurs are more useful than assuming every side needs the same treatment.'] },
  { question: 'Can blinds provide privacy without closing every side?', answer: ['Yes, a targeted blind may address a neighbour, street or boundary view while other edges remain open.', 'Material selection also affects view-through and the feeling of enclosure, so privacy should be balanced against outlook and airflow.'] },
  { question: 'Do several blinds need separate controls?', answer: ['That depends on the selected system and how the room is used. Separate control can be useful when conditions arrive from different directions.', 'Control grouping, switches, remotes, sensors and electrical scope should be confirmed for the exact product rather than assumed.'] },
  { question: 'What should I send for a pergola and blind enquiry?', answer: ['Send the suburb, wide photos, rough opening dimensions and notes about which edge is affected by wind, low sun or privacy.', 'Mention whether the pergola is new or existing, how often the blind is likely to move and any preference for manual or motorised operation.'] },
] as const;

export const pergolasWithBlindsConfig = {
  marker: 'pergolas-with-blinds', route: '/pergolas-with-blinds',
  description: 'Plan a pergola with blinds in Auckland around wind direction, low sun, privacy and open views. Explore blind integration, controls, scope and project evidence.',
  schemaName: 'Pergolas With Blinds Auckland', serviceName: 'Custom pergola and outdoor blind design in Auckland', serviceType: 'Pergola design and blind integration',
  hero: { image: '/images/project-goodhome-02.jpg', imageAlt: 'Drop-down blinds enclosing one edge of a covered Auckland hospitality courtyard', objectPosition: '50% 50%', eyebrow: 'Pergolas with blinds', title: 'A blind works best when the edge was designed to receive it', intro: 'The roof covers from above. A blind responds at the side. Sanctuary plans the opening, frame, controls and view together so the edge can change when low sun, wind or privacy interrupts the space.', primaryCta: 'Describe the exposed edge', secondaryCta: 'Plan each side', secondaryHref: '#edge-map', proof: ['Protection where it is useful', 'Open views when retracted', 'Frame and controls coordinated'] },
  blocks: [
    { kind: 'split-intro', id: 'blind-is-an-edge', eyebrow: 'One moving boundary', title: 'Do not ask a blind to solve the whole weather pattern', paragraphs: [
      'Conditions rarely arrive evenly from every direction. Afternoon sun may cut across one corner. A prevailing breeze may affect the dining side. A neighbour may overlook only a single opening.',
      'That makes the first question directional: which edge causes the problem, at what time, and what should remain visible when the blind is lowered?',
      'A targeted response can preserve more of the outdoor connection than treating every side as though it needs the same enclosure.',
    ] },
    { kind: 'numbered-cards', id: 'edge-map', eyebrow: 'Read the perimeter', title: 'Map the problem before counting blinds', intro: 'Photos, orientation and daily use reveal more than a generic request for enclosure.', items: [
      { title: 'Locate the interruption', text: 'Record where wind, low sun or overlooking enters and when it changes the way people use the space.' },
      { title: 'Protect the important activity', text: 'Relate that edge to the dining table, lounge, doorway, cooking area or circulation route it affects.' },
      { title: 'Keep the valuable opening', text: 'Identify the view, airflow or garden connection that should remain when conditions are calm.' },
    ] },
    { kind: 'editorial-image', id: 'blind-integration', tone: 'neutral', eyebrow: 'Design the receiving edge', title: 'The blind, beam and opening need one set of lines', image: { src: '/images/project-tindalls-bay.jpg', alt: 'Auckland coastal pavilion with a screened edge beside the dining area', objectPosition: '50% 42%' }, lead: 'A clean result depends on what surrounds the fabric as much as the fabric itself.', items: [
      { title: 'Head position', text: 'Decide whether the rolled blind and its housing should be expressed, recessed or aligned with the pergola beam.' },
      { title: 'Side support', text: 'Confirm the selected system, opening geometry and suitable fixing points at both sides rather than assuming every post arrangement will work.' },
      { title: 'Bottom condition', text: 'Check the deck, paving, balustrade, steps and furniture so the lowered edge meets the space sensibly.' },
      { title: 'Power and access', text: 'For a motorised option, coordinate supply, controls, trade responsibility and future access before fabrication.' },
    ] },
    { kind: 'projects', id: 'blind-projects', eyebrow: 'Completed edges, different reasons', title: 'Blinds respond to the brief, not a standard elevation', intro: 'These Sanctuary projects show screened edges serving residential, coastal and hospitality settings.', items: [
      { slug: 'tindalls-bay-pavilion', label: 'Wind and neighbouring outlook', summary: 'Mesh blinds were used along one side of a 108 square metre patio and carport project to address wind and privacy while retaining the coastal view.', facts: ['Targeted treatment on one edge', 'Mixed roof and blind scope'] },
      { slug: 'waiheke-holiday-home', label: 'Concealed when open', summary: 'The perimeter beams on a 5.0 by 4.0 metre deck cover were planned with space for blind heads so the horizon stays clear when the edge is open.', facts: ['20 m² coastal deck cover', 'Blind heads coordinated with perimeter'] },
      { slug: 'goodhome-commercial-terrace', label: 'A changing hospitality edge', summary: 'Blinds form part of a 67.7 square metre restaurant courtyard with roof, lighting and service requirements.', facts: ['10.09 x 6.7 m courtyard', 'Commercial controls and access context'] },
    ] },
    { kind: 'decision-cards', id: 'blind-decisions', tone: 'warm', eyebrow: 'Specify the moving boundary', title: 'Four decisions determine how the edge behaves', intro: 'Each choice should describe both the lowered condition and the open condition.', items: [
      { title: 'Purpose and direction', outcome: 'A clear reason for each blind instead of blanket enclosure.', consider: 'Wind direction, solar angle, privacy line, activity zone, season and time of day.' },
      { title: 'Material and outlook', outcome: 'The intended balance of screening, view-through and room character.', consider: 'The exact fabric or panel, colour, visibility, care guidance and supplier documentation.' },
      { title: 'Opening and structure', outcome: 'A blind sized and supported within a coordinated frame.', consider: 'Clear opening, beam depth, posts, fixing substrate, head, guides, bottom edge and access.' },
      { title: 'Operation and services', outcome: 'A control method that suits normal use and the installed product.', consider: 'Manual or motorised operation, power, controls, sensors if specified, commissioning and maintenance access.' },
    ] },
    { kind: 'dark-cards', id: 'blind-boundaries', eyebrow: 'Keep the promise proportionate', title: 'A deployable edge is not a permanent wall', intro: 'The room remains outdoors, and the selected product has operating limits that belong in the final specification.', items: [
      { title: 'Wind changes direction', text: 'A blind on one face cannot control conditions arriving through every other opening.' },
      { title: 'Rain can travel laterally', text: 'Roof cover and a lowered blind can change exposure, but they do not make an open pergola a sealed room.' },
      { title: 'Products need exact guidance', text: 'Operating limits, controls, care and warranty conditions must come from the selected supplier documentation.' },
    ], links: [{ href: '/products/screens-walls/drop-down-blinds', label: 'Review drop-down blinds' }, { href: '/outdoor-rooms-auckland', label: 'Plan the complete outdoor room' }] },
    { kind: 'link-cards', id: 'blind-next-decisions', tone: 'neutral', eyebrow: 'Continue the edge brief', title: 'Keep the moving edge connected to the whole room', items: [
      { title: 'Review the current blind product', text: 'Take system, operation and current specification questions to the product owner page.', href: '/products/screens-walls/drop-down-blinds', linkLabel: 'Open the blind product' },
      { title: 'Plan the whole outdoor room', text: 'Coordinate furniture, services, roof and every open edge around how the room is used.', href: '/outdoor-rooms-auckland', linkLabel: 'Open the outdoor room guide' },
      { title: 'Compare the complete scope', text: 'Take structural, electrical and installation allowances to the cluster cost owner.', href: '/pergola-cost-auckland', linkLabel: 'Open the cost guide' },
    ] },
    { kind: 'faq', id: 'pergolas-with-blinds-faq', tone: 'elevated', eyebrow: 'Questions about changing the edge', title: 'What to resolve before adding blinds to an Auckland pergola', intro: 'The answer depends on the opening, site exposure, selected system and completed pergola design.', items: faqItems },
  ],
  finalCta: { eyebrow: 'Start with the direction', title: 'Show Sanctuary which edge interrupts the room', text: 'A wide photo and a note about when wind, low sun or overlooking occurs can turn a broad blind enquiry into a useful first design conversation.', button: 'Describe the exposed edge', checklistTitle: 'Useful first inputs', checklist: ['Project suburb', 'Wide photos of the pergola area', 'Problem edge marked on a photo', 'Rough opening dimensions', 'Time and season of low sun', 'Wind or privacy observations', 'New or existing pergola', 'Manual or motorised preference'] },
  form: { ariaLabel: 'Pergola with blinds enquiry form', eyebrow: 'Start with one edge', heading: 'Describe the pergola and blind brief', intro: 'Share the site, opening and condition you want to manage. The roof preference can remain open while Sanctuary reviews the whole structure.', submitLabel: 'Describe the exposed edge', messageLabel: 'Which edge needs to change?', messagePlaceholder: 'Describe whether low sun, wind, privacy or another condition affects the space, including direction and time of day if known.', briefFields: [
    { name: 'pergolaStatus', label: 'Pergola status', type: 'select', options: ['New pergola being planned', 'Existing Sanctuary pergola', 'Existing pergola by another supplier', 'Unsure'] },
    { name: 'openingDimensions', label: 'Approximate blind opening', type: 'text', placeholder: 'Width and height if known' },
    { name: 'controlPreference', label: 'Control preference', type: 'select', options: ['Manual', 'Motorised', 'Compare both', 'Unsure'] },
    { name: 'edgeCondition', label: 'Direction, timing and affected activity', type: 'textarea', placeholder: 'For example: western sun at the dining table in late afternoon.', wide: true },
  ], roofPreference: { label: 'Possible roof approach', detailKey: 'roofPreference', options: [
    { label: 'Acrylic roofing', value: 'Acrylic roofing', roofMaterials: ['acrylic'] }, { label: 'Solid or lined roofing', value: 'Solid or lined roofing', roofMaterials: ['timber'] }, { label: 'Combination roofing', value: 'Combination roofing', roofMaterials: ['acrylic', 'timber'] }, { label: 'Unsure', value: 'Unsure', roofMaterials: [] },
  ] } },
} satisfies SeoLandingPageConfig;
