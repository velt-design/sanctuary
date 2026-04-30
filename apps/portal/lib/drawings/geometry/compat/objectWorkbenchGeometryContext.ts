import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
  buildObjectFirstWorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import type { WorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  buildObjectWorkbenchCompatibilityProjectModel,
  type ObjectWorkbenchCompatibilityHouseModel,
  type ObjectWorkbenchCompatibilityMigrationWarning,
  type ObjectWorkbenchCompatibilityPergolaModel,
  type ObjectWorkbenchCompatibilityProjectModel,
} from '@/lib/drawings/state/compat/objectWorkbenchCompatibilityModel';

export type ObjectWorkbenchGeometryContext = {
  projectModel: WorkbenchProjectModel;
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel;
  house: ObjectWorkbenchCompatibilityHouseModel | null;
  pergolas: ObjectWorkbenchCompatibilityPergolaModel[];
  warnings: ObjectWorkbenchCompatibilityMigrationWarning[];
};

function buildDraftForObjectWorkbenchGeometryContext(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  projectModel: WorkbenchProjectModel;
}): EstimateDrawingDraft | null {
  const draft = input.draft ?? buildEstimateDrawingDraftFromSnapshot(input.snapshot);
  if (!draft) return null;
  return {
    ...draft,
    objectFirst: buildObjectFirstWorkbenchDraftFromProjectModel(input.projectModel),
  };
}

export function buildObjectWorkbenchGeometryContext(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  projectModel?: WorkbenchProjectModel | null;
  ignoreModuleResults?: boolean;
}): ObjectWorkbenchGeometryContext {
  let projectModel = input.projectModel ?? null;
  if (!projectModel) {
    const fallbackCompatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
      snapshot: input.snapshot,
      draft: input.draft,
      ignoreModuleResults: input.ignoreModuleResults,
    });
    projectModel = buildObjectFirstWorkbenchProjectModel({
      compatibilityProjectModel: fallbackCompatibilityProjectModel,
      objectFirstDraft: input.draft?.objectFirst,
    });
  }

  const geometryDraft = buildDraftForObjectWorkbenchGeometryContext({
    snapshot: input.snapshot,
    draft: input.draft,
    projectModel,
  });
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
    snapshot: input.snapshot,
    draft: geometryDraft,
    ignoreModuleResults: input.ignoreModuleResults,
  });

  return {
    projectModel,
    compatibilityProjectModel,
    house: compatibilityProjectModel.house,
    pergolas: compatibilityProjectModel.pergolas,
    warnings: compatibilityProjectModel.warnings,
  };
}
