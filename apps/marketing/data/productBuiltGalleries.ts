import type { ProductMedia } from './products';

// Lower product galleries complement the three opening photographs. Project
// classifications and bespoke qualifications follow the existing projects owner;
// the unlocated residential references retain literal, non-location captions.
export const productBuiltGalleries: Record<'pitched' | 'gable' | 'box-perimeter', ProductMedia[]> = {
  pitched: [
    { src: '/images/product-pitched-06.jpg', alt: 'White pitched acrylic roof viewed from underneath above outdoor seating and a fireplace', caption: 'Acrylic roof from underneath', detail: 'Built reference · White framing and a full acrylic roof', objectPosition: '50% 30%' },
    { src: '/images/simple-pergolas/pitched-08.webp', alt: 'White pitched acrylic pergola over a timber deck and outdoor table', caption: 'Shelter over a timber deck', detail: 'Built reference · Acrylic roofing beside the home', objectPosition: '50% 35%' },
    { src: '/images/simple-pergolas/pitched-10.webp', alt: 'White pitched pergola beside a home seen from the deck steps', caption: 'A white frame beside the house', detail: 'Built reference · House-attached acrylic roof', objectPosition: '50% 40%' },
    { src: '/images/simple-pergolas/pitched-11.webp', alt: 'White acrylic pergola covering a narrow deck along a timber-clad home', caption: 'A narrow covered deck', detail: 'Built reference · The roof and house connection', objectPosition: '50% 30%' },
    { src: '/images/project-tamaki-dr-02.jpg', alt: 'Pitched acrylic roof above outdoor seating at Lilliput Mini Golf', caption: 'Acrylic over outdoor seating', detail: 'Lilliput Mini Golf · Commercial project reference', objectPosition: '50% 35%' },
    { src: '/images/project-velskov-02.jpg', alt: 'Dark freestanding pitched pergola surrounded by trees at Velskov', caption: 'A freestanding forest setting', detail: 'Velskov · Bespoke project reference', objectPosition: '50% 48%' },
    { src: '/images/project-tindalls-bay-03.jpg', alt: 'Mixed solid and acrylic pitched roof zones over the Tindalls Bay patio', caption: 'Solid and acrylic roof zones', detail: 'Tindalls Bay · Bespoke mixed-roof project', objectPosition: '50% 35%' },
    { src: '/images/project-kiwi-rail-03.jpg', alt: 'Tall pitched canopy and steel supports at a rail facility', caption: 'A taller commercial canopy', detail: 'KiwiRail · Bespoke steel canopy reference', objectPosition: '50% 40%' },
  ],
  gable: [
    { src: '/images/project-atelier-shu-02.jpg', alt: 'Clear acrylic gable roof over café seating at Atelier Shu', caption: 'A clear gable over café seating', detail: 'Atelier Shu · Bespoke café project', objectPosition: '50% 40%' },
    { src: '/images/project-dairy-flat-01.jpg', alt: 'Dark acrylic gable pergola beside a pool at Dairy Flat', caption: 'A gable beside the pool', detail: 'Dairy Flat · Roof form responding to the house', objectPosition: '50% 40%' },
    { src: '/images/project-goodhome-05.jpg', alt: 'White gable framing over The Good Home courtyard', caption: 'A white frame over a courtyard', detail: 'The Good Home · Commercial terrace reference', objectPosition: '50% 40%' },
    { src: '/images/project-warkworth-outdoor-room-01.jpg', alt: 'Exterior of the enclosed gable outdoor room at Warkworth', caption: 'An enclosed outdoor room', detail: 'Warkworth · Bespoke outdoor-room project', objectPosition: '50% 45%' },
    { src: '/images/project-st-heliers-02.jpg', alt: 'Opal acrylic gable roof viewed from underneath at St Heliers', caption: 'An opal roof from underneath', detail: 'St Heliers · Bespoke gable-end design', objectPosition: '50% 30%' },
    { src: '/images/project-riverhead-gable-05.jpg', alt: 'Timber-lined gable roof and supports at the Riverhead pavilion', caption: 'Timber lining and open edges', detail: 'Riverhead · Insulated roof with timber lining', objectPosition: '50% 35%' },
    { src: '/images/project-atelier-shu-05.jpg', alt: 'Acrylic panels and rafters meeting at the Atelier Shu gable ridge', caption: 'Acrylic panels at the ridge', detail: 'Atelier Shu · Roof construction detail', objectPosition: '50% 35%' },
    { src: '/images/project-dairy-flat-02.jpg', alt: 'Acrylic gable framing beside brickwork at Dairy Flat', caption: 'Roof framing beside brickwork', detail: 'Dairy Flat · Ridge and house relationship', objectPosition: '50% 30%' },
  ],
  'box-perimeter': [
    { src: '/images/project-waiheke-04.jpg', alt: 'View beneath the acrylic roof within the Waiheke box-perimeter frame', caption: 'Acrylic within the perimeter frame', detail: 'Waiheke · Roof underside and house relationship', objectPosition: '50% 35%' },
    { src: '/images/project-waiheke-02.jpg', alt: 'Waiheke box-perimeter pergola over outdoor dining furniture', caption: 'A covered outdoor dining area', detail: 'Waiheke · The frame in its wider setting', objectPosition: '50% 45%' },
    { src: '/images/project-waiheke-03.jpg', alt: 'Acrylic roofing and perimeter-beam junction at Waiheke', caption: 'The roof and perimeter junction', detail: 'Waiheke · Frame and roof detail', objectPosition: '50% 35%' },
    { src: '/images/project-mt-maunganui-01.jpg', alt: 'Box-perimeter pergola along the elevated Mt Maunganui balcony', caption: 'A box frame along the balcony', detail: 'Mt Maunganui · Elevated deck and house context', objectPosition: '50% 40%' },
    { src: '/images/project-mt-maunganui-02.jpg', alt: 'Front view of the opal roof and end junction at Mt Maunganui', caption: 'Front view of the balcony roof', detail: 'Mt Maunganui · Opal roof with a hip-style end junction', objectPosition: '50% 30%' },
    { src: '/images/project-ardmore-carport-02.jpg', alt: 'View beneath the internal gable in the bespoke Ardmore steel carport', caption: 'Inside a bespoke steel carport', detail: 'Ardmore · Box perimeter with an internal gable', objectPosition: '50% 35%' },
    { src: '/images/project-ardmore-carport-03.jpg', alt: 'Red steel framing and roof junction in the Ardmore carport', caption: 'Steel framing at the roof junction', detail: 'Ardmore · Bespoke steel carport with an internal gable', objectPosition: '50% 35%' },
    { src: '/images/project-ardmore-carport-04.jpg', alt: 'View from above of the acrylic internal gable in the Ardmore box-perimeter carport', caption: 'The internal gable from above', detail: 'Ardmore · Bespoke steel carport reference', objectPosition: '50% 45%' },
  ],
};
