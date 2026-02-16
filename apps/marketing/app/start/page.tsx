'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

type SubmitState = 'idle' | 'sending' | 'success' | 'error';
type SubmitMeta = {
  contactId?: string;
  projectId?: string;
  enquiryRequestId?: string;
};

const NEXT_SECTION: Record<SectionId, SectionId | null> = {
  hero: 'branch',
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

function createDefaultDraft(): StartFlowDraft {
  return {
    ...defaultStartFlowDraft,
    site: { ...defaultStartFlowDraft.site },
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: { ...defaultStartFlowDraft.extras },
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

type StepSectionProps = {
  id: SectionId;
  stepLabel: string;
  title: string;
  intro?: string;
  locked?: boolean;
  complete?: boolean;
  lockHint?: string;
  sectionRef: (node: HTMLElement | null) => void;
  children: ReactNode;
};

function StepSection({
  id,
  stepLabel,
  title,
  intro,
  locked = false,
  complete = false,
  lockHint = 'Complete the previous step to unlock this section.',
  sectionRef,
  children,
}: StepSectionProps) {
  return (
    <section
      id={`start-${id}`}
      ref={sectionRef}
      aria-disabled={locked ? 'true' : undefined}
      className="scroll-mt-24 rounded border border-border bg-white"
    >
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">{stepLabel}</p>
            <h2
              tabIndex={-1}
              data-step-heading="true"
              className="text-xl font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              {title}
            </h2>
            {intro ? <p className="max-w-3xl text-sm text-neutral-700">{intro}</p> : null}
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            {locked ? 'Locked' : complete ? 'Complete' : 'In progress'}
          </p>
        </div>
        <fieldset disabled={locked} className={locked ? 'space-y-4 opacity-55' : 'space-y-4'}>
          {children}
        </fieldset>
        {locked ? <p className="text-sm text-neutral-600">{lockHint}</p> : null}
      </div>
    </section>
  );
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

  useEffect(() => {
    const restored = readStartFlowDraft(START_FLOW_SCHEMA_VERSION);
    if (restored) {
      setDraft(restored);
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

  const completion = useMemo(() => {
    const branchComplete = Boolean(draft.enquiryType);
    const styleComplete = Boolean(draft.style);
    const materialComplete = Boolean(draft.roofMaterialChoice);
    const siteFieldsComplete = Boolean(
      draft.site.installSurface && draft.site.level && draft.site.attachment && draft.site.publicAccess
    );
    const dimensionsComplete = dimensionsRequired ? Boolean(widthM && depthM) : true;
    const siteComplete = siteFieldsComplete && dimensionsComplete;
    const consentComplete = siteComplete;
    const extrasComplete = draft.extrasAcknowledged || selectedExtras.length > 0;
    const processComplete = Boolean(draft.timeframe);
    const submitComplete = submitState === 'success';

    return {
      branch: branchComplete,
      roofStyle: styleComplete,
      roofMaterial: materialComplete,
      site: siteComplete,
      consent: consentComplete,
      extras: extrasComplete,
      process: processComplete,
      submit: submitComplete,
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

  const locked = {
    roofStyle: !completion.branch,
    roofMaterial: !completion.roofStyle,
    site: !completion.roofMaterial,
    consent: !completion.site,
    extras: !completion.consent,
    process: !completion.extras,
    submit: !completion.process,
  };

  const wasSiteCompleteRef = useRef(completion.site);
  useEffect(() => {
    if (!wasSiteCompleteRef.current && completion.site) {
      jumpToSection('consent');
    }
    wasSiteCompleteRef.current = completion.site;
  }, [completion.site, jumpToSection]);

  const clearFeedback = () => {
    setValidationErrors([]);
    setSubmitError(null);
    if (submitState === 'error') {
      setSubmitState('idle');
    }
  };

  const handleBranchSelect = (value: EnquiryType) => {
    clearFeedback();
    setDraft((previous) => ({
      ...previous,
      enquiryType: value,
      site: {
        ...previous.site,
        publicAccess: value === 'commercial' ? 'yes' : previous.site.publicAccess,
      },
    }));

    const next = NEXT_SECTION.branch;
    if (next) jumpToSection(next);
  };

  const handleStyleSelect = (value: RoofStyle) => {
    clearFeedback();
    setDraft((previous) => ({ ...previous, style: value }));
    const next = NEXT_SECTION.roofStyle;
    if (next) jumpToSection(next);
  };

  const handleMaterialSelect = (value: RoofMaterialChoice) => {
    clearFeedback();
    setDraft((previous) => ({
      ...previous,
      roofMaterialChoice: value,
      roofMaterials: [...roofMaterialsByChoice[value]],
      acrylicTint:
        value === 'acrylic' || value === 'combination' ? previous.acrylicTint : (null as AcrylicTint | null),
      timberFinish:
        value === 'timber' || value === 'combination' ? previous.timberFinish : (null as TimberFinish | null),
    }));

    const next = NEXT_SECTION.roofMaterial;
    if (next) jumpToSection(next);
  };

  const updateSite = <K extends keyof StartFlowDraft['site']>(key: K, value: StartFlowDraft['site'][K]) => {
    clearFeedback();
    setDraft((previous) => ({
      ...previous,
      site: {
        ...previous.site,
        [key]: value,
      },
    }));
  };

  const updateDimension = <K extends keyof StartFlowDraft['dimensions']>(
    key: K,
    value: StartFlowDraft['dimensions'][K]
  ) => {
    clearFeedback();
    setDraft((previous) => ({
      ...previous,
      dimensions: {
        ...previous.dimensions,
        [key]: value,
      },
    }));
  };

  const handleExtraToggle = (extraId: ExtraId) => {
    clearFeedback();
    const wasComplete = completion.extras;
    setDraft((previous) => ({
      ...previous,
      extras: {
        ...previous.extras,
        [extraId]: !previous.extras[extraId],
      },
      extrasAcknowledged: false,
    }));

    if (!wasComplete) {
      const next = NEXT_SECTION.extras;
      if (next) jumpToSection(next);
    }
  };

  const handleNoExtras = () => {
    clearFeedback();
    const wasComplete = completion.extras;
    setDraft((previous) => ({
      ...previous,
      extras: {
        blinds: false,
        slats: false,
        acrylic_infills: false,
        downlights: false,
        led_strips: false,
        heaters: false,
      },
      extrasAcknowledged: true,
    }));

    if (!wasComplete) {
      const next = NEXT_SECTION.extras;
      if (next) jumpToSection(next);
    }
  };

  const handleTimeframeSelect = (value: Timeframe) => {
    clearFeedback();
    setDraft((previous) => ({ ...previous, timeframe: value }));
    const next = NEXT_SECTION.process;
    if (next) jumpToSection(next);
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

    if (locked.submit) {
      const errors = ['Please complete all previous steps before submitting.'];
      setValidationErrors(errors);
      setSubmitState('error');
      setSubmitError(errors[0]);
      jumpToSection('process');
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

  const summaryRows = [
    { label: 'Type', value: labelFor(content.branch.options, draft.enquiryType), step: 'branch' as const },
    { label: 'Roof style', value: labelFor(content.roofStyle.options, draft.style), step: 'roofStyle' as const },
    {
      label: 'Roof material',
      value: labelFor(content.roofMaterial.options, draft.roofMaterialChoice),
      step: 'roofMaterial' as const,
    },
    {
      label: 'Dimensions',
      value:
        draft.dimensions.widthM || draft.dimensions.depthM || draft.dimensions.heightM
          ? `${draft.dimensions.widthM || '-'}m x ${draft.dimensions.depthM || '-'}m x ${draft.dimensions.heightM || '-'}m`
          : 'Not set',
      step: 'site' as const,
    },
    {
      label: 'Consent',
      value: consentResult.title,
      step: 'consent' as const,
    },
    {
      label: 'Extras',
      value:
        selectedExtras.length > 0
          ? selectedExtras.join(', ')
          : draft.extrasAcknowledged
            ? 'No extras right now'
            : 'Not set',
      step: 'extras' as const,
    },
    {
      label: 'Timeframe',
      value: labelFor(content.process.timeframeOptions, draft.timeframe),
      step: 'process' as const,
    },
  ];

  const submitButtonLabel =
    submitState === 'sending' ? 'Submitting...' : submitState === 'success' ? 'Submitted' : 'Submit brief';

  return (
    <main className="container mx-auto px-4 py-8 md:px-6 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <section id="start-hero" ref={setSectionRef('hero')} className="scroll-mt-24 rounded border border-border bg-panel">
            <div className="space-y-4 p-5 md:p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Step 0</p>
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
                  onClick={() => jumpToSection('submit')}
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

          <StepSection
            id="branch"
            stepLabel="Step 1"
            title={content.branch.heading}
            complete={completion.branch}
            sectionRef={setSectionRef('branch')}
          >
            <div role="radiogroup" aria-label="Choose your path" className="grid gap-3 md:grid-cols-3">
              {content.branch.options.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded border p-4 ${
                    draft.enquiryType === option.value ? 'border-black bg-neutral-100' : 'border-border bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="start-branch"
                    value={option.value}
                    checked={draft.enquiryType === option.value}
                    onChange={() => handleBranchSelect(option.value)}
                    className="sr-only"
                  />
                  <p className="text-base font-medium text-neutral-900">{option.label}</p>
                  <p className="mt-2 text-sm text-neutral-700">{option.description}</p>
                </label>
              ))}
            </div>
          </StepSection>

          <StepSection
            id="roofStyle"
            stepLabel="Step 2"
            title={content.roofStyle.heading}
            locked={locked.roofStyle}
            complete={completion.roofStyle}
            sectionRef={setSectionRef('roofStyle')}
          >
            <div role="radiogroup" aria-label="Choose roof style" className="grid gap-3 md:grid-cols-2">
              {content.roofStyle.options.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded border p-4 ${
                    draft.style === option.value ? 'border-black bg-neutral-100' : 'border-border bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="start-style"
                    value={option.value}
                    checked={draft.style === option.value}
                    onChange={() => handleStyleSelect(option.value)}
                    className="sr-only"
                  />
                  <p className="text-base font-medium text-neutral-900">{option.label}</p>
                  <p className="mt-1 text-sm text-neutral-700">{option.what}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {option.bestWhen.map((item) => (
                      <li key={`${option.value}-${item}`}>Best when: {item}</li>
                    ))}
                    <li>Watch out for: {option.watchOut}</li>
                  </ul>
                </label>
              ))}
            </div>
          </StepSection>

          <StepSection
            id="roofMaterial"
            stepLabel="Step 3"
            title={content.roofMaterial.heading}
            locked={locked.roofMaterial}
            complete={completion.roofMaterial}
            sectionRef={setSectionRef('roofMaterial')}
          >
            <div role="radiogroup" aria-label="Choose roof material" className="grid gap-3 md:grid-cols-2">
              {content.roofMaterial.options.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded border p-4 ${
                    draft.roofMaterialChoice === option.value
                      ? 'border-black bg-neutral-100'
                      : 'border-border bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="start-material"
                    value={option.value}
                    checked={draft.roofMaterialChoice === option.value}
                    onChange={() => handleMaterialSelect(option.value)}
                    className="sr-only"
                  />
                  <p className="text-base font-medium text-neutral-900">{option.label}</p>
                  <p className="mt-1 text-sm text-neutral-700">{option.description}</p>
                </label>
              ))}
            </div>

            {(draft.roofMaterialChoice === 'acrylic' || draft.roofMaterialChoice === 'combination') && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">Acrylic tint</p>
                <div role="radiogroup" aria-label="Acrylic tint" className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {content.roofMaterial.acrylicTintOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                      <input
                        type="radio"
                        name="start-acrylic-tint"
                        checked={draft.acrylicTint === option.value}
                        onChange={() => {
                          clearFeedback();
                          setDraft((previous) => ({ ...previous, acrylicTint: option.value as AcrylicTint }));
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {(draft.roofMaterialChoice === 'timber' || draft.roofMaterialChoice === 'combination') && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">Timber finish</p>
                <div role="radiogroup" aria-label="Timber finish" className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {content.roofMaterial.timberFinishOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                      <input
                        type="radio"
                        name="start-timber-finish"
                        checked={draft.timberFinish === option.value}
                        onChange={() => {
                          clearFeedback();
                          setDraft((previous) => ({ ...previous, timberFinish: option.value as TimberFinish }));
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </StepSection>

          <StepSection
            id="site"
            stepLabel="Step 4"
            title={content.site.heading}
            intro={content.site.measureHelp}
            locked={locked.site}
            complete={completion.site}
            sectionRef={setSectionRef('site')}
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium text-neutral-900">Suburb / city</span>
              <input
                type="text"
                value={draft.suburb}
                onChange={(event) => {
                  clearFeedback();
                  setDraft((previous) => ({ ...previous, suburb: event.target.value }));
                }}
                className="w-full rounded border border-border px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">Install surface</p>
              <div role="radiogroup" aria-label="Install surface" className="grid gap-2 md:grid-cols-2">
                {content.site.installSurfaceOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                    <input
                      type="radio"
                      name="start-install-surface"
                      checked={draft.site.installSurface === option.value}
                      onChange={() => updateSite('installSurface', option.value as InstallSurface)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">Level / storey</p>
              <div role="radiogroup" aria-label="Level" className="grid gap-2 md:grid-cols-2">
                {content.site.levelOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                    <input
                      type="radio"
                      name="start-level"
                      checked={draft.site.level === option.value}
                      onChange={() => updateSite('level', option.value as SiteLevel)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">Attached to existing building?</p>
              <div role="radiogroup" aria-label="Attachment" className="grid gap-2 md:grid-cols-2">
                {content.site.attachmentOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                    <input
                      type="radio"
                      name="start-attachment"
                      checked={draft.site.attachment === option.value}
                      onChange={() => updateSite('attachment', option.value as SiteAttachment)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">Public access under/around the pergola?</p>
              <div role="radiogroup" aria-label="Public access" className="grid gap-2 md:grid-cols-2">
                {content.site.publicAccessOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                    <input
                      type="radio"
                      name="start-public-access"
                      checked={draft.site.publicAccess === option.value}
                      onChange={() => updateSite('publicAccess', option.value as PublicAccess)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

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
            {dimensionsRequired && !(widthM && depthM) ? (
              <p className="text-sm text-neutral-600">
                Residential and commercial paths require length and projection before continuing.
              </p>
            ) : null}
          </StepSection>

          <StepSection
            id="consent"
            stepLabel="Step 5"
            title={content.consent.heading}
            locked={locked.consent}
            complete={completion.consent}
            sectionRef={setSectionRef('consent')}
          >
            <div className="rounded border border-border bg-neutral-50 p-4">
              <p className="text-sm font-medium text-neutral-900">{consentResult.title}</p>
              <p className="mt-1 text-sm text-neutral-700">
                Area calculated: {areaM2 == null ? 'unknown' : `${areaM2.toFixed(1)}m^2`}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {consentResult.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-neutral-800">{consentResult.nextStep}</p>
            </div>

            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {content.consent.disclaimer}
            </p>
            <div className="flex flex-wrap gap-3">
              {content.consent.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div>
              <button
                type="button"
                onClick={() => jumpToSection('extras')}
                className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
              >
                Continue to extras
              </button>
            </div>
          </StepSection>

          <StepSection
            id="extras"
            stepLabel="Step 6"
            title={content.extras.heading}
            locked={locked.extras}
            complete={completion.extras}
            sectionRef={setSectionRef('extras')}
          >
            <div className="grid gap-2 md:grid-cols-2">
              {content.extras.options.map((option) => (
                <label key={option.value} className="flex items-start gap-3 rounded border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.extras[option.value]}
                    onChange={() => handleExtraToggle(option.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-neutral-900">{option.label}</span>
                    <span className="mt-1 block text-neutral-700">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleNoExtras}
              className="rounded border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              {content.extras.noneLabel}
            </button>
          </StepSection>

          <StepSection
            id="process"
            stepLabel="Step 7"
            title={content.process.heading}
            locked={locked.process}
            complete={completion.process}
            sectionRef={setSectionRef('process')}
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
              <div role="radiogroup" aria-label="Desired timeframe" className="grid gap-2 sm:grid-cols-2">
                {content.process.timeframeOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                    <input
                      type="radio"
                      name="start-timeframe"
                      checked={draft.timeframe === option.value}
                      onChange={() => handleTimeframeSelect(option.value as Timeframe)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </StepSection>

          <StepSection
            id="submit"
            stepLabel="Step 8"
            title="Send your brief"
            intro="Submit directly to Sanctuary via /api/enquiry. Name and phone are required."
            locked={locked.submit}
            complete={completion.submit}
            sectionRef={setSectionRef('submit')}
          >
            {submitState === 'success' ? (
              <div className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                <p className="font-semibold">Thanks. Your brief has been submitted.</p>
                <p className="mt-1">We will review your details and follow up shortly.</p>
                {submitMeta?.enquiryRequestId ? (
                  <p className="mt-2">Reference: {submitMeta.enquiryRequestId}</p>
                ) : null}
              </div>
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit}>
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
        </div>

        <aside className="rounded border border-border bg-white p-4 lg:sticky lg:top-24">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-700">Summary</h2>
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
                      onClick={() => jumpToSection(row.step)}
                      className="text-[11px] font-medium uppercase tracking-[0.11em] text-neutral-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-neutral-800">{row.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500">Current route: /start</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

