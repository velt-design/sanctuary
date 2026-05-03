import type { CostInputsV1 } from '@sp/costing';
import type { CalculatorModuleInputs, InfillLineItem } from '@/lib/types/calculator';
import { RAFTER_SPACING_MM_MAX, normalizeInfillsStateForUi, normalizePanelOrientation, toNumber, type InfillPresetKey } from './calculatorInputs';
import { resolveMonoSlopeShape, resolvePayloadPanelOrientation, type InfillUiState } from './infillCompute';

export const INFILL_DELETE_UNDO_MS = 8000;
export const INFILL_SHEET_MAX_RUN_M = 3.05;
export const INFILL_STRIP_MAX_RUN_M = 6.0;
export const INFILL_SHEET_MAX_SHORT_SIDE_M = 1.2;
export const INFILL_STRIP_MAX_SHORT_SIDE_M = 0.64;
const INFILL_JOINER_TOLERANCE_M = 0.02;

export const INFILL_PRESETS: Array<{ key: InfillPresetKey; label: string }> = [
  { key: 'front', label: 'Front infill (match roof rafters)' },
  { key: 'house', label: 'House infill (match roof rafters)' },
  { key: 'side', label: 'Side infill (target width)' },
  { key: 'gable_triangles', label: 'Gable triangles' },
  { key: 'wall_panel', label: 'Wall panel (partial height)' },
  { key: 'custom', label: 'Custom' },
];

export type InfillUiEstimate = {
  widthM: number;
  maxHeightM: number;
  qty: number;
  panelOrientationUsed: InfillLineItem['panelOrientation'];
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

type InfillUiValidation = {
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
  warnings: string[];
};


function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '\u00e2\u20ac\u201d';
  return n.toFixed(digits);
}

function isFrontOrHouseLocation(location: InfillLineItem['location']): boolean {
  return location === 'front' || location === 'house';
}

