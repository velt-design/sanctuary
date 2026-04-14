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
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import { coerceHiddenWorkbenchGableBaseline } from './hiddenWorkbenchGableBaseline';
import { resolveWorkbenchGeometryModule } from './resolveWorkbenchGeometryModule';

export type GeometryPreviewMode = 'snapshot_validated' | 'snapshot_local_resolved' | 'draft_local_resolved';

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

function resolvePreviewMode(input: {
  resultSource: 'snapshot' | 'local_resolve';
  draftTouchesGeometry: boolean;
}): GeometryPreviewMode {
  if (input.draftTouchesGeometry) return 'draft_local_resolved';
  return input.resultSource === 'local_resolve' ? 'snapshot_local_resolved' : 'snapshot_validated';
}

export function buildWorkbenchGeometryPreview(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
}): GeometryPreviewState {
  const resolved = resolveWorkbenchGeometryModule({
    snapshot: input.snapshot,
    draft: input.draft,
    moduleIndex: input.moduleIndex,
  });
  const previewMode = resolvePreviewMode({
    resultSource: resolved.resultSource,
    draftTouchesGeometry: resolved.draftTouchesGeometry,
  });

  if (!resolved.ok) {
    return {
      kind: 'error',
      message: resolved.message.replace('workbench geometry', '3D geometry preview'),
    };
  }

  const module = resolved.module;
  const geometryModule = coerceHiddenWorkbenchGableBaseline(module);

  const rawInput = buildRawGeometryModuleInput({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    moduleId: `module-${input.moduleIndex + 1}`,
    module: geometryModule,
    result: resolved.moduleResult,
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
    resultSource: resolved.resultSource,
    config: normalized.value,
    assembly: solveResult.value,
    validation,
    scene: buildViewerSceneModel(solveResult.value),
  };
}
