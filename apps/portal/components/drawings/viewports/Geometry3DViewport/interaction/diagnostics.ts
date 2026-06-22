import type {
  ViewerSceneHouseSurfaceSolidObject,
  ViewerSceneModel,
  ViewerSceneObject,
} from "@sp/geometry";
import type { GeometryPreviewMode } from "@/lib/drawings/geometry/buildWorkbenchGeometryPreview";
import { isRenderableSlab } from "../geometry/buildGeometries";
import { formatPoint, formatVector } from "./cameraState";

/**
 * Diagnostics types + text helpers for the 3D viewport. The viewport
 * exposes a diagnostics panel that summarises camera state, scene-rect
 * sizing, roof-topology QA, opening counts, and a per-selection object
 * summary; every formatter consumed by that panel lives in this module
 * so the panel's render path is a pure transform over typed inputs.
 */

export type ViewportRectDiagnostics = {
  shellWidth: number;
  shellHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasContained: boolean;
};

export type HouseRoofViewportDiagnostics = {
  qaStatus: string;
  qaFailureReason: string;
  topologySolver: string;
  topologyFailureReason: string;
  topologyFailureEdgeId: string;
  topologyFinalFaceCount: number;
  topologyClosedFaceCount: number;
  topologyExpectedFaceCount: number;
  topologyValleyCount: number;
  topologyDisconnectedSourceFaceCount: number;
  topologyInternalEaveHeightSegmentCount: number;
  topologyChordViolationCount: number;
  topologyUnbackedBoundaryCount: number;
  expectedSolidCount: number;
  renderedSolidCount: number;
  skippedSolidCount: number;
};

export type HouseOpeningViewportDiagnostics = {
  totalCount: number;
  validCount: number;
  hostEdgeResolvedCount: number;
  hostEdgeUnresolvedCount: number;
  renderedMarkerCount: number;
  skippedInvalidCount: number;
  unresolvedValidCount: number;
};

export function rectContains(outer: DOMRect, inner: DOMRect): boolean {
  const tolerancePx = 1;
  return (
    inner.left >= outer.left - tolerancePx &&
    inner.top >= outer.top - tolerancePx &&
    inner.right <= outer.right + tolerancePx &&
    inner.bottom <= outer.bottom + tolerancePx
  );
}

export function rectDiagnostics(
  shell: HTMLElement | null,
  canvas: HTMLElement | null | undefined,
): ViewportRectDiagnostics {
  const shellRect = shell?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  return {
    shellWidth: shellRect ? Math.round(shellRect.width) : 0,
    shellHeight: shellRect ? Math.round(shellRect.height) : 0,
    canvasWidth: canvasRect ? Math.round(canvasRect.width) : 0,
    canvasHeight: canvasRect ? Math.round(canvasRect.height) : 0,
    canvasContained: Boolean(shellRect && canvasRect && rectContains(shellRect, canvasRect)),
  };
}

export function sceneMetadataString(scene: ViewerSceneModel, key: string): string | null {
  const value = scene.metadata?.[key];
  return typeof value === "string" ? value : null;
}

export function sceneMetadataNumber(scene: ViewerSceneModel, key: string): number | null {
  const value = scene.metadata?.[key];
  return typeof value === "number" ? value : null;
}

