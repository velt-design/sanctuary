import { findPergolaGuide } from '../../data/pergolaGuides';

export type GuideHubTopic = { href: string; question: string; summary: string; image: string; alt: string; position?: string };

// Visual groups for this route only; shared guide navigation keeps its own owner.
export const planningTopics = [
  { href: '/pergola-cost-auckland', question: 'How much will a pergola cost?', summary: 'See what changes the installed price and what to compare between quotes.', image: '/images/simple-pergolas/pitched-06.webp', alt: 'An attached acrylic pergola running along the doors and deck of a dark-clad home', position: '50% 42%' },
  { href: '/outdoor-rooms-auckland', question: 'How will you use the space?', summary: 'Plan a place to eat, sit and spend more time outside, with the roof and sides considered together.', image: '/images/project-warkworth-outdoor-room-04.jpg', alt: 'Warkworth outdoor room with seating, a fireplace, timber ceiling and clear roof strips', position: '50% 56%' },
  { href: '/pergolas-with-blinds', question: 'Would blinds make it more useful?', summary: 'Look at mesh and clear PVC, privacy and outlook, and which openings need a blind.', image: '/images/blind-coastal-mesh.webp', alt: 'A lowered mesh blind with its roller, side guide and bottom rail visible beside an open coastal view' },
  { href: '/acrylic-pergolas-vs-louvre-roofs', question: 'Acrylic or a louvre roof?', summary: 'Compare our fixed acrylic roofs with an external louvre proposal. Sanctuary does not supply louvre roofs.', image: '/images/project-dairy-flat-03.jpg', alt: 'Fixed acrylic roof and infilled gable end at Dairy Flat, showing the sky through the roof', position: '50% 17%' },
] satisfies GuideHubTopic[];

export const formTopics = [
  { href: '/aluminium-pergolas-auckland', question: 'Aluminium pergolas', summary: 'Understand the frame, then choose the roof and finish for your home.', image: '/images/project-st-heliers-01.jpg', alt: 'White aluminium gable framing and opal acrylic roof at a St Heliers home', position: '35% 18%' },
  { href: '/gable-pergolas-auckland', question: 'Gable pergolas', summary: 'Two roof slopes, height through the middle and a distinct triangular end.', image: '/images/project-riverhead-gable-01.jpg', alt: 'Complete timber-lined gable roof above an open poolside lounge at Riverhead', position: '50% 26%' },
  { href: '/pitched-pergolas-auckland', question: 'Pitched pergolas', summary: 'One roof plane, planned around the house, available height and daylight.', image: '/images/simple-pergolas/pitched-01.webp', alt: 'White single-slope acrylic pergola covering a lounge beside the house', position: '50% 36%' },
] satisfies GuideHubTopic[];

export const servicePaths = [
  { href: '/pergolas-auckland', title: 'Pergolas for your home', summary: 'Explore the overall design and build service.' },
  { href: '/custom-pergolas-auckland', title: 'Custom pergola design', summary: 'Work through a particular site, connection or idea.' },
  { href: '/commercial-pergolas-auckland', title: 'Commercial projects', summary: 'Plan a covered space around your venue or business.' },
] as const;

export const guideHubItems = [...planningTopics, ...formTopics].map((topic) => {
  const guide = findPergolaGuide(topic.href);
  if (!guide) throw new Error(`Unknown guide destination: ${topic.href}`);
  return { ...topic, title: guide.title };
});
