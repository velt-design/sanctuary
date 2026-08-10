import type { RoofType } from '@sp/costing';
import type { EstimateDetail } from '@/lib/estimates/types';
import type {
  BlindLineItem,
  CalculatorBlindsState,
  CalculatorInputs,
  CalculatorInfillsState,
  CalculatorModuleInputs,
  CalculatorPergola,
  InfillLineItem,
} from '@/lib/types/calculator';
import { inferEdgeConfirmations, makeNoEdgeConfirmations, resolveSupportConfirmations } from './infillSupportPresentation';
import {
  DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
  DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS,
  DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_MODE,
  DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET,
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  makeDefaultHouseFootprintParams,
  migrateLegacyCalculatorInputsToV2,
  normalizeAttachmentSide,
  normalizeBlindsState,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import { makeDefaultFlashings, normalizeFlashingsStateForUi } from './calculatorFlashings';

export {
  formatFlashingLengthInput,
  isPrimaryFlashingLengthAutoLinked,
  makeDefaultPrimaryFlashingRow,
  makeFlashingId,
  normalizeFlashingBand,
  normalizeFlashingPurpose,
  normalizeFlashingsStateForUi,
  roofLengthForPrimaryFlashing,
} from './calculatorFlashings';

export const RAFTER_SPACING_MM_MAX = 642;
export const DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM = '500';

const DEFAULT_MIXED_ACRYLIC_BAYS = 2;
export type InfillPresetKey = 'front' | 'house' | 'side' | 'gable_triangles' | 'wall_panel' | 'custom';

export type CalculatorDraftSessionSnapshot = {
  activeModuleIndex: number;
  updatedAt: number;
  values: CalculatorInputs;
};

export function toNumber(value: string): number {
  if (value.trim() === '') return Number.NaN;
  return Number.parseFloat(value);
}

export function normalizePanelOrientation(value: unknown): InfillLineItem['panelOrientation'] {
  if (value === 'horizontal' || value === 'auto') return value;
  return 'vertical';
}

export function toNonNegativeInt(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : NaN;
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function defaultMixedAcrylicBays(bayCount: number): string {
  return String(clampInt(DEFAULT_MIXED_ACRYLIC_BAYS, 0, bayCount));
}

export function normalizeOverrideValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function isGutterBeamProfile(profile: string | undefined): boolean {
  if (!profile) return false;
  const normalized = profile.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('spgutter');
}

export function computeHasOurGutter(module: CalculatorModuleInputs): boolean {
  if (module.roofMaterial === 'none') return false;
  if (module.invertedEnabled && module.invertedHouseGutter) return false;
  if (module.boxPerimeterEnabled) {
    return module.boxGutterHouseEdge === 'our' || module.boxGutterFarEdge === 'our';
  }
  if (module.pergolaStyle === 'gable') {
    return module.gableHouseEdgeGutter === 'our' || module.gableOuterEdgeGutter === 'our';
  }
  if (module.overhangEnabled) return true;
  if (module.separateGutterEnabled) return true;
  if (module.invertedEnabled && !module.invertedHouseGutter) return true;
  const frontBeamOverride = normalizeOverrideValue(module.overrides?.frontBeamProfile);
  const frontBeamProfileUsed = frontBeamOverride ?? 'SP Gutter';
  return isGutterBeamProfile(frontBeamProfileUsed);
}

export function applyOpenPergolaDefaults(module: CalculatorModuleInputs): CalculatorModuleInputs {
  if (module.roofMaterial !== 'none') return module;
  return {
    ...module,
    pergolaStyle: 'pitched',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '0',
    rafterSpacingMm: module.rafterSpacingMm?.trim() || DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM,
    boxGutterHouseEdge: 'none',
    boxGutterFarEdge: 'none',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    invertedEnabled: false,
    invertedHouseGutter: false,
    flashings: { rows: [] },
  };
}

export function getRoofTypeForModule(module: CalculatorModuleInputs): RoofType {
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

export function computeBayCountsForModule(
  module: CalculatorModuleInputs,
): { roofType: RoofType; bayCountMain: number; bayCountA: number; bayCountB: number } {
  const roofType = getRoofTypeForModule(module);

  const lengthM = toNumber(module.lengthM);
  const lengthMmA = Number.isFinite(lengthM) && lengthM > 0 ? Math.round(lengthM * 1000) : 0;
  const rafterCountA = lengthMmA > 0 ? Math.ceil(lengthMmA / RAFTER_SPACING_MM_MAX) + 1 : 0;
  const bayCountA = Math.max(0, rafterCountA - 1);

  if (roofType === 'hip_corner') {
    const lengthBM = toNumber(module.hipCornerLengthBM);
    const lengthMmB = Number.isFinite(lengthBM) && lengthBM > 0 ? Math.round(lengthBM * 1000) : 0;
    const rafterCountB = lengthMmB > 0 ? Math.ceil(lengthMmB / RAFTER_SPACING_MM_MAX) + 1 : 0;
    const bayCountB = Math.max(0, rafterCountB - 1);
    return { roofType, bayCountMain: 0, bayCountA, bayCountB };
  }

  if (roofType === 'pitched') return { roofType, bayCountMain: bayCountA, bayCountA: 0, bayCountB: 0 };
  return { roofType, bayCountMain: 0, bayCountA, bayCountB: bayCountA };
}

export function makeDefaultModule(pergolaId = 'pergola-1'): CalculatorModuleInputs {
  const module: CalculatorModuleInputs = {
    pergolaId,
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'Black',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '',
    rafterSpacingMm: DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM,
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0.2',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: true,
    mixedSkylightStripCount: '1',
    mixedSkylightStripWidthM: '0.62',
    mixedAcrylicBaysMain: '',
    mixedAcrylicBaysA: '',
    mixedAcrylicBaysB: '',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',

    postCount: '4',
    houseConnectionType: 'soffit',
    attachmentSide: DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
    drawingRotationQuarterTurns: DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS,
    houseFootprintMode: DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_MODE,
    houseFootprintPreset: DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET,
    houseFootprintParams: makeDefaultHouseFootprintParams(),
    houseFootprintPolygon: [],
    postConnectionType: 'deck_bracket',
    ground: 'easy',

    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',

    timberRoofAllowanceExGst: '0',

    flashings: { rows: [] },
    overrides: {},
    infills: makeDefaultInfills(),
  };
  module.flashings = makeDefaultFlashings(module);
  return module;
}

export function makeDefaultCalculatorInputs(): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: '',
    quoteRef: '',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    pricingClassification: 'simple',
    approvalRequirement: 'neither',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [makeDefaultModule('pergola-1')],
    blinds: makeDefaultBlinds(),
  };
}

export function makeBlindId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `blind-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeDefaultBlindItem(overrides?: Partial<BlindLineItem>): BlindLineItem {
  return {
    id: makeBlindId(),
    system: 'ZIPTRAK',
    widthMm: '',
    coverLengthMm: '',
    fabric: 'MESH',
    motorised: 'NONE',
    rollCover: 'NONE',
    ...overrides,
  };
}

function makeDefaultBlinds(): CalculatorBlindsState {
  return { items: [] };
}

export function makeInfillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `infill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatInputNumber(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  return rounded.toFixed(digits).replace(/\.?0+$/, '');
}

function getDefaultPitchForModule(module: CalculatorModuleInputs): number {
  const roofType = getRoofTypeForModule(module);
  if (roofType === 'low_gable') return 10;
  if (roofType === 'gable' || roofType === 'hip' || roofType === 'hip_corner') return 25;
  return 5;
}

export function getPitchForModule(module: CalculatorModuleInputs): number {
  const parsed = toNumber(module.roofPitchDeg);
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(85, parsed));
  return getDefaultPitchForModule(module);
}

