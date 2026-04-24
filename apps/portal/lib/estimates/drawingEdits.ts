import type { ModuleViewsTab } from '@/app/(portal)/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/(portal)/staff/calculator/moduleViews';
import { buildCustomHouseFootprintPolygon, buildHouseFootprintPresetSideLocalPoints } from '@sp/geometry';
import type {
  DeckPresetRect,
  DeckElevationMode,
  DeckKind,
  DeckPresetType,
  DeckShape,
  DeckSurfaceMaterial,
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  WallOpeningHostSide,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  isPrimaryFlashingLengthAutoLinked,
  normalizeFlashingsStateForUi,
  roofLengthForPrimaryFlashing,
  formatFlashingLengthInput,
} from '@/lib/drawings/flashings';
import {
  DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
  type EstimateDrawingSheetMeta,
} from './drawingSheet';
import type {
  CalculatorFlashingsState,
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseRoofMaterial,
  CalculatorInputs,
  CalculatorModuleInputs,
  CalculatorModuleOverrides,
} from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  type CalculatorHouseStoreyMode,
  type CalculatorHouseFootprintMode,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';

type AnyRecord = Record<string, unknown>;

export const ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY = 'drawing_sheet_overrides';

export type EstimateDrawingOverrides = {
  noteOverride?: string | null;
  moduleTitleOverrides?: Record<string, string>;
};

export type EstimateDrawingDraft = {
  inputs: CalculatorInputs;
  overrides: EstimateDrawingOverrides;
  houseFirst?: {
    roof?: HouseFirstRoofDraft | null;
    decks?: HouseFirstDeckDraft[] | null;
    openings?: HouseFirstOpeningDraft[] | null;
  };
};

export type EstimateDrawingFieldTarget =
  | {
      type: 'module_input';
      moduleIndex: number;
      field:
        | 'lengthM'
        | 'projectionM'
        | 'hipCornerLengthBM'
        | 'hipCornerProjectionBM'
        | 'roofPitchDeg'
        | 'postCutHeightM';
    }
  | {
      type: 'module_title';
      moduleIndex: number;
    }
  | {
      type: 'estimate_note';
    };

export type EstimateDrawingFieldEditor = 'singleline' | 'multiline';

export type EstimateDrawingField = {
  id: string;
  label: string;
  rawValue: string;
  displayValue: string;
  defaultValue?: string;
  svgFieldId?: string;
  editor: EstimateDrawingFieldEditor;
  target: EstimateDrawingFieldTarget;
};

export type EstimateDrawingFieldApplyResult =
  | {
      ok: true;
      draft: EstimateDrawingDraft;
    }
  | {
      ok: false;
      error: string;
    };

export type EstimateDrawingFootprintEdit =
  | {
      type: 'mode';
      mode: CalculatorHouseFootprintMode;
    }
  | {
      type: 'preset';
      preset: CalculatorModuleInputs['houseFootprintPreset'];
    }
  | {
      type: 'rotate';
      delta: -1 | 1;
    }
  | {
      type: 'attachment_side';
      side: CalculatorModuleInputs['attachmentSide'];
    }
  | {
      type: 'param';
      key: keyof CalculatorHouseFootprintParams;
      value: string;
    }
  | {
      type: 'polygon';
      polygon: CalculatorHouseFootprintPolygonPoint[];
    }
  | {
      type: 'custom_polygon';
      polygon: CalculatorHouseFootprintPolygonPoint[];
    };

export type EstimateDrawingModuleFieldEdit =
  | {
      field: 'pergolaStyle';
      value: CalculatorModuleInputs['pergolaStyle'];
    }
  | {
      field: 'roofMaterial';
      value: CalculatorModuleInputs['roofMaterial'];
    }
  | {
      field: 'houseConnectionType';
      value: CalculatorModuleInputs['houseConnectionType'];
    }
  | {
      field: 'postConnectionType';
      value: CalculatorModuleInputs['postConnectionType'];
    }
  | {
      field: 'ground';
      value: CalculatorModuleInputs['ground'];
    }
  | {
      field: 'moduleValue';
      key: EditableModuleFieldKey;
      value: CalculatorModuleInputs[EditableModuleFieldKey];
    }
  | {
      field: 'jobValue';
      key: EditableJobFieldKey;
      value: CalculatorInputs[EditableJobFieldKey];
    }
  | {
      field: 'moduleOverride';
      key: keyof CalculatorModuleOverrides;
      value: string;
    }
  | {
      field: 'flashings';
      value: CalculatorFlashingsState;
    };

export type EditableJobFieldKey =
  | 'access'
  | 'height'
  | 'jobType'
  | 'travelExGst'
  | 'extrasAllowanceExGst'
  | 'quoteDiscountPct';

export type EditableModuleFieldKey =
  | 'pergolaStyle'
  | 'boxPerimeterEnabled'
  | 'roofMaterial'
  | 'mixedAcrylicBaysMain'
  | 'mixedAcrylicBaysA'
  | 'mixedAcrylicBaysB'
  | 'timberRoofAboveType'
  | 'timberTrayWidthMm'
  | 'extrusionColour'
  | 'powdercoatStandardColour'
  | 'powdercoatIsCustom'
  | 'powdercoatCustomColour'
  | 'lengthM'
  | 'projectionM'
  | 'hipCornerLengthBM'
  | 'hipCornerProjectionBM'
  | 'roofPitchDeg'
  | 'gableEndFramesMode'
  | 'gableHouseEdgeGutter'
  | 'gableOuterEdgeGutter'
  | 'invertedEnabled'
  | 'invertedHouseGutter'
  | 'overhangEnabled'
  | 'overhangAmountM'
  | 'overhangSupportBeamProfile'
  | 'postCutHeightM'
  | 'postCount'
  | 'houseConnectionType'
  | 'postConnectionType'
  | 'ground'
  | 'houseStoreyMode'
  | 'houseRoofMaterial'
  | 'houseAttachmentStrategy'
  | 'houseEaveHeightM'
  | 'houseWallHeightM'
  | 'houseRoofPitchDeg'
  | 'houseSoffitDepthMm'
  | 'houseFasciaHeightMm'
  | 'houseGutterWidthMm'
  | 'houseGutterDepthMm'
  | 'houseGutterProjectionMm'
  | 'houseEaveOverhangMm'
  | 'boxGutterHouseEdge'
  | 'boxGutterFarEdge'
  | 'downpipeCount'
  | 'downpipeJoinCount'
  | 'downpipeElbowCount'
  | 'separateGutterEnabled';

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}