function normalizeWidthModeForLocation(item: InfillLineItem): InfillLineItem['widthMode'] {
  if (!isFrontOrHouseLocation(item.location)) return 'target_width';
  return item.widthMode === 'match_roof_rafters' ? 'match_roof_rafters' : 'target_width';
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

export function maxCentreForAcrylicSource(source: InfillLineItem['acrylicSource']): number {
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

export function infillStatusLabel(status: InfillUiState['status']): string {
  return status === 'draft' ? 'Needs setup' : 'Configured';
}

export function formatInfillShapeSummary(shape: InfillLineItem['shape']): string {
  const widthM = Number.isFinite(toNumber(shape.widthM)) ? Math.max(0, toNumber(shape.widthM)) : 0;
  if (shape.type === 'rect') {
    const heightM = Number.isFinite(toNumber(shape.heightM)) ? Math.max(0, toNumber(shape.heightM)) : 0;
    return `${formatMaybeNumber(widthM, 2)}x${formatMaybeNumber(heightM, 2)}m`;
  }
  const low = Number.isFinite(toNumber(shape.heightLowM)) ? Math.max(0, toNumber(shape.heightLowM)) : 0;
  const high = Number.isFinite(toNumber(shape.heightHighM)) ? Math.max(0, toNumber(shape.heightHighM)) : 0;
  return `${formatMaybeNumber(widthM, 2)}x${formatMaybeNumber(low, 2)}m→${formatMaybeNumber(high, 2)}m`;
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

export function estimateInfillUi(item: InfillLineItem, roofRafterSpacingM: number): InfillUiEstimate {
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

  const panelOrientationUsed = normalizePanelOrientation(item.panelOrientation);
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
  if (panelCountEach > 1 && acrossSideM > 0) {
    for (let i = 1; i < panelCountEach; i += 1) {
      const x = (i * acrossSideM) / panelCountEach;
      const mode = item.support.internalSupportMode ?? 'none';
      const supportedByMode =
        mode === 'match_roof_rafters' ||
        (mode === 'center' && Math.abs(x - acrossSideM / 2) <= INFILL_JOINER_TOLERANCE_M) ||
        (mode === 'custom' && customPositionsM.some((p) => Math.abs(p - x) <= INFILL_JOINER_TOLERANCE_M));
      const supportedByRafters = panelOrientationUsed === 'vertical' && canMatchRafters && widthModeUsed === 'match_roof_rafters';
      if (!supportedByMode && !supportedByRafters) unsupportedInternalEach += 1;
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

export function validateInfillUi(item: InfillLineItem, estimate: InfillUiEstimate): InfillUiValidation {
  const errors: InfillUiValidation['errors'] = {};
  const warnings: string[] = [];

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
    errors.acrylicSource = `Run side ${formatMaybeNumber(estimate.runSideM, 2)}m exceeds all material limits (sheet ${formatMaybeNumber(
      INFILL_SHEET_MAX_RUN_M,
      2,
    )}m, strips ${formatMaybeNumber(INFILL_STRIP_MAX_RUN_M, 2)}m).`;
  } else if (estimate.acrylicSourceAutoSwitched) {
    warnings.push(
      `Acrylic source auto-switched from ${acrylicSourceLabel(estimate.preferredAcrylicSource)} to ${acrylicSourceLabel(estimate.acrylicSourceUsed)} because run side ${formatMaybeNumber(estimate.runSideM, 2)}m exceeds ${formatMaybeNumber(maxRunForAcrylicSource(estimate.preferredAcrylicSource), 2)}m.`,
    );
  }

  const bottomOffsetRaw = toNumber(item.shape.bottomOffsetM ?? '0');
  if (!Number.isFinite(bottomOffsetRaw) || bottomOffsetRaw < 0) {
    errors.bottomOffsetM = 'Enter a value of at least 0.';
  } else if (maxHeight > 0 && bottomOffsetRaw >= maxHeight) {
    warnings.push('Bottom offset is greater than or equal to panel height.');
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


export function parseInfillsForPayload(module: CalculatorModuleInputs): CostInputsV1['infills'] | undefined {
  const infills = normalizeInfillsStateForUi((module as any).infills);
  if (!Array.isArray(infills.items) || infills.items.length === 0) return undefined;

  const out: NonNullable<CostInputsV1['infills']> = [];
  const roofRafterSpacingM = estimateRoofRafterSpacing(toNumber(module.lengthM)).spacingM;
  for (const raw of infills.items) {
    const maxPanelWidth = toNumber(raw.maxPanelWidthM);
    const targetPanelWidth = toNumber(raw.targetPanelWidthM);
    const qty = toNumber(raw.qty);
    const widthMode =
      (raw.location === 'front' || raw.location === 'house') && raw.widthMode === 'match_roof_rafters'
        ? 'match_roof_rafters'
        : 'target_width';

    const internalPositions = Array.isArray(raw.support.internalSupportPositionsM)
      ? raw.support.internalSupportPositionsM
          .map(toNumber)
          .filter((n) => Number.isFinite(n) && n >= 0)
      : undefined;

    let shapeOut: NonNullable<CostInputsV1['infills']>[number]['shape'];
    if (raw.shape.type === 'rect') {
      shapeOut = {
        type: 'rect',
        width_m: Number.isFinite(toNumber(raw.shape.widthM)) ? toNumber(raw.shape.widthM) : 0,
        height_m: Number.isFinite(toNumber(raw.shape.heightM)) ? toNumber(raw.shape.heightM) : 0,
        bottom_offset_m: Number.isFinite(toNumber(raw.shape.bottomOffsetM ?? '')) ? toNumber(raw.shape.bottomOffsetM ?? '') : undefined,
      };
    } else {
      const resolved = resolveMonoSlopeShape(raw.shape);
      shapeOut = {
        type: 'mono_slope',
        width_m: Number.isFinite(toNumber(raw.shape.widthM)) ? toNumber(raw.shape.widthM) : 0,
        height_low_m: resolved.leftHeightM,
        height_high_m: resolved.rightHeightM,
        bottom_offset_m: Number.isFinite(toNumber(raw.shape.bottomOffsetM ?? '')) ? toNumber(raw.shape.bottomOffsetM ?? '') : undefined,
      };
    }

    out.push({
      id: raw.id,
      label: raw.label?.trim() ? raw.label.trim() : undefined,
      qty: Number.isFinite(qty) && qty >= 1 ? Math.round(qty) : 1,
      location: raw.location,
      acrylic_source: raw.acrylicSource,
      panel_orientation: resolvePayloadPanelOrientation(raw, roofRafterSpacingM),
      width_mode: widthMode,
      target_panel_width_m: Number.isFinite(targetPanelWidth) ? targetPanelWidth : undefined,
      max_panel_width_m: Number.isFinite(maxPanelWidth) ? Math.min(1.2, Math.max(0.2, maxPanelWidth)) : undefined,
      support: {
        has_top: raw.support.hasTop !== false,
        has_bottom: raw.support.hasBottom !== false,
        has_left: raw.support.hasLeft !== false,
        has_right: raw.support.hasRight !== false,
        internal_support_mode: raw.support.internalSupportMode,
        internal_support_positions_m: internalPositions,
      },
      shape: shapeOut,
    });
  }

  return out.length ? out : undefined;
}

