import type { Project } from './projects';

export const whitfordProject: Project = {
  slug: 'whitford-poolside-deck',
  title: 'Whitford Poolside Deck',
  location: 'Whitford, Auckland',
  region: 'South-East Auckland',
  type: 'Residential',
  roof: 'Pitched',
  year: '2026',
  heroImage: {
    src: '/images/project-whitford-poolside-deck-01-pitched-deck.jpg',
    alt: 'White-framed pitched pergola covering a dining deck beside the house and pool in Whitford',
    objectPosition: '50% 50%',
  },
  gallery: [
    {
      src: '/images/project-whitford-poolside-deck-01-pitched-deck.jpg',
      alt: 'White-framed pitched pergola covering a dining deck beside the house and pool in Whitford',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-whitford-poolside-deck-02-house-connection.jpg',
      alt: 'Covered dining table beside glazed doors, with the pergola following the house angles',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-whitford-poolside-deck-03-dining-outlook.jpg',
      alt: 'Light grey acrylic roofing over the dining table with open views across the pool and garden',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-whitford-poolside-deck-04-pool-view.jpg',
      alt: 'View beneath the white pergola frame towards the pool, garden and surrounding landscape',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-whitford-poolside-deck-05-garden-approach.jpg',
      alt: 'The covered dining deck seen from the garden approach beside the house and pool',
      objectPosition: '50% 50%',
    },
  ],
  blurb:
    'A white-framed pergola covers a west-facing dining deck, with light grey acrylic roofing and open views across the pool and garden.',
  constraint:
    'Shade for a west-facing deck without darkening the adjoining room, while fitting the existing house angles and keeping the sides open.',
  roofApproach: 'Light grey acrylic roofing on a custom pitched aluminium frame',
  materials: ['Aluminium framing', 'Appliance White finish', 'Light grey acrylic roofing'],
  description: [
    'The brief was to shade a hot, west-facing deck without losing daylight in the adjoining room. With several rooflines and angles to work around, the new cover also needed to feel like part of the house.',
  ],
  stats: {},
  tags: ['Residential', 'Pitched', 'Acrylic roofing', 'Outdoor dining'],
  sections: [
    {
      title: 'Materials and finishes',
      paragraphs: ['Aluminium framing finished in Appliance White, with light grey acrylic roofing.'],
    },
  ],
  related: ['dairy-flat-estate', 'mt-maunganui-box', 'glendowie-outdoor-living'],
};
