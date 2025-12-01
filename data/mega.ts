export type MegaItem = {
  title: string;
  href: string;
  desc: string;
  icon?: 'square' | 'round' | 'dashed';
};

export type MegaSection = {
  heading: string;
  items: MegaItem[];
};

export type Promo = {
  img: string;
  title: string;
  blurb: string;
  cta: string;
  href: string;
};

export const sections: MegaSection[] = [
  {
    heading: 'Pergolas',
    items: [
      {
        title: 'Pitched pergola →',
        href: '/products/pergolas/pitched',
        desc: 'Clean lines for narrow eaves. Efficient spans. Strong aluminium frame.',
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
        desc: 'Clear or tinted panels for wind and rain while keeping light.'
      },
      {
        title: 'Drop-down blinds →',
        href: '/products/screens-walls/drop-down-blinds',
        desc: 'Block wind and low sun. Manual or motorised options.'
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

export const promos: Promo[] = [
  {
    img: '/assets/hero-left.jpg',
    title: 'Custom pergola design',
    blurb: 'Work with our in-house designer on spans, colours, and detailing matched to your home.',
    cta: 'Learn more →',
    href: '/process'
  },
  {
    img: '/assets/hero-right.jpg',
    title: 'Order finish samples',
    blurb: 'Preview powder coat colours and roofing options before you commit to the build.',
    cta: 'Request samples →',
    href: '/contact'
  },
  {
    img: '/assets/pitched.jpg',
    title: 'Trade & partnerships',
    blurb: 'Multi-lot projects or installation partners—talk to our dedicated trade team.',
    cta: 'Apply →',
    href: '/projects'
  }
];
