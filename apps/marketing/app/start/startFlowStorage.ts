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

export const START_FLOW_STORAGE_KEY = 'sp_start_flow_draft';

type StoredStartFlowDraft = {
  schemaVersion: string;
  updatedAt: string;
  draft: StartFlowDraft;
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

function hydrateDraft(rawDraft: unknown): StartFlowDraft | null {
  if (!isRecord(rawDraft)) return null;

  const next: StartFlowDraft = {
    ...defaultStartFlowDraft,
    site: { ...defaultStartFlowDraft.site },
    dimensions: { ...defaultStartFlowDraft.dimensions },
    extras: { ...defaultStartFlowDraft.extras },
  };

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

export function readStartFlowDraft(schemaVersion: string): StartFlowDraft | null {
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

    const hydrated = hydrateDraft(parsed.draft);
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

export function writeStartFlowDraft(schemaVersion: string, draft: StartFlowDraft): void {
  if (typeof window === 'undefined') return;

  const payload: StoredStartFlowDraft = {
    schemaVersion,
    updatedAt: new Date().toISOString(),
    draft,
  };

  window.localStorage.setItem(START_FLOW_STORAGE_KEY, JSON.stringify(payload));
}

export function clearStartFlowDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(START_FLOW_STORAGE_KEY);
}
