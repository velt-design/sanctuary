import { buildHouseFirstWorkbenchProjectModel } from '../houseFirstWorkbenchAdapter';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '../houseFirstWorkbenchModel';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft } from '../objectFirstWorkbenchAdapter';
import type {
  DeckAttachmentMode,
  DeckElevationMode,
  DeckFloatingPresetRect,
  DeckKind,
  DeckModel,
  DeckPresetRect,
  DeckPresetType,
  DeckShape,
  DeckSupportClassification,
  DeckSupportWarningCode,
  DeckValidationCode,
  DeckSurfaceMaterial,
  HouseAttachmentZoneKind,
  HouseFirstDeckDraft,
  HouseFirstMigrationWarning,
  HouseFirstOpeningDraft,
  HouseFirstPergolaDraft,
  HouseFirstRoofDraft,
  HouseFirstWorkbenchProjectModel,
  HouseModel,
  HouseRoofAppendageForm,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  PergolaModel,
  SliderPanelCount,
  WallOpeningHostSide,
  WallOpeningKind,
  WallOpeningValidationCode,
  WorkbenchHouseSelection,
  WorkbenchMode,
} from '../houseFirstWorkbenchModel';

export { normalizeWallOpeningKind, resolveOpeningPanelCount };

export type ObjectWorkbenchCompatibilityProjectModel = HouseFirstWorkbenchProjectModel;
export type ObjectWorkbenchCompatibilityHouseModel = HouseModel;
export type ObjectWorkbenchCompatibilityPergolaModel = PergolaModel;
export type ObjectWorkbenchCompatibilityMigrationWarning = HouseFirstMigrationWarning;
export type ObjectWorkbenchCompatibilityRoofDraft = HouseFirstRoofDraft;
export type ObjectWorkbenchCompatibilityDeckDraft = HouseFirstDeckDraft;
export type ObjectWorkbenchCompatibilityOpeningDraft = HouseFirstOpeningDraft;
export type ObjectWorkbenchCompatibilityPergolaDraft = HouseFirstPergolaDraft;
export type ObjectWorkbenchCompatibilityDraft = {
  roof?: ObjectWorkbenchCompatibilityRoofDraft | null;
  decks?: ObjectWorkbenchCompatibilityDeckDraft[] | null;
  openings?: ObjectWorkbenchCompatibilityOpeningDraft[] | null;
  pergolas?: ObjectWorkbenchCompatibilityPergolaDraft[] | null;
};
export type ObjectWorkbenchCompatibilityDrawingDraft = EstimateDrawingDraft & {
  houseFirst?: ObjectWorkbenchCompatibilityDraft | null;
};
export type {
  DeckAttachmentMode,
  DeckElevationMode,
  DeckFloatingPresetRect,
  DeckKind,
  DeckModel,
  DeckPresetRect,
  DeckPresetType,
  DeckShape,
  DeckSupportClassification,
  DeckSupportWarningCode,
  DeckValidationCode,
  DeckSurfaceMaterial,
  HouseAttachmentZoneKind,
  HouseRoofAppendageForm,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  SliderPanelCount,
  WallOpeningHostSide,
  WallOpeningKind,
  WallOpeningValidationCode,
  WorkbenchHouseSelection,
  WorkbenchMode,
};
export type BuildObjectWorkbenchCompatibilityProjectModelInput = {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | ObjectWorkbenchCompatibilityDrawingDraft | null;
  ignoreModuleResults?: boolean;
};

export function buildObjectWorkbenchCompatibilityProjectModel(
  input: BuildObjectWorkbenchCompatibilityProjectModelInput,
): ObjectWorkbenchCompatibilityProjectModel {
  const draft: ObjectWorkbenchCompatibilityDrawingDraft | null | undefined = input.draft?.objectFirst
    ? {
        ...input.draft,
        houseFirst: buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft(input.draft.objectFirst),
      }
    : input.draft as ObjectWorkbenchCompatibilityDrawingDraft | null | undefined;
  return buildHouseFirstWorkbenchProjectModel({
    snapshot: input.snapshot,
    draft,
    ignoreModuleResults: input.ignoreModuleResults,
  });
}