export function collectHouseRoofViewportDiagnostics(
  scene: ViewerSceneModel | null,
): HouseRoofViewportDiagnostics {
  if (!scene) {
    return {
      qaStatus: "",
      qaFailureReason: "",
      topologySolver: "",
      topologyFailureReason: "",
      topologyFailureEdgeId: "",
      topologyFinalFaceCount: 0,
      topologyClosedFaceCount: 0,
      topologyExpectedFaceCount: 0,
      topologyValleyCount: 0,
      topologyDisconnectedSourceFaceCount: 0,
      topologyInternalEaveHeightSegmentCount: 0,
      topologyChordViolationCount: 0,
      topologyUnbackedBoundaryCount: 0,
      expectedSolidCount: 0,
      renderedSolidCount: 0,
      skippedSolidCount: 0,
    };
  }

  const roofSolids = scene.layers
    .flatMap((layer) => layer.objects)
    .filter(
      (object): object is ViewerSceneHouseSurfaceSolidObject =>
        object.type === "house_surface_solid" && object.kind === "roof",
    );
  const expectedSolidCount =
    sceneMetadataNumber(scene, "houseRoofSolidExpectedCount") ?? roofSolids.length;
  const renderedSolidCount = roofSolids.filter((object) =>
    isRenderableSlab(object.boundary, object.plane, object.thicknessMm),
  ).length;
  const metadataSkippedCount =
    sceneMetadataNumber(scene, "houseRoofSolidSkippedCount") ?? 0;
  const skippedSolidCount = Math.max(
    0,
    expectedSolidCount - renderedSolidCount,
    metadataSkippedCount,
  );

  return {
    qaStatus: sceneMetadataString(scene, "houseRoofQaStatus") ?? "",
    qaFailureReason: sceneMetadataString(scene, "houseRoofQaFailureReason") ?? "",
    topologySolver:
      sceneMetadataString(scene, "houseRoofTopologySolver") ?? "",
    topologyFailureReason:
      sceneMetadataString(scene, "houseRoofTopologyFailureReason") ?? "",
    topologyFailureEdgeId:
      sceneMetadataString(scene, "houseRoofTopologyFailureEdgeId") ?? "",
    topologyFinalFaceCount:
      sceneMetadataNumber(scene, "houseRoofTopologyFinalFaceCount") ?? 0,
    topologyClosedFaceCount:
      sceneMetadataNumber(scene, "houseRoofTopologyClosedFaceCount") ?? 0,
    topologyExpectedFaceCount:
      sceneMetadataNumber(scene, "houseRoofTopologyExpectedFaceCount") ?? 0,
    topologyValleyCount:
      sceneMetadataNumber(scene, "houseRoofTopologyValleyCount") ?? 0,
    topologyDisconnectedSourceFaceCount:
      sceneMetadataNumber(scene, "houseRoofTopologyDisconnectedSourceFaceCount") ?? 0,
    topologyInternalEaveHeightSegmentCount:
      sceneMetadataNumber(scene, "houseRoofTopologyInternalEaveHeightSegmentCount") ?? 0,
    topologyChordViolationCount:
      sceneMetadataNumber(scene, "houseRoofTopologyChordViolationCount") ?? 0,
    topologyUnbackedBoundaryCount:
      sceneMetadataNumber(scene, "houseRoofTopologyUnbackedBoundaryCount") ?? 0,
    expectedSolidCount,
    renderedSolidCount,
    skippedSolidCount,
  };
}

export function collectHouseOpeningViewportDiagnostics(
  scene: ViewerSceneModel | null,
): HouseOpeningViewportDiagnostics {
  if (!scene) {
    return {
      totalCount: 0,
      validCount: 0,
      hostEdgeResolvedCount: 0,
      hostEdgeUnresolvedCount: 0,
      renderedMarkerCount: 0,
      skippedInvalidCount: 0,
      unresolvedValidCount: 0,
    };
  }

  return {
    totalCount: sceneMetadataNumber(scene, "houseOpeningCount") ?? 0,
    validCount: sceneMetadataNumber(scene, "houseOpeningValidCount") ?? 0,
    hostEdgeResolvedCount: sceneMetadataNumber(scene, "houseOpeningHostEdgeResolvedCount") ?? 0,
    hostEdgeUnresolvedCount: sceneMetadataNumber(scene, "houseOpeningHostEdgeUnresolvedCount") ?? 0,
    renderedMarkerCount: sceneMetadataNumber(scene, "houseOpeningRenderedMarkerCount") ?? 0,
    skippedInvalidCount: sceneMetadataNumber(scene, "houseOpeningSkippedInvalidCount") ?? 0,
    unresolvedValidCount: sceneMetadataNumber(scene, "houseOpeningUnresolvedValidCount") ?? 0,
  };
}

