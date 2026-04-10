import type {
  CalculatorHouseFootprintParams,
  CalculatorModuleInputs,
  CalculatorModuleOverrides,
} from '@/lib/types/calculator';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
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
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import { solveActiveGeometryModuleResult } from './solveActiveGeometryModuleResult';
import { normalizeGeometryConfig, type AttachmentSide, type GeometryConfig } from '@sp/geometry';

export type SanctuaryPergolaFamily = 'mono' | 'gable' | 'box';

export type GeometryEditConnectionType = 'soffit' | 'fascia' | 'wall' | 'freestanding';

export type GeometryEditState = {
  family: SanctuaryPergolaFamily;
  config: GeometryConfig;
  dimensions: {
    lengthM: string;
    projectionM: string;
  };
  roof: {
    material: CalculatorModuleInputs['roofMaterial'];
    pitchDeg: string;
    boxPerimeterEnabled: boolean;
  };
  connection: {
    type: GeometryEditConnectionType;
    attachmentSide: AttachmentSide;
  };
  houseContext: {
    canEditFootprint: boolean;
    footprintPreset: CalculatorModuleInputs['houseFootprintPreset'];
    footprintParams: CalculatorHouseFootprintParams;
    drawingRotationQuarterTurns: number;
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
  | { type: 'dimension'; field: 'lengthM' | 'projectionM'; value: string }
  | { type: 'roof_material'; value: CalculatorModuleInputs['roofMaterial'] }
  | { type: 'roof_pitch'; value: string }
  | { type: 'house_connection'; value: GeometryEditConnectionType }
  | { type: 'attachment_side'; value: CalculatorModuleInputs['attachmentSide'] }
  | { type: 'footprint_preset'; value: CalculatorModuleInputs['houseFootprintPreset'] }
  | { type: 'footprint_param'; key: keyof CalculatorHouseFootprintParams; value: string }
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

function resolveFamily(value: GeometryConfig['family']): SanctuaryPergolaFamily {
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

function resolveSupportedGableHouseEdgeGutter(
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'] | null | undefined,
): CalculatorModuleInputs['gableHouseEdgeGutter'] {
  return houseConnectionType === 'none' ? 'our' : 'house';
}

function resolveSupportedGableRidgeOverride(
  overrides: CalculatorModuleOverrides | null | undefined,
): string {
  return typeof overrides?.ridgeBeamProfile === 'string' && overrides.ridgeBeamProfile.trim()
    ? overrides.ridgeBeamProfile
    : '150x50';
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
    module,
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

  const rawInput = buildRawGeometryModuleInput({
    projectId: 'hidden-workbench-project',
    estimateId: 'hidden-workbench-estimate',
    designRequestId: null,
    moduleId: `module-${input.moduleIndex + 1}`,
    module: resolved.module,
    result: resolved.moduleResult,
  });
  const normalized = normalizeGeometryConfig(rawInput);

  if (!normalized.ok) {
    return {
      ok: false,
      kind: normalized.code === 'unsupported_family' ? 'unsupported' : 'error',
      message: normalized.error,
    };
  }

  return {
    ok: true,
    value: {
      family: resolveFamily(normalized.value.family),
      config: normalized.value,
      dimensions: {
        lengthM: formatMetres(normalized.value.dimensions.lengthMm),
        projectionM: formatMetres(normalized.value.dimensions.projectionMm),
      },
      roof: {
        material: mapRoofMaterial(normalized.value),
        pitchDeg: formatNumber(normalized.value.dimensions.roofPitchDeg),
        boxPerimeterEnabled: normalized.value.roof.boxPerimeterEnabled,
      },
      connection: {
        type: resolveConnectionType(normalized.value.connection.type),
        attachmentSide: normalized.value.connection.attachmentSide,
      },
      houseContext: {
        canEditFootprint:
          normalized.value.connection.type !== 'freestanding' &&
          supportsHouseFootprints(resolved.module.pergolaStyle),
        footprintPreset: normalizeHouseFootprintPreset(resolved.module.houseFootprintPreset) as CalculatorModuleInputs['houseFootprintPreset'],
        footprintParams: normalizeHouseFootprintParams(resolved.module.houseFootprintParams),
        drawingRotationQuarterTurns: normalizeDrawingRotationQuarterTurns(resolved.module.drawingRotationQuarterTurns),
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
  field: 'lengthM' | 'projectionM' | 'roofPitchDeg' | 'postCutHeightM',
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
  const gableHouseEdgeGutter = resolveSupportedGableHouseEdgeGutter(currentModule?.houseConnectionType);
  const gableRidgeBeamProfile = resolveSupportedGableRidgeOverride(currentModule?.overrides);

  const edits =
    family === 'gable'
      ? [
          { field: 'pergolaStyle', value: 'gable' },
          { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
          { field: 'moduleValue', key: 'gableEndFramesMode', value: 'none' },
          { field: 'moduleValue', key: 'gableHouseEdgeGutter', value: gableHouseEdgeGutter },
          { field: 'moduleValue', key: 'gableOuterEdgeGutter', value: 'our' },
          { field: 'moduleOverride', key: 'ridgeBeamProfile', value: gableRidgeBeamProfile },
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
      const gableHouseEdgeGutter = resolveSupportedGableHouseEdgeGutter(currentModule.houseConnectionType);
      const gableRidgeBeamProfile = resolveSupportedGableRidgeOverride(currentModule.overrides);
      for (const edit of [
        { field: 'moduleValue', key: 'gableEndFramesMode', value: 'none' as const },
        { field: 'moduleValue', key: 'gableHouseEdgeGutter', value: gableHouseEdgeGutter },
        { field: 'moduleValue', key: 'gableOuterEdgeGutter', value: 'our' as const },
        { field: 'moduleOverride', key: 'ridgeBeamProfile', value: gableRidgeBeamProfile },
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
      const gableHouseEdgeGutter = resolveSupportedGableHouseEdgeGutter(currentModule.houseConnectionType);
      const gableRidgeBeamProfile = resolveSupportedGableRidgeOverride(currentModule.overrides);
      for (const edit of [
        { field: 'moduleValue', key: 'gableEndFramesMode', value: 'none' as const },
        { field: 'moduleValue', key: 'gableHouseEdgeGutter', value: gableHouseEdgeGutter },
        { field: 'moduleValue', key: 'gableOuterEdgeGutter', value: 'our' as const },
        { field: 'moduleOverride', key: 'ridgeBeamProfile', value: gableRidgeBeamProfile },
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
    case 'param':
      return {
        type: 'footprint_param',
        key: edit.key,
        value: edit.value,
      };
    default:
      return null;
  }
}