function formatPitch(value: number): string {
  return `${value.toFixed(1)} deg`;
}

function normalizeLengthInput(value: string): string {
  const parsed = Number.parseFloat(value);
  const rounded = Math.round(parsed * 1000) / 1000;
  return rounded.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function normalizePitchInput(value: string): string {
  const parsed = Number.parseFloat(value);
  const rounded = Math.round(parsed * 10) / 10;
  return rounded.toFixed(1).replace(/\.?0+$/, '') || '0';
}

function seedHouseFootprintPolygon(module: CalculatorModuleInputs): CalculatorHouseFootprintPolygonPoint[] {
  const lengthM = Number.parseFloat(module.lengthM);
  const projectionM = Number.parseFloat(module.projectionM);
  const points = buildHouseFootprintPresetSideLocalPoints({
    pergolaWidthMm: Number.isFinite(lengthM) && lengthM > 0 ? Math.round(lengthM * 1000) : 6000,
    pergolaDepthMm: Number.isFinite(projectionM) && projectionM > 0 ? Math.round(projectionM * 1000) : 3000,
    preset: normalizeHouseFootprintPreset(module.houseFootprintPreset),
    params: normalizeHouseFootprintParams(module.houseFootprintParams),
    attachmentSide: normalizeAttachmentSide(module.attachmentSide),
  });
  return points.map((point) => ({
    alongM: normalizeLengthInput(String(point.alongM)),
    depthM: normalizeLengthInput(String(point.depthM)),
  }));
}

function resolveHouseFootprintDimensionMm(value: string, fallbackMm: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) : fallbackMm;
}

