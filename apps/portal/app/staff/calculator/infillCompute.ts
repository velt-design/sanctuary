import type { InfillLineItem } from '@/lib/types/calculator';

export const RAFTER_SPACING_MM_MAX = 642;
export const INFILL_SHEET_MAX_RUN_M = 3.05;
export const INFILL_STRIP_MAX_RUN_M = 6.0;
export const INFILL_SHEET_MAX_SHORT_SIDE_M = 1.2;
export const INFILL_STRIP_MAX_SHORT_SIDE_M = 0.64;
export const INFILL_JOINER_TOLERANCE_M = 0.02;

export type InfillResolvedOrientation = 'vertical' | 'horizontal';
export type InfillWarningSection = 'basic' | 'supports' | 'advanced';
export type InfillWarningFieldKey =
  | 'acrylic'
  | 'joiner-direction'
  | 'centre-limit'
  | 'shape-width'
  | 'shape-height'
  | 'shape-low'
  | 'shape-high'
  | 'shape-bottom'
  | 'support-internal-mode'
  | 'support-internal-pos';

export type InfillWarningItem = {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  target: {
    section: InfillWarningSection;
    fieldKey: InfillWarningFieldKey;
  };
};

export type InfillUiEstimate = {
  widthM: number;
  maxHeightM: number;
  qty: number;
  panelOrientationRequested: InfillLineItem['panelOrientation'];
  panelOrientationUsed: InfillResolvedOrientation;
  runSideM: number;
  acrossSideM: number;
  materialRunLimitM: number;
  maxCentreM: number;
  preferredAcrylicSource: InfillLineItem['acrylicSource'];
  acrylicSourceUsed: InfillLineItem['acrylicSource'];
  acrylicSourceAutoSwitched: boolean;
  acrylicSourceUnavailable: boolean;
  canMatchRafters: boolean;
  widthModeUsed: InfillLineItem['widthMode'];
  roofRafterSpacingM: number;
  panelCountEach: number;
  panelCountTotal: number;
  internalJoinerLinesEach: number;
  internalJoinerLinesTotal: number;
  joinerLinesEach: number;
  joinerLinesTotal: number;
  unsupportedInternalEach: number;
  unsupportedInternalTotal: number;
  unsupportedInternalIndicesEach: number[];
  missingJambsEach: number;
  missingJambsTotal: number;
  estimatedMullionsEach: number;
  estimatedMullionsTotal: number;
  topJoiner: boolean;
  bottomJoiner: boolean;
  perimeterTopRailRequired: boolean;
  perimeterBottomRailRequired: boolean;
  stripCutMinM: number | null;
  stripCutMaxM: number | null;
  sheetAreaEachM2: number;
  sheetAreaTotalM2: number;
  invalidHeightInput: boolean;
  widthInputInvalid: boolean;
  invalidCustomPositions: boolean;
};

export type InfillUiValidation = {
  errors: {
    acrylicSource?: string;
    qty?: string;
    widthM?: string;
    heightM?: string;
    heightLowM?: string;
    heightHighM?: string;
    targetPanelWidthM?: string;
    maxPanelWidthM?: string;
    bottomOffsetM?: string;
    internalSupportPositionsM?: string;
  };
  warnings: InfillWarningItem[];
};

export type InfillDraftFieldKey = 'widthM' | 'heightM' | 'heightLowM' | 'heightHighM';
export type InfillDraftEntry = Partial<Record<InfillDraftFieldKey, string>>;

export type InfillComputeStatus = 'valid' | 'draft';

export type InfillUiState = {
  status: InfillComputeStatus;
  missingFields: InfillDraftFieldKey[];
  draftErrors: Pick<InfillUiValidation['errors'], 'widthM' | 'heightM' | 'heightLowM' | 'heightHighM'>;
  estimate: InfillUiEstimate;
  validation: InfillUiValidation;
  warnings: InfillWarningItem[];
};

function toNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function isFrontOrHouseLocation(location: InfillLineItem['location']): boolean {
  return location === 'front' || location === 'house';
}

function normalizeWidthModeForLocation(item: InfillLineItem): InfillLineItem['widthMode'] {
  if (!isFrontOrHouseLocation(item.location)) return 'target_width';
  return item.widthMode === 'match_roof_rafters' ? 'match_roof_rafters' : 'target_width';
}

export function normalizePanelOrientation(value: unknown): InfillLineItem['panelOrientation'] {
  if (value === 'horizontal' || value === 'auto') return value;
  return 'vertical';
}

