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
  draft?: EstimateDrawingDraft | null;
  objectWorkbenchProjectModel?: WorkbenchProjectModel | null;
}): GeometryPreviewState {
  const geometryContext = buildObjectWorkbenchGeometryContext({
    draft: input.draft,
    projectModel: input.objectWorkbenchProjectModel,
  });
  const solvedModel = buildWorkbenchSolvedModel({
    geometryIdentity: {
      projectId: input.projectId,
      estimateId: input.estimateId,
      designRequestId: input.designRequestId ?? null,
    },
    projectModel: geometryContext.projectModel,
  });

  return buildGeometryPreviewStateFromSolvedModel(solvedModel);
}
