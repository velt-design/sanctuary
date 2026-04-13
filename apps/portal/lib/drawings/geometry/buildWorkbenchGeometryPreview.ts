import {
  buildViewerSceneModel,
  normalizeGeometryConfig,
  solveAssembly3D,
  validateGeometrySolve,
  type Assembly3D,
  type GeometryConfig,
  type GeometryValidationReport,
  type ViewerSceneModel,
} from '@sp/geometry';
import { getModuleCostOutputFromSnapshot } from '@/lib/costingAudit/viewModel';
import {
  estimateDrawingDraftTouchesGeometry,
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import { coerceHiddenWorkbenchGableBaseline } from './hiddenWorkbenchGableBaseline';
import { solveActiveGeometryModuleResult } from './solveActiveGeometryModuleResult';

export type GeometryPreviewMode = 'snapshot_validated' | 'draft_local_resolved';

export type GeometryPreviewState =
  | {
      kind: 'ready';
      previewMode: GeometryPreviewMode;
      resultSource: 'snapshot' | 'local_resolve';
      config: GeometryConfig;
      assembly: Assembly3D;
      validation: GeometryValidationReport;
      scene: ViewerSceneModel;
    }
  | {
      kind: 'unsupported';
      previewMode: GeometryPreviewMode;
      config?: GeometryConfig;
      validation?: GeometryValidationReport;
      message: string;
    }
  | {
      kind: 'error';
      message: string;
    };

function resolvePreviewMode(
  snapshot: Record<string, unknown> | null,
  draft: EstimateDrawingDraft | null | undefined,
): GeometryPreviewMode {
  return estimateDrawingDraftTouchesGeometry(draft, snapshot) ? 'draft_local_resolved' : 'snapshot_validated';
}

export function buildWorkbenchGeometryPreview(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
}): GeometryPreviewState {
  const previewMode = resolvePreviewMode(input.snapshot, input.draft);
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);

  if (!calculatorInputs) {
    return {
      kind: 'error',
      message: 'Calculator inputs are not available for 3D geometry preview.',
    };
  }

  const module = calculatorInputs.modules[input.moduleIndex];
  if (!module) {
    return {
      kind: 'error',
      message: 'The selected module is not available for 3D geometry preview.',
    };
  }
  const geometryModule = coerceHiddenWorkbenchGableBaseline(module);

  const moduleResult =
    previewMode === 'draft_local_resolved'
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
      kind: 'error',
      message: moduleResult.message,
    };
  }

  const rawInput = buildRawGeometryModuleInput({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    moduleId: `module-${input.moduleIndex + 1}`,
    module: geometryModule,
    result: moduleResult.moduleResult,
  });

  const normalized = normalizeGeometryConfig(rawInput);

  if (!normalized.ok) {
    if (normalized.code === 'unsupported_family') {
      return {
        kind: 'unsupported',
        previewMode,
        message: normalized.error,
      };
    }

    return {
      kind: 'error',
      message: normalized.error,
    };
  }

  const solveResult = solveAssembly3D(normalized.value);
  const validation = validateGeometrySolve({
    config: normalized.value,
    solveResult,
  });

  if (!solveResult.ok) {
    return {
      kind: 'unsupported',
      previewMode,
      config: normalized.value,
      validation,
      message: solveResult.error,
    };
  }

  return {
    kind: 'ready',
    previewMode,
    resultSource: previewMode === 'draft_local_resolved' ? 'local_resolve' : 'snapshot',
    config: normalized.value,
    assembly: solveResult.value,
    validation,
    scene: buildViewerSceneModel(solveResult.value),
  };
}
