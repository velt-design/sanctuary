type MegaItem = {
  title: string;
  href: string;
  desc: string;
  icon?: 'square' | 'round' | 'dashed';
};

type MegaSection = {
  heading: string;
  items: MegaItem[];
};

export const sections: MegaSection[] = [
  {
    heading: 'Pergolas',
    items: [
      {
        title: 'Pitched pergola →',
        href: '/products/pergolas/pitched',
        desc: 'A clean single roof plane coordinated with eaves, height, fall and drainage.',
        icon: 'square'
      },
      {
        title: 'Gable pergola →',
        href: '/products/pergolas/gable',
        desc: 'Extra headroom and airflow. Ideal for larger decks and sliders.',
        icon: 'round'
      },
      {
        title: 'Hip pergola →',
        href: '/products/pergolas/hip',
        desc: 'Three-sided cover that integrates with complex rooflines.',
        icon: 'dashed'
      },
      {
        title: 'Box Perimeter →',
        href: '/products/pergolas/box-perimeter',
        desc: 'Framed geometry. Contemporary read.',
        icon: 'square'
      }
    ]
  },
  {
    heading: 'Screens & walls',
    items: [
      {
        title: 'Slat screens →',
        href: '/products/screens-walls/slat-screens',
        desc: 'Privacy and warmth with adjustable spacing; timber or aluminium options.'
      },
      {
        title: 'Acrylic infill panels →',
        href: '/products/screens-walls/acrylic-infill-panels',
        desc: 'Clear or tinted panels that add edge shelter while keeping useful daylight.'
      },
      {
        title: 'Drop-down blinds →',
        href: '/products/screens-walls/drop-down-blinds',
        desc: 'Adjustable low-sun, privacy and edge-exposure control. Manual or motorised options.'
      }
    ]
  },
  {
    heading: 'Lighting & heating',
    items: [
      {
        title: 'Downlights →',
        href: '/products/lighting-heating/downlights',
        desc: 'Even lighting for dining and tasks. Wired by a licensed electrician.'
      },
      {
        title: 'LED strip lighting →',
        href: '/products/lighting-heating/led-strip-lighting',
        desc: 'Perimeter glow for ambience and safe movement.'
      },
      {
        title: 'Patio heaters →',
        href: '/products/lighting-heating/patio-heaters',
        desc: 'Targeted warmth for evening use. Electric units with clearance guidance.'
      }
    ]
  }
];
