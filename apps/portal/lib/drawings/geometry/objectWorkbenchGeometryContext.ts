import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { WorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { buildObjectFirstWorkbenchProjectModelFromLegacyEstimateSnapshot } from '@/lib/drawings/state/legacyEstimateSnapshotAdapter';

export type ObjectWorkbenchGeometryContext = {
  projectModel: WorkbenchProjectModel | null;
};

export function buildObjectWorkbenchGeometryContext(input: {
  snapshot?: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  projectModel?: WorkbenchProjectModel | null;
  ignoreModuleResults?: boolean;
}): ObjectWorkbenchGeometryContext {
  if (input.projectModel !== undefined) {
    return {
      projectModel: input.projectModel ?? null,
    };
  }

  if (input.snapshot !== undefined || input.draft !== undefined) {
    return {
      projectModel: buildObjectFirstWorkbenchProjectModelFromLegacyEstimateSnapshot({
        snapshot: input.snapshot ?? null,
        draft: input.draft,
        ignoreModuleResults: input.ignoreModuleResults,
      }),
    };
  }

  return {
    projectModel: null,
  };
}
