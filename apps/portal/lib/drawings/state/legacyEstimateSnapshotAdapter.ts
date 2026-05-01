import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildObjectWorkbenchCompatibilityProjectModel } from './compat/objectWorkbenchCompatibilityModel';
import {
  buildObjectFirstWorkbenchProjectModel,
} from './legacyObjectFirstCompatibilityAdapter';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from './objectFirstWorkbenchAdapter';
import type {
  ObjectFirstWorkbenchDraftVNext,
  WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';

export function buildObjectFirstWorkbenchProjectModelFromLegacyEstimateSnapshot(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
}): WorkbenchProjectModel {
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
    snapshot: input.snapshot,
    draft: input.draft,
    ignoreModuleResults: input.ignoreModuleResults,
  });

  return buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel,
    objectFirstDraft: input.draft?.objectFirst,
  });
}

export function buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
}): ObjectFirstWorkbenchDraftVNext | null {
  const projectModel = buildObjectFirstWorkbenchProjectModelFromLegacyEstimateSnapshot({
    snapshot: input.snapshot,
    draft: input.draft,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  return buildObjectFirstWorkbenchDraftFromProjectModel(projectModel);
}
