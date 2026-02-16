import {
  defaultStartFlowDraft,
  roofMaterialsByChoice,
  type AcrylicTint,
  type EnquiryType,
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

export const START_FLOW_STORAGE_KEY = 'sanctuary:start_guide:v2';

export type ConfirmedStepState = {
  branch: boolean;
  roofStyle: boolean;
  roofMaterial: boolean;
  site: boolean;
  consent: boolean;
  extras: boolean;
  process: boolean;
};

export const DEFAULT_CONFIRMED_STEP_STATE: ConfirmedStepState = {
  branch: false,
  roofStyle: false,
  roofMaterial: false,
  site: false,
  consent: false,
  extras: false,
  process: false,
};

export type StartFlowPersistedState = {
  draft: StartFlowDraft;
  confirmedDraft: StartFlowDraft;
  confirmedSteps: ConfirmedStepState;
};

type StoredStartFlowState = {
  schemaVersion: string;
  updatedAt: string;
  state: StartFlowPersistedState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asEnumValue<T extends string>(value: unknown, valid: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  return valid.includes(value as T) ? (value as T) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function cloneDefaultDraft(): StartFlowDraft {
  return {
    ...defaultStartFlowDraft,
    site: { ...defaultStartFlowDraft.site },
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: { ...defaultStartFlowDraft.extras },
  };
}

function hydrateDraft(rawDraft: unknown): StartFlowDraft | null {
  if (!isRecord(rawDraft)) return null;

  const next = cloneDefaultDraft();

  const enquiryType =
    asEnumValue(rawDraft.enquiryType, ['residential', 'commercial', 'professional']) ?? next.enquiryType;
  next.enquiryType = enquiryType;

  next.style = asEnumValue(rawDraft.style, ['pitched', 'gable', 'hip', 'perimeter', 'unsure']);

  const roofMaterialChoice = asEnumValue(rawDraft.roofMaterialChoice, ['acrylic', 'timber', 'combination', 'unsure']);
  next.roofMaterialChoice = roofMaterialChoice;
  next.roofMaterials = roofMaterialChoice ? [...roofMaterialsByChoice[roofMaterialChoice]] : [];

  next.acrylicTint = asEnumValue(rawDraft.acrylicTint, [
    'clear',
    'light_grey',
    'dark_grey',
    'opal',
    'not_sure',
  ]) as AcrylicTint | null;
  next.timberFinish = asEnumValue(rawDraft.timberFinish, ['natural', 'stained', 'painted', 'not_sure']) as
    | TimberFinish
    | null;

  const site = isRecord(rawDraft.site) ? rawDraft.site : {};
  next.site.installSurface = asEnumValue(site.installSurface, [
    'deck',
    'concrete_pad',
    'pavers',
    'ground_garden',
    'not_sure',
  ]) as InstallSurface | null;
  next.site.level = asEnumValue(site.level, ['ground', 'first', 'second_plus', 'not_sure']) as SiteLevel | null;
  next.site.attachment = asEnumValue(site.attachment, ['attached', 'freestanding', 'not_sure']) as
    | SiteAttachment
    | null;
  next.site.publicAccess = asEnumValue(site.publicAccess, ['yes', 'no', 'not_sure']) as PublicAccess | null;

  const dimensions = isRecord(rawDraft.dimensions) ? rawDraft.dimensions : {};
  next.dimensions.widthM = asString(dimensions.widthM);
  next.dimensions.depthM = asString(dimensions.depthM);
  next.dimensions.heightM = asString(dimensions.heightM);

  const extras = isRecord(rawDraft.extras) ? rawDraft.extras : {};
  next.extras.blinds = asBoolean(extras.blinds);
  next.extras.slats = asBoolean(extras.slats);
  next.extras.acrylic_infills = asBoolean(extras.acrylic_infills);
  next.extras.downlights = asBoolean(extras.downlights);
  next.extras.led_strips = asBoolean(extras.led_strips);
  next.extras.heaters = asBoolean(extras.heaters);
  next.extrasAcknowledged = asBoolean(rawDraft.extrasAcknowledged);

  next.timeframe = asEnumValue(rawDraft.timeframe, [
    'asap',
    'one_to_three_months',
    'three_to_six_months',
    'researching',
  ]) as Timeframe | null;

  next.suburb = asString(rawDraft.suburb);
  next.name = asString(rawDraft.name);
  next.phone = asString(rawDraft.phone);
  next.email = asString(rawDraft.email);
  next.message = asString(rawDraft.message);

  return next;
}

function hydrateConfirmedSteps(rawSteps: unknown): ConfirmedStepState | null {
  if (!isRecord(rawSteps)) return null;
  return {
    branch: asBoolean(rawSteps.branch),
    roofStyle: asBoolean(rawSteps.roofStyle),
    roofMaterial: asBoolean(rawSteps.roofMaterial),
    site: asBoolean(rawSteps.site),
    consent: asBoolean(rawSteps.consent),
    extras: asBoolean(rawSteps.extras),
    process: asBoolean(rawSteps.process),
  };
}

function hydratePersistedState(rawState: unknown): StartFlowPersistedState | null {
  if (!isRecord(rawState)) return null;

  const draft = hydrateDraft(rawState.draft);
  if (!draft) return null;

  const confirmedDraft = hydrateDraft(rawState.confirmedDraft ?? rawState.draft);
  if (!confirmedDraft) return null;

  const confirmedSteps = hydrateConfirmedSteps(rawState.confirmedSteps);
  if (!confirmedSteps) return null;

  return {
    draft,
    confirmedDraft,
    confirmedSteps,
  };
}

export function createEmptyPersistedState(): StartFlowPersistedState {
  return {
    draft: cloneDefaultDraft(),
    confirmedDraft: cloneDefaultDraft(),
    confirmedSteps: { ...DEFAULT_CONFIRMED_STEP_STATE },
  };
}

export function readStartFlowState(schemaVersion: string): StartFlowPersistedState | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(START_FLOW_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      window.localStorage.removeItem(START_FLOW_STORAGE_KEY);
      return null;
    }

    const version = asString(parsed.schemaVersion);
    if (version !== schemaVersion) {
      window.localStorage.removeItem(START_FLOW_STORAGE_KEY);
      return null;
    }

    const hydrated = hydratePersistedState(parsed.state);
    if (!hydrated) {
      window.localStorage.removeItem(START_FLOW_STORAGE_KEY);
      return null;
    }

    return hydrated;
  } catch {
    window.localStorage.removeItem(START_FLOW_STORAGE_KEY);
    return null;
  }
}

export function writeStartFlowState(schemaVersion: string, state: StartFlowPersistedState): void {
  if (typeof window === 'undefined') return;

  const payload: StoredStartFlowState = {
    schemaVersion,
    updatedAt: new Date().toISOString(),
    state,
  };

  window.localStorage.setItem(START_FLOW_STORAGE_KEY, JSON.stringify(payload));
}

export function clearStartFlowDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(START_FLOW_STORAGE_KEY);
}
