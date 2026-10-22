import type { Project } from '../../data/projects';

export type ProjectEditorialStory = {
  briefTitle: string;
  brief?: string;
  omitArea?: boolean;
  decisions: { title: string; image: string; caption: string; text: string }[];
  detailSummary: string;
  guide: { href: string; label: string };
};

/** Published project facts and photographs, edited for each project's actual scope. */
export function getProjectEditorialStory(project: Pick<Project, 'slug'>): ProjectEditorialStory | null {
  if (project.slug === 'dairy-flat-estate') return {
    briefTitle: 'Follow the house. Open to the garden.',
    decisions: [
      {
        title: 'The garden stays part of the room.',
        image: '/images/project-dairy-flat-03.jpg',
        caption: 'Looking out from beneath the gable',
        text: 'An infilled gable end covers one edge, while the garden side remains open. The roof extends the outdoor living area without closing off its connection to the garden.',
      },
      {
        title: 'Daylight was part of the brief.',
        image: '/images/project-dairy-flat-02.jpg',
        caption: 'Acrylic roofing beside the existing house',
        text: 'Aluminium framing follows the existing roof geometry. Acrylic roofing was selected in response to the daylight brief, continuing the house form over the outdoor space.',
      },
    ],
    detailSummary: 'Aluminium framing and acrylic roofing, following the existing house roofline.',
    guide: { href: '/acrylic-roof-pergolas-auckland', label: 'Explore acrylic roof pergolas' },
  };
  if (project.slug === 'st-heliers-townhouse') return {
    briefTitle: 'A roofline made for this home.',
    decisions: [
      {
        title: 'A gable with its own identity.',
        image: '/images/project-st-heliers-01.jpg',
        caption: 'The custom aluminium pattern at the open gable end',
        text: 'The street-facing gable end has a bespoke aluminium framing pattern. Opal acrylic roofing was chosen against the brief for daylight and glare, with the gable shape extending the existing roofline.',
      },
    ],
    detailSummary: 'An aluminium gable with opal acrylic roofing and a custom open end-frame pattern.',
    guide: { href: '/gable-pergolas-auckland', label: 'Explore gable pergolas' },
  };
  if (project.slug === 'milford-garden-retreat') return {
    briefTitle: 'A place to gather. A place to unwind.',
    decisions: [
      {
        title: 'Two spaces, connected by timber.',
        image: '/images/project-milford-garden-retreat-02-dining-patio.jpg',
        caption: 'The covered dining patio looks towards the spa garden',
        text: 'A patio beside the house serves outdoor dining, while a separate freestanding pergola covers the spa and sauna area. Cedar battens connect the two. The wider, onsen-inspired landscape is by Design with Rudi Landscapes, in collaboration with GGL Landscaping & Gardening.',
      },
      {
        title: 'Privacy without a solid ceiling.',
        image: '/images/project-milford-garden-retreat-05-privacy-screens.jpg',
        caption: 'Vertical timber screens continue the pattern around the spa',
        text: 'The homeowners wanted privacy and shade while keeping daylight in the adjoining rooms. After reviewing samples, they chose opal acrylic above open Western Red Cedar battens. Timber screens carry the same lines down into the garden.',
      },
    ],
    detailSummary: 'Two satin-black aluminium pergolas, with opal acrylic roofing above Western Red Cedar battens.',
    guide: { href: '/outdoor-rooms-auckland', label: 'Explore outdoor rooms' },
  };
  if (project.slug === 'mt-maunganui-box') return {
    briefTitle: 'Cover the deck. Keep the outlook.',
    decisions: [
      {
        title: 'An edge that follows the house.',
        image: '/images/project-mt-maunganui-03.jpg',
        caption: 'The covered first-floor deck and its glass balustrade',
        text: 'The dark box perimeter follows the cladding and joinery of the home. Above the deck, opal acrylic roofing falls at five degrees to a hip junction at the outer end, following the deck geometry while keeping the outlook through the glass balustrade.',
      },
    ],
    detailSummary: 'A powder-coated aluminium box perimeter with 6 mm opal acrylic roofing and a hipped outer end.',
    guide: { href: '/custom-pergolas-auckland', label: 'Explore custom pergola design' },
  };
  if (project.slug === 'riverhead-gable-pavilion') return {
    briefTitle: 'A covered lounge beside the pool.',
    decisions: [
      {
        title: 'Timber and light overhead.',
        image: '/images/project-riverhead-gable-03.webp',
        caption: 'Timber sarking, recessed downlights and warm LED edges',
        text: 'Timber sarking gives the gable a finished ceiling, with skillion insulation above. Recessed downlights and warm LED lighting along the edges are integrated into the roof rather than added as separate fixtures.',
      },
      {
        title: 'Open towards the garden.',
        image: '/images/project-riverhead-gable-02.jpg',
        caption: 'The pavilion connects the pool deck with the surrounding garden',
        text: 'The gable brings height and symmetry to the seating area. Aluminium and steel framing carries the roof, with open gable ends and sides keeping the pool and landscape in view.',
      },
    ],
    detailSummary: 'A black aluminium and steel gable pavilion with timber sarking, insulation and integrated lighting.',
    guide: { href: '/gable-pergolas-auckland', label: 'Explore gable pergolas' },
  };
  if (project.slug === 'waiheke-holiday-home') return {
    briefTitle: 'An extension of the living space.',
    decisions: [{
      title: 'A straight line outside. A fall within.',
      image: '/images/project-waiheke-01.jpg',
      caption: 'The box perimeter meets the existing house',
      text: 'Pitched and box-perimeter options were considered against the facade. The taller perimeter beam was chosen to align with the house geometry, concealing the four-degree roof fall and gutters behind a straight outer edge. Screens were coordinated with the covered deck.',
    }],
    detailSummary: 'A box-perimeter cover over the existing deck, with concealed roof fall and gutters.',
    guide: { href: '/custom-pergolas-auckland', label: 'Explore custom pergola design' },
  };
  if (project.slug === 'tindalls-bay-pavilion') return {
    briefTitle: 'One home. Several kinds of cover.',
    decisions: [
      {
        title: 'Work with every turn of the house.',
        image: '/images/project-tindalls-bay-02.jpg',
        caption: 'The patio and carport follow different parts of the house',
        text: 'The patio and carport were designed together around the existing levels, entry and rooflines. Insulated panels with timber sarking cover the dining area, while opal acrylic above timber battens responds to the daylight brief around the front door and circulation zones.',
      },
      {
        title: 'Keep the coastal outlook.',
        image: '/images/project-tindalls-bay.jpg',
        caption: 'Open timber battens and the outlook from the patio',
        text: 'Another part of the roof uses light grey acrylic. Mesh blinds were added along the side identified for wind and privacy, leaving the covered living area open towards the view beyond.',
      },
    ],
    detailSummary: 'Insulated and acrylic roof zones, timber sarking and battens, with mesh blinds along one side.',
    guide: { href: '/pergolas-with-blinds', label: 'Explore pergolas with blinds' },
  };
  if (project.slug === 'muriwai-courtyard') return {
    briefTitle: 'A new roof for a familiar courtyard.',
    decisions: [{
      title: 'Keep the layout. Reconsider the frame.',
      image: '/images/project-waitakere-ranges-01.jpg',
      caption: 'The contemporary frame beside the Tuscan-style home',
      text: 'The replacement retains the established eight-by-five-metre footprint, with a recorded height of three metres. An opal acrylic hip roof falls at five degrees, bringing a contemporary frame into the existing courtyard without changing its layout.',
    }],
    detailSummary: 'An opal acrylic hip roof over the retained courtyard footprint.',
    guide: { href: '/custom-pergolas-auckland', label: 'Explore custom pergola design' },
  };
  if (project.slug === 'ardmore-box-carport') return {
    briefTitle: 'Room for the driveway to work.',
    decisions: [
      {
        title: 'A gable inside a box perimeter.',
        image: '/images/project-ardmore-carport-02.jpg',
        caption: 'The internal gable beneath the black perimeter fascia',
        text: 'The black fascia gives the carport a straight outer line. Inside it, the red steel frame and gable geometry leave an open space for vehicle access beside the home.',
      },
      {
        title: 'Steel, aluminium and acrylic.',
        image: '/images/project-ardmore-carport-03.jpg',
        caption: 'Acrylic roofing over aluminium rafters and red steel framing',
        text: 'Steel PFC beams work with aluminium rafters beneath six-millimetre acrylic roofing. The main roof falls at five degrees, with the gable resolving the roof geometry inside the frame. Integrated LED lighting completes the carport.',
      },
    ],
    detailSummary: 'A box-perimeter carport with steel PFC beams, aluminium rafters, acrylic roofing and integrated lighting.',
    guide: { href: '/custom-pergolas-auckland', label: 'Explore custom pergola design' },
  };
  if (project.slug === 'atelier-shu-cafe') return {
    briefTitle: 'More cafe space. The same identity.',
    decisions: [
      {
        title: 'Carry the frontage into the canopy.',
        image: '/images/project-atelier-shu-05.jpg',
        caption: 'The exposed gable frame above the cafe seating',
        text: 'An all-aluminium frame follows the established frontage and colours. Dark-tint acrylic covers the outdoor seating, with the thirty-degree gable continuing the architectural character of the cafe.',
      },
      {
        title: 'Blinds within the frame.',
        image: '/images/project-atelier-shu-06.jpg',
        caption: 'The deployed blind sits beneath the gable roof',
        text: 'Integrated blinds sit within the frame along the seating edge. The roof, posts and blinds were brought together as one addition to the existing specialty dessert cafe.',
      },
    ],
    detailSummary: 'An all-aluminium gable with dark-tint acrylic roofing and integrated blinds.',
    guide: { href: '/commercial-pergolas-auckland', label: 'Explore commercial pergolas' },
  };
  if (project.slug === 'goodhome-commercial-terrace') return {
    briefTitle: 'Take the restaurant into the courtyard.',
    decisions: [
      {
        title: 'Follow the existing gables.',
        image: '/images/project-goodhome-05.jpg',
        caption: 'The twin gables extend the villa-style frontage',
        text: 'The new roof matches the existing twenty-five-degree pitch. Two gable zones carry the established roofline over the courtyard, keeping the facade and its new covered area reading together.',
      },
      {
        title: 'Make the covered space part of the venue.',
        image: '/images/project-goodhome-04.jpg',
        caption: 'The acrylic roof and lighting above the hospitality courtyard',
        text: 'Steel and aluminium framing carries the acrylic roofing. Lighting and screens are integrated into the completed courtyard, with clear blinds around its outside edge.',
      },
    ],
    detailSummary: 'Two acrylic gables on steel and aluminium framing, with lighting and screens.',
    guide: { href: '/commercial-pergolas-auckland', label: 'Explore commercial pergolas' },
  };
  if (project.slug === 'lilliput-mini-golf') return {
    briefTitle: 'Cover the gathering spaces. Keep the course open.',
    decisions: [
      {
        title: 'Fit the wider renovation.',
        image: '/images/project-tamaki-dr-04.jpg',
        caption: 'The pitched canopy beside the clubhouse and outdoor seating',
        text: 'Sanctuary worked alongside the client\'s architect and engineer, refining the frame around existing foundations, services and the renovation budget. Steel and aluminium framing in Dulux Slate Blue Matt gives the acrylic roof a simple pitched form.',
      },
      {
        title: 'Coordinate the structure with the venue.',
        image: '/images/project-tamaki-dr-03.jpg',
        caption: 'The completed covered seating area looking towards the course',
        text: 'Our role on this project was supplying and installing the structure to the architect and engineer\'s drawings. Installation was sequenced around venue operations and the other trades completing cladding, lighting and course upgrades.',
      },
    ],
    detailSummary: 'A consultant-led project, with Sanctuary supplying and installing the steel, aluminium and acrylic pergola structure.',
    guide: { href: '/commercial-pergolas-auckland', label: 'Explore commercial pergolas' },
  };
  if (project.slug === 'velskov-forest') return {
    briefTitle: 'A working space beneath the trees.',
    brief: 'Our brief here was to create a simple, robust structure that could sit quietly in the middle of the native forest, covering a space for farm activity while keeping the focus on the surrounding ecosystem.',
    decisions: [
      {
        title: 'A low roof beneath a high canopy.',
        image: '/images/project-velskov-02.jpg',
        caption: 'The shallow pitched roof in its forest setting',
        text: 'The seven-by-six-metre pergola has a shallow seven-degree pitched roof and a recorded height of three and a half metres. The brief called for a generous covered space that kept a low profile beneath the surrounding trees.',
      },
      {
        title: 'The forest remains the setting.',
        image: '/images/project-velskov-03.jpg',
        caption: 'Looking through the shelter into the native bush',
        text: 'Velskov is a ten-acre natural forest farm focused on regenerative food growing, agroforestry and ecosystem restoration. The shelter supports activity within that setting, with the surrounding bush visible through the frame.',
      },
    ],
    detailSummary: 'A freestanding pitched shelter for activity within the native forest farm.',
    guide: { href: '/pitched-pergolas-auckland', label: 'Explore pitched pergolas' },
  };
  if (project.slug === 'kiwi-rail-platform') return {
    briefTitle: 'Connect the everyday routes.',
    // Published area conflicts with the recorded dimensions; do not invent a replacement.
    omitArea: true,
    decisions: [
      {
        title: 'Follow the workplace route.',
        image: '/images/project-kiwi-rail-01.jpg',
        caption: 'The canopy follows the path between the workplace buildings',
        text: 'JCY Architects approached Sanctuary to bring their canopy design to life. Aluminium framing and acrylic roofing cover the connection between key circulation routes around the head office.',
      },
      {
        title: 'Lighting within the structure.',
        image: '/images/project-kiwi-rail-02.jpg',
        caption: 'Integrated strip lighting along the canopy at twilight',
        text: 'Strip lighting is incorporated along the long canopy. The shallow pitched roof and repeated frame carry the covered route alongside the building.',
      },
    ],
    detailSummary: 'An architect-led workplace canopy with aluminium framing, acrylic roofing and integrated strip lighting.',
    guide: { href: '/commercial-pergolas-auckland', label: 'Explore commercial pergolas' },
  };
  return null;
}
