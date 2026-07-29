// data/projects.ts
import {
  ATELIER_SHU_CASE_STUDY_HERO_IMAGE,
  ATELIER_SHU_CASE_STUDY_HERO_OBJECT_POSITION,
  WARKWORTH_EXTERIOR_IMAGE,
  WARKWORTH_EXTERIOR_OBJECT_POSITION,
} from '../lib/projectImageFraming';

type Image = { src: string; alt: string; fallbackJpg?: string; w?: number; h?: number; objectPosition?: string };

type ProjectStats = {
  width?: string;
  depth?: string;
  height?: string;
  area?: string;
  pitch?: string;
};

type ProjectSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type Project = {
  slug: string;
  title: string;
  location: string;
  region: string;
  type: 'Residential' | 'Commercial';
  roof: 'Pitched' | 'Gable' | 'Hip' | 'Perimeter';
  year: string;
  heroImage: Image;
  caseStudyHeroImage?: Image;
  gallery: Image[];
  blurb: string;
  constraint: string;
  configuration?: 'Freestanding' | 'Attached';
  roofApproach: string;
  materials?: string[];
  description: string[];
  stats: ProjectStats;
  tags: string[];
  sections: ProjectSection[];
  related?: string[];
  videoYoutubeId?: string;
};

const baseProjects: Project[] = [
  {
    slug: 'warkworth-outdoor-room',
    title: 'Warkworth Outdoor Room',
    location: 'Warkworth, Auckland',
    region: 'North Auckland',
    type: 'Residential',
    roof: 'Gable',
    year: '2025',
    heroImage: {
      src: WARKWORTH_EXTERIOR_IMAGE,
      alt: 'Freestanding matte black gable outdoor room beside a Warkworth home',
      objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION,
    },
    gallery: [
      {
        src: '/images/project-warkworth-outdoor-room-02.jpg',
        alt: 'Interior outdoor room with cedar ceiling, pendant lighting and lounge seating',
        objectPosition: '50% 42%',
      },
      {
        src: '/images/project-warkworth-outdoor-room-03.jpg',
        alt: 'Fireplace and lounge area beneath the Warkworth gable outdoor room',
        objectPosition: '48% 44%',
      },
      {
        src: '/images/project-warkworth-outdoor-room-04.jpg',
        alt: 'Clear acrylic roof glazing and cedar ceiling detail in the Warkworth outdoor room',
        objectPosition: '46% 43%',
      },
      {
        src: '/images/project-warkworth-outdoor-room-05.jpg',
        alt: 'Garden-side exterior view with the fireplace chimney and matte black roof',
        objectPosition: '56% 42%',
      },
      {
        src: WARKWORTH_EXTERIOR_IMAGE,
        alt: 'Exterior gable view of the freestanding Warkworth outdoor room',
        objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION,
      },
      {
        src: '/images/project-warkworth-outdoor-room-06.jpg',
        alt: 'Side entry and deck view into the Warkworth outdoor room',
        objectPosition: '50% 44%',
      },
      {
        src: '/images/project-warkworth-outdoor-room-07.jpg',
        alt: 'Exterior view of the Warkworth outdoor room with screens and planting',
        objectPosition: '50% 45%',
      },
    ],
    blurb:
      'A freestanding gable room combining mixed roofing, cedar lining, a new deck, fireplace and lighting.',
    constraint:
      'Create a sheltered outdoor room beside the house without relying on the existing house for support.',
    configuration: 'Freestanding',
    roofApproach: 'Corrugated COLORSTEEL with clear acrylic roof and gable glazing',
    materials: ['Aluminium', 'Steel', 'COLORSTEEL', 'Clear acrylic', 'Cedar lining'],
    description: [
      'The brief for this Warkworth home was to create a proper outdoor room beside the house: sheltered enough to use often, open enough to stay connected to the garden, and detailed so it felt like a permanent part of the property.',
      'We built a freestanding gable structure beside the home rather than relying on the existing house for support. The matte black frame and COLORSTEEL FlaxPod Matte roof give the room a crisp architectural profile, with clear acrylic glazing placed through the roof and gable ends in response to the daylight brief.',
      'Completed in November 2025, the project also included a new deck and fireplace, turning the covered area into a complete outdoor living space. Warm cedar tongue-and-groove lining, pendant lighting and recessed lights finish the room for dining and lounging.',
    ],
    stats: {
      width: '5.0 m',
      depth: '6.0 m',
      height: '4.1 m',
      area: '30.0 m²',
      pitch: '30°',
    },
    tags: ['Residential', 'Gable', 'Outdoor room', 'Matte black', 'Clear acrylic', 'Cedar ceiling', 'Fireplace'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'The clients wanted more than a deck cover. The goal was to create an outdoor room beside the house, with enough enclosure and comfort to support everyday use while still feeling open to the surrounding garden.',
          'A freestanding gable form gave the space height, symmetry and independence from the existing house structure. It also allowed the new deck and fireplace to be planned as part of one complete outdoor living area.',
        ],
        bullets: [
          'Create a sheltered outdoor room beside the house',
          'Keep the space bright with clear acrylic glazing',
          'Integrate the new deck, fireplace and lighting into the overall layout',
        ],
      },
      {
        title: 'Structure & finish',
        paragraphs: [
          'The structure combines aluminium and steel framing with a matte black finish. Engineering PS1 was provided for the project, giving the freestanding frame the right structural basis for the site and roof form.',
        ],
        bullets: [
          'Freestanding aluminium and steel gable structure',
          'COLORSTEEL FlaxPod Matte roofing',
          'Dulux Duralloy Solid Black - Matt, 9159041M frame colour reference',
          'Engineering PS1 provided',
        ],
      },
      {
        title: 'Roof, glazing & ceiling',
        paragraphs: [
          'The gable roof combines corrugated Colorsteel with clear acrylic zones through the roof and gable ends. A cedar tongue-and-groove ceiling lining finishes the solid-roof section with a warm interior character.',
        ],
        bullets: [
          'Clear acrylic roof and gable glazing',
          'Cedar tongue-and-groove ceiling lining',
          'Matte black flashings and frame details',
        ],
      },
      {
        title: 'Outdoor room details',
        paragraphs: [
          'The new fireplace, deck and lighting complete the space as a room rather than a simple shelter. Electrical lighting was installed by a registered electrician, with feature pendants and downlights creating a warm evening setting.',
        ],
        bullets: [
          'New deck built with the outdoor room',
          'New fireplace and chimney integrated beside the covered area',
          'Lighting installed by a registered electrician',
        ],
      },
    ],
    related: ['dairy-flat-estate', 'st-heliers-townhouse', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'mt-maunganui-box',
    title: 'Mt Maunganui Box',
    location: 'Mt Maunganui, Bay of Plenty',
    region: 'Bay of Plenty',
    type: 'Residential',
    roof: 'Perimeter',
    year: '2025',
    heroImage: {
      src: '/images/project-mt-maunganui-01.jpg',
      alt: 'First-floor box-perimeter pergola with opal acrylic roof on a dark Mt Maunganui home',
      objectPosition: '50% 0%',
    },
    gallery: [
      {
        src: '/images/project-mt-maunganui-01.jpg',
        alt: 'First-floor box-perimeter pergola with opal acrylic roof on a dark Mt Maunganui home',
        objectPosition: '50% 0%',
      },
      {
        src: '/images/project-mt-maunganui-02.jpg',
        alt: 'Front view of the Mt Maunganui first-floor deck cover with dark aluminium framing',
        objectPosition: '50% 0%',
      },
      {
        src: '/images/project-mt-maunganui-03.jpg',
        alt: 'View beneath the opal acrylic pergola roof along the first-floor deck at Mt Maunganui',
        objectPosition: '50% 0%',
      },
    ],
    blurb:
      'A first-floor box-perimeter pergola designed around the balustrade and outlook.',
    constraint:
      'Cover a first-floor deck while preserving the glass balustrade, outlook and natural light.',
    roofApproach: '6 mm opal acrylic at a 5 degree fall with a hip-style end junction',
    materials: ['Powder-coated aluminium', 'Opal acrylic'],
    description: [
      'This Mt Maunganui project adds overhead cover to a first-floor deck on a contemporary dark-clad home. The box-perimeter frame gives the structure a strong architectural edge, while opal acrylic was selected in response to the brief for daylight and glare.',
      'The roof was set out with a 5 degree fall and a hip-style junction at the outside end, allowing the cover to follow the deck geometry while keeping the perimeter line crisp from below and from the garden. Dark aluminium framing references the house cladding and joinery.',
    ],
    stats: {
      width: '8.67 m',
      depth: '3.1 m',
      area: '26.9 m²',
      pitch: '5°',
    },
    tags: ['Residential', 'Box-perimeter', 'Hip', 'Opal acrylic', 'First-floor deck', 'Aluminium'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Create a covered first-floor deck that matched the home\'s dark contemporary exterior and preserved the open feeling of the balcony. The brief kept the glass balustrade, outlook, daylight and glare as design priorities.',
        ],
        bullets: [
          'Cover the first-floor deck without closing in the view',
          'Select the roof material against the daylight and glare brief',
          'Keep the frame aligned with the home\'s dark architectural language',
        ],
      },
      {
        title: 'Structure & finish',
        paragraphs: [
          'The pergola uses a dark powder-coated aluminium frame with a strong box perimeter. The plan calls up 300 x 50 mm aluminium beams, 100 x 50 mm aluminium rafters and 150 x 150 mm posts, giving the deck cover a clean, deliberate profile.',
        ],
        bullets: [
          'Dark aluminium box-perimeter frame',
          '300 x 50 mm beam and 100 x 50 mm rafter layout',
          '150 x 150 mm posts positioned to keep the deck edge open',
        ],
      },
      {
        title: 'Roof & glazing',
        paragraphs: [
          'Opal acrylic roofing spans the deck inside the box perimeter. The 5 degree fall establishes the drainage direction, while the hip-style end detail resolves the angled deck geometry.',
        ],
        bullets: [
          '6 mm opal acrylic glazing',
          '5 degree roof fall',
          'Hip-style roof junction at the outside end',
        ],
      },
    ],
    related: ['waiheke-holiday-home', 'st-heliers-townhouse', 'dairy-flat-estate'],
  },
  {
    slug: 'lilliput-mini-golf',
    title: 'Lilliput Mini Golf',
    location: '3 Tamaki Drive, Parnell, Auckland',
    region: 'Central Auckland',
    type: 'Commercial',
    roof: 'Pitched',
    year: '2025',
    heroImage: {
      src: '/images/project-tamaki-dr-01.jpg',
      alt: 'Pitched pergola at Lilliput Mini Golf on Tamaki Drive',
      objectPosition: '50% 42%',
    },
    gallery: [
      { src: '/images/project-tamaki-dr-01.jpg', alt: 'Pitched pergola framing the mini golf clubhouse', objectPosition: '50% 42%' },
      { src: '/images/project-tamaki-dr-02.jpg', alt: 'Pergola structure sitting over mini golf seating', objectPosition: '50% 48%' },
      { src: '/images/project-tamaki-dr-03.jpg', alt: 'View along the Tamaki Drive mini golf pergola', objectPosition: '50% 45%' },
      { src: '/images/project-tamaki-dr-04.jpg', alt: 'Detail of steel and aluminium connections at Lilliput Mini Golf', objectPosition: '50% 50%' },
    ],
    blurb:
      'A pitched pergola supplied and installed within a consultant-led venue renovation.',
    constraint:
      'Integrate coverage into the mini golf course without blocking key sightlines or competing with the renovation budget.',
    roofApproach: 'Acrylic panels on a shallow 8 degree pitched roof',
    materials: ['Steel', 'Aluminium', 'Acrylic roofing'],
    description: [
      'Lilliput Mini Golf brought us in as part of a wider refresh of their Tamaki Drive site. The brief was to create a simple pergola that would cover key circulation and seating without competing with the course layout or blowing the budget.',
      'We worked alongside the client’s architect and engineer to land on a clean pitched frame that could pick up existing foundations and clear services. Several iterations pared the structure back to only what mattered: span, head height and a roof profile that sat comfortably against the clubhouse.',
      'Our role on this project focused on supply and installation of the structure itself, coordinating closely with other trades so cladding, lighting and course upgrades could plug in once the frame was complete.',
    ],
    stats: {
      width: '12.0 m',
      depth: '6.0 m',
      height: '5.8 m',
      area: '72 m²',
      pitch: '8°',
    },
    tags: ['Commercial', 'Acrylic roof', 'Steel'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Integrate a new pergola into an existing mini golf course without blocking key sightlines or making the site feel enclosed. The structure needed to be straightforward and tuned carefully to budget.',
          'Multiple size and layout options were explored with the design team before settling on a clean, pitched frame that could sit neatly alongside the clubhouse and work with existing levels.',
        ],
        bullets: [
          'Support a staged renovation of the course',
          'Balance coverage, head height and budget',
          'Keep views across the putting greens open',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          'The primary frame combines steel for the main spans with aluminium beams and purlins, bringing strength where it is needed and lightweight elements elsewhere. Connections are kept honest and readable so the structure feels intentional rather than decorative.',
        ],
        bullets: [
          'Steel and aluminium frame tuned for the required spans',
          'Dulux Slate Blue Matt powder coat for a calm, coastal tone',
          'Simple detailing coordinated with the venue renovation',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Acrylic roof panels cover the nominated walkways and seating. The shallow 8° pitch keeps the profile low against the clubhouse roofline and establishes the recorded roof fall.',
        ],
        bullets: [
          'Acrylic roofing over the covered circulation and seating',
          '8° roof pitch to sit under existing building lines',
          'Perimeter flashings ready for future cladding and lighting',
        ],
      },
      {
        title: 'Install & coordination',
        paragraphs: [
          'Our scope focused on supply and installation of the pergola structure, working to drawings prepared by the project architect and engineer. We sequenced works so the venue could continue operating while other trades completed cladding, lighting and theming.',
        ],
        bullets: [
          'Installed structure only, coordinated with wider renovation team',
          'Set out to avoid existing lighting, services and course features',
          'Left clear fixing zones for future signage and decorative elements',
        ],
      },
    ],
    related: ['waiheke-holiday-home', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'waiheke-holiday-home',
    title: 'Waiheke Holiday Home',
    location: 'Palm Beach, Waiheke Island',
    region: 'Hauraki Gulf',
    type: 'Residential',
    roof: 'Perimeter',
    year: '2025',
    heroImage: { src: '/images/project-waiheke-01.jpg', alt: 'Perimeter roof looking over a coastal Waiheke deck', objectPosition: '50% 48%' },
    gallery: [
      { src: '/images/project-waiheke-04.jpg', alt: 'Detail of perimeter beam and roof junction', objectPosition: '50% 42%' },
      { src: '/images/project-waiheke-03.jpg', alt: 'Daytime view of the pergola over the deck', objectPosition: '50% 48%' },
      { src: '/images/project-waiheke-01.jpg', alt: 'Perimeter frame with coastal planting', objectPosition: '50% 48%' },
    ],
    blurb: 'A box-perimeter deck cover designed to preserve the water view.',
    constraint:
      'Extend the living space onto the deck without interrupting the water outlook or exposing the roof fall and gutters.',
    roofApproach: '4 degree roof fall and gutters concealed behind the perimeter beam',
    description: [
      'The client wanted to extend the living space out onto the deck, creating a covered zone that felt like part of the house rather than an add-on. We looked at both pitched and box-perimeter options to see what would sit best against the existing facade.',
      'A box-perimeter frame won out because it lines up cleanly with the house geometry. A taller perimeter beam lets the roof read as a straight line from outside, hiding the 4° fall and gutters behind the beam so the view toward the water stays tidy.',
    ],
    stats: {
      width: '5.0 m',
      depth: '4.0 m',
      height: '2.8 m',
      area: '20.0 m²',
      pitch: '4°',
    },
    tags: ['Coastal', 'Screens', 'Perimeter'],
    sections: [
      {
        title: 'Design response',
        paragraphs: [
          'The design extends the living space onto the deck while keeping the coastal outlook open. A box-perimeter frame was selected after pitched and perimeter options were considered against the existing facade.',
        ],
        bullets: [
          '5.0 m by 4.0 m recorded footprint',
          '2.8 m recorded height',
          'Perimeter form aligned with the house geometry',
        ],
      },
      {
        title: 'Roof line and screens',
        paragraphs: [
          'The taller perimeter beam conceals the recorded 4 degree roof fall and gutters so the outside edge reads as a clean horizontal line. Screen integration is included in the published project record.',
        ],
        bullets: [
          '4 degree roof fall recorded for the project',
          'Gutters concealed behind the perimeter beam line',
          'Screens coordinated with the covered deck',
        ],
      },
    ],
    related: ['lilliput-mini-golf', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'goodhome-commercial-terrace',
    title: 'The Good Home Takanini',
    location: 'Takanini, Auckland',
    region: 'South Auckland',
    type: 'Commercial',
    roof: 'Gable',
    year: '2024',
    heroImage: { src: '/images/project-goodhome-01.jpg', alt: 'Covered hospitality courtyard with gable pergola', objectPosition: '50% 48%' },
    gallery: [
      { src: '/images/project-goodhome-01.jpg', alt: 'Twilight crowd under the pergola', objectPosition: '50% 48%' },
      { src: '/images/project-goodhome-02.jpg', alt: 'Cafe blinds closing the courtyard edge', objectPosition: '50% 50%' },
      { src: '/images/project-goodhome-03.jpg', alt: 'Detail of structural column and planter', objectPosition: '50% 52%' },
      { src: '/images/project-goodhome-04.jpg', alt: 'Lighting wash across the roof panels', objectPosition: '50% 44%' },
    ],
    blurb: 'Two gables extending the villa-style facade over the restaurant courtyard.',
    constraint:
      'Cover the restaurant courtyard while preserving the villa-style facade and its established 25 degree gable rhythm.',
    roofApproach: 'Acrylic roofing over two 25 degree gable zones',
    materials: ['Steel', 'Aluminium', 'Acrylic roofing'],
    description: [
      'The client wanted to cover the front courtyard of their restaurant while keeping the architecture reading as a single, coherent villa-style facade. The existing building features 25° roofs and a rhythm of gables that we needed to respect.',
      'We matched the 25° roof pitch and extended from the existing roofline to carry that geometry out over the courtyard. The two new gable zones align with the established rhythm of the villa-style facade.',
    ],
    stats: {
      width: '10.09 m',
      depth: '6.7 m',
      height: '3.5 m',
      area: '67.7 m²',
      pitch: '25°',
    },
    tags: ['Hospitality', 'Lighting', 'Screens', 'Aluminium', 'Steel', 'Acrylic roof'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Cover the restaurant courtyard while preserving the villa-style facade and the established rhythm of the building gables.',
        ],
        bullets: [
          'Two-zone gable cover',
          '25 degree roof pitch matched to the existing building',
          'Covered hospitality courtyard',
        ],
      },
      {
        title: 'Structure and integration',
        paragraphs: [
          'Steel and aluminium framing carries the acrylic roof out from the existing roofline. Screens and lighting were integrated into the completed hospitality setting.',
        ],
        bullets: [
          '10.09 m by 6.7 m recorded footprint',
          'Acrylic roof over the two gable zones',
          'Lighting and screens included in the published project record',
        ],
      },
    ],
    related: ['kiwi-rail-platform', 'atelier-shu-cafe'],
  },
  {
    slug: 'kiwi-rail-platform',
    title: 'KiwiRail Head Office',
    location: '12/660 Great South Road, Greenlane, Auckland',
    region: 'Central Auckland',
    type: 'Commercial',
    roof: 'Pitched',
    year: '2024',
    heroImage: { src: '/images/project-kiwi-rail-02.jpg', alt: 'Steel pergola shelter at a rail facility', objectPosition: '50% 50%' },
    gallery: [
      { src: '/images/project-kiwi-rail-01.jpg', alt: 'Wide shot of platform canopy structure', objectPosition: '50% 48%' },
      { src: '/images/project-kiwi-rail-02.jpg', alt: 'Night lighting along rail canopy', objectPosition: '50% 50%' },
      { src: '/images/project-kiwi-rail-03.jpg', alt: 'Detail of structural connection', objectPosition: '50% 50%' },
    ],
    blurb: 'An aluminium and acrylic canopy with integrated lighting along a workplace route.',
    constraint:
      'Cover a connection between circulation routes while keeping the long workplace canopy visually light.',
    roofApproach: 'Acrylic canopy at a recorded 5 degree pitch',
    materials: ['Aluminium', 'Acrylic roofing'],
    description: [
      'We were approached by JCY Architects to bring their canopy design to life for the KiwiRail head office. The brief was to cover a pathway between key circulation routes around the building.',
      'The completed canopy combines aluminium, acrylic roofing and integrated strip lighting along the long workplace route.',
    ],
    stats: {
      width: '30.0 m',
      depth: '3.0 m',
      height: '3.8 m',
      area: '115 m²',
      pitch: '5°',
    },
    tags: ['Infrastructure', 'Lighting', 'Steel', 'Aluminium', 'Acrylic roof'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'JCY Architects engaged Sanctuary to help deliver a covered path between key circulation routes at the KiwiRail head office.',
        ],
        bullets: [
          'Architect-led canopy design',
          'Covered connection between circulation routes',
          'Integrated strip lighting',
        ],
      },
      {
        title: 'Structure and roof',
        paragraphs: [
          'The completed canopy uses aluminium and acrylic along the long walkway, with strip lighting incorporated into the structure.',
        ],
        bullets: [
          '30.0 m recorded length',
          '3.0 m recorded depth',
          '5 degree recorded pitch',
        ],
      },
    ],
    related: ['goodhome-commercial-terrace', 'atelier-shu-cafe'],
  },
  {
    slug: 'tindalls-bay-pavilion',
    title: 'Tindalls Bay - Patio & Carport',
    location: 'Hibiscus Coast, Auckland',
    region: 'Hibiscus Coast',
    type: 'Residential',
    roof: 'Pitched',
    year: '2025',
    heroImage: {
      src: '/images/project-tindalls-bay-02.jpg',
      alt: 'Tindalls Bay home with connected patio and carport roof structures',
      objectPosition: '50% 48%',
    },
    gallery: [
      {
        src: '/images/project-tindalls-bay.jpg',
        alt: 'Timber battens, acrylic roof zones and the coastal outlook at Tindalls Bay',
        objectPosition: '50% 42%',
      },
      {
        src: '/images/project-tindalls-bay-03.jpg',
        alt: 'Tindalls Bay patio with dining area, mesh blinds, heater and mixed roof zones',
        objectPosition: '50% 45%',
      },
    ],
    blurb: 'A patio and carport using insulated and acrylic roof zones around a complex house.',
    constraint:
      'Resolve a combined patio and carport around the house geometry while retaining daylight through the entry and circulation zones.',
    roofApproach: 'Insulated panels with opal and light grey acrylic roof zones',
    materials: ['Insulated roof panels', 'Opal acrylic', 'Light grey acrylic', 'Timber sarking and battens'],
    description: [
      'The client wanted to cover their patio to extend everyday living space and add a carport alongside. The patio portion was particularly challenging, weaving around the existing nooks and crannies of the house while keeping the interior feeling light.',
      'Over the outdoor dining area we used insulated roof panels with timber sarking underneath for a warm, ceiling-like finish. Around the circulation and front door zones we switched to opal acrylic roofing with timber battens in response to the daylight brief.',
      'Another roof zone uses light grey acrylic, and mesh blinds were added along one side identified in the brief for wind and privacy. The covered area remains open towards the view beyond that edge.',
    ],
    stats: {
      width: '',
      depth: '',
      height: '',
      area: '108 m²',
    },
    tags: ['Coastal', 'Automation', 'Screens'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Cover the patio and add a carport while working around the existing house geometry and retaining light through the adjoining circulation and entry areas.',
        ],
        bullets: [
          '108 square metre recorded covered area',
          'Patio and carport combined in one project',
          'Mesh blinds included along one side',
        ],
      },
      {
        title: 'Roof composition',
        paragraphs: [
          'Insulated roof panels with timber sarking create a ceiling-like finish above the dining area. Opal acrylic and timber battens cover the circulation and front door zones, with light grey acrylic used in another part of the roof.',
        ],
        bullets: [
          'Insulated roof panels over the dining zone',
          'Opal and light grey acrylic in daylight-sensitive areas',
          'Timber battens used with the opal acrylic section',
        ],
      },
      {
        title: 'Screening and outlook',
        paragraphs: [
          'Mesh blinds were added along one side identified in the project brief for wind and privacy. The covered area remains open towards the coastal outlook.',
        ],
        bullets: [
          'Mesh blind integration',
          'Privacy from neighbouring properties',
          'Open outlook retained beyond the covered area',
        ],
      },
    ],
    related: ['lilliput-mini-golf', 'waiheke-holiday-home'],
  },
  {
    slug: 'atelier-shu-cafe',
    title: 'Atelier Shu Cafe',
    location: '6D Kent Street, Newmarket, Auckland',
    region: 'Central Auckland',
    type: 'Commercial',
    roof: 'Gable',
    year: '2020',
    heroImage: {
      src: '/images/project-atelier-shu-03.jpg',
      alt: 'Dark-tint acrylic gable canopy across the Atelier Shu Cafe frontage in Newmarket',
      objectPosition: '50% 48%',
    },
    caseStudyHeroImage: {
      src: ATELIER_SHU_CASE_STUDY_HERO_IMAGE,
      alt: 'Front-on view of the dark-tint acrylic gable canopy over outdoor seating at Atelier Shu Cafe in Newmarket',
      objectPosition: ATELIER_SHU_CASE_STUDY_HERO_OBJECT_POSITION,
    },
    gallery: [
      {
        src: '/images/project-atelier-shu-03.jpg',
        alt: 'Dark-tint acrylic gable canopy across the Atelier Shu Cafe frontage in Newmarket',
        objectPosition: '50% 48%',
      },
      {
        src: '/images/project-atelier-shu-01.jpg',
        alt: 'Sheltered outdoor seating beneath the Atelier Shu Cafe canopy',
        objectPosition: '50% 44%',
      },
    ],
    blurb: 'A dark-tint acrylic gable canopy aligned with the cafe frontage.',
    constraint:
      'Add sheltered cafe space while matching the existing frontage and keeping it visually open.',
    roofApproach: 'Dark-tint acrylic roofing on a 30 degree gable',
    materials: ['Aluminium', 'Dark-tint acrylic'],
    description: [
      'The client asked us to add a sheltered space to the specialty dessert cafe while matching the existing architectural style and colours. We aligned the gable frame and colour with the established frontage.',
      'The canopy uses an all-aluminium frame with dark-tint acrylic roofing across the covered outdoor seating area.',
    ],
    stats: {
      width: '9.0 m',
      depth: '4.0 m',
      height: '3.2 m',
      area: '36 m²',
      pitch: '30°',
    },
    tags: ['Cafe', 'Screens', 'Commercial', 'Aluminium', 'Acrylic roof', 'Gable'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Add a sheltered outdoor space to the specialty dessert cafe while matching the existing architectural style and colours.',
        ],
        bullets: [
          'Commercial cafe setting',
          'Existing frontage kept visually open',
          'New canopy coordinated with the building style',
        ],
      },
      {
        title: 'Structure and roof',
        paragraphs: [
          'An all-aluminium frame forms the gable canopy, with dark-tint acrylic roofing selected for the covered outdoor area.',
        ],
        bullets: [
          '9.0 m by 4.0 m recorded footprint',
          '30 degree recorded gable pitch',
          'Dark-tint acrylic roof',
        ],
      },
    ],
    related: ['goodhome-commercial-terrace', 'kiwi-rail-platform'],
  },
  {
    slug: 'muriwai-courtyard',
    title: 'Muriwai Courtyard',
    location: 'Muriwai, Auckland',
    region: 'West Auckland',
    type: 'Residential',
    roof: 'Hip',
    year: '2024',
    heroImage: { src: '/images/project-waitakere-ranges-01.jpg', alt: 'Hip roof pergola in the Waitakere bush', objectPosition: '50% 48%' },
    gallery: [
      { src: '/images/project-waitakere-ranges-01.jpg', alt: 'Lanai with bush backdrop', objectPosition: '50% 48%' },
      { src: '/images/project-waitakere-ranges-02.jpg', alt: 'Night view with fireplace', objectPosition: '50% 50%' },
    ],
    blurb: 'An opal-acrylic hip roof replacing the previous courtyard pergola.',
    constraint:
      'Replace the older pergola on the same footprint while coordinating a contemporary frame with the Tuscan-style home.',
    roofApproach: 'Opal acrylic on a recorded 5 degree hip roof',
    materials: ['Opal acrylic'],
    description: [
      'This hipped pergola replaces an older structure of the same footprint. The clients were happy with the existing layout but wanted a fresh look that would marry a contemporary frame with their Tuscan-style home.',
      'We set out a new 8 m by 5 m cover at 3 m height, using opal acrylic roofing over the courtyard. The 5 degree hip roof retains the established footprint.',
    ],
    stats: {
      width: '8.0 m',
      depth: '5.0 m',
      height: '3.0 m',
      area: '40.0 m²',
      pitch: '5°',
    },
    tags: ['Hip roof', 'Courtyard', 'Opal acrylic', 'Bush'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Replace the older pergola on the same footprint, giving the courtyard a fresh structure that still suits the Tuscan-style home.',
        ],
        bullets: [
          'Existing 8.0 m by 5.0 m footprint retained',
          '3.0 m recorded height',
          'Contemporary frame coordinated with the house',
        ],
      },
      {
        title: 'Hip roof and light',
        paragraphs: [
          'A 5 degree hip roof uses opal acrylic to cover the courtyard within the familiar layout.',
        ],
        bullets: [
          'Opal acrylic roofing',
          '5 degree recorded pitch',
          'Hip form over the courtyard',
        ],
      },
    ],
    related: ['warkworth-outdoor-room', 'waiheke-holiday-home', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'velskov-forest',
    title: 'Velskov Forest',
    location: 'Velskov forest farm, Waitakere Ranges',
    region: 'West Auckland',
    type: 'Commercial',
    roof: 'Pitched',
    year: '',
    heroImage: {
      src: '/images/project-velskov-01.jpg',
      alt: 'Pitched pergola in the middle of native forest at Velskov',
      objectPosition: '50% 48%',
    },
    gallery: [
      { src: '/images/project-velskov-01.jpg', alt: 'Pergola structure sitting within the native forest at Velskov', objectPosition: '50% 48%' },
      { src: '/images/project-velskov-02.jpg', alt: 'Side view of the Velskov pergola surrounded by bush', objectPosition: '50% 48%' },
      { src: '/images/project-velskov-03.jpg', alt: 'Detail of the pergola in the Velskov forest farm', objectPosition: '50% 50%' },
    ],
    blurb:
      'A low-profile shelter for a working space beneath the forest canopy.',
    constraint:
      'Provide a dry working space within native forest while keeping the structure low beneath the canopy.',
    roofApproach: 'Shallow 7 degree pitched roof',
    description: [
      'Velskov is a 10-acre natural forest farm just outside Auckland, growing food regeneratively within a biodiverse native bush setting and focusing on agroforestry and ecosystem restoration rather than harvesting trees for timber.',
      'Our brief here was to create a simple, robust structure that could sit quietly in the middle of the native forest, covering a space for farm activity while keeping the focus on the surrounding ecosystem.',
      'We set out a 7 m by 6 m pergola at 3.5 m height with a shallow 7° pitched roof so the cover feels generous underneath but keeps a low profile beneath the forest canopy.',
    ],
    stats: {
      width: '7.0 m',
      depth: '6.0 m',
      height: '3.5 m',
      area: '42.0 m²',
      pitch: '7°',
    },
    tags: ['Commercial', 'Pitched', 'Bush'],
    sections: [],
    related: ['muriwai-courtyard', 'goodhome-commercial-terrace'],
    videoYoutubeId: 'e5RXcNdCrD4',
  },
  {
    slug: 'ardmore-box-carport',
    title: 'Ardmore Box Carport',
    location: 'Ardmore, Auckland',
    region: 'South Auckland',
    type: 'Residential',
    roof: 'Perimeter',
    year: '2025',
    heroImage: {
      src: '/images/project-ardmore-carport-01.jpg',
      alt: 'Front view of the Ardmore box-perimeter carport with red steel framing and acrylic roofing',
      objectPosition: '50% 44%',
    },
    gallery: [
      {
        src: '/images/project-ardmore-carport-01.jpg',
        alt: 'Front view of the Ardmore box-perimeter carport with red steel framing and acrylic roofing',
        objectPosition: '50% 44%',
      },
      {
        src: '/images/project-ardmore-carport-02.jpg',
        alt: 'View beneath the Ardmore carport showing the internal gable roof and steel PFC beams',
        objectPosition: '50% 45%',
      },
      {
        src: '/images/project-ardmore-carport-03.jpg',
        alt: 'Close detail of acrylic roofing, aluminium rafters and red steel framing in the Ardmore carport',
        objectPosition: '50% 42%',
      },
      {
        src: '/images/project-ardmore-carport-04.jpg',
        alt: 'Top-down view of the Ardmore box-perimeter carport roof with gable form inside the frame',
        objectPosition: '50% 46%',
      },
      {
        src: '/images/project-ardmore-carport-05.jpg',
        alt: 'Side view of the Ardmore carport showing the black perimeter fascia and red steel posts',
        objectPosition: '50% 42%',
      },
    ],
    blurb:
      'A box-perimeter carport with acrylic roofing and an internal gable.',
    constraint:
      'Cover a wide driveway while keeping vehicle access clear and the space bright.',
    roofApproach: '6 mm acrylic with a 5 degree fall and an internal gable',
    materials: ['Steel PFC beams', 'Aluminium rafters', 'Acrylic roofing'],
    description: [
      'This Ardmore project turns a wide driveway area beside the home into a covered carport with a strong architectural profile. The black box perimeter gives the structure a clean outer line, while the red steel frame and gable roof form inside create a practical, open span for vehicle access and everyday use.',
      'The roof combines aluminium rafters with steel PFC beams and 6 mm acrylic glazing across the driveway. The main roof falls at 5 degrees, with the internal gable section resolving the roof geometry inside the perimeter frame. Integrated LED lighting completes the carport.',
    ],
    stats: {
      width: '8.77 m',
      depth: '6.19 m',
      area: '54.3 m²',
      pitch: '5°',
    },
    tags: ['Residential', 'Box-perimeter', 'Gable', 'Carport', 'Steel', 'Aluminium', 'Acrylic roof', 'LED lighting'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Create a large covered carport that felt deliberate beside the existing home, not like a lightweight add-on. The brief called for clear vehicle access, overhead cover and a roof material selected with daylight in mind.',
        ],
        bullets: [
          'Cover a wide driveway and carport zone',
          'Keep the perimeter line clean and architectural',
          'Use a gable form inside the box frame to manage the roof shape',
        ],
      },
      {
        title: 'Structure & finish',
        paragraphs: [
          'The structure uses steel PFC beams for the main frame, with aluminium rafters and guttering to complete the roof system. The red steelwork gives the underside a bold, exposed structural character, while the black perimeter wraps the carport with a crisp outer edge.',
        ],
        bullets: [
          'Steel PFC beam structure',
          'Aluminium rafters, including 100 x 50 mm and 80 x 50 mm members',
          '150 x 100 mm aluminium SP gutter',
          'Black box perimeter with exposed red structural framing',
        ],
      },
      {
        title: 'Roof & glazing',
        paragraphs: [
          'The roof uses 6 mm acrylic glazing over the main carport span. A 5 degree fall establishes the drainage direction across the larger roof areas, while the gable section sits inside the perimeter frame to bring height and structure through the centre.',
        ],
        bullets: [
          '6 mm acrylic roofing',
          '5 degree fall to the main roof planes',
          'Internal gable form inside the box perimeter',
          '12 LED lights integrated into the carport',
        ],
      },
    ],
    related: ['mt-maunganui-box', 'waiheke-holiday-home', 'dairy-flat-estate'],
  },
  {
    slug: 'riverhead-gable-pavilion',
    title: 'Riverhead Gable Pavilion',
    location: 'Riverhead, Auckland',
    region: 'Northwest Auckland',
    type: 'Residential',
    roof: 'Gable',
    year: '2026',
    heroImage: {
      src: '/images/project-riverhead-gable-01.jpg',
      alt: 'Front view of the Riverhead poolside gable pavilion with timber sarking and black framing',
      objectPosition: '50% 45%',
    },
    gallery: [
      {
        src: '/images/project-riverhead-gable-01.jpg',
        alt: 'Front view of the Riverhead poolside gable pavilion with timber sarking and black framing',
        objectPosition: '50% 45%',
      },
      {
        src: '/images/project-riverhead-gable-02.jpg',
        alt: 'Wide view of the Riverhead gable pavilion beside the pool and landscaped garden',
        objectPosition: '50% 45%',
      },
      {
        src: '/images/project-riverhead-gable-03.webp',
        alt: 'Detail of timber sarking, downlights and LED strip lighting inside the Riverhead gable roof',
        objectPosition: '50% 0%',
      },
      {
        src: '/images/project-riverhead-gable-04.jpg',
        alt: 'Riverhead gable pavilion with black frame and sheltered seating beside the pool',
        objectPosition: '50% 0%',
      },
      {
        src: '/images/project-riverhead-gable-05.jpg',
        alt: 'Side view of the Riverhead poolside pavilion showing the gable roof and timber-lined underside',
        objectPosition: '50% 0%',
      },
    ],
    blurb:
      'A poolside gable pavilion with timber lining and integrated lighting.',
    constraint:
      'Shelter the poolside lounge without blocking the outlook or making the deck feel heavy.',
    roofApproach: 'Insulated gable roof with timber sarking',
    materials: ['Aluminium', 'Steel', 'Timber sarking'],
    description: [
      'This Riverhead project places a covered outdoor lounge beside the pool. The gable form gives the pavilion height and symmetry, while the black frame keeps the structure sharp against the surrounding landscape and modern home.',
      'The build combines aluminium framing with steel beams for the main structure, then finishes the underside with timber sarking. Skillion insulation sits above the lining, with downlights and warm LED strip lighting integrated around the ceiling edges.',
    ],
    stats: {
      width: '5.55 m',
      depth: '4.20 m',
      area: '23.3 m²',
    },
    tags: ['Residential', 'Gable', 'Poolside', 'Timber sarking', 'Steel', 'Aluminium', 'Downlights', 'LED lighting', 'Insulated roof'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Create a covered poolside lounge that felt open to the garden and view. The structure needed to sit confidently beside the pool without blocking the outlook or feeling too heavy on the deck.',
        ],
        bullets: [
          'Provide shelter beside the pool',
          'Keep the view open through the gable end',
          'Create a warm outdoor-room feel with timber and lighting',
        ],
      },
      {
        title: 'Structure & finish',
        paragraphs: [
          'The pavilion uses a combination of aluminium and steel beams for strength and clean spans. The black frame gives the roof a crisp outline, while the timber sarking adds warmth and texture to the ceiling.',
        ],
        bullets: [
          'Aluminium and steel beam structure',
          'Black exterior frame and posts',
          'Timber sarking to the underside of the gable roof',
          'Open gable end framing the landscape',
        ],
      },
      {
        title: 'Roof, insulation & lighting',
        paragraphs: [
          'Skillion insulation sits above the timber sarking, with downlights set into the ceiling and LED strip lighting following the ceiling edges.',
        ],
        bullets: [
          'Skillion insulation above timber sarking',
          'Integrated downlights',
          'Warm LED strip lighting around the ceiling perimeter',
          'Poolside cover sized at approximately 5.55 m x 4.20 m',
        ],
      },
    ],
    related: ['warkworth-outdoor-room', 'st-heliers-townhouse', 'dairy-flat-estate'],
  },
  {
    slug: 'st-heliers-townhouse',
    title: 'St Heliers Townhouse',
    location: 'St Heliers, Auckland',
    region: 'Central Auckland',
    type: 'Residential',
    roof: 'Gable',
    year: '2024',
    heroImage: { src: '/images/project-st-heliers-01.jpg', alt: 'Pergola at a St Heliers townhouse', objectPosition: '50% 50%' },
    gallery: [
      { src: '/images/project-st-heliers-01.jpg', alt: 'Pergola at a St Heliers townhouse', objectPosition: '50% 50%' },
      { src: '/images/project-st-heliers-02.jpg', alt: 'Side view of the townhouse pergola', objectPosition: '50% 50%' },
    ],
    blurb: 'An open gable with opal acrylic and a custom street-facing frame.',
    constraint:
      'Extend the roofline while giving the street-facing gable end an intentional architectural pattern.',
    roofApproach: 'Opal acrylic over an open gable form',
    materials: ['Aluminium', 'Opal acrylic'],
    description: [
      'The clients wanted to extend their roofline with a gable shape and add a custom aluminium framing pattern to the gable end so the pergola would look intentional from the street.',
      'We set out a 6 m by 3 m cover at 2.7 m height, selecting opal acrylic roofing in response to the brief for daylight and glare. The bespoke aluminium pattern gives the open, street-facing gable end a clear identity.',
    ],
    stats: {
      width: '6.0 m',
      depth: '3.0 m',
      height: '2.7 m',
      area: '18.0 m²',
    },
    tags: ['Residential', 'Gable', 'Opal acrylic', 'Aluminium'],
    sections: [],
    related: ['dairy-flat-estate', 'warkworth-outdoor-room', 'waiheke-holiday-home'],
  },
  {
    slug: 'dairy-flat-estate',
    title: 'Dairy Flat Estate',
    location: 'Dairy Flat, Auckland',
    region: 'North Auckland',
    type: 'Residential',
    roof: 'Gable',
    year: '2025',
    heroImage: { src: '/images/project-dairy-flat-01.jpg', alt: 'Pergola at a Dairy Flat estate', objectPosition: '50% 48%' },
    gallery: [
      { src: '/images/project-dairy-flat-01.jpg', alt: 'Pergola at a Dairy Flat estate', objectPosition: '50% 48%' },
      { src: '/images/project-dairy-flat-03.jpg', alt: 'Side view of the Dairy Flat pergola', objectPosition: '50% 44%' },
      { src: '/images/project-dairy-flat-02.jpg', alt: 'Detail of the pergola framing at Dairy Flat', objectPosition: '50% 42%' },
    ],
    blurb: 'An aluminium and acrylic gable following the existing roofline.',
    constraint:
      'Extend the existing roofline without darkening the adjoining outdoor space.',
    roofApproach: 'Acrylic gable roof following the existing house roofline',
    materials: ['Aluminium', 'Acrylic roofing'],
    description: [
      'The clients wanted to extend their existing roofline to capture more usable outdoor space. We followed the house form with aluminium framing and acrylic roofing, continuing the existing roof geometry over the outdoor area.',
      'Acrylic roofing was selected in response to the daylight brief. The infilled gable end adds a covered side to one edge, while the garden side remains open.',
    ],
    stats: {
      width: '8.6 m',
      depth: '3.3 m',
      height: '3.0 m',
      area: '28.4 m²',
    },
    tags: ['Residential', 'Gable'],
    sections: [],
    related: ['warkworth-outdoor-room', 'st-heliers-townhouse', 'waiheke-holiday-home'],
  },
];

const projectOrder: string[] = [
  'warkworth-outdoor-room',      // Warkworth Outdoor Room
  'mt-maunganui-box',            // Mt Maunganui Box
  'lilliput-mini-golf',          // Lilliput Mini Golf
  'riverhead-gable-pavilion',    // Riverhead Gable Pavilion
  'velskov-forest',              // Velskov Forest
  'tindalls-bay-pavilion',       // Tindalls Bay - Patio & Carport
  'goodhome-commercial-terrace', // The Good Home Takanini
  'dairy-flat-estate',           // Dairy Flat Estate
  'muriwai-courtyard',           // Muriwai Courtyard
  'ardmore-box-carport',         // Ardmore Box Carport
  'st-heliers-townhouse',        // St Heliers Townhouse
  'kiwi-rail-platform',          // KiwiRail Head Office
  'waiheke-holiday-home',        // Waiheke Holiday Home
  'atelier-shu-cafe',            // Atelier Shu Cafe
];

export const projects: Project[] = [...baseProjects].sort((a, b) => {
  const ia = projectOrder.indexOf(a.slug);
  const ib = projectOrder.indexOf(b.slug);
  const aPos = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
  const bPos = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
  return aPos - bPos;
});
