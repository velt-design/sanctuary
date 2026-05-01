import type {
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintMode,
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorHouseRoofMaterial,
  CalculatorHouseStoreyMode,
  CalculatorModuleInputs,
  CalculatorModuleOverrides,
} from '@/lib/types/calculator';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  normalizeHouseRoofMaterial,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import { getModuleCostOutputFromSnapshot } from '@/lib/costingAudit/viewModel';
import {
  applyEstimateDrawingFieldEdit,
  applyEstimateDrawingFootprintEdit,
  applyEstimateDrawingModuleFieldEdit,
  estimateDrawingDraftTouchesGeometry,
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import type { ObjectWorkbenchPergolaPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import { buildObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';
import {
  coerceHiddenWorkbenchGableEndFramesMode,
  coerceHiddenWorkbenchGableBaseline,
  isHiddenWorkbenchGableEndFramesModeSupported,
  resolveHiddenWorkbenchGableHouseEdgeGutter,
} from './hiddenWorkbenchGableBaseline';
import { solveActiveGeometryModuleResult } from './solveActiveGeometryModuleResult';
import { normalizeGeometryConfig, type AttachmentSide, type GeometryConfig } from '@sp/geometry';

export type SanctuaryPergolaFamily = 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner';

export type GeometryEditConnectionType = 'soffit' | 'fascia' | 'wall' | 'freestanding';
export type GeometryEditHouseAttachmentStrategy = CalculatorHouseAttachmentStrategy | 'auto';
export type GeometryHouseConfigKey =
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
  | 'houseEaveOverhangMm';

export type GeometryEditState = {
  family: SanctuaryPergolaFamily;
  config: GeometryConfig;
  dimensions: {
    lengthM: string;
    projectionM: string;
    hipCornerLengthBM: string;
    hipCornerProjectionBM: string;
  };
  roof: {
    material: CalculatorModuleInputs['roofMaterial'];
    pitchDeg: string;
    boxPerimeterEnabled: boolean;
    mixedAcrylicBaysMain: string;
    mixedAcrylicBaysA: string;
    mixedAcrylicBaysB: string;
  };
  connection: {
    type: GeometryEditConnectionType;
    attachmentSide: AttachmentSide;
  };
  houseContext: {
    canEditFootprint: boolean;
    footprintMode: CalculatorHouseFootprintMode;
    footprintPreset: CalculatorModuleInputs['houseFootprintPreset'];
    footprintParams: CalculatorHouseFootprintParams;
    footprintPolygon: CalculatorHouseFootprintPolygonPoint[];
    drawingRotationQuarterTurns: number;
    attachmentStrategy: GeometryEditHouseAttachmentStrategy;
    storeyMode: CalculatorHouseStoreyMode;
    roofMaterial: CalculatorHouseRoofMaterial;
    eaveHeightM: string;
    wallHeightM: string;
    roofPitchDeg: string;
    soffitDepthMm: string;
    fasciaHeightMm: string;
    gutterWidthMm: string;
    gutterDepthMm: string;
    gutterProjectionMm: string;
    eaveOverhangMm: string;
  };
  supports: {
    postConnectionType: CalculatorModuleInputs['postConnectionType'];
    ground: CalculatorModuleInputs['ground'];
    postCount: string;
    postCutHeightM: string;
  };
  gable: {
    endFramesMode: CalculatorModuleInputs['gableEndFramesMode'];
    houseEaveGutterMode: CalculatorModuleInputs['gableHouseEdgeGutter'];
    outerEaveGutterMode: CalculatorModuleInputs['gableOuterEdgeGutter'];
  } | null;
  overrides: {
    ledgerProfile: string;
    rafterProfile: string;
    postProfile: string;
    frontBeamProfile: string;
    ridgeBeamProfile: string;
    boxPerimeterBeamProfile: string;
    tieBeamProfile: string;
    strutProfile: string;
  };
};

type GeometryEditableOverrideKey =
  | 'ledgerProfile'
  | 'rafterProfile'
  | 'postProfile'
  | 'frontBeamProfile'
  | 'ridgeBeamProfile'
  | 'boxPerimeterBeamProfile'
  | 'tieBeamProfile'
  | 'strutProfile';

export type GeometryEditIntent =
  | { type: 'family'; value: SanctuaryPergolaFamily }
  | { type: 'dimension'; field: 'lengthM' | 'projectionM' | 'hipCornerLengthBM' | 'hipCornerProjectionBM'; value: string }
  | { type: 'roof_material'; value: CalculatorModuleInputs['roofMaterial'] }
  | { type: 'roof_pitch'; value: string }
  | { type: 'mixed_acrylic_bays'; field: 'mixedAcrylicBaysMain' | 'mixedAcrylicBaysA' | 'mixedAcrylicBaysB'; value: string }
  | { type: 'gable_end_frames'; value: CalculatorModuleInputs['gableEndFramesMode'] }
  | { type: 'gable_house_edge_gutter'; value: CalculatorModuleInputs['gableHouseEdgeGutter'] }
  | { type: 'gable_outer_edge_gutter'; value: CalculatorModuleInputs['gableOuterEdgeGutter'] }
  | { type: 'house_connection'; value: GeometryEditConnectionType }
  | { type: 'house_config'; key: GeometryHouseConfigKey; value: string }
  | { type: 'attachment_side'; value: CalculatorModuleInputs['attachmentSide'] }
  | { type: 'footprint_mode'; value: CalculatorHouseFootprintMode }
  | { type: 'footprint_preset'; value: CalculatorModuleInputs['houseFootprintPreset'] }
  | { type: 'footprint_param'; key: keyof CalculatorHouseFootprintParams; value: string }
  | { type: 'footprint_polygon'; polygon: CalculatorHouseFootprintPolygonPoint[] }
  | { type: 'footprint_custom_polygon'; polygon: CalculatorHouseFootprintPolygonPoint[] }
  | { type: 'drawing_rotation'; delta: -1 | 1 }
  | { type: 'post_connection'; value: CalculatorModuleInputs['postConnectionType'] }
  | { type: 'ground'; value: CalculatorModuleInputs['ground'] }
  | { type: 'post_count'; value: string }
  | { type: 'post_cut_height'; value: string }
  | { type: 'override'; key: GeometryEditableOverrideKey; value: string };

export type GeometryEditStateResult =
  | {
      ok: true;
      value: GeometryEditState;
    }
  | {
      ok: false;
      kind: 'unsupported' | 'error';
      message: string;
    };

export type GeometryEditApplyResult =
  | {
      ok: true;
      draft: EstimateDrawingDraft;
    }
  | {
      ok: false;
      kind: 'unsupported' | 'error';
      message: string;
    };

type ResolvedGeometryModule = {
  module: CalculatorModuleInputs;
  moduleResult: ReturnType<typeof getModuleCostOutputFromSnapshot>;
};

function formatMetres(valueMm: number | null | undefined): string {
  if (typeof valueMm !== 'number' || !Number.isFinite(valueMm)) return '';
  const valueM = Math.round(valueMm) / 1000;
  return valueM.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(1).replace(/\.0$/, '');
}

function formatMillimetres(valueMm: number | null | undefined): string {
  if (typeof valueMm !== 'number' || !Number.isFinite(valueMm)) return '';
  return String(Math.round(valueMm));
}

function formatStringOverride(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatMetresOverride(value: string | null | undefined, fallbackMm: number | null | undefined): string {
  return formatStringOverride(value) || formatMetres(fallbackMm);
}

function formatNumberOverride(value: string | null | undefined, fallback: number | null | undefined): string {
  return formatStringOverride(value) || formatNumber(fallback);
}

function formatMillimetresOverride(value: string | null | undefined, fallbackMm: number | null | undefined): string {
  return formatStringOverride(value) || formatMillimetres(fallbackMm);
}

function resolveFamily(value: GeometryConfig['family']): SanctuaryPergolaFamily {
  if (value === 'hip_corner') return 'hip_corner';
  if (value === 'hip') return 'hip';
  if (value === 'gable') return 'gable';
  if (value === 'box') return 'box';
  return 'mono';
}

function resolveConnectionType(value: GeometryConfig['connection']['type']): GeometryEditConnectionType {
  if (value === 'freestanding') return 'freestanding';
  if (value === 'wall') return 'wall';
  if (value === 'fascia') return 'fascia';
  return 'soffit';
}

function toModuleHouseConnectionType(value: GeometryEditConnectionType): CalculatorModuleInputs['houseConnectionType'] {
  if (value === 'wall') return 'facade';
  if (value === 'freestanding') return 'none';
  return value;
}

function mapRoofMaterial(config: GeometryConfig): CalculatorModuleInputs['roofMaterial'] {
  if (config.roof.mode === 'mixed') return 'mixed';
  return config.roof.material as CalculatorModuleInputs['roofMaterial'];
}

function resolveGableBaselineEndFramesMode(
  module: CalculatorModuleInputs | null | undefined,
): CalculatorModuleInputs['gableEndFramesMode'] {
  return coerceHiddenWorkbenchGableEndFramesMode(module?.houseConnectionType, module?.gableEndFramesMode);
}

function formatOverrideValue(
  overrides: CalculatorModuleOverrides | null | undefined,
  key: GeometryEditableOverrideKey,
): string {
  const value = overrides?.[key];
  return typeof value === 'string' ? value : '';
}

function resolveModuleForGeometryState(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
}): ResolvedGeometryModule | GeometryEditStateResult {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);

  if (!calculatorInputs) {
    return {
      ok: false,
      kind: 'error',
      message: 'Calculator inputs are not available for geometry editing.',
    };
  }

  const module = calculatorInputs.modules[input.moduleIndex];
  if (!module) {
    return {
      ok: false,
      kind: 'error',
      message: 'The selected module is not available for geometry editing.',
    };
  }

  const localSolveNeeded =
    estimateDrawingDraftTouchesGeometry(input.draft, input.snapshot) ||
    !getModuleCostOutputFromSnapshot(input.snapshot, input.moduleIndex);

  const moduleResult = localSolveNeeded
    ? solveActiveGeometryModuleResult({
        calculatorInputs,
        moduleIndex: input.moduleIndex,
      })
    : {
        ok: true as const,
        moduleResult: getModuleCostOutputFromSnapshot(input.snapshot, input.moduleIndex),
      };

  if (!moduleResult.ok) {
    return {
      ok: false,
      kind: 'error',
      message: moduleResult.message,
    };
  }

  return {
    module: coerceHiddenWorkbenchGableBaseline(module),
    moduleResult: moduleResult.moduleResult,
  };
}

export function buildGeometryEditState(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
}): GeometryEditStateResult {
  const resolved = resolveModuleForGeometryState(input);
  if (!('module' in resolved)) return resolved;
  const objectWorkbenchGeometryContext = buildObjectWorkbenchGeometryContext({
    snapshot: input.snapshot,
    draft: input.draft,
  });

  const rawInput = buildRawGeometryModuleInput({
    projectId: 'hidden-workbench-project',
    estimateId: 'hidden-workbench-estimate',
    designRequestId: null,
    moduleId: `module-${input.moduleIndex + 1}`,
    module: resolved.module,
    result: resolved.moduleResult,
    objectWorkbenchGeometryContext,
  });
  const normalized = normalizeGeometryConfig(rawInput);

  if (!normalized.ok) {
    return {
      ok: false,
      kind: normalized.code === 'unsupported_family' ? 'unsupported' : 'error',
      message: normalized.error,
    };
  }

  const houseModel = normalized.value.houseContext.model;

  return {
    ok: true,
    value: {
      family: resolveFamily(normalized.value.family),
      config: normalized.value,
      dimensions: {
        lengthM: formatMetres(normalized.value.dimensions.lengthMm),
        projectionM: formatMetres(normalized.value.dimensions.projectionMm),
        hipCornerLengthBM: formatMetres(normalized.value.dimensions.lengthBMm),
        hipCornerProjectionBM: formatMetres(normalized.value.dimensions.projectionBMm),
      },
      roof: {
        material: mapRoofMaterial(normalized.value),
        pitchDeg: formatNumber(normalized.value.dimensions.roofPitchDeg),
        boxPerimeterEnabled: normalized.value.roof.boxPerimeterEnabled,
        mixedAcrylicBaysMain: String(resolved.module.mixedAcrylicBaysMain ?? ''),
        mixedAcrylicBaysA: String(resolved.module.mixedAcrylicBaysA ?? ''),
        mixedAcrylicBaysB: String(resolved.module.mixedAcrylicBaysB ?? ''),
      },
      connection: {
        type: resolveConnectionType(normalized.value.connection.type),
        attachmentSide: normalized.value.connection.attachmentSide,
      },
      houseContext: {
        canEditFootprint:
          normalized.value.connection.type !== 'freestanding' &&
          supportsHouseFootprints(resolved.module.pergolaStyle),
        footprintMode: normalizeHouseFootprintMode(resolved.module.houseFootprintMode),
        footprintPreset: normalizeHouseFootprintPreset(resolved.module.houseFootprintPreset) as CalculatorModuleInputs['houseFootprintPreset'],
        footprintParams: normalizeHouseFootprintParams(resolved.module.houseFootprintParams),
        footprintPolygon: normalizeHouseFootprintPolygon(resolved.module.houseFootprintPolygon),
        drawingRotationQuarterTurns: normalizeDrawingRotationQuarterTurns(resolved.module.drawingRotationQuarterTurns),
        attachmentStrategy: resolved.module.houseAttachmentStrategy ?? 'auto',
        storeyMode: (houseModel?.storeyMode as CalculatorHouseStoreyMode | undefined) ?? 'single_storey',
        roofMaterial: normalizeHouseRoofMaterial(resolved.module.houseRoofMaterial ?? houseModel?.roofMaterial),
        eaveHeightM: formatMetresOverride(resolved.module.houseEaveHeightM, houseModel?.eaveHeightMm),
        wallHeightM: formatMetresOverride(resolved.module.houseWallHeightM, houseModel?.wallHeightMm),
        roofPitchDeg: formatNumberOverride(resolved.module.houseRoofPitchDeg, houseModel?.roofPitchDeg),
        soffitDepthMm: formatMillimetresOverride(resolved.module.houseSoffitDepthMm, houseModel?.eave?.soffitDepthMm),
        fasciaHeightMm: formatMillimetresOverride(resolved.module.houseFasciaHeightMm, houseModel?.eave?.fasciaHeightMm),
        gutterWidthMm: formatMillimetresOverride(resolved.module.houseGutterWidthMm, houseModel?.eave?.gutterWidthMm),
        gutterDepthMm: formatMillimetresOverride(resolved.module.houseGutterDepthMm, houseModel?.eave?.gutterDepthMm),
        gutterProjectionMm: formatMillimetresOverride(resolved.module.houseGutterProjectionMm, houseModel?.eave?.gutterProjectionMm),
        eaveOverhangMm: formatMillimetresOverride(resolved.module.houseEaveOverhangMm, houseModel?.eave?.eaveOverhangMm),
      },
      supports: {
        postConnectionType:
          (normalized.value.supports.postConnectionType as CalculatorModuleInputs['postConnectionType']) ?? resolved.module.postConnectionType,
        ground:
          (normalized.value.supports.groundCondition as CalculatorModuleInputs['ground']) ?? resolved.module.ground,
        postCount: String(normalized.value.supports.postCount ?? resolved.module.postCount ?? ''),
        postCutHeightM: formatMetres(normalized.value.supports.postCutHeightMm) || String(resolved.module.postCutHeightM ?? ''),
      },
      gable:
        normalized.value.family === 'gable'
          ? {
              endFramesMode:
                (normalized.value.gable.endFramesMode as CalculatorModuleInputs['gableEndFramesMode']) ??
                resolved.module.gableEndFramesMode,
              houseEaveGutterMode:
                (normalized.value.gable.houseEaveGutterMode as CalculatorModuleInputs['gableHouseEdgeGutter']) ??
                resolved.module.gableHouseEdgeGutter,
              outerEaveGutterMode:
                (normalized.value.gable.outerEaveGutterMode as CalculatorModuleInputs['gableOuterEdgeGutter']) ??
                resolved.module.gableOuterEdgeGutter,
            }
          : null,
      overrides: {
        ledgerProfile: formatOverrideValue(resolved.module.overrides, 'ledgerProfile'),
        rafterProfile: formatOverrideValue(resolved.module.overrides, 'rafterProfile'),
        postProfile: formatOverrideValue(resolved.module.overrides, 'postProfile'),
        frontBeamProfile: formatOverrideValue(resolved.module.overrides, 'frontBeamProfile'),
        ridgeBeamProfile: formatOverrideValue(resolved.module.overrides, 'ridgeBeamProfile'),
        boxPerimeterBeamProfile: formatOverrideValue(resolved.module.overrides, 'boxPerimeterBeamProfile'),
        tieBeamProfile: formatOverrideValue(resolved.module.overrides, 'tieBeamProfile'),
        strutProfile: formatOverrideValue(resolved.module.overrides, 'strutProfile'),
      },
    },
  };
}

function applyModuleEdit(
  draft: EstimateDrawingDraft,
  moduleIndex: number,
  edit: Parameters<typeof applyEstimateDrawingModuleFieldEdit>[0]['edit'],
): GeometryEditApplyResult {
  const result = applyEstimateDrawingModuleFieldEdit({
    draft,
    moduleIndex,
    edit,
  });

  if (!result.ok) {
    return {
      ok: false,
      kind: 'error',
      message: result.error,
    };
  }

  return {
    ok: true,
    draft: result.draft,
  };
}

function applyFieldEdit(
  draft: EstimateDrawingDraft,
  moduleIndex: number,
  field: 'lengthM' | 'projectionM' | 'hipCornerLengthBM' | 'hipCornerProjectionBM' | 'roofPitchDeg' | 'postCutHeightM',
  nextValue: string,
): GeometryEditApplyResult {
  const result = applyEstimateDrawingFieldEdit({
    draft,
    field: {
      id: `geometry:${field}`,
      label: field,
      rawValue: '',
      displayValue: '',
      editor: 'singleline',
      target: {
        type: 'module_input',
        moduleIndex,
        field,
      },
    },
    nextValue,
  });

  if (!result.ok) {
    return {
      ok: false,
      kind: 'error',
      message: result.error,
    };
  }

  return {
    ok: true,
    draft: result.draft,
  };
}

function applyFootprintEdit(
  draft: EstimateDrawingDraft,
  moduleIndex: number,
  edit: EstimateDrawingFootprintEdit,
): GeometryEditApplyResult {
  const result = applyEstimateDrawingFootprintEdit({
    draft,
    moduleIndex,
    edit,
  });

  if (!result.ok) {
    return {
      ok: false,
      kind: 'error',
      message: result.error,
    };
  }

  return {
    ok: true,
    draft: result.draft,
  };
}

function applyFamilyEdit(
  snapshot: Record<string, unknown> | null,
  draft: EstimateDrawingDraft,
  moduleIndex: number,
  family: SanctuaryPergolaFamily,
): GeometryEditApplyResult {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(snapshot, draft);
  const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
  const currentModule = calculatorInputs?.modules[moduleIndex] ?? draft.inputs.modules[moduleIndex];
  const gableHouseEdgeGutter = resolveHiddenWorkbenchGableHouseEdgeGutter(currentModule?.houseConnectionType);
  const gableEndFramesMode = resolveGableBaselineEndFramesMode(currentModule);

  const edits =
    family === 'gable'
      ? [
          { field: 'pergolaStyle', value: 'gable' },
          { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
          { field: 'moduleValue', key: 'gableEndFramesMode', value: gableEndFramesMode },
          { field: 'moduleValue', key: 'gableHouseEdgeGutter', value: gableHouseEdgeGutter },
          { field: 'moduleValue', key: 'gableOuterEdgeGutter', value: 'our' },
        ]
      : family === 'hip'
        ? [
            { field: 'pergolaStyle', value: 'hip' },
            { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
          ]
        : family === 'hip_corner'
          ? [
              { field: 'pergolaStyle', value: 'hip_corner' },
              { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
            ]
      : family === 'box'
        ? [
            { field: 'pergolaStyle', value: 'pitched' },
            { field: 'moduleValue', key: 'boxPerimeterEnabled', value: true },
          ]
        : [
            { field: 'pergolaStyle', value: 'pitched' },
            { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
          ];

  let nextDraft = draft;
  for (const edit of edits) {
    const result = applyModuleEdit(nextDraft, moduleIndex, edit as Parameters<typeof applyEstimateDrawingModuleFieldEdit>[0]['edit']);
    if (!result.ok) return result;
    nextDraft = result.draft;
  }

  return {
    ok: true,
    draft: nextDraft,
  };
}

export function applyGeometryEditIntent(input: {
  snapshot: Record<string, unknown> | null;
  draft: EstimateDrawingDraft;
  moduleIndex: number;
  intent: GeometryEditIntent;
}): GeometryEditApplyResult {
  switch (input.intent.type) {
    case 'family':
      return applyFamilyEdit(input.snapshot, input.draft, input.moduleIndex, input.intent.value);
    case 'dimension':
      return applyFieldEdit(input.draft, input.moduleIndex, input.intent.field, input.intent.value);
    case 'roof_material': {
      const roofMaterialResult = applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'roofMaterial',
        value: input.intent.value,
      });
      if (!roofMaterialResult.ok) {
        return roofMaterialResult;
      }

      const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, roofMaterialResult.draft);
      const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
      const currentModule = calculatorInputs?.modules[input.moduleIndex] ?? roofMaterialResult.draft.inputs.modules[input.moduleIndex];
      if (currentModule?.pergolaStyle !== 'gable') {
        return roofMaterialResult;
      }

      let nextDraft = roofMaterialResult.draft;
      const gableHouseEdgeGutter = resolveHiddenWorkbenchGableHouseEdgeGutter(currentModule.houseConnectionType);
      const gableEndFramesMode = resolveGableBaselineEndFramesMode(currentModule);
      for (const edit of [
        { field: 'moduleValue', key: 'gableEndFramesMode', value: gableEndFramesMode },
        { field: 'moduleValue', key: 'gableHouseEdgeGutter', value: gableHouseEdgeGutter },
        { field: 'moduleValue', key: 'gableOuterEdgeGutter', value: 'our' as const },
      ]) {
        const result = applyModuleEdit(
          nextDraft,
          input.moduleIndex,
          edit as Parameters<typeof applyEstimateDrawingModuleFieldEdit>[0]['edit'],
        );
        if (!result.ok) {
          return result;
        }
        nextDraft = result.draft;
      }

      return {
        ok: true,
        draft: nextDraft,
      };
    }
    case 'roof_pitch':
      return applyFieldEdit(input.draft, input.moduleIndex, 'roofPitchDeg', input.intent.value);
    case 'mixed_acrylic_bays':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'moduleValue',
        key: input.intent.field,
        value: input.intent.value,
      });
    case 'house_config':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'moduleValue',
        key: input.intent.key,
        value: input.intent.value,
      } as Parameters<typeof applyEstimateDrawingModuleFieldEdit>[0]['edit']);
    case 'gable_end_frames': {
      const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
      const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
      const currentModule = calculatorInputs?.modules[input.moduleIndex] ?? input.draft.inputs.modules[input.moduleIndex];

      if (currentModule?.pergolaStyle !== 'gable') {
        return {
          ok: false,
          kind: 'unsupported',
          message: 'Gable end-frame controls are only available for gable modules.',
        };
      }

      if (!isHiddenWorkbenchGableEndFramesModeSupported(currentModule.houseConnectionType, input.intent.value)) {
        return {
          ok: false,
          kind: 'unsupported',
          message:
            currentModule.houseConnectionType === 'none'
              ? 'Freestanding gable supports None or Both ends only.'
              : 'Attached gable supports None, Outer end only, or Both ends.',
        };
      }

      let nextDraft = input.draft;
      const result = applyModuleEdit(nextDraft, input.moduleIndex, {
        field: 'moduleValue',
        key: 'gableEndFramesMode',
        value: input.intent.value,
      });
      if (!result.ok) {
        return result;
      }
      nextDraft = result.draft;

      return {
        ok: true,
        draft: nextDraft,
      };
    }
    case 'gable_house_edge_gutter':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'moduleValue',
        key: 'gableHouseEdgeGutter',
        value: input.intent.value,
      });
    case 'gable_outer_edge_gutter':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'moduleValue',
        key: 'gableOuterEdgeGutter',
        value: input.intent.value,
      });
    case 'house_connection': {
      const connectionResult = applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'houseConnectionType',
        value: toModuleHouseConnectionType(input.intent.value),
      });
      if (!connectionResult.ok) {
        return connectionResult;
      }

      const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, connectionResult.draft);
      const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
      const currentModule = calculatorInputs?.modules[input.moduleIndex] ?? connectionResult.draft.inputs.modules[input.moduleIndex];
      if (currentModule?.pergolaStyle !== 'gable') {
        return connectionResult;
      }

      let nextDraft = connectionResult.draft;
      const gableHouseEdgeGutter = resolveHiddenWorkbenchGableHouseEdgeGutter(currentModule.houseConnectionType);
      const gableEndFramesMode = resolveGableBaselineEndFramesMode(currentModule);
      for (const edit of [
        { field: 'moduleValue', key: 'gableEndFramesMode', value: gableEndFramesMode },
        { field: 'moduleValue', key: 'gableHouseEdgeGutter', value: gableHouseEdgeGutter },
        { field: 'moduleValue', key: 'gableOuterEdgeGutter', value: 'our' as const },
      ]) {
        const result = applyModuleEdit(
          nextDraft,
          input.moduleIndex,
          edit as Parameters<typeof applyEstimateDrawingModuleFieldEdit>[0]['edit'],
        );
        if (!result.ok) {
          return result;
        }
        nextDraft = result.draft;
      }

      return {
        ok: true,
        draft: nextDraft,
      };
    }
    case 'attachment_side':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'attachment_side',
        side: input.intent.value,
      });
    case 'footprint_mode':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'mode',
        mode: input.intent.value,
      });
    case 'footprint_preset':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'preset',
        preset: input.intent.value,
      });
    case 'footprint_param':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'param',
        key: input.intent.key,
        value: input.intent.value,
      });
    case 'footprint_polygon':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'polygon',
        polygon: input.intent.polygon,
      });
    case 'footprint_custom_polygon':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'custom_polygon',
        polygon: input.intent.polygon,
      });
    case 'drawing_rotation':
      return applyFootprintEdit(input.draft, input.moduleIndex, {
        type: 'rotate',
        delta: input.intent.delta,
      });
    case 'post_connection':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'postConnectionType',
        value: input.intent.value,
      });
    case 'ground':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'ground',
        value: input.intent.value,
      });
    case 'post_count':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'moduleValue',
        key: 'postCount',
        value: input.intent.value,
      });
    case 'post_cut_height':
      return applyFieldEdit(input.draft, input.moduleIndex, 'postCutHeightM', input.intent.value);
    case 'override':
      return applyModuleEdit(input.draft, input.moduleIndex, {
        field: 'moduleOverride',
        key: input.intent.key,
        value: input.intent.value,
      });
    default:
      return {
        ok: false,
        kind: 'unsupported',
        message: 'This geometry edit is not supported in the hidden workbench yet.',
      };
  }
}