function validateHouseFootprintPolygonEdit(
  module: CalculatorModuleInputs,
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { ok: true } | { ok: false; error: string } {
  const validation = buildCustomHouseFootprintPolygon({
    pergolaWidthMm: resolveHouseFootprintDimensionMm(module.lengthM, 6000),
    pergolaDepthMm: resolveHouseFootprintDimensionMm(module.projectionM, 3000),
    polygon,
    params: normalizeHouseFootprintParams(module.houseFootprintParams),
    attachmentSide: normalizeAttachmentSide(module.attachmentSide),
  });
  return validation.ok ? { ok: true } : { ok: false, error: validation.error };
}

function isPortalPergolaStyle(value: unknown): value is CalculatorModuleInputs['pergolaStyle'] {
  return value === 'pitched' || value === 'gable' || value === 'hip' || value === 'hip_corner';
}

function isPortalRoofMaterial(value: unknown): value is CalculatorModuleInputs['roofMaterial'] {
  return value === 'acrylic' || value === 'timber' || value === 'mixed' || value === 'insulated' || value === 'louvre';
}

function isHouseConnectionType(value: unknown): value is CalculatorModuleInputs['houseConnectionType'] {
  return value === 'soffit' || value === 'fascia' || value === 'facade' || value === 'none';
}

function isPostConnectionType(value: unknown): value is CalculatorModuleInputs['postConnectionType'] {
  return value === 'pile_1m' || value === 'pile_1_5m' || value === 'deck_bracket' || value === 'slab_anchors';
}

function isGroundCondition(value: unknown): value is CalculatorModuleInputs['ground'] {
  return value === 'easy' || value === 'hard';
}

function isAccessLevel(value: unknown): value is CalculatorInputs['access'] {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

function isHeightCategory(value: unknown): value is CalculatorInputs['height'] {
  return value === 'single_storey' || value === 'two_storey';
}

function isJobType(value: unknown): value is CalculatorInputs['jobType'] {
  return value === 'residential' || value === 'commercial';
}

function isRoofAboveType(value: unknown): value is CalculatorModuleInputs['timberRoofAboveType'] {
  return value === 'insulated_panels' || value === 'steel_corrugated' || value === 'steel_tray';
}

function isExtrusionColour(value: unknown): value is CalculatorModuleInputs['extrusionColour'] {
  return value === 'Black' || value === 'White' || value === 'Mill';
}

function isGableEndFramesMode(value: unknown): value is CalculatorModuleInputs['gableEndFramesMode'] {
  return value === 'none' || value === 'outer_end_only' || value === 'both_ends';
}

function isGableGutter(value: unknown): value is CalculatorModuleInputs['gableHouseEdgeGutter'] {
  return value === 'house' || value === 'our';
}

function isBoxGutter(value: unknown): value is CalculatorModuleInputs['boxGutterHouseEdge'] {
  return value === 'house' || value === 'our' || value === 'none';
}

function isOverhangSupportBeamProfile(value: unknown): value is CalculatorModuleInputs['overhangSupportBeamProfile'] {
  return value === '150x50' || value === '200x50' || value === 'RHS 150x50x3';
}

function isHouseStoreyMode(value: unknown): value is CalculatorHouseStoreyMode {
  return value === 'single_storey' || value === 'double_storey' || value === 'custom';
}

function isHouseRoofMaterial(value: unknown): value is CalculatorHouseRoofMaterial {
  return (
    value === 'corrugated_iron' ||
    value === 'trapezoidal_5_rib' ||
    value === 'eurotray_300' ||
    value === 'eurotray_500' ||
    value === 'shingles'
  );
}

function isHouseAttachmentStrategy(value: unknown): value is CalculatorHouseAttachmentStrategy {
  return (
    value === 'soffit_brackets' ||
    value === 'fascia_under_gutter' ||
    value === 'facade_ledger' ||
    value === 'post_supported_tieback' ||
    value === 'none'
  );
}

function normalizeNumericOverrideInput(
  value: unknown,
  options: { positive: boolean; unitLabel: string },
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = Number(trimmed);
  const valid = Number.isFinite(parsed) && (options.positive ? parsed > 0 : parsed >= 0);
  if (!valid) {
    return {
      ok: false,
      error: options.positive
        ? `Enter a positive ${options.unitLabel} value.`
        : `Enter a ${options.unitLabel} value of 0 or more.`,
    };
  }
  return { ok: true, value: trimmed };
}

function normalizeOverrideValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isGutterBeamProfile(profile: string | undefined): boolean {
  if (!profile) return false;
  const normalized = profile.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('spgutter');
}

function setDraftJobField(nextDraft: EstimateDrawingDraft, key: EditableJobFieldKey, value: CalculatorInputs[EditableJobFieldKey]) {
  (nextDraft.inputs as unknown as Record<string, unknown>)[key] = value;
}

function setDraftModuleOverride(
  module: CalculatorModuleInputs,
  key: keyof CalculatorModuleOverrides,
  value: string,
) {
  const overrides = { ...(module.overrides ?? {}) };
  if (value.trim()) overrides[key] = value.trim();
  else delete overrides[key];
  module.overrides = overrides;

  if (key === 'frontBeamProfile') {
    const frontBeamProfileUsed = normalizeOverrideValue(overrides.frontBeamProfile) ?? 'SP Gutter';
    if (isGutterBeamProfile(frontBeamProfileUsed)) {
      module.separateGutterEnabled = false;
    }
  }
}

function syncPrimaryFlashingLengthIfNeeded(current: CalculatorModuleInputs, updated: CalculatorModuleInputs) {
  const flashings = normalizeFlashingsStateForUi(current.flashings, current);
  const primary = flashings.rows.find((row) => row.kind === 'primary') ?? flashings.rows[0];
  if (!primary) {
    updated.flashings = normalizeFlashingsStateForUi(updated.flashings, updated);
    return;
  }
  if (!isPrimaryFlashingLengthAutoLinked(primary.lengthM, current)) return;
  const nextAutoLength = formatFlashingLengthInput(roofLengthForPrimaryFlashing(updated));
  updated.flashings = normalizeFlashingsStateForUi(
    {
      rows: flashings.rows.map((row) => (row.id === primary.id ? { ...row, lengthM: nextAutoLength } : row)),
    },
    updated,
  );
}

function setDraftModuleField(
  current: CalculatorModuleInputs,
  key: EditableModuleFieldKey | 'pergolaStyle' | 'roofMaterial' | 'houseConnectionType' | 'postConnectionType' | 'ground',
  value: unknown,
): EstimateDrawingFieldApplyResult | CalculatorModuleInputs {
  const updated: CalculatorModuleInputs = { ...current };
  const updatedRecord = updated as unknown as Record<string, unknown>;

  switch (key) {
    case 'pergolaStyle':
      if (!isPortalPergolaStyle(value)) return { ok: false, error: 'Choose a supported pergola style.' };
      updated.pergolaStyle = value;
      break;
    case 'boxPerimeterEnabled':
      updated.boxPerimeterEnabled = Boolean(value);
      break;
    case 'roofMaterial':
      if (!isPortalRoofMaterial(value)) return { ok: false, error: 'Choose a supported roof material.' };
      updated.roofMaterial = value;
      break;
    case 'mixedAcrylicBaysMain':
    case 'mixedAcrylicBaysA':
    case 'mixedAcrylicBaysB':
    case 'timberTrayWidthMm':
    case 'powdercoatStandardColour':
    case 'powdercoatCustomColour':
    case 'lengthM':
    case 'projectionM':
    case 'hipCornerLengthBM':
    case 'hipCornerProjectionBM':
    case 'roofPitchDeg':
    case 'overhangAmountM':
    case 'postCutHeightM':
    case 'postCount':
    case 'downpipeCount':
    case 'downpipeJoinCount':
    case 'downpipeElbowCount':
      updatedRecord[key] = String(value ?? '').trim();
      break;
    case 'timberRoofAboveType':
      if (!isRoofAboveType(value)) return { ok: false, error: 'Choose a supported timber roof-above type.' };
      updated.timberRoofAboveType = value;
      break;
    case 'extrusionColour':
      if (!isExtrusionColour(value)) return { ok: false, error: 'Choose a supported extrusion colour.' };
      updated.extrusionColour = value;
      break;
    case 'powdercoatIsCustom':
    case 'invertedEnabled':
    case 'invertedHouseGutter':
    case 'overhangEnabled':
    case 'separateGutterEnabled':
      updatedRecord[key] = Boolean(value);
      break;
    case 'gableEndFramesMode':
      if (!isGableEndFramesMode(value)) return { ok: false, error: 'Choose a supported gable frame mode.' };
      updated.gableEndFramesMode = value;
      break;
    case 'gableHouseEdgeGutter':
    case 'gableOuterEdgeGutter':
      if (!isGableGutter(value)) return { ok: false, error: 'Choose House gutter or Our gutter.' };
      updatedRecord[key] = value;
      break;
    case 'overhangSupportBeamProfile':
      if (!isOverhangSupportBeamProfile(value)) return { ok: false, error: 'Choose a supported overhang support beam profile.' };
      updated.overhangSupportBeamProfile = value;
      break;
    case 'houseConnectionType':
      if (!isHouseConnectionType(value)) return { ok: false, error: 'Choose a supported house connection.' };
      updated.houseConnectionType = value;
      break;
    case 'houseStoreyMode':
      if (!isHouseStoreyMode(value)) return { ok: false, error: 'Choose a supported house storey mode.' };
      updated.houseStoreyMode = value;
      break;
    case 'houseRoofMaterial':
      if (!isHouseRoofMaterial(value)) return { ok: false, error: 'Choose a supported house roof material.' };
      updated.houseRoofMaterial = value;
      break;
    case 'houseAttachmentStrategy':
      if (value === 'auto' || String(value ?? '').trim() === '') {
        delete updated.houseAttachmentStrategy;
      } else {
        if (!isHouseAttachmentStrategy(value)) return { ok: false, error: 'Choose a supported house attachment strategy.' };
        updated.houseAttachmentStrategy = value;
      }
      break;
    case 'houseEaveHeightM':
    case 'houseWallHeightM': {
      const normalized = normalizeNumericOverrideInput(value, { positive: true, unitLabel: 'metre' });
      if (!normalized.ok) return normalized;
      if (normalized.value === null) delete updatedRecord[key];
      else updatedRecord[key] = normalized.value;
      break;
    }
    case 'houseRoofPitchDeg':
    case 'houseSoffitDepthMm':
    case 'houseFasciaHeightMm':
    case 'houseGutterWidthMm':
    case 'houseGutterDepthMm':
    case 'houseGutterProjectionMm':
    case 'houseEaveOverhangMm': {
      const normalized = normalizeNumericOverrideInput(value, {
        positive: false,
        unitLabel: key === 'houseRoofPitchDeg' ? 'degree' : 'millimetre',
      });
      if (!normalized.ok) return normalized;
      if (normalized.value === null) delete updatedRecord[key];
      else updatedRecord[key] = normalized.value;
      break;
    }
    case 'postConnectionType':
      if (!isPostConnectionType(value)) return { ok: false, error: 'Choose a supported post connection.' };
      updated.postConnectionType = value;
      break;
    case 'ground':
      if (!isGroundCondition(value)) return { ok: false, error: 'Choose Easy or Hard ground.' };
      updated.ground = value;
      break;
    case 'boxGutterHouseEdge':
    case 'boxGutterFarEdge':
      if (!isBoxGutter(value)) return { ok: false, error: 'Choose House gutter, Our gutter, or None.' };
      updatedRecord[key] = value;
      break;
    default:
      return { ok: false, error: 'Unsupported drawing control.' };
  }

  const nextHouseConnection = updated.houseConnectionType;
  const nextBoxEnabled = updated.boxPerimeterEnabled;

  if (key === 'extrusionColour') {
    if (updated.extrusionColour === 'Mill' && !updated.powdercoatIsCustom && !updated.powdercoatStandardColour) {
      updated.powdercoatStandardColour = 'Ironsands';
    }
  }

  if (key === 'powdercoatIsCustom') {
    if (!updated.powdercoatIsCustom && updated.extrusionColour === 'Mill' && !updated.powdercoatStandardColour) {
      updated.powdercoatStandardColour = 'Ironsands';
    }
  }

  if (key === 'houseConnectionType') {
    if (nextHouseConnection === 'none') {
      updated.boxGutterHouseEdge = 'none';
      updated.boxGutterFarEdge = 'none';
    } else if (current.houseConnectionType === 'none') {
      if (current.boxGutterHouseEdge === 'none') updated.boxGutterHouseEdge = 'house';
      if (current.boxGutterFarEdge === 'none') updated.boxGutterFarEdge = 'our';
    }

    if (updated.pergolaStyle === 'gable') {
      if (nextHouseConnection === 'none') {
        updated.gableHouseEdgeGutter = 'our';
        updated.gableOuterEdgeGutter = 'our';
      } else if (current.houseConnectionType === 'none') {
        if (current.gableHouseEdgeGutter === 'our') updated.gableHouseEdgeGutter = 'house';
        if (current.gableOuterEdgeGutter === 'our') updated.gableOuterEdgeGutter = 'our';
      }

      const prevDefault = current.houseConnectionType !== 'none' ? 'outer_end_only' : 'both_ends';
      const nextDefault = nextHouseConnection !== 'none' ? 'outer_end_only' : 'both_ends';
      if (updated.gableEndFramesMode === prevDefault) {
        updated.gableEndFramesMode = nextDefault;
      }
    }
  }

  if (key === 'boxPerimeterEnabled' && nextBoxEnabled) {
    if (nextHouseConnection === 'none') {
      updated.boxGutterHouseEdge = 'none';
      updated.boxGutterFarEdge = 'none';
    } else {
      if (current.boxGutterHouseEdge === 'none') updated.boxGutterHouseEdge = 'house';
      if (current.boxGutterFarEdge === 'none') updated.boxGutterFarEdge = 'our';
    }
    updated.overhangEnabled = false;
    updated.invertedEnabled = false;
    updated.invertedHouseGutter = true;
    updated.separateGutterEnabled = false;
  }

  if (key === 'pergolaStyle' && updated.pergolaStyle !== 'pitched') {
    updated.invertedEnabled = false;
    updated.invertedHouseGutter = true;
    updated.separateGutterEnabled = false;
  }

  if (key === 'pergolaStyle' && updated.pergolaStyle === 'gable') {
    updated.gableHouseEdgeGutter = nextHouseConnection === 'none' ? 'our' : 'house';
    updated.gableOuterEdgeGutter = 'our';
  }

  if ((key === 'overhangEnabled' && updated.overhangEnabled) || (key === 'invertedEnabled' && updated.invertedEnabled)) {
    updated.separateGutterEnabled = false;
  }

  if (key === 'invertedHouseGutter' && updated.invertedEnabled && updated.invertedHouseGutter) {
    updated.separateGutterEnabled = false;
  }

  const frontBeamProfileUsed = normalizeOverrideValue(updated.overrides?.frontBeamProfile) ?? 'SP Gutter';
  if (isGutterBeamProfile(frontBeamProfileUsed)) {
    updated.separateGutterEnabled = false;
  }

  if (key === 'lengthM' || key === 'hipCornerLengthBM' || key === 'pergolaStyle') {
    syncPrimaryFlashingLengthIfNeeded(current, updated);
  }

  return updated;
}

function normalizeOverrides(overrides: EstimateDrawingOverrides | null | undefined): EstimateDrawingOverrides {
  const noteOverride = asString(overrides?.noteOverride) ?? null;
  const moduleTitleOverrides = Object.fromEntries(
    Object.entries(overrides?.moduleTitleOverrides ?? {}).flatMap(([key, value]) => {
      const trimmed = asString(value);
      return trimmed ? [[key, trimmed]] : [];
    }),
  );

  return {
    ...(noteOverride ? { noteOverride } : null),
    ...(Object.keys(moduleTitleOverrides).length ? { moduleTitleOverrides } : null),
  };
}

function normalizeHouseFirstRoofDraft(
  roof: HouseFirstRoofDraft | null | undefined,
): HouseFirstRoofDraft | null {
  if (!roof) return null;

  const openGableEndIds = Array.isArray(roof.openGableEndIds)
    ? [...new Set(
      roof.openGableEndIds
        .filter((candidate): candidate is string => typeof candidate === 'string')
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0),
    )]
    : [];

  const appendage = roof.appendage
    ? {
        ...(typeof roof.appendage.enabled === 'boolean' ? { enabled: roof.appendage.enabled } : null),
        ...(roof.appendage.form ? { form: roof.appendage.form } : null),
        ...(roof.appendage.hostEdge ? { hostEdge: roof.appendage.hostEdge } : null),
        ...(trimNullableString(roof.appendage.pitchDeg ?? null)
          ? { pitchDeg: trimNullableString(roof.appendage.pitchDeg ?? null) }
          : null),
        ...(trimNullableString(roof.appendage.dropMm ?? null)
          ? { dropMm: trimNullableString(roof.appendage.dropMm ?? null) }
          : null),
      }
    : null;

  const normalized: HouseFirstRoofDraft = {
    ...(roof.form ? { form: roof.form } : null),
    ...(trimNullableString(roof.primaryPitchDeg ?? null)
      ? { primaryPitchDeg: trimNullableString(roof.primaryPitchDeg ?? null) }
      : null),
    ...(roof.material ? { material: roof.material } : null),
    ...(roof.primaryFallDirection ? { primaryFallDirection: roof.primaryFallDirection } : null),
    ...(roof.ridgeAxis ? { ridgeAxis: roof.ridgeAxis } : null),
    ...(openGableEndIds.length ? { openGableEndIds } : null),
    ...(appendage && Object.keys(appendage).length ? { appendage } : null),
  };

  return Object.keys(normalized).length ? normalized : null;
}

function isDeckKind(value: unknown): value is DeckKind {
  return value === 'deck' || value === 'landing';
}

function isDeckShape(value: unknown): value is DeckShape {
  return value === 'preset' || value === 'custom';
}

function isDeckPresetType(value: unknown): value is DeckPresetType {
  return value === 'rect_attached' || value === 'rect_detached';
}

function isDeckElevationMode(value: unknown): value is DeckElevationMode {
  return value === 'ground' || value === 'stepped' || value === 'aligned_to_threshold';
}

function isDeckSurfaceMaterial(value: unknown): value is DeckSurfaceMaterial {
  return value === 'timber_decking' || value === 'composite' || value === 'concrete';
}

function normalizeDeckPresetRect(
  value: DeckPresetRect | null | undefined,
): DeckPresetRect | null {
  if (!value || typeof value !== 'object') return null;
  const widthM = trimNullableString(value.widthM ?? null);
  const depthM = trimNullableString(value.depthM ?? null);
  const centerOffsetM = trimNullableString(value.centerOffsetM ?? null);
  const detachedGapM = trimNullableString(value.detachedGapM ?? null);
  if (!widthM || !depthM || !centerOffsetM) return null;
  return {
    widthM,
    depthM,
    centerOffsetM,
    ...(detachedGapM ? { detachedGapM } : null),
  };
}

function normalizeHouseFirstDeckDraft(
  deck: HouseFirstDeckDraft | null | undefined,
): HouseFirstDeckDraft | null {
  if (!deck || typeof deck.id !== 'string' || deck.id.trim().length === 0) return null;
  const outline = normalizeHouseFootprintPolygon(deck.outline);
  const normalized: HouseFirstDeckDraft = {
    id: deck.id.trim(),
    ...(trimNullableString(deck.name ?? null) ? { name: trimNullableString(deck.name ?? null) } : null),
    ...(isDeckKind(deck.kind) ? { kind: deck.kind } : null),
    ...(isDeckShape(deck.shape) ? { shape: deck.shape } : null),
    ...(isDeckPresetType(deck.presetType) ? { presetType: deck.presetType } : null),
    ...(normalizeDeckPresetRect(deck.presetRect) ? { presetRect: normalizeDeckPresetRect(deck.presetRect) } : null),
    ...(outline.length ? { outline } : null),
    ...(isDeckElevationMode(deck.elevationMode) ? { elevationMode: deck.elevationMode } : null),
    ...(trimNullableString(deck.levelOffsetMm ?? null)
      ? { levelOffsetMm: trimNullableString(deck.levelOffsetMm ?? null) }
      : null),
    ...(typeof deck.hostEdgeId === 'string' && deck.hostEdgeId.trim()
      ? { hostEdgeId: deck.hostEdgeId.trim() }
      : null),
    ...(typeof deck.isAttached === 'boolean' ? { isAttached: deck.isAttached } : null),
    ...(isDeckSurfaceMaterial(deck.surfaceMaterial) ? { surfaceMaterial: deck.surfaceMaterial } : null),
  };
  return normalized;
}

function isWallOpeningHostSide(value: unknown): value is WallOpeningHostSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function normalizeHouseFirstOpeningDraft(
  opening: HouseFirstOpeningDraft | null | undefined,
): HouseFirstOpeningDraft | null {
  if (!opening || typeof opening.id !== 'string' || opening.id.trim().length === 0) return null;
  const label = trimNullableString(opening.label ?? null);
  const widthM = trimNullableString(opening.widthM ?? null);
  const heightM = trimNullableString(opening.heightM ?? null);
  const sillHeightM = trimNullableString(opening.sillHeightM ?? null);
  const offsetAlongWallM = trimNullableString(opening.offsetAlongWallM ?? null);
  return {
    id: opening.id.trim(),
    ...(label ? { label } : null),
    kind: 'window',
    ...(isWallOpeningHostSide(opening.wallId) ? { wallId: opening.wallId } : null),
    ...(typeof opening.hostEdgeId === 'string' && opening.hostEdgeId.trim()
      ? { hostEdgeId: opening.hostEdgeId.trim() }
      : null),
    ...(widthM ? { widthM } : null),
    ...(heightM ? { heightM } : null),
    ...(sillHeightM ? { sillHeightM } : null),
    ...(offsetAlongWallM ? { offsetAlongWallM } : null),
  };
}

function normalizeHouseFirstDraft(
  value: EstimateDrawingDraft['houseFirst'] | null | undefined,
): EstimateDrawingDraft['houseFirst'] | undefined {
  const roof = normalizeHouseFirstRoofDraft(value?.roof);
  const decks = (value?.decks ?? [])
    .map((deck) => normalizeHouseFirstDeckDraft(deck))
    .filter((deck): deck is HouseFirstDeckDraft => Boolean(deck));
  const openings = (value?.openings ?? [])
    .map((opening) => normalizeHouseFirstOpeningDraft(opening))
    .filter((opening): opening is HouseFirstOpeningDraft => Boolean(opening));
  return roof || decks.length || openings.length
    ? {
        ...(roof ? { roof } : null),
        ...(decks.length ? { decks } : null),
        ...(openings.length ? { openings } : null),
      }
    : undefined;
}

export function stripClientFacingModulePrefix(value: string): string {
  return value.replace(/^\s*M\d+\s*-\s*/i, '').trim();
}

export function resolveCalculatorInputsFromSnapshot(snapshot: Record<string, unknown> | null): CalculatorInputs | null {
  if (!snapshot) return null;
  const rawInputs = snapshot.inputs ?? (isRecord(snapshot.calculator_snapshot) ? snapshot.calculator_snapshot.inputs : null);
  if (isCalculatorInputsV2(rawInputs)) return cloneValue(rawInputs);
  if (isLegacyCalculatorInputsV1(rawInputs)) return migrateLegacyCalculatorInputsToV2(rawInputs);
  return null;
}

export function resolveEstimateDrawingOverridesFromSnapshot(snapshot: Record<string, unknown> | null): EstimateDrawingOverrides {
  if (!snapshot) return {};
  const outputs = isRecord(snapshot.outputs) ? snapshot.outputs : null;
  const raw = outputs && isRecord(outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]) ? outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY] : null;
  return normalizeOverrides(raw as EstimateDrawingOverrides | null);
}

