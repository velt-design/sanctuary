export const CUSTOM_ROUTE = '/custom-pergolas-auckland';
export const customDescription = 'Custom pergolas designed around your Auckland home. Explore real projects, daylight and roof choices, then talk with Sanctuary about your space. No finished design needed.';
export const customHero = {
  image: '/images/project-tindalls-bay-03.jpg',
  alt: 'Covered dining patio at Tindalls Bay, with timber-lined and acrylic roof zones looking towards the coast',
};

/** Editorial summaries of the approved public project records in data/projects.ts. */
export const customStories = [
  {
    slug: 'tindalls-bay-pavilion',
    location: 'Tindalls Bay, Auckland',
    title: 'One home. Different kinds of cover.',
    image: '/images/project-tindalls-bay.jpg',
    alt: 'Timber battens beneath acrylic roofing at Tindalls Bay, with the patio open towards the coastal view',
    caption: 'The patio at Tindalls Bay. Part of a combined patio and carport project.',
    brief: 'Extend everyday living onto the patio, working around the shape of the house while keeping the adjoining interior light.',
    response: 'Insulated roofing and timber sarking above the dining area. Acrylic and timber battens around the entry and circulation zones. Each part of the roof responds to what happens underneath.',
    result: 'A covered dining space with a warm ceiling, daylight through the adjoining zones and an open outlook towards the coast. Mesh blinds sit along the side identified for wind and privacy.',
  },
  {
    slug: 'warkworth-outdoor-room',
    location: 'Warkworth, Auckland',
    title: 'A room beside the house. Open to the garden.',
    image: '/images/project-warkworth-outdoor-room-02.jpg',
    alt: 'Warkworth outdoor room with cedar lining, clear roof glazing, a fireplace and seating beside the garden',
    caption: 'Warkworth. A freestanding aluminium and steel structure with cedar lining and acrylic glazing.',
    brief: 'Create a proper outdoor room beside the house, with shelter and comfort for everyday use and a connection to the garden.',
    response: 'A freestanding gable avoids relying on the house for support. Clear acrylic through the roof and gable ends brings daylight into the cedar-lined room.',
    result: 'The new deck, fireplace and lighting were planned together with the structure. Dining and lounging now share one complete outdoor space.',
  },
] as const;

export const customFaqs = [
  { question: 'Do I need drawings or a finished idea?', answer: 'No. Tell us how you would like to use the space and what matters to you. Photos are useful, and existing plans are welcome if you have them. We can discuss the direction before the details are resolved.' },
  { question: 'Can you work around my existing roofline, doors or deck?', answer: 'Those are part of the design conversation. We look at the house connection, openings, post positions and levels together. What is possible depends on the measured site, support and final design.' },
  { question: 'How do you keep light in the house?', answer: 'We consider where light enters the adjoining rooms and where you want a more sheltered ceiling. Acrylic, solid roofing and combinations can be placed in response to that brief. The right balance depends on your home and its orientation.', href: '/acrylic-roof-pergolas-auckland', link: 'Explore acrylic roofing' },
  { question: 'Can the pergola be freestanding?', answer: 'Yes, a freestanding design can be considered, as in the Warkworth project above. Attachment, foundations, structure and drainage are assessed for your particular site.' },
  { question: 'What does a custom pergola cost?', answer: 'The size, roof, structure, house connection and site work all shape the price. We agree the design and scope before providing a project-specific proposal. The optional 3D designer estimates supported standard configurations; it does not price a bespoke layout.', href: '/pergola-cost-auckland', link: 'What shapes pergola cost' },
  { question: 'Will the project need engineering or consent?', answer: 'That depends on the site and final design. We discuss the checks and responsibilities that apply to your project. A photograph or a starting design cannot confirm the approval requirements.' },
  { question: 'What happens after I enquire?', answer: 'We review your message and contact you to talk about the space and the next step. Auckland site measures are free. For projects outside Auckland, we confirm availability and any travel costs before a visit.' },
] as const;
