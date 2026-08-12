import { WARKWORTH_EXTERIOR_OBJECT_POSITION } from '../lib/projectImageFraming';

type ProductCategorySlug = 'pergolas' | 'screens-walls' | 'lighting-heating';
type ProductVariant = 'pergola-form' | 'integrated-option';
type ProductSlug =
  | 'pitched'
  | 'gable'
  | 'hip'
  | 'box-perimeter'
  | 'slat-screens'
  | 'acrylic-infill-panels'
  | 'drop-down-blinds'
  | 'downlights'
  | 'led-strip-lighting'
  | 'patio-heaters';

type ProductMedia = {
  src: string;
  alt: string;
  caption: string;
  detail?: string;
  objectPosition?: string;
};

type ProductTechnicalDetails = {
  overview: string;
  atAGlance: string[];
  howItWorks?: string;
  whyItsGood?: string[] | string;
  structureMaterials?: string[];
  options?: string[];
  performance?: string[];
  recommendedFor?: string[];
  notIdealFor?: string[];
  install?: string[];
  maintenance?: string[];
  upgradePath?: string[];
  bestPairedWith?: string[];
  indicativePerformance?: string[];
  faqs?: Array<{ q: string; a: string }>;
};

const productDetails: Record<ProductSlug, ProductTechnicalDetails> = {
  'led-strip-lighting': {
    overview:
      'LED strip lighting creates a soft perimeter glow that defines your outdoor room after dark. Tape recesses into slim channels or hides behind pelmets so the diodes are not in view, leaving a continuous wash of light.',
    atAGlance: [
      'Soft, uniform perimeter glow',
      'Channels with diffusers to hide diodes',
      '24V drivers mounted in protected spots',
      'Dimmable warm/neutral white options',
      'Output, power and operating life confirmed for the selected tape and driver',
    ],
    howItWorks:
      '24V LED tape runs from weather‑protected drivers with smooth dimming. Diffusers even out output and wiring conceals within the frame. Colour temperature can be warm for ambience or neutral for task edges.',
    whyItsGood: [
      'Dimming and zoning can be selected around the lighting plan',
      'Avoids tabletop glare and harsh spots',
      'Defines edges for safe steps and circulation',
      'Layers beautifully with downlights',
    ],
    structureMaterials: [
      'Aluminium channels with diffusers; hidden pelmet options',
      '24V LED tape with exterior‑rated wiring',
      'Remote drivers mounted in protected locations',
    ],
    options: [
      'Warm or neutral white',
      'Corner, perimeter or step‑edge placement',
      'Single or multi‑zone dimming; smart control ready',
    ],
    performance: [
      'Soft, even glow without diode spotting',
      'Ambient output depends on the selected tape, diffuser, spacing and controls',
    ],
    recommendedFor: [
      'Evening entertaining and safe circulation',
      'Pairing with downlights to layer light',
    ],
    notIdealFor: ['Task lighting on its own; combine with downlights'],
    upgradePath: ['Add scenes and sensors; expand to steps and paths'],
    bestPairedWith: ['A few downlights for tasks', 'Dimmers/scenes to set mood'],
    indicativePerformance: [
      'Output, power draw and operating-life data confirmed from the selected tape and driver documents',
      'IP rating and channel type matched to exposure',
    ],
    faqs: [
      {
        q: 'Is strip lighting enough on its own?',
        a: 'It can define edges and provide an ambient layer, but dining, preparation areas or steps may also need focused light. Confirm the lighting plan against the way the room will be used.',
      },
      {
        q: 'Where do the drivers go?',
        a: 'Drivers need a protected, serviceable location with suitable cable paths. Their position, rating and access are confirmed for the selected tape and completed structure.',
      },
    ],
  },
  downlights: {
    overview:
      'Recessed outdoor downlights provide even, glare‑controlled illumination under your pergola. Low‑profile LED fittings sit flush with the frame so the ceiling reads clean; the beam is shaped to light tables and walkways without hot spots.',
    atAGlance: [
      'Even, low‑glare illumination for dining and tasks',
      'Low‑profile, IP‑rated LED fittings',
      'Dimmable circuits with warm/neutral options',
      'Good coverage for tables, prep areas and paths',
    ],
    howItWorks:
      '24V or mains drivers mount in protected cavities; sealed luminaires and cabling are rated for exterior use. Circuits can be dimmed independently and colour temperature tuned warm for relaxed dining or neutral for tasks.',
    whyItsGood: [
      'Output, beam, power and operating-life data can be checked for the selected fitting',
      'Keeps ceilings clean with recessed trims',
      'Lights surfaces without harsh hot spots or glare',
      'Pairs well with strip lighting for layered scenes',
    ],
    structureMaterials: [
      'Low‑profile IP‑rated LED downlights',
      '24V or mains drivers in protected locations',
      'Exterior‑rated cabling and junctions',
    ],
    options: [
      'Warm or neutral colour temperatures; high CRI where needed',
      'Separate dimmable circuits for lighting zones',
      'Trim styles to match pergola frame finishes',
    ],
    performance: [
      'Even, low‑glare illumination for tasks and dining',
      'Power draw and operating life follow the selected fitting documentation',
      'Complements strip lighting for layered scenes',
    ],
    recommendedFor: [
      'Pergolas used nightly and for dining',
      'Paths and steps needing safe, even light',
    ],
    notIdealFor: [
      'Broad ambient wash on its own; pair with strip for ambience',
    ],
    install: [
      'Supplier availability, installation sequence and responsibilities confirmed for the selected fittings and electrical scope',
    ],
    maintenance: [
      'Operating life, cleaning and replacement guidance follow the selected lighting product documentation',
    ],
    upgradePath: [
      'Add smart dimmers or scenes; pair with strip lighting for accents',
    ],
    bestPairedWith: [
      'LED strip for ambient layers',
      'Sensors or scenes for convenience',
    ],
    indicativePerformance: [
      'Per-fitting output, power and beam data confirmed from the selected product documentation',
      'Spacing, beam angle and dimming confirmed from the lighting plan and selected fittings',
    ],
    faqs: [
      {
        q: 'Will they attract bugs?',
        a: 'Insect activity depends on the site, season and selected light source. Choose colour temperature, output and placement as part of the lighting plan rather than relying on a universal result.',
      },
      {
        q: 'Can I add later?',
        a: 'Later additions may be possible where suitable cable paths, cavities and electrical capacity have been planned. A licensed electrician should confirm the retrofit scope.',
      },
    ],
  },
  'patio-heaters': {
    overview:
      'Electric patio heaters can add targeted radiant warmth to selected seating zones. The heater type, output, position, controls and mounting clearances need to be confirmed for the outdoor area and exact product.',
    atAGlance: [
      'Targeted radiant warmth for selected seating zones',
      'Electric units without on-site gas-bottle storage',
      'Output and coverage checked against current manufacturer data',
      'Blind, screen and heater clearances coordinated where combined',
    ],
    howItWorks:
      'The selected emitter and reflector direct radiant heat toward a planned seating zone. Mounting, aiming, switching and clearances follow the current instructions for the exact heater.',
    whyItsGood: [
      'Targeted radiant output directed toward the planned seating zone',
      'No LPG storage, fumes or open flames to manage',
      'Housing finish and visual integration checked against the frame',
      'Switch, dimmer or remote options confirmed for the selected heater',
    ],
    structureMaterials: [
      'Electric infrared heaters with adjustable brackets',
      'Housing and finish options documented for the selected heater',
      'Dedicated circuits and compliant exterior wiring',
    ],
    options: [
      'Output selected against the seating layout, exposure and manufacturer coverage data',
      'Wall switch, dimmer or remote controls where supported by the selected unit',
      'Zoned layouts so you heat only the areas in use',
    ],
    performance: [
      'Radiant output directed toward the planned seating zone',
      'Coverage and comfort depend on output, placement, exposure and surrounding edges',
      'No open flame or LPG storage requirements',
    ],
    recommendedFor: [
      'Evening dining and lounge settings',
      'Shoulder‑season use under pergolas and covered decks',
    ],
    notIdealFor: [
      'Fully open, windy sites without any wind management',
    ],
    install: [
      'Supplier availability, installation sequence and responsibilities confirmed for the selected heaters and electrical scope',
    ],
    maintenance: [
      'Cleaning, inspection and service follow the current instructions for the selected heater',
      'Electrical checks are completed by an appropriately licensed person where required',
    ],
    upgradePath: [
      'Add sensors or timers and integrate with lighting scenes',
    ],
    bestPairedWith: [
      'Drop‑down blinds to help hold warmth',
      'Compatible controls documented for the selected heater',
    ],
    indicativePerformance: [
      'Output, coverage, clearances and controls confirmed from current manufacturer data for the selected unit',
      'Mounting height and angle tuned to seating layout',
    ],
    faqs: [
      {
        q: 'Will they scorch surfaces?',
        a: 'Clearances and aiming follow manufacturer guidelines so nearby surfaces stay within safe temperatures.',
      },
      {
        q: 'Do they run on standard power?',
        a: 'Some models need dedicated circuits; confirm requirements during design so cabling and switching are planned in.',
      },
    ],
  },
  pitched: {
    overview:
      'A pitched pergola extends the roofline with a clean single‑slope canopy and a deliberate drainage direction. It can fall away from the house or, where the existing structure and gutter capacity allow, pitch toward the house on project-specific brackets. The frame, connections and finish are resolved for the measured site rather than selected from a standard span or exposure claim.',
    atAGlance: [
      'Houseward or outward fall assessed against the measured connection',
      'High and low edges coordinated with doors, windows and eaves',
      'Roofing options selected around daylight, glare and shade priorities',
      'Insulated panels with timber sarking available',
      'Acrylic roof zones can be considered within a combination roof',
    ],
    whyItsGood: [
      'Roof-fall direction follows the connection, clearances and drainage context',
      'High and low edges are set from measured site conditions',
      'The exact acrylic product and tint determine published UV and solar-control performance',
      'Insulated panels with timber sarking create a more enclosed ceiling character',
      'Acrylic and solid roof zones can be combined where the brief calls for different overhead conditions',
    ],
    structureMaterials: [
      'Powder‑coated aluminium beams, rafters and posts',
      'Roof joiners, supports and isolation details selected for the specified roof product',
      'Brackets and fixings resolved for the completed design and site conditions',
      'Integrated head/house flashing with movement allowance',
    ],
    options: [
      'Acrylic: clear, light grey, dark grey or opal roofing, subject to the current product range and manufacturer data for the selected sheet',
      'Solid: insulated panels with timber sarking for a more enclosed ceiling and opaque shade condition',
      'Combination: solid roof areas with acrylic skylight strips to balance daylight and shade across different zones',
    ],
    performance: [
      'Roof fall, gutters, outlets and discharge path documented for the completed design',
      'Daylight, glare and shade response depend on the selected roof product and tint',
      'Published UV and solar-control performance is confirmed from current manufacturer data',
      'Solid roof panels create a different shade, ceiling and rain-noise character from acrylic zones',
      'Member sizes, spans, joiners and fixings are resolved for the measured site',
    ],
    install: ['The project programme and on-site sequence are confirmed in the proposal after site and supplier checks'],
    maintenance: ['Cleaning and inspection follow the current written guidance for the selected roof, frame, gutters and flashings'],
    upgradePath: [],
    bestPairedWith: [],
    faqs: [
      {
        q: 'Can we pitch the roof toward the house and use the existing gutter?',
        a: 'A houseward fall can be considered where the measured support, soffit, flashing and existing gutter capacity allow it. The connection and discharge path need to be resolved for the completed design.',
      },
      {
        q: 'How much heat is reduced with acrylic roofing?',
        a: 'Solar-control and UV performance vary by the exact sheet, tint and assembly. Ask for the current manufacturer data for the roof product named in the proposal rather than relying on a category-wide percentage.',
      },
      {
        q: 'Can I combine insulated panels and skylights?',
        a: 'Acrylic and solid roof zones can be considered together where different parts of the area need different daylight and shade conditions. The exact products, transitions, support and drainage need to be resolved as one roof.',
      },
      {
        q: 'Can posts move off corners?',
        a: 'Offset post positions can be investigated where doors, paths or furniture make a corner position unsuitable. Feasibility depends on the completed structure, loads, supports and any required engineering.',
      },
    ],
  },
  gable: {
    overview:
      'A gable pergola uses two roof planes meeting at a central ridge. Ridge height, eaves, end conditions, structure and roofing are proportioned around the measured house and outdoor area.',
    atAGlance: [
      'Central ridge creates a defined roof volume',
      'Ridge, eaves and gable ends resolved together',
      'Aluminium structure specified for the completed design',
      'Openings and support positions checked against the site',
      'Lighting, blinds and gable infills can be considered',
    ],
    howItWorks:
      'Two roof planes meet at a central ridge and fall toward their eaves. Beams, posts, roof supports, flashings, gutters and gable-end details are selected for the completed geometry and specified roof products.',
    whyItsGood: [
      'Creates a central volume with a clearly expressed ridge and end condition',
      'Structural depth and connections are designed for the measured site and exposure',
      'Daylight and glare depend on the selected roofing, roof depth, orientation and any edge treatments',
      'Finish and care requirements follow the selected coating and site exposure',
    ],
    structureMaterials: [
      'Powder‑coated aluminium beams, rafters and posts',
      'Ridge components resolved for the completed roof geometry',
      'Roof joiners, supports and isolation details selected for the specified roof product',
      'Brackets and fixings resolved for the completed design and site conditions',
    ],
    options: [
      'Acrylic: clear, light grey, dark grey or opal roofing across both roof planes, subject to the current product range and manufacturer data.',
      'Solid: insulated panels with timber sarking for a more enclosed ceiling and opaque shade condition.',
      'Combination: Solid and acrylic roof zones can be arranged around different daylight, shade and ceiling priorities.',
      'Gable infill: Open, slatted or acrylic end treatments can be considered around outlook, openness and exposure.',
    ],
    performance: [
      'Headroom and perceived volume follow the final ridge and eave heights',
      'Air movement depends on the gable-end treatment, open edges and wider site conditions',
      'Member sizes and connections respond to the project-specific exposure',
      'Aluminium joiners and isolation details are coordinated for the selected roof sheet',
    ],
    recommendedFor: [],
    notIdealFor: [],
    install: ['The project programme and on-site sequence are confirmed in the proposal after site and supplier checks'],
    maintenance: ['Cleaning and inspection follow the current written guidance for the selected frame finish, roof products and drainage'],
    upgradePath: [],
    bestPairedWith: [],
    indicativePerformance: [],
    faqs: [
      {
        q: 'Is a gable too bright?',
        a: 'Brightness depends on orientation, roof depth, the selected roof sheets and the rooms beside the pergola. Compare exact product data and test clear, opal, tinted or solid zones against the actual site.',
      },
      {
        q: 'Can I keep views through the gable?',
        a: 'Open or clear acrylic infills can maintain outlook while moderating exposure at the gable end. The panel layout and remaining openings determine the result.',
      },
    ],
  },
  hip: {
    overview:
      'A hip pergola pitches down on all sides, wrapping the space with a composed roof edge and multiple drainage directions. It can integrate with complex rooflines when the hips, junctions, outlets and post positions are coordinated as one project-specific structure.',
    atAGlance: [
      'Multiple roof falls direct water toward more than one edge',
      'Corner geometry resolved for the site exposure',
      'Powder‑coated aluminium frame with clean soffit',
      'Integrates well with complex façades',
      'Lighting and blind integration can be considered for the selected systems',
    ],
    howItWorks:
      'A central ridge and diagonal hips transfer loads to perimeter beams and posts. Custom flashings step roof sheets around hips while maintaining drainage. Posts can offset to suit doors and paths.',
    whyItsGood: [
      'Multiple roof planes can distribute drainage around the perimeter where the site supports it',
      'Hips and corner connections are resolved as part of the complete structure',
      'A composed roof silhouette with a clearly defined soffit edge',
      'Material and finish selections can respond to coastal maintenance requirements',
    ],
    structureMaterials: [
      'Four‑sided roof with ridge and hip beams',
      'Powder‑coated aluminium frame and posts',
      'Bracket and fixing details resolved for the completed structure',
      'Custom flashings around hips to manage water',
    ],
    options: [
      'Clear, opal, tinted or solid roof zones considered around daylight and shade',
      'Post locations to open pathways and doors',
      'Integrated downlights and perimeter strip lighting',
      'Drop‑down blinds at prevailing wind faces',
    ],
    performance: [
      'Roof falls, gutters, outlets and discharge paths are documented for the completed geometry',
      'Project-specific engineering for hips, corners and connections',
      'Soffit and fixing appearance follow the completed structure and selected details',
      'Finish and maintenance requirements confirmed for the site environment',
    ],
    recommendedFor: [
      'Complex façades and corner decks',
      'Sites exposed to changeable wind directions',
    ],
    notIdealFor: ['Narrow spaces where a single pitch saves height'],
    install: ['The project programme and on-site sequence are confirmed in the proposal after site and supplier checks'],
    maintenance: ['Cleaning and inspection follow the current written guidance for the selected frame, roof, gutters and hip junctions'],
    upgradePath: ['Add blinds/screens and heaters for shoulder seasons'],
    bestPairedWith: [
      'Mesh blinds at windward faces',
      'Downlights over seating; strip lighting around the perimeter',
    ],
    indicativePerformance: [
      'Bay sizes and member depths confirmed by the project-specific design',
      'Hip angles and sheet selection tuned to site',
    ],
    faqs: [
      {
        q: 'Is a hip darker than other roofs?',
        a: 'Daylight depends on orientation, roof depth, framing and the exact roof sheets. Clear, opal, tinted or solid zones should be assessed against the outdoor area and adjoining rooms.',
      },
      {
        q: 'Can it meet complex walls and flashings?',
        a: 'Custom flashings can step roof sheets around hips. The final junction and drainage details are resolved for the measured building and selected roofing.',
      },
    ],
  },
  'box-perimeter': {
    overview:
      'Box Perimeter frames the outdoor room with a crisp architectural edge. A deep aluminium perimeter defines the silhouette while the roof fall and drainage sit within the frame. Fixed acrylic roofing preserves daylight without motors or moving roof parts.',
    atAGlance: [
      'Defined aluminium perimeter edge',
      'Posts proportioned for the completed structure',
      'Fixed acrylic roof with product-specific daylight characteristics',
      'Gutter and downpipe coordinated within the completed design',
      'Lighting and blinds fit discreetly',
    ],
    howItWorks:
      'A deep aluminium perimeter carries the fixed roof within the frame. Gutters, outlets, downpipes, posts and fixings are coordinated with the completed geometry and site conditions.',
    whyItsGood: [
      'Crisp, contemporary silhouette with strong street presence',
      'Fixed roof with no motors or moving roof parts',
      'Daylight and glare are addressed through the exact roof sheet, roof depth and any edge treatments',
      'Tidy junctions and integrated services',
    ],
    structureMaterials: [
      'Aluminium perimeter frame and posts sized for the completed design',
      'Acrylic roof set into the frame',
      'Gutter and downpipe details resolved for the completed design',
      'Powder-coated finish selected with current care requirements',
    ],
    options: [
      'Clear or softly tinted acrylic sheets',
      'Concealed fixings where feasible',
      'Downlights within the perimeter',
      'Roller blinds considered for selected exposure and privacy priorities',
    ],
    performance: [
      'Daylight and glare depend on the selected acrylic sheet, roof depth, orientation and any blinds',
      'Strong architectural definition and tidy junctions',
      'Daylight, glare and solar response depend on the selected roof sheet and any blinds',
      'Rain management depends on roof fall, junctions, gutters, outlets and open edges',
    ],
    recommendedFor: [
      'Street‑visible terraces and contemporary homes',
      'Clients wanting a defined perimeter around a fixed roof',
    ],
    notIdealFor: [
      'Sites needing acoustic damping or insulated panels',
      'Heritage façades that call for minimal visual change',
    ],
    install: ['The project programme and on-site sequence are confirmed in the proposal after site and supplier checks'],
    maintenance: ['Cleaning and inspection follow the current written guidance for the selected frame finish, acrylic roof and drainage'],
    upgradePath: [
      'Add lighting and blinds now or later',
      'Step up to an Architectural spec with lined ceiling/insulated panels',
    ],
    bestPairedWith: [
      'LED strip within the perimeter',
      'Discrete downlights over tables',
      'Mesh blinds at exposed faces for comfort',
    ],
    indicativePerformance: [
      'Bay sizes and member depths confirmed by the project-specific design',
      'Foundations and fixings resolved from project-specific engineering where required',
    ],
    faqs: [
      {
        q: 'Will the frame look heavy?',
        a: 'The visual weight depends on the final member depths, post positions, colour, roof depth and relationship to the home. Those proportions should be reviewed in the project design.',
      },
      {
        q: 'Can gutters hide in the frame?',
        a: 'They can be coordinated within the perimeter where the completed member sizes, roof fall, outlets, access and discharge path allow it.',
      },
    ],
  },
  'slat-screens': {
    overview:
      'Slat screens introduce partial visual screening and edge definition while retaining openings between the slats. Panels are coordinated with the pergola frame, desired outlook and selected timber or aluminium finish.',
    atAGlance: [
      'Slat spacing selected around privacy and outlook',
      'Timber or aluminium slats in several profiles',
      'Vertical, horizontal or mixed‑density layouts',
      'Gates and service panels integrate into the run',
      'Aluminium and timber finishes with product-specific care requirements',
    ],
    howItWorks:
      'Slats run vertically or horizontally at a pitch tuned to outlook and sun path. Lower sections can run denser to hide bins or services while upper sections stay lighter to keep views and light. Matching gates and removable panels use the same profiles so utilities disappear into the design.',
    whyItsGood: [
      'Creates human‑scale boundaries without heavy walls',
      'Softens views and hides bins, heat pumps and services',
      'Slat direction and spacing affect privacy, outlook, daylight and openness',
      'Appearance and care depend on the selected material, finish and site exposure',
    ],
    structureMaterials: [
      'Aluminium perimeter frame with adjustable brackets',
      'Timber or aluminium slats in several profiles',
      'Exterior finishes and fixings selected for the material and site exposure',
    ],
    options: [
      'Vertical or horizontal orientation; mixed‑density layouts',
      'Integrated gate or removable service panel',
      'Colour‑matched powder coat; timber oil or stain systems',
    ],
    performance: [
      'Wind, glare and view-through effects depend on slat direction, spacing and the actual site',
      'Privacy changes with viewing angle, distance and light conditions',
      'Finish performance and care follow the selected product documentation',
    ],
    recommendedFor: [
      'Screening neighbours, bins and heat pumps',
      'Defining edges and backdrops to outdoor rooms',
    ],
    notIdealFor: [
      'Projects expecting a weather seal or full enclosure from a slatted edge',
    ],
    install: ['Supplier availability and the on-site sequence are confirmed for the selected screen system and measured openings'],
    maintenance: [
      'Cleaning and recoating follow the current written guidance for the selected aluminium or timber finish',
    ],
    upgradePath: [
      'Combine with blinds or acrylic panels for seasonal control',
    ],
    bestPairedWith: [
      'Drop‑down blinds on the open face',
      'Downlights for evening use',
    ],
    indicativePerformance: [
      'Panel width and post spacing confirmed for the selected profile, opening and exposure',
      'Fixing method and post spacing confirmed at design',
    ],
    faqs: [
      {
        q: 'Will slats rattle?',
        a: 'Noise risk depends on profile, span, fixing method, clearances, exposure and installation. Ask for the exact system details and any operating or maintenance guidance that applies.',
      },
      {
        q: 'Can I mix timber and aluminium?',
        a: 'Timber and aluminium can be considered together where their profiles, fixings, movement, finishes and care requirements are compatible with the completed screen design.',
      },
    ],
  },
  'acrylic-infill-panels': {
    overview:
      'Acrylic infill panels can moderate exposed pergola edges while preserving views. Clear or softly tinted sheets sit within slim aluminium channels with isolation and movement details selected for the opening and site conditions.',
    atAGlance: [
      'Clear or tinted edge treatment with project-specific shelter effects',
      'Clear or tinted acrylic in slim frames',
      'Fixed, removable or sliding configurations where supported by the selected panel system',
      'Panel, frame and fixing details selected for the opening',
      'Can be coordinated with blinds or services where appropriate',
    ],
    howItWorks:
      'The selected acrylic is cut to size and captured in aluminium frames. Mullions, fixings and optional vent trims are coordinated for the opening, exposure and required air movement.',
    whyItsGood: [
      'Changes the openness of a selected edge without presenting it as full glazing',
      'Outlook, wind and wind-driven rain effects depend on panel layout, open edges and junctions',
      'The panel and frame can be coordinated with the pergola rather than treated as an afterthought',
    ],
    structureMaterials: [
      'Clear or tinted acrylic sheets in aluminium frames',
      'Gaskets, isolation and movement details selected for the exact panel system',
      'Mullions and fixings sized for the opening and exposure',
    ],
    options: [
      'Fixed, removable or sliding panel configurations where supported by the selected system',
      'Tint choices considered around privacy, outlook and daylight',
      'Trickle vents for controlled air movement where required',
    ],
    performance: [
      'The degree of wind and rain protection depends on panel layout, open edges and junction details',
      'Daylight, glare and ageing performance depend on the exact acrylic product and tint',
      'Panel dimensions, fixings and movement details follow the selected system and project design',
    ],
    recommendedFor: [
      'Exposed faces of pergolas and decks',
      'View corridors where transparency matters',
    ],
    notIdealFor: [
      'Full thermal insulation; consider glazing or insulated panels instead',
    ],
    install: ['Supplier availability and the on-site sequence are confirmed for the selected panel system and measured openings'],
    maintenance: [
      'Cleaning follows the current written guidance for the exact acrylic sheet and frame finish',
    ],
    upgradePath: [
      'Pair with blinds for extra sun control',
      'Coordinate a selected heater with panel and structure clearances',
    ],
    bestPairedWith: [
      'Services planned around the panel clearances and selected products',
      'Downlights for even light without glare',
    ],
    indicativePerformance: [
      'Panel sizes and mullion spacing are confirmed from the selected system and project-specific design',
      'Fixing and movement details are coordinated with the opening and exposure',
    ],
    faqs: [
      {
        q: 'Will panels yellow over time?',
        a: 'Ageing and UV performance depend on the selected acrylic product. Review the current manufacturer information and follow its cleaning and maintenance instructions.',
      },
      {
        q: 'Can I remove panels seasonally?',
        a: 'A removable or sliding arrangement may be possible where the selected panel system, opening, fixings and safe handling requirements support it.',
      },
    ],
  },
  'drop-down-blinds': {
    overview:
      'Drop‑down blinds give adjustable control of low sun, privacy and exposure at selected edges. Fabrics range from clear PVC to open‑weave meshes, while side channels or guides are chosen for the measured opening and current system limits.',
    atAGlance: [
      'Adjustable low-sun, privacy and edge-exposure control',
      'Clear PVC or open‑weave meshes',
      'Side channels or guides selected for the measured opening and exact system',
      'Colour‑matched components for a built‑in look',
    ],
    howItWorks:
      'A manual crank or motorised tube rolls the fabric into a compact headbox. Depending on the selected system, side channels or guides locate the fabric edges, and compatible controls may include remotes, wall switches or sensors.',
    whyItsGood: [
      'Allows a selected edge to change without becoming a permanent wall',
      'View-through, low-sun and exposure effects depend on fabric, position and site conditions',
      'Components colour‑match the pergola for a built‑in feel',
      'Replacement and service options depend on the selected system and supplier support',
    ],
    structureMaterials: [
      'Extruded aluminium headboxes, side channels or cable guides',
      'Clear PVC or mesh fabrics with welded hems',
      'Weighted bottom bars and sealed end caps',
    ],
    options: [
      'Manual crank or motorised operation (remote or wall switch)',
      'Sensors and grouped controls where supported by the selected system',
      'Fabric openness and colours to suit privacy and outlook',
    ],
    performance: [
      'Adjustable response to low sun, privacy and edge exposure',
      'Opening size and operating limits are checked against the selected system',
      'Fabric, guides, controls and operating guidance are confirmed for the exact product',
    ],
    recommendedFor: [
      'West and north‑west faces and breezy edges',
      'Outdoor rooms needing flexible enclosure',
    ],
    notIdealFor: [
      'Projects expecting a weather seal or full enclosure from a deployable blind',
    ],
    install: ['Supplier availability and the on-site sequence are confirmed for the selected blind system and measured openings'],
    maintenance: [
      'Cleaning, drying and operating care follow the current written guidance for the exact fabric and blind system',
    ],
    upgradePath: [
      'Integrate with lighting and heaters',
      'Add automation and scenes for convenience',
    ],
    bestPairedWith: [
      'Heating and electrical items coordinated with blind clearances and controls',
      'Downlights or strip lighting for night use',
    ],
    indicativePerformance: [
      'Maximum opening size and operating limits are confirmed from current manufacturer data',
      'Controls and sensor behaviour depend on the selected side-channel or guide system',
    ],
    faqs: [
      {
        q: 'Will mesh keep rain out?',
        a: 'No blind should be treated as a universal weather seal. Mesh and clear PVC respond differently, and wind-driven rain can enter at edges and openings. Confirm the selected system and its published limitations.',
      },
      {
        q: 'Do motors need power on the pergola?',
        a: 'Yes. Motorised blinds require power supplied by a licensed electrician.',
      },
    ],
  },
};