export function maxRunForAcrylicSource(source: InfillLineItem['acrylicSource']): number {
  return source === 'strip_620' ? INFILL_STRIP_MAX_RUN_M : INFILL_SHEET_MAX_RUN_M;
}

function pickAcrylicSourceForRun(
  preferred: InfillLineItem['acrylicSource'],
  runSideM: number,
): {
  source: InfillLineItem['acrylicSource'] | null;
  switched: boolean;
  runLimitM: number;
} {
  const preferredMax = maxRunForAcrylicSource(preferred);
  if (runSideM <= preferredMax + 1e-6) {
    return { source: preferred, switched: false, runLimitM: preferredMax };
  }
  const fallback: InfillLineItem['acrylicSource'] = preferred === 'sheet_panels' ? 'strip_620' : 'sheet_panels';
  const fallbackMax = maxRunForAcrylicSource(fallback);
  if (runSideM <= fallbackMax + 1e-6) {
    return { source: fallback, switched: true, runLimitM: fallbackMax };
  }
  return { source: null, switched: false, runLimitM: Math.max(preferredMax, fallbackMax) };
}

function maxCentreForAcrylicSource(source: InfillLineItem['acrylicSource']): number {
  return source === 'strip_620' ? INFILL_STRIP_MAX_SHORT_SIDE_M : INFILL_SHEET_MAX_SHORT_SIDE_M;
}

export function locationLabel(value: InfillLineItem['location']): string {
  switch (value) {
    case 'front':
      return 'Front';
    case 'house':
      return 'House';
    case 'side':
      return 'Side';
    case 'gable_end':
      return 'Gable end';
    case 'wall':
      return 'Wall';
    default:
      return 'Custom';
  }
}

export function acrylicSourceLabel(value: InfillLineItem['acrylicSource']): string {
  return value === 'strip_620' ? '620 strips' : 'Sheet panels';
}

export function formatInfillShapeSummary(shape: InfillLineItem['shape']): string {
  const widthM = Number.isFinite(toNumber(shape.widthM)) ? Math.max(0, toNumber(shape.widthM)) : 0;
  if (shape.type === 'rect') {
    const heightM = Number.isFinite(toNumber(shape.heightM)) ? Math.max(0, toNumber(shape.heightM)) : 0;
    return `${formatMaybeNumber(widthM, 2)}x${formatMaybeNumber(heightM, 2)}m`;
  }
  const low = Number.isFinite(toNumber(shape.heightLowM)) ? Math.max(0, toNumber(shape.heightLowM)) : 0;
  const high = Number.isFinite(toNumber(shape.heightHighM)) ? Math.max(0, toNumber(shape.heightHighM)) : 0;
  return `${formatMaybeNumber(widthM, 2)}x${formatMaybeNumber(low, 2)}m->${formatMaybeNumber(high, 2)}m`;
}

export function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  return n.toFixed(digits);
}

export function estimateRoofRafterSpacing(lengthM: number, derivedRafterCount?: number): { spacingM: number; source: 'derived' | 'fallback' } {
  if (typeof derivedRafterCount === 'number' && Number.isFinite(derivedRafterCount) && derivedRafterCount > 1 && Number.isFinite(lengthM) && lengthM > 0) {
    return {
      spacingM: Math.max(0.05, lengthM / (Math.max(2, Math.round(derivedRafterCount)) - 1)),
      source: 'derived',
    };
  }
  if (Number.isFinite(lengthM) && lengthM > 0) {
    const bays = Math.max(1, Math.ceil((lengthM * 1000) / RAFTER_SPACING_MM_MAX));
    return { spacingM: Math.max(0.05, lengthM / bays), source: 'fallback' };
  }
  return { spacingM: RAFTER_SPACING_MM_MAX / 1000, source: 'fallback' };
}

