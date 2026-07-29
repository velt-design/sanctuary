'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserMarketingAttribution } from '@/lib/attribution';
import {
  createEnquirySubmissionId,
  ENQUIRY_ATTACHMENT_ACCEPT,
  uploadEnquiryAttachments,
  validateEnquiryAttachments,
} from '@/lib/enquiryAttachments';
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

const TIMEFRAME_SUMMARY: Record<Timeframe, string> = {
  asap: 'As soon as practical.',
  one_to_three_months: 'Within 1–3 months.',
  three_to_six_months: 'Within 3–6 months.',
  researching: 'No set date yet.',
};

const INSTALL_SURFACE_SUMMARY: Record<InstallSurface, string> = {
  deck: 'Existing deck.',
  concrete_pad: 'Existing concrete.',
  pavers: 'Paver base needs checking.',
  ground_garden: 'New footings may be needed.',
  not_sure: "We'll check the site.",
};

const LEVEL_SUMMARY: Record<SiteLevel, string> = {
  ground: 'At ground level.',
  first: 'At first-storey level.',
  second_plus: 'Second storey or above.',
  not_sure: "We'll confirm from your site information.",
};

const ATTACHMENT_SUMMARY: Record<SiteAttachment, string> = {
  attached: 'Connects to the building.',
  freestanding: 'Independent of the building.',
  not_sure: "We'll assess the options.",
};

const ACCESS_SUMMARY: Record<PublicAccess, string> = {
  yes: 'Used by visitors or customers.',
  no: 'Private use.',
  not_sure: "We'll confirm this with you.",
};

const ACRYLIC_LIGHT_FEEL_SUMMARY: Record<AcrylicLightFeel, string> = {
  clear: 'Clear overhead light.',
  opal: 'Softer, diffused light.',
  tinted: 'Tinted daylight.',
  not_sure: 'Decide later.',
};

const TIMBER_FINISH_SUMMARY: Record<TimberFinish, string> = {
  natural: 'Natural timber.',
  stained: 'Stained timber.',
  painted: 'Painted finish.',
  not_sure: 'Decide later.',
};

const DAYLIGHT_PLACEMENT_SUMMARY: Record<DaylightPlacement, string> = {
  circulation: 'Daylight over circulation.',
  seating: 'Daylight over seating.',
  balanced: 'Balance daylight and shade.',
  not_sure: 'Decide later.',
};