type ProductEvidence =
  | {
      status: 'governed';
      projectSlug: string;
      relevance: string;
    }
  | {
      status: 'context-only';
      projectSlug: string;
      relevance: string;
      caveat: string;
    }
  | {
      status: 'not-published';
      relevance: string;
      caveat: string;
    };

export type ProductRecord = {
  slug: ProductSlug;
  categorySlug: ProductCategorySlug;
  categoryLabel: string;
  variant: ProductVariant;
  route: `/products/${ProductCategorySlug}/${ProductSlug}`;
  name: string;
  shortName: string;
  indexSummary: string;
  proposition: string;
  outcome: {
    heading: string;
    copy: string;
  };
  decision: {
    worksWhen: string[];
    resolve: string[];
  };
  tradeoffs: Array<{
    tension: string;
    guidance: string;
  }>;
  hero: ProductMedia;
  gallery: ProductMedia[];
  evidence: ProductEvidence;
  guide: {
    href: string;
    label: string;
    summary: string;
  };
  alternatives: ProductSlug[];
  relatedProducts: ProductSlug[];
  metadata: {
    title: string;
    description: string;
    ogImage: string;
  };
  details: ProductTechnicalDetails;
};

export const productCategories: Array<{
  slug: ProductCategorySlug;
  label: string;
  heading: string;
  introduction: string;
}> = [
  {
    slug: 'pergolas',
    label: 'Pergola forms',
    heading: 'Compare four roof forms.',
    introduction:
      'Form changes height, drainage and how the pergola meets the house.',
  },
  {
    slug: 'screens-walls',
    label: 'Screens and edge treatments',
    heading: 'Control the edges.',
    introduction:
      'Use a fixed or adjustable edge for privacy, sun or exposure.',
  },
  {
    slug: 'lighting-heating',
    label: 'Lighting and heating',
    heading: 'Plan for evening use.',
    introduction:
      'Set lighting, cabling and heater clearances before the frame is built.',
  },
];

