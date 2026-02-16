import type {
  AcrylicTint,
  EnquiryType,
  ExtraId,
  InstallSurface,
  PublicAccess,
  RoofMaterialChoice,
  RoofStyle,
  SiteAttachment,
  SiteLevel,
  Timeframe,
  TimberFinish,
} from './startFlowContent';

export type MediaEntry = {
  src: string;
  alt: string;
};

export const BRANCH_MEDIA: Record<EnquiryType, MediaEntry> = {
  residential: {
    src: '/start/branch-residential.svg',
    alt: 'Residential pergola concept showing an outdoor dining area.',
  },
  commercial: {
    src: '/start/branch-commercial.svg',
    alt: 'Commercial pergola concept showing a hospitality terrace cover.',
  },
  professional: {
    src: '/start/branch-professional.svg',
    alt: 'Professional project concept showing architectural plans and details.',
  },
};

export const ROOF_STYLE_MEDIA: Record<RoofStyle, MediaEntry> = {
  pitched: {
    src: '/start/style-pitched.svg',
    alt: 'Pitched pergola roof concept with a single-direction fall.',
  },
  gable: {
    src: '/start/style-gable.svg',
    alt: 'Gable pergola roof concept with a centered ridge.',
  },
  hip: {
    src: '/start/style-hip.svg',
    alt: 'Hip pergola roof concept with falls on all sides.',
  },
  perimeter: {
    src: '/start/style-perimeter.svg',
    alt: 'Box-perimeter pergola roof concept with a flat visual line.',
  },
  unsure: {
    src: '/start/style-unsure.svg',
    alt: 'Placeholder style card representing an unsure option.',
  },
};

export const ROOF_MATERIAL_MEDIA: Record<RoofMaterialChoice, MediaEntry> = {
  acrylic: {
    src: '/start/material-acrylic.svg',
    alt: 'Acrylic roof panel concept with bright natural light.',
  },
  timber: {
    src: '/start/material-timber.svg',
    alt: 'Timber-lined roof concept with warm ceiling finish.',
  },
  combination: {
    src: '/start/material-combination.svg',
    alt: 'Combination roof concept with timber and acrylic skylight strips.',
  },
  unsure: {
    src: '/start/material-unsure.svg',
    alt: 'Placeholder material card representing a not sure option.',
  },
};

export const ACRYLIC_TINT_MEDIA: Record<AcrylicTint, MediaEntry> = {
  clear: {
    src: '/start/swatch-clear.svg',
    alt: 'Clear acrylic tint swatch.',
  },
  light_grey: {
    src: '/start/swatch-light-grey.svg',
    alt: 'Light grey acrylic tint swatch.',
  },
  dark_grey: {
    src: '/start/swatch-dark-grey.svg',
    alt: 'Dark grey acrylic tint swatch.',
  },
  opal: {
    src: '/start/swatch-opal.svg',
    alt: 'Opal acrylic tint swatch.',
  },
  not_sure: {
    src: '/start/swatch-not-sure.svg',
    alt: 'Not sure acrylic tint placeholder swatch.',
  },
};

export const TIMBER_FINISH_MEDIA: Record<TimberFinish, MediaEntry> = {
  natural: {
    src: '/start/finish-natural.svg',
    alt: 'Natural timber finish swatch.',
  },
  stained: {
    src: '/start/finish-stained.svg',
    alt: 'Stained timber finish swatch.',
  },
  painted: {
    src: '/start/finish-painted.svg',
    alt: 'Painted timber finish swatch.',
  },
  not_sure: {
    src: '/start/finish-not-sure.svg',
    alt: 'Not sure timber finish placeholder swatch.',
  },
};

export const INSTALL_SURFACE_MEDIA: Record<InstallSurface, MediaEntry> = {
  deck: {
    src: '/start/site-deck.svg',
    alt: 'Deck installation surface illustration.',
  },
  concrete_pad: {
    src: '/start/site-concrete-pad.svg',
    alt: 'Concrete pad installation surface illustration.',
  },
  pavers: {
    src: '/start/site-pavers.svg',
    alt: 'Pavers installation surface illustration.',
  },
  ground_garden: {
    src: '/start/site-ground-garden.svg',
    alt: 'Ground or garden installation surface illustration.',
  },
  not_sure: {
    src: '/start/site-not-sure.svg',
    alt: 'Placeholder installation surface illustration for not sure.',
  },
};

export const SITE_LEVEL_MEDIA: Record<SiteLevel, MediaEntry> = {
  ground: {
    src: '/start/level-ground.svg',
    alt: 'Ground-level site illustration.',
  },
  first: {
    src: '/start/level-first.svg',
    alt: 'First-storey level site illustration.',
  },
  second_plus: {
    src: '/start/level-second-plus.svg',
    alt: 'Second-storey or above site illustration.',
  },
  not_sure: {
    src: '/start/level-not-sure.svg',
    alt: 'Not sure level placeholder illustration.',
  },
};

export const SITE_ATTACHMENT_MEDIA: Record<SiteAttachment, MediaEntry> = {
  attached: {
    src: '/start/attachment-attached.svg',
    alt: 'Attached pergola illustration connected to existing building.',
  },
  freestanding: {
    src: '/start/attachment-freestanding.svg',
    alt: 'Freestanding pergola illustration separate from existing building.',
  },
  not_sure: {
    src: '/start/attachment-not-sure.svg',
    alt: 'Not sure attachment placeholder illustration.',
  },
};

export const PUBLIC_ACCESS_MEDIA: Record<PublicAccess, MediaEntry> = {
  yes: {
    src: '/start/access-yes.svg',
    alt: 'Public access yes illustration.',
  },
  no: {
    src: '/start/access-no.svg',
    alt: 'Public access no illustration.',
  },
  not_sure: {
    src: '/start/access-not-sure.svg',
    alt: 'Public access not sure placeholder illustration.',
  },
};

export const EXTRA_MEDIA: Record<ExtraId, MediaEntry> = {
  blinds: {
    src: '/start/extra-blinds.svg',
    alt: 'Drop-down blinds option image.',
  },
  slats: {
    src: '/start/extra-slats.svg',
    alt: 'Slat screens option image.',
  },
  acrylic_infills: {
    src: '/start/extra-acrylic-infills.svg',
    alt: 'Acrylic infill panels option image.',
  },
  downlights: {
    src: '/start/extra-downlights.svg',
    alt: 'Downlights option image.',
  },
  led_strips: {
    src: '/start/extra-led-strips.svg',
    alt: 'LED strip lighting option image.',
  },
  heaters: {
    src: '/start/extra-heaters.svg',
    alt: 'Patio heaters option image.',
  },
};

export const TIMEFRAME_MEDIA: Record<Timeframe, MediaEntry> = {
  asap: {
    src: '/start/timeframe-asap.svg',
    alt: 'ASAP timeframe card image.',
  },
  one_to_three_months: {
    src: '/start/timeframe-one-three.svg',
    alt: '1-3 months timeframe card image.',
  },
  three_to_six_months: {
    src: '/start/timeframe-three-six.svg',
    alt: '3-6 months timeframe card image.',
  },
  researching: {
    src: '/start/timeframe-researching.svg',
    alt: 'Researching timeframe card image.',
  },
};
