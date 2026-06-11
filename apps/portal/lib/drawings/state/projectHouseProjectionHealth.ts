import type { HouseRoofStageDiagnostics } from "@sp/geometry";
import type { HouseRoofIntentResolutionSource } from "./objectFirstWorkbenchModel";

export type ProjectHouseProjectionHealth = {
  houseFormId: string;
  geometryInputPresent: boolean;
  rawHouseInputPresent: boolean;
  footprintPointCount: number;
  referencePresent: boolean;
  modelPresent: boolean;
  wallCount: number;
  roofPlaneCount: number;
  roofBodyCount: number;
  roofMaterialBodyCount: number;
  planBodyIds: string[];
  roofBodyIds: string[];
  roofMaterialBodyIds: string[];
  sceneBodyCount: number;
  sceneRoofBodyCount: number;
  sceneRoofMaterialBodyCount: number;
  canRenderCommittedBody: boolean;
  visibleReferenceFallbackIds: string[];
  failureStage: ProjectHouseProjectionFailureStage;
  diagnosticCode: string | null;
  roofValidationStatus: string | null;
  roofValidationCode: string | null;
  roofIntentAuthored: boolean;
  rawRoofIntentForm: string | null;
  resolvedRoofIntentForm: string | null;
  roofIntentResolutionSource: HouseRoofIntentResolutionSource | null;
  roofIntentRepairCode: string | null;
} & HouseRoofStageDiagnostics;

export type ProjectHouseProjectionFailureStage =
  | "none"
  | "missing_house_form"
  | "invalid_footprint"
  | "missing_geometry_input"
  | "missing_model"
  | "missing_roof_model"
  | "missing_plan_body"
  | "missing_3d_body";
