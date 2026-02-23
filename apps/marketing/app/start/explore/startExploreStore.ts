import { startFlowContent } from '@/app/start/startFlowContent';

export const START_EXPLORE_STORAGE_KEY = 'sanctuary:startExplore:v1';

export const COMPARE_START_POINT_OPTIONS = [
  { id: 'no_cover', label: 'No cover' },
  { id: 'old_pergola', label: 'Old pergola' },
  { id: 'umbrella_or_shade_sail', label: 'Umbrella or shade sail' },
  { id: 'not_sure', label: 'Not sure' },
] as const;

export type CompareStartPointId = (typeof COMPARE_START_POINT_OPTIONS)[number]['id'];

export type StartExploreSelections = {
  path?: string;
  roofStyle?: string;
  roofMaterial?: string;
  roofSecondary?: string;
  enclosure?: string;
  extras?: string[];
  extrasNone?: boolean;
  compareStartPoint?: string;
};

export type LabeledOption = {
  id: string;
  label: string;
};

const ENCLOSURE_EXTRA_IDS = new Set(['blinds', 'slats', 'acrylic_infills']);

const pathIds = new Set(startFlowContent.branch.options.map((option) => option.value));
const roofStyleIds = new Set(startFlowContent.roofStyle.options.map((option) => option.value));
const roofMaterialIds = new Set(startFlowContent.roofMaterial.options.map((option) => option.value));
const extraIds = new Set(startFlowContent.extras.options.map((option) => option.value));
const enclosureIds = new Set<string>(
  startFlowContent.extras.options
    .filter((option) => ENCLOSURE_EXTRA_IDS.has(option.value))
    .map((option) => option.value)
);
const compareStartPointIds = new Set(COMPARE_START_POINT_OPTIONS.map((option) => option.id));

const roofSecondaryOptionsByMaterial: Record<string, ReadonlyArray<LabeledOption>> = {
  acrylic: startFlowContent.roofMaterial.acrylicLightFeelOptions.map((option) => ({
    id: option.value,
    label: option.label,
  })),
  timber: startFlowContent.roofMaterial.timberFinishOptions.map((option) => ({
    id: option.value,
    label: option.label,
  })),
  combination: startFlowContent.roofMaterial.daylightPlacementOptions.map((option) => ({
    id: option.value,
    label: option.label,
  })),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseOptionalStringId(value: unknown, allowed: Set<string>): string | undefined | null {
  if (value == null) return undefined;
  if (typeof value !== 'string') return null;
  return allowed.has(value) ? value : null;
}

function parseOptionalBoolean(value: unknown): boolean | undefined | null {
  if (value == null) return undefined;
  if (typeof value !== 'boolean') return null;
  return value;
}

function parseOptionalStringArray(value: unknown, allowed: Set<string>): string[] | undefined | null {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return null;

  const next: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item)) return null;
    if (!next.includes(item)) next.push(item);
  }

  return next;
}

export function getRoofSecondaryOptions(roofMaterial?: string): ReadonlyArray<LabeledOption> {
  if (!roofMaterial) return [];
  return roofSecondaryOptionsByMaterial[roofMaterial] ?? [];
}

export function getEnclosureOptions(): ReadonlyArray<LabeledOption> {
  return startFlowContent.extras.options
    .filter((option) => ENCLOSURE_EXTRA_IDS.has(option.value))
    .map((option) => ({ id: option.value, label: option.label }));
}

export function normalizeStartExploreSelections(input: unknown): StartExploreSelections | null {
  if (!isRecord(input)) return null;

  const next: StartExploreSelections = {};

  const path = parseOptionalStringId(input.path, pathIds);
  if (path === null) return null;
  if (path) next.path = path;

  const roofStyle = parseOptionalStringId(input.roofStyle, roofStyleIds);
  if (roofStyle === null) return null;
  if (roofStyle) next.roofStyle = roofStyle;

  const roofMaterial = parseOptionalStringId(input.roofMaterial, roofMaterialIds);
  if (roofMaterial === null) return null;
  if (roofMaterial) next.roofMaterial = roofMaterial;

  if (input.roofSecondary != null) {
    if (typeof input.roofSecondary !== 'string') return null;
    if (!next.roofMaterial) return null;
    const secondaryIds = new Set(getRoofSecondaryOptions(next.roofMaterial).map((option) => option.id));
    if (!secondaryIds.has(input.roofSecondary)) return null;
    next.roofSecondary = input.roofSecondary;
  }

  const enclosure = parseOptionalStringId(input.enclosure, enclosureIds);
  if (enclosure === null) return null;
  if (enclosure) next.enclosure = enclosure;

  const extras = parseOptionalStringArray(input.extras, extraIds);
  if (extras === null) return null;
  if (extras?.length) {
    const filteredExtras = extras.filter((extraId) => !enclosureIds.has(extraId));
    if (filteredExtras.length) next.extras = filteredExtras;
  }

  const extrasNone = parseOptionalBoolean(input.extrasNone);
  if (extrasNone === null) return null;
  if (extrasNone) {
    next.extrasNone = true;
    delete next.extras;
  }

  const compareStartPoint = parseOptionalStringId(input.compareStartPoint, compareStartPointIds);
  if (compareStartPoint === null) return null;
  if (compareStartPoint) next.compareStartPoint = compareStartPoint;

  return next;
}

export function readStartExploreSelections(): StartExploreSelections {
  if (typeof window === 'undefined') return {};

  const raw = window.localStorage.getItem(START_EXPLORE_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeStartExploreSelections(parsed);
    if (!normalized) {
      window.localStorage.removeItem(START_EXPLORE_STORAGE_KEY);
      return {};
    }
    return normalized;
  } catch {
    window.localStorage.removeItem(START_EXPLORE_STORAGE_KEY);
    return {};
  }
}

export function writeStartExploreSelections(selections: StartExploreSelections): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeStartExploreSelections(selections);
  if (!normalized) {
    window.localStorage.removeItem(START_EXPLORE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(START_EXPLORE_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearStartExploreSelections(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(START_EXPLORE_STORAGE_KEY);
}