export function buildEstimateDrawingDraftFromSnapshot(snapshot: Record<string, unknown> | null): EstimateDrawingDraft | null {
  const inputs = resolveCalculatorInputsFromSnapshot(snapshot);
  if (!inputs) return null;
  return {
    inputs,
    overrides: resolveEstimateDrawingOverridesFromSnapshot(snapshot),
    houseFirst: undefined,
  };
}

export function estimateDrawingDraftMatchesSnapshot(
  draft: EstimateDrawingDraft | null | undefined,
  snapshot: Record<string, unknown> | null,
): boolean {
  const current = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft && !current) return true;
  if (!draft || !current) return false;
  return (
    JSON.stringify(draft.inputs) === JSON.stringify(current.inputs) &&
    JSON.stringify(normalizeOverrides(draft.overrides)) === JSON.stringify(normalizeOverrides(current.overrides)) &&
    JSON.stringify(normalizeHouseFirstDraft(draft.houseFirst)) ===
      JSON.stringify(normalizeHouseFirstDraft(current.houseFirst))
  );
}

export function estimateDrawingDraftTouchesGeometry(
  draft: EstimateDrawingDraft | null | undefined,
  snapshot: Record<string, unknown> | null,
): boolean {
  const current = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft || !current) return false;
  return (
    JSON.stringify(draft.inputs) !== JSON.stringify(current.inputs) ||
    JSON.stringify(normalizeHouseFirstDraft(draft.houseFirst)) !==
      JSON.stringify(normalizeHouseFirstDraft(current.houseFirst))
  );
}

