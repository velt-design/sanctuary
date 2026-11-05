import type { Project } from './projects';

export const glendowieProject: Project = {
  slug: 'glendowie-outdoor-living',
  title: 'Glendowie Outdoor Living',
  location: 'Glendowie, Auckland',
  region: 'East Auckland',
  type: 'Residential',
  roof: 'Gable',
  year: '2026',
  heroImage: {
    src: '/images/project-glendowie-outdoor-living-01-gable-deck.jpg',
    alt: 'Dark-framed gable pergola over a dining and lounge deck beside a Glendowie home',
    objectPosition: '50% 50%',
  },
  gallery: [
    {
      src: '/images/project-glendowie-outdoor-living-01-gable-deck.jpg',
      alt: 'Dark-framed gable pergola over a dining and lounge deck beside a Glendowie home',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-glendowie-outdoor-living-02-covered-living.jpg',
      alt: 'Outdoor dining and lounge seating beneath cedar lining and acrylic roof strips',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-glendowie-outdoor-living-03-gable-outlook.jpg',
      alt: 'Cedar-lined gable and acrylic glazing framing the coastal outlook from the deck',
      objectPosition: '50% 45%',
    },
    {
      src: '/images/project-glendowie-outdoor-living-04-house-connection.jpg',
      alt: 'Dining table beneath the gable beside wide glazed doors connecting the deck to the house',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-glendowie-outdoor-living-05-side-blind.jpg',
      alt: 'A lowered outdoor blind beside the dining area, with the coastal side of the deck open',
      objectPosition: '50% 50%',
    },
    {
      src: '/images/project-glendowie-outdoor-living-06-enclosed-lighting.jpg',
      alt: 'Lowered outdoor blinds enclosing the deck beneath recessed lights and ceiling-mounted heaters',
      objectPosition: '50% 50%',
    },
  ],
  blurb:
    'A cedar-lined gable creates a covered dining and lounge space, with acrylic roof strips, outdoor blinds and a coastal outlook.',
  constraint:
    'A covered dining and lounge area beside the house, with a connection to the garden and coastal outlook.',
  roofApproach: 'Coloursteel roof sections with cedar lining, alongside acrylic strips',
  materials: ['Aluminium', 'Western Red Cedar lining', 'Coloursteel', 'Acrylic roofing', 'Outdoor blinds'],
  description: [
    'Beside this Glendowie home, a gable roof brings the dining table and outdoor lounge under one cover. Cedar lining gives the space the warmth of a finished room, while acrylic roof strips and open sides keep the sky and coastal outlook in view.',
  ],
  stats: {},
  tags: ['Residential', 'Gable', 'Cedar lining', 'Acrylic roofing', 'Outdoor blinds', 'Lighting', 'Heaters'],
  sections: [
    {
      title: 'Structure and roofing',
      paragraphs: [
        'The aluminium gable combines Grey Friars Coloursteel roof sections with acrylic roof strips and Western Red Cedar lining beneath the solid sections.',
      ],
    },
    {
      title: 'Lighting and outdoor blinds',
      paragraphs: [
        'Recessed lights and ceiling-mounted heaters sit within the cedar-lined roof. Outdoor blinds can be lowered around the deck or raised to open the sides towards the garden and outlook.',
      ],
    },
  ],
  related: ['warkworth-outdoor-room', 'tindalls-bay-pavilion', 'milford-garden-retreat'],
};