const WATER_DIRECTION_SUMMARY: Record<WaterDirectionPreference, string> = {
  away_from_house: 'Fall away from the house.',
  toward_house: 'Fall toward the house gutter.',
  not_sure: 'Decide during design.',
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
    `Consent review: ${consentTitle} (area ${areaLabel})`,
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
  const submissionIdRef = useRef<string | null>(null);

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
    submissionIdRef.current = null;
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
    const fileError = validateEnquiryAttachments(photoFiles);
    if (fileError) errors.push(fileError);

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
      const submissionId = submissionIdRef.current ?? createEnquirySubmissionId();
      submissionIdRef.current = submissionId;
      const attachments = await uploadEnquiryAttachments(photoFiles, submissionId);
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

      const attribution = getBrowserMarketingAttribution();
      const payload = {
        submissionId,
        uploadSessionToken: attachments.uploadSessionToken,
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
        files: attachments.files,
        utm: attribution.utm,
        attribution,
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
      submissionIdRef.current = null;
      setSubmitMeta({
        contactId: json.contactId,
        projectId: json.projectId,
        enquiryRequestId: json.enquiryRequestId,
      });
      clearStartFlowDraft();
      jumpToSection('submit');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error instanceof Error && error.message ? error.message : 'A network error occurred while submitting. Please try again.');
    }
  };

  const branchCards = useMemo<OptionCardOption<EnquiryType>[]>(
    () =>
      content.branch.options.map((option) => ({
        value: option.value,
        title: option.label,
        summary: option.description,
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
        summary: TIMEFRAME_SUMMARY[option.value],
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
      })),
    [content.roofMaterial.options]
  );

  const timeframeModalOptions = useMemo<TabbedModalOption<Timeframe>[]>(
    () =>
      content.process.timeframeOptions.map((option) => ({
        id: option.value,
        label: option.label,
        summary: TIMEFRAME_SUMMARY[option.value],
        image: TIMEFRAME_MEDIA[option.value],
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
      rows.push({ label: 'Consent review', value: confirmedConsentResult.title, step: 'consent' });
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

  const submitButtonLabel =
    submitState === 'sending'
      ? 'Sending...'
      : submitState === 'success'
        ? 'Sent'
        : 'Send project brief';

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
                intro="Choose who the project is for."
                isExpanded={firstIncompleteStep === 'branch'}
                isComplete={completion.branch}
                sectionRef={setSectionRef('branch')}
                collapsedSummary={branchSummary}
                onChange={() => handleStepChange('branch')}
                canContinue={branchCanContinue}
                onContinue={confirmBranch}
                continueLabel="Continue"
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
                intro="Choose a form or ask us to recommend one."
                isExpanded={firstIncompleteStep === 'roofStyle'}
                isComplete={completion.roofStyle}
                sectionRef={setSectionRef('roofStyle')}
                collapsedSummary={roofStyleSummary}
                onChange={() => handleStepChange('roofStyle')}
                canContinue={roofStyleCanContinue}
                onContinue={confirmRoofStyle}
                continueLabel="Continue"
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
                intro="Choose a material or leave it open."
                isExpanded={firstIncompleteStep === 'roofMaterial'}
                isComplete={completion.roofMaterial}
                sectionRef={setSectionRef('roofMaterial')}
                collapsedSummary={roofMaterialSummary}
                onChange={() => handleStepChange('roofMaterial')}
                canContinue={roofMaterialCanContinue}
                onContinue={confirmRoofMaterial}
                continueLabel="Continue"
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
                intro="Add what you know. Rough measurements are fine."
                isExpanded={firstIncompleteStep === 'site'}
                isComplete={completion.site}
                sectionRef={setSectionRef('site')}
                collapsedSummary={siteSummary}
                onChange={() => handleStepChange('site')}
                canContinue={siteCanContinue}
                onContinue={confirmSite}
                continueLabel="Continue"
              >
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <h3 className="text-base font-semibold text-neutral-900">Site basics</h3>

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
                  <h3 className="text-base font-semibold text-neutral-900">Rough measurements</h3>
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
                      Add length and projection to continue.
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
                intro="Requirements are checked against the final project."
                isExpanded={firstIncompleteStep === 'consent'}
                isComplete={completion.consent}
                sectionRef={setSectionRef('consent')}
                collapsedSummary={confirmedConsentResult.title}
                onChange={() => handleStepChange('consent')}
                canContinue={consentPrerequisitesReady}
                onContinue={confirmConsent}
                continueLabel="Continue"
              >
                <ConsentResultCard
                  ready={consentPrerequisitesReady}
                  result={consentResult}
                  disclaimer={content.consent.disclaimer}
                  links={content.consent.links}
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('extras') ? (
              <StepSection
                id="extras"
                stepLabel="Step 6"
                title={content.extras.heading}
                intro="Choose any extras you want to discuss."
                isExpanded={firstIncompleteStep === 'extras'}
                isComplete={completion.extras}
                sectionRef={setSectionRef('extras')}
                collapsedSummary={extrasSummary}
                onChange={() => handleStepChange('extras')}
                canContinue={extrasCanContinue}
                onContinue={confirmExtras}
                continueLabel="Continue"
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
                intro="When would you like to start?"
                isExpanded={firstIncompleteStep === 'process'}
                isComplete={completion.process}
                sectionRef={setSectionRef('process')}
                collapsedSummary={timeframeSummary}
                onChange={() => handleStepChange('process')}
                canContinue={processCanContinue}
                onContinue={confirmProcess}
                continueLabel="Continue"
              >
                <div className="space-y-2">
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
                title={content.submit.heading}
                intro={content.submit.supportingCopy}
                isExpanded={firstIncompleteStep === 'submit' || submitState === 'success'}
                isComplete={completion.submit}
                sectionRef={setSectionRef('submit')}
                collapsedSummary={submitMeta?.enquiryRequestId ? `Reference ${submitMeta.enquiryRequestId}` : 'Sent'}
              >
                {submitState === 'success' ? (
                  <div className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                    <p className="font-semibold">Project brief sent.</p>
                    <p className="mt-1">We'll review it and contact you about the next step.</p>
                    {submitMeta?.enquiryRequestId ? <p className="mt-2">Reference: {submitMeta.enquiryRequestId}</p> : null}
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2 rounded-lg border border-border bg-neutral-50 p-3">
                      <p className="text-sm font-semibold text-neutral-900">Your brief</p>
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
                      <span className="text-sm font-medium text-neutral-900">Email</span>
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
                      <p className="text-sm font-medium text-neutral-900">Photos</p>
                      <input
                        type="file"
                        accept={ENQUIRY_ATTACHMENT_ACCEPT}
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
          <div className="relative overflow-hidden rounded-xl border border-border bg-neutral-100">
            <div className="relative aspect-[4/3]">
              <Image
                src={quickInfoModal.image.src}
                alt={quickInfoModal.image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover"
              />
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
            <p className="text-sm text-neutral-600">Your choices will appear here.</p>
          )}
        </div>
      </ModalSurface>

      <TabbedOptionModal
        open={activeModal === 'branch'}
        title="Project type"
        options={branchModalOptions}
        activeTabId={branchTab}
        selectedDraftId={draft.enquiryType}
        onTabChange={setBranchTab}
        onSelect={(value) => handleBranchSelection(value)}
        onClose={() => setActiveModal(null)}
        onContinue={confirmBranch}
        optionHeading={(option) => {
          if (option.id === 'professional') return 'Professional enquiries';
          return `${option.label} projects`;
        }}
        primaryCtaLabel="Confirm & continue"
        canContinue={branchCanContinue}
      />

      <TabbedOptionModal
        open={activeModal === 'roofStyle'}
        title="Roof style"
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
        title="Roof material"
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
        title="Extras"
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
        primaryLabel="Continue"
        primaryDisabled={!extrasCanContinue}
      />

      <TabbedOptionModal
        open={activeModal === 'process'}
        title="Timeframe"
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