function makeOrientationEstimate(
  item: InfillLineItem,
  roofRafterSpacingM: number,
  panelOrientationUsed: InfillResolvedOrientation,
): InfillUiEstimate {
  const qtyParsed = Number.parseInt(item.qty, 10);
  const qty = Number.isFinite(qtyParsed) && qtyParsed >= 1 ? Math.round(qtyParsed) : 1;

  const widthRaw = toNumber(item.shape.widthM);
  const widthInputInvalid = !Number.isFinite(widthRaw) || widthRaw < 0;
  const widthM = Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : 0;

  let invalidHeightInput = false;
  let heightAt = (_t01: number) => 0;
  let avgHeightM = 0;
  let maxHeightM = 0;

  if (item.shape.type === 'rect') {
    const hRaw = toNumber(item.shape.heightM);
    invalidHeightInput = !Number.isFinite(hRaw) || hRaw < 0;
    const h = Number.isFinite(hRaw) && hRaw > 0 ? hRaw : 0;
    heightAt = () => h;
    avgHeightM = h;
    maxHeightM = h;
  } else {
    const lowRaw = toNumber(item.shape.heightLowM);
    const highRaw = toNumber(item.shape.heightHighM);
    invalidHeightInput = !Number.isFinite(lowRaw) || !Number.isFinite(highRaw) || lowRaw < 0 || highRaw < 0;
    const low = Number.isFinite(lowRaw) && lowRaw > 0 ? lowRaw : 0;
    const high = Number.isFinite(highRaw) && highRaw > 0 ? highRaw : 0;
    heightAt = (t01: number) => low + (high - low) * clampNumber(t01, 0, 1);
    avgHeightM = (low + high) / 2;
    maxHeightM = Math.max(low, high);
  }

  const runSideM = panelOrientationUsed === 'vertical' ? maxHeightM : widthM;
  const acrossSideM = panelOrientationUsed === 'vertical' ? widthM : maxHeightM;
  const sourceDecision = pickAcrylicSourceForRun(item.acrylicSource, runSideM);
  const acrylicSourceUsed = sourceDecision.source ?? item.acrylicSource;
  const acrylicSourceUnavailable = sourceDecision.source === null;
  const maxCentreM = maxCentreForAcrylicSource(acrylicSourceUsed);
  const canMatchRafters = isFrontOrHouseLocation(item.location);
  const widthModeUsed = normalizeWidthModeForLocation(item);
  const panelCountEach = !acrylicSourceUnavailable && acrossSideM > 0 ? Math.max(1, Math.ceil(acrossSideM / maxCentreM)) : 0;
  const panelCountTotal = panelCountEach * qty;
  const internalJoinerLinesEach = panelCountEach > 0 ? Math.max(0, panelCountEach - 1) : 0;
  const internalJoinerLinesTotal = internalJoinerLinesEach * qty;
  const joinerLinesEach = panelCountEach > 0 ? panelCountEach + 1 : 0;
  const joinerLinesTotal = joinerLinesEach * qty;

  const rawCustomPositions = Array.isArray(item.support.internalSupportPositionsM) ? item.support.internalSupportPositionsM : [];
  const customPositionsM: number[] = [];
  let invalidCustomPositions = false;
  for (const token of rawCustomPositions) {
    const n = Number.parseFloat(String(token).trim());
    if (!Number.isFinite(n) || n < 0) {
      invalidCustomPositions = true;
      continue;
    }
    customPositionsM.push(n);
  }
  if ((item.support.internalSupportMode ?? 'none') === 'custom' && rawCustomPositions.length === 0) {
    invalidCustomPositions = false;
  }

  let unsupportedInternalEach = 0;
  const unsupportedInternalIndicesEach: number[] = [];
  if (panelCountEach > 1 && acrossSideM > 0) {
    for (let i = 1; i < panelCountEach; i += 1) {
      const x = (i * acrossSideM) / panelCountEach;
      const mode = item.support.internalSupportMode ?? 'none';
      const supportedByMode =
        mode === 'match_roof_rafters' ||
        (mode === 'center' && Math.abs(x - acrossSideM / 2) <= INFILL_JOINER_TOLERANCE_M) ||
        (mode === 'custom' && customPositionsM.some((p) => Math.abs(p - x) <= INFILL_JOINER_TOLERANCE_M));
      const supportedByRafters = panelOrientationUsed === 'vertical' && canMatchRafters && widthModeUsed === 'match_roof_rafters';
      if (!supportedByMode && !supportedByRafters) {
        unsupportedInternalEach += 1;
        unsupportedInternalIndicesEach.push(i);
      }
    }
  }

  const unsupportedInternalTotal = unsupportedInternalEach * qty;
  const missingJambsEach =
    panelOrientationUsed === 'vertical'
      ? (item.support.hasLeft === false ? 1 : 0) + (item.support.hasRight === false ? 1 : 0)
      : (item.support.hasBottom === false ? 1 : 0) + (item.support.hasTop === false ? 1 : 0);
  const missingJambsTotal = missingJambsEach * qty;
  const estimatedMullionsEach = unsupportedInternalEach + missingJambsEach;
  const estimatedMullionsTotal = estimatedMullionsEach * qty;

  let stripCutMinM: number | null = null;
  let stripCutMaxM: number | null = null;
  if (acrylicSourceUsed === 'strip_620' && panelCountEach > 0) {
    if (panelOrientationUsed === 'vertical' && widthM > 0) {
      const cuts: number[] = [];
      for (let panelIndex = 0; panelIndex < panelCountEach; panelIndex += 1) {
        const x0 = (panelIndex * widthM) / panelCountEach;
        const x1 = ((panelIndex + 1) * widthM) / panelCountEach;
        const t0 = widthM > 0 ? x0 / widthM : 0;
        const t1 = widthM > 0 ? x1 / widthM : 0;
        const cut = Math.max(0, Math.max(heightAt(t0), heightAt(t1)));
        if (cut > 0) cuts.push(cut);
      }
      if (cuts.length) {
        stripCutMinM = Math.min(...cuts);
        stripCutMaxM = Math.max(...cuts);
      }
    } else if (runSideM > 0) {
      stripCutMinM = runSideM;
      stripCutMaxM = runSideM;
    }
  }

  const sheetAreaEachM2 = Math.max(0, widthM * Math.max(0, avgHeightM));
  const sheetAreaTotalM2 = sheetAreaEachM2 * qty;

  return {
    widthM,
    maxHeightM,
    qty,
    panelOrientationRequested: normalizePanelOrientation(item.panelOrientation),
    panelOrientationUsed,
    runSideM,
    acrossSideM,
    materialRunLimitM: sourceDecision.runLimitM,
    maxCentreM,
    preferredAcrylicSource: item.acrylicSource,
    acrylicSourceUsed,
    acrylicSourceAutoSwitched: sourceDecision.switched,
    acrylicSourceUnavailable,
    canMatchRafters,
    widthModeUsed,
    roofRafterSpacingM,
    panelCountEach,
    panelCountTotal,
    internalJoinerLinesEach,
    internalJoinerLinesTotal,
    joinerLinesEach,
    joinerLinesTotal,
    unsupportedInternalEach,
    unsupportedInternalTotal,
    unsupportedInternalIndicesEach,
    missingJambsEach,
    missingJambsTotal,
    estimatedMullionsEach,
    estimatedMullionsTotal,
    topJoiner: panelCountEach > 0,
    bottomJoiner: panelCountEach > 0,
    perimeterTopRailRequired: item.support.hasTop === false,
    perimeterBottomRailRequired: item.support.hasBottom === false,
    stripCutMinM,
    stripCutMaxM,
    sheetAreaEachM2,
    sheetAreaTotalM2,
    invalidHeightInput,
    widthInputInvalid,
    invalidCustomPositions,
  };
}