function familyToGeometryIntentValue(
  family: ObjectWorkbenchPergolaPatch['family'],
): SanctuaryPergolaFamily | null {
  switch (family) {
    case 'mono':
    case 'gable':
    case 'box':
    case 'hip':
    case 'hip_corner':
      return family;
    default:
      return null;
  }
}

function buildTemporaryGeometryIntentsFromPergolaPatch(
  patch: ObjectWorkbenchPergolaPatch,
): GeometryEditIntent[] {
  const intents: GeometryEditIntent[] = [];
  const family = familyToGeometryIntentValue(patch.family);
  if (family) {
    intents.push({ type: 'family', value: family });
  }

  const geometry = patch.geometry ?? null;
  if (!family && typeof geometry?.roof?.boxPerimeterEnabled === 'boolean') {
    intents.push({
      type: 'family',
      value: geometry.roof.boxPerimeterEnabled ? 'box' : 'mono',
    });
  }
  if (patch.connectionKind) {
    intents.push({ type: 'house_connection', value: patch.connectionKind });
  }
  if (patch.side) {
    intents.push({ type: 'attachment_side', value: patch.side });
  }
  if (patch.strategy !== undefined) {
    intents.push({
      type: 'house_config',
      key: 'houseAttachmentStrategy',
      value: patch.strategy ?? 'auto',
    });
  }

  for (const field of ['lengthM', 'projectionM', 'hipCornerLengthBM', 'hipCornerProjectionBM'] as const) {
    const value = geometry?.dimensions?.[field];
    if (value !== undefined) {
      intents.push({ type: 'dimension', field, value });
    }
  }
  if (geometry?.roof?.material !== undefined) {
    intents.push({ type: 'roof_material', value: geometry.roof.material });
  }
  if (geometry?.roof?.pitchDeg !== undefined) {
    intents.push({ type: 'roof_pitch', value: geometry.roof.pitchDeg });
  }
  for (const field of ['mixedAcrylicBaysMain', 'mixedAcrylicBaysA', 'mixedAcrylicBaysB'] as const) {
    const value = geometry?.roof?.[field];
    if (value !== undefined) {
      intents.push({ type: 'mixed_acrylic_bays', field, value });
    }
  }
  if (geometry?.gable?.endFramesMode !== undefined) {
    intents.push({ type: 'gable_end_frames', value: geometry.gable.endFramesMode });
  }
  if (geometry?.gable?.houseEaveGutterMode !== undefined) {
    intents.push({ type: 'gable_house_edge_gutter', value: geometry.gable.houseEaveGutterMode });
  }
  if (geometry?.gable?.outerEaveGutterMode !== undefined) {
    intents.push({ type: 'gable_outer_edge_gutter', value: geometry.gable.outerEaveGutterMode });
  }
  if (geometry?.supports?.postConnectionType !== undefined) {
    intents.push({ type: 'post_connection', value: geometry.supports.postConnectionType });
  }
  if (geometry?.supports?.ground !== undefined) {
    intents.push({ type: 'ground', value: geometry.supports.ground });
  }
  if (geometry?.supports?.postCount !== undefined) {
    intents.push({ type: 'post_count', value: geometry.supports.postCount });
  }
  if (geometry?.supports?.postCutHeightM !== undefined) {
    intents.push({ type: 'post_cut_height', value: geometry.supports.postCutHeightM });
  }
  for (const key of [
    'ledgerProfile',
    'rafterProfile',
    'postProfile',
    'frontBeamProfile',
    'ridgeBeamProfile',
    'boxPerimeterBeamProfile',
    'tieBeamProfile',
    'strutProfile',
  ] as const) {
    const value = geometry?.overrides?.[key];
    if (value !== undefined) {
      intents.push({ type: 'override', key, value });
    }
  }

  return intents;
}