export function resolveEstimateDrawingNoteValue(overrides: EstimateDrawingOverrides | null | undefined): string {
  return asString(overrides?.noteOverride) ?? DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE;
}

export function resolveEstimateDrawingModuleTitleValue(
  moduleLabel: string,
  overrides: EstimateDrawingOverrides | null | undefined,
  moduleIndex: number,
): string {
  const override = overrides?.moduleTitleOverrides?.[String(moduleIndex)];
  return asString(override) ?? stripClientFacingModulePrefix(moduleLabel);
}

export function mergeEstimateDrawingDraftIntoSnapshot(
  snapshot: Record<string, unknown> | null,
  draft: EstimateDrawingDraft | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot && !draft) return null;
  const next = cloneValue((snapshot ?? { inputs: {}, outputs: {}, warnings: [] }) as Record<string, unknown>);
  if (!draft) return next;
  next.inputs = cloneValue(draft.inputs) as unknown as Record<string, unknown>;

  const outputs = isRecord(next.outputs) ? cloneValue(next.outputs) : {};
  const normalizedOverrides = normalizeOverrides(draft.overrides);
  if (Object.keys(normalizedOverrides).length) {
    outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY] = normalizedOverrides;
  } else {
    delete outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY];
  }
  next.outputs = outputs;
  return next;
}