function compareEstimates(a: InfillUiEstimate, b: InfillUiEstimate): number {
  const scoreA = [a.internalJoinerLinesEach, a.unsupportedInternalEach, a.estimatedMullionsEach, a.panelCountEach, a.runSideM];
  const scoreB = [b.internalJoinerLinesEach, b.unsupportedInternalEach, b.estimatedMullionsEach, b.panelCountEach, b.runSideM];
  for (let i = 0; i < scoreA.length; i += 1) {
    if (scoreA[i] < scoreB[i]) return -1;
    if (scoreA[i] > scoreB[i]) return 1;
  }
  return 0;
}

export function estimateInfillUi(item: InfillLineItem, roofRafterSpacingM: number): InfillUiEstimate {
  const requested = normalizePanelOrientation(item.panelOrientation);
  if (requested === 'auto') {
    const vertical = makeOrientationEstimate(item, roofRafterSpacingM, 'vertical');
    const horizontal = makeOrientationEstimate(item, roofRafterSpacingM, 'horizontal');
    return compareEstimates(vertical, horizontal) <= 0 ? vertical : horizontal;
  }
  return makeOrientationEstimate(item, roofRafterSpacingM, requested);
}

export function resolvePayloadPanelOrientation(item: InfillLineItem, roofRafterSpacingM: number): InfillResolvedOrientation {
  const requested = normalizePanelOrientation(item.panelOrientation);
  if (requested === 'auto') {
    return estimateInfillUi(item, roofRafterSpacingM).panelOrientationUsed;
  }
  return requested;
}

