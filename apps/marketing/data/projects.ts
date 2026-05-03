// data/projects.ts
export type Image = { src: string; alt: string; fallbackJpg?: string; w?: number; h?: number; objectPosition?: string };

export type ProjectStats = {
  width?: string;
  depth?: string;
  height?: string;
  area?: string;
  pitch?: string;
};

export type ProjectSection = {
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
  gallery: Image[];
  blurb: string;
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
      src: '/images/project-warkworth-outdoor-room-01.jpg',
      alt: 'Freestanding matte black gable outdoor room beside a Warkworth home',
      objectPosition: '50% 34%',
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
        src: '/images/project-warkworth-outdoor-room-01.jpg',
        alt: 'Exterior gable view of the freestanding Warkworth outdoor room',
        objectPosition: '50% 34%',
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
      'Freestanding gable outdoor room beside the house, with a new deck, fireplace, clear acrylic glazing, cedar ceiling and matte black Colorsteel finish.',
    description: [
      'The brief for this Warkworth home was to create a proper outdoor room beside the house: sheltered enough to use often, open enough to stay connected to the garden, and detailed so it felt like a permanent part of the property.',
      'We built a freestanding gable structure beside the home rather than relying on the existing house for support. The matte black frame and COLORSTEEL FlaxPod Matte roof give the room a crisp architectural profile, while clear acrylic glazing through the roof and gable ends keeps daylight moving through the space.',
      'Completed in November 2025, the project also included a new deck and fireplace, turning the covered area into a complete outdoor living space. Warm cedar tongue-and-groove lining, pendant lighting and recessed lights finish the room for dining, lounging and year-round entertaining.',
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
          'The gable roof uses corrugated Colorsteel with clear acrylic glazing to bring natural light into the outdoor room. A cedar tongue-and-groove ceiling lining softens the underside and gives the space a warm interior feel.',
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
    slug: 'devonport-gable-lightwell',
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
      'Budget-balanced pitched pergola in Slate Blue Matt, installed as part of a mini golf course renovation on Tamaki Drive.',
    description: [
      'Lilliput Mini Golf brought us in as part of a wider refresh of their Tamaki Drive site. The brief was to create a simple, durable pergola that would cover key circulation and seating without competing with the course layout or blowing the budget.',
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
          'Integrate a new pergola into an existing mini golf course without blocking key sightlines or making the site feel enclosed. The structure needed to be robust, simple to maintain and tuned carefully to budget.',
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
          'Steel and aluminium frame tuned for span and durability',
          'Dulux Slate Blue Matt powder coat for a calm, coastal tone',
          'Simple detailing so maintenance stays straightforward for the venue',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Acrylic roof panels keep rain off walkways and seating while letting plenty of daylight through to the course. The shallow 8° pitch keeps the profile low against the clubhouse roofline while still shedding water cleanly.',
        ],
        bullets: [
          'Acrylic roofing matched to coastal conditions',
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
    related: ['waiheke-coastal-louvre', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'waiheke-coastal-louvre',
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
    blurb: 'Box-perimeter pergola extending a coastal deck, with the roof fall concealed behind a clean perimeter beam line.',
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
        title: 'Design brief',
        paragraphs: [
          'Keep the horizon open, integrate blinds that disappear when not needed and avoid bulky bracing that would catch the wind.',
          'Structure needed to cantilever over an existing low balustrade so every kilo counted while shipping.',
        ],
        bullets: [
          'Transport-friendly modular frame',
          'Wind rating to 160 km/h gusts',
          'Low profile perimeter gutters',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          '220 mm perimeter beams wrap a cavity big enough for wiring, gutters and blind heads. Posts are recessed into the cladding line to keep the deck open.',
        ],
        bullets: [
          'Dulux Protexture in Seashell Satin',
          'Marine-grade stainless fixings',
          'Custom stainless spigots for balustrade transitions',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'A shallow fall drains to two rain heads tucked against the house. We left access hatches inside the beams so filters can be cleaned without removing panels.',
        ],
        bullets: [
          'Insulated aluminium roof panels',
          'Gutters sized for coastal downpours',
          'Future provision for glass skylight inserts',
        ],
      },
      {
        title: 'Screens, lighting & extras',
        paragraphs: [
          'Mesh blinds, heaters and strip lighting are all concealed in the beam cavity, leaving the view untouched when everything is retracted.',
        ],
        bullets: [
          'Somfy RTS blinds with severe-wind mode',
          'Infrared heaters on timer relays',
          'LED strips recessed into the beam lower face',
        ],
      },
    ],
    related: ['devonport-gable-lightwell', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'goodhome-commercial-terrace',
    title: 'The Good Home Takanini',
    location: '260 Great South Road, Takanini, Auckland',
    region: 'South Auckland',
    type: 'Commercial',
    roof: 'Gable',
    year: '2024',
    heroImage: { src: '/images/project-goodhome-01.jpg', alt: 'Covered hospitality courtyard with perimeter pergola', objectPosition: '50% 48%' },
    gallery: [
      { src: '/images/project-goodhome-01.jpg', alt: 'Twilight crowd under the pergola', objectPosition: '50% 48%' },
      { src: '/images/project-goodhome-02.jpg', alt: 'Cafe blinds closing the courtyard edge', objectPosition: '50% 50%' },
      { src: '/images/project-goodhome-03.jpg', alt: 'Detail of structural column and planter', objectPosition: '50% 52%' },
      { src: '/images/project-goodhome-04.jpg', alt: 'Lighting wash across the roof panels', objectPosition: '50% 44%' },
    ],
    blurb: 'Two-zone perimeter roof matching the villa-style facade, extending the restaurant into a covered front courtyard.',
    description: [
      'The client wanted to cover the front courtyard of their restaurant while keeping the architecture reading as a single, coherent villa-style facade. The existing building features 25° roofs and a rhythm of gables that we needed to respect.',
      'We matched the 25° roof pitch and extended from the existing roofline to carry that geometry out over the courtyard, creating a generous outdoor room that blends seamlessly into the building and feels like part of the original structure.',
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
          'Cover the courtyard, keep head height generous and maintain seating count. We also had to reduce reverberation so conversations at the banquette stayed comfortable.',
        ],
        bullets: [
          'Two structural zones with shared detailing',
          'Acoustic lining allowance',
          'Service access for landlord plant',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          'Steel portals carry aluminium perimeter beams that hide drainage and cabling. Posts land on new pile caps tied around existing services.',
        ],
        bullets: [
          'Two-pack coating to match venue brand palette',
          'Hidden cleats to clamp signage and heaters',
          'Slip-resistant decking upgrades under dripline',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Insulated panels soften rain noise and keep the heat from building during afternoon service. We added a central skylight over the planters to balance daylight.',
        ],
        bullets: [
          '50 mm insulated roofing panels',
          'Frameless skylight over planting zone',
          'Box gutters feeding existing stormwater risers',
        ],
      },
      {
        title: 'Screens, lighting & extras',
        paragraphs: [
          'Every blind, heater and strip is DMX-addressable so staff can set presets for brunch, dinner or live music.',
        ],
        bullets: [
          'DMX-linked RGBW strips and spotlights',
          'Somfy blinds with crash rails',
          'Heatstrip Classic heaters across the leaners',
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
    blurb: 'Aluminium and acrylic canopy creating a dry, well-lit link between key circulation routes at the head office.',
    description: [
      'We were approached by JCY Architects to bring their canopy design to life for the KiwiRail head office. The brief was to create a covered pathway so staff can stay dry while moving between key circulation routes around the building.',
      'They opted for an aluminium and acrylic structure with integrated strip lighting, giving the walkway a light, refined profile that feels safe and inviting day and night.',
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
          'Deliver cover over the service platform without blocking signal sightlines or interfering with pantographs.',
        ],
        bullets: [
          'Minimum 4 m clear internal height',
          'No columns within 1.2 m of rail centreline',
          'Impact resistant cladding to 2.4 m',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          'Hot-dip galvanised steel portals support aluminium secondary framing. All hardware uses tamper-proof heads per KiwiRail spec.',
        ],
        bullets: [
          'AS/NZS 1170 wind design for open terrain',
          'Polyaspartic top coat in KiwiRail signal grey',
          'Integrated cable trays with lockable covers',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Longrun roofing with acoustic blanket and translucent panels over entry bays keeps the platform bright during the day.',
        ],
        bullets: [
          'ColorCote aluminium roofing',
          'Polycarbonate daylight panels every third bay',
          'Oversize gutters with debris screens',
        ],
      },
      {
        title: 'Screens, lighting & extras',
        paragraphs: [
          'Lighting meets EN 12464 lux levels for maintenance areas. Sensors dim fittings when the platform is empty to save energy.',
        ],
        bullets: [
          '0-10V dimmable LED batons',
          'Occupancy and daylight sensors',
          'Allowances for CCTV and PA raceways',
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
    heroImage: { src: '/images/project-tindalls-bay.jpg', alt: 'Coastal pavilion overlooking Tindalls Bay', objectPosition: '50% 42%' },
    gallery: [
      { src: '/images/project-tindalls-bay.jpg', alt: 'Coastal pavilion overlooking Tindalls Bay', objectPosition: '50% 42%' },
      { src: '/images/hero-2.jpg', alt: 'Side view of the Tindalls Bay patio and deck cover', objectPosition: '50% 48%' },
      { src: '/images/product-pitched-01.jpg', alt: 'Pitched roof and timber batten detail at Tindalls Bay', objectPosition: '50% 50%' },
      { src: '/images/hero-1.jpg', alt: 'Tindalls Bay pergola overlooking the coastal view', objectPosition: '50% 45%' },
    ],
    blurb: 'Layered patio and carport cover combining insulated panels, acrylic roofing and battens to keep spaces bright but protected.',
    description: [
      'The client wanted to cover their patio to extend everyday living space and add a carport alongside. The patio portion was particularly challenging, weaving around the existing nooks and crannies of the house while keeping the interior feeling light.',
      'Over the outdoor dining area we used insulated roof panels with timber sarking underneath for a warm, ceiling-like finish. Around the circulation and front door zones we switched to opal acrylic roofing with timber battens so daylight can flood in while the battens soften and diffuse the light.',
      'On one portion we introduced light grey acrylic to bring in more light again, and along one side we added mesh blinds for wind protection and privacy from neighbours. Together the mix of roof types and screening frames a beautiful view without closing the house off from the outdoors.',
    ],
    stats: {
      width: '-',
      depth: '-',
      height: '-',
      area: '108 m²',
    },
    tags: ['Coastal', 'Automation', 'Screens'],
    sections: [
      {
        title: 'Design brief',
        paragraphs: [
          'Create shade without closing off the cliff-face view and keep hardware resistant to salt spray.',
        ],
        bullets: [
          'No intermediate columns',
          'Automation for high wind events',
          'Screens that disappear when lowered',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          'We used aluminium portals locked into the deck bearer line so waterproofing could stay intact.',
        ],
        bullets: [
          'Marine-grade powder coat',
          'Stainless fixings with nylon isolators',
          'Recessed base plates behind balustrade line',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Twinwall polycarbonate keeps the space bright while reducing weight on the deck.',
        ],
        bullets: [
          'Twinwall polycarbonate infill',
          'Vented ridge flashing',
          'Gutters tied into deck outlets',
        ],
      },
      {
        title: 'Screens, lighting & extras',
        paragraphs: [
          'Screens, sensors and lighting all feed back to a single handheld remote so the clients can react quickly to the westerly.',
        ],
        bullets: [
          'Somfy RTS controls for screens',
          'Integrated wind/rain sensors',
          'Warm-white wall lights at each post',
        ],
      },
    ],
    related: ['devonport-gable-lightwell', 'waiheke-coastal-louvre'],
  },
  {
    slug: 'atelier-shu-cafe',
    title: 'Atelier Shu Cafe',
    location: '6D Kent Street, Newmarket, Auckland',
    region: 'Central Auckland',
    type: 'Commercial',
    roof: 'Gable',
    year: '2020',
    heroImage: { src: '/images/project-atelier-shu-01.jpg', alt: 'Sheltered outdoor area at Atelier Shu Cafe in Newmarket', objectPosition: '50% 44%' },
    gallery: [
      { src: '/images/project-atelier-shu-03.jpg', alt: 'Detail view of the Atelier Shu canopy', objectPosition: '50% 48%' },
      { src: '/images/project-atelier-shu-01.jpg', alt: 'External view of the cafe canopy', objectPosition: '50% 44%' },
    ],
    blurb: 'Aluminium gable canopy with dark-tint acrylic roofing, adding a sheltered outdoor zone to a specialty dessert cafe.',
    description: [
      'The client reached out to add a sheltered space to their beautiful specialty dessert cafe (highly recommended). We were able to do this while matching the existing architectural style and colours so the new structure feels like it has always been there.',
      'The canopy uses an all-aluminium frame with dark-tint acrylic roofing. This blocks a good amount of sun and heat so the space stays usable through summer, while still letting in daylight and keeping the cafe frontage bright.',
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
          'Provide cover for customers queuing along the footpath while keeping the shopfront visible and on-brand.',
        ],
        bullets: [
          'Minimal posts in the pedestrian zone',
          'Match existing copper signage details',
          'Allow for future heaters',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          'Perimeter beam bolts back to the facade and transfers loads to two planter-mounted posts. Finish is anodised bronze to tie into the cafe palette.',
        ],
        bullets: [
          'Anodised bronze powder coat',
          'Hidden drainage into council cesspits',
          'Slim mullions to frame the sliders',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Laminated glass roof panels keep the interior bright. A perimeter gutter falls to a single downpipe tucked behind the sign blade.',
        ],
        bullets: [
          '12.76 mm laminated glass roof',
          'Continuous box gutter with overflow',
          'Acoustic interlayer to reduce street noise',
        ],
      },
      {
        title: 'Screens, lighting & extras',
        paragraphs: [
          'Frameless sliders stack to one side during calm days and close off the space on windy afternoons.',
        ],
        bullets: [
          'Frameless sliding glass doors',
          'Dimmable downlights tied into cafe lighting circuit',
          'Prewire for future heaters under the beam',
        ],
      },
    ],
    related: ['goodhome-commercial-terrace', 'kiwi-rail-platform'],
  },
  {
    slug: 'waitakere-ranges-lanai',
    title: 'Muriwai Courtyard',
    location: 'Waitakere Ranges, Auckland',
    region: 'West Auckland',
    type: 'Residential',
    roof: 'Hip',
    year: '2024',
    heroImage: { src: '/images/project-waitakere-ranges-01.jpg', alt: 'Hip roof pergola in the Waitakere bush', objectPosition: '50% 48%' },
    gallery: [
      { src: '/images/project-waitakere-ranges-01.jpg', alt: 'Lanai with bush backdrop', objectPosition: '50% 48%' },
      { src: '/images/project-waitakere-ranges-02.jpg', alt: 'Night view with fireplace', objectPosition: '50% 50%' },
    ],
    blurb: 'Hipped courtyard pergola with opal acrylic roofing, blending a fresh structure into a Tuscan-style home.',
    description: [
      'This hipped pergola replaces an older structure of the same footprint. The clients were happy with the existing layout but wanted a fresh look that would marry a contemporary frame with their Tuscan-style home.',
      'We set out a new 8 m by 5 m cover at 3 m height, using opal acrylic roofing over the courtyard to soften light and keep the space comfortable in all seasons. The result is a bright, sheltered outdoor room the clients love to use year-round.',
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
          'Create an outdoor room that feels like an extension of the lodge interior, complete with fireplace and AV.',
        ],
        bullets: [
          'Coordinate with stonemason programme',
          'Keep beams free of visible wiring',
          'Manage debris from native canopy',
        ],
      },
      {
        title: 'Structure & finishes',
        paragraphs: [
          'Posts bolt to the concrete podium and wrap steel cores with stained cedar cladding. Ceiling lining is tongue-and-groove cedar to match interior joinery.',
        ],
        bullets: [
          'Cedar soffit with concealed fixings',
          'Powder-coated aluminium fascia in FlaxPod',
          'Access hatch for fireplace fan service',
        ],
      },
      {
        title: 'Roof & infill',
        paragraphs: [
          'Hip roof with insulated panels keeps the lanai temperate. Leaf guards snap out for cleaning after storms.',
        ],
        bullets: [
          'Insulated roofing panels with sarking underside',
          'Oversize gutters with removable grates',
          'Ridge vent to purge smoke from fireplace',
        ],
      },
      {
        title: 'Screens, lighting & extras',
        paragraphs: [
          'Lighting is layered between ridge uplights and soffit downlights. Speakers and projector cabling are hidden for movie nights.',
        ],
        bullets: [
          'Speaker prewire terminated in bench cabinet',
          'Dimmable soffit downlights',
          'Provision for clear PVC drops if required later',
        ],
      },
    ],
    related: ['warkworth-outdoor-room', 'waiheke-coastal-louvre', 'tindalls-bay-pavilion'],
  },
  {
    slug: 'velskov-forest',
    title: 'Velskov Forest',
    location: 'Velskov forest farm, Waitakere Ranges',
    region: 'West Auckland',
    type: 'Commercial',
    roof: 'Pitched',
    year: '—',
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
      'Shallow-pitch commercial pergola set in the middle of a native forest farm, providing sheltered space without competing with the canopy.',
    description: [
      'Velskov is a 10-acre natural forest farm just outside Auckland, growing food regeneratively within a biodiverse native bush setting and focusing on agroforestry and ecosystem restoration rather than harvesting trees for timber.',
      'Our brief here was to create a simple, robust structure that could sit quietly in the middle of the native forest, giving Velskov a dry, usable space for farm activity while keeping the focus on the surrounding ecosystem.',
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
    related: ['waitakere-ranges-lanai', 'goodhome-commercial-terrace'],
    videoYoutubeId: 'e5RXcNdCrD4',
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
    blurb: 'Open gable extension with opal acrylic roofing and custom aluminium gable framing for a strong street-front presence.',
    description: [
      'The clients wanted to extend their roofline with a gable shape and add a custom aluminium framing pattern to the gable end so the pergola would look intentional from the street.',
      'We set out a 6 m by 3 m cover at 2.7 m height using opal acrylic roofing to keep the patio bright while cutting glare. The open gable end, framed with the bespoke aluminium pattern, has become a small landmark on this corner in St Heliers.',
    ],
    stats: {
      width: '6.0 m',
      depth: '3.0 m',
      height: '2.7 m',
      area: '18.0 m²',
    },
    tags: ['Residential', 'Gable', 'Opal acrylic', 'Aluminium'],
    sections: [],
    related: ['dairy-flat-estate', 'warkworth-outdoor-room', 'waiheke-coastal-louvre'],
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
    blurb: 'Gable extension following the house roofline in aluminium and acrylic to keep the outdoor room bright and sheltered.',
    description: [
      'The clients wanted to extend their existing roofline to capture more usable outdoor space. We followed the house form out with aluminium framing and acrylic roofing so the new structure reads as part of the original home.',
      'The acrylic roof allows maximum light into the space, and by infilling the gable end we created shelter from wind and rain while still keeping the area open to the garden.',
    ],
    stats: {
      width: '8.6 m',
      depth: '3.3 m',
      height: '3.0 m',
      area: '28.4 m²',
    },
    tags: ['Residential', 'Gable'],
    sections: [],
    related: ['warkworth-outdoor-room', 'st-heliers-townhouse', 'waiheke-coastal-louvre'],
  },
];

const projectOrder: string[] = [
  'warkworth-outdoor-room',    // Warkworth Outdoor Room
  'devonport-gable-lightwell', // Lilliput Mini Golf
  'velskov-forest',            // Velskov Forest
  'tindalls-bay-pavilion',     // Tindalls Bay - Patio & Carport
  'goodhome-commercial-terrace', // The Good Home Takanini
  'dairy-flat-estate',         // Dairy Flat Estate
  'waitakere-ranges-lanai',    // Murawai Courtyard
  'st-heliers-townhouse',      // St Heliers Townhouse
  'kiwi-rail-platform',        // KiwiRail Head Office
  'waiheke-coastal-louvre',    // Waiheke Holiday Home
  'atelier-shu-cafe',          // Atelier Shu Cafe
];

export const projects: Project[] = [...baseProjects].sort((a, b) => {
  const ia = projectOrder.indexOf(a.slug);
  const ib = projectOrder.indexOf(b.slug);
  const aPos = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
  const bPos = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
  return aPos - bPos;
});

export const getProjectBySlug = (slug: string) => projects.find(project => project.slug === slug) || null;
