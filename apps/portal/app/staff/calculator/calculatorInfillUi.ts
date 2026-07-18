import type { CostInputsV1 } from '@sp/costing';
import type { CalculatorModuleInputs, InfillLineItem } from '@/lib/types/calculator';
import { RAFTER_SPACING_MM_MAX, normalizeInfillsStateForUi, toNumber, type InfillPresetKey } from './calculatorInputs';
import {
  estimateInfillUi as estimateCanonicalInfillUi,
  resolveMonoSlopeShape,
  type InfillUiEstimate,
  type InfillUiState,
} from './infillCompute';
import { resolveSupportConfirmations } from './infillSupportPresentation';

export type { InfillUiEstimate } from './infillCompute';

export const INFILL_DELETE_UNDO_MS = 8000;
export const INFILL_SHEET_MAX_RUN_M = 3.05;
export const INFILL_STRIP_MAX_RUN_M = 6.0;
export const INFILL_SHEET_MAX_SHORT_SIDE_M = 1.2;
export const INFILL_STRIP_MAX_SHORT_SIDE_M = 0.64;

export const INFILL_PRESETS: Array<{ key: InfillPresetKey; label: string }> = [
  { key: 'front', label: 'Front infill (match roof rafters)' },
  { key: 'house', label: 'House infill (match roof rafters)' },
  { key: 'side', label: 'Side infill (target width)' },
  { key: 'gable_triangles', label: 'Gable triangles' },
  { key: 'wall_panel', label: 'Wall panel (partial height)' },
  { key: 'custom', label: 'Custom' },
];

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


function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '\u00e2\u20ac\u201d';
  return n.toFixed(digits);
}

export function maxRunForAcrylicSource(source: InfillLineItem['acrylicSource']): number {
  if (source === 'auto') return INFILL_STRIP_MAX_RUN_M;
  return source === 'strip_620' ? INFILL_STRIP_MAX_RUN_M : INFILL_SHEET_MAX_RUN_M;
}

export function maxCentreForAcrylicSource(source: InfillLineItem['acrylicSource']): number {
  if (source === 'auto') return INFILL_SHEET_MAX_SHORT_SIDE_M;
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
  if (value === 'auto') return 'Automatic';
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

export function estimateInfillUi(
  item: InfillLineItem,
  roofRafterSpacingM: number,
  roofEdgeLengthM?: number,
): InfillUiEstimate {
  return estimateCanonicalInfillUi(item, roofRafterSpacingM, roofEdgeLengthM);
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

  if (item.shape.type === 'rect') {
    const heightRaw = toNumber(item.shape.heightM);
    if (!Number.isFinite(heightRaw) || heightRaw < 0) {
      errors.heightM = 'Enter a value of at least 0.';
    }
  } else {
    const lowRaw = toNumber(item.shape.heightLowM);
    const highRaw = toNumber(item.shape.heightHighM);
    if (!Number.isFinite(lowRaw) || lowRaw < 0) {
      errors.heightLowM = 'Enter a value of at least 0.';
    }
    if (!Number.isFinite(highRaw) || highRaw < 0) {
      errors.heightHighM = 'Enter a value of at least 0.';
    }
  }

  if (estimate.acrylicSourceUnavailable) {
    errors.acrylicSource = `Run side ${formatMaybeNumber(estimate.runSideM, 2)}m exceeds all material limits (sheet ${formatMaybeNumber(
      INFILL_SHEET_MAX_RUN_M,
      2,
    )}m, strips ${formatMaybeNumber(INFILL_STRIP_MAX_RUN_M, 2)}m).`;
  } else if (estimate.acrylicSourceAutoSwitched && item.acrylicSource !== 'auto') {
    warnings.push(
      `Acrylic source auto-switched from ${acrylicSourceLabel(estimate.preferredAcrylicSource)} to ${acrylicSourceLabel(estimate.acrylicSourceUsed)} because run side ${formatMaybeNumber(estimate.runSideM, 2)}m exceeds ${formatMaybeNumber(maxRunForAcrylicSource(estimate.preferredAcrylicSource), 2)}m.`,
    );
  }

  const bottomOffsetRaw = toNumber(item.shape.bottomOffsetM ?? '0');
  if (!Number.isFinite(bottomOffsetRaw) || bottomOffsetRaw < 0) {
    errors.bottomOffsetM = 'Enter a value of at least 0.';
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
    const resolvedSupport = resolveSupportConfirmations(raw.support);
    const canonical = estimateCanonicalInfillUi(raw, roofRafterSpacingM, toNumber(module.lengthM));
    const maxPanelWidth = toNumber(raw.maxPanelWidthM);
    const targetPanelWidth = toNumber(raw.targetPanelWidthM);
    const qty = toNumber(raw.qty);
    const widthMode =
      (raw.location === 'front' || raw.location === 'house') && raw.widthMode === 'match_roof_rafters'
        ? 'match_roof_rafters'
        : 'target_width';

    const internalPositions = Array.isArray(resolvedSupport.internalSupportPositionsM)
      ? resolvedSupport.internalSupportPositionsM
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
      acrylic_source: canonical.acrylicSourceUsed,
      panel_orientation: canonical.panelOrientationUsed,
      width_mode: widthMode,
      target_panel_width_m: Number.isFinite(targetPanelWidth) ? targetPanelWidth : undefined,
      max_panel_width_m: Number.isFinite(maxPanelWidth) ? Math.min(1.2, Math.max(0.2, maxPanelWidth)) : undefined,
      support: {
        has_top: resolvedSupport.hasTop,
        has_bottom: resolvedSupport.hasBottom,
        has_left: resolvedSupport.hasLeft,
        has_right: resolvedSupport.hasRight,
        internal_support_mode: resolvedSupport.internalSupportMode,
        internal_support_positions_m: internalPositions,
      },
      shape: shapeOut,
    });
  }

  return out.length ? out : undefined;
}

