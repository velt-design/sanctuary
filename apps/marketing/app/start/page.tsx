'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dispatchStartModalVisibility, setStartModalOpenClass } from '@/lib/startModalBridge';
import {
  START_FLOW_SCHEMA_VERSION,
  defaultStartFlowDraft,
  roofMaterialsByChoice,
  startFlowContent,
  type AcrylicLightFeel,
  type DaylightPlacement,
  type EnquiryType,
  type ExtraId,
  type InstallSurface,
  type PublicAccess,
  type RoofMaterialChoice,
  type RoofStyle,
  type SiteAttachment,
  type SiteLevel,
  type StartFlowDraft,
  type Timeframe,
  type TimberFinish,
  type WaterDirectionPreference,
} from './startFlowContent';
import { evaluateConsentQuickCheck } from './consentChecker';
import {
  DEFAULT_CONFIRMED_STEP_STATE,
  clearStartFlowDraft,
  readStartFlowState,
  writeStartFlowState,
  type ConfirmedStepState,
  type StartFlowPersistedState,
} from './startFlowStorage';
import {
  BRANCH_MEDIA,
  EXTRA_MEDIA,
  INSTALL_SURFACE_MEDIA,
  PUBLIC_ACCESS_MEDIA,
  ROOF_MATERIAL_MEDIA,
  ROOF_STYLE_MEDIA,
  SITE_ATTACHMENT_MEDIA,
  SITE_LEVEL_MEDIA,
  TIMEFRAME_MEDIA,
} from './startFlowMedia';
import {
  ConditionalSubPanel,
  ConsentResultCard,
  ExtrasExplorerModal,
  ModalSurface,
  OptionCardGroup,
  StepSection,
  TabbedOptionModal,
  type ExtrasExplorerOption,
  type OptionCardOption,
  type TabbedModalOption,
} from './startFlowComponents';

type SectionId =
  | 'hero'
  | 'branch'
  | 'roofStyle'
  | 'roofMaterial'
  | 'site'
  | 'consent'
  | 'extras'
  | 'process'
  | 'submit';

type StepId = Exclude<SectionId, 'hero'>;
type ConfirmableStepId = Exclude<StepId, 'submit'>;
type ModalId = 'branch' | 'roofStyle' | 'roofMaterial' | 'extras' | 'process' | null;

type SubmitState = 'idle' | 'sending' | 'success' | 'error';
type SubmitMeta = {
  contactId?: string;
  projectId?: string;
  enquiryRequestId?: string;
};

type FlowState = StartFlowPersistedState;

type BriefRow = {
  label: string;
  value: string;
  step: ConfirmableStepId;
};

const STEP_ORDER: StepId[] = ['branch', 'roofStyle', 'roofMaterial', 'site', 'consent', 'extras', 'process', 'submit'];
const NEXT_SECTION: Record<ConfirmableStepId, StepId | null> = {
  branch: 'roofStyle',
  roofStyle: 'roofMaterial',
  roofMaterial: 'site',
  site: 'consent',
  consent: 'extras',
  extras: 'process',
  process: 'submit',
};

const MAX_MESSAGE_LENGTH = 4000;
const MAX_PHOTO_COUNT = 8;

const BRANCH_GUIDE: Record<
  EnquiryType,
  {
    bestFor: string[];
    consider: string[];
    worksWellWith: string[];
    microEducation: string;
    exampleUseCase: string;
  }
> = {
  residential: {
    bestFor: ['Outdoor family dining', 'Weather cover with light', 'Projects under active renovation'],
    consider: ['Confirm sun direction early', 'Decide if privacy control is needed'],
    worksWellWith: ['Acrylic roof', 'Drop-down blinds', 'Warm lighting'],
    microEducation: 'Clients like you usually start here when the goal is a true outdoor room, not just shade.',
    exampleUseCase:
      'A family renovating their rear deck chooses this path to compare roof style, glazing, and privacy extras before locking a consultation brief.',
  },
  commercial: {
    bestFor: ['Customer seating zones', 'Staff shelter areas', 'Public-facing hospitality'],
    consider: ['Durability and cleaning cycles', 'Public circulation around the structure'],
    worksWellWith: ['Timber + acrylic mix', 'Heaters', 'Lighting'],
    microEducation: 'Commercial briefs tend to benefit from early compliance and circulation checks.',
    exampleUseCase:
      'A cafe owner planning year-round seating uses this path to align durability, lighting, and consent considerations in one guided shortlist.',
  },
  professional: {
    bestFor: ['Architect-led projects', 'Developer coordination', 'Documentation-first workflows'],
    consider: ['Lead time for engineering', 'Detail sign-off sequence'],
    worksWellWith: ['Material pairing studies', 'Consent pathway review', 'Program staging'],
    microEducation: 'Design teams usually choose this path when they want detail-first collaboration.',
    exampleUseCase:
      'An architect preparing early concept options uses this path to set style and material intent before a coordinated Design Consultation.',
  },
};

const ROOF_STYLE_PAIRINGS: Record<RoofStyle, string[]> = {
  pitched: ['Acrylic clear', 'Downlights'],
  gable: ['Acrylic opal', 'Drop-down blinds'],
  hip: ['Timber lining', 'Slat screens'],
  perimeter: ['Combination roof', 'LED strip lighting'],
  unsure: ['Design Consultation', 'Photo-led recommendation'],
};

const ROOF_STYLE_EXAMPLE_USE_CASE: Record<RoofStyle, string> = {
  pitched: 'A compact courtyard project selects pitched to keep drainage simple while preserving head height along the house edge.',
  gable: 'A wide entertainment deck selects gable to create a brighter, taller centre line with balanced airflow.',
  hip: 'An exposed corner site selects hip to soften wind behavior and keep the roof expression tidy from all sides.',
  perimeter: 'A modern extension selects box-perimeter for a clean architectural edge while coordinating drainage in detailed design.',
  unsure: 'A homeowner uploads reference photos and keeps this tab active while Sanctuary recommends a style in consultation.',
};

const ROOF_MATERIAL_GUIDE: Record<
  RoofMaterialChoice,
  {
    bestFor: string[];
    consider: string[];
    worksWellWith: string[];
    microEducation: string;
    exampleUseCase: string;
  }
> = {
  acrylic: {
    bestFor: ['Keeping the area bright', 'Weather protection without closing in'],
    consider: ['Summer glare control', 'Tint choice for comfort'],
    worksWellWith: ['Drop-down blinds', 'Downlights'],
    microEducation: 'Acrylic is often selected where natural light is the highest priority.',
    exampleUseCase:
      'A north-facing dining zone uses acrylic with tint review to keep daylight while controlling glare in summer afternoons.',
  },
  timber: {
    bestFor: ['Warm ceiling finish', 'Architectural integration with interiors'],
    consider: ['Finish maintenance over time', 'Lighting integration detail'],
    worksWellWith: ['LED strips', 'Heaters'],
    microEducation: 'Timber is common when the pergola is treated as an extension of the home.',
    exampleUseCase:
      'A renovation project extends interior materials outdoors, using timber lining and integrated lighting for an all-season room feel.',
  },
  combination: {
    bestFor: ['Targeted daylight zones', 'Balanced shade and brightness'],
    consider: ['Panel layout planning', 'Transition detailing between materials'],
    worksWellWith: ['Skylight strips', 'Slat screens'],
    microEducation: 'Combination layouts are frequently chosen to tune comfort by zone.',
    exampleUseCase:
      'A long outdoor room uses combination roofing with daylight strips over circulation and denser shade above seating.',
  },
  unsure: {
    bestFor: ['Early-stage planning', 'Projects awaiting photos or orientation review'],
    consider: ['Comfort priorities first', 'How you use the area day to day'],
    worksWellWith: ['Roof style guidance', 'Design Consultation'],
    microEducation: 'Not sure is a valid choice while you compare light, warmth, and maintenance tradeoffs.',
    exampleUseCase:
      'A homeowner still comparing comfort priorities keeps this as draft while reviewing examples and confirming direction later.',
  },
};

const TIMEFRAME_GUIDE: Record<
  Timeframe,
  {
    summary: string;
    bestFor: string[];
    consider: string[];
    worksWellWith: string[];
    microEducation: string;
    exampleUseCase: string;
  }
> = {
  asap: {
    summary: 'Prioritise earliest possible consultation and scheduling windows.',
    bestFor: ['Time-sensitive property updates', 'Upcoming events'],
    consider: ['Approvals may still affect dates'],
    worksWellWith: ['Fast photo sharing', 'Early design lock'],
    microEducation: 'ASAP briefs move fastest when site photos and measurements are ready before consultation.',
    exampleUseCase:
      'A family planning a near-term event selects ASAP and confirms dimensions early so design and scheduling can be prioritized.',
  },
  one_to_three_months: {
    summary: 'Ideal for projects moving this season with a short planning runway.',
    bestFor: ['Active renovation stages', 'Committed projects'],
    consider: ['Finalize material choices early'],
    worksWellWith: ['Design Consultation', 'Site information readiness'],
    microEducation: 'This window usually benefits from locking roof direction and extras in the first consultation.',
    exampleUseCase:
      'A renovation already underway selects this timeframe to align pergola detailing with other contractors on site.',
  },
  three_to_six_months: {
    summary: 'Balanced planning window for design detail and installation preparation.',
    bestFor: ['Staged home upgrades', 'Commercial program alignment'],
    consider: ['Coordinate with other trades'],
    worksWellWith: ['Detailed specifications', 'Engineering coordination'],
    microEducation: 'Three-to-six month plans typically allow the cleanest sequencing for design, approvals, and build booking.',
    exampleUseCase:
      'A staged property upgrade chooses this window to coordinate consent, structural checks, and installation sequencing.',
  },
  researching: {
    summary: 'Best when you are gathering options before choosing a direction.',
    bestFor: ['Early exploration', 'Budget and layout discovery'],
    consider: ['Save references you like'],
    worksWellWith: ['Style browsing', 'Material education'],
    microEducation: 'Researching is useful when you want guidance without locking scope too early.',
    exampleUseCase:
      'An early-stage brief uses this option while comparing style and material combinations before committing to dates.',
  },
};

const EXTRAS_GUIDE: Record<
  ExtraId,
  {
    bestFor: string[];
    consider: string[];
    worksWellWith: string[];
    microEducation: string;
    exampleUseCase: string;
  }
