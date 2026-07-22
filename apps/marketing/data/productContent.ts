import type { ProductContent } from '@/components/ProductDetails';

export const productContent: Record<string, ProductContent> = {
  'led-strip-lighting': {
    overview:
      'LED strip lighting creates a soft perimeter glow that defines your outdoor room after dark. Tape recesses into slim channels or hides behind pelmets so the diodes are never in view—only a continuous wash of light.',
    atAGlance: [
      'Soft, uniform perimeter glow',
      'Channels with diffusers to hide diodes',
      '24V drivers mounted in protected spots',
      'Dimmable warm/neutral white options',
      'Very low power and long life',
    ],
    howItWorks:
      '24V LED tape runs from weather‑protected drivers with smooth dimming. Diffusers even out output and wiring conceals within the frame. Colour temperature can be warm for ambience or neutral for task edges.',
    whyItsGood: [
      'Flattering, efficient and highly controllable',
      'Avoids tabletop glare and harsh spots',
      'Defines edges for safe steps and circulation',
      'Layers beautifully with downlights',
    ],
    // Inline image request: show timber detail image between Why and Structure
    imageAfterWhy: { src: '/images/product-timber.jpg', alt: 'Timber detail' },
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
      'Excellent ambient layer with very low power consumption',
    ],
    recommendedFor: [
      'Evening entertaining and safe circulation',
      'Pairing with downlights to layer light',
    ],
    notIdealFor: ['Task lighting on its own—combine with downlights'],
    upgradePath: ['Add scenes and sensors; expand to steps and paths'],
    bestPairedWith: ['A few downlights for tasks', 'Dimmers/scenes to set mood'],
    indicativePerformance: [
      'Output ~500–1200 lm/m depending on tape and diffuser',
      'IP rating and channel type matched to exposure',
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
      'Efficient LEDs sip power and run cool for long life',
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
      'Low power draw with long service life',
      'Complements strip lighting for layered scenes',
    ],
    recommendedFor: [
      'Pergolas used nightly and for dining',
      'Paths and steps needing safe, even light',
    ],
    notIdealFor: [
      'Broad ambient wash on its own—pair with strip for ambience',
    ],
    install: [
      'Current lead time and installation sequence confirmed for the selected fittings and electrical scope',
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
      'Per fitting ~300–900 lm depending on model and beam angle',
      'Spacing, beam angle and dimming confirmed from the lighting plan and selected fittings',
    ],
    faqs: [
      {
        q: 'Will they attract bugs?',
        a: 'Warm colour temperature and modest output reduce attraction compared with brighter, cooler lamps.',
      },
      {
        q: 'Can I add later?',
        a: 'Yes. Plan cable paths in advance so a licensed electrician can retrofit fittings cleanly.',
      },
    ],
  },
  'patio-heaters': {
    overview:
      'Electric patio heaters extend the season by warming people and surfaces directly rather than the air. Infrared elements mount to beams or walls and focus heat where you sit, so comfort arrives quickly on cool evenings.',
    atAGlance: [
      'Fast, targeted radiant warmth for seating zones',
      'Clean, electric heat—no gas bottles or open flame',
      'Output sizes matched to area and exposure',
      'Works best when paired with blinds or screens',
    ],
    howItWorks:
      'Quartz or ceramic emitters sit behind reflectors and are angled to wash heat over seating and tables. Zones are switched so you heat only what you use, and clearances follow manufacturer guidelines.',
    whyItsGood: [
      'Immediate comfort on cool evenings without waiting for the air to warm',
      'No LPG storage, fumes or open flames to manage',
      'Discreet fixtures that colour‑match the frame',
      'Simple switches, dimmers or remotes for control',
    ],
    structureMaterials: [
      'Electric infrared heaters with adjustable brackets',
      'Powder‑coated housings to match frame colours',
      'Dedicated circuits and compliant exterior wiring',
    ],
    options: [
      'Output levels tuned to area size and exposure',
      'Wall switch, dimmer or remote control options',
      'Zoned layouts so you heat only the areas in use',
    ],
    performance: [
      'Fast, targeted radiant warmth to people and surfaces',
      'Efficient when paired with blinds or screens to hold heat',
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
      'Current lead time and installation sequence confirmed for the selected heaters and electrical scope',
    ],
    maintenance: [
      'Wipe lenses and grilles periodically',
      'Check operation at the start of each season',
    ],
    upgradePath: [
      'Add sensors or timers and integrate with lighting scenes',
    ],
    bestPairedWith: [
      'Drop‑down blinds to help hold warmth',
      'Dimmers for fine‑tuned comfort control',
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
      'Solid: insulated panels with timber sarking for a more enclosed ceiling and stronger shade response',
      'Combination: solid roof areas with acrylic skylight strips to balance daylight and shade across different zones',
    ],
    performance: [
      'Roof fall, gutters, outlets and discharge path documented for the completed design',
      'Daylight, glare and shade response depend on the selected roof product and tint',
      'Published UV and solar-control performance is confirmed from current manufacturer data',
      'Solid roof panels create a different shade, ceiling and rain-noise character from acrylic zones',
      'Member sizes, spans, joiners and fixings are resolved for the measured site',
    ],
    install: ['The current lead time and on-site sequence are confirmed in the project proposal after site and supplier checks'],
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
      'Solid: insulated panels with timber sarking for a more enclosed ceiling and stronger shade response.',
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
    install: ['The current lead time and on-site sequence are confirmed in the project proposal after site and supplier checks'],
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
      'Lighting and blinds options for comfort',
    ],
    howItWorks:
      'A central ridge and diagonal hips transfer loads to perimeter beams and posts. Custom flashings step roof sheets around hips while maintaining drainage. Posts can offset to suit doors and paths.',
    whyItsGood: [
      'Multiple roof planes can distribute drainage around the perimeter where the site supports it',
      'Hips and corner connections are resolved as part of the complete structure',
      'Premium architectural silhouette with tidy soffit',
      'Material and finish selections can respond to coastal maintenance requirements',
    ],
    structureMaterials: [
      'Four‑sided roof with ridge and hip beams',
      'Powder‑coated aluminium frame and posts',
      'Concealed brackets for clean lines',
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
      'Crisp, tidy soffit with concealed fixings',
      'Finish and maintenance requirements confirmed for the site environment',
    ],
    recommendedFor: [
      'Complex façades and corner decks',
      'Sites exposed to changeable wind directions',
    ],
    notIdealFor: ['Narrow spaces where a single pitch saves height'],
    install: ['The current lead time and on-site sequence are confirmed in the project proposal after site and supplier checks'],
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
      'Integrated gutter and downpipe',
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
      'Integrated gutter and downpipe',
      'Durable powder‑coated finishes',
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
    install: ['The current lead time and on-site sequence are confirmed in the project proposal after site and supplier checks'],
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
        a: 'Yes—gutter and downpipe integrate within the perimeter for a tidy look.',
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
      'Durable exterior finishes and fixings',
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
    install: ['The current lead time and on-site sequence are confirmed for the selected screen system and measured openings'],
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
        a: 'Yes. Frames are compatible with both, so you can mix materials while keeping a consistent look.',
      },
    ],
  },
  'acrylic-infill-panels': {
    overview:
      'Acrylic infill panels can moderate exposed pergola edges while preserving views. Clear or softly tinted sheets sit within slim aluminium channels with isolation and movement details selected for the opening and site conditions.',
    atAGlance: [
      'Clear or tinted edge treatment with project-specific shelter effects',
      'Clear or tinted acrylic in slim frames',
      'Fixed, removable or sliding configurations',
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
      'Fixed, removable or sliding panel configurations',
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
      'Full thermal insulation—consider glazing or insulated panels instead',
    ],
    install: ['The current lead time and on-site sequence are confirmed for the selected panel system and measured openings'],
    maintenance: [
      'Cleaning follows the current written guidance for the exact acrylic sheet and frame finish',
    ],
    upgradePath: [
      'Pair with blinds for extra sun control',
      'Add heaters for winter use',
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
        a: 'Removable and sliding configurations are available so you can open up spaces when conditions allow.',
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
    install: ['The current lead time and on-site sequence are confirmed for the selected blind system and measured openings'],
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
