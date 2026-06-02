import type { GeometryMetadata, HouseModel3D } from "./contracts";

export type HouseRoofStageStatus = "ok" | "failed" | "not_started";

export type HouseRoofStageDiagnostics = {
  footprintNormalizationStatus: HouseRoofStageStatus;
  eavePolygonConstructionStatus: HouseRoofStageStatus;
  roofIntentNormalizationStatus: HouseRoofStageStatus;
  roofTopologyClassificationStatus: HouseRoofStageStatus;
  roofPlaneGenerationStatus: HouseRoofStageStatus;
  roofQaValidationStatus: HouseRoofStageStatus;
  eavePolygonPointCount: number;
  roofIntentForm: string | null;
  roofIntentPitchDeg: number | null;
  roofIntentRidgeAxis: string | null;
  roofGeometry: string | null;
  roofFacetMergeMode: string | null;
  roofTopologyFailureReason: string | null;
  roofTopologyFinalFaceCount: number | null;
  roofTopologySourceEdgeCount: number | null;
  roofTopologyDisconnectedSourceFaceCount: number | null;
  roofTopologyInternalEaveHeightSegmentCount: number | null;
  roofTopologyProjectionViolationCount: number | null;
  roofWavefrontFailureReason: string | null;
  roofQaStatus: string | null;
  roofQaFailureReason: string | null;
  roofQaRejectedFacetCount: number | null;
  roofQaFacetAreaMm2: number | null;
  roofQaEaveAreaMm2: number | null;
  roofQaAreaDeltaMm2: number | null;
  roofPlaneCountBeforeQa: number;
  roofPlaneCountAfterQa: number;
  roofMaterialVisualCount: number;
  roofSolidCount: number;
};

export const EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS: HouseRoofStageDiagnostics = {
  footprintNormalizationStatus: "not_started",
  eavePolygonConstructionStatus: "not_started",
  roofIntentNormalizationStatus: "not_started",
  roofTopologyClassificationStatus: "not_started",
  roofPlaneGenerationStatus: "not_started",
  roofQaValidationStatus: "not_started",
  eavePolygonPointCount: 0,
  roofIntentForm: null,
  roofIntentPitchDeg: null,
  roofIntentRidgeAxis: null,
  roofGeometry: null,
  roofFacetMergeMode: null,
  roofTopologyFailureReason: null,
  roofTopologyFinalFaceCount: null,
  roofTopologySourceEdgeCount: null,
  roofTopologyDisconnectedSourceFaceCount: null,
  roofTopologyInternalEaveHeightSegmentCount: null,
  roofTopologyProjectionViolationCount: null,
  roofWavefrontFailureReason: null,
  roofQaStatus: null,
  roofQaFailureReason: null,
  roofQaRejectedFacetCount: null,
  roofQaFacetAreaMm2: null,
  roofQaEaveAreaMm2: null,
  roofQaAreaDeltaMm2: null,
  roofPlaneCountBeforeQa: 0,
  roofPlaneCountAfterQa: 0,
  roofMaterialVisualCount: 0,
  roofSolidCount: 0,
};

