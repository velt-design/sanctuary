import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import {
  buildObjectFirstWorkbenchProjectModel,
} from '@/lib/drawings/state/legacyObjectFirstCompatibilityAdapter';
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

function buildObjectWorkbenchGeometryHouse(input: {
  projectModel: WorkbenchProjectModel;
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null;
}): ObjectWorkbenchCompatibilityHouseModel | null {
  const compatibilityHouse = input.compatibilityHouse;
  const houseForm = input.projectModel.houseAssembly?.houseForms[0] ?? null;
  if (!compatibilityHouse || !houseForm) return compatibilityHouse;

  return {
    ...compatibilityHouse,
    id: houseForm.id,
    label: houseForm.label,
    sourceModuleIndexes: houseForm.sourceModuleIndexes ?? compatibilityHouse.sourceModuleIndexes,
    sourceModuleIds: houseForm.sourceModuleIds ?? compatibilityHouse.sourceModuleIds,
    footprint: {
      mode: houseForm.footprint.mode,
      preset: houseForm.footprint.preset,
      params: houseForm.footprint.params,
      polygon: houseForm.footprint.polygon,
      drawingRotationQuarterTurns: houseForm.transform.rotationQuarterTurns,
      attachmentSide: houseForm.footprint.attachmentSide,
    },
    storeyMode: houseForm.storeyMode,
    attachmentStrategy: houseForm.attachmentStrategy,
    eaveHeightM: houseForm.eaveHeightM ?? compatibilityHouse.eaveHeightM,
    wallHeightM: houseForm.wallHeightM ?? compatibilityHouse.wallHeightM,
    soffitDepthMm: houseForm.soffitDepthMm ?? compatibilityHouse.soffitDepthMm,
    fasciaHeightMm: houseForm.fasciaHeightMm ?? compatibilityHouse.fasciaHeightMm,
    gutterWidthMm: houseForm.gutterWidthMm ?? compatibilityHouse.gutterWidthMm,
    gutterDepthMm: houseForm.gutterDepthMm ?? compatibilityHouse.gutterDepthMm,
    gutterProjectionMm: houseForm.gutterProjectionMm ?? compatibilityHouse.gutterProjectionMm,
    eaveOverhangMm: houseForm.eaveOverhangMm ?? compatibilityHouse.eaveOverhangMm,
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
  const house = buildObjectWorkbenchGeometryHouse({
    projectModel,
    compatibilityHouse: compatibilityProjectModel.house,
  });

  return {
    projectModel,
    compatibilityProjectModel,
    house,
    pergolas: compatibilityProjectModel.pergolas,
    warnings: compatibilityProjectModel.warnings,
  };
}
