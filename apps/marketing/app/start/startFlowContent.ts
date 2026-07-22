export const START_FLOW_SCHEMA_VERSION = 'start-flow-v2';

export type EnquiryType = 'residential' | 'commercial' | 'professional';
export type RoofStyle = 'pitched' | 'gable' | 'hip' | 'perimeter' | 'unsure';
export type RoofMaterialChoice = 'acrylic' | 'timber' | 'combination' | 'unsure';
export type AcrylicTint = 'clear' | 'light_grey' | 'dark_grey' | 'opal' | 'not_sure';
export type AcrylicLightFeel = 'clear' | 'opal' | 'tinted' | 'not_sure';
export type DaylightPlacement = 'circulation' | 'seating' | 'balanced' | 'not_sure';
export type WaterDirectionPreference = 'away_from_house' | 'toward_house' | 'not_sure';
export type TimberFinish = 'natural' | 'stained' | 'painted' | 'not_sure';
export type InstallSurface = 'deck' | 'concrete_pad' | 'pavers' | 'ground_garden' | 'not_sure';
export type SiteLevel = 'ground' | 'first' | 'second_plus' | 'not_sure';
export type SiteAttachment = 'attached' | 'freestanding' | 'not_sure';
export type PublicAccess = 'yes' | 'no' | 'not_sure';
export type Timeframe = 'asap' | 'one_to_three_months' | 'three_to_six_months' | 'researching';
export type ExtraId = 'blinds' | 'slats' | 'acrylic_infills' | 'downlights' | 'led_strips' | 'heaters';

export const roofMaterialsByChoice: Record<RoofMaterialChoice, string[]> = {
  acrylic: ['acrylic'],
  timber: ['timber'],
  combination: ['acrylic', 'timber'],
  unsure: [],
};

export type StartFlowDraft = {
  enquiryType: EnquiryType;
  style: RoofStyle | null;
  roofMaterialChoice: RoofMaterialChoice | null;
  roofMaterials: string[];
  acrylicTint: AcrylicTint | null;
  acrylicLightFeel: AcrylicLightFeel | null;
  timberFinish: TimberFinish | null;
  daylightPlacement: DaylightPlacement | null;
  waterDirectionPreference: WaterDirectionPreference | null;
  suburb: string;
  site: {
    installSurface: InstallSurface | null;
    level: SiteLevel | null;
    attachment: SiteAttachment | null;
    publicAccess: PublicAccess | null;
  };
  dimensions: {
    widthM: string;
    depthM: string;
    heightM: string;
  };
  extras: Record<ExtraId, boolean>;
  extrasAcknowledged: boolean;
  timeframe: Timeframe | null;
  name: string;
  phone: string;
  email: string;
  message: string;
};

export const defaultStartFlowDraft: StartFlowDraft = {
  enquiryType: 'residential',
  style: null,
  roofMaterialChoice: null,
  roofMaterials: [],
  acrylicTint: null,
  acrylicLightFeel: null,
  timberFinish: null,
  daylightPlacement: null,
  waterDirectionPreference: null,
  suburb: '',
  site: {
    installSurface: null,
    level: null,
    attachment: null,
    publicAccess: null,
  },
  dimensions: {
    widthM: '',
    depthM: '',
    heightM: '',
  },
  extras: {
    blinds: false,
    slats: false,
    acrylic_infills: false,
    downlights: false,
    led_strips: false,
    heaters: false,
  },
  extrasAcknowledged: false,
  timeframe: null,
  name: '',
  phone: '',
  email: '',
  message: '',
};

