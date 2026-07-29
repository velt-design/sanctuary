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
    heading: 'Start your pergola brief.',
    subheading: 'Choose your project type, preferred roof and what you know about the site.',
    startCta: 'Start',
    skipCta: 'Continue your brief',
  },
  branch: {
    heading: 'Project type',
    options: [
      {
        value: 'residential' as const,
        label: 'Residential',
        description: 'A pergola for your home or residential property.',
      },
      {
        value: 'commercial' as const,
        label: 'Commercial',
        description: 'A pergola for a business, venue or shared site.',
      },
      {
        value: 'professional' as const,
        label: 'Professional',
        description: 'An architect, designer or builder enquiry.',
      },
    ],
  },
  roofStyle: {
    heading: 'Roof style',
    options: [
      {
        value: 'pitched' as const,
        label: 'Pitched',
        what: 'A single roof plane with one drainage direction.',
      },
      {
        value: 'gable' as const,
        label: 'Gable',
        what: 'A central ridge that adds height.',
      },
      {
        value: 'hip' as const,
        label: 'Hip',
        what: 'A roof that falls to several sides.',
      },
      {
        value: 'perimeter' as const,
        label: 'Box-perimeter',
        what: 'A level outer frame that hides the working roof fall.',
      },
      {
        value: 'unsure' as const,
        label: 'Not sure',
        what: "We'll recommend a form after reviewing your site.",
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
        description: 'A fixed roof that keeps daylight.',
      },
      {
        value: 'timber' as const,
        label: 'Timber',
        description: 'A solid roof with a timber ceiling.',
      },
      {
        value: 'combination' as const,
        label: 'Combination',
        description: 'Solid and acrylic zones in one roof.',
      },
      {
        value: 'unsure' as const,
        label: 'Not sure',
        description: "We'll recommend a material after reviewing your brief.",
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
    heading: 'Site details',
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
    heading: 'Consent review',
    disclaimer:
      "Consent depends on the final design and property. We'll identify the checks needed for your project.",
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
        description: 'Lower one edge for sun or privacy.',
      },
      {
        value: 'slats' as const,
        label: 'Slat screens',
        description: 'Fixed privacy with light between the slats.',
      },
      {
        value: 'acrylic_infills' as const,
        label: 'Acrylic infill panels',
        description: 'A transparent fixed edge.',
      },
      {
        value: 'downlights' as const,
        label: 'Downlights',
        description: 'Focused light for dining and circulation.',
      },
      {
        value: 'led_strips' as const,
        label: 'LED strip lighting',
        description: 'Concealed ambient light.',
      },
      {
        value: 'heaters' as const,
        label: 'Patio heaters',
        description: 'Targeted radiant heat for a seating area.',
      },
    ],
    noneLabel: 'No extras right now',
  },
  process: {
    heading: 'Timeframe',
    timeframeOptions: [
      { value: 'asap' as const, label: 'ASAP' },
      { value: 'one_to_three_months' as const, label: '1-3 months' },
      { value: 'three_to_six_months' as const, label: '3-6 months' },
      { value: 'researching' as const, label: 'Just researching' },
    ],
  },
  submit: {
    heading: 'Send your brief',
    supportingCopy: 'We will review it and contact you about the next step.',
  },
} as const;
