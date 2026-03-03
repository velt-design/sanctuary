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
    src: '/images/hero-1.jpg',
    alt: 'Residential pergola concept showing an outdoor dining area.',
  },
  commercial: {
    src: '/images/project-kiwi-rail-01.jpg',
    alt: 'Commercial pergola concept showing a hospitality terrace cover.',
  },
  professional: {
    src: '/images/project-atelier-shu-03.jpg',
    alt: 'Professional project concept showing architectural plans and details.',
  },
};

export const ROOF_STYLE_MEDIA: Record<RoofStyle, MediaEntry> = {
  pitched: {
    src: '/images/product-pitched-01.jpg',
    alt: 'Pitched pergola roof concept with a single-direction fall.',
  },
  gable: {
    src: '/images/product-gable-01.jpg',
    alt: 'Gable pergola roof concept with a centered ridge.',
  },
  hip: {
    src: '/images/product-hip-01.jpg',
    alt: 'Hip pergola roof concept with falls on all sides.',
  },
  perimeter: {
    src: '/images/product-perimeter-01.jpg',
    alt: 'Box-perimeter pergola roof concept with a flat visual line.',
  },
  unsure: {
    src: '/images/project-unknown-01.jpg',
    alt: 'Placeholder style card representing an unsure option.',
  },
};

export const ROOF_MATERIAL_MEDIA: Record<RoofMaterialChoice, MediaEntry> = {
  acrylic: {
    src: '/images/product-pitched-02.jpg',
    alt: 'Acrylic roof panel concept with bright natural light.',
  },
  timber: {
    src: '/images/product-timber.jpg',
    alt: 'Timber-lined roof concept with warm ceiling finish.',
  },
  combination: {
    src: '/images/project-atelier-shu-01.jpg',
    alt: 'Combination roof concept with timber and acrylic skylight strips.',
  },
  unsure: {
    src: '/images/hero-2.jpg',
    alt: 'Placeholder material card representing a not sure option.',
  },
};

export const ACRYLIC_TINT_MEDIA: Record<AcrylicTint, MediaEntry> = {
  clear: {
    src: '/images/product-pitched-03.jpg',
    alt: 'Clear acrylic tint swatch.',
  },
  light_grey: {
    src: '/images/product-pitched-04.jpg',
    alt: 'Light grey acrylic tint swatch.',
  },
  dark_grey: {
    src: '/images/product-pitched-05.jpg',
    alt: 'Dark grey acrylic tint swatch.',
  },
  opal: {
    src: '/images/product-pitched-06.jpg',
    alt: 'Opal acrylic tint swatch.',
  },
  not_sure: {
    src: '/images/hero-2.jpg',
    alt: 'Not sure acrylic tint placeholder swatch.',
  },
};

export const TIMBER_FINISH_MEDIA: Record<TimberFinish, MediaEntry> = {
  natural: {
    src: '/images/product-timber.jpg',
    alt: 'Natural timber finish swatch.',
  },
  stained: {
    src: '/images/project-goodhome-01.jpg',
    alt: 'Stained timber finish swatch.',
  },
  painted: {
    src: '/images/project-goodhome-02.jpg',
    alt: 'Painted timber finish swatch.',
  },
  not_sure: {
    src: '/images/project-goodhome-03.jpg',
    alt: 'Not sure timber finish placeholder swatch.',
  },
};

export const INSTALL_SURFACE_MEDIA: Record<InstallSurface, MediaEntry> = {
  deck: {
    src: '/images/project-westmere-01.jpg',
    alt: 'Deck installation surface illustration.',
  },
  concrete_pad: {
    src: '/images/project-kiwi-rail-02.jpg',
    alt: 'Concrete pad installation surface illustration.',
  },
  pavers: {
    src: '/images/project-goodhome-04.jpg',
    alt: 'Pavers installation surface illustration.',
  },
  ground_garden: {
    src: '/images/project-waiheke-01.jpg',
    alt: 'Ground or garden installation surface illustration.',
  },
  not_sure: {
    src: '/images/project-unknown-01.jpg',
    alt: 'Placeholder installation surface illustration for not sure.',
  },
};

export const SITE_LEVEL_MEDIA: Record<SiteLevel, MediaEntry> = {
  ground: {
    src: '/images/project-new-windsor-01.jpg',
    alt: 'Ground-level site illustration.',
  },
  first: {
    src: '/images/project-new-windsor-02.jpg',
    alt: 'First-storey level site illustration.',
  },
  second_plus: {
    src: '/images/project-st-heliers-01.jpg',
    alt: 'Second-storey or above site illustration.',
  },
  not_sure: {
    src: '/images/project-st-heliers-02.jpg',
    alt: 'Not sure level placeholder illustration.',
  },
};

export const SITE_ATTACHMENT_MEDIA: Record<SiteAttachment, MediaEntry> = {
  attached: {
    src: '/images/project-asquith-ave-01.jpg',
    alt: 'Attached pergola illustration connected to existing building.',
  },
  freestanding: {
    src: '/images/project-asquith-ave-02.jpg',
    alt: 'Freestanding pergola illustration separate from existing building.',
  },
  not_sure: {
    src: '/images/project-warkworth-01.jpg',
    alt: 'Not sure attachment placeholder illustration.',
  },
};

export const PUBLIC_ACCESS_MEDIA: Record<PublicAccess, MediaEntry> = {
  yes: {
    src: '/images/project-kiwi-rail-03.jpg',
    alt: 'Public access yes illustration.',
  },
  no: {
    src: '/images/project-tindalls-bay.jpg',
    alt: 'Public access no illustration.',
  },
  not_sure: {
    src: '/images/project-unknown-01.jpg',
    alt: 'Public access not sure placeholder illustration.',
  },
};

export const EXTRA_MEDIA: Record<ExtraId, MediaEntry> = {
  blinds: {
    src: '/images/product-blinds-01.jpg',
    alt: 'Drop-down blinds option image.',
  },
  slats: {
    src: '/images/product-slat-01.JPG',
    alt: 'Slat screens option image.',
  },
  acrylic_infills: {
    src: '/images/product-infill-01.jpg',
    alt: 'Acrylic infill panels option image.',
  },
  downlights: {
    src: '/images/product-downlight-01.jpg',
    alt: 'Downlights option image.',
  },
  led_strips: {
    src: '/images/product-downlight-02.jpg',
    alt: 'LED strip lighting option image.',
  },
  heaters: {
    src: '/images/product-blinds-02.jpg',
    alt: 'Patio heaters option image.',
  },
};

export const TIMEFRAME_MEDIA: Record<Timeframe, MediaEntry> = {
  asap: {
    src: '/images/project-dukeson-change-name-01.jpg',
    alt: 'ASAP timeframe card image.',
  },
  one_to_three_months: {
    src: '/images/project-dukeson-change-name-02.jpg',
    alt: '1-3 months timeframe card image.',
  },
  three_to_six_months: {
    src: '/images/project-velskov-01.jpg',
    alt: '3-6 months timeframe card image.',
  },
  researching: {
    src: '/images/project-velskov-02.jpg',
    alt: 'Researching timeframe card image.',
  },
};
