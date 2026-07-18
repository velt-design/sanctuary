import type { InfillLineItem } from '@/lib/types/calculator';

import type { InfillMonoSlopeAnchorInput, InfillMonoSlopeModeInput } from '@/lib/types/calculator';
import { calculateInfillsTakeoffV1, type InfillTakeoffV1 } from '@sp/costing';
import { canonicalCutListRows, type CutListRow } from './infillTakeoffPresentation';

export type { CutListRow } from './infillTakeoffPresentation';

export const RAFTER_SPACING_MM_MAX = 642;
const INFILL_SHEET_MAX_RUN_M = 3.05;
const INFILL_STRIP_MAX_RUN_M = 6.0;
const INFILL_SHEET_MAX_SHORT_SIDE_M = 1.2;
const INFILL_STRIP_MAX_SHORT_SIDE_M = 0.64;
const INFILL_JOINER_TOLERANCE_M = 0.02;

export type InfillResolvedOrientation = 'vertical' | 'horizontal';
type InfillWarningSection = 'basic' | 'supports' | 'advanced';
type InfillWarningFieldKey =
  | 'acrylic'
  | 'joiner-direction'
  | 'centre-limit'
  | 'shape-width'
  | 'shape-height'
  | 'shape-low'
  | 'shape-high'
  | 'shape-slope'
  | 'shape-bottom'
  | 'support-top'
  | 'support-bottom'
  | 'support-left'
  | 'support-right'
  | 'support-internal-mode'
  | 'support-internal-pos';

export type InfillWarningFix =
  | { type: 'setPreferredAcrylic'; value: 'sheet_panels' | 'strip_620' }
  | { type: 'setCentreLimit'; value: number }
  | { type: 'toggleSupport'; key: 'hasTop' | 'hasBottom' | 'hasLeft' | 'hasRight'; value: boolean };

export type InfillWarningItem = {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  target: {
    section: InfillWarningSection;
    fieldKey: InfillWarningFieldKey;
  };
  fix?: InfillWarningFix;
};