> = {
  blinds: {
    bestFor: ['Weather control', 'Low-angle sun protection', 'Flexible privacy'],
    consider: ['Wind exposure', 'Control location'],
    worksWellWith: ['Downlights', 'Acrylic roofs'],
    microEducation: 'Blinds are often the first add-on for projects focused on all-season comfort.',
    exampleUseCase:
      'An evening dining deck adds drop-down blinds on one exposed edge to improve comfort without closing the pergola permanently.',
  },
  slats: {
    bestFor: ['Filtered privacy', 'Architectural screening', 'Wind softening'],
    consider: ['Sightline planning', 'Screen orientation'],
    worksWellWith: ['Combination roofs', 'LED strips'],
    microEducation: 'Slat screens are usually chosen where privacy and airflow need balance.',
    exampleUseCase:
      'A boundary-facing patio adds slat screens to control overlooking while keeping a light, open feel.',
  },
  acrylic_infills: {
    bestFor: ['Rain blocking', 'Wind shielding', 'Clear enclosure zones'],
    consider: ['Ventilation strategy', 'Panel cleaning access'],
    worksWellWith: ['Heaters', 'Downlights'],
    microEducation: 'Infill panels are commonly used to protect seating zones from prevailing weather.',
    exampleUseCase:
      'A windswept corner lounge adds acrylic infills on two sides to improve rain protection and extend seasonal use.',
  },
  downlights: {
    bestFor: ['Task lighting', 'Even night-time coverage', 'Dining visibility'],
    consider: ['Circuit planning', 'Switching zones'],
    worksWellWith: ['Blinds', 'Timber finishes'],
    microEducation: 'Downlights are typically selected first when clients want practical night-time usability.',
    exampleUseCase:
      'A family entertaining area adds downlights over the table zone for practical lighting through evening use.',
  },
  led_strips: {
    bestFor: ['Ambient glow', 'Edge definition', 'Night-time atmosphere'],
    consider: ['Dimming control', 'Driver placement'],
    worksWellWith: ['Slat screens', 'Combination roofs'],
    microEducation: 'LED strips are often paired with downlights to separate ambience from task lighting.',
    exampleUseCase:
      'A modern outdoor room adds LED strips to perimeter beams for soft evening light and stronger architectural lines.',
  },
  heaters: {
    bestFor: ['Cool-season comfort', 'Evening use', 'Targeted warmth'],
    consider: ['Power load', 'Mounting clearance'],
    worksWellWith: ['Blinds', 'Acrylic infills'],
    microEducation: 'Heaters are usually most effective when paired with weather-control extras.',
    exampleUseCase:
      'A shoulder-season entertaining space adds patio heaters plus blinds to keep the area usable through cooler months.',
  },
};

const INSTALL_SURFACE_SUMMARY: Record<InstallSurface, string> = {
  deck: 'Mounted to or through existing deck framing.',
  concrete_pad: 'Anchored directly into concrete slab or pad.',
  pavers: 'Requires checking paver base and local footing needs.',
  ground_garden: 'May need new foundation points before install.',
  not_sure: 'We can identify this during Design Consultation.',
};

const LEVEL_SUMMARY: Record<SiteLevel, string> = {
  ground: 'Most common installation access and setup.',
  first: 'Raised installation with additional access planning.',
  second_plus: 'Higher-level install with stricter access requirements.',
  not_sure: 'We can help confirm from photos and measurements.',
};

const ATTACHMENT_SUMMARY: Record<SiteAttachment, string> = {
  attached: 'Connected to an existing structure.',
  freestanding: 'Independent posts and supports.',
  not_sure: 'We can assess attachment options in consultation.',
};

const ACCESS_SUMMARY: Record<PublicAccess, string> = {
  yes: 'Area is used by public visitors or customers.',
  no: 'Primarily private use.',
  not_sure: 'We can clarify public access implications together.',
};

const ACRYLIC_LIGHT_FEEL_SUMMARY: Record<AcrylicLightFeel, string> = {
  clear: 'Maximum daylight and a crisp open-sky feel.',
  opal: 'Softer, diffused light with reduced contrast.',
  tinted: 'Lower glare in bright conditions while retaining daylight.',
  not_sure: 'Choose this to confirm in consultation.',
};

const TIMBER_FINISH_SUMMARY: Record<TimberFinish, string> = {
  natural: 'Highlight timber grain and warm tone.',
  stained: 'Tone-match to existing joinery or deck finishes.',
  painted: 'Crisp finish to align with surrounding architecture.',
  not_sure: 'Choose this to confirm finish later.',
};

const DAYLIGHT_PLACEMENT_SUMMARY: Record<DaylightPlacement, string> = {
  circulation: 'Prioritize daylight over movement paths and walkways.',
  seating: 'Prioritize daylight where people sit and gather.',
  balanced: 'Balance daylight and shade across use zones.',
  not_sure: 'Choose this to review placement in consultation.',
};

const WATER_DIRECTION_SUMMARY: Record<WaterDirectionPreference, string> = {
  away_from_house: 'Fall directs water away from the house edge.',
  toward_house: 'Fall directs water toward the house gutter line.',
  not_sure: 'Choose this to confirm drainage strategy in consultation.',
};

function defaultSiteForEnquiryType(enquiryType: EnquiryType): StartFlowDraft['site'] {
  return {
    ...defaultStartFlowDraft.site,
    publicAccess: enquiryType === 'commercial' ? 'yes' : 'not_sure',
  };
}

function emptyExtras(): StartFlowDraft['extras'] {
  return { ...defaultStartFlowDraft.extras };
}

function createDefaultDraft(): StartFlowDraft {
  const enquiryType = defaultStartFlowDraft.enquiryType;
  return {
    ...defaultStartFlowDraft,
    site: defaultSiteForEnquiryType(enquiryType),
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: { ...defaultStartFlowDraft.extras },
    roofMaterials: [...defaultStartFlowDraft.roofMaterials],
  };
}

function cloneDraft(draft: StartFlowDraft): StartFlowDraft {
  return {
    ...draft,
    roofMaterials: [...draft.roofMaterials],
    site: { ...draft.site },
    dimensions: { ...draft.dimensions },
    extras: { ...draft.extras },
  };
}

function createInitialFlowState(): FlowState {
  const baseDraft = createDefaultDraft();
  return {
    draft: cloneDraft(baseDraft),
    confirmedDraft: cloneDraft(baseDraft),
    confirmedSteps: { ...DEFAULT_CONFIRMED_STEP_STATE },
  };
}

function normalizeLoadedState(input: StartFlowPersistedState): FlowState {
  const normalizeDraft = (draft: StartFlowDraft): StartFlowDraft => {
    const next = cloneDraft(draft);
    next.roofMaterials = next.roofMaterialChoice ? [...roofMaterialsByChoice[next.roofMaterialChoice]] : [];
    if (next.roofMaterialChoice !== 'timber') next.timberFinish = null;
    if (next.roofMaterialChoice !== 'acrylic') next.acrylicLightFeel = null;
    if (next.roofMaterialChoice !== 'combination') next.daylightPlacement = null;
    if (next.style !== 'pitched') next.waterDirectionPreference = null;
    if (next.site.publicAccess == null) {
      next.site.publicAccess = defaultSiteForEnquiryType(next.enquiryType).publicAccess;
    }
    return next;
  };

  return {
    draft: normalizeDraft(input.draft),
    confirmedDraft: normalizeDraft(input.confirmedDraft),
    confirmedSteps: {
      ...DEFAULT_CONFIRMED_STEP_STATE,
      ...input.confirmedSteps,
    },
  };
}

function toPositiveNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function labelFor<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T | null | undefined
): string {
  if (!value) return 'Not set';
  return options.find((option) => option.value === value)?.label ?? 'Not set';
}

function trimSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getUtmPayload(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase().startsWith('utm_') && value) {
      utm[key] = value;
    }
  }
  return utm;
}

function formatHeightLabel(heightM: number | null): string {
  if (heightM == null) return '2.4';
  return heightM.toFixed(1);
}

function roofStyleWithSecondaryLabel(params: {
  style: StartFlowDraft['style'];
  waterDirectionPreference: StartFlowDraft['waterDirectionPreference'];
}): string {
  const styleLabel = labelFor(startFlowContent.roofStyle.options, params.style);
  if (params.style !== 'pitched' || !params.waterDirectionPreference) {
    return styleLabel;
  }

  const waterDirectionLabel = labelFor(startFlowContent.roofStyle.waterDirectionOptions, params.waterDirectionPreference);
  return `${styleLabel} (${waterDirectionLabel})`;
}

function roofMaterialWithSecondaryLabel(params: {
  roofMaterialChoice: StartFlowDraft['roofMaterialChoice'];
  timberFinish: StartFlowDraft['timberFinish'];
  acrylicLightFeel: StartFlowDraft['acrylicLightFeel'];
  daylightPlacement: StartFlowDraft['daylightPlacement'];
}): string {
  if (!params.roofMaterialChoice) return 'Not set';

  const primaryLabel = labelFor(startFlowContent.roofMaterial.options, params.roofMaterialChoice);
  if (params.roofMaterialChoice === 'timber' && params.timberFinish) {
    return `${primaryLabel} (${labelFor(startFlowContent.roofMaterial.timberFinishOptions, params.timberFinish)})`;
  }
  if (params.roofMaterialChoice === 'acrylic' && params.acrylicLightFeel) {
    return `${primaryLabel} (${labelFor(startFlowContent.roofMaterial.acrylicLightFeelOptions, params.acrylicLightFeel)})`;
  }
  if (params.roofMaterialChoice === 'combination' && params.daylightPlacement) {
    return `${primaryLabel} (${labelFor(startFlowContent.roofMaterial.daylightPlacementOptions, params.daylightPlacement)})`;
  }
  return primaryLabel;
}

