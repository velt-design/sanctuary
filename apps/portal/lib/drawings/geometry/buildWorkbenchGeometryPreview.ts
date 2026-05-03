import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { WorkbenchProjectModel } from '../state/objectFirstWorkbenchModel';
import { buildObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';
import {
  buildGeometryPreviewStateFromSolvedModel,
  buildWorkbenchSolvedModel,
  type GeometryPreviewState,
} from '../state/workbenchSolvedModel';

export type {
  GeometryPreviewMode,
  GeometryPreviewState,
} from '../state/workbenchSolvedModel';

export function buildWorkbenchGeometryPreview(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
  objectWorkbenchProjectModel?: WorkbenchProjectModel | null;
}): GeometryPreviewState {
  const geometryContext = buildObjectWorkbenchGeometryContext({
    snapshot: input.snapshot,
    draft: input.draft,
    projectModel: input.objectWorkbenchProjectModel,
  });
  const solvedModel = buildWorkbenchSolvedModel({
    snapshot: input.snapshot,
    draft: input.draft,
    activeModuleIndex: input.moduleIndex,
    geometryIdentity: {
      projectId: input.projectId,
      estimateId: input.estimateId,
      designRequestId: input.designRequestId ?? null,
    },
    projectModel: geometryContext.projectModel,
    objectWorkbenchGeometryContext: geometryContext,
  });

  return buildGeometryPreviewStateFromSolvedModel(solvedModel);
}