export function validateInfillUi(item: InfillLineItem, estimate: InfillUiEstimate): InfillUiValidation {
  const errors: InfillUiValidation['errors'] = {};
  const warnings: InfillWarningItem[] = [];

  const qtyRaw = Number.parseInt(item.qty, 10);
  if (!Number.isFinite(qtyRaw) || qtyRaw < 1) {
    errors.qty = 'Enter a whole number of at least 1.';
  }

  const widthRaw = toNumber(item.shape.widthM);
  if (!Number.isFinite(widthRaw) || widthRaw < 0) {
    errors.widthM = 'Enter a value of at least 0.';
  }

  let maxHeight = 0;
  if (item.shape.type === 'rect') {
    const heightRaw = toNumber(item.shape.heightM);
    if (!Number.isFinite(heightRaw) || heightRaw < 0) {
      errors.heightM = 'Enter a value of at least 0.';
    } else {
      maxHeight = Math.max(maxHeight, heightRaw);
    }
  } else {
    const lowRaw = toNumber(item.shape.heightLowM);
    const highRaw = toNumber(item.shape.heightHighM);
    if (!Number.isFinite(lowRaw) || lowRaw < 0) {
      errors.heightLowM = 'Enter a value of at least 0.';
    } else {
      maxHeight = Math.max(maxHeight, lowRaw);
    }
    if (!Number.isFinite(highRaw) || highRaw < 0) {
      errors.heightHighM = 'Enter a value of at least 0.';
    } else {
      maxHeight = Math.max(maxHeight, highRaw);
    }
  }

  if (estimate.acrylicSourceUnavailable) {
    errors.acrylicSource = `Long side ${formatMaybeNumber(estimate.runSideM, 2)}m exceeds all material limits (sheet ${formatMaybeNumber(
      INFILL_SHEET_MAX_RUN_M,
      2,
    )}m, strips ${formatMaybeNumber(INFILL_STRIP_MAX_RUN_M, 2)}m).`;
    warnings.push({
      id: 'acrylic-source-unavailable',
      severity: 'error',
      message: 'Long side exceeds all acrylic limits. Choose a smaller span.',
      target: { section: 'basic', fieldKey: 'acrylic' },
    });
  } else if (estimate.acrylicSourceAutoSwitched) {
    warnings.push({
      id: 'acrylic-source-auto-switched',
      severity: 'warning',
      message: `Acrylic type auto-switched from ${acrylicSourceLabel(estimate.preferredAcrylicSource)} to ${acrylicSourceLabel(estimate.acrylicSourceUsed)} because long side exceeds ${formatMaybeNumber(maxRunForAcrylicSource(estimate.preferredAcrylicSource), 2)}m.`,
      target: { section: 'basic', fieldKey: 'acrylic' },
    });
  }

  const bottomOffsetRaw = toNumber(item.shape.bottomOffsetM ?? '0');
  if (!Number.isFinite(bottomOffsetRaw) || bottomOffsetRaw < 0) {
    errors.bottomOffsetM = 'Enter a value of at least 0.';
  } else if (maxHeight > 0 && bottomOffsetRaw >= maxHeight) {
    warnings.push({
      id: 'bottom-offset-ge-height',
      severity: 'warning',
      message: 'Bottom offset is greater than or equal to panel height.',
      target: { section: 'basic', fieldKey: 'shape-bottom' },
    });
  }

  const mode = item.support.internalSupportMode ?? 'none';
  if (mode === 'custom') {
    const raw = Array.isArray(item.support.internalSupportPositionsM) ? item.support.internalSupportPositionsM : [];
    if (raw.length === 0) {
      errors.internalSupportPositionsM = 'Enter one or more offsets.';
    } else if (estimate.invalidCustomPositions) {
      errors.internalSupportPositionsM = 'Use a comma-separated list of numbers (m).';
    }
  }

  return { errors, warnings };
}

function getRequiredDraftFields(shape: InfillLineItem['shape']): InfillDraftFieldKey[] {
  if (shape.type === 'rect') return ['widthM', 'heightM'];
  return ['widthM', 'heightLowM', 'heightHighM'];
}

function getCanonicalFieldValue(item: InfillLineItem, key: InfillDraftFieldKey): string {
  switch (key) {
    case 'widthM':
      return item.shape.widthM;
    case 'heightM':
      return item.shape.type === 'rect' ? item.shape.heightM : '';
    case 'heightLowM':
      return item.shape.type === 'mono_slope' ? item.shape.heightLowM : '';
    case 'heightHighM':
      return item.shape.type === 'mono_slope' ? item.shape.heightHighM : '';
    default:
      return '';
  }
}