export function updateEstimateDrawingHouseFirstRoofDraft(input: {
  draft: EstimateDrawingDraft;
  roof: HouseFirstRoofDraft | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    roof: input.roof,
  });
  return nextDraft;
}

export function updateEstimateDrawingHouseFirstDeckDrafts(input: {
  draft: EstimateDrawingDraft;
  decks: HouseFirstDeckDraft[] | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    decks: input.decks,
  });
  return nextDraft;
}

export function updateEstimateDrawingHouseFirstOpeningDrafts(input: {
  draft: EstimateDrawingDraft;
  openings: HouseFirstOpeningDraft[] | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    openings: input.openings,
  });
  return nextDraft;
}

export function buildEstimateDrawingSheetMetaOverrides(input: {
  moduleLabel: string;
  moduleIndex: number;
  draft: EstimateDrawingDraft | null | undefined;
}): Pick<EstimateDrawingSheetMeta, 'moduleTitle' | 'note'> {
  return {
    moduleTitle: resolveEstimateDrawingModuleTitleValue(input.moduleLabel, input.draft?.overrides, input.moduleIndex),
    note: resolveEstimateDrawingNoteValue(input.draft?.overrides),
  };
}

export function deriveEstimateDrawingEditableFields(input: {
  draft: EstimateDrawingDraft | null;
  moduleIndex: number;
  moduleLabel: string;
  view: ModuleViewsTab;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
}): EstimateDrawingField[] {
  if (!input.draft) return [];
  const module = input.draft.inputs.modules[input.moduleIndex];
  if (!module) return [];

  const fields: EstimateDrawingField[] = [
    {
      id: 'meta:note',
      label: 'Drawing note',
      rawValue: resolveEstimateDrawingNoteValue(input.draft.overrides),
      displayValue: resolveEstimateDrawingNoteValue(input.draft.overrides),
      defaultValue: DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
      editor: 'multiline',
      target: { type: 'estimate_note' },
    },
  ];

  if (input.view === 'plan') {
    fields.push(
      {
        id: 'plan:lengthA',
        label: 'Plan length',
        rawValue: asString(module.lengthM) ?? (input.planModel ? String(input.planModel.lengthA) : ''),
        displayValue: input.planModel ? formatMetres(input.planModel.lengthA) : formatMetres(toNumber(module.lengthM)),
        svgFieldId: 'plan:lengthA',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'lengthM' },
      },
      {
        id: 'plan:spanA',
        label: 'Plan span',
        rawValue: asString(module.projectionM) ?? (input.planModel ? String(input.planModel.spanA) : ''),
        displayValue: input.planModel ? formatMetres(input.planModel.spanA) : formatMetres(toNumber(module.projectionM)),
        svgFieldId: 'plan:spanA',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'projectionM' },
      },
    );

    if (input.planModel?.roofType === 'hip_corner' && input.planModel.lengthB && input.planModel.spanB) {
      fields.push(
        {
          id: 'plan:lengthB',
          label: 'Plan length B',
          rawValue: asString(module.hipCornerLengthBM) ?? String(input.planModel.lengthB),
          displayValue: formatMetres(input.planModel.lengthB),
          svgFieldId: 'plan:lengthB',
          editor: 'singleline',
          target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'hipCornerLengthBM' },
        },
        {
          id: 'plan:spanB',
          label: 'Plan span B',
          rawValue: asString(module.hipCornerProjectionBM) ?? String(input.planModel.spanB),
          displayValue: formatMetres(input.planModel.spanB),
          svgFieldId: 'plan:spanB',
          editor: 'singleline',
          target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'hipCornerProjectionBM' },
        },
      );
    }

    return fields;
  }

  if (!input.sectionModel) return fields;

  fields.push(
    {
      id: 'section:spanA',
      label: 'Section span',
      rawValue:
        (input.sectionModel.sectionSpanField === 'lengthM' ? asString(module.lengthM) : asString(module.projectionM)) ??
        String(input.sectionModel.spanA),
      displayValue: formatMetres(input.sectionModel.spanA),
      svgFieldId: 'section:spanA',
      editor: 'singleline',
      target: {
        type: 'module_input',
        moduleIndex: input.moduleIndex,
        field: input.sectionModel.sectionSpanField === 'lengthM' ? 'lengthM' : 'projectionM',
      },
    },
    {
      id: 'section:pitch',
      label: 'Roof pitch',
      rawValue: asString(module.roofPitchDeg) ?? input.sectionModel.pitchDeg.toFixed(1),
      displayValue: formatPitch(input.sectionModel.pitchDeg),
      svgFieldId: 'section:pitch',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'roofPitchDeg' },
    },
  );

  if (input.sectionModel.sectionKind === 'gable') {
    fields.push(
      {
        id: 'section:heightLeft',
        label: 'Left height',
        rawValue: asString(module.postCutHeightM) ?? String(input.sectionModel.leftEdgeHeightM),
        displayValue: formatMetres(input.sectionModel.leftEdgeHeightM),
        svgFieldId: 'section:heightLeft',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'postCutHeightM' },
      },
      {
        id: 'section:heightRight',
        label: 'Right height',
        rawValue: asString(module.postCutHeightM) ?? String(input.sectionModel.rightEdgeHeightM),
        displayValue: formatMetres(input.sectionModel.rightEdgeHeightM),
        svgFieldId: 'section:heightRight',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'postCutHeightM' },
      },
    );
    return fields;
  }

  const baseHeightFieldId = input.sectionModel.slopeDirection === 'toward_house' ? 'section:heightRight' : 'section:heightLeft';
  const baseHeightDisplay = input.sectionModel.slopeDirection === 'toward_house'
    ? input.sectionModel.rightEdgeHeightM
    : input.sectionModel.leftEdgeHeightM;

  fields.push({
    id: baseHeightFieldId,
    label: 'Base height',
    rawValue: asString(module.postCutHeightM) ?? String(baseHeightDisplay),
    displayValue: formatMetres(baseHeightDisplay),
    svgFieldId: baseHeightFieldId,
    editor: 'singleline',
    target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'postCutHeightM' },
  });

  return fields;
}

