import type { Project } from './projects';

export const tawharanuiProject: Project = {
  slug: 'tawharanui-coastal-deck',
  title: 'Tāwharanui Coastal Deck',
  location: 'Tāwharanui Peninsula, Auckland',
  region: 'North Auckland',
  type: 'Residential',
  roof: 'Gable',
  year: '2026',
  heroImage: {
    src: '/images/project-tawharanui-coastal-deck-01-gable-bach.jpg',
    alt: 'Dark-framed gable pergola covering the raised timber deck beside a Tāwharanui bach',
    objectPosition: '50% 35%',
  },
  gallery: [
    {
      src: '/images/project-tawharanui-coastal-deck-01-gable-bach.jpg',
      alt: 'Dark-framed gable pergola covering the raised timber deck beside a Tāwharanui bach',
      objectPosition: '50% 35%',
    },
    {
      src: '/images/project-tawharanui-coastal-deck-02-coastal-outlook.jpg',
      alt: 'Light grey acrylic gable roofing above a timber dining deck looking through trees towards the coast',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-tawharanui-coastal-deck-03-outdoor-blind.jpg',
      alt: 'A lowered outdoor blind beside the dining table with water visible beyond the open deck edge',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-tawharanui-coastal-deck-04-roof-detail.jpg',
      alt: 'Aluminium gable rafters and acrylic roof panels above the open coastal edge of the deck',
      objectPosition: '50% 45%',
    },
    {
      src: '/images/project-tawharanui-coastal-deck-05-covered-deck.jpg',
      alt: 'The dark gable frame, acrylic roof and lowered blind beside the blue bach',
      objectPosition: '50% 35%',
    },
    {
      src: '/images/project-tawharanui-coastal-deck-06-garden-view.jpg',
      alt: 'An open side of the covered timber deck looking towards the lawn and trees',
      objectPosition: '50% 50%',
    },
  ],
  blurb:
    'A dark-framed gable covers the raised deck of a coastal bach, with light grey acrylic roofing and an outdoor blind beside the dining table.',
  constraint: 'Cover for an existing raised dining deck beside a coastal bach.',
  roofApproach: 'Light grey acrylic roofing on a FlaxPod aluminium gable',
  materials: ['FlaxPod aluminium framing', 'Light grey acrylic roofing', 'Outdoor blind'],
  description: [
    'The brief began with an existing raised deck beside a bach on the Tāwharanui Peninsula. The new pergola brings cover to the outdoor dining area, with views through the trees towards the water.',
  ],
  stats: {},
  tags: ['Residential', 'Gable', 'Acrylic roofing', 'Outdoor blind', 'Outdoor dining'],
  sections: [
    {
      title: 'Materials and finishes',
      paragraphs: ['FlaxPod aluminium framing, light grey acrylic roofing and an outdoor blind.'],
    },
  ],
  related: ['glendowie-outdoor-living', 'warkworth-outdoor-room', 'whitford-poolside-deck'],
};
