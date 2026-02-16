'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  START_FLOW_SCHEMA_VERSION,
  defaultStartFlowDraft,
  roofMaterialsByChoice,
  startFlowContent,
  type AcrylicTint,
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
} from './startFlowContent';
import { evaluateConsentQuickCheck } from './consentChecker';
import { clearStartFlowDraft, readStartFlowDraft, writeStartFlowDraft } from './startFlowStorage';
import {
  ACRYLIC_TINT_MEDIA,
  BRANCH_MEDIA,
  EXTRA_MEDIA,
  INSTALL_SURFACE_MEDIA,
  PUBLIC_ACCESS_MEDIA,
  ROOF_MATERIAL_MEDIA,
  ROOF_STYLE_MEDIA,
  SITE_ATTACHMENT_MEDIA,
  SITE_LEVEL_MEDIA,
  TIMEFRAME_MEDIA,
  TIMBER_FINISH_MEDIA,
  type MediaEntry,
} from './startFlowMedia';
import { ConsentResultCard, SelectCardGroup, StepSection, type SelectCardOption } from './startFlowComponents';

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

type SubmitState = 'idle' | 'sending' | 'success' | 'error';
type SubmitMeta = {
  contactId?: string;
  projectId?: string;
  enquiryRequestId?: string;
};

type SummaryRow = {
  label: string;
  value: string;
  step: StepId;
  thumbnail?: MediaEntry;
};

const STEP_ORDER: StepId[] = ['branch', 'roofStyle', 'roofMaterial', 'site', 'consent', 'extras', 'process', 'submit'];
const NEXT_SECTION: Record<StepId, StepId | null> = {
  branch: 'roofStyle',
  roofStyle: 'roofMaterial',
  roofMaterial: 'site',
  site: 'consent',
  consent: 'extras',
  extras: 'process',
  process: 'submit',
  submit: null,
};

const MAX_MESSAGE_LENGTH = 4000;
const MAX_PHOTO_COUNT = 8;

function defaultSiteForEnquiryType(enquiryType: EnquiryType): StartFlowDraft['site'] {
  return {
    ...defaultStartFlowDraft.site,
    publicAccess: enquiryType === 'commercial' ? 'yes' : 'not_sure',
  };
}

function createDefaultDraft(): StartFlowDraft {
  const defaultEnquiryType = defaultStartFlowDraft.enquiryType;
  return {
    ...defaultStartFlowDraft,
    site: defaultSiteForEnquiryType(defaultEnquiryType),
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: { ...defaultStartFlowDraft.extras },
  };
}