export function applyEstimateDrawingFieldEdit(input: {
  draft: EstimateDrawingDraft;
  field: EstimateDrawingField;
  nextValue: string;
}): EstimateDrawingFieldApplyResult {
  const nextDraft = cloneValue(input.draft);
  const moduleIndex = 'moduleIndex' in input.field.target ? input.field.target.moduleIndex : -1;

  if (input.field.target.type === 'module_title') {
    const trimmed = input.nextValue.trim();
    const moduleTitleOverrides = { ...(nextDraft.overrides.moduleTitleOverrides ?? {}) };
    if (!trimmed || trimmed === input.field.defaultValue) {
      delete moduleTitleOverrides[String(input.field.target.moduleIndex)];
    } else {
      moduleTitleOverrides[String(input.field.target.moduleIndex)] = trimmed;
    }
    nextDraft.overrides = normalizeOverrides({
      ...nextDraft.overrides,
      moduleTitleOverrides,
    });
    return { ok: true, draft: nextDraft };
  }

  if (input.field.target.type === 'estimate_note') {
    const trimmed = input.nextValue.trim();
    nextDraft.overrides = normalizeOverrides({
      ...nextDraft.overrides,
      noteOverride: trimmed && trimmed !== input.field.defaultValue ? trimmed : null,
    });
    return { ok: true, draft: nextDraft };
  }

  const module = nextDraft.inputs.modules[moduleIndex];
  if (!module) return { ok: false, error: 'This drawing field no longer maps to a module input.' };

  if (input.field.target.field === 'roofPitchDeg') {
    const pitch = Number.parseFloat(input.nextValue);
    if (!Number.isFinite(pitch) || pitch < 0 || pitch > 85) {
      return { ok: false, error: 'Enter a pitch between 0 and 85.' };
    }
    module.roofPitchDeg = normalizePitchInput(input.nextValue);
    return { ok: true, draft: nextDraft };
  }

  const parsed = Number.parseFloat(input.nextValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: 'Enter a value greater than 0.' };
  }

  module[input.field.target.field] = normalizeLengthInput(input.nextValue);
  return { ok: true, draft: nextDraft };
}