export function mirrorPergolaPatchToTemporaryGeometryModuleFields(input: {
  snapshot: Record<string, unknown> | null;
  draft: EstimateDrawingDraft;
  moduleIndexes: number[];
  patch: ObjectWorkbenchPergolaPatch;
}): GeometryEditApplyResult {
  const intents = buildTemporaryGeometryIntentsFromPergolaPatch(input.patch);
  let nextDraft = input.draft;

  for (const moduleIndex of input.moduleIndexes) {
    for (const intent of intents) {
      const result = applyGeometryEditIntent({
        snapshot: input.snapshot,
        draft: nextDraft,
        moduleIndex,
        intent,
      });
      if (!result.ok) return result;
      nextDraft = result.draft;
    }
  }

  return {
    ok: true,
    draft: nextDraft,
  };
}

export function translateEstimateDrawingFieldToGeometryIntent(
  field: EstimateDrawingField,
  nextValue: string,
): GeometryEditIntent | null {
  if (field.target.type !== 'module_input') return null;

  switch (field.target.field) {
    case 'lengthM':
      return {
        type: 'dimension',
        field: 'lengthM',
        value: nextValue,
      };
    case 'projectionM':
      return {
        type: 'dimension',
        field: 'projectionM',
        value: nextValue,
      };
    case 'hipCornerLengthBM':
      return {
        type: 'dimension',
        field: 'hipCornerLengthBM',
        value: nextValue,
      };
    case 'hipCornerProjectionBM':
      return {
        type: 'dimension',
        field: 'hipCornerProjectionBM',
        value: nextValue,
      };
    case 'roofPitchDeg':
      return {
        type: 'roof_pitch',
        value: nextValue,
      };
    case 'postCutHeightM':
      return {
        type: 'post_cut_height',
        value: nextValue,
      };
    default:
      return null;
  }
}

export function translateFootprintEditToGeometryIntent(
  edit: EstimateDrawingFootprintEdit,
): GeometryEditIntent | null {
  switch (edit.type) {
    case 'preset':
      return {
        type: 'footprint_preset',
        value: edit.preset,
      };
    case 'rotate':
      return {
        type: 'drawing_rotation',
        delta: edit.delta,
      };
    case 'attachment_side':
      return {
        type: 'attachment_side',
        value: edit.side,
      };
    case 'mode':
      return {
        type: 'footprint_mode',
        value: edit.mode,
      };
    case 'param':
      return {
        type: 'footprint_param',
        key: edit.key,
        value: edit.value,
      };
    case 'polygon':
      return {
        type: 'footprint_polygon',
        polygon: edit.polygon,
      };
    case 'custom_polygon':
      return {
        type: 'footprint_custom_polygon',
        polygon: edit.polygon,
      };
    default:
      return null;
  }
}