function emptyExtras(): StartFlowDraft['extras'] {
  return { ...defaultStartFlowDraft.extras };
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

function buildSummaryBlock(params: {
  draft: StartFlowDraft;
  areaM2: number | null;
  consentTitle: string;
  selectedExtras: string[];
}): string {
  const { draft, areaM2, consentTitle, selectedExtras } = params;
  const typeLabel = labelFor(startFlowContent.branch.options, draft.enquiryType);
  const roofStyleLabel = labelFor(startFlowContent.roofStyle.options, draft.style);
  const roofMaterialLabel =
    draft.roofMaterialChoice == null
      ? 'Not set'
      : draft.roofMaterialChoice === 'unsure'
        ? 'Unsure'
        : labelFor(startFlowContent.roofMaterial.options, draft.roofMaterialChoice);
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
    'Start-page brief',
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

function resetAfterBranchChange(previous: StartFlowDraft, enquiryType: EnquiryType): StartFlowDraft {
  return {
    ...previous,
    enquiryType,
    style: null,
    roofMaterialChoice: null,
    roofMaterials: [],
    acrylicTint: null,
    timberFinish: null,
    suburb: '',
    site: defaultSiteForEnquiryType(enquiryType),
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: emptyExtras(),
    extrasAcknowledged: false,
    timeframe: null,
  };
}

function resetAfterStyleChange(previous: StartFlowDraft, style: RoofStyle): StartFlowDraft {
  return {
    ...previous,
    style,
    roofMaterialChoice: null,
    roofMaterials: [],
    acrylicTint: null,
    timberFinish: null,
    suburb: '',
    site: defaultSiteForEnquiryType(previous.enquiryType),
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: emptyExtras(),
    extrasAcknowledged: false,
    timeframe: null,
  };
}

function resetAfterMaterialChange(previous: StartFlowDraft, roofMaterialChoice: RoofMaterialChoice): StartFlowDraft {
  return {
    ...previous,
    roofMaterialChoice,
    roofMaterials: [...roofMaterialsByChoice[roofMaterialChoice]],
    acrylicTint:
      roofMaterialChoice === 'acrylic' || roofMaterialChoice === 'combination' ? previous.acrylicTint : null,
    timberFinish:
      roofMaterialChoice === 'timber' || roofMaterialChoice === 'combination' ? previous.timberFinish : null,
    suburb: '',
    site: defaultSiteForEnquiryType(previous.enquiryType),
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: emptyExtras(),
    extrasAcknowledged: false,
    timeframe: null,
  };
}

function resetAfterSiteChange(previous: StartFlowDraft): StartFlowDraft {
  return {
    ...previous,
    extras: emptyExtras(),
    extrasAcknowledged: false,
    timeframe: null,
  };
}

function resetAfterExtrasChange(previous: StartFlowDraft): StartFlowDraft {
  return {
    ...previous,
    timeframe: null,
  };
}

export default function StartPage() {
  const content = startFlowContent;
  const [draft, setDraft] = useState<StartFlowDraft>(() => createDefaultDraft());
  const [storageReady, setStorageReady] = useState(false);
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
  const previousCompletionRef = useRef<Record<StepId, boolean> | null>(null);

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
    const restored = readStartFlowDraft(START_FLOW_SCHEMA_VERSION);
    if (restored) {
      const adjustedPublicAccess =
        restored.enquiryType !== 'commercial' && restored.site.publicAccess == null
          ? 'not_sure'
          : restored.site.publicAccess;

      setDraft({
        ...restored,
        site: {
          ...restored.site,
          publicAccess: adjustedPublicAccess,
        },
      });
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || submitState === 'success') return;
    writeStartFlowDraft(START_FLOW_SCHEMA_VERSION, draft);
  }, [draft, storageReady, submitState]);

  const dimensionsRequired = draft.enquiryType !== 'professional';
  const widthM = toPositiveNumber(draft.dimensions.widthM);
  const depthM = toPositiveNumber(draft.dimensions.depthM);
  const heightM = toPositiveNumber(draft.dimensions.heightM);
  const areaM2 = widthM && depthM ? widthM * depthM : null;
  const roofed = draft.roofMaterials.length > 0;

  const selectedExtraIds = useMemo(
    () => content.extras.options.filter((option) => draft.extras[option.value]).map((option) => option.value),
    [content.extras.options, draft.extras]
  );

  const selectedExtras = useMemo(
    () => content.extras.options.filter((option) => draft.extras[option.value]).map((option) => option.label),
    [content.extras.options, draft.extras]
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
    [roofed, draft.site.attachment, draft.site.level, draft.site.publicAccess, areaM2]
  );

  const completion = useMemo<Record<StepId, boolean>>(() => {
    const branchComplete = Boolean(draft.enquiryType);
    const roofStyleComplete = Boolean(draft.style);
    const roofMaterialComplete = Boolean(draft.roofMaterialChoice);

    const siteFieldsComplete = Boolean(
      draft.site.installSurface && draft.site.level && draft.site.attachment && draft.site.publicAccess
    );
    const dimensionsComplete = dimensionsRequired ? Boolean(widthM && depthM) : true;
    const siteComplete = siteFieldsComplete && dimensionsComplete;

    return {
      branch: branchComplete,
      roofStyle: roofStyleComplete,
      roofMaterial: roofMaterialComplete,
      site: siteComplete,
      consent: siteComplete,
      extras: draft.extrasAcknowledged || selectedExtras.length > 0,
      process: Boolean(draft.timeframe),
      submit: submitState === 'success',
    };
  }, [
    dimensionsRequired,
    draft.enquiryType,
    draft.extrasAcknowledged,
    draft.roofMaterialChoice,
    draft.site.attachment,
    draft.site.installSurface,
    draft.site.level,
    draft.site.publicAccess,
    draft.style,
    draft.timeframe,
    selectedExtras.length,
    submitState,
    widthM,
    depthM,
  ]);

  const firstIncompleteStep = useMemo<StepId>(() => STEP_ORDER.find((step) => !completion[step]) ?? 'submit', [completion]);
  const firstIncompleteIndex = STEP_ORDER.indexOf(firstIncompleteStep);
  const visibleSteps = useMemo(() => STEP_ORDER.slice(0, firstIncompleteIndex + 1), [firstIncompleteIndex]);
  const visibleStepSet = useMemo(() => new Set<StepId>(visibleSteps), [visibleSteps]);
  const visibleKey = visibleSteps.join('|');

  useEffect(() => {
    if (!storageReady) return;

    const previousCompletion = previousCompletionRef.current;
    previousCompletionRef.current = completion;

    if (!previousCompletion) return;

    for (const step of STEP_ORDER) {
      if (!previousCompletion[step] && completion[step]) {
        const next = NEXT_SECTION[step];
        if (next) {
          queueJumpTo(next);
        }
        break;
      }
    }
  }, [completion, queueJumpTo, storageReady]);

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

  const handleBranchSelect = (value: EnquiryType) => {
    clearFeedback();

    const changed = draft.enquiryType !== value;
    setDraft((previous) => {
      if (previous.enquiryType === value) return previous;
      return resetAfterBranchChange(previous, value);
    });

    if (changed) {
      queueJumpTo('roofStyle');
    }
  };

  const handleStyleSelect = (value: RoofStyle) => {
    clearFeedback();

    const changed = draft.style !== value;
    setDraft((previous) => {
      if (previous.style === value) return previous;
      return resetAfterStyleChange(previous, value);
    });

    if (changed) {
      queueJumpTo('roofMaterial');
    }
  };

  const handleMaterialSelect = (value: RoofMaterialChoice) => {
    clearFeedback();

    const changed = draft.roofMaterialChoice !== value;
    setDraft((previous) => {
      if (previous.roofMaterialChoice === value) return previous;
      return resetAfterMaterialChange(previous, value);
    });

    if (changed) {
      queueJumpTo('site');
    }
  };

  const updateSite = <K extends keyof StartFlowDraft['site']>(key: K, value: StartFlowDraft['site'][K]) => {
    clearFeedback();

    setDraft((previous) => {
      if (previous.site[key] === value) return previous;
      const nextDraft = {
        ...previous,
        site: {
          ...previous.site,
          [key]: value,
        },
      };
      return resetAfterSiteChange(nextDraft);
    });
  };

  const updateSuburb = (value: string) => {
    clearFeedback();

    setDraft((previous) => {
      if (previous.suburb === value) return previous;
      return resetAfterSiteChange({
        ...previous,
        suburb: value,
      });
    });
  };

  const updateDimension = <K extends keyof StartFlowDraft['dimensions']>(
    key: K,
    value: StartFlowDraft['dimensions'][K]
  ) => {
    clearFeedback();

    setDraft((previous) => {
      if (previous.dimensions[key] === value) return previous;
      const nextDraft = {
        ...previous,
        dimensions: {
          ...previous.dimensions,
          [key]: value,
        },
      };
      return resetAfterSiteChange(nextDraft);
    });
  };

  const handleExtraToggle = (extraId: ExtraId) => {
    clearFeedback();

    setDraft((previous) => {
      const nextChecked = !previous.extras[extraId];
      const changed = previous.extras[extraId] !== nextChecked || previous.extrasAcknowledged;
      if (!changed) return previous;

      const nextDraft = {
        ...previous,
        extras: {
          ...previous.extras,
          [extraId]: nextChecked,
        },
        extrasAcknowledged: false,
      };

      return resetAfterExtrasChange(nextDraft);
    });

    queueJumpTo('process');
  };

  const handleNoExtras = () => {
    clearFeedback();

    setDraft((previous) => {
      const hadAnyExtras = Object.values(previous.extras).some(Boolean);
      if (!hadAnyExtras && previous.extrasAcknowledged) return previous;

      const nextDraft = {
        ...previous,
        extras: emptyExtras(),
        extrasAcknowledged: true,
      };

      return resetAfterExtrasChange(nextDraft);
    });

    queueJumpTo('process');
  };

  const handleTimeframeSelect = (value: Timeframe) => {
    clearFeedback();

    const changed = draft.timeframe !== value;
    setDraft((previous) => {
      if (previous.timeframe === value) return previous;
      return {
        ...previous,
        timeframe: value,
      };
    });

    if (changed) {
      queueJumpTo('submit');
    }
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
    setDraft(createDefaultDraft());
    setPhotoFiles([]);
    setSendPhotosLater(false);
    setValidationErrors([]);
    setSubmitError(null);
    setSubmitMeta(null);
    setSubmitState('idle');
    clearStartFlowDraft();
    pendingJumpRef.current = null;
    previousCompletionRef.current = null;
    jumpToSection('hero');
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
      setSubmitError('Please fix the form issues and submit again.');
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
        acrylicTint: draft.acrylicTint,
        timberFinish: draft.timberFinish,
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
        const errorMessage = typeof json?.error === 'string' ? json.error : 'Unable to submit your brief.';
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

  const branchCards = useMemo<SelectCardOption<EnquiryType>[]>(
    () =>
      content.branch.options.map((option) => ({
        value: option.value,
        title: option.label,
        description: option.description,
        image: BRANCH_MEDIA[option.value],
        tag: option.value === 'residential' ? 'Default' : undefined,
      })),
    [content.branch.options]
  );

  const roofStyleCards = useMemo<SelectCardOption<RoofStyle>[]>(
    () =>
      content.roofStyle.options.map((option) => ({
        value: option.value,
        title: option.label,
        description: option.what,
        bullets: option.bestWhen.map((item) => `Best for ${item.toLowerCase()}`),
        hint: `Consider: ${option.watchOut}`,
        image: ROOF_STYLE_MEDIA[option.value],
      })),
    [content.roofStyle.options]
  );

  const roofMaterialCards = useMemo<SelectCardOption<RoofMaterialChoice>[]>(
    () =>
      content.roofMaterial.options.map((option) => ({
        value: option.value,
        title: option.label,
        description: option.description,
        image: ROOF_MATERIAL_MEDIA[option.value],
      })),
    [content.roofMaterial.options]
  );

  const acrylicTintCards = useMemo<SelectCardOption<AcrylicTint>[]>(
    () =>
      content.roofMaterial.acrylicTintOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: ACRYLIC_TINT_MEDIA[option.value],
      })),
    [content.roofMaterial.acrylicTintOptions]
  );

  const timberFinishCards = useMemo<SelectCardOption<TimberFinish>[]>(
    () =>
      content.roofMaterial.timberFinishOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: TIMBER_FINISH_MEDIA[option.value],
      })),
    [content.roofMaterial.timberFinishOptions]
  );

  const installSurfaceCards = useMemo<SelectCardOption<InstallSurface>[]>(
    () =>
      content.site.installSurfaceOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: INSTALL_SURFACE_MEDIA[option.value],
      })),
    [content.site.installSurfaceOptions]
  );

  const levelCards = useMemo<SelectCardOption<SiteLevel>[]>(
    () =>
      content.site.levelOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: SITE_LEVEL_MEDIA[option.value],
      })),
    [content.site.levelOptions]
  );

  const attachmentCards = useMemo<SelectCardOption<SiteAttachment>[]>(
    () =>
      content.site.attachmentOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: SITE_ATTACHMENT_MEDIA[option.value],
      })),
    [content.site.attachmentOptions]
  );

  const publicAccessCards = useMemo<SelectCardOption<PublicAccess>[]>(
    () =>
      content.site.publicAccessOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: PUBLIC_ACCESS_MEDIA[option.value],
      })),
    [content.site.publicAccessOptions]
  );

  const extrasCards = useMemo<SelectCardOption<ExtraId>[]>(
    () =>
      content.extras.options.map((option) => ({
        value: option.value,
        title: option.label,
        description: option.description,
        image: EXTRA_MEDIA[option.value],
      })),
    [content.extras.options]
  );

  const timeframeCards = useMemo<SelectCardOption<Timeframe>[]>(
    () =>
      content.process.timeframeOptions.map((option) => ({
        value: option.value,
        title: option.label,
        image: TIMEFRAME_MEDIA[option.value],
      })),
    [content.process.timeframeOptions]
  );

  const summaryRows = useMemo<SummaryRow[]>(
    () => [
      {
        label: 'Path',
        value: labelFor(content.branch.options, draft.enquiryType),
        step: 'branch',
        thumbnail: BRANCH_MEDIA[draft.enquiryType],
      },
      {
        label: 'Roof style',
        value: labelFor(content.roofStyle.options, draft.style),
        step: 'roofStyle',
        thumbnail: draft.style ? ROOF_STYLE_MEDIA[draft.style] : undefined,
      },
      {
        label: 'Roof material',
        value: draft.roofMaterialChoice ? labelFor(content.roofMaterial.options, draft.roofMaterialChoice) : 'Not set',
        step: 'roofMaterial',
        thumbnail: draft.roofMaterialChoice ? ROOF_MATERIAL_MEDIA[draft.roofMaterialChoice] : undefined,
      },
      {
        label: 'Site',
        value:
          draft.site.installSurface && draft.site.level
            ? `${labelFor(content.site.installSurfaceOptions, draft.site.installSurface)} - ${labelFor(content.site.levelOptions, draft.site.level)}`
            : 'Not set',
        step: 'site',
        thumbnail: draft.site.installSurface ? INSTALL_SURFACE_MEDIA[draft.site.installSurface] : undefined,
      },
      {
        label: 'Dimensions',
        value:
          draft.dimensions.widthM || draft.dimensions.depthM || draft.dimensions.heightM
            ? `${draft.dimensions.widthM || '-'}m x ${draft.dimensions.depthM || '-'}m x ${draft.dimensions.heightM || '-'}m`
            : 'Not set',
        step: 'site',
      },
      {
        label: 'Consent',
        value: consentResult.title,
        step: 'consent',
      },
      {
        label: 'Extras',
        value:
          selectedExtras.length > 0
            ? selectedExtras.join(', ')
            : draft.extrasAcknowledged
              ? 'No extras right now'
              : 'Not set',
        step: 'extras',
        thumbnail: selectedExtraIds[0] ? EXTRA_MEDIA[selectedExtraIds[0]] : undefined,
      },
      {
        label: 'Timeframe',
        value: labelFor(content.process.timeframeOptions, draft.timeframe),
        step: 'process',
        thumbnail: draft.timeframe ? TIMEFRAME_MEDIA[draft.timeframe] : undefined,
      },
    ],
    [
      content.branch.options,
      content.process.timeframeOptions,
      content.roofMaterial.options,
      content.roofStyle.options,
      content.site.installSurfaceOptions,
      content.site.levelOptions,
      consentResult.title,
      draft.dimensions.depthM,
      draft.dimensions.heightM,
      draft.dimensions.widthM,
      draft.enquiryType,
      draft.extrasAcknowledged,
      draft.roofMaterialChoice,
      draft.site.installSurface,
      draft.site.level,
      draft.style,
      draft.timeframe,
      selectedExtraIds,
      selectedExtras,
    ]
  );

  const submitButtonLabel =
    submitState === 'sending' ? 'Submitting...' : submitState === 'success' ? 'Submitted' : 'Submit brief';

  const publicAccessLabel =
    draft.enquiryType === 'commercial'
      ? 'Public access under/around the pergola?'
      : 'Do people other than your household use this area?';

  const handleSummaryEdit = (step: StepId) => {
    if (visibleStepSet.has(step)) {
      jumpToSection(step);
      return;
    }

    jumpToSection(firstIncompleteStep);
  };

  const inFlowReviewRows = summaryRows.filter((row) => row.step !== 'process');

  return (
    <>
      <main className="container mx-auto px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-6">
            <section id="start-hero" ref={setSectionRef('hero')} className="scroll-mt-24 rounded-xl border border-border bg-panel">
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
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                  Schema version: {START_FLOW_SCHEMA_VERSION}
                </p>
              </div>
            </section>

            {visibleStepSet.has('branch') ? (
              <StepSection
                id="branch"
                eyebrow="Step 1"
                title={content.branch.heading}
                intro="Choose the closest path. You can switch it later if your brief changes."
                helper="If you're unsure, choose the closest fit and continue."
                complete={completion.branch}
                sectionRef={setSectionRef('branch')}
                nextTeaser={completion.branch ? 'Next: roof style visual guide.' : undefined}
              >
                <SelectCardGroup
                  mode="single"
                  name="start-branch"
                  ariaLabel="Choose your path"
                  options={branchCards}
                  selectedValues={[draft.enquiryType]}
                  onChange={(value) => handleBranchSelect(value)}
                  columnsClassName="grid gap-3 md:grid-cols-3"
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('roofStyle') ? (
              <StepSection
                id="roofStyle"
                eyebrow="Step 2"
                title={content.roofStyle.heading}
                intro="Choose the roof shape. This sets the design direction before material options."
                helper="Not sure is always valid. We can recommend a style from your photos."
                complete={completion.roofStyle}
                sectionRef={setSectionRef('roofStyle')}
                nextTeaser={completion.roofStyle ? 'Next: roofing material.' : undefined}
              >
                <SelectCardGroup
                  mode="single"
                  name="start-style"
                  ariaLabel="Choose roof style"
                  options={roofStyleCards}
                  selectedValues={draft.style ? [draft.style] : []}
                  onChange={(value) => handleStyleSelect(value)}
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('roofMaterial') ? (
              <StepSection
                id="roofMaterial"
                eyebrow="Step 3"
                title={content.roofMaterial.heading}
                intro="Choose how the roof feels and performs."
                helper="We'll use this to shape daylight, shade, and comfort recommendations."
                complete={completion.roofMaterial}
                sectionRef={setSectionRef('roofMaterial')}
                nextTeaser={completion.roofMaterial ? 'Next: site details and measurements.' : undefined}
              >
                <SelectCardGroup
                  mode="single"
                  name="start-material"
                  ariaLabel="Choose roof material"
                  options={roofMaterialCards}
                  selectedValues={draft.roofMaterialChoice ? [draft.roofMaterialChoice] : []}
                  onChange={(value) => handleMaterialSelect(value)}
                />

                {draft.roofMaterialChoice === 'acrylic' || draft.roofMaterialChoice === 'combination' ? (
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <p className="text-sm font-medium text-neutral-900">Light feel (acrylic tint)</p>
                    <SelectCardGroup
                      mode="single"
                      name="start-acrylic-tint"
                      ariaLabel="Choose acrylic tint"
                      options={acrylicTintCards}
                      selectedValues={draft.acrylicTint ? [draft.acrylicTint] : []}
                      onChange={(value) => {
                        clearFeedback();
                        setDraft((previous) => ({ ...previous, acrylicTint: value }));
                      }}
                      columnsClassName="grid gap-3 grid-cols-2 md:grid-cols-3"
                    />
                  </div>
                ) : null}

                {draft.roofMaterialChoice === 'timber' || draft.roofMaterialChoice === 'combination' ? (
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <p className="text-sm font-medium text-neutral-900">Timber finish</p>
                    <SelectCardGroup
                      mode="single"
                      name="start-timber-finish"
                      ariaLabel="Choose timber finish"
                      options={timberFinishCards}
                      selectedValues={draft.timberFinish ? [draft.timberFinish] : []}
                      onChange={(value) => {
                        clearFeedback();
                        setDraft((previous) => ({ ...previous, timberFinish: value }));
                      }}
                      columnsClassName="grid gap-3 grid-cols-2 md:grid-cols-4"
                    />
                  </div>
                ) : null}
              </StepSection>
            ) : null}

            {visibleStepSet.has('site') ? (
              <StepSection
                id="site"
                eyebrow="Step 4"
                title={content.site.heading}
                intro="A quick site snapshot helps us guide consent and estimate paths."
                helper={content.site.measureHelp}
                complete={completion.site}
                sectionRef={setSectionRef('site')}
                nextTeaser={completion.site ? 'Next: consent quick-check result.' : undefined}
              >
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <h3 className="text-base font-semibold text-neutral-900">4A. Where is it going?</h3>

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
                    <SelectCardGroup
                      mode="single"
                      name="start-install-surface"
                      ariaLabel="Install surface"
                      options={installSurfaceCards}
                      selectedValues={draft.site.installSurface ? [draft.site.installSurface] : []}
                      onChange={(value) => updateSite('installSurface', value as InstallSurface)}
                      columnsClassName="grid gap-3 md:grid-cols-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">Level / storey</p>
                    <SelectCardGroup
                      mode="single"
                      name="start-level"
                      ariaLabel="Level or storey"
                      options={levelCards}
                      selectedValues={draft.site.level ? [draft.site.level] : []}
                      onChange={(value) => updateSite('level', value as SiteLevel)}
                      columnsClassName="grid gap-3 md:grid-cols-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">Attached to existing building?</p>
                    <SelectCardGroup
                      mode="single"
                      name="start-attachment"
                      ariaLabel="Attachment to existing building"
                      options={attachmentCards}
                      selectedValues={draft.site.attachment ? [draft.site.attachment] : []}
                      onChange={(value) => updateSite('attachment', value as SiteAttachment)}
                      columnsClassName="grid gap-3 md:grid-cols-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">{publicAccessLabel}</p>
                    <SelectCardGroup
                      mode="single"
                      name="start-public-access"
                      ariaLabel="Public access"
                      options={publicAccessCards}
                      selectedValues={draft.site.publicAccess ? [draft.site.publicAccess] : []}
                      onChange={(value) => updateSite('publicAccess', value as PublicAccess)}
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
                eyebrow="Step 5"
                title={content.consent.heading}
                intro="A fast guidance check using your current answers."
                helper="This is a quick indication, not a formal consent decision."
                complete={completion.consent}
                sectionRef={setSectionRef('consent')}
                nextTeaser={completion.consent ? 'Next: comfort and add-ons.' : undefined}
              >
                <ConsentResultCard
                  result={consentResult}
                  disclaimer={content.consent.disclaimer}
                  links={content.consent.links}
                />
              </StepSection>
            ) : null}

            {visibleStepSet.has('extras') ? (
              <StepSection
                id="extras"
                eyebrow="Step 6"
                title={content.extras.heading}
                intro="Pick optional features to shape comfort, lighting, and scope."
                helper="Select any that matter now, or skip and keep moving."
                complete={completion.extras}
                sectionRef={setSectionRef('extras')}
                nextTeaser={completion.extras ? 'Next: process and timing.' : undefined}
              >
                <SelectCardGroup
                  mode="multi"
                  name="start-extras"
                  ariaLabel="Choose extras"
                  options={extrasCards}
                  selectedValues={selectedExtraIds}
                  onChange={(value) => handleExtraToggle(value)}
                  columnsClassName="grid gap-3 md:grid-cols-3"
                />

                <button
                  type="button"
                  onClick={handleNoExtras}
                  className="rounded border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                >
                  {content.extras.noneLabel}
                </button>
              </StepSection>
            ) : null}

            {visibleStepSet.has('process') ? (
              <StepSection
                id="process"
                eyebrow="Step 7"
                title={content.process.heading}
                intro="This is the typical journey from first brief to on-site completion."
                helper="Tell us your timeframe so we can prioritise follow-up."
                complete={completion.process}
                sectionRef={setSectionRef('process')}
                nextTeaser={completion.process ? 'Next: send your brief.' : undefined}
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
                  <SelectCardGroup
                    mode="single"
                    name="start-timeframe"
                    ariaLabel="Desired timeframe"
                    options={timeframeCards}
                    selectedValues={draft.timeframe ? [draft.timeframe] : []}
                    onChange={(value) => handleTimeframeSelect(value)}
                    columnsClassName="grid gap-3 sm:grid-cols-2"
                  />
                </div>
              </StepSection>
            ) : null}

            {visibleStepSet.has('submit') ? (
              <StepSection
                id="submit"
                eyebrow="Step 8"
                title="Send your brief"
                intro="Submit directly to Sanctuary via /api/enquiry. Name and phone are required."
                helper="Your summary updates live as you edit above."
                complete={completion.submit}
                sectionRef={setSectionRef('submit')}
              >
                {submitState === 'success' ? (
                  <div className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                    <p className="font-semibold">Thanks. Your brief has been submitted.</p>
                    <p className="mt-1">We will review your details and follow up shortly.</p>
                    {submitMeta?.enquiryRequestId ? <p className="mt-2">Reference: {submitMeta.enquiryRequestId}</p> : null}
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2 rounded-lg border border-border bg-neutral-50 p-3">
                      <p className="text-sm font-semibold text-neutral-900">Review your brief</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {inFlowReviewRows.map((row) => (
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
                            setDraft((previous) => ({ ...previous, name: event.target.value }));
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
                            setDraft((previous) => ({ ...previous, phone: event.target.value }));
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
                          setDraft((previous) => ({ ...previous, email: event.target.value }));
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
                          setDraft((previous) => ({ ...previous, message: event.target.value }));
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
          <aside className="rounded-xl border border-border bg-white p-4 lg:sticky lg:top-24">
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

              <div className="space-y-2">
                {summaryRows.map((row) => (
                  <div key={row.label} className="rounded border border-border bg-neutral-50 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.11em] text-neutral-500">{row.label}</p>
                      <button
                        type="button"
                        onClick={() => handleSummaryEdit(row.step)}
                        className="text-[11px] font-medium uppercase tracking-[0.11em] text-neutral-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {row.thumbnail ? (
                        <Image
                          src={row.thumbnail.src}
                          alt={row.thumbnail.alt}
                          width={44}
                          height={32}
                          className="h-8 w-11 rounded object-cover"
                        />
                      ) : null}
                      <p className="text-sm text-neutral-800">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedExtras.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedExtras.map((extra) => (
                    <span
                      key={extra}
                      className="rounded-full border border-border bg-neutral-100 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-neutral-700"
                    >
                      {extra}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="text-xs text-neutral-500">Current route: /start</p>
            </div>
          </aside>
        </div>
      </main>

      <style jsx global>{`
        @keyframes start-step-reveal {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .start-step-reveal {
          animation: start-step-reveal 220ms ease-out;
        }
      `}</style>
    </>
  );
}