export function applyEstimateDrawingFootprintEdit(input: {
  draft: EstimateDrawingDraft;
  moduleIndex: number;
  edit: EstimateDrawingFootprintEdit;
}): EstimateDrawingFieldApplyResult {
  const nextDraft = cloneValue(input.draft);
  const module = nextDraft.inputs.modules[input.moduleIndex];
  if (!module) return { ok: false, error: 'This drawing footprint no longer maps to a module input.' };

  switch (input.edit.type) {
    case 'mode':
      module.houseFootprintMode = normalizeHouseFootprintMode(input.edit.mode) as CalculatorModuleInputs['houseFootprintMode'];
      if (module.houseFootprintMode === 'custom_polygon' && !normalizeHouseFootprintPolygon(module.houseFootprintPolygon).length) {
        module.houseFootprintPolygon = seedHouseFootprintPolygon(module) as CalculatorModuleInputs['houseFootprintPolygon'];
      }
      return { ok: true, draft: nextDraft };
    case 'preset':
      module.houseFootprintPreset = normalizeHouseFootprintPreset(input.edit.preset) as CalculatorModuleInputs['houseFootprintPreset'];
      return { ok: true, draft: nextDraft };
    case 'rotate':
      module.drawingRotationQuarterTurns = normalizeDrawingRotationQuarterTurns(
        normalizeDrawingRotationQuarterTurns(module.drawingRotationQuarterTurns) + input.edit.delta,
      ) as CalculatorModuleInputs['drawingRotationQuarterTurns'];
      return { ok: true, draft: nextDraft };
    case 'attachment_side':
      module.attachmentSide = normalizeAttachmentSide(input.edit.side) as CalculatorModuleInputs['attachmentSide'];
      return { ok: true, draft: nextDraft };
    case 'param':
      module.houseFootprintParams = {
        ...normalizeHouseFootprintParams(module.houseFootprintParams),
        [input.edit.key]: input.edit.value,
      };
      return { ok: true, draft: nextDraft };
    case 'polygon':
      {
        const nextPolygon = normalizeHouseFootprintPolygon(input.edit.polygon);
        const validation = validateHouseFootprintPolygonEdit(module, nextPolygon);
        if (!validation.ok) return validation;
        module.houseFootprintPolygon = nextPolygon as CalculatorModuleInputs['houseFootprintPolygon'];
      }
      return { ok: true, draft: nextDraft };
    case 'custom_polygon':
      {
        const nextPolygon = normalizeHouseFootprintPolygon(input.edit.polygon);
        const validation = validateHouseFootprintPolygonEdit(module, nextPolygon);
        if (!validation.ok) return validation;
        module.houseFootprintMode = 'custom_polygon' as CalculatorModuleInputs['houseFootprintMode'];
        module.houseFootprintPolygon = nextPolygon as CalculatorModuleInputs['houseFootprintPolygon'];
      }
      return { ok: true, draft: nextDraft };
    default:
      return { ok: false, error: 'Unsupported footprint edit.' };
  }
}

export function applyEstimateDrawingModuleFieldEdit(input: {
  draft: EstimateDrawingDraft;
  moduleIndex: number;
  edit: EstimateDrawingModuleFieldEdit;
}): EstimateDrawingFieldApplyResult {
  const nextDraft = cloneValue(input.draft);
  const module = nextDraft.inputs.modules[input.moduleIndex];
  if (!module) return { ok: false, error: 'This drawing control no longer maps to a module input.' };

  switch (input.edit.field) {
    case 'pergolaStyle':
    case 'roofMaterial':
    case 'houseConnectionType':
    case 'postConnectionType':
    case 'ground': {
      const updated = setDraftModuleField(module, input.edit.field, input.edit.value);
      if ('ok' in updated) return updated;
      nextDraft.inputs.modules[input.moduleIndex] = updated;
      return { ok: true, draft: nextDraft };
    }

    case 'moduleValue': {
      const updated = setDraftModuleField(module, input.edit.key, input.edit.value);
      if ('ok' in updated) return updated;
      nextDraft.inputs.modules[input.moduleIndex] = updated;
      return { ok: true, draft: nextDraft };
    }

    case 'jobValue': {
      switch (input.edit.key) {
        case 'access':
          if (!isAccessLevel(input.edit.value)) return { ok: false, error: 'Choose a supported access level.' };
          break;
        case 'height':
          if (!isHeightCategory(input.edit.value)) return { ok: false, error: 'Choose a supported height category.' };
          break;
        case 'jobType':
          if (!isJobType(input.edit.value)) return { ok: false, error: 'Choose a supported job type.' };
          break;
        case 'travelExGst':
        case 'extrasAllowanceExGst':
        case 'quoteDiscountPct':
          if (!/^-?\d*(?:\.\d*)?$/.test(String(input.edit.value ?? ''))) {
            return { ok: false, error: 'Enter a numeric value.' };
          }
          break;
      }
      setDraftJobField(nextDraft, input.edit.key, input.edit.value);
      return { ok: true, draft: nextDraft };
    }

    case 'moduleOverride':
      setDraftModuleOverride(module, input.edit.key, input.edit.value);
      return { ok: true, draft: nextDraft };

    case 'flashings':
      module.flashings = normalizeFlashingsStateForUi(input.edit.value, module);
      return { ok: true, draft: nextDraft };

    default:
      return { ok: false, error: 'Unsupported drawing control.' };
  }
}
