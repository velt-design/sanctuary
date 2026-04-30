import { buildHouseFirstWorkbenchProjectModel } from '../houseFirstWorkbenchAdapter';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '../houseFirstWorkbenchModel';
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
  DeckSurfaceMaterial,
  HouseAttachmentZoneKind,
  HouseRoofAppendageForm,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  SliderPanelCount,
  WallOpeningHostSide,
  WallOpeningKind,
  WorkbenchHouseSelection,
  WorkbenchMode,
};
export type BuildObjectWorkbenchCompatibilityProjectModelInput = Parameters<
  typeof buildHouseFirstWorkbenchProjectModel
>[0];

export function buildObjectWorkbenchCompatibilityProjectModel(
  input: BuildObjectWorkbenchCompatibilityProjectModelInput,
): ObjectWorkbenchCompatibilityProjectModel {
  return buildHouseFirstWorkbenchProjectModel(input);
}
