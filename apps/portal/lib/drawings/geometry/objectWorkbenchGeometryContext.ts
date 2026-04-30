import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { WorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type ObjectWorkbenchGeometryContext = {
  projectModel: WorkbenchProjectModel | null;
};

export function buildObjectWorkbenchGeometryContext(input: {
  snapshot?: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  projectModel?: WorkbenchProjectModel | null;
  ignoreModuleResults?: boolean;
}): ObjectWorkbenchGeometryContext {
  void input.snapshot;
  void input.draft;
  void input.ignoreModuleResults;

  return {
    projectModel: input.projectModel ?? null,
  };
}