function buildSummaryBlock(params: {
  draft: StartFlowDraft;
  areaM2: number | null;
  consentTitle: string;
  selectedExtras: string[];
}): string {
  const { draft, areaM2, consentTitle, selectedExtras } = params;
  const typeLabel = labelFor(startFlowContent.branch.options, draft.enquiryType);
  const roofStyleLabel = roofStyleWithSecondaryLabel({
    style: draft.style,
    waterDirectionPreference: draft.waterDirectionPreference,
  });
  const roofMaterialLabel = roofMaterialWithSecondaryLabel({
    roofMaterialChoice: draft.roofMaterialChoice,
    timberFinish: draft.timberFinish,
    acrylicLightFeel: draft.acrylicLightFeel,
    daylightPlacement: draft.daylightPlacement,
  });
  const widthM = toPositiveNumber(draft.dimensions.widthM);
  const depthM = toPositiveNumber(draft.dimensions.depthM);
  const heightM = toPositiveNumber(draft.dimensions.heightM);
  const dimensionsLabel = `${widthM?.toFixed(1) ?? '-'}m (along house) x ${depthM?.toFixed(1) ?? '-'}m (projection) x ${formatHeightLabel(heightM)}m`;
  const surfaceLabel = labelFor(startFlowContent.site.installSurfaceOptions, draft.site.installSurface);
  const levelLabel = labelFor(startFlowContent.site.levelOptions, draft.site.level);
  const attachedLabel = labelFor(startFlowContent.site.attachmentOptions, draft.site.attachment);
  const publicAccessLabel = labelFor(startFlowContent.site.publicAccessOptions, draft.site.publicAccess);
  const extrasLabel = selectedExtras.length ? selectedExtras.join(', ') : 'None selected';
  const timeframeLabel = labelFor(startFlowContent.process.timeframeOptions, draft.timeframe);
  const areaLabel = areaM2 == null ? 'unknown' : `${areaM2.toFixed(1)}m^2`;

  return [
    '---',
    'Start-page design brief',
    `Type: ${typeLabel}`,
    `Roof style: ${roofStyleLabel}`,
    `Roof material: ${roofMaterialLabel}`,
    `Dimensions: ${dimensionsLabel}`,
    `Surface: ${surfaceLabel}`,
    `Level: ${levelLabel}`,
    `Attached: ${attachedLabel}`,
    `Public access: ${publicAccessLabel}`,
    `Extras: ${extrasLabel}`,
    `Consent check: ${consentTitle} (area ${areaLabel})`,
    `Timeframe: ${timeframeLabel}`,
    '---',
  ].join('\n');
}

function buildMessageWithSummary(message: string, summaryBlock: string): string {
  const base = message.trim();
  const joiner = base ? '\n\n' : '';
  const reserved = summaryBlock.length + joiner.length;

  if (reserved >= MAX_MESSAGE_LENGTH) {
    return summaryBlock.slice(0, MAX_MESSAGE_LENGTH);
  }

  const allowedBaseLength = MAX_MESSAGE_LENGTH - reserved;
  const truncatedBase = base.length > allowedBaseLength ? base.slice(0, allowedBaseLength) : base;
  return `${truncatedBase}${joiner}${summaryBlock}`;
}

function applyRoofMaterialChoice(previous: StartFlowDraft, choice: RoofMaterialChoice): StartFlowDraft {
  return {
    ...previous,
    roofMaterialChoice: choice,
    roofMaterials: [...roofMaterialsByChoice[choice]],
    acrylicTint: null,
    acrylicLightFeel: null,
    timberFinish: null,
    daylightPlacement: null,
  };
}

function applyRoofStyle(previous: StartFlowDraft, style: RoofStyle): StartFlowDraft {
  return {
    ...previous,
    style,
    waterDirectionPreference: style === 'pitched' ? previous.waterDirectionPreference : null,
  };
}

function resetAfterPathChange(previous: StartFlowDraft, enquiryType: EnquiryType): StartFlowDraft {
  return {
    ...previous,
    enquiryType,
    style: null,
    waterDirectionPreference: null,
    roofMaterialChoice: null,
    roofMaterials: [],
    acrylicTint: null,
    acrylicLightFeel: null,
    timberFinish: null,
    daylightPlacement: null,
    suburb: '',
    site: defaultSiteForEnquiryType(enquiryType),
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: emptyExtras(),
    extrasAcknowledged: false,
    timeframe: null,
  };
}

function isRoofMaterialDraftValid(draft: StartFlowDraft): boolean {
  return Boolean(draft.roofMaterialChoice);
}

function isSiteDraftValid(draft: StartFlowDraft): boolean {
  const hasSiteBasics = Boolean(
    draft.site.installSurface && draft.site.level && draft.site.attachment && draft.site.publicAccess
  );

  if (!hasSiteBasics) return false;
  if (draft.enquiryType === 'professional') return true;

  return Boolean(toPositiveNumber(draft.dimensions.widthM) && toPositiveNumber(draft.dimensions.depthM));
}

function hasExtrasChoice(draft: StartFlowDraft): boolean {
  if (draft.extrasAcknowledged) return true;
  return Object.values(draft.extras).some(Boolean);
}