function draftFieldToErrorKey(field: InfillDraftFieldKey): 'widthM' | 'heightM' | 'heightLowM' | 'heightHighM' {
  if (field === 'widthM') return 'widthM';
  if (field === 'heightM') return 'heightM';
  if (field === 'heightLowM') return 'heightLowM';
  return 'heightHighM';
}

function warningTargetForDraftField(field: InfillDraftFieldKey): InfillWarningFieldKey {
  if (field === 'widthM') return 'shape-width';
  if (field === 'heightM') return 'shape-height';
  if (field === 'heightLowM') return 'shape-low';
  return 'shape-high';
}

function hasRequiredValidationError(errors: InfillUiValidation['errors'], item: InfillLineItem): boolean {
  const required = getRequiredDraftFields(item.shape);
  return required.some((field) => {
    const key = draftFieldToErrorKey(field);
    return Boolean(errors[key]);
  });
}

export function resolveInfillUiState(item: InfillLineItem, roofRafterSpacingM: number, draft?: InfillDraftEntry): InfillUiState {
  const estimate = estimateInfillUi(item, roofRafterSpacingM);
  const validation = validateInfillUi(item, estimate);
  const missingFields: InfillDraftFieldKey[] = [];
  const draftErrors: InfillUiState['draftErrors'] = {};

  for (const field of getRequiredDraftFields(item.shape)) {
    const raw = draft?.[field] ?? getCanonicalFieldValue(item, field);
    const value = String(raw ?? '');
    if (value.trim() === '') {
      missingFields.push(field);
      draftErrors[draftFieldToErrorKey(field)] = 'Required field.';
      continue;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      missingFields.push(field);
      draftErrors[draftFieldToErrorKey(field)] = 'Enter a value of at least 0.';
    }
  }

  const draftWarnings: InfillWarningItem[] = missingFields.map((field) => ({
    id: `draft-${field}`,
    severity: 'warning',
    message: `${
      field === 'widthM'
        ? 'Width'
        : field === 'heightM'
          ? 'Height'
          : field === 'heightLowM'
            ? 'Height low'
            : 'Height high'
    } is incomplete.`,
    target: { section: 'basic', fieldKey: warningTargetForDraftField(field) },
  }));

  if (estimate.widthM > 0 && estimate.panelCountEach === 0) {
    draftWarnings.push({
      id: 'panel-count-zero',
      severity: 'warning',
      message: 'Subdivided side is above max bay spacing but no bays were generated.',
      target: { section: 'basic', fieldKey: 'centre-limit' },
    });
  }

  if (estimate.invalidHeightInput) {
    draftWarnings.push({
      id: 'invalid-height-input',
      severity: 'warning',
      message: 'One or more height values are invalid.',
      target: { section: 'basic', fieldKey: item.shape.type === 'rect' ? 'shape-height' : 'shape-high' },
    });
  }

  if (estimate.unsupportedInternalEach > 0) {
    const label = estimate.unsupportedInternalEach === 1 ? 'joiner line needs' : 'joiner lines need';
    draftWarnings.push({
      id: 'unsupported-joiners',
      severity: 'warning',
      message: `${estimate.unsupportedInternalEach} ${label} support.`,
      target: { section: 'supports', fieldKey: 'support-internal-mode' },
    });
  }

  if (estimate.panelOrientationRequested === 'auto') {
    draftWarnings.push({
      id: 'auto-orientation-used',
      severity: 'info',
      message: `Auto selected ${estimate.panelOrientationUsed === 'vertical' ? 'vertical' : 'horizontal'} joiners for this shape.`,
      target: { section: 'basic', fieldKey: 'joiner-direction' },
    });
  }

  const warningMap = new Map<string, InfillWarningItem>();
  for (const warning of [...validation.warnings, ...draftWarnings]) {
    if (!warningMap.has(warning.id)) warningMap.set(warning.id, warning);
  }

  const status: InfillComputeStatus = missingFields.length > 0 || hasRequiredValidationError(validation.errors, item) ? 'draft' : 'valid';

  return {
    status,
    missingFields,
    draftErrors,
    estimate,
    validation: {
      ...validation,
      errors: { ...validation.errors, ...draftErrors },
    },
    warnings: Array.from(warningMap.values()),
  };
}

export function infillFieldId(infillId: string, fieldKey: InfillWarningFieldKey): string {
  return `infill-${infillId}-${fieldKey}`;
}