export function makeDefaultInfillItem(overrides?: Partial<InfillLineItem>): InfillLineItem {
  const base: InfillLineItem = {
    id: makeInfillId(),
    qty: '1',
    location: 'custom',
    acrylicSource: 'sheet_panels',
    panelOrientation: 'vertical',
    widthMode: 'target_width',
    targetPanelWidthM: '1',
    maxPanelWidthM: '1.2',
    support: {
      hasTop: false,
      hasBottom: false,
      hasLeft: false,
      hasRight: false,
      edgeConfirmations: makeNoEdgeConfirmations(),
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
    shape: {
      type: 'rect',
      widthM: '1',
      heightM: '1',
      bottomOffsetM: '0',
    },
  };
  if (!overrides) return base;
  const mergedSupport = { ...base.support, ...(overrides.support ?? {}) };
  const legacySupportFallback = overrides.support
    ? {
        hasTop: overrides.support.hasTop !== false,
        hasBottom: overrides.support.hasBottom !== false,
        hasLeft: overrides.support.hasLeft !== false,
        hasRight: overrides.support.hasRight !== false,
      }
    : mergedSupport;
  const normalizedSupport = overrides.support
    ? resolveSupportConfirmations({
        ...mergedSupport,
        ...legacySupportFallback,
        edgeConfirmations: overrides.support.edgeConfirmations ?? inferEdgeConfirmations(legacySupportFallback),
      })
    : mergedSupport;
  return {
    ...base,
    ...overrides,
    panelOrientation: normalizePanelOrientation(overrides.panelOrientation ?? base.panelOrientation),
    support: normalizedSupport,
    shape:
      overrides.shape?.type === 'mono_slope'
        ? {
            type: 'mono_slope',
            widthM: overrides.shape.widthM ?? '1',
            heightLowM: overrides.shape.heightLowM ?? '0',
            heightHighM: overrides.shape.heightHighM ?? '1',
            bottomOffsetM: overrides.shape.bottomOffsetM ?? '0',
            slopeMode: overrides.shape.slopeMode ?? 'heights',
            slopeDeg: overrides.shape.slopeDeg ?? '',
            slopeAnchor: overrides.shape.slopeAnchor ?? 'left',
          }
        : {
            type: 'rect',
            widthM: (overrides.shape as any)?.widthM ?? '1',
            heightM: (overrides.shape as any)?.heightM ?? '1',
            bottomOffsetM: (overrides.shape as any)?.bottomOffsetM ?? '0',
          },
  };
}

function makeDefaultInfills(): CalculatorInfillsState {
  return { items: [] };
}

export function normalizeInfillsStateForUi(value: unknown): CalculatorInfillsState {
  if (!value || typeof value !== 'object' || !Array.isArray((value as any).items)) return makeDefaultInfills();
  const items = (value as any).items
    .filter((item: unknown) => item && typeof item === 'object')
    .map((item: unknown) => makeDefaultInfillItem(item as Partial<InfillLineItem>));
  return { items };
}

export function buildInfillPreset(module: CalculatorModuleInputs, location: InfillLineItem['location']): Partial<InfillLineItem> {
  const lengthM = Number.isFinite(toNumber(module.lengthM)) && toNumber(module.lengthM) > 0 ? toNumber(module.lengthM) : 1;
  const projectionM = Number.isFinite(toNumber(module.projectionM)) && toNumber(module.projectionM) > 0 ? toNumber(module.projectionM) : 1;
  const postCutHeightM =
    Number.isFinite(toNumber(module.postCutHeightM)) && toNumber(module.postCutHeightM) > 0 ? toNumber(module.postCutHeightM) : 2.4;
  const pitchDeg = getPitchForModule(module);
  const pitchRad = (pitchDeg * Math.PI) / 180;

  if (location === 'front' || location === 'house') {
    return {
      location,
      widthMode: 'match_roof_rafters',
      shape: {
        type: 'rect',
        widthM: formatInputNumber(lengthM),
        heightM: formatInputNumber(postCutHeightM),
        bottomOffsetM: '0',
      },
      support: {
        hasTop: false,
        hasBottom: false,
        hasLeft: false,
        hasRight: false,
        edgeConfirmations: makeNoEdgeConfirmations(),
        internalSupportMode: 'match_roof_rafters',
        internalSupportPositionsM: [],
      },
    };
  }

  if (location === 'side') {
    const farHeight = Math.max(0, postCutHeightM - Math.tan(pitchRad) * projectionM);
    return {
      location,
      widthMode: 'target_width',
      shape: {
        type: 'mono_slope',
        widthM: formatInputNumber(projectionM),
        heightLowM: formatInputNumber(postCutHeightM),
        heightHighM: formatInputNumber(farHeight),
        bottomOffsetM: '0',
        slopeMode: 'pitch',
        slopeDeg: formatInputNumber(pitchDeg, 2),
        slopeAnchor: 'right',
      },
      support: {
        hasTop: false,
        hasBottom: false,
        hasLeft: false,
        hasRight: false,
        edgeConfirmations: makeNoEdgeConfirmations(),
        internalSupportMode: 'none',
        internalSupportPositionsM: [],
      },
    };
  }

  return {
    location,
    widthMode: 'target_width',
    support: {
      hasTop: false,
      hasBottom: false,
      hasLeft: false,
      hasRight: false,
      edgeConfirmations: makeNoEdgeConfirmations(),
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
  };
}

function buildGableEndInfillPair(module: CalculatorModuleInputs): [InfillLineItem, InfillLineItem] {
  const projectionM = Number.isFinite(toNumber(module.projectionM)) && toNumber(module.projectionM) > 0 ? toNumber(module.projectionM) : 1;
  const baseWidth = Math.max(0.1, projectionM / 2);
  const pitchDeg = getPitchForModule(module);
  const peakHeight = Math.max(0, Math.tan((pitchDeg * Math.PI) / 180) * baseWidth);

  const left = makeDefaultInfillItem({
    label: 'Gable left',
    location: 'gable_end',
    acrylicSource: 'sheet_panels',
    widthMode: 'target_width',
    targetPanelWidthM: '1',
    maxPanelWidthM: '1.2',
    support: {
      hasTop: false,
      hasBottom: false,
      hasLeft: false,
      hasRight: false,
      edgeConfirmations: makeNoEdgeConfirmations(),
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
    shape: {
      type: 'mono_slope',
      widthM: formatInputNumber(baseWidth),
      heightLowM: '0',
      heightHighM: formatInputNumber(peakHeight),
      bottomOffsetM: '0',
      slopeMode: 'pitch',
      slopeDeg: formatInputNumber(pitchDeg, 2),
      slopeAnchor: 'left',
    },
  });

  const right = makeDefaultInfillItem({
    label: 'Gable right',
    location: 'gable_end',
    acrylicSource: 'sheet_panels',
    widthMode: 'target_width',
    targetPanelWidthM: '1',
    maxPanelWidthM: '1.2',
    support: {
      hasTop: false,
      hasBottom: false,
      hasLeft: false,
      hasRight: false,
      edgeConfirmations: makeNoEdgeConfirmations(),
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
    shape: {
      type: 'mono_slope',
      widthM: formatInputNumber(baseWidth),
      heightLowM: formatInputNumber(peakHeight),
      heightHighM: '0',
      bottomOffsetM: '0',
      slopeMode: 'pitch',
      slopeDeg: formatInputNumber(pitchDeg, 2),
      slopeAnchor: 'right',
    },
  });

  return [left, right];
}

export function buildInfillItemsForPreset(module: CalculatorModuleInputs, preset: InfillPresetKey): InfillLineItem[] {
  const lengthM = Number.isFinite(toNumber(module.lengthM)) && toNumber(module.lengthM) > 0 ? toNumber(module.lengthM) : 1;
  const postCutHeightM =
    Number.isFinite(toNumber(module.postCutHeightM)) && toNumber(module.postCutHeightM) > 0 ? toNumber(module.postCutHeightM) : 2.4;

  if (preset === 'gable_triangles') {
    const [left, right] = buildGableEndInfillPair(module);
    left.label = 'Gable triangle (left)';
    right.label = 'Gable triangle (right)';
    return [left, right];
  }

  if (preset === 'front') {
    return [
      makeDefaultInfillItem({
        ...buildInfillPreset(module, 'front'),
        label: 'Front infill',
      }),
    ];
  }

  if (preset === 'house') {
    return [
      makeDefaultInfillItem({
        ...buildInfillPreset(module, 'house'),
        label: 'House infill',
      }),
    ];
  }

  if (preset === 'side') {
    return [
      makeDefaultInfillItem({
        ...buildInfillPreset(module, 'side'),
        label: 'Side infill',
      }),
    ];
  }

  if (preset === 'wall_panel') {
    const wallHeightM = Math.max(0.6, Math.min(postCutHeightM, postCutHeightM * 0.5));
    return [
      makeDefaultInfillItem({
        label: 'Wall panel',
        location: 'wall',
        acrylicSource: 'sheet_panels',
        widthMode: 'target_width',
        shape: {
          type: 'rect',
          widthM: formatInputNumber(lengthM),
          heightM: formatInputNumber(wallHeightM),
          bottomOffsetM: '0',
        },
        support: {
          hasTop: false,
          hasBottom: false,
          hasLeft: false,
          hasRight: false,
          edgeConfirmations: makeNoEdgeConfirmations(),
          internalSupportMode: 'none',
          internalSupportPositionsM: [],
        },
      }),
    ];
  }

  return [makeDefaultInfillItem({
    label: 'Custom infill',
    ...buildInfillPreset(module, 'custom'),
    shape: { type: 'rect', widthM: '', heightM: '', bottomOffsetM: '0' },
  })];
}

export function normalizeBlindsStateForUi(value: unknown): CalculatorBlindsState {
  const normalized = normalizeBlindsState(value);
  if (normalized && Array.isArray(normalized.items)) return normalized;
  return makeDefaultBlinds();
}

const CALCULATOR_DRAFT_SESSION_PREFIX = 'sanctuary-portal:calculator:draft:v1';

export function calculatorDraftSessionKey(projectId: string, fromEstimateId: string, editEstimateId: string): string {
  const modeKey = editEstimateId ? `edit:${editEstimateId}` : fromEstimateId ? `duplicate:${fromEstimateId}` : 'new';
  return [CALCULATOR_DRAFT_SESSION_PREFIX, projectId || 'none', modeKey].join(':');
}

function normalizeModuleForUi(value: unknown): CalculatorModuleInputs {
  const source = value && typeof value === 'object' ? (value as Partial<CalculatorModuleInputs>) : {};
  const merged: CalculatorModuleInputs = { ...makeDefaultModule(), ...source };
  merged.attachmentSide =
    merged.houseConnectionType === 'none' || !supportsHouseFootprints(merged.pergolaStyle)
      ? DEFAULT_CALCULATOR_ATTACHMENT_SIDE
      : normalizeAttachmentSide(source.attachmentSide);
  merged.drawingRotationQuarterTurns = normalizeDrawingRotationQuarterTurns(source.drawingRotationQuarterTurns);
  merged.houseFootprintMode = normalizeHouseFootprintMode(source.houseFootprintMode);
  merged.houseFootprintPreset = normalizeHouseFootprintPreset(source.houseFootprintPreset);
  merged.houseFootprintParams = normalizeHouseFootprintParams(source.houseFootprintParams);
  merged.houseFootprintPolygon = normalizeHouseFootprintPolygon(source.houseFootprintPolygon);
  merged.flashings = normalizeFlashingsStateForUi((source as any).flashings, merged);
  merged.infills = normalizeInfillsStateForUi((source as any).infills);

  if (merged.roofMaterial === 'none') return applyOpenPergolaDefaults(merged);

  if (merged.pergolaStyle === 'gable' && merged.houseConnectionType === 'none') {
    merged.gableHouseEdgeGutter = 'our';
    merged.gableOuterEdgeGutter = 'our';
  }

  if (merged.roofMaterial !== 'mixed') return merged;

  const bayCounts = computeBayCountsForModule(merged);
  const hasMain = Object.prototype.hasOwnProperty.call(source, 'mixedAcrylicBaysMain');
  const hasA = Object.prototype.hasOwnProperty.call(source, 'mixedAcrylicBaysA');
  const hasB = Object.prototype.hasOwnProperty.call(source, 'mixedAcrylicBaysB');

  if (bayCounts.roofType === 'pitched') {
    if (!hasMain) merged.mixedAcrylicBaysMain = defaultMixedAcrylicBays(bayCounts.bayCountMain);
  } else {
    if (!hasA) merged.mixedAcrylicBaysA = defaultMixedAcrylicBays(bayCounts.bayCountA);
    if (!hasB) merged.mixedAcrylicBaysB = defaultMixedAcrylicBays(bayCounts.bayCountB);
  }

  return merged;
}

function normalizePergolaIdForUi(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function normalizePergolasForUi(value: unknown): CalculatorPergola[] {
  const rawPergolas = Array.isArray(value) ? value : [];
  const out: CalculatorPergola[] = [];
  const seen = new Set<string>();

  for (let idx = 0; idx < rawPergolas.length; idx += 1) {
    const raw = rawPergolas[idx] as any;
    if (!raw || typeof raw !== 'object') continue;

    const baseId = normalizePergolaIdForUi(raw.id, `pergola-${idx + 1}`);
    let id = baseId;
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${baseId}-${n}`)) n += 1;
      id = `${baseId}-${n}`;
    }
    seen.add(id);

    const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : `Pergola ${out.length + 1}`;
    out.push({ id, label });
  }

  if (!out.length) out.push({ id: 'pergola-1', label: 'Pergola 1' });
  return out;
}

function normalizeModulesForUi(value: unknown, pergolas: CalculatorPergola[]): CalculatorModuleInputs[] {
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';
  const knownPergolaIds = new Set(pergolas.map((p) => p.id));

  if (!Array.isArray(value) || value.length === 0) return [makeDefaultModule(fallbackPergolaId)];

  return value.map((item) => {
    const merged = normalizeModuleForUi(item);
    const modulePergolaId = typeof merged.pergolaId === 'string' && knownPergolaIds.has(merged.pergolaId) ? merged.pergolaId : fallbackPergolaId;
    return { ...merged, pergolaId: modulePergolaId };
  });
}

export function normalizeCalculatorInputsForUi(value: CalculatorInputs): CalculatorInputs {
  const pergolas = normalizePergolasForUi((value as any).pergolas);
  const normalizedModules = normalizeModulesForUi(value.modules, pergolas);
  const usedPergolaIds = new Set(normalizedModules.map((module) => module.pergolaId ?? pergolas[0]?.id ?? 'pergola-1'));
  const filteredPergolas = pergolas.filter((pergola) => usedPergolaIds.has(pergola.id));
  const finalPergolas = filteredPergolas.length ? filteredPergolas : [{ id: 'pergola-1', label: 'Pergola 1' }];
  const finalPergolaIds = new Set(finalPergolas.map((pergola) => pergola.id));
  const fallbackPergolaId = finalPergolas[0]?.id ?? 'pergola-1';
  const modules =
    normalizedModules.length > 0
      ? normalizedModules.map((module) => ({
          ...module,
          pergolaId: finalPergolaIds.has(String(module.pergolaId ?? '')) ? module.pergolaId : fallbackPergolaId,
        }))
      : [makeDefaultModule(fallbackPergolaId)];

  return {
    ...value,
    schemaVersion: 'v2',
    jobType: value.jobType === 'commercial' ? 'commercial' : 'residential',
    pricingClassification: value.pricingClassification === 'simple' ? 'simple' : 'bespoke',
    approvalRequirement:
      value.approvalRequirement === 'engineering_required' || value.approvalRequirement === 'full_building_consent'
        ? value.approvalRequirement
        : 'neither',
    pergolas: finalPergolas,
    modules,
    blinds: normalizeBlindsStateForUi((value as any).blinds),
  };
}

export function calculatorInputsFromEstimateDetail(detail: EstimateDetail): CalculatorInputs {
  const inputs = (detail.calculatorSnapshot as any)?.inputs;
  if (isCalculatorInputsV2(inputs)) return normalizeCalculatorInputsForUi(inputs);
  if (isLegacyCalculatorInputsV1(inputs)) return normalizeCalculatorInputsForUi(migrateLegacyCalculatorInputsToV2(inputs));
  throw new Error('Design inputs are not compatible with this calculator version.');
}

export function nextPergola(values: CalculatorInputs): CalculatorPergola {
  const existing = Array.isArray(values.pergolas) ? values.pergolas : [];
  const ids = new Set(existing.map((pergola) => pergola.id));
  let ordinal = 1;
  while (ids.has(`pergola-${ordinal}`)) ordinal += 1;
  return { id: `pergola-${ordinal}`, label: `Pergola ${ordinal}` };
}

export function prunePergolasForModules(pergolas: CalculatorPergola[] | undefined, modules: CalculatorModuleInputs[]): CalculatorPergola[] {
  const normalizedPergolas = normalizePergolasForUi(pergolas);
  const usedPergolaIds = new Set(modules.map((module) => module.pergolaId).filter((id): id is string => typeof id === 'string' && id.length > 0));
  const filtered = normalizedPergolas.filter((pergola) => usedPergolaIds.has(pergola.id));
  if (filtered.length > 0) return filtered;
  return normalizedPergolas.length > 0 ? [normalizedPergolas[0]] : [{ id: 'pergola-1', label: 'Pergola 1' }];
}

export function getPergolaLabel(pergolas: CalculatorPergola[] | undefined, pergolaId: string | undefined, fallbackIndex: number): string {
  const list = Array.isArray(pergolas) ? pergolas : [];
  const found = list.find((pergola) => pergola.id === pergolaId);
  if (found?.label) return found.label;
  return `Pergola ${fallbackIndex + 1}`;
}
