import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  EMPTY_WORKBENCH_PROJECT_MODEL,
  buildWorkbenchProjectModelFromObjectFirstDraft,
  type WorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type ObjectWorkbenchGeometryContext = {
  projectModel: WorkbenchProjectModel | null;
};

export function buildObjectWorkbenchGeometryContext(input: {
  draft?: EstimateDrawingDraft | null;
  projectModel?: WorkbenchProjectModel | null;
}): ObjectWorkbenchGeometryContext {
  if (input.projectModel !== undefined) {
    return {
      projectModel: input.projectModel ?? null,
    };
  }

  return {
    projectModel: input.draft
      ? buildWorkbenchProjectModelFromObjectFirstDraft(input.draft.objectFirst)
      : EMPTY_WORKBENCH_PROJECT_MODEL,
  };
}