export const startFlowContent = {
  hero: {
    heading: 'Design your pergola consultation in 3 minutes.',
    subheading:
      'Choose style and materials, check consent basics, then book a Design Consultation.',
    startCta: 'Start the guide',
    skipCta: 'Jump to consultation booking',
  },
  branch: {
    heading: 'Choose your path',
    options: [
      {
        value: 'residential' as const,
        label: 'Residential',
        description:
          'Make an outdoor room that feels built-in - light, shade, warmth, and weather protection.',
      },
      {
        value: 'commercial' as const,
        label: 'Commercial',
        description:
          'Create a durable, compliant cover for customers and staff - built for NZ wind and heavy use.',
      },
      {
        value: 'professional' as const,
        label: 'Professional',
        description:
          'Specification-friendly pergolas: details, drawings, coordination, and engineering support.',
      },
    ],
  },
  roofStyle: {
    heading: 'Roof style',
    options: [
      {
        value: 'pitched' as const,
        label: 'Pitched',
        what: 'One clean fall for reliable drainage and a crisp roofline.',
        bestWhen: ['Narrow spaces', 'You want head height', 'Simple drainage'],
        watchOut: 'Needs correct fall and gutter strategy.',
      },
      {
        value: 'gable' as const,
        label: 'Gable',
        what: 'Peaked roof for headroom, daylight, and airflow at the ridge.',
        bestWhen: ['Larger decks', 'You want a centrepiece', 'Ventilation matters'],
        watchOut: 'Can feel bright, so tint or blinds can help.',
      },
      {
        value: 'hip' as const,
        label: 'Hip',
        what: 'Falls on all sides for tidy edges and better corner wind behaviour.',
        bestWhen: ['Corner decks', 'Complex facades', 'Exposed wind directions'],
        watchOut: 'Slightly more complexity in flashings.',
      },
      {
        value: 'perimeter' as const,
        label: 'Box-perimeter',
        what: 'Minimal, modern look with clean perimeter lines.',
        bestWhen: ['Modern architecture', 'Flat visual profile', 'Tight eaves lines'],
        watchOut: 'Drainage and detailing must be well set out.',
      },
      {
        value: 'unsure' as const,
        label: 'Not sure',
        what: "We'll recommend a style after a quick look at your photos and roofline.",
        bestWhen: ['You want guidance', 'Your roofline is complex'],
        watchOut: 'A Design Consultation is often needed to confirm details.',
      },
    ],
    waterDirectionOptions: [
      { value: 'away_from_house' as const, label: 'Away from house' },
      { value: 'toward_house' as const, label: 'Toward house (into gutter)' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
  },
  roofMaterial: {
    heading: 'Roofing material',
    options: [
      {
        value: 'acrylic' as const,
        label: 'Acrylic',
        description: 'Create a fixed overhead roof with a clear, opal or tinted daylight character.',
      },
      {
        value: 'timber' as const,
        label: 'Timber',
        description: 'A warm ceiling feel that reads like an interior extension.',
      },
      {
        value: 'combination' as const,
        label: 'Combination',
        description: 'Shade where you sit, skylight where you need daylight.',
      },
      {
        value: 'unsure' as const,
        label: 'Not sure',
        description: 'We can recommend the best fit after reviewing your brief and photos.',
      },
    ],
    acrylicTintOptions: [
      { value: 'clear' as const, label: 'Clear' },
      { value: 'light_grey' as const, label: 'Light grey' },
      { value: 'dark_grey' as const, label: 'Dark grey' },
      { value: 'opal' as const, label: 'Opal' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
    acrylicLightFeelOptions: [
      { value: 'clear' as const, label: 'Clear' },
      { value: 'opal' as const, label: 'Opal' },
      { value: 'tinted' as const, label: 'Tinted' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
    timberFinishOptions: [
      { value: 'natural' as const, label: 'Natural' },
      { value: 'stained' as const, label: 'Stained' },
      { value: 'painted' as const, label: 'Painted' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
    daylightPlacementOptions: [
      { value: 'circulation' as const, label: 'Skylight strip(s) over circulation' },
      { value: 'seating' as const, label: 'Skylight strip(s) over seating' },
      { value: 'balanced' as const, label: 'Balanced / not sure' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
  },
  site: {
    heading: 'Your site in 60 seconds',
    measureHelp: 'How to measure: round to the nearest 0.1m.',
    installSurfaceOptions: [
      { value: 'deck' as const, label: 'Deck' },
      { value: 'concrete_pad' as const, label: 'Concrete pad' },
      { value: 'pavers' as const, label: 'Pavers' },
      { value: 'ground_garden' as const, label: 'Ground / garden' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
    levelOptions: [
      { value: 'ground' as const, label: 'Ground level' },
      { value: 'first' as const, label: 'First-storey level' },
      { value: 'second_plus' as const, label: 'Second-storey or above' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
    attachmentOptions: [
      { value: 'attached' as const, label: 'Attached' },
      { value: 'freestanding' as const, label: 'Freestanding' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
    publicAccessOptions: [
      { value: 'yes' as const, label: 'Yes' },
      { value: 'no' as const, label: 'No' },
      { value: 'not_sure' as const, label: 'Not sure' },
    ],
  },
  consent: {
    heading: 'Building consent exemption quick-check',
    disclaimer:
      'This quick check is general guidance only. Council interpretation, site conditions, and overlays or precincts can change requirements.',
    links: [
      {
        label: 'Official building guidance',
        href: 'https://www.building.govt.nz/',
      },
      {
        label: 'Auckland Council consent guidance',
        href: 'https://www.aucklandcouncil.govt.nz/building-and-consents/building-consents/Pages/check-if-you-need-consent.aspx',
      },
      {
        label: 'NZ legislation',
        href: 'https://www.legislation.govt.nz/',
      },
    ],
  },
  extras: {
    heading: 'Extras',
    options: [
      {
        value: 'blinds' as const,
        label: 'Drop-down blinds',
        description: 'On-demand wind, rain, and low-sun control.',
      },
      {
        value: 'slats' as const,
        label: 'Slat screens',
        description: 'Privacy and wind filtering without closing the space.',
      },
      {
        value: 'acrylic_infills' as const,
        label: 'Acrylic infill panels',
        description: 'Block wind and rain while keeping views.',
      },
      {
        value: 'downlights' as const,
        label: 'Downlights',
        description: 'Even lighting over dining and task zones.',
      },
      {
        value: 'led_strips' as const,
        label: 'LED strip lighting',
        description: 'Soft perimeter glow and safer edges.',
      },
      {
        value: 'heaters' as const,
        label: 'Patio heaters',
        description: 'Targeted warmth for shoulder seasons.',
      },
    ],
    noneLabel: 'No extras right now',
  },
  process: {
    heading: 'From design to build',
    timeline: [
      'Enquiry',
      'Design Consultation',
      'On-site design review',
      'Design sign-off',
      'Deposit and scheduling',
      'On-site build',
      'Completion',
    ],
    timeframeOptions: [
      { value: 'asap' as const, label: 'ASAP' },
      { value: 'one_to_three_months' as const, label: '1-3 months' },
      { value: 'three_to_six_months' as const, label: '3-6 months' },
      { value: 'researching' as const, label: 'Just researching' },
    ],
  },
  submit: {
    heading: 'Send your brief',
    supportingCopy:
      "Sprint 3 will wire this section to submit directly to /api/enquiry with validation, summary append, and success state.",
  },
} as const;