export function formatMetadata(metadata: ViewerSceneObject["metadata"]): string {
  if (!metadata) return "None";
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

export function metadataText(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

export function metadataNumber(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

export function formatDiagnosticToken(value: string): string {
  return value.replace(/_/g, " ");
}

export function houseRoofQaSummary(
  metadata: ViewerSceneObject["metadata"],
): Array<{ label: string; value: string }> {
  const qaStatus = metadataText(metadata, "roofQaStatus");
  const skipReason = metadataText(metadata, "roofRenderSkipReason");
  const failureReason = metadataText(metadata, "roofQaFailureReason");
  const finalFaceCount = metadataNumber(metadata, "roofTopologyFinalFaceCount");
  const valleyCount = metadataNumber(metadata, "roofTopologyValleyCount");
  const internalEaveSeamCount = metadataNumber(metadata, "roofTopologyInternalEaveHeightSegmentCount");
  const rows: Array<{ label: string; value: string }> = [];
  if (qaStatus) rows.push({ label: "Roof QA", value: qaStatus });
  if (finalFaceCount != null) rows.push({ label: "Roof faces", value: String(finalFaceCount) });
  if (valleyCount != null) rows.push({ label: "Valleys", value: String(valleyCount) });
  if (internalEaveSeamCount != null) {
    rows.push({ label: "Internal eave seams", value: String(internalEaveSeamCount) });
  }
  if (skipReason) {
    rows.push({ label: "Skip reason", value: formatDiagnosticToken(skipReason) });
  } else if (failureReason) {
    rows.push({ label: "QA reason", value: formatDiagnosticToken(failureReason) });
  }
  return rows;
}

export function previewModeLabel(previewMode: GeometryPreviewMode): string {
  if (previewMode === "project_solved") return "Project Solved";
  return "Draft Project Solved";
}

export function objectSummary(
  object: ViewerSceneObject | null,
): Array<{ label: string; value: string }> {
  if (!object) {
    return [{ label: "Selection", value: "None" }];
  }

  if (object.type === "member_prism") {
    return [
      { label: "Object", value: object.id },
      { label: "Role", value: object.role },
      { label: "Length", value: `${object.lengthMm} mm` },
      {
        label: "Profile",
        value: `${object.profile.widthMm} x ${object.profile.depthMm} mm`,
      },
      { label: "Profile key", value: object.profile.profileKey ?? "None" },
      { label: "Shape", value: object.profile.shape },
      { label: "Render", value: object.renderMode.replace(/_/g, " ") },
      {
        label: "Outline",
        value: object.profile.sectionOutline?.length
          ? `Yes (${object.profile.sectionOutline.length} points)`
          : "No",
      },
      { label: "Start", value: formatPoint(object.centerline.start) },
      { label: "End", value: formatPoint(object.centerline.end) },
      { label: "Local X Axis", value: formatVector(object.localFrame.xAxis) },
      { label: "Local Y Axis", value: formatVector(object.localFrame.yAxis) },
      { label: "Local Z Axis", value: formatVector(object.localFrame.zAxis) },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "roof_plane") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: "roof plane" },
      { label: "Boundary", value: `${object.boundary.length} points` },
      { label: "Plane origin", value: formatPoint(object.plane.origin) },
      { label: "Plane normal", value: formatVector(object.plane.normal) },
      {
        label: "Fall vector",
        value: `${object.fallVector.x.toFixed(3)}, ${object.fallVector.y.toFixed(3)}, ${object.fallVector.z.toFixed(3)}`,
      },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "roof_cladding_panel") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: "roof cladding panel" },
      { label: "Material", value: object.material },
      { label: "Boundary", value: `${object.boundary.length} points` },
      { label: "Thickness", value: `${Math.round(object.thicknessMm)} mm` },
      {
        label: "Gutter embed",
        value: `${Math.round(Number(object.metadata?.gutterEmbedMm ?? 0))} mm`,
      },
      {
        label: "Panel area",
        value: `${Math.round(Number(object.metadata?.areaMm2 ?? 0)).toLocaleString()} mm²`,
      },
      { label: "Plane origin", value: formatPoint(object.plane.origin) },
      { label: "Plane normal", value: formatVector(object.plane.normal) },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "roof_flashing") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: "roof flashing" },
      { label: "Wings", value: `${object.wings.length}` },
      { label: "Thickness", value: `${Math.round(object.thicknessMm)} mm` },
      {
        label: "Girth",
        value: `${Math.round(Number(object.metadata?.girthMm ?? 0))} mm`,
      },
      {
        label: "Wing length",
        value: `${Math.round(Number(object.metadata?.wingLengthMm ?? 0))} mm`,
      },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }


  if (object.type === "reference_line") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: object.kind.replace(/_/g, " ") },
      { label: "Start", value: formatPoint(object.line.start) },
      { label: "End", value: formatPoint(object.line.end) },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "house_line") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: `house ${object.kind.replace(/_/g, " ")}` },
      ...houseRoofQaSummary(object.metadata),
      { label: "Start", value: formatPoint(object.line.start) },
      { label: "End", value: formatPoint(object.line.end) },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "house_linear_solid") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: `house solid ${object.kind.replace(/_/g, " ")}` },
      { label: "Start", value: formatPoint(object.centerline.start) },
      { label: "End", value: formatPoint(object.centerline.end) },
      { label: "Profile", value: `${Math.round(object.profileWidthMm)} x ${Math.round(object.profileDepthMm)} mm` },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "house_surface") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: `house ${object.kind.replace(/_/g, " ")}` },
      { label: "Boundary", value: `${object.boundary.length} points` },
      { label: "Plane origin", value: formatPoint(object.plane.origin) },
      { label: "Plane normal", value: formatVector(object.plane.normal) },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === "house_surface_solid") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: `house solid ${object.kind.replace(/_/g, " ")}` },
      ...houseRoofQaSummary(object.metadata),
      { label: "Boundary", value: `${object.boundary.length} points` },
      { label: "Thickness", value: `${Math.round(object.thicknessMm)} mm` },
      { label: "Plane origin", value: formatPoint(object.plane.origin) },
      { label: "Plane normal", value: formatVector(object.plane.normal) },
      { label: "Metadata", value: formatMetadata(object.metadata) },
    ];
  }

  return [
    { label: "Object", value: object.id },
    { label: "Type", value: object.kind.replace(/_/g, " ") },
    { label: "Boundary", value: `${object.boundary.length} points` },
    { label: "Metadata", value: formatMetadata(object.metadata) },
  ];
}
