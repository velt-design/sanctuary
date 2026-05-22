import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '../houseFirstWorkbenchModel';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
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
// PR-A (2026-05-22): `BuildObjectWorkbenchCompatibilityProjectModelInput`
// and `buildObjectWorkbenchCompatibilityProjectModel` were deleted. The
// conversion they performed (objectFirst draft -> houseFirst draft view)
// is now an internal step of `buildHouseFirstWorkbenchProjectModel`. Call
// that function directly. This file remains a type re-export namespace
// until PR-D / PR-E / PR-F migrate the consuming adapters to import from
// `houseFirstWorkbenchModel` directly; PR-H deletes the file entirely.