function stringMetadata(
  metadata: GeometryMetadata | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberMetadata(
  metadata: GeometryMetadata | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function summarizeHouseModelRoofStageDiagnostics(
  model: HouseModel3D | null | undefined,
): HouseRoofStageDiagnostics {
  if (!model) return EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS;

  const metadata = model?.metadata;
  const firstRoofPlaneMetadata = model?.roofPlanes.find(
    (plane) => plane.metadata,
  )?.metadata;
  const roofQaStatus = stringMetadata(metadata, "roofQaStatus");
  const roofPlaneCountBeforeQa = model.roofPlanes.length;
  const roofPlaneCountAfterQa =
    roofQaStatus === "valid" ? roofPlaneCountBeforeQa : 0;
  const eavePolygonPointCount = [
    ...(model.eave.soffitPolygons ?? []),
    ...(model.eave.fasciaPolygons ?? []),
  ].reduce((total, polygon) => total + polygon.length, 0);
  const roofTopologyFailureReason = stringMetadata(
    metadata,
    "roofTopologyFailureReason",
  );
  const roofWavefrontFailureReason = stringMetadata(
    metadata,
    "roofWavefrontFailureReason",
  );
  const roofIntentForm = stringMetadata(metadata, "roofForm");
  const roofIntentPitchDeg =
    numberMetadata(metadata, "roofPitchDeg") ??
    numberMetadata(firstRoofPlaneMetadata, "pitchDeg");
  const roofGeometry = stringMetadata(metadata, "roofGeometry");
  const roofMaterialVisualCount = model.roofMaterialVisuals?.length ?? 0;
  const roofSolidCount =
    model.solids?.surfaceSolids.filter((solid) => solid.kind === "roof")
      .length ?? 0;
  const hasMonoRoofBodyOutput =
    roofGeometry === "footprint_mono" &&
    roofPlaneCountBeforeQa > 0 &&
    (roofMaterialVisualCount > 0 || roofSolidCount > 0);
  const eavePolygonConstructionStatus =
    eavePolygonPointCount > 0 || hasMonoRoofBodyOutput ? "ok" : "failed";

  return {
    footprintNormalizationStatus: model.footprint.length >= 3 ? "ok" : "failed",
    eavePolygonConstructionStatus,
    roofIntentNormalizationStatus:
      roofIntentForm && roofIntentPitchDeg !== null ? "ok" : "failed",
    roofTopologyClassificationStatus:
      roofTopologyFailureReason || roofWavefrontFailureReason
        ? "failed"
        : roofPlaneCountBeforeQa > 0 || stringMetadata(metadata, "roofGeometry")
          ? "ok"
          : "not_started",
    roofPlaneGenerationStatus: roofPlaneCountBeforeQa > 0 ? "ok" : "failed",
    roofQaValidationStatus:
      roofQaStatus === "invalid"
        ? "failed"
        : roofQaStatus === "valid"
          ? "ok"
          : "not_started",
    eavePolygonPointCount,
    roofIntentForm,
    roofIntentPitchDeg,
    roofIntentRidgeAxis:
      model.roofRidgeAxis ?? stringMetadata(metadata, "ridgeAxis"),
    roofGeometry,
    roofFacetMergeMode: stringMetadata(metadata, "roofFacetMergeMode"),
    roofTopologyFailureReason,
    roofTopologyFinalFaceCount: numberMetadata(
      metadata,
      "roofTopologyFinalFaceCount",
    ),
    roofTopologySourceEdgeCount: numberMetadata(
      metadata,
      "roofTopologySourceEdgeCount",
    ),
    roofTopologyDisconnectedSourceFaceCount: numberMetadata(
      metadata,
      "roofTopologyDisconnectedSourceFaceCount",
    ),
    roofTopologyInternalEaveHeightSegmentCount: numberMetadata(
      metadata,
      "roofTopologyInternalEaveHeightSegmentCount",
    ),
    roofTopologyProjectionViolationCount: numberMetadata(
      metadata,
      "roofTopologyProjectionViolationCount",
    ),
    roofWavefrontFailureReason,
    roofQaStatus,
    roofQaFailureReason: stringMetadata(metadata, "roofQaFailureReason"),
    roofQaRejectedFacetCount: numberMetadata(
      metadata,
      "roofQaRejectedFacetCount",
    ),
    roofQaFacetAreaMm2: numberMetadata(metadata, "roofQaFacetAreaMm2"),
    roofQaEaveAreaMm2: numberMetadata(metadata, "roofQaEaveAreaMm2"),
    roofQaAreaDeltaMm2: numberMetadata(metadata, "roofQaAreaDeltaMm2"),
    roofPlaneCountBeforeQa,
    roofPlaneCountAfterQa,
    roofMaterialVisualCount,
    roofSolidCount,
  };
}

export function pickHouseRoofStageDiagnostics(
  diagnostics: HouseRoofStageDiagnostics,
): HouseRoofStageDiagnostics {
  return {
    footprintNormalizationStatus: diagnostics.footprintNormalizationStatus,
    eavePolygonConstructionStatus: diagnostics.eavePolygonConstructionStatus,
    roofIntentNormalizationStatus: diagnostics.roofIntentNormalizationStatus,
    roofTopologyClassificationStatus:
      diagnostics.roofTopologyClassificationStatus,
    roofPlaneGenerationStatus: diagnostics.roofPlaneGenerationStatus,
    roofQaValidationStatus: diagnostics.roofQaValidationStatus,
    eavePolygonPointCount: diagnostics.eavePolygonPointCount,
    roofIntentForm: diagnostics.roofIntentForm,
    roofIntentPitchDeg: diagnostics.roofIntentPitchDeg,
    roofIntentRidgeAxis: diagnostics.roofIntentRidgeAxis,
    roofGeometry: diagnostics.roofGeometry,
    roofFacetMergeMode: diagnostics.roofFacetMergeMode,
    roofTopologyFailureReason: diagnostics.roofTopologyFailureReason,
    roofTopologyFinalFaceCount: diagnostics.roofTopologyFinalFaceCount,
    roofTopologySourceEdgeCount: diagnostics.roofTopologySourceEdgeCount,
    roofTopologyDisconnectedSourceFaceCount:
      diagnostics.roofTopologyDisconnectedSourceFaceCount,
    roofTopologyInternalEaveHeightSegmentCount:
      diagnostics.roofTopologyInternalEaveHeightSegmentCount,
    roofTopologyProjectionViolationCount:
      diagnostics.roofTopologyProjectionViolationCount,
    roofWavefrontFailureReason: diagnostics.roofWavefrontFailureReason,
    roofQaStatus: diagnostics.roofQaStatus,
    roofQaFailureReason: diagnostics.roofQaFailureReason,
    roofQaRejectedFacetCount: diagnostics.roofQaRejectedFacetCount,
    roofQaFacetAreaMm2: diagnostics.roofQaFacetAreaMm2,
    roofQaEaveAreaMm2: diagnostics.roofQaEaveAreaMm2,
    roofQaAreaDeltaMm2: diagnostics.roofQaAreaDeltaMm2,
    roofPlaneCountBeforeQa: diagnostics.roofPlaneCountBeforeQa,
    roofPlaneCountAfterQa: diagnostics.roofPlaneCountAfterQa,
    roofMaterialVisualCount: diagnostics.roofMaterialVisualCount,
    roofSolidCount: diagnostics.roofSolidCount,
  };
}

export function firstHouseRoofStageDiagnosticCode(
  diagnostics: HouseRoofStageDiagnostics,
): string | null {
  if (diagnostics.footprintNormalizationStatus === "failed")
    return "footprint_normalization_failed";
  if (diagnostics.eavePolygonConstructionStatus === "failed")
    return "eave_polygon_construction_failed";
  if (diagnostics.roofIntentNormalizationStatus === "failed")
    return "roof_intent_normalization_failed";
  if (diagnostics.roofTopologyFailureReason)
    return diagnostics.roofTopologyFailureReason;
  if (diagnostics.roofWavefrontFailureReason)
    return diagnostics.roofWavefrontFailureReason;
  if (diagnostics.roofTopologyClassificationStatus === "failed")
    return "roof_topology_classification_failed";
  if (diagnostics.roofPlaneGenerationStatus === "failed")
    return "roof_plane_generation_failed";
  if (diagnostics.roofQaFailureReason) return diagnostics.roofQaFailureReason;
  if (diagnostics.roofQaValidationStatus === "failed")
    return "roof_qa_validation_failed";
  return null;
}