export type InfillJoinerLine = {
  positionM: number;
  supported: boolean;
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
  bayBoundariesM: number[];
  bayWidthsM: number[];
  joinerLines: InfillJoinerLine[];
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
  cutListRows: CutListRow[];
  takeoffStatus: InfillTakeoffV1['status'];
  takeoffWarnings: string[];
  invalidHeightInput: boolean;
  invalidPitchInput: boolean;
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
    slopeDeg?: string;
    targetPanelWidthM?: string;
    maxPanelWidthM?: string;
    bottomOffsetM?: string;
    internalSupportPositionsM?: string;
    takeoff?: string;
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

export function normalizeMonoSlopeMode(value: unknown): InfillMonoSlopeModeInput {
  return value === 'pitch' ? 'pitch' : 'heights';
}

export function normalizeMonoSlopeAnchor(value: unknown): InfillMonoSlopeAnchorInput {
  return value === 'right' ? 'right' : 'left';
}

type ResolvedMonoSlopeShape = {
  leftHeightM: number;
  rightHeightM: number;
  slopeMode: InfillMonoSlopeModeInput;
  slopeAnchor: InfillMonoSlopeAnchorInput;
  slopeDeg: number | null;
  leftInputValid: boolean;
  rightInputValid: boolean;
  anchorInputValid: boolean;
  pitchValid: boolean;
};

export function resolveMonoSlopeShape(shape: Extract<InfillLineItem['shape'], { type: 'mono_slope' }>): ResolvedMonoSlopeShape {
  const widthRaw = toNumber(shape.widthM);
  const widthValid = Number.isFinite(widthRaw) && widthRaw >= 0;
  const widthM = widthValid ? Math.max(0, widthRaw) : 0;
  const leftRaw = toNumber(shape.heightLowM);
  const rightRaw = toNumber(shape.heightHighM);
  const leftInputValid = Number.isFinite(leftRaw) && leftRaw >= 0;
  const rightInputValid = Number.isFinite(rightRaw) && rightRaw >= 0;
  const leftHeightM = leftInputValid ? Math.max(0, leftRaw) : 0;
  const rightHeightM = rightInputValid ? Math.max(0, rightRaw) : 0;
  const slopeMode = normalizeMonoSlopeMode(shape.slopeMode);
  const slopeAnchor = normalizeMonoSlopeAnchor(shape.slopeAnchor);
  const slopeRaw = toNumber(shape.slopeDeg ?? '');
  const pitchValid = Number.isFinite(slopeRaw) && slopeRaw >= 0 && slopeRaw < 90;

  if (slopeMode === 'pitch' && pitchValid && widthValid && widthM > 0) {
    const riseM = Math.tan((slopeRaw * Math.PI) / 180) * widthM;
    if (slopeAnchor === 'left') {
      return {
        leftHeightM,
        rightHeightM: Math.max(0, leftHeightM + riseM),
        slopeMode,
        slopeAnchor,
        slopeDeg: slopeRaw,
        leftInputValid,
        rightInputValid,
        anchorInputValid: leftInputValid,
        pitchValid,
      };
    }

    return {
      leftHeightM: Math.max(0, rightHeightM + riseM),
      rightHeightM,
      slopeMode,
      slopeAnchor,
      slopeDeg: slopeRaw,
      leftInputValid,
      rightInputValid,
      anchorInputValid: rightInputValid,
      pitchValid,
    };
  }

  let derivedSlopeDeg: number | null = null;
  if (widthValid && widthM > 0) {
    derivedSlopeDeg = (Math.atan(Math.abs(rightHeightM - leftHeightM) / widthM) * 180) / Math.PI;
  }

  return {
    leftHeightM,
    rightHeightM,
    slopeMode,
    slopeAnchor,
    slopeDeg: pitchValid ? slopeRaw : derivedSlopeDeg,
    leftInputValid,
    rightInputValid,
    anchorInputValid: slopeAnchor === 'left' ? leftInputValid : rightInputValid,
    pitchValid,
  };
}

export function normalizePanelOrientation(value: unknown): InfillLineItem['panelOrientation'] {
  if (value === 'horizontal' || value === 'auto') return value;
  return 'vertical';
}

function maxRunForAcrylicSource(source: InfillLineItem['acrylicSource']): number {
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

function buildBayBoundaries(acrossSideM: number, panelCountEach: number): number[] {
  if (!Number.isFinite(acrossSideM) || acrossSideM <= 0 || panelCountEach <= 0) return [0];
  const out: number[] = [];
  for (let i = 0; i <= panelCountEach; i += 1) {
    out.push((i * acrossSideM) / panelCountEach);
  }
  return out;
}

function boundaryWarningTarget(orientation: InfillResolvedOrientation, support: InfillLineItem['support']): InfillWarningFieldKey {
  if (orientation === 'vertical') {
    if (!support.hasLeft) return 'support-left';
    if (!support.hasRight) return 'support-right';
    return 'support-left';
  }
  if (!support.hasBottom) return 'support-bottom';
  if (!support.hasTop) return 'support-top';
  return 'support-bottom';
}

function boundaryWarningFix(
  orientation: InfillResolvedOrientation,
  support: InfillLineItem['support'],
): InfillWarningFix | undefined {
  if (orientation === 'vertical') {
    if (!support.hasLeft) return { type: 'toggleSupport', key: 'hasLeft', value: true };
    if (!support.hasRight) return { type: 'toggleSupport', key: 'hasRight', value: true };
    return undefined;
  }
  if (!support.hasBottom) return { type: 'toggleSupport', key: 'hasBottom', value: true };
  if (!support.hasTop) return { type: 'toggleSupport', key: 'hasTop', value: true };
  return undefined;
}

function locationLabel(value: InfillLineItem['location']): string {
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

function acrylicSourceLabel(value: InfillLineItem['acrylicSource']): string {
  return value === 'strip_620' ? '620 strips' : 'Sheet panels';
}

function formatInfillShapeSummary(shape: InfillLineItem['shape']): string {
  const widthM = Number.isFinite(toNumber(shape.widthM)) ? Math.max(0, toNumber(shape.widthM)) : 0;
  if (shape.type === 'rect') {
    const heightM = Number.isFinite(toNumber(shape.heightM)) ? Math.max(0, toNumber(shape.heightM)) : 0;
    return `${formatMaybeNumber(widthM, 2)}x${formatMaybeNumber(heightM, 2)}m`;
  }
  const resolved = resolveMonoSlopeShape(shape);
  const pitchLabel =
    resolved.slopeMode === 'pitch' && resolved.slopeDeg !== null ? ` @ ${formatMaybeNumber(resolved.slopeDeg, 1)}deg` : '';
  return `${formatMaybeNumber(widthM, 2)}x${formatMaybeNumber(resolved.leftHeightM, 2)}m->${formatMaybeNumber(resolved.rightHeightM, 2)}m${pitchLabel}`;
}

function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  return n.toFixed(digits);
}

function estimateRoofRafterSpacing(lengthM: number, derivedRafterCount?: number): { spacingM: number; source: 'derived' | 'fallback' } {
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
  roofEdgeLengthM?: number,
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
    const resolved = resolveMonoSlopeShape(item.shape);
    invalidHeightInput =
      resolved.slopeMode === 'pitch' ? !resolved.anchorInputValid : !resolved.leftInputValid || !resolved.rightInputValid;
    const left = Math.max(0, resolved.leftHeightM);
    const right = Math.max(0, resolved.rightHeightM);
    heightAt = (t01: number) => left + (right - left) * clampNumber(t01, 0, 1);
    avgHeightM = (left + right) / 2;
    maxHeightM = Math.max(left, right);
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
  const bayBoundariesM = buildBayBoundaries(acrossSideM, panelCountEach);
  const bayWidthsM = bayBoundariesM.slice(1).map((value, idx) => Math.max(0, value - bayBoundariesM[idx]));
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
  const joinerLines: InfillJoinerLine[] = [];
  for (let i = 1; i < bayBoundariesM.length - 1; i += 1) {
    joinerLines.push({
      positionM: bayBoundariesM[i],
      supported: !unsupportedInternalIndicesEach.includes(i),
    });
  }

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
  const topJoiner = panelCountEach > 0;
  const bottomJoiner = panelCountEach > 0;
  const canonicalShape = item.shape.type === 'rect'
    ? { type: 'rect' as const, width_m: widthM, height_m: maxHeightM, bottom_offset_m: Math.max(0, toNumber(item.shape.bottomOffsetM ?? '0') || 0) }
    : (() => {
        const resolved = resolveMonoSlopeShape(item.shape);
        return {
          type: 'mono_slope' as const,
          width_m: widthM,
          height_low_m: Math.max(0, resolved.leftHeightM),
          height_high_m: Math.max(0, resolved.rightHeightM),
          bottom_offset_m: Math.max(0, toNumber(item.shape.bottomOffsetM ?? '0') || 0),
        };
      })();
  const canonicalTakeoff = widthM > 0 && maxHeightM > 0 && !invalidHeightInput
    ? calculateInfillsTakeoffV1([
        {
          id: item.id,
          module_id: 'calculator-module',
          label: item.label,
          qty,
          location: item.location,
          acrylic_source: item.acrylicSource,
          panel_orientation: panelOrientationUsed,
          width_mode: widthModeUsed,
          target_panel_width_m: toNumber(item.targetPanelWidthM),
          max_panel_width_m: toNumber(item.maxPanelWidthM),
          support: {
            has_top: item.support.hasTop !== false,
            has_bottom: item.support.hasBottom !== false,
            has_left: item.support.hasLeft !== false,
            has_right: item.support.hasRight !== false,
            internal_support_mode: item.support.internalSupportMode,
            internal_support_positions_m: customPositionsM,
          },
          shape: canonicalShape,
        },
      ], {
        scope_id: `calculator-${item.id}`,
        module_id: 'calculator-module',
        rafter_spacing_m: roofRafterSpacingM,
        edge_length_m: roofEdgeLengthM,
      })
    : null;
  const canonicalItem = canonicalTakeoff?.items[0];
  const cutListRows = canonicalTakeoff && canonicalItem ? canonicalCutListRows(canonicalTakeoff, canonicalItem) : [];
  const canonicalPanelsEach = canonicalItem?.panels.filter((panel) => panel.instance_index === 0) ?? [];
  const canonicalCutsEach = canonicalItem?.linear_cuts.filter((cut) => cut.instance_index === 0) ?? [];
  const canonicalInternalJoinersEach = canonicalCutsEach.filter((cut) => cut.role === 'joiner_internal');
  const canonicalInternalSupportsEach = canonicalCutsEach.filter((cut) => cut.role === 'support_internal');
  const canonicalPerimeterSupportsEach = canonicalCutsEach.filter((cut) => cut.role.startsWith('support_') && cut.role !== 'support_internal');
  const canonicalJoinersEach = canonicalCutsEach.filter((cut) => cut.profile === 'Joiners');
  const resolvedOrientation = canonicalItem?.resolved_orientation ?? panelOrientationUsed;
  const resolvedSource = canonicalItem?.resolved_acrylic_source ?? acrylicSourceUsed;
  const canonicalAcross = resolvedOrientation === 'vertical' ? widthM : maxHeightM;
  const canonicalRun = resolvedOrientation === 'vertical' ? maxHeightM : widthM;
  const canonicalBoundaries = canonicalPanelsEach.length
    ? Array.from(new Set(canonicalPanelsEach.flatMap((panel) => panel.points.map((point) => resolvedOrientation === 'vertical' ? point.x_m : point.y_m))))
        .sort((a, b) => a - b)
    : bayBoundariesM;
  const canonicalUnsupportedPositions = new Set(canonicalInternalSupportsEach.map((cut) => cut.boundary_position_m));
  const canonicalJoinerLines = canonicalInternalJoinersEach.map((cut) => ({
    positionM: cut.boundary_position_m ?? 0,
    supported: !canonicalUnsupportedPositions.has(cut.boundary_position_m),
  }));
  const canonicalStripCuts = resolvedSource === 'strip_620' ? canonicalPanelsEach.map((panel) => panel.blank_length_m) : [];
  const canonicalPanelAreaEach = canonicalPanelsEach.reduce((sum, panel) => sum + panel.finished_area_m2, 0);
  const takeoffStatus = canonicalTakeoff?.status ?? 'blocked';
  const takeoffWarnings = canonicalTakeoff?.warnings.filter((warning) => warning.level === 'critical').map((warning) => warning.message) ?? [];

  return {
    widthM,
    maxHeightM,
    qty,
    panelOrientationRequested: normalizePanelOrientation(item.panelOrientation),
    panelOrientationUsed: resolvedOrientation,
    runSideM: canonicalRun,
    acrossSideM: canonicalAcross,
    materialRunLimitM: maxRunForAcrylicSource(resolvedSource),
    maxCentreM: maxCentreForAcrylicSource(resolvedSource),
    preferredAcrylicSource: item.acrylicSource,
    acrylicSourceUsed: resolvedSource,
    acrylicSourceAutoSwitched: resolvedSource !== item.acrylicSource,
    acrylicSourceUnavailable: takeoffStatus === 'blocked' && canonicalPanelsEach.length === 0,
    canMatchRafters,
    widthModeUsed,
    roofRafterSpacingM,
    panelCountEach: canonicalPanelsEach.length,
    panelCountTotal: canonicalItem?.panels.length ?? panelCountTotal,
    internalJoinerLinesEach: canonicalInternalJoinersEach.length,
    internalJoinerLinesTotal: canonicalItem?.linear_cuts.filter((cut) => cut.role === 'joiner_internal').length ?? internalJoinerLinesTotal,
    bayBoundariesM: canonicalBoundaries,
    bayWidthsM: canonicalBoundaries.slice(1).map((value, index) => Math.max(0, value - canonicalBoundaries[index])),
    joinerLines: canonicalJoinerLines,
    joinerLinesEach: canonicalJoinersEach.length,
    joinerLinesTotal: canonicalItem?.linear_cuts.filter((cut) => cut.profile === 'Joiners').length ?? joinerLinesTotal,
    unsupportedInternalEach: canonicalInternalSupportsEach.length,
    unsupportedInternalTotal: canonicalItem?.linear_cuts.filter((cut) => cut.role === 'support_internal').length ?? unsupportedInternalTotal,
    unsupportedInternalIndicesEach: canonicalJoinerLines.flatMap((line, index) => line.supported ? [] : [index + 1]),
    missingJambsEach: canonicalPerimeterSupportsEach.length,
    missingJambsTotal: (canonicalItem?.linear_cuts.filter((cut) => cut.role.startsWith('support_') && cut.role !== 'support_internal').length ?? missingJambsTotal),
    estimatedMullionsEach: canonicalInternalSupportsEach.length + canonicalPerimeterSupportsEach.length,
    estimatedMullionsTotal: canonicalItem?.linear_cuts.filter((cut) => cut.profile === '50x50').length ?? estimatedMullionsTotal,
    topJoiner: canonicalCutsEach.some((cut) => cut.role === 'joiner_top'),
    bottomJoiner: canonicalCutsEach.some((cut) => cut.role === 'joiner_bottom'),
    perimeterTopRailRequired: item.support.hasTop === false,
    perimeterBottomRailRequired: item.support.hasBottom === false,
    stripCutMinM: canonicalStripCuts.length ? Math.min(...canonicalStripCuts) : null,
    stripCutMaxM: canonicalStripCuts.length ? Math.max(...canonicalStripCuts) : null,
    sheetAreaEachM2: canonicalPanelAreaEach,
    sheetAreaTotalM2: canonicalItem?.panels.reduce((sum, panel) => sum + panel.finished_area_m2, 0) ?? sheetAreaTotalM2,
    cutListRows,
    takeoffStatus,
    takeoffWarnings,
    invalidHeightInput,
    invalidPitchInput: item.shape.type === 'mono_slope' && normalizeMonoSlopeMode(item.shape.slopeMode) === 'pitch'
      ? !resolveMonoSlopeShape(item.shape).pitchValid
      : false,
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

export function estimateInfillUi(item: InfillLineItem, roofRafterSpacingM: number, roofEdgeLengthM?: number): InfillUiEstimate {
  const requested = normalizePanelOrientation(item.panelOrientation);
  if (requested === 'auto') {
    const vertical = makeOrientationEstimate(item, roofRafterSpacingM, 'vertical', roofEdgeLengthM);
    const horizontal = makeOrientationEstimate(item, roofRafterSpacingM, 'horizontal', roofEdgeLengthM);
    return compareEstimates(vertical, horizontal) <= 0 ? vertical : horizontal;
  }
  return makeOrientationEstimate(item, roofRafterSpacingM, requested, roofEdgeLengthM);
}

export function resolvePayloadPanelOrientation(item: InfillLineItem, roofRafterSpacingM: number, roofEdgeLengthM?: number): InfillResolvedOrientation {
  const requested = normalizePanelOrientation(item.panelOrientation);
  if (requested === 'auto') {
    return estimateInfillUi(item, roofRafterSpacingM, roofEdgeLengthM).panelOrientationUsed;
  }
  return requested;
}

function validateInfillUi(item: InfillLineItem, estimate: InfillUiEstimate): InfillUiValidation {
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
    const resolved = resolveMonoSlopeShape(item.shape);
    if (resolved.slopeMode === 'pitch') {
      if (resolved.slopeAnchor === 'left') {
        if (!resolved.leftInputValid) errors.heightLowM = 'Enter a value of at least 0.';
      } else if (!resolved.rightInputValid) {
        errors.heightHighM = 'Enter a value of at least 0.';
      }
      if (!resolved.pitchValid) {
        errors.slopeDeg = 'Enter a degree value from 0 up to 90.';
      }
    } else {
      if (!resolved.leftInputValid) {
        errors.heightLowM = 'Enter a value of at least 0.';
      }
      if (!resolved.rightInputValid) {
        errors.heightHighM = 'Enter a value of at least 0.';
      }
    }
    maxHeight = Math.max(maxHeight, resolved.leftHeightM, resolved.rightHeightM);
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
      fix: { type: 'setPreferredAcrylic', value: estimate.acrylicSourceUsed },
    });
  }

  if (estimate.takeoffStatus === 'blocked') {
    errors.takeoff = estimate.takeoffWarnings[0] ?? 'This infill cannot be cut from the available stock.';
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

  if (estimate.missingJambsEach > 0) {
    warnings.push({
      id: 'missing-boundary-support',
      severity: 'warning',
      message:
        estimate.missingJambsEach === 1
          ? 'One boundary support is missing and may require an added member.'
          : `${estimate.missingJambsEach} boundary supports are missing and may require added members.`,
      target: { section: 'supports', fieldKey: boundaryWarningTarget(estimate.panelOrientationUsed, item.support) },
      fix: boundaryWarningFix(estimate.panelOrientationUsed, item.support),
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
  if (normalizeMonoSlopeMode(shape.slopeMode) === 'pitch') {
    return ['widthM', normalizeMonoSlopeAnchor(shape.slopeAnchor) === 'left' ? 'heightLowM' : 'heightHighM'];
  }
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
  if (item.shape.type === 'mono_slope' && normalizeMonoSlopeMode(item.shape.slopeMode) === 'pitch' && errors.slopeDeg) return true;
  return required.some((field) => {
    const key = draftFieldToErrorKey(field);
    return Boolean(errors[key]);
  });
}

export function resolveInfillUiState(
  item: InfillLineItem,
  roofRafterSpacingM: number,
  draft?: InfillDraftEntry,
  roofEdgeLengthM?: number,
): InfillUiState {
  const estimate = estimateInfillUi(item, roofRafterSpacingM, roofEdgeLengthM);
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
      target: {
        section: 'basic',
        fieldKey:
          item.shape.type === 'rect'
            ? 'shape-height'
            : normalizeMonoSlopeMode(item.shape.slopeMode) === 'pitch'
              ? normalizeMonoSlopeAnchor(item.shape.slopeAnchor) === 'left'
                ? 'shape-low'
                : 'shape-high'
              : 'shape-high',
      },
    });
  }

  if (item.shape.type === 'mono_slope' && normalizeMonoSlopeMode(item.shape.slopeMode) === 'pitch' && validation.errors.slopeDeg) {
    draftWarnings.push({
      id: 'invalid-slope-input',
      severity: 'warning',
      message: 'Slope is incomplete or invalid.',
      target: { section: 'basic', fieldKey: 'shape-slope' },
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

  estimate.takeoffWarnings.forEach((message, index) => {
    draftWarnings.push({
      id: `takeoff-blocker-${index}`,
      severity: 'error',
      message,
      target: { section: 'supports', fieldKey: 'support-internal-mode' },
    });
  });

  const warningMap = new Map<string, InfillWarningItem>();
  for (const warning of [...validation.warnings, ...draftWarnings]) {
    if (!warningMap.has(warning.id)) warningMap.set(warning.id, warning);
  }

  const status: InfillComputeStatus =
    missingFields.length > 0 || hasRequiredValidationError(validation.errors, item) || estimate.takeoffStatus === 'blocked'
      ? 'draft'
      : 'valid';

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