export const products: ProductRecord[] = [
  {
    slug: 'pitched',
    categorySlug: 'pergolas',
    categoryLabel: 'Pergola forms',
    variant: 'pergola-form',
    route: '/products/pergolas/pitched',
    name: 'Pitched pergola',
    shortName: 'Pitched',
    indexSummary:
      'A single roof plane for tight connections and one clear drainage direction.',
    proposition:
      'A single roof plane for tight connections and one clear drainage direction.',
    outcome: {
      heading: 'Shelter the useful part of the deck without making the addition feel oversized.',
      copy:
        'A pitched form is often the calmest starting point when the house connection is tight or the outlook should stay open. The pitch, high edge and low edge are set from the actual building, rather than chosen from a standard diagram.',
    },
    decision: {
      worksWhen: [
        'A restrained roof line suits the architecture.',
        'There is a clear direction for roof fall and drainage.',
        'Doors, windows or eaves place limits on the house connection.',
      ],
      resolve: [
        'Available height at the house and at the outer edge.',
        'Where water can collect and discharge.',
        'How the selected roof product affects adjoining rooms.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Height versus fall',
        guidance:
          'A useful roof fall still needs comfortable head height at the low edge. Both are resolved from measured levels.',
      },
      {
        tension: 'Light versus shade',
        guidance:
          'Clear, opal, tinted and solid roof zones change the room differently. The right mix depends on orientation and the rooms beside the deck.',
      },
      {
        tension: 'Open span versus supports',
        guidance:
          'Post positions and member depths follow the completed structure, exposure and available foundations.',
      },
    ],
    hero: {
      src: '/images/project-tamaki-dr-01.jpg',
      alt: 'Pitched Sanctuary pergola framing the seating area at Lilliput Mini Golf',
      caption: 'Lilliput Mini Golf',
      detail: 'Pitched roof · Tamaki Drive',
      objectPosition: '50% 42%',
    },
    gallery: [
      {
        src: '/images/product-pitched-01.jpg',
        alt: 'Single-slope pergola roof meeting a house',
        caption: 'One deliberate fall',
        detail: 'Connection, head height and drainage considered together',
      },
      {
        src: '/images/project-tindalls-bay.jpg',
        alt: 'Pitched patio cover at Tindalls Bay with mixed roof materials',
        caption: 'Tindalls Bay',
        detail: 'Solid and acrylic zones respond to different daylight needs',
        objectPosition: '50% 42%',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'lilliput-mini-golf',
      relevance:
        'A shallow pitched frame was coordinated with existing foundations, services, sightlines and a wider renovation scope.',
    },
    guide: {
      href: '/pitched-pergolas-auckland',
      label: 'Plan a pitched pergola',
      summary:
        'Go deeper on roof direction, the house connection, daylight and the site information needed before design.',
    },
    alternatives: ['gable', 'box-perimeter'],
    relatedProducts: ['drop-down-blinds', 'downlights', 'led-strip-lighting'],
    metadata: {
      title: 'Pitched Pergolas Auckland',
      description:
        'Explore pitched pergolas designed around house connections, roof fall, daylight and drainage. See built work, trade-offs and what Sanctuary needs to assess your deck.',
      ogImage: '/images/project-tamaki-dr-01.jpg',
    },
    details: productDetails.pitched,
  },
  {
    slug: 'gable',
    categorySlug: 'pergolas',
    categoryLabel: 'Pergola forms',
    variant: 'pergola-form',
    route: '/products/pergolas/gable',
    name: 'Gable pergola',
    shortName: 'Gable',
    indexSummary:
      'A central ridge adds height and a clear centre to the outdoor room.',
    proposition:
      'A central ridge adds height and a clear centre to the outdoor room.',
    outcome: {
      heading: 'Make the covered area feel like a room in its own right.',
      copy:
        'A gable can create generous volume over dining and lounge zones. The result depends on the ridge height, eaves, end treatment and relationship to the existing roof, rather than the word “gable” alone.',
    },
    decision: {
      worksWhen: [
        'The deck benefits from a taller centre and a clearly expressed roof.',
        'The house has enough height for the ridge and eave relationships to feel deliberate.',
        'The gable ends can stay open or take a considered infill treatment.',
      ],
      resolve: [
        'Ridge height, eave height and the view from inside the house.',
        'Whether the new form should align with or contrast the existing roof.',
        'How gable ends, roof zones, lighting and blinds work as one composition.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Volume versus visual presence',
        guidance:
          'The ridge creates useful height, but it also makes the new roof more visible. Proportion matters.',
      },
      {
        tension: 'Daylight versus glare',
        guidance:
          'A larger roof volume can take clear, opal or solid zones. Their effect should be checked against orientation and nearby glazing.',
      },
      {
        tension: 'Open ends versus edge control',
        guidance:
          'Open gables retain outlook and air movement. Infill or screens can moderate an exposed end but change the sense of openness.',
      },
    ],
    hero: {
      src: '/images/project-warkworth-outdoor-room-01.jpg',
      alt: 'Freestanding matte black gable outdoor room beside a Warkworth home',
      caption: 'Warkworth Outdoor Room',
      detail: 'Freestanding gable · Clear acrylic and cedar',
      objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION,
    },
    gallery: [
      {
        src: '/images/project-warkworth-outdoor-room-02.jpg',
        alt: 'Interior of the Warkworth gable outdoor room with cedar ceiling and lighting',
        caption: 'A room, not only a roof',
        detail: 'Structure, ceiling and services resolved together',
        objectPosition: '50% 42%',
      },
      {
        src: '/images/project-riverhead-gable-01.jpg',
        alt: 'Riverhead poolside gable pavilion with timber sarking and black framing',
        caption: 'Riverhead Gable Pavilion',
        detail: 'A strong centre line beside the pool',
        objectPosition: '50% 45%',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'warkworth-outdoor-room',
      relevance:
        'A freestanding gable allowed the new deck, fireplace, clear acrylic glazing and cedar ceiling to be planned as one outdoor room.',
    },
    guide: {
      href: '/gable-pergolas-auckland',
      label: 'Plan a gable pergola',
      summary:
        'Understand ridge height, end treatments, roofing choices and the measurements that shape a gable design.',
    },
    alternatives: ['pitched', 'hip'],
    relatedProducts: ['acrylic-infill-panels', 'downlights', 'led-strip-lighting'],
    metadata: {
      title: 'Gable Pergolas Auckland',
      description:
        'Explore gable pergolas designed around ridge height, daylight, end treatments and architectural fit. See Sanctuary projects, trade-offs and planning guidance.',
      ogImage: '/images/project-warkworth-outdoor-room-01.jpg',
    },
    details: productDetails.gable,
  },
  {
    slug: 'hip',
    categorySlug: 'pergolas',
    categoryLabel: 'Pergola forms',
    variant: 'pergola-form',
    route: '/products/pergolas/hip',
    name: 'Hip pergola',
    shortName: 'Hip',
    indexSummary:
      'A composed roof for courtyards, corners and views from several sides.',
    proposition:
      'A composed roof for courtyards, corners and views from several sides.',
    outcome: {
      heading: 'Create a covered courtyard that feels resolved from every side.',
      copy:
        'A hip form can suit a deck seen from several directions or a house with more complex geometry. Its hips, junctions, outlets and supports need to be designed as one structure.',
    },
    decision: {
      worksWhen: [
        'The pergola is visible from several sides.',
        'A balanced perimeter is more important than the simplicity of one roof plane.',
        'The roof must respond to corners or changing façade lines.',
      ],
      resolve: [
        'How each roof plane drains and where outlets can go.',
        'The effect of hips and framing on daylight below.',
        'Corner connections, post positions and junctions with the house.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Composed perimeter versus structural complexity',
        guidance:
          'The balanced roof edge comes with more hips and junctions to detail than a pitched form.',
      },
      {
        tension: 'Distributed drainage versus simpler discharge',
        guidance:
          'Several falls can organise water around the perimeter, but every outlet and path still needs a clear resolution.',
      },
      {
        tension: 'Roof presence versus the existing home',
        guidance:
          'Pitch, colour and member depth determine whether the hip form settles beside the house or competes with it.',
      },
    ],
    hero: {
      src: '/images/project-waitakere-ranges-01.jpg',
      alt: 'Hip roof Sanctuary pergola forming a courtyard room at Muriwai',
      caption: 'Muriwai Courtyard',
      detail: 'Hip roof · Opal acrylic',
      objectPosition: '50% 48%',
    },
    gallery: [
      {
        src: '/images/product-hip-02.jpg',
        alt: 'Exterior view of a hip pergola showing several roof planes',
        caption: 'A balanced roof edge',
        detail: 'Hips, falls and supports resolved as one form',
      },
      {
        src: '/images/project-waitakere-ranges-02.jpg',
        alt: 'Muriwai hip pergola used as a courtyard room at night',
        caption: 'The established footprint, renewed',
        detail: 'Contemporary frame coordinated with a Tuscan-style home',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'muriwai-courtyard',
      relevance:
        'The replacement hip pergola kept the established courtyard footprint while coordinating a contemporary frame with the existing home.',
    },
    guide: {
      href: '/pergolas-auckland',
      label: 'Compare pergola planning priorities',
      summary:
        'Review roof-form, daylight, site and scope questions before settling on a specific geometry.',
    },
    alternatives: ['gable', 'pitched'],
    relatedProducts: ['drop-down-blinds', 'downlights', 'slat-screens'],
    metadata: {
      title: 'Hip Pergolas Auckland',
      description:
        'Explore hip pergolas for courtyards and complex façades. See built project evidence, geometry consequences, trade-offs and what must be resolved for the site.',
      ogImage: '/images/project-waitakere-ranges-01.jpg',
    },
    details: productDetails.hip,
  },
  {
    slug: 'box-perimeter',
    categorySlug: 'pergolas',
    categoryLabel: 'Pergola forms',
    variant: 'pergola-form',
    route: '/products/pergolas/box-perimeter',
    name: 'Box-perimeter pergola',
    shortName: 'Box perimeter',
    indexSummary:
      'A level outer frame hides the working roof fall and drainage.',
    proposition:
      'A level outer frame hides the working roof fall and drainage.',
    outcome: {
      heading: 'Get a precise outer frame without pretending the roof is flat.',
      copy:
        'The perimeter reads as a level line while roof fall, gutters and outlets work behind it. That makes careful coordination of depth, drainage and access essential.',
    },
    decision: {
      worksWhen: [
        'A contemporary, level perimeter suits the existing architecture.',
        'The roof fall and drainage can be concealed within the available depth.',
        'The pergola is prominent from the street, garden or main outlook.',
      ],
      resolve: [
        'The depth needed for structure, fall, gutter and access.',
        'Where downpipes and discharge can go.',
        'How the stronger horizontal edge sits beside the house.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Clean edge versus required depth',
        guidance:
          'The perimeter has to hold structure and roof services. Its visual weight is tuned through proportion, colour and post placement.',
      },
      {
        tension: 'Concealed drainage versus service access',
        guidance:
          'Hidden fall and gutters still need inspectable, maintainable outlets and a clear discharge path.',
      },
      {
        tension: 'Architectural definition versus subtlety',
        guidance:
          'A box perimeter creates a stronger frame than a simple pitched roof. That can be useful or too dominant depending on the house.',
      },
    ],
    hero: {
      src: '/images/project-mt-maunganui-01.jpg',
      alt: 'First-floor box-perimeter Sanctuary pergola on a dark Mt Maunganui home',
      caption: 'Mt Maunganui Box',
      detail: 'Perimeter roof · Opal acrylic',
      objectPosition: '50% 0%',
    },
    gallery: [
      {
        src: '/images/project-waiheke-01.jpg',
        alt: 'Box-perimeter pergola extending a coastal deck on Waiheke Island',
        caption: 'Waiheke Holiday Home',
        detail: 'Roof fall and gutters concealed behind the beam',
        objectPosition: '50% 48%',
      },
      {
        src: '/images/project-mt-maunganui-03.jpg',
        alt: 'View below the acrylic roof inside the Mt Maunganui box-perimeter frame',
        caption: 'What the outer line contains',
        detail: 'Roof, fall and frame coordinated together',
        objectPosition: '50% 0%',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'mt-maunganui-box',
      relevance:
        'A first-floor deck required the perimeter, acrylic roof, façade relationship and drainage to read as one deliberate addition.',
    },
    guide: {
      href: '/custom-pergolas-auckland',
      label: 'Understand the custom design process',
      summary:
        'See why house geometry, measured levels and project scope shape a custom pergola before components are selected.',
    },
    alternatives: ['pitched', 'hip'],
    relatedProducts: ['downlights', 'led-strip-lighting', 'drop-down-blinds'],
    metadata: {
      title: 'Box-Perimeter Pergolas Auckland',
      description:
        'Explore box-perimeter pergolas with a clean outer frame and concealed roof fall. See built projects, drainage trade-offs and project-specific planning guidance.',
      ogImage: '/images/project-mt-maunganui-01.jpg',
    },
    details: productDetails['box-perimeter'],
  },
  {
    slug: 'slat-screens',
    categorySlug: 'screens-walls',
    categoryLabel: 'Screens and edge treatments',
    variant: 'integrated-option',
    route: '/products/screens-walls/slat-screens',
    name: 'Slat screens',
    shortName: 'Slat screens',
    indexSummary:
      'Fixed privacy with light and air between the slats.',
    proposition:
      'Fixed privacy with light and air between the slats.',
    outcome: {
      heading: 'Give the deck a boundary without closing the room in.',
      copy:
        'Slat direction, spacing and viewing angle determine what the screen hides and what it keeps open. The layout should be tested from the places that matter: inside the house, at the table and from neighbouring boundaries.',
    },
    decision: {
      worksWhen: [
        'Privacy or service screening can be fixed in one location.',
        'Some view-through and air movement are desirable.',
        'The screen can align with the frame, furniture and circulation.',
      ],
      resolve: [
        'The exact view lines that should be blocked or retained.',
        'Timber or aluminium finish and its care requirements.',
        'Slat direction, spacing, panel support and any gate or access panel.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Privacy versus outlook',
        guidance:
          'Denser spacing screens more, but reduces the view and can make the edge feel heavier.',
      },
      {
        tension: 'Fixed definition versus flexibility',
        guidance:
          'A slat screen is always present. Use a blind where the edge needs to open and close.',
      },
      {
        tension: 'Timber warmth versus finish care',
        guidance:
          'Timber and aluminium create different character and maintenance obligations. Confirm the exact finish before deciding.',
      },
    ],
    hero: {
      src: '/images/product-slat-01.JPG',
      alt: 'Vertical slat screen forming a partial boundary beside an outdoor area',
      caption: 'Slat screen study',
      detail: 'Fixed edge · Spacing selected around outlook',
    },
    gallery: [
      {
        src: '/images/product-slat-02.JPG',
        alt: 'Close view of slat spacing and the outlook through a screen',
        caption: 'Privacy is directional',
        detail: 'Spacing, angle and viewing position all matter',
      },
      {
        src: '/images/project-waiheke-03.jpg',
        alt: 'Waiheke pergola extending a coastal deck while retaining the outlook',
        caption: 'Waiheke Holiday Home',
        detail: 'Broader screen-integration context; not proof of this exact slat system',
        objectPosition: '50% 48%',
      },
    ],
    evidence: {
      status: 'context-only',
      projectSlug: 'waiheke-holiday-home',
      relevance:
        'The published project record identifies screen integration as part of a perimeter pergola that protects the coastal outlook.',
      caveat:
        'The record does not identify the exact screen profile or confirm that the pictured system is this slat-screen product.',
    },
    guide: {
      href: '/pergolas-with-blinds',
      label: 'Compare ways to manage pergola edges',
      summary:
        'Use the blinds guide to compare a deployable edge with the fixed privacy and openness of slats.',
    },
    alternatives: ['drop-down-blinds', 'acrylic-infill-panels'],
    relatedProducts: ['downlights', 'led-strip-lighting'],
    metadata: {
      title: 'Pergola Slat Screens',
      description:
        'Explore fixed slat screens for pergola privacy and edge definition. Compare timber and aluminium, spacing trade-offs, alternatives and site-specific questions.',
      ogImage: '/images/product-slat-01.JPG',
    },
    details: productDetails['slat-screens'],
  },
  {
    slug: 'acrylic-infill-panels',
    categorySlug: 'screens-walls',
    categoryLabel: 'Screens and edge treatments',
    variant: 'integrated-option',
    route: '/products/screens-walls/acrylic-infill-panels',
    name: 'Acrylic infill panels',
    shortName: 'Acrylic infill',
    indexSummary:
      'A transparent fixed edge that can reduce exposure without becoming a solid wall.',
    proposition:
      'A transparent fixed edge that can reduce exposure without becoming a solid wall.',
    outcome: {
      heading: 'Keep the view while making one exposed edge feel more settled.',
      copy:
        'Acrylic infill can change how wind and wind-driven rain reach a seating area, but it is not a universal weather seal. Panel layout, open edges and junctions determine the practical result.',
    },
    decision: {
      worksWhen: [
        'Transparency matters more than adjustable opening.',
        'A selected edge needs more definition than a slat screen provides.',
        'The frame can support panel movement, fixings and safe access.',
      ],
      resolve: [
        'Which openings remain and how air moves through the area.',
        'Panel tint, glare and the effect on views from inside.',
        'System limits, fixings, movement details and cleaning access.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Shelter versus enclosure',
        guidance:
          'Adding panels changes air movement and the sense of openness. The surrounding edges still affect exposure.',
      },
      {
        tension: 'Clear outlook versus reflections',
        guidance:
          'Tint, light direction and viewing angle affect reflection and visual clarity.',
      },
      {
        tension: 'Fixed protection versus seasonal flexibility',
        guidance:
          'A fixed panel is always present. Removable or sliding arrangements depend on the selected system and safe handling.',
      },
    ],
    hero: {
      src: '/images/product-infill-01.jpg',
      alt: 'Clear acrylic infill panel captured within a pergola edge frame',
      caption: 'Acrylic infill study',
      detail: 'Clear edge · Exact panel system to be confirmed',
    },
    gallery: [
      {
        src: '/images/product-infill-02.JPG',
        alt: 'Acrylic infill panel detail showing the panel and surrounding frame',
        caption: 'The junction does the work',
        detail: 'Panel, frame, movement and open edges considered together',
      },
      {
        src: '/images/project-warkworth-outdoor-room-04.jpg',
        alt: 'Clear acrylic roof glazing and cedar ceiling in the Warkworth outdoor room',
        caption: 'Warkworth Outdoor Room',
        detail: 'Clear acrylic glazing context; not this exact infill-panel system',
        objectPosition: '46% 43%',
      },
    ],
    evidence: {
      status: 'context-only',
      projectSlug: 'warkworth-outdoor-room',
      relevance:
        'The project demonstrates how clear acrylic glazing can be composed with an outdoor-room structure to retain light.',
      caveat:
        'The governed project record describes roof and gable glazing, not this exact edge infill-panel system or a universal shelter result.',
    },
    guide: {
      href: '/acrylic-roof-pergolas-auckland',
      label: 'Understand acrylic selection',
      summary:
        'Read the planning guide for the questions that change acrylic appearance, daylight and product selection.',
    },
    alternatives: ['slat-screens', 'drop-down-blinds'],
    relatedProducts: ['downlights', 'patio-heaters'],
    metadata: {
      title: 'Acrylic Pergola Infill Panels',
      description:
        'Explore acrylic infill panels for clearer pergola edges. Understand openness, exposure, tint, system limits, honest trade-offs and what must be confirmed.',
      ogImage: '/images/product-infill-01.jpg',
    },
    details: productDetails['acrylic-infill-panels'],
  },
  {
    slug: 'drop-down-blinds',
    categorySlug: 'screens-walls',
    categoryLabel: 'Screens and edge treatments',
    variant: 'integrated-option',
    route: '/products/screens-walls/drop-down-blinds',
    name: 'Drop-down blinds',
    shortName: 'Drop-down blinds',
    indexSummary:
      'Lower one edge for sun, privacy or exposure, then open it again.',
    proposition:
      'Lower one edge for sun, privacy or exposure, then open it again.',
    outcome: {
      heading: 'Make the edge adjustable instead of committing to a permanent wall.',
      copy:
        'Fabric, guides, opening size and wind conditions change what a blind can do. The headbox, power and clearances should be designed into the pergola rather than attached as an afterthought.',
    },
    decision: {
      worksWhen: [
        'Low sun, privacy or exposure changes through the day.',
        'The opening needs to return to a fully open state.',
        'The frame can take the selected headbox, guides and operating clearances.',
      ],
      resolve: [
        'Clear PVC or mesh and the view-through it provides.',
        'Manual or motorised operation and power provision.',
        'Opening size, guide system, wind limitations and operating guidance.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Control versus openness',
        guidance:
          'A deployed blind changes the view and air movement. Rolled away, it leaves the edge open but the headbox remains visible.',
      },
      {
        tension: 'View-through versus privacy',
        guidance:
          'Fabric openness and lighting conditions affect what can be seen in both directions.',
      },
      {
        tension: 'Convenience versus coordination',
        guidance:
          'Motorisation can simplify use but needs compatible controls, power and service access.',
      },
    ],
    hero: {
      src: '/images/project-goodhome-05.jpg',
      alt: 'Clear blinds deployed along the edge of The Good Home covered courtyard',
      caption: 'The Good Home Takanini',
      detail: 'Cafe blinds · Adjustable courtyard edge',
      objectPosition: '50% 48%',
    },
    gallery: [
      {
        src: '/images/product-blinds-01.jpg',
        alt: 'Drop-down blind integrated into a pergola frame',
        caption: 'Designed into the opening',
        detail: 'Headbox, guides and clearances planned early',
      },
      {
        src: '/images/project-tindalls-bay-03.jpg',
        alt: 'Tindalls Bay patio with mesh blinds, a heater and coastal outlook',
        caption: 'Tindalls Bay',
        detail: 'Mesh blinds support privacy and exposure control',
        objectPosition: '50% 45%',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'tindalls-bay-pavilion',
      relevance:
        'Mesh blinds were integrated along one side to address exposure and privacy while retaining the coastal view.',
    },
    guide: {
      href: '/pergolas-with-blinds',
      label: 'Plan a pergola with blinds',
      summary:
        'Compare fabrics, edge conditions, integration questions and the limits of deployable screening.',
    },
    alternatives: ['slat-screens', 'acrylic-infill-panels'],
    relatedProducts: ['patio-heaters', 'downlights', 'led-strip-lighting'],
    metadata: {
      title: 'Pergola Drop-Down Blinds',
      description:
        'Explore integrated pergola blinds for adjustable low sun, privacy and exposure. See project evidence, fabric trade-offs, controls and planning questions.',
      ogImage: '/images/project-goodhome-05.jpg',
    },
    details: productDetails['drop-down-blinds'],
  },
  {
    slug: 'downlights',
    categorySlug: 'lighting-heating',
    categoryLabel: 'Lighting and heating',
    variant: 'integrated-option',
    route: '/products/lighting-heating/downlights',
    name: 'Integrated downlights',
    shortName: 'Downlights',
    indexSummary:
      'Focused light for dining, steps and circulation.',
    proposition:
      'Focused light for dining, steps and circulation.',
    outcome: {
      heading: 'Use the covered area after dark without washing everything in harsh light.',
      copy:
        'Beam, spacing, colour temperature and circuits should follow the furniture plan and the surfaces that need light. A licensed electrician confirms the fittings, wiring and installation scope.',
    },
    decision: {
      worksWhen: [
        'Dining, preparation or circulation needs clear overhead light.',
        'The roof or frame has suitable locations for recessed or discreet fittings.',
        'Circuiting and cable paths can be planned with the structure.',
      ],
      resolve: [
        'What must be lit and where furniture will sit.',
        'The exact exterior-rated fitting, beam and colour temperature.',
        'Drivers, dimming, switching, cabling and electrician scope.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Useful light versus glare',
        guidance:
          'More fittings are not automatically better. Beam, spacing and sightlines determine comfort.',
      },
      {
        tension: 'Even coverage versus atmosphere',
        guidance:
          'Downlights handle tasks well. Strip lighting can add a softer ambient layer.',
      },
      {
        tension: 'Clean ceiling versus future access',
        guidance:
          'Drivers, junctions and replacement paths still need protected, serviceable locations.',
      },
    ],
    hero: {
      src: '/images/project-riverhead-gable-03.webp',
      alt: 'Timber sarking, downlights and LED strip lighting inside the Riverhead gable pavilion',
      caption: 'Riverhead Gable Pavilion',
      detail: 'Downlights and strip lighting · Layered lighting plan',
      objectPosition: '50% 0%',
    },
    gallery: [
      {
        src: '/images/product-downlight-01.jpg',
        alt: 'Recessed downlight set into a pergola ceiling detail',
        caption: 'Quiet fittings, useful light',
        detail: 'Position follows tables, work surfaces and paths',
      },
      {
        src: '/images/project-warkworth-outdoor-room-02.jpg',
        alt: 'Warkworth outdoor room with pendant and recessed lighting',
        caption: 'Warkworth Outdoor Room',
        detail: 'Lighting composed with the cedar ceiling and room layout',
        objectPosition: '50% 42%',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'riverhead-gable-pavilion',
      relevance:
        'Integrated downlights and LED strip lighting were composed with the timber-lined gable roof for task and ambient layers.',
    },
    guide: {
      href: '/outdoor-rooms-auckland',
      label: 'Plan the complete outdoor room',
      summary:
        'See how roof, edges, lighting and comfort are considered together rather than as separate add-ons.',
    },
    alternatives: ['led-strip-lighting', 'patio-heaters'],
    relatedProducts: ['led-strip-lighting', 'drop-down-blinds'],
    metadata: {
      title: 'Integrated Pergola Downlights',
      description:
        'Explore integrated pergola downlights for dining, tasks and circulation. See built evidence, lighting trade-offs and what the fitting and electrical plan must confirm.',
      ogImage: '/images/project-riverhead-gable-03.webp',
    },
    details: productDetails.downlights,
  },
  {
    slug: 'led-strip-lighting',
    categorySlug: 'lighting-heating',
    categoryLabel: 'Lighting and heating',
    variant: 'integrated-option',
    route: '/products/lighting-heating/led-strip-lighting',
    name: 'LED strip lighting',
    shortName: 'LED strip lighting',
    indexSummary:
      'Concealed ambient light along edges or ceiling details.',
    proposition:
      'Concealed ambient light along edges or ceiling details.',
    outcome: {
      heading: 'Make the structure legible after dark and keep the mood relaxed.',
      copy:
        'Channels, diffusers and concealed drivers help the light read as a continuous wash. Tape, output, controls and exposure rating are confirmed for the exact lighting system.',
    },
    decision: {
      worksWhen: [
        'The room needs an ambient layer around edges or ceiling details.',
        'Channels and cable paths can be integrated before fabrication.',
        'Task lighting is handled separately where needed.',
      ],
      resolve: [
        'Where the strip can be concealed from normal sightlines.',
        'Colour temperature, output, diffuser and dimming zones.',
        'Driver locations, exposure rating, controls and service access.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Ambience versus task light',
        guidance:
          'A perimeter glow defines the room but may not put enough light on a dining or preparation surface.',
      },
      {
        tension: 'Continuous line versus serviceability',
        guidance:
          'Channels and drivers should look integrated while remaining accessible for inspection and replacement.',
      },
      {
        tension: 'Brightness versus visible spotting',
        guidance:
          'Tape, diffuser, channel depth and viewing angle determine whether the light reads as a smooth line.',
      },
    ],
    hero: {
      src: '/images/project-kiwi-rail-02.jpg',
      alt: 'Integrated strip lighting along the KiwiRail workplace canopy at night',
      caption: 'KiwiRail Head Office',
      detail: 'Integrated strip lighting · Covered circulation',
      objectPosition: '50% 50%',
    },
    gallery: [
      {
        src: '/images/project-riverhead-gable-03.webp',
        alt: 'LED strip lighting and downlights within the Riverhead timber-lined gable roof',
        caption: 'Riverhead Gable Pavilion',
        detail: 'Ambient and task light used as separate layers',
        objectPosition: '50% 0%',
      },
      {
        src: '/images/product-timber.jpg',
        alt: 'Concealed linear light washing across a timber pergola detail',
        caption: 'Hide the source',
        detail: 'Channel, diffuser and sightline coordinated together',
      },
    ],
    evidence: {
      status: 'governed',
      projectSlug: 'kiwi-rail-platform',
      relevance:
        'Integrated strip lighting was built into the long aluminium and acrylic canopy to support a safe, visually light circulation route after dark.',
    },
    guide: {
      href: '/outdoor-rooms-auckland',
      label: 'Plan the complete outdoor room',
      summary:
        'Understand how lighting, roofing, screening and use patterns form one coordinated brief.',
    },
    alternatives: ['downlights', 'patio-heaters'],
    relatedProducts: ['downlights', 'drop-down-blinds'],
    metadata: {
      title: 'Integrated Pergola LED Strip Lighting',
      description:
        'Explore concealed LED strip lighting for pergola ambience and safe movement. See built examples, integration trade-offs and what the selected system must confirm.',
      ogImage: '/images/project-kiwi-rail-02.jpg',
    },
    details: productDetails['led-strip-lighting'],
  },
  {
    slug: 'patio-heaters',
    categorySlug: 'lighting-heating',
    categoryLabel: 'Lighting and heating',
    variant: 'integrated-option',
    route: '/products/lighting-heating/patio-heaters',
    name: 'Integrated patio heaters',
    shortName: 'Patio heaters',
    indexSummary:
      'Targeted radiant heat for a defined seating area.',
    proposition:
      'Targeted radiant heat for a defined seating area.',
    outcome: {
      heading: 'Take the edge off a cool evening in the part of the deck you actually use.',
      copy:
        'Heater output alone does not determine comfort. Exposure, mounting height, aiming, seating position, controls and surrounding edges all influence the result.',
    },
    decision: {
      worksWhen: [
        'There is a defined seating or dining zone to target.',
        'The exact heater can be mounted with its required clearances.',
        'Electrical supply and switching can be planned with a licensed electrician.',
      ],
      resolve: [
        'The current output and coverage information for the selected heater.',
        'Mounting height, aiming and proximity to roofs, blinds and screens.',
        'Dedicated circuits, controls, weather exposure and service access.',
      ],
    },
    tradeoffs: [
      {
        tension: 'Targeted warmth versus open exposure',
        guidance:
          'Radiant heat is most useful when directed at a known seating zone. Open, windy edges can reduce perceived comfort.',
      },
      {
        tension: 'Coverage versus clearances',
        guidance:
          'A preferred heater position may conflict with the structure, roofing, blinds or manufacturer requirements.',
      },
      {
        tension: 'Integrated appearance versus exact product needs',
        guidance:
          'Housing, bracket, circuit and control choices follow the selected heater, not a generic category promise.',
      },
    ],
    hero: {
      src: '/images/project-goodhome-06.jpg',
      alt: 'The Good Home covered hospitality courtyard in evening light',
      caption: 'Evening-use context',
      detail: 'Heater product and performance are not recorded for this project',
      objectPosition: '50% 46%',
    },
    gallery: [
      {
        src: '/images/project-waitakere-ranges-02.jpg',
        alt: 'Covered Muriwai courtyard arranged for evening use',
        caption: 'Plan around the seating zone',
        detail: 'Context image; no heater system is evidenced here',
      },
      {
        src: '/images/project-warkworth-outdoor-room-03.jpg',
        alt: 'Fireplace and lounge arrangement inside the Warkworth outdoor room',
        caption: 'Comfort starts with the whole room',
        detail: 'Exposure, layout and heat source are separate design decisions',
        objectPosition: '48% 44%',
      },
    ],
    evidence: {
      status: 'not-published',
      relevance:
        'Sanctuary plans heater positions against seating, structure, electrical scope and the current instructions for the selected unit.',
      caveat:
        'No governed Sanctuary project record currently verifies a named patio-heater installation. Context photography must not be read as heater-product evidence.',
    },
    guide: {
      href: '/outdoor-rooms-auckland',
      label: 'Plan the complete outdoor room',
      summary:
        'Consider edge control, evening use, lighting and heating as one project brief before products are selected.',
    },
    alternatives: ['downlights', 'drop-down-blinds'],
    relatedProducts: ['drop-down-blinds', 'downlights', 'led-strip-lighting'],
    metadata: {
      title: 'Integrated Pergola Patio Heaters',
      description:
        'Plan electric patio heaters around seating, exposure, mounting, clearances and electrical scope. Understand honest trade-offs and what the exact product must confirm.',
      ogImage: '/images/project-goodhome-06.jpg',
    },
    details: productDetails['patio-heaters'],
  },
];

const productByRoute = new Map(products.map((product) => [product.route, product]));
const productBySlug = new Map(products.map((product) => [product.slug, product]));

export function getProduct(
  categorySlug: string,
  productSlug: string,
): ProductRecord | undefined {
  return productByRoute.get(
    `/products/${categorySlug}/${productSlug}` as ProductRecord['route'],
  );
}

export function getProductBySlug(productSlug: string): ProductRecord | undefined {
  return productBySlug.get(productSlug as ProductSlug);
}

export function getProductsByCategory(
  categorySlug: ProductCategorySlug,
): ProductRecord[] {
  return products.filter((product) => product.categorySlug === categorySlug);
}
