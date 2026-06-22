import type { HouseModel3D } from "../contracts";
import {
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  firstHouseRoofStageDiagnosticCode,
  pickHouseRoofStageDiagnostics,
  summarizeHouseModelRoofStageDiagnostics,
  type HouseRoofStageDiagnostics,
} from "../houseRoofDiagnostics";

export type HouseRoofModelPipelineFailureStage =
  | "not_started"
  | "missing_model"
  | "footprint_normalization"
  | "eave_polygon_construction"
  | "roof_intent_normalization"
  | "roof_topology_classification"
  | "roof_plane_generation"
  | "roof_qa_validation"
  | "none";

type HouseRoofModelPipelineDiagnostics = HouseRoofStageDiagnostics & {
  houseId: string;
  modelPresent: boolean;
  failureStage: HouseRoofModelPipelineFailureStage;
  diagnosticCode: string | null;
};

type HouseRoofModelPipelineResult =
  | {
      ok: true;
      houseId: string;
      model: HouseModel3D;
      diagnostics: HouseRoofModelPipelineDiagnostics;
    }
  | {
      ok: false;
      houseId: string;
      model: HouseModel3D | null;
      diagnostics: HouseRoofModelPipelineDiagnostics;
    };

function houseRoofModelPipelineFailureStage(
  diagnostics: HouseRoofStageDiagnostics,
): HouseRoofModelPipelineFailureStage {
  if (diagnostics.footprintNormalizationStatus === "failed") {
    return "footprint_normalization";
  }
  if (diagnostics.eavePolygonConstructionStatus === "failed") {
    return "eave_polygon_construction";
  }
  if (diagnostics.roofIntentNormalizationStatus === "failed") {
    return "roof_intent_normalization";
  }
  if (diagnostics.roofTopologyClassificationStatus === "failed") {
    return "roof_topology_classification";
  }
  if (diagnostics.roofPlaneGenerationStatus === "failed") {
    return "roof_plane_generation";
  }
  if (diagnostics.roofQaValidationStatus === "failed") {
    return "roof_qa_validation";
  }
  return "none";
}

export function buildHouseRoofModelPipeline(input: {
  houseId: string;
  model: HouseModel3D | null | undefined;
}): HouseRoofModelPipelineResult {
  if (!input.model) {
    return {
      ok: false,
      houseId: input.houseId,
      model: null,
      diagnostics: {
        houseId: input.houseId,
        modelPresent: false,
        failureStage: "missing_model",
        diagnosticCode: "missing_model",
        ...pickHouseRoofStageDiagnostics(EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS),
      },
    };
  }

  const roofStageDiagnostics = summarizeHouseModelRoofStageDiagnostics(
    input.model,
  );
  const failureStage = houseRoofModelPipelineFailureStage(roofStageDiagnostics);
  const diagnosticCode =
    firstHouseRoofStageDiagnosticCode(roofStageDiagnostics);
  const diagnostics: HouseRoofModelPipelineDiagnostics = {
    houseId: input.houseId,
    modelPresent: true,
    failureStage,
    diagnosticCode,
    ...pickHouseRoofStageDiagnostics(roofStageDiagnostics),
  };

  if (failureStage === "none") {
    return {
      ok: true,
      houseId: input.houseId,
      model: input.model,
      diagnostics,
    };
  }

  return {
    ok: false,
    houseId: input.houseId,
    model: input.model,
    diagnostics,
  };
}
