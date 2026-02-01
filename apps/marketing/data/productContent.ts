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
      'Lead time ~1–2 weeks • Install with pergola or retrofit by electrician',
    ],
    maintenance: [
      'Wipe trims periodically; expect long LED life with minimal upkeep',
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
      'Typical spacing ~1.2–1.8 m; circuits dimmable',
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
      'Lead time ~1–2 weeks • Install by licensed electrician',
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
      'Output ~1800–3200 W per unit; coverage ~6–12 m² in low wind',
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
      'A pitched pergola extends your roofline with a clean single‑slope canopy that moves rain away reliably while keeping headroom where you need it. It can also pitch toward the house and mount to soffits on engineered brackets so drainage uses your house gutter—this unlocks more head height and encourages natural ventilation under the canopy. The aluminium frame stays straight and low‑maintenance for NZ wind zones and coastal conditions.',
    atAGlance: [
      'Optional houseward pitch using soffit brackets',
      'Increased head height + better natural airflow',
      '99% UV block; acrylic tints cut heat ~30–70%',
      'Insulated panels with timber sarking available',
      'Acrylic skylight strips keep spaces bright',
    ],
    whyItsGood: [
      'Choose away‑from‑house or houseward fall to suit site',
      'Houseward pitch unlocks head height and improves convection',
      'Acrylic roofing blocks 99% UV; tints reduce heat ~30–70%',
      'Insulated panels with timber sarking look premium and cut heat significantly',
      'Mix in acrylic skylight strips to keep high daylight',
    ],
    structureMaterials: [
      'Powder‑coated aluminium beams, rafters and posts',
      'Roof sheets held in aluminium joiners sitting on long‑run butterfly rubber along each rafter for a clean soffit',
      'Engineered brackets and fixings suited to wind zone',
      'Integrated head/house flashing with movement allowance',
    ],
    options: [
      'Acrylic: Acrylic roofing—clear, light grey, dark grey, or opal (99% UV block; ~30–70% heat reduction depending on tint; opal keeps high daylight while reducing the most heat)',
      'Timber: Timber sarking gives a premium look with strong heat‑reduction qualities, creating a warm, comfortable outdoor space.',
      'Combination: Mixed roof combining insulated panels and acrylic skylight strips so spaces stay bright while the timber sarking adds a premium look and strong heat‑reduction qualities for a warm, comfortable outdoor space.',
    ],
    performance: [
      'Reliable fall for rain control; option to drain to house gutter',
      'High daylight levels; opal/tints curb heat and glare',
      'Acrylic blocks 99% UV; heat cut ~30–70% by tint selection',
      'Insulated panels further reduce heat and soften rain noise',
      'Strong, straight spans with low visual bulk; quiet, rattle‑free aluminium joiners on butterfly rubber',
    ],
    install: ['Lead time ~6–8 weeks • Install 2–5 days (houseward pitch subject to soffit/gutter assessment)'],
    maintenance: ['Hose down periodically • Check gutters/flashings annually'],
    upgradePath: [],
    bestPairedWith: [],
    faqs: [
      {
        q: 'Can we pitch the roof toward the house and use the existing gutter?',
        a: 'Yes. With engineered soffit brackets we can pitch to the house so water drains via the house gutter. This increases head height and improves natural airflow. Feasibility depends on soffit structure and gutter capacity.',
      },
      {
        q: 'How much heat is reduced with acrylic roofing?',
        a: 'Acrylic blocks 99% of UV and cuts heat by roughly 30–70% depending on tint. Opal maintains high daylight while reducing the most heat.',
      },
      {
        q: 'Can I combine insulated panels and skylights?',
        a: 'Yes. We can run acrylic skylight strips through insulated panels to keep the space bright while maximising shade and heat reduction.',
      },
      {
        q: 'Can posts move off corners?',
        a: 'Yes. Offset layouts preserve doors and paths while keeping structure efficient.',
      },
    ],
  },
  gable: {
    overview:
      'A gable pergola creates a tall, bright centrepiece with natural airflow through the ridge. It spans larger decks with ease and reads architectural without visual clutter—an aluminium frame that stays straight, finished to match your home.',
    atAGlance: [
      'Peaked roof for headroom and daylight',
      'Natural convection via open ridge line',
      'Strong, corrosion‑resistant aluminium frame',
      'Works well over large sliders and dining zones',
      'Lighting, blinds and gable infills available',
    ],
    howItWorks:
      'Two roof planes meet at a central ridge. Deep aluminium beams and engineered brackets carry loads to posts; roof sheets lock into aluminium joiners sitting on long‑run butterfly rubber along each rafter to manage drainage and movement. Clear, opal or tinted sheets tune light and glare.',
    whyItsGood: [
      'Feels taller and airier than a single pitch',
      'Handles gusty sites well with good structural depth',
      'Daylight‑rich; glare controlled with tint and blinds',
      'Clean, durable finish with minimal upkeep',
    ],
    structureMaterials: [
      'Powder‑coated aluminium beams, rafters and posts',
      'Engineered ridge and hip components',
      'Roof sheets held in aluminium joiners sitting on long‑run butterfly rubber along each rafter for tidy soffit and drainage',
      'Brackets and fixings specified to site wind zone',
    ],
    options: [
      'Acrylic: Acrylic roofing—clear, light grey, dark grey, or opal across both roof planes; 99% UV block with tints to tune heat and glare.',
      'Timber: Timber sarking roof panels give a warm, premium ceiling and strong heat‑reduction over dining and lounge zones.',
      'Combination: Combination roof using insulated timber sarking panels with acrylic skylight strips so the ridge stays bright while seating areas stay cooler.',
      'Gable infill: Open, slatted or acrylic infills at the gable ends to temper wind, frame views and help manage weather.',
    ],
    performance: [
      'Excellent headroom and perceived volume',
      'Natural ridge ventilation for warm‑weather comfort',
      'Stable in variable winds; low visual clutter',
      'Quiet, rattle‑free fastening via aluminium joiners on butterfly rubber',
    ],
    recommendedFor: [],
    notIdealFor: [],
    install: ['Lead time ~6–8 weeks • Install 2–5 days'],
    maintenance: ['Wash down periodically • Clear gutters and confirm downpipe flow'],
    upgradePath: [],
    bestPairedWith: [],
    indicativePerformance: [],
    faqs: [
      {
        q: 'Is a gable too bright?',
        a: 'Use opal or light tint to balance daylight and glare while keeping the space bright.',
      },
      {
        q: 'Can I keep views through the gable?',
        a: 'Yes. Open or clear acrylic infills maintain outlook while controlling wind and rain.',
      },
    ],
  },
  hip: {
    overview:
      'A hip pergola pitches down on all sides, wrapping the space neatly and managing wind at the corners. It integrates cleanly with complex rooflines and looks built‑in—premium and composed without fuss.',
    atAGlance: [
      'Four‑sided fall controls splash and runoff',
      'Better corner wind behaviour than a single pitch',
      'Powder‑coated aluminium frame with clean soffit',
      'Integrates well with complex façades',
      'Lighting and blinds options for comfort',
    ],
    howItWorks:
      'A central ridge and diagonal hips transfer loads to perimeter beams and posts. Custom flashings step roof sheets around hips while maintaining drainage. Posts can offset to suit doors and paths.',
    whyItsGood: [
      'All‑round fall sheds rain without splash zones',
      'Reduced wind eddies at corners',
      'Premium architectural silhouette with tidy soffit',
      'Strong, recyclable and coastal‑tolerant materials',
    ],
    structureMaterials: [
      'Four‑sided roof with ridge and hip beams',
      'Powder‑coated aluminium frame and posts',
      'Concealed brackets for clean lines',
      'Custom flashings around hips to manage water',
    ],
    options: [
      'Clear/opal/tinted roof mix to balance light and heat',
      'Post locations to open pathways and doors',
      'Integrated downlights and perimeter strip lighting',
      'Drop‑down blinds at prevailing wind faces',
    ],
    performance: [
      'All‑round fall controls splash and runoff',
      'Reduced wind eddies at corners',
      'Crisp, tidy soffit with concealed fixings',
      'Strong weathering for coastal NZ environments',
    ],
    recommendedFor: [
      'Complex façades and corner decks',
      'Sites exposed to changeable wind directions',
    ],
    notIdealFor: ['Narrow spaces where a single pitch saves height'],
    install: ['Lead time ~6–8 weeks • Install 3–4 days'],
    maintenance: ['Rinse frame/roof • Check gutters and hip junctions annually'],
    upgradePath: ['Add blinds/screens and heaters for shoulder seasons'],
    bestPairedWith: [
      'Mesh blinds at windward faces',
      'Downlights over seating; strip lighting around the perimeter',
    ],
    indicativePerformance: [
      'Typical bay ~2.7–4.2 m depending on exposure and layout',
      'Hip angles and sheet selection tuned to site',
    ],
    faqs: [
      {
        q: 'Is a hip darker than other roofs?',
        a: 'Daylight remains high; use a mix of clear/opal sheets to tune brightness and glare.',
      },
      {
        q: 'Can it meet complex walls and flashings?',
        a: 'Yes. Custom flashings step sheets cleanly around hips for a tidy, watertight junction.',
      },
    ],
  },
  'box-perimeter': {
    overview:
      'Box Perimeter frames your outdoor room with a crisp, architectural edge. A deep aluminium perimeter defines the silhouette while posts anchor the corners. Acrylic roofing keeps the space bright and dry—the louvre‑like look without motors.',
    atAGlance: [
      'Defined 300×50 mm perimeter edge',
      'Bold 150×150 mm corner posts',
      'Acrylic roof for high daylight',
      'Integrated gutter and downpipe',
      'Lighting and blinds fit discreetly',
    ],
    howItWorks:
      'A 300×50 mm aluminium perimeter carries the roof sheets within the frame. Gutters and downpipes integrate, and concealed fixings are used where feasible for a clean read. Corner posts provide stiffness and a deliberate stance.',
    whyItsGood: [
      'Crisp, contemporary silhouette with strong street presence',
      'Low‑maintenance compared to motorised louvres',
      'Bright by day; add tint/blinds to temper glare and heat',
      'Tidy junctions and integrated services',
    ],
    structureMaterials: [
      '300×50 mm aluminium perimeter frame',
      '150×150 mm aluminium posts',
      'Acrylic roof set into the frame',
      'Integrated gutter and downpipe',
      'Durable powder‑coated finishes',
    ],
    options: [
      'Clear or softly tinted acrylic sheets',
      'Concealed fixings where feasible',
      'Downlights within the perimeter',
      'Roller blinds for wind and privacy',
    ],
    performance: [
      'High daylight with manageable glare using tints',
      'Strong architectural definition and tidy junctions',
      'Moderate heat control—improve with tint and blinds',
      'Rain performance similar to standard acrylic roofs',
    ],
    recommendedFor: [
      'Street‑visible terraces and contemporary homes',
      'Clients wanting a louvre look without motors',
    ],
    notIdealFor: [
      'Sites needing acoustic damping or insulated panels',
      'Heritage façades that call for minimal visual change',
    ],
    install: ['Lead time ~6 weeks • Install 2–4 days'],
    maintenance: ['Rinse frame/roof • Clear gutters and confirm downpipe flow'],
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
      'Typical bay ~2.7–4.0 m depending on exposure and sheet spec',
      'Foundations and fixings engineered to wind zone',
    ],
    faqs: [
      {
        q: 'Will the frame look heavy?',
        a: 'The 300×50 profile reads crisp; choosing a colour that blends with the home reduces contrast.',
      },
      {
        q: 'Can gutters hide in the frame?',
        a: 'Yes—gutter and downpipe integrate within the perimeter for a tidy look.',
      },
    ],
  },
  'slat-screens': {
    overview:
      'Slat screens introduce privacy and wind tempering while keeping decks open and breathable. Panels are built on rigid aluminium frames and fixed with adjustable brackets between posts or pergola beams. Timber brings natural warmth; powder‑coated aluminium delivers a sharp, low‑maintenance look.',
    atAGlance: [
      'Adjustable privacy and wind tempering',
      'Timber or aluminium slats in several profiles',
      'Vertical, horizontal or mixed‑density layouts',
      'Gates and service panels integrate into the run',
      'Low‑maintenance aluminium or warm timber option',
    ],
    howItWorks:
      'Slats run vertically or horizontally at a pitch tuned to outlook and sun path. Lower sections can run denser to hide bins or services while upper sections stay lighter to keep views and light. Matching gates and removable panels use the same profiles so utilities disappear into the design.',
    whyItsGood: [
      'Creates human‑scale boundaries without heavy walls',
      'Softens views and hides bins, heat pumps and services',
      'Balances privacy, airflow and daylight',
      'Timber ages gracefully; aluminium stays crisp with a quick washdown',
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
      'Cuts wind and glare while retaining airflow',
      'Delivers privacy without building solid walls',
      'Durable, low‑maintenance aluminium option available',
    ],
    recommendedFor: [
      'Screening neighbours, bins and heat pumps',
      'Defining edges and backdrops to outdoor rooms',
    ],
    notIdealFor: [
      'Full weather blocking—choose acrylic panels or blinds instead',
    ],
    install: ['Lead time ~2–4 weeks • Install ~1 day'],
    maintenance: [
      'Aluminium: periodic washdown',
      'Timber: re‑oil or stain as required',
    ],
    upgradePath: [
      'Combine with blinds or acrylic panels for seasonal control',
    ],
    bestPairedWith: [
      'Drop‑down blinds on the open face',
      'Downlights for evening use',
    ],
    indicativePerformance: [
      'Typical panel width ~0.9–1.8 m based on profile and exposure',
      'Fixing method and post spacing confirmed at design',
    ],
    faqs: [
      {
        q: 'Will slats rattle?',
        a: 'Profiles and fixing methods are selected to avoid noise while allowing for movement in wind and temperature.',
      },
      {
        q: 'Can I mix timber and aluminium?',
        a: 'Yes. Frames are compatible with both, so you can mix materials while keeping a consistent look.',
      },
    ],
  },
  'acrylic-infill-panels': {
    overview:
      'Acrylic infill panels add year‑round usability by blocking wind and rain while preserving views. Clear or softly tinted sheets slot into slim aluminium channels with gasket isolation so they stay quiet and allow for thermal movement.',
    atAGlance: [
      'Near‑clear views with real weather protection',
      'Clear or tinted acrylic in slim frames',
      'Fixed, removable or sliding configurations',
      'Lighter and more economical than full glazing',
      'Pairs well with heaters and blinds',
    ],
    howItWorks:
      'Impact‑resistant acrylic is cut to size and captured in sealed aluminium frames. Discreet mullions control deflection and optional vent trims keep air moving where needed while maintaining shelter.',
    whyItsGood: [
      'Delivers shoulder‑season comfort without full glazing',
      'Keeps light transmission high while taming wind and rain',
      'Cleaning is simple and the result feels built‑in to the pergola',
    ],
    structureMaterials: [
      'Clear or tinted acrylic sheets in aluminium frames',
      'Gasket isolation for quiet, stress‑free mounting',
      'Discreet mullions sized to exposure and spans',
    ],
    options: [
      'Fixed, removable or sliding panel configurations',
      'Tint choices to balance privacy and heat',
      'Trickle vents for controlled air movement where required',
    ],
    performance: [
      'Significant wind and rain protection',
      'High light transmission with manageable glare using tint',
      'Lighter and more economical than full glazing',
    ],
    recommendedFor: [
      'Exposed faces of pergolas and decks',
      'View corridors where transparency matters',
    ],
    notIdealFor: [
      'Full thermal insulation—consider glazing or insulated panels instead',
    ],
    install: ['Lead time ~3–5 weeks • Install 1–2 days'],
    maintenance: [
      'Wash with mild soap and a soft cloth',
      'Avoid harsh solvents or abrasive cleaners',
    ],
    upgradePath: [
      'Pair with blinds for extra sun control',
      'Add heaters for winter use',
    ],
    bestPairedWith: [
      'Heaters for winter comfort',
      'Downlights for even light without glare',
    ],
    indicativePerformance: [
      'Typical clear panel ~1.0–1.5 m wide × ~2.0–2.4 m high depending on exposure',
      'Mullion spacing engineered to wind zone with concealed fixings where possible',
    ],
    faqs: [
      {
        q: 'Will panels yellow over time?',
        a: 'Quality exterior‑grade acrylic resists UV; regular cleaning with neutral pH soap keeps panels clear.',
      },
      {
        q: 'Can I remove panels seasonally?',
        a: 'Removable and sliding configurations are available so you can open up spaces when conditions allow.',
      },
    ],
  },
  'drop-down-blinds': {
    overview:
      'Drop‑down blinds give on‑demand control of wind and low sun. Fabrics range from clear PVC for weather blocking to open‑weave meshes that cut glare while keeping the view. Blinds run in side channels or stainless guides to stay steady in gusts.',
    atAGlance: [
      'On‑demand wind and low‑sun control',
      'Clear PVC or open‑weave meshes',
      'Side channels or guides keep blinds steady',
      'Colour‑matched components for a built‑in look',
    ],
    howItWorks:
      'A manual crank or motorised tube rolls the fabric into a compact headbox; side channels capture the edges and a weighted bottom bar seals to the deck. Motors can integrate with remotes, wall switches and wind sensors to protect the blind automatically.',
    whyItsGood: [
      'Tunes comfort instantly without permanent walls',
      'Maintains views while cutting wind and low sun',
      'Components colour‑match the pergola for a built‑in feel',
      'Fabrics are replaceable over time as needed',
    ],
    structureMaterials: [
      'Extruded aluminium headboxes, side channels or cable guides',
      'Clear PVC or mesh fabrics with welded hems',
      'Weighted bottom bars and sealed end caps',
    ],
    options: [
      'Manual crank or motorised operation (remote or wall switch)',
      'Wind sensors and group control for multiple blinds',
      'Fabric openness and colours to suit privacy and outlook',
    ],
    performance: [
      'Quick, adjustable protection from wind and low sun',
      'Stays steady in gusts with channels or guides',
      'Enhances warmth when paired with heaters',
    ],
    recommendedFor: [
      'West and north‑west faces and breezy edges',
      'Outdoor rooms needing flexible enclosure',
    ],
    notIdealFor: [
      'Full weather sealing—use acrylic panels if permanence is required',
    ],
    install: ['Lead time ~2–4 weeks • Install ~1 day'],
    maintenance: [
      'Hose down mesh; keep PVC clean',
      'Ensure PVC is fully dry before rolling',
    ],
    upgradePath: [
      'Integrate with lighting and heaters',
      'Add automation and scenes for convenience',
    ],
    bestPairedWith: [
      'Heaters for shoulder‑season warmth',
      'Downlights or strip lighting for night use',
    ],
    indicativePerformance: [
      'Max width ~3.0–5.0 m based on system and exposure',
      'Recommended wind limit set by manufacturer for side‑channel systems',
    ],
    faqs: [
      {
        q: 'Will mesh keep rain out?',
        a: 'Mesh reduces wind and spray; clear PVC blocks rain for more complete shelter.',
      },
      {
        q: 'Do motors need power on the pergola?',
        a: 'Yes. Motorised blinds require power supplied by a licensed electrician.',
      },
    ],
  },
};