export default function StartPage() {
  const content = startFlowContent;

  const [flow, setFlow] = useState<FlowState>(() => createInitialFlowState());
  const draft = flow.draft;
  const confirmedDraft = flow.confirmedDraft;
  const confirmedSteps = flow.confirmedSteps;

  const [storageReady, setStorageReady] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [resumeCandidate, setResumeCandidate] = useState<StartFlowPersistedState | null>(null);

  const [activeModal, setActiveModal] = useState<ModalId>(null);
  const [quickInfoModal, setQuickInfoModal] = useState<{
    title: string;
    summary?: string;
    image: { src: string; alt: string };
  } | null>(null);
  const [briefSheetOpen, setBriefSheetOpen] = useState(false);
  const anyModalOpen = activeModal !== null || quickInfoModal !== null || briefSheetOpen;

  const [branchTab, setBranchTab] = useState<EnquiryType>('residential');
  const [roofStyleTab, setRoofStyleTab] = useState<RoofStyle>('pitched');
  const [roofMaterialTab, setRoofMaterialTab] = useState<RoofMaterialChoice>('acrylic');
  const [extrasTab, setExtrasTab] = useState<ExtraId>('blinds');
  const [timeframeTab, setTimeframeTab] = useState<Timeframe>('asap');

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMeta, setSubmitMeta] = useState<SubmitMeta | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [sendPhotosLater, setSendPhotosLater] = useState(false);

  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    hero: null,
    branch: null,
    roofStyle: null,
    roofMaterial: null,
    site: null,
    consent: null,
    extras: null,
    process: null,
    submit: null,
  });
  const pendingJumpRef = useRef<SectionId | null>(null);

  const setSectionRef = useCallback(
    (id: SectionId) => (node: HTMLElement | null) => {
      sectionRefs.current[id] = node;
    },
    []
  );

  const jumpToSection = useCallback((id: SectionId) => {
    const node = sectionRefs.current[id];
    if (!node) return;

    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const heading = node.querySelector<HTMLElement>('[data-step-heading="true"]');
    if (!heading) return;

    window.setTimeout(() => {
      heading.focus({ preventScroll: true });
    }, 220);
  }, []);

  const queueJumpTo = useCallback((id: SectionId) => {
    pendingJumpRef.current = id;
  }, []);

  useEffect(() => {
    const restored = readStartFlowState(START_FLOW_SCHEMA_VERSION);
    if (restored) {
      setResumeCandidate(restored);
      setResumePromptOpen(true);
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || resumePromptOpen || submitState === 'success') return;
    writeStartFlowState(START_FLOW_SCHEMA_VERSION, {
      draft: flow.draft,
      confirmedDraft: flow.confirmedDraft,
      confirmedSteps: flow.confirmedSteps,
    });
  }, [flow, resumePromptOpen, storageReady, submitState]);

  useEffect(() => {
    setStartModalOpenClass(anyModalOpen);
    dispatchStartModalVisibility(anyModalOpen);
  }, [anyModalOpen]);

  useEffect(() => {
    return () => {
      setStartModalOpenClass(false);
      dispatchStartModalVisibility(false);
    };
  }, []);

  const dimensionsRequired = draft.enquiryType !== 'professional';
  const widthM = toPositiveNumber(draft.dimensions.widthM);
  const depthM = toPositiveNumber(draft.dimensions.depthM);
  const heightM = toPositiveNumber(draft.dimensions.heightM);
  const areaM2 = widthM != null && depthM != null ? widthM * depthM : null;
  const roofed = draft.roofMaterials.length > 0;

  const confirmedWidthM = toPositiveNumber(confirmedDraft.dimensions.widthM);
  const confirmedDepthM = toPositiveNumber(confirmedDraft.dimensions.depthM);
  const confirmedAreaM2 =
    confirmedWidthM != null && confirmedDepthM != null ? confirmedWidthM * confirmedDepthM : null;
  const confirmedRoofed = confirmedDraft.roofMaterials.length > 0;

  const selectedExtraIds = useMemo(
    () => content.extras.options.filter((option) => draft.extras[option.value]).map((option) => option.value),
    [content.extras.options, draft.extras]
  );

  const selectedExtras = useMemo(
    () => content.extras.options.filter((option) => draft.extras[option.value]).map((option) => option.label),
    [content.extras.options, draft.extras]
  );

  const selectedConfirmedExtraIds = useMemo(
    () => content.extras.options.filter((option) => confirmedDraft.extras[option.value]).map((option) => option.value),
    [content.extras.options, confirmedDraft.extras]
  );

  const selectedConfirmedExtras = useMemo(
    () => content.extras.options.filter((option) => confirmedDraft.extras[option.value]).map((option) => option.label),
    [content.extras.options, confirmedDraft.extras]
  );

  const consentResult = useMemo(
    () =>
      evaluateConsentQuickCheck({
        roofed,
        attached: draft.site.attachment,
        level: draft.site.level,
        publicAccess: draft.site.publicAccess,
        areaM2,
      }),
    [areaM2, draft.site.attachment, draft.site.level, draft.site.publicAccess, roofed]
  );

  const confirmedConsentResult = useMemo(
    () =>
      evaluateConsentQuickCheck({
        roofed: confirmedRoofed,
        attached: confirmedDraft.site.attachment,
        level: confirmedDraft.site.level,
        publicAccess: confirmedDraft.site.publicAccess,
        areaM2: confirmedAreaM2,
      }),
    [confirmedAreaM2, confirmedDraft.site.attachment, confirmedDraft.site.level, confirmedDraft.site.publicAccess, confirmedRoofed]
  );

  const consentPrerequisitesReady = Boolean(
    draft.roofMaterialChoice &&
      draft.site.attachment &&
      draft.site.level &&
      draft.site.publicAccess &&
      widthM != null &&
      depthM != null
  );

  const completion = useMemo<Record<StepId, boolean>>(
    () => ({
      branch: confirmedSteps.branch,
      roofStyle: confirmedSteps.roofStyle,
      roofMaterial: confirmedSteps.roofMaterial,
      site: confirmedSteps.site,
      consent: confirmedSteps.site && confirmedSteps.consent,
      extras: confirmedSteps.extras,
      process: confirmedSteps.process,
      submit: submitState === 'success',
    }),
    [confirmedSteps, submitState]
  );

  const firstIncompleteStep = useMemo<StepId>(() => STEP_ORDER.find((step) => !completion[step]) ?? 'submit', [completion]);
  const firstIncompleteIndex = STEP_ORDER.indexOf(firstIncompleteStep);
  const visibleSteps = useMemo(() => STEP_ORDER.slice(0, firstIncompleteIndex + 1), [firstIncompleteIndex]);
  const visibleStepSet = useMemo(() => new Set<StepId>(visibleSteps), [visibleSteps]);
  const visibleKey = visibleSteps.join('|');

  useEffect(() => {
    const pendingJump = pendingJumpRef.current;
    if (!pendingJump) return;

    if (pendingJump !== 'hero' && !visibleStepSet.has(pendingJump as StepId)) {
      return;
    }

    pendingJumpRef.current = null;
    jumpToSection(pendingJump);
  }, [jumpToSection, visibleKey, visibleStepSet]);

  const clearFeedback = () => {
    setValidationErrors([]);
    setSubmitError(null);
    setSubmitMeta(null);
    setSubmitState((previous) => {
      if (previous === 'sending') return previous;
      return 'idle';
    });
  };

  const applyDraftUpdate = (updater: (previous: StartFlowDraft) => StartFlowDraft) => {
    clearFeedback();
    setFlow((previous) => ({
      ...previous,
      draft: updater(previous.draft),
    }));
  };

  const openQuickInfo = (params: { title: string; summary?: string; image: { src: string; alt: string } }) => {
    setQuickInfoModal(params);
  };

  const handleResumeDesign = () => {
    if (!resumeCandidate) {
      setResumePromptOpen(false);
      return;
    }

    setFlow(normalizeLoadedState(resumeCandidate));
    setResumePromptOpen(false);
    setResumeCandidate(null);
  };

  const handleStartOverFromPrompt = () => {
    setFlow(createInitialFlowState());
    setResumePromptOpen(false);
    setResumeCandidate(null);
    clearStartFlowDraft();
  };

  const handleBranchSelection = (value: EnquiryType) => {
    applyDraftUpdate((previous) => {
      if (previous.enquiryType === value) return previous;
      return {
        ...previous,
        enquiryType: value,
      };
    });
  };

  const handleBranchCardOpen = (value: EnquiryType) => {
    handleBranchSelection(value);
    setBranchTab(value);
    setActiveModal('branch');
  };

  const handleRoofStyleSelection = (value: RoofStyle) => {
    applyDraftUpdate((previous) => {
      if (previous.style === value) return previous;
      return applyRoofStyle(previous, value);
    });
  };

  const handleRoofStyleCardOpen = (value: RoofStyle) => {
    handleRoofStyleSelection(value);
    setRoofStyleTab(value);
    setActiveModal('roofStyle');
  };

  const handleRoofMaterialSelection = (value: RoofMaterialChoice) => {
    applyDraftUpdate((previous) => {
      if (previous.roofMaterialChoice === value) return previous;
      return applyRoofMaterialChoice(previous, value);
    });
  };

  const handleRoofMaterialCardOpen = (value: RoofMaterialChoice) => {
    handleRoofMaterialSelection(value);
    setRoofMaterialTab(value);
    setActiveModal('roofMaterial');
  };

  const updateSite = <K extends keyof StartFlowDraft['site']>(key: K, value: StartFlowDraft['site'][K]) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      site: {
        ...previous.site,
        [key]: value,
      },
    }));
  };

  const updateSuburb = (value: string) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      suburb: value,
    }));
  };

  const updateDimension = <K extends keyof StartFlowDraft['dimensions']>(
    key: K,
    value: StartFlowDraft['dimensions'][K]
  ) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      dimensions: {
        ...previous.dimensions,
        [key]: value,
      },
    }));
  };

  const updateAcrylicLightFeel = (value: AcrylicLightFeel) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      acrylicLightFeel: value,
    }));
  };

  const updateTimberFinish = (value: TimberFinish) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      timberFinish: value,
    }));
  };

  const updateDaylightPlacement = (value: DaylightPlacement) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      daylightPlacement: value,
    }));
  };

  const updateWaterDirectionPreference = (value: WaterDirectionPreference) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      waterDirectionPreference: value,
    }));
  };

  const handleExtraSelectionChange = (extraId: ExtraId, checked: boolean) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      extras: {
        ...previous.extras,
        [extraId]: checked,
      },
      extrasAcknowledged: false,
    }));
  };

  const handleExtraCardOpen = (extraId: ExtraId) => {
    setExtrasTab(extraId);
    setActiveModal('extras');
  };

  const setNoExtras = (value: boolean) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      extras: value ? emptyExtras() : previous.extras,
      extrasAcknowledged: value,
    }));
  };

  const handleTimeframeSelection = (value: Timeframe) => {
    applyDraftUpdate((previous) => ({
      ...previous,
      timeframe: value,
    }));
  };

  const handleTimeframeCardOpen = (value: Timeframe) => {
    handleTimeframeSelection(value);
    setTimeframeTab(value);
    setActiveModal('process');
  };

  const handlePhotosSelected = (incoming: FileList | null) => {
    if (!incoming) return;
    clearFeedback();

    setPhotoFiles((previous) => {
      const merged = [...previous, ...Array.from(incoming)];
      return merged.slice(0, MAX_PHOTO_COUNT);
    });
    setSendPhotosLater(false);
  };

  const removePhoto = (name: string, index: number) => {
    setPhotoFiles((previous) => previous.filter((file, fileIndex) => !(file.name === name && fileIndex === index)));
  };

  const handleReset = () => {
    setFlow(createInitialFlowState());
    setPhotoFiles([]);
    setSendPhotosLater(false);
    setValidationErrors([]);
    setSubmitError(null);
    setSubmitMeta(null);
    setSubmitState('idle');
    setActiveModal(null);
    setQuickInfoModal(null);
    setBriefSheetOpen(false);
    clearStartFlowDraft();
    pendingJumpRef.current = null;
    jumpToSection('hero');
  };

  const confirmBranch = () => {
    clearFeedback();

    setFlow((previous) => {
      const selectedPath = previous.draft.enquiryType;
      const pathChanged = previous.confirmedSteps.branch && previous.confirmedDraft.enquiryType !== selectedPath;

      if (pathChanged) {
        const nextDraft = resetAfterPathChange(previous.draft, selectedPath);
        const nextConfirmedDraft = cloneDraft({
          ...createDefaultDraft(),
          enquiryType: selectedPath,
          site: defaultSiteForEnquiryType(selectedPath),
        });

        return {
          draft: nextDraft,
          confirmedDraft: nextConfirmedDraft,
          confirmedSteps: {
            ...DEFAULT_CONFIRMED_STEP_STATE,
            branch: true,
          },
        };
      }

      return {
        ...previous,
        confirmedDraft: {
          ...previous.confirmedDraft,
          enquiryType: selectedPath,
        },
        confirmedSteps: {
          ...previous.confirmedSteps,
          branch: true,
        },
      };
    });

    setActiveModal(null);
    queueJumpTo('roofStyle');
  };

  const confirmRoofStyle = () => {
    if (!draft.style) return;
    clearFeedback();

    setFlow((previous) => {
      if (!previous.draft.style) return previous;
      const style = previous.draft.style;
      return {
        ...previous,
        confirmedDraft: {
          ...previous.confirmedDraft,
          style,
          waterDirectionPreference: style === 'pitched' ? previous.draft.waterDirectionPreference : null,
        },
        confirmedSteps: {
          ...previous.confirmedSteps,
          roofStyle: true,
        },
      };
    });

    setActiveModal(null);
    queueJumpTo('roofMaterial');
  };

  const confirmRoofMaterial = () => {
    if (!isRoofMaterialDraftValid(draft)) return;
    clearFeedback();

    setFlow((previous) => {
      if (!isRoofMaterialDraftValid(previous.draft) || !previous.draft.roofMaterialChoice) return previous;
      const choice = previous.draft.roofMaterialChoice;

      return {
        ...previous,
        confirmedDraft: {
          ...previous.confirmedDraft,
          roofMaterialChoice: choice,
          roofMaterials: [...roofMaterialsByChoice[choice]],
          acrylicTint: null,
          acrylicLightFeel: choice === 'acrylic' ? previous.draft.acrylicLightFeel : null,
          timberFinish: choice === 'timber' ? previous.draft.timberFinish : null,
          daylightPlacement: choice === 'combination' ? previous.draft.daylightPlacement : null,
        },
        confirmedSteps: {
          ...previous.confirmedSteps,
          roofMaterial: true,
          consent: false,
        },
      };
    });

    setActiveModal(null);
    queueJumpTo('site');
  };

  const confirmSite = () => {
    if (!isSiteDraftValid(draft)) return;
    clearFeedback();

    setFlow((previous) => ({
      ...previous,
      confirmedDraft: {
        ...previous.confirmedDraft,
        suburb: previous.draft.suburb,
        site: { ...previous.draft.site },
        dimensions: { ...previous.draft.dimensions },
      },
      confirmedSteps: {
        ...previous.confirmedSteps,
        site: true,
        consent: false,
      },
    }));

    queueJumpTo('consent');
  };

  const confirmConsent = () => {
    if (!consentPrerequisitesReady) return;
    clearFeedback();

    setFlow((previous) => ({
      ...previous,
      confirmedSteps: {
        ...previous.confirmedSteps,
        consent: true,
      },
    }));

    queueJumpTo('extras');
  };

  const confirmExtras = () => {
    if (!hasExtrasChoice(draft)) return;
    clearFeedback();

    setFlow((previous) => ({
      ...previous,
      confirmedDraft: {
        ...previous.confirmedDraft,
        extras: { ...previous.draft.extras },
        extrasAcknowledged: previous.draft.extrasAcknowledged,
      },
      confirmedSteps: {
        ...previous.confirmedSteps,
        extras: true,
      },
    }));

    setActiveModal(null);
    queueJumpTo('process');
  };

  const confirmProcess = () => {
    if (!draft.timeframe) return;
    clearFeedback();

    setFlow((previous) => ({
      ...previous,
      confirmedDraft: {
        ...previous.confirmedDraft,
        timeframe: previous.draft.timeframe,
      },
      confirmedSteps: {
        ...previous.confirmedSteps,
        process: true,
      },
    }));

    setActiveModal(null);
    queueJumpTo('submit');
  };

  const openModalForStep = (step: ConfirmableStepId) => {
    if (step === 'branch') {
      setBranchTab(draft.enquiryType);
      setActiveModal('branch');
      return;
    }

    if (step === 'roofStyle') {
      setRoofStyleTab(draft.style ?? content.roofStyle.options[0].value);
      setActiveModal('roofStyle');
      return;
    }

    if (step === 'roofMaterial') {
      setRoofMaterialTab(draft.roofMaterialChoice ?? content.roofMaterial.options[0].value);
      setActiveModal('roofMaterial');
      return;
    }

    if (step === 'extras') {
      const preferredExtra = selectedExtraIds[0] ?? content.extras.options[0].value;
      setExtrasTab(preferredExtra);
      setActiveModal('extras');
      return;
    }

    if (step === 'process') {
      setTimeframeTab(draft.timeframe ?? content.process.timeframeOptions[0].value);
      setActiveModal('process');
    }
  };

  const handleStepChange = (step: ConfirmableStepId) => {
    clearFeedback();
    setBriefSheetOpen(false);

    setFlow((previous) => {
      const nextConfirmedSteps: ConfirmedStepState = {
        ...previous.confirmedSteps,
        [step]: false,
      };
      if (step === 'roofMaterial' || step === 'site') {
        nextConfirmedSteps.consent = false;
      }

      return {
        ...previous,
        confirmedSteps: nextConfirmedSteps,
      };
    });

    queueJumpTo(step);
    openModalForStep(step);
  };

  const validateBeforeSubmit = (): string[] => {
    const errors: string[] = [];

    if (!trimSingleLine(draft.name)) errors.push('Name is required.');
    if (!trimSingleLine(draft.phone)) errors.push('Phone is required.');

    if (draft.enquiryType !== 'professional') {
      if (!widthM || !depthM) {
        errors.push('Residential and commercial submissions require length and projection.');
      }
      if (!draft.style) {
        errors.push('Residential and commercial submissions require a roof style selection.');
      }
      if (!draft.roofMaterialChoice) {
        errors.push('Residential and commercial submissions require a roof material selection.');
      }
    }

    return errors;
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (firstIncompleteStep !== 'submit') {
      const errors = ['Please complete all previous steps before submitting.'];
      setValidationErrors(errors);
      setSubmitState('error');
      setSubmitError(errors[0]);
      jumpToSection(firstIncompleteStep);
      return;
    }

    const errors = validateBeforeSubmit();
    if (errors.length) {
      setValidationErrors(errors);
      setSubmitState('error');
      setSubmitError('Please fix the form issues and try again.');
      jumpToSection('submit');
      return;
    }

    setSubmitState('sending');

    try {
      const summaryBlock = buildSummaryBlock({
        draft,
        areaM2,
        consentTitle: consentResult.title,
        selectedExtras,
      });
      const message = buildMessageWithSummary(draft.message, summaryBlock);

      const addOns = {
        blinds: draft.extras.blinds,
        slats: draft.extras.slats,
        lighting: draft.extras.downlights || draft.extras.led_strips,
        heating: draft.extras.heaters,
      };

      const payload = {
        enquiryType: draft.enquiryType,
        name: trimSingleLine(draft.name),
        phone: trimSingleLine(draft.phone),
        email: trimSingleLine(draft.email),
        suburb: trimSingleLine(draft.suburb),
        message,
        dimensions: {
          widthM: widthM ?? null,
          depthM: depthM ?? null,
          heightM: heightM ?? null,
        },
        style: draft.style ?? '',
        roofMaterials: [...draft.roofMaterials],
        addOns,
        files: photoFiles.map((file) => ({ name: file.name, size: file.size, type: file.type })),
        utm: getUtmPayload(),
        page: typeof window === 'undefined' ? '/start' : window.location.pathname,
        source: 'website-start',
        honeypot: '',
        site: {
          installSurface: draft.site.installSurface,
          level: draft.site.level,
          attachment: draft.site.attachment,
          publicAccess: draft.site.publicAccess,
        },
        consent: {
          result: consentResult.code,
          title: consentResult.title,
          areaM2: consentResult.areaM2,
          reasons: consentResult.reasons,
        },
        timeframe: draft.timeframe,
        roofMaterialChoice: draft.roofMaterialChoice,
        waterDirectionPreference: draft.waterDirectionPreference,
        acrylicTint: draft.acrylicTint,
        acrylicLightFeel: draft.acrylicLightFeel,
        timberFinish: draft.timberFinish,
        daylightPlacement: draft.daylightPlacement,
        extrasDetailed: {
          acrylicInfills: draft.extras.acrylic_infills,
          downlights: draft.extras.downlights,
          ledStrips: draft.extras.led_strips,
          patioHeaters: draft.extras.heaters,
        },
        sendPhotosLater,
        startFlowSchemaVersion: START_FLOW_SCHEMA_VERSION,
      };

      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({ ok: response.ok }));

      if (!response.ok || !json?.ok) {
        const errorMessage = typeof json?.error === 'string' ? json.error : 'Unable to submit your design brief.';
        setSubmitState('error');
        setSubmitError(errorMessage);
        return;
      }

      setSubmitState('success');
      setSubmitMeta({
        contactId: json.contactId,
        projectId: json.projectId,
        enquiryRequestId: json.enquiryRequestId,
      });
      clearStartFlowDraft();
      jumpToSection('submit');
    } catch {
      setSubmitState('error');
      setSubmitError('A network error occurred while submitting. Please try again.');
    }
  };

  const branchCards = useMemo<OptionCardOption<EnquiryType>[]>(
    () =>
      content.branch.options.map((option) => ({
        value: option.value,
        title: option.label,
        summary: option.description,
        tags: BRANCH_GUIDE[option.value].bestFor.slice(0, 2),
        image: BRANCH_MEDIA[option.value],
      })),
    [content.branch.options]
  );

  const roofStyleCards = useMemo<OptionCardOption<RoofStyle>[]>(
    () =>
      content.roofStyle.options.map((option) => ({
        value: option.value,
        title: option.label,
        summary: option.what,
        tags: option.bestWhen.slice(0, 2),
        image: ROOF_STYLE_MEDIA[option.value],
      })),
    [content.roofStyle.options]
  );

  const roofMaterialCards = useMemo<OptionCardOption<RoofMaterialChoice>[]>(
    () =>
      content.roofMaterial.options.map((option) => ({
        value: option.value,
        title: option.label,
        summary: option.description,
        tags: ROOF_MATERIAL_GUIDE[option.value].bestFor.slice(0, 2),
        image: ROOF_MATERIAL_MEDIA[option.value],
      })),
    [content.roofMaterial.options]
  );

  const timberFinishSubpanelOptions = useMemo(
    () =>
      content.roofMaterial.timberFinishOptions.map((option) => ({
        id: option.value,
        label: option.label,
        description: TIMBER_FINISH_SUMMARY[option.value],
      })),
    [content.roofMaterial.timberFinishOptions]
  );

  const acrylicLightFeelSubpanelOptions = useMemo(
    () =>
      content.roofMaterial.acrylicLightFeelOptions.map((option) => ({
        id: option.value,
        label: option.label,
        description: ACRYLIC_LIGHT_FEEL_SUMMARY[option.value],
      })),
    [content.roofMaterial.acrylicLightFeelOptions]
  );

  const daylightPlacementSubpanelOptions = useMemo(
    () =>
      content.roofMaterial.daylightPlacementOptions.map((option) => ({
        id: option.value,
        label: option.label,
        description: DAYLIGHT_PLACEMENT_SUMMARY[option.value],
      })),
    [content.roofMaterial.daylightPlacementOptions]
  );

  const waterDirectionSubpanelOptions = useMemo(
    () =>
      content.roofStyle.waterDirectionOptions.map((option) => ({
        id: option.value,
        label: option.label,
        description: WATER_DIRECTION_SUMMARY[option.value],
      })),
    [content.roofStyle.waterDirectionOptions]
  );

  const installSurfaceCards = useMemo<OptionCardOption<InstallSurface>[]>(
    () =>
      content.site.installSurfaceOptions.map((option) => ({
        value: option.value,
        title: option.label,
        summary: INSTALL_SURFACE_SUMMARY[option.value],
        image: INSTALL_SURFACE_MEDIA[option.value],
      })),
    [content.site.installSurfaceOptions]
  );

  const levelCards = useMemo<OptionCardOption<SiteLevel>[]>(
    () =>
      content.site.levelOptions.map((option) => ({
        value: option.value,
        title: option.label,
        summary: LEVEL_SUMMARY[option.value],
        image: SITE_LEVEL_MEDIA[option.value],
      })),
    [content.site.levelOptions]
  );

  const attachmentCards = useMemo<OptionCardOption<SiteAttachment>[]>(
    () =>
      content.site.attachmentOptions.map((option) => ({
        value: option.value,
        title: option.label,
        summary: ATTACHMENT_SUMMARY[option.value],
        image: SITE_ATTACHMENT_MEDIA[option.value],
      })),
    [content.site.attachmentOptions]
  );

  const publicAccessCards = useMemo<OptionCardOption<PublicAccess>[]>(
    () =>
      content.site.publicAccessOptions.map((option) => ({
        value: option.value,
        title: option.label,
        summary: ACCESS_SUMMARY[option.value],
        image: PUBLIC_ACCESS_MEDIA[option.value],
      })),
    [content.site.publicAccessOptions]
  );

  const extrasCards = useMemo<OptionCardOption<ExtraId>[]>(
    () =>
      content.extras.options.map((option) => ({
        value: option.value,
        title: option.label,
        summary: option.description,
        image: EXTRA_MEDIA[option.value],
      })),
    [content.extras.options]
  );

  const timeframeCards = useMemo<OptionCardOption<Timeframe>[]>(
    () =>
      content.process.timeframeOptions.map((option) => ({
        value: option.value,
        title: option.label,
        summary: TIMEFRAME_GUIDE[option.value].summary,
        image: TIMEFRAME_MEDIA[option.value],
      })),
    [content.process.timeframeOptions]
  );

  const branchModalOptions = useMemo<TabbedModalOption<EnquiryType>[]>(
    () =>
      content.branch.options.map((option) => ({
        id: option.value,
        label: option.label,
        summary: option.description,
        image: BRANCH_MEDIA[option.value],
        bestFor: BRANCH_GUIDE[option.value].bestFor,
        consider: BRANCH_GUIDE[option.value].consider,
        worksWellWith: BRANCH_GUIDE[option.value].worksWellWith,
        microEducation: BRANCH_GUIDE[option.value].microEducation,
        exampleUseCase: BRANCH_GUIDE[option.value].exampleUseCase,
      })),
    [content.branch.options]
  );

  const roofStyleModalOptions = useMemo<TabbedModalOption<RoofStyle>[]>(
    () =>
      content.roofStyle.options.map((option) => ({
        id: option.value,
        label: option.label,
        summary: option.what,
        image: ROOF_STYLE_MEDIA[option.value],
        bestFor: option.bestWhen,
        consider: [option.watchOut],
        worksWellWith: ROOF_STYLE_PAIRINGS[option.value],
        microEducation: 'Clients with similar layouts often decide after comparing daylight and drainage behavior.',
        exampleUseCase: ROOF_STYLE_EXAMPLE_USE_CASE[option.value],
      })),
    [content.roofStyle.options]
  );

  const roofMaterialModalOptions = useMemo<TabbedModalOption<RoofMaterialChoice>[]>(
    () =>
      content.roofMaterial.options.map((option) => ({
        id: option.value,
        label: option.label,
        summary: option.description,
        image: ROOF_MATERIAL_MEDIA[option.value],
        bestFor: ROOF_MATERIAL_GUIDE[option.value].bestFor,
        consider: ROOF_MATERIAL_GUIDE[option.value].consider,
        worksWellWith: ROOF_MATERIAL_GUIDE[option.value].worksWellWith,
        microEducation: ROOF_MATERIAL_GUIDE[option.value].microEducation,
        exampleUseCase: ROOF_MATERIAL_GUIDE[option.value].exampleUseCase,
      })),
    [content.roofMaterial.options]
  );

  const timeframeModalOptions = useMemo<TabbedModalOption<Timeframe>[]>(
    () =>
      content.process.timeframeOptions.map((option) => ({
        id: option.value,
        label: option.label,
        summary: TIMEFRAME_GUIDE[option.value].summary,
        image: TIMEFRAME_MEDIA[option.value],
        bestFor: TIMEFRAME_GUIDE[option.value].bestFor,
        consider: TIMEFRAME_GUIDE[option.value].consider,
        worksWellWith: TIMEFRAME_GUIDE[option.value].worksWellWith,
        microEducation: TIMEFRAME_GUIDE[option.value].microEducation,
        exampleUseCase: TIMEFRAME_GUIDE[option.value].exampleUseCase,
      })),
    [content.process.timeframeOptions]
  );

  const extrasModalOptions = useMemo<ExtrasExplorerOption<ExtraId>[]>(
    () =>
      content.extras.options.map((option) => ({
        id: option.value,
        label: option.label,
        summary: option.description,
        image: EXTRA_MEDIA[option.value],
        bestFor: EXTRAS_GUIDE[option.value].bestFor,
        consider: EXTRAS_GUIDE[option.value].consider,
        worksWellWith: EXTRAS_GUIDE[option.value].worksWellWith,
        microEducation: EXTRAS_GUIDE[option.value].microEducation,
        exampleUseCase: EXTRAS_GUIDE[option.value].exampleUseCase,
      })),
    [content.extras.options]
  );

  const branchSummary = labelFor(content.branch.options, confirmedDraft.enquiryType);
  const roofStyleSummary = useMemo(
    () =>
      roofStyleWithSecondaryLabel({
        style: confirmedDraft.style,
        waterDirectionPreference: confirmedDraft.waterDirectionPreference,
      }),
    [confirmedDraft.style, confirmedDraft.waterDirectionPreference]
  );

  const roofMaterialSummary = useMemo(() => {
    return roofMaterialWithSecondaryLabel({
      roofMaterialChoice: confirmedDraft.roofMaterialChoice,
      timberFinish: confirmedDraft.timberFinish,
      acrylicLightFeel: confirmedDraft.acrylicLightFeel,
      daylightPlacement: confirmedDraft.daylightPlacement,
    });
  }, [
    confirmedDraft.acrylicLightFeel,
    confirmedDraft.daylightPlacement,
    confirmedDraft.roofMaterialChoice,
    confirmedDraft.timberFinish,
  ]);

  const siteSummary = useMemo(() => {
    const surface = labelFor(content.site.installSurfaceOptions, confirmedDraft.site.installSurface);
    const level = labelFor(content.site.levelOptions, confirmedDraft.site.level);
    const attachment = labelFor(content.site.attachmentOptions, confirmedDraft.site.attachment);
    const access = labelFor(content.site.publicAccessOptions, confirmedDraft.site.publicAccess);
    const dims = `${confirmedDraft.dimensions.widthM || '-'}m x ${confirmedDraft.dimensions.depthM || '-'}m`;
    return `${surface}, ${level}, ${attachment}, ${access}, ${dims}`;
  }, [
    confirmedDraft.dimensions.depthM,
    confirmedDraft.dimensions.widthM,
    confirmedDraft.site.attachment,
    confirmedDraft.site.installSurface,
    confirmedDraft.site.level,
    confirmedDraft.site.publicAccess,
    content.site.attachmentOptions,
    content.site.installSurfaceOptions,
    content.site.levelOptions,
    content.site.publicAccessOptions,
  ]);

  const extrasSummary =
    selectedConfirmedExtras.length > 0
      ? selectedConfirmedExtras.join(', ')
      : confirmedDraft.extrasAcknowledged
        ? 'No extras right now'
        : 'Not set';

  const timeframeSummary = labelFor(content.process.timeframeOptions, confirmedDraft.timeframe);

  const completedBriefRows = useMemo<BriefRow[]>(() => {
    const rows: BriefRow[] = [];
    if (completion.branch) {
      rows.push({ label: 'Path', value: branchSummary, step: 'branch' });
    }
    if (completion.roofStyle) {
      rows.push({ label: 'Roof style', value: roofStyleSummary, step: 'roofStyle' });
    }
    if (completion.roofMaterial) {
      rows.push({ label: 'Roof material', value: roofMaterialSummary, step: 'roofMaterial' });
    }
    if (completion.site) {
      rows.push({ label: 'Site + dimensions', value: siteSummary, step: 'site' });
    }
    if (completion.consent) {
      rows.push({ label: 'Consent check', value: confirmedConsentResult.title, step: 'consent' });
    }
    if (completion.extras) {
      rows.push({ label: 'Extras', value: extrasSummary, step: 'extras' });
    }
    if (completion.process) {
      rows.push({ label: 'Timeframe', value: timeframeSummary, step: 'process' });
    }
    return rows;
  }, [
    branchSummary,
    completion.branch,
    completion.consent,
    completion.extras,
    completion.process,
    completion.roofMaterial,
    completion.roofStyle,
    completion.site,
    confirmedConsentResult.title,
    extrasSummary,
    roofMaterialSummary,
    roofStyleSummary,
    siteSummary,
    timeframeSummary,
  ]);

  const consentCtaLabel =
    consentResult.code === 'building_consent_likely_required' ||
    consentResult.code === 'possibly_exempt_with_professional_signoff_20_to_30'
      ? 'Book a Design Consultation to review consent pathway'
      : 'Book a Design Consultation';

  const submitButtonLabel =
    submitState === 'sending'
      ? 'Booking...'
      : submitState === 'success'
        ? 'Booked'
        : 'Book Design Consultation';

  const publicAccessLabel =
    draft.enquiryType === 'commercial'
      ? 'Public access under or around the pergola?'
      : 'Do people outside your household use this area?';

  const progressLabel =
    submitState === 'success'
      ? `Complete: ${STEP_ORDER.length} of ${STEP_ORDER.length}`
      : `Step ${Math.min(firstIncompleteIndex + 1, STEP_ORDER.length)} of ${STEP_ORDER.length}`;

  const branchCanContinue = Boolean(draft.enquiryType);
  const roofStyleCanContinue = Boolean(draft.style);
  const roofMaterialCanContinue = isRoofMaterialDraftValid(draft);
  const siteCanContinue = isSiteDraftValid(draft);
  const extrasCanContinue = hasExtrasChoice(draft);
  const processCanContinue = Boolean(draft.timeframe);

  const reviewRows = completedBriefRows.filter((row) => row.step !== 'consent');

  return (
    <>
      <main className="container mx-auto px-4 py-8 pb-28 md:px-6 md:py-10 md:pb-28 lg:pb-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-6">
            <section id="start-hero" ref={setSectionRef('hero')} className="scroll-mt-24 rounded-2xl border border-border bg-panel">
              <div className="space-y-4 p-5 md:p-6">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Start</p>
                <h1
                  tabIndex={-1}
                  data-step-heading="true"
                  className="text-2xl font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-black/30 md:text-3xl"
                >
                  {content.hero.heading}
                </h1>
                <p className="max-w-2xl text-sm text-neutral-700">{content.hero.subheading}</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => jumpToSection('branch')}
                    className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                  >
                    {content.hero.startCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (visibleStepSet.has('submit')) {
                        jumpToSection('submit');
                        return;
                      }
                      jumpToSection(firstIncompleteStep);
                    }}
                    className="rounded border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                  >
                    {content.hero.skipCta}
                  </button>
                </div>

                {resumePromptOpen ? (
                  <div className="rounded-xl border border-border bg-white p-3">
                    <p className="text-sm font-medium text-neutral-900">Resume your design?</p>
                    <p className="mt-1 text-sm text-neutral-700">We found a saved draft on this device.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleResumeDesign}
                        className="rounded border border-black bg-black px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={handleStartOverFromPrompt}
                        className="rounded border border-border bg-white px-3 py-1.5 text-sm font-medium text-neutral-800"
                      >
                        Start over
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {visibleStepSet.has('branch') ? (
              <StepSection
                id="branch"
                stepLabel="Step 1"
                title={content.branch.heading}
                intro="Choose the path that best fits your project type."
                helper="Card clicks set a draft choice and open details. Continue confirms the step."
                isExpanded={firstIncompleteStep === 'branch'}
                isComplete={completion.branch}
                sectionRef={setSectionRef('branch')}
                collapsedSummary={branchSummary}
                onChange={() => handleStepChange('branch')}
                canContinue={branchCanContinue}
                onContinue={confirmBranch}
                continueLabel="Continue to Roof Style"
              >
                <OptionCardGroup
                  mode="single"
                  name="start-branch"
                  ariaLabel="Choose your path"
                  options={branchCards}
                  selectedValues={[draft.enquiryType]}
                  onSelectionChange={(value) => handleBranchSelection(value)}
                  onOptionOpen={(value) => handleBranchCardOpen(value)}
                  columnsClassName="grid gap-3 md:grid-cols-3"
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('roofStyle') ? (
              <StepSection
                id="roofStyle"
                stepLabel="Step 2"
                title={content.roofStyle.heading}
                intro="Browse forms and pick the roof character that matches your space."
                helper="Switching tabs in the modal will not change your selection until you explicitly select."
                isExpanded={firstIncompleteStep === 'roofStyle'}
                isComplete={completion.roofStyle}
                sectionRef={setSectionRef('roofStyle')}
                collapsedSummary={roofStyleSummary}
                onChange={() => handleStepChange('roofStyle')}
                canContinue={roofStyleCanContinue}
                onContinue={confirmRoofStyle}
                continueLabel="Continue to Roof Material"
              >
                <OptionCardGroup
                  mode="single"
                  name="start-style"
                  ariaLabel="Choose roof style"
                  options={roofStyleCards}
                  selectedValues={draft.style ? [draft.style] : []}
                  onSelectionChange={(value) => handleRoofStyleSelection(value)}
                  onOptionOpen={(value) => handleRoofStyleCardOpen(value)}
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('roofMaterial') ? (
              <StepSection
                id="roofMaterial"
                stepLabel="Step 3"
                title={content.roofMaterial.heading}
                intro="Set your roof material direction."
                helper="Material cards open a tabbed guide. Use the modal's refine panel for optional secondary preferences."
                isExpanded={firstIncompleteStep === 'roofMaterial'}
                isComplete={completion.roofMaterial}
                sectionRef={setSectionRef('roofMaterial')}
                collapsedSummary={roofMaterialSummary}
                onChange={() => handleStepChange('roofMaterial')}
                canContinue={roofMaterialCanContinue}
                onContinue={confirmRoofMaterial}
                continueLabel="Continue to Site Basics"
              >
                <OptionCardGroup
                  mode="single"
                  name="start-material"
                  ariaLabel="Choose roof material"
                  options={roofMaterialCards}
                  selectedValues={draft.roofMaterialChoice ? [draft.roofMaterialChoice] : []}
                  onSelectionChange={(value) => handleRoofMaterialSelection(value)}
                  onOptionOpen={(value) => handleRoofMaterialCardOpen(value)}
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('site') ? (
              <StepSection
                id="site"
                stepLabel="Step 4"
                title={content.site.heading}
                intro="Capture site basics and quick measurements."
                helper="This step stays draft-only until you press Continue."
                isExpanded={firstIncompleteStep === 'site'}
                isComplete={completion.site}
                sectionRef={setSectionRef('site')}
                collapsedSummary={siteSummary}
                onChange={() => handleStepChange('site')}
                canContinue={siteCanContinue}
                onContinue={confirmSite}
                continueLabel="Continue to Consent Quick-check"
              >
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <h3 className="text-base font-semibold text-neutral-900">4A. Site basics</h3>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-neutral-900">Suburb / city</span>
                    <input
                      type="text"
                      value={draft.suburb}
                      onChange={(event) => updateSuburb(event.target.value)}
                      className="w-full rounded border border-border px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">Install surface</p>
                    <OptionCardGroup
                      mode="single"
                      name="start-install-surface"
                      ariaLabel="Install surface"
                      options={installSurfaceCards}
                      selectedValues={draft.site.installSurface ? [draft.site.installSurface] : []}
                      onSelectionChange={(value) => updateSite('installSurface', value as InstallSurface)}
                      onOptionOpen={(value) => {
                        const option = installSurfaceCards.find((card) => card.value === value);
                        if (!option) return;
                        openQuickInfo({
                          title: option.title,
                          summary: option.summary,
                          image: option.image,
                        });
                      }}
                      columnsClassName="grid gap-3 md:grid-cols-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">Level / storey</p>
                    <OptionCardGroup
                      mode="single"
                      name="start-level"
                      ariaLabel="Level or storey"
                      options={levelCards}
                      selectedValues={draft.site.level ? [draft.site.level] : []}
                      onSelectionChange={(value) => updateSite('level', value as SiteLevel)}
                      onOptionOpen={(value) => {
                        const option = levelCards.find((card) => card.value === value);
                        if (!option) return;
                        openQuickInfo({
                          title: option.title,
                          summary: option.summary,
                          image: option.image,
                        });
                      }}
                      columnsClassName="grid gap-3 md:grid-cols-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">Attached to existing building?</p>
                    <OptionCardGroup
                      mode="single"
                      name="start-attachment"
                      ariaLabel="Attachment to existing building"
                      options={attachmentCards}
                      selectedValues={draft.site.attachment ? [draft.site.attachment] : []}
                      onSelectionChange={(value) => updateSite('attachment', value as SiteAttachment)}
                      onOptionOpen={(value) => {
                        const option = attachmentCards.find((card) => card.value === value);
                        if (!option) return;
                        openQuickInfo({
                          title: option.title,
                          summary: option.summary,
                          image: option.image,
                        });
                      }}
                      columnsClassName="grid gap-3 md:grid-cols-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">{publicAccessLabel}</p>
                    <OptionCardGroup
                      mode="single"
                      name="start-public-access"
                      ariaLabel="Public access"
                      options={publicAccessCards}
                      selectedValues={draft.site.publicAccess ? [draft.site.publicAccess] : []}
                      onSelectionChange={(value) => updateSite('publicAccess', value as PublicAccess)}
                      onOptionOpen={(value) => {
                        const option = publicAccessCards.find((card) => card.value === value);
                        if (!option) return;
                        openQuickInfo({
                          title: option.title,
                          summary: option.summary,
                          image: option.image,
                        });
                      }}
                      columnsClassName="grid gap-3 md:grid-cols-3"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border p-4">
                  <h3 className="text-base font-semibold text-neutral-900">4B. Quick measurements</h3>
                  <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-start">
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-neutral-900">
                          Length (along house){dimensionsRequired ? ' *' : ''}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={draft.dimensions.widthM}
                          onChange={(event) => updateDimension('widthM', event.target.value)}
                          className="w-full rounded border border-border px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-neutral-900">
                          Projection (out from house){dimensionsRequired ? ' *' : ''}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={draft.dimensions.depthM}
                          onChange={(event) => updateDimension('depthM', event.target.value)}
                          className="w-full rounded border border-border px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-neutral-900">Height (optional)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={draft.dimensions.heightM}
                          onChange={(event) => updateDimension('heightM', event.target.value)}
                          className="w-full rounded border border-border px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border border-border bg-neutral-50 p-2">
                      <Image
                        src="/start/measurement-diagram.svg"
                        alt="Simple diagram showing length along house, projection out, and height."
                        width={520}
                        height={360}
                        className="h-auto w-full rounded"
                      />
                    </div>
                  </div>

                  {dimensionsRequired && !(widthM && depthM) ? (
                    <p className="text-sm text-neutral-600">
                      Residential and commercial paths require length and projection before continuing.
                    </p>
                  ) : null}
                </div>
              </StepSection>
            ) : null}

            {visibleStepSet.has('consent') ? (
              <StepSection
                id="consent"
                stepLabel="Step 5"
                title={content.consent.heading}
                intro="This quick-check updates live as your dimensions and site inputs change."
                helper="Guidance only. Final consent pathway is confirmed during Design Consultation."
                isExpanded={firstIncompleteStep === 'consent'}
                isComplete={completion.consent}
                sectionRef={setSectionRef('consent')}
                collapsedSummary={confirmedConsentResult.title}
                onChange={() => handleStepChange('consent')}
                canContinue={consentPrerequisitesReady}
                onContinue={confirmConsent}
                continueLabel="Continue to Extras"
              >
                <ConsentResultCard
                  ready={consentPrerequisitesReady}
                  result={consentResult}
                  disclaimer={content.consent.disclaimer}
                  links={content.consent.links}
                  ctaLabel={consentCtaLabel}
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('extras') ? (
              <StepSection
                id="extras"
                stepLabel="Step 6"
                title={content.extras.heading}
                intro="Select one or more extras, or explicitly choose no extras for now."
                helper="Extras are draft selections until you press Continue."
                isExpanded={firstIncompleteStep === 'extras'}
                isComplete={completion.extras}
                sectionRef={setSectionRef('extras')}
                collapsedSummary={extrasSummary}
                onChange={() => handleStepChange('extras')}
                canContinue={extrasCanContinue}
                onContinue={confirmExtras}
                continueLabel="Continue to Timeframe"
              >
                <OptionCardGroup
                  mode="multi"
                  name="start-extras"
                  ariaLabel="Choose extras"
                  options={extrasCards}
                  selectedValues={selectedExtraIds}
                  onSelectionChange={(value, checked) => handleExtraSelectionChange(value, checked)}
                  onOptionOpen={(value) => handleExtraCardOpen(value)}
                  columnsClassName="grid gap-3 md:grid-cols-3"
                />

                <button
                  type="button"
                  onClick={() => setNoExtras(!draft.extrasAcknowledged)}
                  className={`rounded border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
                    draft.extrasAcknowledged
                      ? 'border-black bg-black text-white'
                      : 'border-border bg-white text-neutral-800 hover:border-neutral-500'
                  }`}
                >
                  {content.extras.noneLabel}
                </button>
              </StepSection>
            ) : null}

            {visibleStepSet.has('process') ? (
              <StepSection
                id="process"
                stepLabel="Step 7"
                title={content.process.heading}
                intro="Choose your intended timeframe for design and scheduling."
                helper="Timeframe is confirmed only when you press Continue."
                isExpanded={firstIncompleteStep === 'process'}
                isComplete={completion.process}
                sectionRef={setSectionRef('process')}
                collapsedSummary={timeframeSummary}
                onChange={() => handleStepChange('process')}
                canContinue={processCanContinue}
                onContinue={confirmProcess}
                continueLabel="Continue to Consultation Booking"
              >
                <ol className="grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                  {content.process.timeline.map((item, index) => (
                    <li key={item} className="rounded border border-border bg-neutral-50 px-3 py-2">
                      <span className="font-medium text-neutral-900">{index + 1}.</span> {item}
                    </li>
                  ))}
                </ol>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-900">Desired timeframe</p>
                  <OptionCardGroup
                    mode="single"
                    name="start-timeframe"
                    ariaLabel="Desired timeframe"
                    options={timeframeCards}
                    selectedValues={draft.timeframe ? [draft.timeframe] : []}
                    onSelectionChange={(value) => handleTimeframeSelection(value)}
                    onOptionOpen={(value) => handleTimeframeCardOpen(value)}
                    columnsClassName="grid gap-3 sm:grid-cols-2"
                  />
                </div>
              </StepSection>
            ) : null}

            {visibleStepSet.has('submit') ? (
              <StepSection
                id="submit"
                stepLabel="Step 8"
                title="Book your Design Consultation"
                intro="Submit your details so Sanctuary can schedule your Design Consultation."
                helper="Your completed brief is attached automatically."
                isExpanded={firstIncompleteStep === 'submit' || submitState === 'success'}
                isComplete={completion.submit}
                sectionRef={setSectionRef('submit')}
                collapsedSummary={submitMeta?.enquiryRequestId ? `Reference ${submitMeta.enquiryRequestId}` : 'Sent'}
              >
                {submitState === 'success' ? (
                  <div className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                    <p className="font-semibold">Thanks. Your Design Consultation request has been sent.</p>
                    <p className="mt-1">Our team will review your brief and follow up shortly.</p>
                    {submitMeta?.enquiryRequestId ? <p className="mt-2">Reference: {submitMeta.enquiryRequestId}</p> : null}
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2 rounded-lg border border-border bg-neutral-50 p-3">
                      <p className="text-sm font-semibold text-neutral-900">Review your confirmed brief</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {reviewRows.map((row) => (
                          <div key={`submit-${row.label}`} className="rounded border border-border bg-white px-2 py-1.5 text-xs">
                            <p className="uppercase tracking-[0.08em] text-neutral-500">{row.label}</p>
                            <p className="mt-1 text-sm text-neutral-800">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-neutral-900">Name *</span>
                        <input
                          type="text"
                          required
                          value={draft.name}
                          onChange={(event) => {
                            clearFeedback();
                            setFlow((previous) => ({
                              ...previous,
                              draft: {
                                ...previous.draft,
                                name: event.target.value,
                              },
                            }));
                          }}
                          className="w-full rounded border border-border px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-medium text-neutral-900">Phone *</span>
                        <input
                          type="tel"
                          required
                          value={draft.phone}
                          onChange={(event) => {
                            clearFeedback();
                            setFlow((previous) => ({
                              ...previous,
                              draft: {
                                ...previous.draft,
                                phone: event.target.value,
                              },
                            }));
                          }}
                          className="w-full rounded border border-border px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-neutral-900">Email (recommended)</span>
                      <input
                        type="email"
                        value={draft.email}
                        onChange={(event) => {
                          clearFeedback();
                          setFlow((previous) => ({
                            ...previous,
                            draft: {
                              ...previous.draft,
                              email: event.target.value,
                            },
                          }));
                        }}
                        className="w-full rounded border border-border px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="space-y-2 rounded border border-border p-3">
                      <p className="text-sm font-medium text-neutral-900">Photos (recommended)</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => handlePhotosSelected(event.target.files)}
                        className="block w-full text-sm"
                      />
                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={sendPhotosLater}
                          onChange={(event) => {
                            clearFeedback();
                            setSendPhotosLater(event.target.checked);
                          }}
                        />
                        <span>I'll send photos later</span>
                      </label>

                      {photoFiles.length > 0 ? (
                        <ul className="space-y-1 text-sm text-neutral-700">
                          {photoFiles.map((file, index) => (
                            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-2">
                              <span>{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removePhoto(file.name, index)}
                                className="text-xs uppercase tracking-[0.1em] underline underline-offset-4"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-neutral-900">Message</span>
                      <textarea
                        rows={4}
                        value={draft.message}
                        onChange={(event) => {
                          clearFeedback();
                          setFlow((previous) => ({
                            ...previous,
                            draft: {
                              ...previous.draft,
                              message: event.target.value,
                            },
                          }));
                        }}
                        className="w-full rounded border border-border px-3 py-2 text-sm"
                      />
                    </label>

                    {validationErrors.length > 0 ? (
                      <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                        <p className="font-medium">Please fix the following:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {validationErrors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {submitError ? (
                      <p className="text-sm text-rose-700" role="alert">
                        {submitError}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitState === 'sending'}
                      className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {submitButtonLabel}
                    </button>
                  </form>
                )}
              </StepSection>
            ) : null}
          </div>

          <aside className="hidden rounded-2xl border border-border bg-white p-4 lg:sticky lg:top-24 lg:block">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-700">Design brief</h2>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                >
                  Reset
                </button>
              </div>
              <p className="text-sm text-neutral-700">{progressLabel}</p>

              {completedBriefRows.length > 0 ? (
                <div className="space-y-2">
                  {completedBriefRows.map((row) => (
                    <div key={`brief-${row.label}`} className="rounded border border-border bg-neutral-50 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-[0.11em] text-neutral-500">{row.label}</p>
                        <button
                          type="button"
                          onClick={() => handleStepChange(row.step)}
                          className="text-[11px] font-medium uppercase tracking-[0.11em] text-neutral-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-neutral-800">{row.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Completed items will appear here as you confirm each step.</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/96 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setBriefSheetOpen(true)}
          className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-sm text-neutral-800">{progressLabel}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700">View brief</span>
        </button>
      </div>

      <ModalSurface
        open={Boolean(quickInfoModal)}
        title={quickInfoModal?.title ?? 'Option details'}
        description={quickInfoModal?.summary}
        onClose={() => setQuickInfoModal(null)}
      >
        {quickInfoModal ? (
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div className="relative overflow-hidden rounded-xl border border-border bg-neutral-100">
              <div className="relative aspect-[4/3]">
                <Image
                  src={quickInfoModal.image.src}
                  alt={quickInfoModal.image.alt}
                  fill
                  sizes="220px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-neutral-800">{quickInfoModal.summary ?? 'Review this option, then continue when ready.'}</p>
              <p className="text-xs text-neutral-600">Close this panel to keep browsing. Continue is confirmed on-page.</p>
            </div>
          </div>
        ) : null}
      </ModalSurface>

      <ModalSurface
        open={briefSheetOpen}
        title="Design Brief"
        description={progressLabel}
        onClose={() => setBriefSheetOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setBriefSheetOpen(false);
                handleReset();
              }}
              className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-700 underline underline-offset-4"
            >
              Reset
            </button>
          </div>
          {completedBriefRows.length > 0 ? (
            <div className="space-y-2">
              {completedBriefRows.map((row) => (
                <div key={`sheet-${row.label}`} className="rounded border border-border bg-neutral-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.11em] text-neutral-500">{row.label}</p>
                    <button
                      type="button"
                      onClick={() => handleStepChange(row.step)}
                      className="text-[11px] font-medium uppercase tracking-[0.11em] text-neutral-700 underline underline-offset-4"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-neutral-800">{row.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-600">Complete and confirm a step to add it to your brief.</p>
          )}
        </div>
      </ModalSurface>

      <TabbedOptionModal
        open={activeModal === 'branch'}
        title="Choose your project path"
        description="Browse each path before confirming your direction."
        options={branchModalOptions}
        activeTabId={branchTab}
        selectedDraftId={draft.enquiryType}
        onTabChange={setBranchTab}
        onSelect={(value) => handleBranchSelection(value)}
        onClose={() => setActiveModal(null)}
        onContinue={confirmBranch}
        primaryCtaLabel="Confirm & continue"
        canContinue={branchCanContinue}
      />

      <TabbedOptionModal
        open={activeModal === 'roofStyle'}
        title="Roof style guide"
        description="Use tabs to learn without changing your selection by accident."
        options={roofStyleModalOptions}
        activeTabId={roofStyleTab}
        selectedDraftId={draft.style}
        onTabChange={setRoofStyleTab}
        onSelect={(value) => handleRoofStyleSelection(value)}
        onClose={() => setActiveModal(null)}
        onContinue={confirmRoofStyle}
        renderSubPanel={(tabId) => {
          if (tabId !== 'pitched' || draft.style !== 'pitched') return null;
          return (
            <ConditionalSubPanel
              options={waterDirectionSubpanelOptions}
              value={draft.waterDirectionPreference}
              onChange={(value) => updateWaterDirectionPreference(value)}
            />
          );
        }}
        primaryCtaLabel="Confirm & continue"
        canContinue={roofStyleCanContinue}
      />

      <TabbedOptionModal
        open={activeModal === 'roofMaterial'}
        title="Roof material guide"
        description="Use tabs to compare material behavior without auto-selecting."
        options={roofMaterialModalOptions}
        activeTabId={roofMaterialTab}
        selectedDraftId={draft.roofMaterialChoice}
        onTabChange={setRoofMaterialTab}
        onSelect={(value) => handleRoofMaterialSelection(value)}
        onClose={() => setActiveModal(null)}
        onContinue={confirmRoofMaterial}
        renderSubPanel={(tabId) => {
          if (draft.roofMaterialChoice !== tabId) return null;
          if (tabId === 'timber') {
            return (
              <ConditionalSubPanel
                options={timberFinishSubpanelOptions}
                value={draft.timberFinish}
                onChange={(value) => updateTimberFinish(value)}
              />
            );
          }
          if (tabId === 'acrylic') {
            return (
              <ConditionalSubPanel
                options={acrylicLightFeelSubpanelOptions}
                value={draft.acrylicLightFeel}
                onChange={(value) => updateAcrylicLightFeel(value)}
              />
            );
          }
          if (tabId === 'combination') {
            return (
              <ConditionalSubPanel
                options={daylightPlacementSubpanelOptions}
                value={draft.daylightPlacement}
                onChange={(value) => updateDaylightPlacement(value)}
              />
            );
          }
          return null;
        }}
        primaryCtaLabel="Confirm & continue"
        canContinue={roofMaterialCanContinue}
      />

      <ExtrasExplorerModal
        open={activeModal === 'extras'}
        title="Extras Explorer"
        options={extrasModalOptions}
        activeExtraId={extrasTab}
        selectedExtraIds={selectedExtraIds}
        noExtras={draft.extrasAcknowledged}
        onActiveExtraChange={setExtrasTab}
        onToggleExtra={(extraId) =>
          handleExtraSelectionChange(extraId, !draft.extras[extraId])
        }
        onSetNoExtras={setNoExtras}
        onClose={() => setActiveModal(null)}
        onPrimary={confirmExtras}
        primaryLabel="Continue to Timeframe"
        primaryDisabled={!extrasCanContinue}
      />

      <TabbedOptionModal
        open={activeModal === 'process'}
        title="Timeframe guide"
        description="Pick your preferred timeline, then continue to consultation booking."
        options={timeframeModalOptions}
        activeTabId={timeframeTab}
        selectedDraftId={draft.timeframe}
        onTabChange={setTimeframeTab}
        onSelect={(value) => handleTimeframeSelection(value)}
        onClose={() => setActiveModal(null)}
        onContinue={confirmProcess}
        primaryCtaLabel="Confirm & continue"
        canContinue={processCanContinue}
      />

      <style jsx global>{`
        @keyframes start-step-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes start-modal-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes start-modal-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
        }

        @keyframes start-overlay-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes start-overlay-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .start-step-shell,
        .start-step-expanded,
        .start-step-collapsed {
          animation: start-step-in 220ms ease-out;
        }

        .start-modal-content[data-state='open'] {
          animation: start-modal-in 250ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .start-modal-content[data-state='closed'] {
          animation: start-modal-out 250ms ease-in;
        }

        .start-modal-overlay[data-state='open'] {
          animation: start-overlay-in 250ms ease-out;
        }

        .start-modal-overlay[data-state='closed'] {
          animation: start-overlay-out 250ms ease-in;
        }

        @media (prefers-reduced-motion: reduce) {
          .start-step-shell,
          .start-step-expanded,
          .start-step-collapsed,
          .start-modal-content,
          .start-modal-overlay {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }

          html:focus-within {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </>
  );
}
