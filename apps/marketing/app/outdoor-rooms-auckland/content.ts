export const OUTDOOR_ROOM_ROUTE = '/outdoor-rooms-auckland';
export const outdoorRoomsDescription = 'Plan an Auckland outdoor room around use, furniture, roofing, edges, lighting and services.';
export const outdoorRoomHero = {
  image: '/images/project-warkworth-outdoor-room-02.jpg',
  alt: 'Warkworth outdoor room with a timber-lined gable, clear roof glazing, lounge seating and a dining space opening to the garden',
};

/** Editorial details of verified public projects, not a standard inclusions list. */
export const outdoorRoomExamples = [
  {
    slug: 'warkworth-outdoor-room', use: 'A room for everyday life',
    image: '/images/project-warkworth-outdoor-room-03.jpg',
    alt: 'Seating beside the fireplace and open garden edge of the Warkworth outdoor room',
    caption: 'Warkworth. An aluminium and steel structure with cedar lining and clear acrylic glazing.',
    text: 'A lounge beside the fireplace, space to dine, and a connection to the garden. At Warkworth, the roof, new deck and lighting were planned together to make a freestanding room beside the house.',
    decision: 'Plan the furniture and the route between house, table and garden before fixing the posts.',
  },
  {
    slug: 'riverhead-gable-pavilion', use: 'A place beside the pool',
    image: '/images/project-riverhead-gable-02.jpg',
    alt: 'Riverhead gable pavilion opening onto a poolside deck, with the house and pool in view',
    caption: 'Riverhead. An aluminium and steel pavilion, with timber lining and integrated lighting.',
    text: 'The Riverhead pavilion gives the poolside lounge a roof while keeping its outlook open. Timber lining, downlights and warm lighting along the ceiling edges bring the space together.',
    decision: 'Keep the outlook and everyday circulation in view. Discuss pool access and any fencing requirements as part of the site review.',
  },
  {
    slug: 'tindalls-bay-pavilion', use: 'Dining with an open outlook',
    image: '/images/project-tindalls-bay-03.jpg',
    alt: 'Tindalls Bay dining patio with timber-lined and acrylic roof zones, outdoor blinds and a coastal outlook',
    caption: 'The patio at Tindalls Bay. Roof zones and mesh blinds alongside the dining space.',
    text: 'At Tindalls Bay, a timber-lined roof over the dining area sits alongside acrylic daylight zones. Mesh blinds give the patio adjustable edges without making every side a permanent wall.',
    decision: 'Look at each edge separately: where to keep a view, where shelter matters, and where people need to pass.',
  },
] as const;

export const outdoorRoomFaqs = [
  { question: 'What makes this an outdoor room rather than just a covered deck?', answer: 'The roof is one part of it. We plan how you will use the space, the furniture and paths through it, then coordinate the roof, edges, lighting and services. The final scope depends on your home and what you want the room to do.' },
  { question: 'Do I need plans or measurements before enquiring?', answer: 'No. Tell us how you would like to use the space. Photos, a rough idea or existing plans can help, but they are optional. We can start with a conversation and arrange a free Auckland site measure.' },
  { question: 'Will it be fully enclosed or weatherproof?', answer: 'An outdoor room remains an outdoor space unless a different enclosure has been specifically designed. Shelter depends on the site, roof, exposed edges and selected products. Blinds have operating and exposure limits; we discuss those for your site.', href: '/pergolas-with-blinds', link: 'Read about outdoor blinds' },
  { question: 'Can lighting, heating and blinds be planned together?', answer: 'Yes. Let us know what you have in mind before the structure is finalised so fixing points, wiring and access can be considered. Suitable products, electrical work and other services need to be agreed in the project scope.' },
  { question: 'What does an outdoor room cost?', answer: 'The layout, structure, roofing, ground conditions and included services all affect the price. The 3D designer can estimate a supported standard pergola configuration. It does not price a complete room, landscaping or a bespoke layout. We confirm the scope and project-specific price with you.', href: '/pergola-cost-auckland', link: 'Understand pergola cost and scope' },
  { question: 'What about building consent or a poolside location?', answer: 'Requirements depend on the site and final design. House connections, boundaries, drainage and pool safety requirements need to be considered where relevant. We confirm the checks needed for your project rather than assuming a standard answer.' },
] as const;
