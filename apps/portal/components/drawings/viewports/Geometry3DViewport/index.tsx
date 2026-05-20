"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  Point3,
  RenderMesh3D,
  ViewerSceneHouseLineObject,
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneHouseRoofMaterialObject,
  ViewerSceneHouseSurfaceObject,
  ViewerSceneHouseSurfaceSolidObject,
  ViewerSceneMemberPrismObject,
  ViewerSceneModel,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
  ViewerSceneReferencePlaneObject,
  ViewerSceneRoofCladdingPanelObject,
  ViewerSceneRoofFlashingObject,
  ViewerSceneRoofPlaneObject,
} from "@sp/geometry";
import type {
  GeometryPreviewMode,
  GeometryPreviewState,
} from "@/lib/drawings/geometry/buildWorkbenchGeometryPreview";
import type { DrawingWorkbenchVisibilityState } from "@/lib/drawings/state/drawingWorkbenchUiState";
import type { ObjectWorkbenchDisplayFamily } from "@/lib/drawings/state/objectWorkbenchViewportTypes";
import { blockNativeSelectionEvent } from "../nativeSelection";
import styles from "./Geometry3DViewport.module.css";
import type { SceneBounds } from "./geometry/sceneBoundsTypes";
import { sceneForDisplayMode } from "./geometry/sceneFilters";
import {
  MIN_RENDERABLE_POLYGON_AREA_MM2,
  allSceneBoundsFinite,
  boundingSize,
  centroid,
  isFinitePoint,
  isRenderableLine,
  isRenderablePolygon,
  isRenderableRenderMesh,
  linePoints,
  midpoint,
  polygonArea3D,
  renderMeshPoints,
  uniquePointCount,
} from "./geometry/scenePointHelpers";
import {
  buildPresetCameraState,
  cameraStatesEqual,
  clampCameraStateToScene,
  defaultCameraStateForScene,
  directionForPreset,
  directionFromCameraState,
  fitDistanceForSize,
  formatCameraFocusMode,
  formatCameraPreset,
  formatPoint,
  formatVector,
  offsetPoint,
  pointDistance,
  pointToVector,
  pointsRoughlyEqual,
  positionFromDirection,
  vectorToPoint,
  type Geometry3DViewportState,
  type GeometryCameraFocusMode,
  type GeometryCameraPreset,
  type GeometryCameraState,
  type GeometryViewportCamera,
} from "./interaction/cameraState";
export type { Geometry3DViewportState } from "./interaction/cameraState";
import {
  buildDatumOriginAnchor,
  buildMeasurementAnchor,
  defaultAnchorTypeForObject,
  focusPointForObject,
  formatAnchorType,
  formatDistanceMm,
  measurementDelta,
  measurementDistance,
  measurementPlanDistance,
  pointsForObject,
  resolveAnchorPoint,
  supportsEndpointAnchors,
  type MeasurementAnchor,
  type MeasurementAnchorType,
  type MeasurementState,
} from "./interaction/measurement";
import {
  collectHouseOpeningViewportDiagnostics,
  formatDiagnosticToken,
  formatMetadata,
  houseRoofQaSummary,
  metadataNumber,
  metadataText,
  objectSummary,
  previewModeLabel,
  rectContains,
  rectDiagnostics,
  sceneMetadataNumber,
  sceneMetadataString,
  type HouseOpeningViewportDiagnostics,
  type HouseRoofViewportDiagnostics,
  type ViewportRectDiagnostics,
} from "./interaction/diagnostics";

const ORBIT_MOUSE_DISABLED = -1 as THREE.MOUSE;
const ORBIT_ZOOM_SPEED = 2.85;

type SectionCutState = {
  enabled: boolean;
  positionMm: number;
};

type OverlayVisibility = {
  datumAxes: boolean;
  roofFallVectors: boolean;
  selectedMemberAxes: boolean;
};

const LAYER_COLORS: Record<string, string> = {
  house: "#b0b4b9",
  posts: "#7b6347",
  beams: "#4f5965",
  support_beams: "#7a838e",
  rafters: "#96979b",
  joiners: "#8d7b56",
  gutters: "#437da8",
  roof_cladding: "#d9c77b",
  roof_flashings: "#d8d2bd",
  house_roof_materials: "#f0f2f3",
  roof_planes: "#d4b35a",
  attachment_edge: "#bb4b4b",
};

const POLYGON_TRIANGULATION_EPSILON_MM = 1e-6;

function resetRendererState(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  renderer.localClippingEnabled = false;
  renderer.setScissorTest(false);
  renderer.clearDepth();
  renderer.resetState();
  (renderer as { renderLists?: { dispose?: () => void } }).renderLists?.dispose?.();
}

function disposeRenderer(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  resetRendererState(renderer);
  renderer.dispose();
}

function collectScenePoints(scene: ViewerSceneModel): Point3[] {
  return scene.layers.flatMap((layer) =>
    layer.objects.flatMap((object) => {
      if (object.type === "member_prism") return linePoints(object.centerline);
      if (object.type === "roof_plane" || object.type === "roof_cladding_panel")
        return object.boundary.filter(isFinitePoint);
      if (object.type === "roof_flashing")
        return object.wings.flatMap((wing) =>
          wing.boundary.filter(isFinitePoint),
        );
      if (object.type === "house_roof_material")
        return object.lines.flatMap((line) => linePoints(line)).filter(isFinitePoint);
      if (object.type === "reference_line") {
        return linePoints(object.line).filter(isFinitePoint);
      }
      if (object.type === "house_line") {
        return isRenderableLine(object.line) ? linePoints(object.line) : [];
      }
      if (object.type === "house_surface") {
        return isRenderablePolygon(object.boundary) ? object.boundary : [];
      }
      if (object.type === "house_surface_solid") {
        const meshPoints = renderMeshPoints(object.renderMesh);
        if (meshPoints.length) return meshPoints;
        return isRenderableSlab(
          object.boundary,
          object.plane,
          object.thicknessMm,
        )
          ? object.boundary
          : [];
      }
      if (object.type === "house_linear_solid") {
        const meshPoints = renderMeshPoints(object.renderMesh);
        if (meshPoints.length) return meshPoints;
        return buildLinearSolidPlacement(object)
          ? linePoints(object.centerline)
          : [];
      }
      return object.boundary.filter(isFinitePoint);
    }),
  );
}

function computeSceneBounds(scene: ViewerSceneModel): SceneBounds {
  const points = collectScenePoints(scene);
  if (points.length === 0) {
    return {
      min: { x: -500, y: -500, z: 0 },
      max: { x: 500, y: 500, z: 1000 },
      center: { x: 0, y: 0, z: 500 },
      size: 2000,
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const min = { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) };
  const max = { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) };
  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };

  return {
    min,
    max,
    center,
    size: Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1000),
  };
}

function collectHouseRoofViewportDiagnostics(
  scene: ViewerSceneModel | null,
): HouseRoofViewportDiagnostics {
  if (!scene) {
    return {
      qaStatus: "",
      qaFailureReason: "",
      topologyFinalFaceCount: 0,
      topologyValleyCount: 0,
      topologyDisconnectedSourceFaceCount: 0,
      topologyInternalEaveHeightSegmentCount: 0,
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
    topologyFinalFaceCount:
      sceneMetadataNumber(scene, "houseRoofTopologyFinalFaceCount") ?? 0,
    topologyValleyCount:
      sceneMetadataNumber(scene, "houseRoofTopologyValleyCount") ?? 0,
    topologyDisconnectedSourceFaceCount:
      sceneMetadataNumber(scene, "houseRoofTopologyDisconnectedSourceFaceCount") ?? 0,
    topologyInternalEaveHeightSegmentCount:
      sceneMetadataNumber(scene, "houseRoofTopologyInternalEaveHeightSegmentCount") ?? 0,
    expectedSolidCount,
    renderedSolidCount,
    skippedSolidCount,
  };
}

function buildLineGeometry(points: Point3[]): THREE.BufferGeometry {
  const finitePoints = points.filter(isFinitePoint);
  if (finitePoints.length < 2) return new THREE.BufferGeometry();
  return new THREE.BufferGeometry().setFromPoints(
    finitePoints.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
  );
}

function buildPolygonGeometry(points: Point3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const frame = buildPolygonFrame(points);
  const prepared = frame ? prepareSlabBoundary(points, frame) : null;
  const triangles = prepared ? triangulateProjectedPolygon(prepared) : null;
  if (!prepared || !triangles) {
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    return geometry;
  }

  const positions: number[] = [];
  const vertices = prepared.boundary.map(vectorFromPoint);
  for (const [a, b, c] of triangles) {
    pushTriangle(positions, vertices[a]!, vertices[b]!, vertices[c]!);
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function emptyGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  return geometry;
}

export function buildRenderMeshGeometry(mesh: RenderMesh3D | undefined): THREE.BufferGeometry | null {
  if (!isRenderableRenderMesh(mesh)) return null;

  const positions: number[] = [];
  const vertices = mesh.vertices.map(vectorFromPoint);
  for (const [a, b, c] of mesh.faces) {
    if (a === b || b === c || a === c) continue;
    pushTriangle(positions, vertices[a]!, vertices[b]!, vertices[c]!);
  }

  if (!positions.length || !positions.every(Number.isFinite)) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function vectorFromPoint(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function offsetPolygon(points: Point3[], normal: Point3, distanceMm: number): Point3[] {
  return points.map((point) => ({
    x: point.x + normal.x * distanceMm,
    y: point.y + normal.y * distanceMm,
    z: point.z + normal.z * distanceMm,
  }));
}

function metadataStringValue(
  metadata: ViewerSceneHouseSurfaceSolidObject["metadata"] | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function metadataNumberValue(
  metadata: ViewerSceneHouseSurfaceSolidObject["metadata"] | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type DeckMaterialKey = "timber_decking" | "composite" | "concrete";

function resolveDeckMaterial(
  object: ViewerSceneHouseSurfaceSolidObject,
): DeckMaterialKey {
  const material = metadataStringValue(object.metadata, "deckSurfaceMaterial");
  if (material === "composite" || material === "concrete") return material;
  return "timber_decking";
}

function resolveDeckPalette(material: DeckMaterialKey) {
  if (material === "composite") {
    return {
      topColor: "#a8b095",
      baseColor: "#7f8672",
      grooveColor: "#68705f",
      outlineColor: "#56604f",
      selectedColor: "#2f6f96",
    };
  }
  if (material === "concrete") {
    return {
      topColor: "#b7b9bc",
      baseColor: "#94979b",
      grooveColor: "#8e9296",
      outlineColor: "#6e7276",
      selectedColor: "#2f6f96",
    };
  }
  return {
    topColor: "#c8bc7b",
    baseColor: "#9c8e58",
    grooveColor: "#8a7b45",
    outlineColor: "#776a3a",
    selectedColor: "#2f6f96",
  };
}

function buildDeckVisualFrame(
  object: ViewerSceneHouseSurfaceSolidObject,
): {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  widthDir: THREE.Vector3;
  depthDir: THREE.Vector3;
  minWidth: number;
  maxWidth: number;
  minDepth: number;
  maxDepth: number;
} | null {
  if (object.boundary.length < 4) return null;
  const widthMm = metadataNumberValue(object.metadata, "deckPresetRectWidthMm");
  if (widthMm === null || widthMm <= 0) return null;
  const normal = normalizeNonZeroVector(vectorFromPoint(object.plane.normal));
  if (!normal) return null;
  const centerPoint = centroid(object.boundary);
  const center = vectorFromPoint(centerPoint);
  const edges = object.boundary.map((point, index) => {
    const next = object.boundary[(index + 1) % object.boundary.length]!;
    const vector = new THREE.Vector3(next.x - point.x, next.y - point.y, next.z - point.z);
    return {
      length: vector.length(),
      direction: normalizeNonZeroVector(vector),
    };
  });
  const widthEdge = edges
    .filter((edge): edge is { length: number; direction: THREE.Vector3 } => Boolean(edge.direction))
    .sort((left, right) => Math.abs(left.length - widthMm) - Math.abs(right.length - widthMm))[0];
  if (!widthEdge) return null;
  const widthDir = widthEdge.direction;
  const depthDir = normalizeNonZeroVector(new THREE.Vector3().crossVectors(normal, widthDir));
  if (!depthDir) return null;

  const projected = object.boundary.map((point) => {
    const relative = new THREE.Vector3(point.x - center.x, point.y - center.y, point.z - center.z);
    return {
      width: relative.dot(widthDir),
      depth: relative.dot(depthDir),
    };
  });
  return {
    center,
    normal,
    widthDir,
    depthDir,
    minWidth: Math.min(...projected.map((point) => point.width)),
    maxWidth: Math.max(...projected.map((point) => point.width)),
    minDepth: Math.min(...projected.map((point) => point.depth)),
    maxDepth: Math.max(...projected.map((point) => point.depth)),
  };
}

function buildDeckGrooveLines(
  object: ViewerSceneHouseSurfaceSolidObject,
): Array<{ id: string; start: Point3; end: Point3 }> {
  const material = resolveDeckMaterial(object);
  if (material === "concrete") return [];
  const frame = buildDeckVisualFrame(object);
  if (!frame) return [];
  const spacingMm = material === "composite" ? 160 : 140;
  const usableDepth = frame.maxDepth - frame.minDepth;
  if (usableDepth <= spacingMm * 1.25) return [];
  const insetMm = 24;
  const lines: Array<{ id: string; start: Point3; end: Point3 }> = [];
  let index = 0;
  for (
    let depth = frame.minDepth + spacingMm;
    depth <= frame.maxDepth - spacingMm * 0.5;
    depth += spacingMm
  ) {
    index += 1;
    const start = frame.center
      .clone()
      .addScaledVector(frame.widthDir, frame.minWidth + insetMm)
      .addScaledVector(frame.depthDir, depth)
      .addScaledVector(frame.normal, 2);
    const end = frame.center
      .clone()
      .addScaledVector(frame.widthDir, frame.maxWidth - insetMm)
      .addScaledVector(frame.depthDir, depth)
      .addScaledVector(frame.normal, 2);
    lines.push({
      id: `${object.id}-deck-groove-${index}`,
      start: { x: start.x, y: start.y, z: start.z },
      end: { x: end.x, y: end.y, z: end.z },
    });
  }
  return lines;
}

function normalizeNonZeroVector(vector: THREE.Vector3): THREE.Vector3 | null {
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) return null;
  if (vector.lengthSq() <= 1e-12) return null;
  return vector.clone().normalize();
}

function buildPlaneFrame(
  plane: ViewerSceneRoofCladdingPanelObject["plane"],
): {
  origin: THREE.Vector3;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  normal: THREE.Vector3;
} | null {
  if (!isFinitePoint(plane.origin)) return null;
  const origin = vectorFromPoint(plane.origin);
  const xAxis = normalizeNonZeroVector(vectorFromPoint(plane.xAxis));
  const rawYAxis = normalizeNonZeroVector(vectorFromPoint(plane.yAxis));
  if (!xAxis || !rawYAxis) return null;

  const yAxis = rawYAxis
    .clone()
    .addScaledVector(xAxis, -rawYAxis.dot(xAxis));
  if (yAxis.lengthSq() <= 1e-12) return null;
  yAxis.normalize();

  const normal = new THREE.Vector3().crossVectors(xAxis, yAxis);
  if (normal.lengthSq() <= 1e-12) return null;
  normal.normalize();

  const preferredNormal = normalizeNonZeroVector(vectorFromPoint(plane.normal));
  if (!preferredNormal) return null;
  if (normal.dot(preferredNormal) < 0) {
    yAxis.negate();
    normal.negate();
  }

  return { origin, xAxis, yAxis, normal };
}

function buildPolygonFrame(
  points: Point3[],
): NonNullable<ReturnType<typeof buildPlaneFrame>> | null {
  const finitePoints = points.filter(isFinitePoint);
  if (finitePoints.length < 3) return null;

  const origin = vectorFromPoint(finitePoints[0]!);
  const normal = new THREE.Vector3();
  for (let index = 0; index < finitePoints.length; index += 1) {
    const current = finitePoints[index]!;
    const next = finitePoints[(index + 1) % finitePoints.length]!;
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  if (!normalizeNonZeroVector(normal)) return null;
  normal.normalize();

  const firstAxis = finitePoints
    .map((candidate) => vectorFromPoint(candidate).sub(origin))
    .find((candidate) => candidate.lengthSq() > 1e-6);
  if (!firstAxis) return null;
  const xAxis = firstAxis.normalize();
  const yAxis = new THREE.Vector3().crossVectors(normal, xAxis);
  if (!normalizeNonZeroVector(yAxis)) return null;
  yAxis.normalize();

  return { origin, xAxis, yAxis, normal };
}

function signedProjectedPolygonArea(points: THREE.Vector2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function sameProjectedPoint(a: THREE.Vector2, b: THREE.Vector2): boolean {
  return a.distanceToSquared(b) <= 1e-6;
}

type ProjectedPolygonBoundary = {
  boundary: Point3[];
  projected: THREE.Vector2[];
  area: number;
};

function prepareSlabBoundary(
  points: Point3[],
  frame: NonNullable<ReturnType<typeof buildPlaneFrame>>,
): ProjectedPolygonBoundary | null {
  if (!isRenderablePolygon(points)) return null;

  const projected = points.map((point) => {
    const delta = vectorFromPoint(point).sub(frame.origin);
    return {
      point,
      projected: new THREE.Vector2(
        delta.dot(frame.xAxis),
        delta.dot(frame.yAxis),
      ),
    };
  });

  const cleaned: typeof projected = [];
  for (const candidate of projected) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || !sameProjectedPoint(previous.projected, candidate.projected)) {
      cleaned.push(candidate);
    }
  }

  if (
    cleaned.length > 2 &&
    sameProjectedPoint(cleaned[0]!.projected, cleaned[cleaned.length - 1]!.projected)
  ) {
    cleaned.pop();
  }

  let removedCollinear = true;
  while (removedCollinear && cleaned.length > 3) {
    removedCollinear = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]!;
      const current = cleaned[index]!;
      const next = cleaned[(index + 1) % cleaned.length]!;
      const first = current.projected.clone().sub(previous.projected);
      const second = next.projected.clone().sub(current.projected);
      const cross = first.x * second.y - first.y * second.x;
      const dot = first.dot(second);
      if (
        Math.abs(cross) <= POLYGON_TRIANGULATION_EPSILON_MM &&
        dot >= -POLYGON_TRIANGULATION_EPSILON_MM
      ) {
        cleaned.splice(index, 1);
        removedCollinear = true;
        break;
      }
    }
  }

  const unique = new Set(
    cleaned.map(
      (candidate) =>
        `${candidate.projected.x.toFixed(6)},${candidate.projected.y.toFixed(6)}`,
    ),
  );
  if (unique.size < 3) return null;

  const area = signedProjectedPolygonArea(
    cleaned.map((candidate) => candidate.projected),
  );
  if (!Number.isFinite(area) || Math.abs(area) <= MIN_RENDERABLE_POLYGON_AREA_MM2) {
    return null;
  }

  const boundary = cleaned.map((candidate) => candidate.point);
  const projectedBoundary = cleaned.map((candidate) => candidate.projected);
  return {
    boundary: area > 0 ? boundary : [...boundary].reverse(),
    projected: area > 0 ? projectedBoundary : [...projectedBoundary].reverse(),
    area: Math.abs(area),
  };
}

function projectedCross(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function projectedTriangleArea(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): number {
  return Math.abs(projectedCross(a, b, c)) / 2;
}

function pointOnProjectedSegment(candidate: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2): boolean {
  const cross = projectedCross(start, end, candidate);
  if (Math.abs(cross) > POLYGON_TRIANGULATION_EPSILON_MM) return false;
  const dot = candidate.clone().sub(start).dot(end.clone().sub(start));
  if (dot < -POLYGON_TRIANGULATION_EPSILON_MM) return false;
  return dot <= start.distanceToSquared(end) + POLYGON_TRIANGULATION_EPSILON_MM;
}

function projectedSegmentsIntersect(
  aStart: THREE.Vector2,
  aEnd: THREE.Vector2,
  bStart: THREE.Vector2,
  bEnd: THREE.Vector2,
): boolean {
  const a1 = projectedCross(aStart, aEnd, bStart);
  const a2 = projectedCross(aStart, aEnd, bEnd);
  const b1 = projectedCross(bStart, bEnd, aStart);
  const b2 = projectedCross(bStart, bEnd, aEnd);

  if (
    Math.abs(a1) <= POLYGON_TRIANGULATION_EPSILON_MM &&
    pointOnProjectedSegment(bStart, aStart, aEnd)
  ) {
    return true;
  }
  if (
    Math.abs(a2) <= POLYGON_TRIANGULATION_EPSILON_MM &&
    pointOnProjectedSegment(bEnd, aStart, aEnd)
  ) {
    return true;
  }
  if (
    Math.abs(b1) <= POLYGON_TRIANGULATION_EPSILON_MM &&
    pointOnProjectedSegment(aStart, bStart, bEnd)
  ) {
    return true;
  }
  if (
    Math.abs(b2) <= POLYGON_TRIANGULATION_EPSILON_MM &&
    pointOnProjectedSegment(aEnd, bStart, bEnd)
  ) {
    return true;
  }

  return a1 * a2 < 0 && b1 * b2 < 0;
}

function projectedPolygonSelfIntersects(points: THREE.Vector2[]): boolean {
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % points.length;
    for (let secondIndex = firstIndex + 1; secondIndex < points.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % points.length;
      if (
        firstIndex === secondIndex ||
        firstNext === secondIndex ||
        secondNext === firstIndex
      ) {
        continue;
      }
      if (
        projectedSegmentsIntersect(
          points[firstIndex]!,
          points[firstNext]!,
          points[secondIndex]!,
          points[secondNext]!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function pointInProjectedTriangle(
  candidate: THREE.Vector2,
  a: THREE.Vector2,
  b: THREE.Vector2,
  c: THREE.Vector2,
): boolean {
  const ab = projectedCross(a, b, candidate);
  const bc = projectedCross(b, c, candidate);
  const ca = projectedCross(c, a, candidate);
  return (
    ab >= -POLYGON_TRIANGULATION_EPSILON_MM &&
    bc >= -POLYGON_TRIANGULATION_EPSILON_MM &&
    ca >= -POLYGON_TRIANGULATION_EPSILON_MM
  );
}

function pointInProjectedPolygon(candidate: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
  if (
    polygon.some((start, index) =>
      pointOnProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
    )
  ) {
    return true;
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.y > candidate.y !== previous.y > candidate.y &&
      candidate.x < ((previous.x - current.x) * (candidate.y - current.y)) / (previous.y - current.y || 1) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function projectedTriangleCentroid(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): THREE.Vector2 {
  return new THREE.Vector2((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
}

function triangulateProjectedPolygon(prepared: ProjectedPolygonBoundary): Array<[number, number, number]> | null {
  const points = prepared.projected;
  if (points.length < 3 || projectedPolygonSelfIntersects(points)) return null;

  const remaining = points.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  let guard = 0;

  while (remaining.length > 3 && guard < points.length * points.length) {
    guard += 1;
    let clipped = false;

    for (let remainingIndex = 0; remainingIndex < remaining.length; remainingIndex += 1) {
      const previousIndex = remaining[(remainingIndex - 1 + remaining.length) % remaining.length]!;
      const currentIndex = remaining[remainingIndex]!;
      const nextIndex = remaining[(remainingIndex + 1) % remaining.length]!;
      const previous = points[previousIndex]!;
      const current = points[currentIndex]!;
      const next = points[nextIndex]!;

      if (projectedCross(previous, current, next) <= POLYGON_TRIANGULATION_EPSILON_MM) continue;
      if (
        remaining.some((candidateIndex) => {
          if (candidateIndex === previousIndex || candidateIndex === currentIndex || candidateIndex === nextIndex) return false;
          return pointInProjectedTriangle(points[candidateIndex]!, previous, current, next);
        })
      ) {
        continue;
      }

      const centroid = projectedTriangleCentroid(previous, current, next);
      if (!pointInProjectedPolygon(centroid, points)) continue;

      triangles.push([previousIndex, currentIndex, nextIndex]);
      remaining.splice(remainingIndex, 1);
      clipped = true;
      break;
    }

    if (!clipped) return null;
  }

  if (remaining.length === 3) {
    const [a, b, c] = remaining as [number, number, number];
    if (projectedTriangleArea(points[a]!, points[b]!, points[c]!) <= MIN_RENDERABLE_POLYGON_AREA_MM2) return null;
    const centroid = projectedTriangleCentroid(points[a]!, points[b]!, points[c]!);
    if (!pointInProjectedPolygon(centroid, points)) return null;
    triangles.push([a, b, c]);
  }

  const triangulatedArea = triangles.reduce(
    (sum, [a, b, c]) => sum + projectedTriangleArea(points[a]!, points[b]!, points[c]!),
    0,
  );
  const areaTolerance = Math.max(1, prepared.area * 0.001);
  if (Math.abs(triangulatedArea - prepared.area) > areaTolerance) return null;

  return triangles;
}

function pushTriangle(
  positions: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

function buildLinearSolidPlacement(object: ViewerSceneHouseLinearSolidObject): {
  matrix: THREE.Matrix4;
  lengthMm: number;
  profileWidthMm: number;
  profileDepthMm: number;
} | null {
  if (!isRenderableLine(object.centerline)) return null;
  if (
    !Number.isFinite(object.profileWidthMm) ||
    !Number.isFinite(object.profileDepthMm) ||
    object.profileWidthMm <= 0 ||
    object.profileDepthMm <= 0
  ) {
    return null;
  }

  const start = vectorFromPoint(object.centerline.start);
  const end = vectorFromPoint(object.centerline.end);
  const center = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const lengthMm = direction.length();
  if (!Number.isFinite(lengthMm) || lengthMm <= 0.001) return null;

  const xAxis = normalizeNonZeroVector(direction);
  const rawYAxis = normalizeNonZeroVector(vectorFromPoint(object.localFrame.yAxis));
  const rawZAxis = normalizeNonZeroVector(vectorFromPoint(object.localFrame.zAxis));
  const rawFrameXAxis = normalizeNonZeroVector(vectorFromPoint(object.localFrame.xAxis));
  if (!xAxis || !rawYAxis || !rawZAxis || !rawFrameXAxis) return null;

  let yAxis = rawYAxis
    .clone()
    .addScaledVector(xAxis, -rawYAxis.dot(xAxis));
  if (yAxis.lengthSq() <= 1e-12) {
    yAxis = new THREE.Vector3().crossVectors(rawZAxis, xAxis);
  }
  if (yAxis.lengthSq() <= 1e-12) return null;
  yAxis.normalize();

  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  if (zAxis.lengthSq() <= 1e-12) return null;
  zAxis.normalize();
  if (zAxis.dot(rawZAxis) < 0) {
    yAxis.negate();
    zAxis.negate();
  }

  if (
    Math.abs(xAxis.dot(yAxis)) > 0.001 ||
    Math.abs(xAxis.dot(zAxis)) > 0.001 ||
    Math.abs(yAxis.dot(zAxis)) > 0.001
  ) {
    return null;
  }

  const matrix = new THREE.Matrix4();
  matrix.makeBasis(xAxis, yAxis, zAxis);
  matrix.setPosition(center.x, center.y, center.z);
  return {
    matrix,
    lengthMm,
    profileWidthMm: Math.max(object.profileWidthMm, 1),
    profileDepthMm: Math.max(object.profileDepthMm, 1),
  };
}

function isRenderableSlab(
  points: Point3[],
  plane: ViewerSceneRoofCladdingPanelObject["plane"],
  thicknessMm: number,
): boolean {
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) return false;
  const frame = buildPlaneFrame(plane);
  const prepared = frame ? prepareSlabBoundary(points, frame) : null;
  return Boolean(prepared && triangulateProjectedPolygon(prepared));
}

export function buildPolygonSlabGeometry(
  points: Point3[],
  plane: ViewerSceneRoofCladdingPanelObject["plane"],
  thicknessMm: number,
): THREE.BufferGeometry {
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) {
    return emptyGeometry();
  }

  const frame = buildPlaneFrame(plane);
  if (!frame) return emptyGeometry();

  const prepared = prepareSlabBoundary(points, frame);
  if (!prepared) return emptyGeometry();
  const triangles = triangulateProjectedPolygon(prepared);
  if (!triangles) return emptyGeometry();

  const depth = Math.max(thicknessMm, 1);
  const halfDepth = depth / 2;
  const offset = frame.normal.clone().multiplyScalar(halfDepth);
  const front = prepared.boundary.map((point) =>
    vectorFromPoint(point).add(offset),
  );
  const back = prepared.boundary.map((point) =>
    vectorFromPoint(point).sub(offset),
  );

  const positions: number[] = [];
  for (const [a, b, c] of triangles) {
    pushTriangle(positions, front[a]!, front[b]!, front[c]!);
    pushTriangle(positions, back[a]!, back[c]!, back[b]!);
  }

  for (let index = 0; index < prepared.boundary.length; index += 1) {
    const next = (index + 1) % prepared.boundary.length;
    pushTriangle(positions, front[index]!, back[index]!, back[next]!);
    pushTriangle(positions, front[index]!, back[next]!, front[next]!);
  }

  if (!positions.length || !positions.every(Number.isFinite)) {
    return emptyGeometry();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildProfileExtrusionGeometry(
  profile: ViewerSceneMemberPrismObject["profile"],
  lengthMm: number,
  options?: { includeVoids?: boolean },
): THREE.BufferGeometry {
  const outline = profile.sectionOutline ?? [];
  if (outline.length < 3) {
    return new THREE.BoxGeometry(
      Math.max(lengthMm, 1),
      profile.widthMm,
      profile.depthMm,
    );
  }

  const shape = new THREE.Shape(
    outline.map((point) => new THREE.Vector2(point.x, point.y)),
  );
  if (options?.includeVoids ?? true) {
    for (const voidBoundary of profile.sectionVoids ?? []) {
      if (voidBoundary.length < 3) continue;
      shape.holes.push(
        new THREE.Path(
          voidBoundary.map((point) => new THREE.Vector2(point.x, point.y)),
        ),
      );
    }
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(lengthMm, 1),
    steps: 1,
    bevelEnabled: false,
  });
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getX(index);
    const z = position.getY(index);
    const x = position.getZ(index) - Math.max(lengthMm, 1) / 2;
    position.setXYZ(index, x, y, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildRectangularCapGeometry(
  lengthMm: number,
  widthMm: number,
  depthMm: number,
): THREE.BufferGeometry {
  return new THREE.BoxGeometry(
    Math.max(lengthMm, 1),
    Math.max(widthMm, 1),
    Math.max(depthMm, 1),
  );
}

type LocalClipPlane = {
  normal: THREE.Vector3;
  offsetMm: number;
  keepSide: "negative" | "positive";
};

const CLIP_EPSILON_MM = 1e-5;

function signedDistanceToClipPlane(
  point: THREE.Vector3,
  plane: LocalClipPlane,
): number {
  return plane.normal.dot(point) - plane.offsetMm;
}

function pointIsInsideClipPlane(
  point: THREE.Vector3,
  plane: LocalClipPlane,
): boolean {
  const distance = signedDistanceToClipPlane(point, plane);
  return plane.keepSide === "negative"
    ? distance <= CLIP_EPSILON_MM
    : distance >= -CLIP_EPSILON_MM;
}

function clipFaceToPlane(
  face: THREE.Vector3[],
  plane: LocalClipPlane,
): { face: THREE.Vector3[]; intersections: THREE.Vector3[] } {
  if (face.length < 3) {
    return { face: [], intersections: [] };
  }

  const clipped: THREE.Vector3[] = [];
  const intersections: THREE.Vector3[] = [];
  for (let index = 0; index < face.length; index += 1) {
    const current = face[index]!;
    const next = face[(index + 1) % face.length]!;
    const currentInside = pointIsInsideClipPlane(current, plane);
    const nextInside = pointIsInsideClipPlane(next, plane);

    if (currentInside && nextInside) {
      clipped.push(next.clone());
      continue;
    }

    const currentDistance = signedDistanceToClipPlane(current, plane);
    const nextDistance = signedDistanceToClipPlane(next, plane);
    const denominator = currentDistance - nextDistance;
    const intersection =
      Math.abs(denominator) > CLIP_EPSILON_MM
        ? current.clone().lerp(next, currentDistance / denominator)
        : current.clone();

    if (currentInside && !nextInside) {
      clipped.push(intersection);
      intersections.push(intersection.clone());
    } else if (!currentInside && nextInside) {
      clipped.push(intersection.clone(), next.clone());
      intersections.push(intersection);
    }
  }

  return { face: clipped, intersections };
}

function dedupeClipPoints(points: THREE.Vector3[]): THREE.Vector3[] {
  const unique: THREE.Vector3[] = [];
  for (const point of points) {
    if (!unique.some((candidate) => candidate.distanceTo(point) <= 1e-4)) {
      unique.push(point);
    }
  }
  return unique;
}

function sortCapFacePoints(
  points: THREE.Vector3[],
  plane: LocalClipPlane,
): THREE.Vector3[] {
  const center = points
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
  const normal = plane.normal.clone().normalize();
  const reference =
    Math.abs(normal.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const uAxis = reference
    .sub(normal.clone().multiplyScalar(reference.dot(normal)))
    .normalize();
  const vAxis = normal.clone().cross(uAxis).normalize();
  const sorted = [...points].sort((a, b) => {
    const aDelta = a.clone().sub(center);
    const bDelta = b.clone().sub(center);
    return (
      Math.atan2(aDelta.dot(vAxis), aDelta.dot(uAxis)) -
      Math.atan2(bDelta.dot(vAxis), bDelta.dot(uAxis))
    );
  });

  return plane.keepSide === "negative" ? sorted : sorted.reverse();
}

function localClipPlaneFromEndCut(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
  xAxis: THREE.Vector3,
  endCut: NonNullable<ViewerSceneMemberPrismObject["endCuts"]>[number],
): LocalClipPlane | null {
  const worldNormal = new THREE.Vector3(
    endCut.plane.normal.x,
    endCut.plane.normal.y,
    endCut.plane.normal.z,
  ).normalize();
  const yAxis = new THREE.Vector3(
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
  ).normalize();
  const zAxis = new THREE.Vector3(
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
  ).normalize();
  const localNormal = new THREE.Vector3(
    worldNormal.dot(xAxis),
    worldNormal.dot(yAxis),
    worldNormal.dot(zAxis),
  );
  const localNormalLength = localNormal.length();
  if (localNormalLength <= CLIP_EPSILON_MM) {
    return null;
  }
  const midpointVector = new THREE.Vector3(midpoint.x, midpoint.y, midpoint.z);
  const localOffsetMm = endCut.plane.offsetMm - worldNormal.dot(midpointVector);
  return {
    normal: localNormal.multiplyScalar(1 / localNormalLength),
    offsetMm: localOffsetMm / localNormalLength,
    keepSide: endCut.plane.keepSide,
  };
}

function clipFacesToEndCuts(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
  xAxis: THREE.Vector3,
  faces: THREE.Vector3[][],
): THREE.Vector3[][] {
  const endCuts = object.endCuts ?? [];
  const clipPlanes = endCuts
    .map((cut) => localClipPlaneFromEndCut(object, midpoint, xAxis, cut))
    .filter((plane): plane is LocalClipPlane => plane !== null);
  let clippedFaces = faces;

  for (const plane of clipPlanes) {
    const nextFaces: THREE.Vector3[][] = [];
    const capPoints: THREE.Vector3[] = [];
    for (const face of clippedFaces) {
      const clipped = clipFaceToPlane(face, plane);
      if (clipped.face.length >= 3) {
        nextFaces.push(clipped.face);
      }
      capPoints.push(...clipped.intersections);
    }
    const capFace = dedupeClipPoints(capPoints);
    if (capFace.length >= 3) {
      nextFaces.push(sortCapFacePoints(capFace, plane));
    }
    clippedFaces = nextFaces;
  }

  return clippedFaces;
}

function geometryFromFaces(faces: THREE.Vector3[][]): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const face of faces) {
    for (let index = 1; index < face.length - 1; index += 1) {
      const a = face[0]!;
      const b = face[index]!;
      const c = face[index + 1]!;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function memberLocalXAxis(
  object: ViewerSceneMemberPrismObject,
): THREE.Vector3 {
  return new THREE.Vector3(
    object.centerline.end.x - object.centerline.start.x,
    object.centerline.end.y - object.centerline.start.y,
    object.centerline.end.z - object.centerline.start.z,
  ).normalize();
}

function endCutExtensions(
  object: ViewerSceneMemberPrismObject,
): { startExtensionMm: number; endExtensionMm: number } {
  const endCuts = object.endCuts ?? [];
  return {
    startExtensionMm: Math.max(
      0,
      ...endCuts
        .filter((cut) => cut.end === "start")
        .map((cut) => cut.preClipExtensionMm),
    ),
    endExtensionMm: Math.max(
      0,
      ...endCuts
        .filter((cut) => cut.end === "end")
        .map((cut) => cut.preClipExtensionMm),
    ),
  };
}

export function buildClippedBoxGeometry(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
): THREE.BufferGeometry | null {
  const endCuts = object.endCuts ?? [];
  if (endCuts.length === 0) {
    return null;
  }

  const xAxis = memberLocalXAxis(object);
  const { startExtensionMm, endExtensionMm } = endCutExtensions(object);
  const halfLength = Math.max(object.lengthMm, 1) / 2;
  const halfWidth = Math.max(object.profile.widthMm, 1) / 2;
  const halfDepth = Math.max(object.profile.depthMm, 1) / 2;
  const x0 = -halfLength - startExtensionMm;
  const x1 = halfLength + endExtensionMm;
  const y0 = -halfWidth;
  const y1 = halfWidth;
  const z0 = -halfDepth;
  const z1 = halfDepth;
  const faces: THREE.Vector3[][] = [
    [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, y1, z0),
      new THREE.Vector3(x0, y1, z1),
      new THREE.Vector3(x0, y0, z1),
    ],
    [
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x1, y1, z0),
    ],
    [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x0, y1, z0),
    ],
    [
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(x0, y1, z1),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x1, y0, z1),
    ],
    [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(x1, y0, z0),
    ],
    [
      new THREE.Vector3(x0, y1, z0),
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x0, y1, z1),
    ],
  ];

  return geometryFromFaces(clipFacesToEndCuts(object, midpoint, xAxis, faces));
}

export function buildClippedProfileExtrusionGeometry(
  object: ViewerSceneMemberPrismObject,
  midpoint: Point3,
): THREE.BufferGeometry | null {
  const endCuts = object.endCuts ?? [];
  const outline = object.profile.sectionOutline ?? [];
  if (
    endCuts.length === 0 ||
    outline.length < 3 ||
    (object.profile.sectionVoids?.length ?? 0) > 0
  ) {
    return null;
  }

  const xAxis = memberLocalXAxis(object);
  const { startExtensionMm, endExtensionMm } = endCutExtensions(object);
  const halfLength = Math.max(object.lengthMm, 1) / 2;
  const x0 = -halfLength - startExtensionMm;
  const x1 = halfLength + endExtensionMm;
  const startFace = outline
    .map((point) => new THREE.Vector3(x0, point.x, point.y))
    .reverse();
  const endFace = outline.map((point) => new THREE.Vector3(x1, point.x, point.y));
  const faces: THREE.Vector3[][] = [startFace, endFace];

  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    faces.push([
      new THREE.Vector3(x0, current.x, current.y),
      new THREE.Vector3(x1, current.x, current.y),
      new THREE.Vector3(x1, next.x, next.y),
      new THREE.Vector3(x0, next.x, next.y),
    ]);
  }

  return geometryFromFaces(clipFacesToEndCuts(object, midpoint, xAxis, faces));
}

function numericMetadataValue(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

function buildClosedLineGeometry(points: Point3[]): THREE.BufferGeometry {
  if (points.length === 0) {
    return new THREE.BufferGeometry();
  }
  return buildLineGeometry([...points, points[0]!]);
}

function MemberObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneMemberPrismObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const midpoint = useMemo(
    () => ({
      x: (object.centerline.start.x + object.centerline.end.x) / 2,
      y: (object.centerline.start.y + object.centerline.end.y) / 2,
      z: (object.centerline.start.z + object.centerline.end.z) / 2,
    }),
    [
      object.centerline.end.x,
      object.centerline.end.y,
      object.centerline.end.z,
      object.centerline.start.x,
      object.centerline.start.y,
      object.centerline.start.z,
    ],
  );
  const matrix = useMemo(() => {
    const xAxis = new THREE.Vector3(
      object.centerline.end.x - object.centerline.start.x,
      object.centerline.end.y - object.centerline.start.y,
      object.centerline.end.z - object.centerline.start.z,
    ).normalize();
    const yAxis = new THREE.Vector3(
      object.localFrame.yAxis.x,
      object.localFrame.yAxis.y,
      object.localFrame.yAxis.z,
    ).normalize();
    const zAxis = new THREE.Vector3(
      object.localFrame.zAxis.x,
      object.localFrame.zAxis.y,
      object.localFrame.zAxis.z,
    ).normalize();
    const next = new THREE.Matrix4();
    next.makeBasis(xAxis, yAxis, zAxis);
    next.setPosition(midpoint.x, midpoint.y, midpoint.z);
    return next;
  }, [
    midpoint.x,
    midpoint.y,
    midpoint.z,
    object.centerline.end.x,
    object.centerline.end.y,
    object.centerline.end.z,
    object.centerline.start.x,
    object.centerline.start.y,
    object.centerline.start.z,
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
  ]);
  const handleSelect = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect(object.id);
    },
    [object.id, onSelect],
  );
  const handleFocus = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onFocus(object.id);
    },
    [object.id, onFocus],
  );
  const lineGeometry = useMemo(
    () => buildLineGeometry(linePoints(object.centerline)),
    [object.centerline],
  );
  const outlineComposite = useMemo(() => {
    if (object.renderMode !== "outline_extrusion") {
      return null;
    }

    const bodyInsetStartMm = numericMetadataValue(
      object.metadata,
      "bodyInsetStartMm",
    );
    const bodyInsetEndMm = numericMetadataValue(
      object.metadata,
      "bodyInsetEndMm",
    );
    const endCapStartMm = numericMetadataValue(
      object.metadata,
      "endCapStartMm",
    );
    const endCapEndMm = numericMetadataValue(object.metadata, "endCapEndMm");
    const endCapWidthMm = numericMetadataValue(
      object.metadata,
      "endCapWidthMm",
    );
    const endCapDepthMm = numericMetadataValue(
      object.metadata,
      "endCapDepthMm",
    );
    if (
      bodyInsetStartMm === null ||
      bodyInsetEndMm === null ||
      endCapStartMm === null ||
      endCapEndMm === null ||
      bodyInsetStartMm < 0 ||
      bodyInsetEndMm < 0 ||
      endCapStartMm <= 0 ||
      endCapEndMm <= 0
    ) {
      return null;
    }

    const fullLengthMm = Math.max(object.lengthMm, 1);
    const bodyLengthMm = fullLengthMm - bodyInsetStartMm - bodyInsetEndMm;
    if (bodyLengthMm <= 0) {
      return null;
    }

    return {
      bodyLengthMm,
      bodyOffsetX: (bodyInsetStartMm - bodyInsetEndMm) / 2,
      startCapLengthMm: endCapStartMm,
      startCapOffsetX: -fullLengthMm / 2 + endCapStartMm / 2,
      endCapLengthMm: endCapEndMm,
      endCapOffsetX: fullLengthMm / 2 - endCapEndMm / 2,
      rectangularCap:
        endCapWidthMm !== null &&
        endCapDepthMm !== null &&
        endCapWidthMm > 0 &&
        endCapDepthMm > 0
          ? {
              widthMm: endCapWidthMm,
              depthMm: endCapDepthMm,
            }
          : null,
    };
  }, [object.lengthMm, object.metadata, object.renderMode]);
  const extrusionGeometry = useMemo(
    () => buildProfileExtrusionGeometry(object.profile, object.lengthMm),
    [object.lengthMm, object.profile],
  );
  const insetExtrusionGeometry = useMemo(
    () =>
      outlineComposite
        ? buildProfileExtrusionGeometry(
            object.profile,
            outlineComposite.bodyLengthMm,
          )
        : null,
    [object.profile, outlineComposite],
  );
  const startCapGeometry = useMemo(() => {
    if (!outlineComposite) return null;
    return outlineComposite.rectangularCap
      ? buildRectangularCapGeometry(
          outlineComposite.startCapLengthMm,
          outlineComposite.rectangularCap.widthMm,
          outlineComposite.rectangularCap.depthMm,
        )
      : buildProfileExtrusionGeometry(
          object.profile,
          outlineComposite.startCapLengthMm,
          { includeVoids: false },
        );
  }, [object.profile, outlineComposite]);
  const endCapGeometry = useMemo(() => {
    if (!outlineComposite) return null;
    return outlineComposite.rectangularCap
      ? buildRectangularCapGeometry(
          outlineComposite.endCapLengthMm,
          outlineComposite.rectangularCap.widthMm,
          outlineComposite.rectangularCap.depthMm,
        )
      : buildProfileExtrusionGeometry(
          object.profile,
          outlineComposite.endCapLengthMm,
          { includeVoids: false },
        );
  }, [object.profile, outlineComposite]);
  const clippedBoxGeometry = useMemo(
    () =>
      object.renderMode === "prism"
        ? buildClippedBoxGeometry(object, midpoint)
        : null,
    [midpoint, object],
  );
  const clippedProfileExtrusionGeometry = useMemo(
    () =>
      object.renderMode === "outline_extrusion" && !outlineComposite
        ? buildClippedProfileExtrusionGeometry(object, midpoint)
        : null,
    [midpoint, object, outlineComposite],
  );

  if (object.renderMode === "line_fallback") {
    return (
      <line
        data-testid={`scene-object-${object.id}`}
        onClick={handleSelect}
        onDoubleClick={handleFocus}
      >
        <primitive attach="geometry" object={lineGeometry} />
        <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
      </line>
    );
  }

  if (
    object.renderMode === "outline_extrusion" &&
    outlineComposite &&
    insetExtrusionGeometry &&
    startCapGeometry &&
    endCapGeometry
  ) {
    return (
      <group
        data-testid={`scene-object-${object.id}`}
        matrixAutoUpdate={false}
        matrix={matrix}
        onClick={handleSelect}
        onDoubleClick={handleFocus}
      >
        <mesh position={[outlineComposite.bodyOffsetX, 0, 0]}>
          <primitive attach="geometry" object={insetExtrusionGeometry} />
          <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
        </mesh>
        <mesh position={[outlineComposite.startCapOffsetX, 0, 0]}>
          <primitive attach="geometry" object={startCapGeometry} />
          <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
        </mesh>
        <mesh position={[outlineComposite.endCapOffsetX, 0, 0]}>
          <primitive attach="geometry" object={endCapGeometry} />
          <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
        </mesh>
      </group>
    );
  }

  if (object.renderMode === "outline_extrusion") {
    return (
      <mesh
        data-testid={`scene-object-${object.id}`}
        matrixAutoUpdate={false}
        matrix={matrix}
        onClick={handleSelect}
        onDoubleClick={handleFocus}
      >
        <primitive
          attach="geometry"
          object={clippedProfileExtrusionGeometry ?? extrusionGeometry}
        />
        <meshStandardMaterial
          color={color}
          clippingPlanes={clippingPlanes}
          side={
            clippedProfileExtrusionGeometry ? THREE.DoubleSide : THREE.FrontSide
          }
        />
      </mesh>
    );
  }

  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      matrixAutoUpdate={false}
      matrix={matrix}
      onClick={handleSelect}
      onDoubleClick={handleFocus}
    >
      {clippedBoxGeometry ? (
        <primitive attach="geometry" object={clippedBoxGeometry} />
      ) : (
        <boxGeometry
          args={[
            Math.max(object.lengthMm, 1),
            object.profile.widthMm,
            object.profile.depthMm,
          ]}
        />
      )}
      <meshStandardMaterial
        color={color}
        clippingPlanes={clippingPlanes}
        side={clippedBoxGeometry ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

function RoofPlaneObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofPlaneObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildPolygonGeometry(object.boundary),
    [object.boundary],
  );
  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

function RoofCladdingPanelObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofCladdingPanelObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () =>
      buildPolygonSlabGeometry(
        object.boundary,
        object.plane,
        object.thicknessMm,
      ),
    [object.boundary, object.plane, object.thicknessMm],
  );
  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.52}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

function RoofFlashingObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofFlashingObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const wingGeometries = useMemo(
    () =>
      object.wings.map((wing) => ({
        id: wing.id,
        geometry: buildPolygonSlabGeometry(
          wing.boundary,
          wing.plane,
          object.thicknessMm,
        ),
      })),
    [object.thicknessMm, object.wings],
  );
  return (
    <group
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      {wingGeometries.map((wing) => (
        <mesh key={wing.id}>
          <primitive attach="geometry" object={wing.geometry} />
          <meshStandardMaterial
            color={color}
            metalness={0.25}
            roughness={0.48}
            side={THREE.DoubleSide}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ))}
    </group>
  );
}

function HouseRoofMaterialObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseRoofMaterialObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const lineGeometries = useMemo(
    () =>
      object.lines.map((line, index) => ({
        id: `${object.id}-${index + 1}`,
        geometry: buildLineGeometry(linePoints(line)),
      })),
    [object.id, object.lines],
  );

  return (
    <group
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      {lineGeometries.map((line) => (
        <line key={line.id}>
          <primitive attach="geometry" object={line.geometry} />
          <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
        </line>
      ))}
    </group>
  );
}

function ReferenceLineObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneReferenceLineObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildLineGeometry(linePoints(object.line)),
    [object.line],
  );
  return (
    <line
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
    </line>
  );
}

function ReferencePlaneObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneReferencePlaneObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildPolygonGeometry(object.boundary),
    [object.boundary],
  );
  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

function HouseSurfaceObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseSurfaceObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildPolygonGeometry(object.boundary),
    [object.boundary],
  );
  const opacity =
    object.kind === "roof"
      ? 0.32
      : object.kind === "wall"
        ? 0.2
        : object.kind === "opening_marker"
          ? 0.52
        : object.kind === "attachment_zone" ||
            object.kind === "attachment_plane"
          ? 0.4
          : 0.26;
  const surfaceColor = object.kind === "opening_marker" ? "#95b9cf" : color;
  const materialSide =
    object.kind === "wall" ? THREE.FrontSide : THREE.DoubleSide;

  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial
        color={surfaceColor}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={materialSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

function HouseLineObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseLineObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => buildLineGeometry(linePoints(object.line)),
    [object.line],
  );
  const lineColor = object.kind === "opening_outline" ? "#325872" : color;
  return (
    <line
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <lineBasicMaterial color={lineColor} clippingPlanes={clippingPlanes} />
    </line>
  );
}

function HouseSurfaceSolidObject({
  object,
  color,
  selected,
  hovered,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseSurfaceSolidObject;
  color: string;
  selected: boolean;
  /**
   * Cross-viewport hover state (milestone 16). When true and `selected` is
   * false, the deck renders a lighter highlight (boosted top opacity +
   * outline emphasis) so the user sees the same deck "under interest" in
   * 3D when their pointer is on the matching plan shape. We deliberately
   * skip the highlight when `selected` -- the selection styling already
   * dominates and adding hover on top would muddy the visual.
   */
  hovered: boolean;
  onSelect: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () =>
      // Walls (including the gable triangles produced by the open-gable
      // mesh builder) render through the same path as every other surface
      // solid: prefer the precomputed renderMesh, fall back to extruding
      // the boundary polygon by `thicknessMm`. Previously walls used
      // `buildPolygonGeometry(boundary)` which drew a flat polygon and
      // ignored thickness entirely -- visually inconsistent with the rest
      // of the building.
      buildRenderMeshGeometry(object.renderMesh) ??
      buildPolygonSlabGeometry(object.boundary, object.plane, object.thicknessMm),
    [object.boundary, object.plane, object.renderMesh, object.thicknessMm],
  );
  const opacity =
    object.kind === "roof"
      ? 0.62
      : object.kind === "wall"
        ? 0.58
        : 0.72;
  const materialSide =
    object.kind === "wall" ? THREE.FrontSide : THREE.DoubleSide;
  const isDeck = object.kind === "deck";
  // 3D occlusion (milestone 16) is NOT yet shipped. The first attempt --
  // walls + roofs writing to the depth buffer with `depthWrite: true` and
  // `renderOrder: -1` so the deck floor inside the house bounds would be
  // depth-test rejected -- was reverted because the same depth values
  // also occluded pergola elements that should be visible through the
  // semi-transparent walls (3D viewport went near-blank). A more targeted
  // approach is needed: either polygon-clip the deck against the house
  // footprint as a pre-process (no depth tricks) or a stencil pass on the
  // house outline. Until one of those lands, leave the legacy transparent
  // blend in place (depthWrite: false everywhere).
  const deckMaterial = isDeck ? resolveDeckMaterial(object) : null;
  const deckPalette = isDeck && deckMaterial ? resolveDeckPalette(deckMaterial) : null;
  // Hover boosts intermediate opacity values when not selected, so a deck
  // hovered from an external surface (e.g. plan view) reads as "under
  // interest" in 3D without competing with the selected styling. When
  // `selected` is true, hover is ignored -- selection dominates.
  const deckHoverActive = isDeck && hovered && !selected;
  const deckMuted = isDeck && !selected && !hovered;
  const bodyOpacity = isDeck
    ? selected
      ? 0.82
      : deckHoverActive
        ? 0.6
        : 0.4
    : opacity;
  const topOpacity = isDeck
    ? selected
      ? 0.98
      : deckHoverActive
        ? 0.88
        : 0.74
    : opacity;
  const outlineOpacity = isDeck
    ? selected
      ? 1
      : deckHoverActive
        ? 0.85
        : 0.58
    : 1;
  const grooveOpacity = isDeck ? (selected ? 0.8 : deckHoverActive ? 0.55 : 0.32) : 1;
  const topBoundary = useMemo(() => {
    if (!isDeck) return [];
    return offsetPolygon(object.boundary, object.plane.normal, 1.5);
  }, [isDeck, object.boundary, object.plane.normal]);
  const topGeometry = useMemo(
    () => (topBoundary.length ? buildPolygonGeometry(topBoundary) : emptyGeometry()),
    [topBoundary],
  );
  const outlineGeometry = useMemo(
    () => (isDeck ? buildClosedLineGeometry(offsetPolygon(object.boundary, object.plane.normal, 3)) : emptyGeometry()),
    [isDeck, object.boundary, object.plane.normal],
  );
  const selectedOutlineGeometry = useMemo(
    () =>
      isDeck && selected
        ? buildClosedLineGeometry(offsetPolygon(object.boundary, object.plane.normal, 6))
        : emptyGeometry(),
    [isDeck, object.boundary, object.plane.normal, selected],
  );
  const deckGrooveLines = useMemo(() => (isDeck ? buildDeckGrooveLines(object) : []), [isDeck, object]);
  const deckGrooveGeometries = useMemo(
    () =>
      deckGrooveLines.map((line) => ({
        id: line.id,
        geometry: buildLineGeometry([line.start, line.end]),
      })),
    [deckGrooveLines],
  );

  return (
    <group
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
      onPointerOver={(event) => {
        // R3F bubbles pointer-over to ancestors. `stopPropagation` keeps the
        // hover scoped to the deepest object under the cursor; without this,
        // entering a deck from outside fires hover for every ancestor in the
        // group tree. Mirrors the click/select pattern.
        event.stopPropagation();
        onHoverEnter(object.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverLeave(object.id);
      }}
    >
      <mesh>
        <primitive attach="geometry" object={geometry} />
        <meshStandardMaterial
          color={deckPalette?.baseColor ?? color}
          transparent
          opacity={bodyOpacity}
          depthWrite={false}
          side={materialSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      {isDeck ? (
        <>
          <mesh>
            <primitive attach="geometry" object={topGeometry} />
            <meshStandardMaterial
              color={selected ? deckPalette?.selectedColor ?? color : deckPalette?.topColor ?? color}
              transparent
              opacity={topOpacity}
              depthWrite={false}
              side={THREE.DoubleSide}
              clippingPlanes={clippingPlanes}
            />
          </mesh>
          <line data-testid={`scene-object-${object.id}-deck-outline`}>
            <primitive attach="geometry" object={outlineGeometry} />
            <lineBasicMaterial
              color={selected ? deckPalette?.selectedColor ?? "#2f6f96" : deckPalette?.outlineColor ?? color}
              transparent
              opacity={outlineOpacity}
              clippingPlanes={clippingPlanes}
            />
          </line>
          {deckGrooveGeometries.length ? (
            <group data-testid={`scene-object-${object.id}-deck-grooves`}>
              {deckGrooveGeometries.map((line) => (
                <line key={line.id}>
                  <primitive attach="geometry" object={line.geometry} />
                  <lineBasicMaterial
                    color={deckPalette?.grooveColor ?? color}
                    transparent
                    opacity={grooveOpacity}
                    clippingPlanes={clippingPlanes}
                  />
                </line>
              ))}
            </group>
          ) : null}
          {selected ? (
            <line data-testid={`scene-object-${object.id}-deck-outline-selected`}>
              <primitive attach="geometry" object={selectedOutlineGeometry} />
              <lineBasicMaterial color={deckPalette?.selectedColor ?? "#2f6f96"} clippingPlanes={clippingPlanes} />
            </line>
          ) : null}
        </>
      ) : null}
    </group>
  );
}

function HouseLinearSolidObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseLinearSolidObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const renderMeshGeometry = useMemo(
    () => buildRenderMeshGeometry(object.renderMesh),
    [object.renderMesh],
  );
  const placement = useMemo(() => buildLinearSolidPlacement(object), [
    object.centerline.end.x,
    object.centerline.end.y,
    object.centerline.end.z,
    object.centerline.start.x,
    object.centerline.start.y,
    object.centerline.start.z,
    object.localFrame.xAxis.x,
    object.localFrame.xAxis.y,
    object.localFrame.xAxis.z,
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
    object.profileDepthMm,
    object.profileWidthMm,
  ]);
  if (renderMeshGeometry) {
    return (
      <mesh
        data-testid={`scene-object-${object.id}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(object.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onFocus(object.id);
        }}
      >
        <primitive attach="geometry" object={renderMeshGeometry} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.76}
          side={THREE.DoubleSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    );
  }
  if (!placement) return null;

  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      matrixAutoUpdate={false}
      matrix={placement.matrix}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <boxGeometry
        args={[
          placement.lengthMm,
          placement.profileWidthMm,
          placement.profileDepthMm,
        ]}
      />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.76}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

function SceneObjectNode({
  object,
  color,
  selected,
  hovered,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneObject;
  color: string;
  selected: boolean;
  /**
   * True when the cross-viewport hover ref points at this object's id (or
   * its workbench-level parent for grouped objects -- handled at the dispatch
   * site). Per-renderer hover styling lives in the renderer component;
   * milestone 16 phase 2 wires this for the deck renderer first.
   */
  hovered: boolean;
  onSelect: (id: string) => void;
  /** R3F pointer-over: object's id was entered. Phase 2/3 of milestone 16. */
  onHoverEnter: (id: string) => void;
  /** R3F pointer-out: object's id was left. */
  onHoverLeave: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  if (object.type === "member_prism") {
    return (
      <MemberObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "roof_plane") {
    return (
      <RoofPlaneObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "roof_cladding_panel") {
    return (
      <RoofCladdingPanelObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "roof_flashing") {
    return (
      <RoofFlashingObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_roof_material") {
    if (!object.lines.some(isRenderableLine)) return null;
    return (
      <HouseRoofMaterialObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "reference_line") {
    return (
      <ReferenceLineObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_surface_solid") {
    if (
      !isRenderableRenderMesh(object.renderMesh) &&
      !isRenderableSlab(object.boundary, object.plane, object.thicknessMm)
    ) {
      return null;
    }
    return (
      <HouseSurfaceSolidObject
        object={object}
        color={color}
        selected={selected}
        hovered={hovered}
        onSelect={onSelect}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_linear_solid") {
    if (!isRenderableRenderMesh(object.renderMesh) && !buildLinearSolidPlacement(object)) {
      return null;
    }
    return (
      <HouseLinearSolidObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_surface") {
    if (!isRenderablePolygon(object.boundary)) return null;
    return (
      <HouseSurfaceObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  if (object.type === "house_line") {
    if (!isRenderableLine(object.line)) return null;
    return (
      <HouseLineObject
        object={object}
        color={color}
        onSelect={onSelect}
        onFocus={onFocus}
        clippingPlanes={clippingPlanes}
      />
    );
  }
  return (
    <ReferencePlaneObject
      object={object}
      color={color}
      onSelect={onSelect}
      onFocus={onFocus}
      clippingPlanes={clippingPlanes}
    />
  );
}

function ArrowOverlay({
  testId,
  start,
  end,
  color,
}: {
  testId: string;
  start: Point3;
  end: Point3;
  color: string;
}) {
  const geometries = useMemo(() => {
    const startVector = pointToVector(start);
    const endVector = pointToVector(end);
    const direction = endVector.clone().sub(startVector);
    const length = direction.length();
    if (length === 0) {
      return {
        shaft: buildLineGeometry([start, end]),
        headA: buildLineGeometry([end, end]),
        headB: buildLineGeometry([end, end]),
      };
    }

    const normalizedDirection = direction.clone().normalize();
    const reference =
      Math.abs(normalizedDirection.z) < 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3()
      .crossVectors(normalizedDirection, reference)
      .normalize();
    const headLength = Math.min(Math.max(length * 0.18, 80), 180);
    const headWidth = Math.min(Math.max(length * 0.08, 50), 120);
    const back = normalizedDirection.clone().multiplyScalar(-headLength);
    const left = endVector
      .clone()
      .add(back)
      .add(side.clone().multiplyScalar(headWidth));
    const right = endVector
      .clone()
      .add(back)
      .add(side.clone().multiplyScalar(-headWidth));

    return {
      shaft: buildLineGeometry([start, end]),
      headA: buildLineGeometry([vectorToPoint(left), end]),
      headB: buildLineGeometry([vectorToPoint(right), end]),
    };
  }, [end, start]);

  return (
    <group data-testid={testId}>
      <line>
        <primitive attach="geometry" object={geometries.shaft} />
        <lineBasicMaterial color={color} />
      </line>
      <line>
        <primitive attach="geometry" object={geometries.headA} />
        <lineBasicMaterial color={color} />
      </line>
      <line>
        <primitive attach="geometry" object={geometries.headB} />
        <lineBasicMaterial color={color} />
      </line>
    </group>
  );
}

function SectionCutHint({ boundary }: { boundary: Point3[] }) {
  const planeGeometry = useMemo(
    () => buildPolygonGeometry(boundary),
    [boundary],
  );
  const outlineGeometry = useMemo(
    () => buildClosedLineGeometry(boundary),
    [boundary],
  );

  return (
    <group data-testid="section-cut-hint">
      <mesh data-testid="section-cut-plane">
        <primitive attach="geometry" object={planeGeometry} />
        <meshStandardMaterial
          color="#7da3d1"
          transparent
          opacity={0.14}
          side={THREE.DoubleSide}
        />
      </mesh>
      <line data-testid="section-cut-outline">
        <primitive attach="geometry" object={outlineGeometry} />
        <lineBasicMaterial color="#4673b5" />
      </line>
    </group>
  );
}

function MeasurementProbeOverlay({
  firstAnchor,
  secondAnchor,
  clippingPlanes,
  markerRadiusMm,
}: {
  firstAnchor: MeasurementAnchor | null;
  secondAnchor: MeasurementAnchor | null;
  clippingPlanes: THREE.Plane[];
  markerRadiusMm: number;
}) {
  const lineGeometry = useMemo(() => {
    if (!firstAnchor || !secondAnchor) return null;
    return buildLineGeometry([firstAnchor.point, secondAnchor.point]);
  }, [firstAnchor, secondAnchor]);

  const tickGeometries = useMemo(() => {
    if (!firstAnchor || !secondAnchor) return null;

    const start = pointToVector(firstAnchor.point);
    const end = pointToVector(secondAnchor.point);
    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-6) return null;

    const normalizedDirection = direction.normalize();
    const reference =
      Math.abs(normalizedDirection.z) < 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const tickDirection = new THREE.Vector3()
      .crossVectors(normalizedDirection, reference)
      .normalize();
    const tickHalfLength = Math.max(markerRadiusMm * 0.9, 22);

    const buildTick = (point: THREE.Vector3) =>
      buildLineGeometry([
        vectorToPoint(
          point
            .clone()
            .add(tickDirection.clone().multiplyScalar(-tickHalfLength)),
        ),
        vectorToPoint(
          point
            .clone()
            .add(tickDirection.clone().multiplyScalar(tickHalfLength)),
        ),
      ]);

    return {
      first: buildTick(start),
      second: buildTick(end),
    };
  }, [firstAnchor, secondAnchor, markerRadiusMm]);

  return (
    <group data-testid="measurement-probe-overlay">
      {firstAnchor ? (
        <mesh
          position={[
            firstAnchor.point.x,
            firstAnchor.point.y,
            firstAnchor.point.z,
          ]}
          data-testid="measurement-anchor-a"
        >
          <sphereGeometry args={[markerRadiusMm, 18, 18]} />
          <meshStandardMaterial
            color="#c75656"
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ) : null}
      {secondAnchor ? (
        <mesh
          position={[
            secondAnchor.point.x,
            secondAnchor.point.y,
            secondAnchor.point.z,
          ]}
          data-testid="measurement-anchor-b"
        >
          <sphereGeometry args={[markerRadiusMm, 18, 18]} />
          <meshStandardMaterial
            color="#3f7ec3"
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      ) : null}
      {lineGeometry ? (
        <line data-testid="measurement-probe-line">
          <primitive attach="geometry" object={lineGeometry} />
          <lineBasicMaterial color="#2d302f" clippingPlanes={clippingPlanes} />
        </line>
      ) : null}
      {tickGeometries ? (
        <>
          <line data-testid="measurement-probe-tick-a">
            <primitive attach="geometry" object={tickGeometries.first} />
            <lineBasicMaterial
              color="#2d302f"
              clippingPlanes={clippingPlanes}
            />
          </line>
          <line data-testid="measurement-probe-tick-b">
            <primitive attach="geometry" object={tickGeometries.second} />
            <lineBasicMaterial
              color="#2d302f"
              clippingPlanes={clippingPlanes}
            />
          </line>
        </>
      ) : null}
    </group>
  );
}

export default function Geometry3DViewport({
  geometryPreview,
  objectWorkbenchDisplayFamily = "pergolas",
  visibility,
  viewportKey = "geometry3d",
  viewportState,
  onViewportStateChange,
  lockedViewPreset,
  controlledSelectedObjectId,
  onSelectedObjectChange,
  controlledHoveredObjectId,
  onHoveredObjectChange,
}: {
  geometryPreview?: GeometryPreviewState | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  viewportKey?: string;
  viewportState?: Geometry3DViewportState | null;
  onViewportStateChange?: (next: Geometry3DViewportState) => void;
  lockedViewPreset?: GeometryCameraPreset;
  controlledSelectedObjectId?: string | null;
  onSelectedObjectChange?: (objectId: string | null) => void;
  /**
   * Cross-viewport hover state input. When set (e.g. driven by PlanViewport
   * pointer-over), the 3D viewport SHOULD render a hover highlight on the
   * matching object. Phase 1 (milestone 16) wires the prop end-to-end but
   * does NOT yet apply per-object hover styling -- the per-renderer pass
   * adding `hovered: boolean` alongside `selected: boolean` is a follow-up
   * slice. Until then, the prop is exposed via a `data-hovered-object-id`
   * attribute on the canvas root for telemetry/test visibility, and the
   * downstream emit half lets PlanViewport receive 3D-driven hover.
   */
  controlledHoveredObjectId?: string | null;
  /**
   * Cross-viewport hover state output. Phase 1 placeholder: the 3D viewport
   * does not yet emit hover events from raycaster/pointer-over (would require
   * adding pointer events to ~50 object renderers). Once the per-renderer
   * hover-render slice lands, this callback fires when the 3D pointer enters
   * an object and `null` when it leaves -- mirroring `onSelectedObjectChange`
   * but for hover. Plumbed now so consumers can adopt the contract early.
   */
  onHoveredObjectChange?: (objectId: string | null) => void;
}) {
  const displayMode = objectWorkbenchDisplayFamily === "house_forms" ? "house" : "pergolas";
  const [panelOpen, setPanelOpen] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    controlledSelectedObjectId ?? null,
  );
  useEffect(() => {
    if (controlledSelectedObjectId === undefined) return;
    setSelectedObjectId((current) =>
      current === controlledSelectedObjectId ? current : controlledSelectedObjectId,
    );
  }, [controlledSelectedObjectId]);
  useEffect(() => {
    if (!onSelectedObjectChange) return;
    onSelectedObjectChange(selectedObjectId);
  }, [onSelectedObjectChange, selectedObjectId]);

  // Cross-viewport hover (milestone 16). The parent owns the hover ref via
  // `controlledHoveredObjectId`; the 3D viewport publishes hover events from
  // its raycaster (via `onHoveredObjectChange`) and renders highlight on the
  // matching object. Unlike selection, hover has no local state -- the
  // controlled prop IS the source of truth, so `setControlledHover...`-style
  // reconciliation isn't needed.
  const onHoveredObjectChangeRef = useRef(onHoveredObjectChange);
  onHoveredObjectChangeRef.current = onHoveredObjectChange;
  const handleObjectHoverEnter = useCallback((id: string) => {
    onHoveredObjectChangeRef.current?.(id);
  }, []);
  const handleObjectHoverLeave = useCallback((id: string) => {
    // Only clear if the leaving object is the one currently hovered. This
    // matches `useHoveredShape`'s convention -- guards against stale leaves
    // arriving after the pointer has already moved to a sibling.
    onHoveredObjectChangeRef.current?.(null);
    void id;
  }, []);

  const [sectionCut, setSectionCut] = useState<SectionCutState>({
    enabled: false,
    positionMm: 0,
  });
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(
    {
      datumAxes: false,
      roofFallVectors: false,
      selectedMemberAxes: false,
    },
  );
  const [measurement, setMeasurement] = useState<MeasurementState>({
    enabled: false,
    firstAnchor: null,
    secondAnchor: null,
    snapMode: "selection",
    lastEditedSlot: "a",
  });
  const [cameraState, setCameraState] = useState<GeometryCameraState>(
    () =>
      viewportState?.cameraState ??
      buildPresetCameraState({
        target: { x: 0, y: 0, z: 500 },
        distanceMm: fitDistanceForSize(2000),
        viewPreset: lockedViewPreset && lockedViewPreset !== "custom" ? lockedViewPreset : "iso",
        focusMode: "scene",
      }),
  );
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<GeometryViewportCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const viewportRestoreSignatureRef = useRef<string | null>(null);
  const [rectDiagnostic, setRectDiagnostic] = useState<ViewportRectDiagnostics>(
    {
      shellWidth: 0,
      shellHeight: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      canvasContained: false,
    },
  );
  const handleNativeSelectionCapture = useCallback((event: Event) => {
    blockNativeSelectionEvent(event);
  }, []);
  useEffect(() => {
    const node = canvasShellRef.current;
    if (!node) return;
    const handleSelectStart = (event: Event) => handleNativeSelectionCapture(event);
    const handleDragStart = (event: Event) => handleNativeSelectionCapture(event);
    node.addEventListener("selectstart", handleSelectStart, true);
    node.addEventListener("dragstart", handleDragStart, true);
    return () => {
      node.removeEventListener("selectstart", handleSelectStart, true);
      node.removeEventListener("dragstart", handleDragStart, true);
    };
  }, [handleNativeSelectionCapture]);

  const rawScene =
    geometryPreview?.kind === "ready" ? geometryPreview.scene : null;
  const scene = useMemo(
    () => (rawScene ? sceneForDisplayMode(rawScene, displayMode, visibility) : null),
    [displayMode, rawScene, visibility],
  );
  const datumOrigin =
    geometryPreview?.kind === "ready"
      ? geometryPreview.assembly.datum.origin
      : null;
  const sceneBounds = useMemo(
    () => (scene ? computeSceneBounds(scene) : null),
    [scene],
  );
  const allObjects = useMemo(
    () => scene?.layers.flatMap((layer) => layer.objects) ?? [],
    [scene],
  );
  const sceneKey = useMemo(() => {
    if (geometryPreview?.kind !== "ready" || !scene) {
      return geometryPreview?.kind ?? "empty";
    }
    const layerSignature = scene.layers
      .map((layer) => `${layer.id}:${layer.objects.map((object) => object.id).join(",")}`)
      .join("|");
    const boundsSignature = sceneBounds
      ? [
          sceneBounds.min.x,
          sceneBounds.min.y,
          sceneBounds.min.z,
          sceneBounds.max.x,
          sceneBounds.max.y,
          sceneBounds.max.z,
        ]
          .map((value) => Math.round(value))
          .join(",")
      : "no-bounds";
    return [
      geometryPreview.resultSource,
      geometryPreview.config.projectId,
      geometryPreview.config.estimateId,
      geometryPreview.config.family,
      geometryPreview.config.connection.type,
      geometryPreview.config.connection.attachmentSide,
      displayMode,
      geometryPreview.config.dimensions.lengthMm,
      geometryPreview.config.dimensions.projectionMm,
      boundsSignature,
      layerSignature,
    ].join(":");
  }, [displayMode, geometryPreview, scene, sceneBounds]);
  const selectedObject = useMemo(
    () => allObjects.find((object) => object.id === selectedObjectId) ?? null,
    [allObjects, selectedObjectId],
  );
  const finiteBounds = useMemo(() => allSceneBoundsFinite(sceneBounds), [sceneBounds]);
  const houseRoofDiagnostics = useMemo(
    () => collectHouseRoofViewportDiagnostics(scene),
    [scene],
  );
  const houseOpeningDiagnostics = useMemo(
    () => collectHouseOpeningViewportDiagnostics(scene),
    [scene],
  );
  const selectedMember =
    selectedObject?.type === "member_prism" ? selectedObject : null;
  const selectedObjectSupportsAnchorSwitch =
    supportsEndpointAnchors(selectedObject);
  const lengthMm =
    geometryPreview?.kind === "ready"
      ? geometryPreview.config.dimensions.lengthMm
      : 0;
  const sceneFitDistance = useMemo(
    () =>
      sceneBounds
        ? fitDistanceForSize(sceneBounds.size)
        : fitDistanceForSize(2000),
    [sceneBounds],
  );
  const persistCameraState = useCallback(
    (nextState: GeometryCameraState) => {
      setCameraState(nextState);
      onViewportStateChange?.({ cameraState: nextState });
    },
    [onViewportStateChange],
  );
  const useOrthographicTopCamera = cameraState.viewPreset === "top";
  const initialCamera = useMemo(() => {
    const cameraBase = useOrthographicTopCamera
      ? {
          near: 1,
          far: 40000,
          zoom: 1,
        }
      : {
          near: 1,
          far: 40000,
          fov: 40,
        };
    if (!sceneBounds) {
      return {
        position: [1800, -1800, 1400] as [number, number, number],
        ...cameraBase,
      };
    }

    const seedState = buildPresetCameraState({
      target: sceneBounds.center,
      distanceMm: sceneFitDistance,
      viewPreset: "iso",
      focusMode: "scene",
    });
    const cameraPosition = seedState.position;
    return {
      ...cameraBase,
      position: [cameraPosition.x, cameraPosition.y, cameraPosition.z] as [
        number,
        number,
        number,
      ],
      far: Math.max(sceneBounds.size * 10, 40000),
    };
  }, [sceneBounds, sceneFitDistance, useOrthographicTopCamera]);

  const applyCameraPose = useCallback(
    (nextState: GeometryCameraState) => {
      if (!sceneBounds || !cameraRef.current || !controlsRef.current) return;

      const camera = cameraRef.current;
      const controls = controlsRef.current;

      camera.up.set(0, nextState.viewPreset === "top" ? -1 : 0, nextState.viewPreset === "top" ? 0 : 1);
      camera.position.set(
        nextState.position.x,
        nextState.position.y,
        nextState.position.z,
      );
      camera.near = 1;
      camera.far = Math.max(sceneBounds.size * 12, 40000);
      if (camera instanceof THREE.OrthographicCamera) {
        const halfSpan = Math.max(sceneBounds.size * 0.65, 1000);
        camera.left = -halfSpan;
        camera.right = halfSpan;
        camera.top = halfSpan;
        camera.bottom = -halfSpan;
        camera.zoom = 1;
      }
      camera.lookAt(nextState.target.x, nextState.target.y, nextState.target.z);
      camera.updateProjectionMatrix();

      controls.target.set(
        nextState.target.x,
        nextState.target.y,
        nextState.target.z,
      );
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.screenSpacePanning = true;
      controls.zoomToCursor = true;
      controls.rotateSpeed = 0.72;
      controls.panSpeed = 0.9;
      controls.zoomSpeed = ORBIT_ZOOM_SPEED;
      controls.minDistance = Math.max(sceneBounds.size * 0.18, 250);
      controls.maxDistance = Math.max(sceneBounds.size * 14, 14000);
      controls.minPolarAngle = 0.04;
      controls.maxPolarAngle = Math.PI - 0.08;
      controls.update();
      controls.saveState();
    },
    [sceneBounds],
  );

  const syncViewportBindings = useCallback(() => {
    applyCameraPose(cameraState);
  }, [applyCameraPose, cameraState]);

  const fitScene = useCallback(() => {
    if (!sceneBounds) return;
    const direction = directionFromCameraState(cameraState);
    persistCameraState({
      position: positionFromDirection(
        sceneBounds.center,
        direction,
        sceneFitDistance,
      ),
      target: sceneBounds.center,
      distanceMm: sceneFitDistance,
      viewPreset: cameraState.viewPreset,
      focusMode: "scene",
    });
  }, [cameraState, persistCameraState, sceneBounds, sceneFitDistance]);

  const focusSelection = useCallback((object: ViewerSceneObject | null) => {
    if (!object) return;
    const target = focusPointForObject(object);
    const objectDistance = fitDistanceForSize(
      boundingSize(pointsForObject(object)),
    );
    setSelectedObjectId(object.id);
    persistCameraState({
      position: positionFromDirection(
        target,
        directionFromCameraState(cameraState),
        objectDistance,
      ),
      target,
      distanceMm: objectDistance,
      viewPreset: cameraState.viewPreset,
      focusMode: "selection",
    });
  }, [cameraState, persistCameraState]);

  const focusObjectById = useCallback(
    (id: string) => {
      const object = allObjects.find((entry) => entry.id === id) ?? null;
      focusSelection(object);
    },
    [allObjects, focusSelection],
  );
  const selectedFocusPoint = useMemo(
    () => (selectedObject ? focusPointForObject(selectedObject) : null),
    [selectedObject],
  );
  const measurementA = measurement.firstAnchor;
  const measurementB = measurement.secondAnchor;
  const measurementDeltaPoint = useMemo(
    () =>
      measurementDelta(
        measurementA?.point ?? null,
        measurementB?.point ?? null,
      ),
    [measurementA?.point, measurementB?.point],
  );
  const measurementDistanceMm = useMemo(
    () =>
      measurementDistance(
        measurementA?.point ?? null,
        measurementB?.point ?? null,
      ),
    [measurementA?.point, measurementB?.point],
  );
  const measurementPlanDistanceMm = useMemo(
    () =>
      measurementPlanDistance(
        measurementA?.point ?? null,
        measurementB?.point ?? null,
      ),
    [measurementA?.point, measurementB?.point],
  );
  const measurementMarkerRadiusMm = useMemo(
    () =>
      sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.012, 26), 72) : 36,
    [sceneBounds],
  );
  const focusToleranceMm = useMemo(
    () => (sceneBounds ? Math.max(sceneBounds.size * 0.001, 5) : 5),
    [sceneBounds],
  );

  const handleControlsRef = useCallback(
    (controls: OrbitControlsImpl | null) => {
      if (controlsRef.current === controls) return;
      controlsRef.current = controls;
      if (controls) {
        syncViewportBindings();
      }
    },
    [syncViewportBindings],
  );

  const handleCanvasCreated = useCallback(
    ({ gl, camera }: { gl: THREE.WebGLRenderer; camera: THREE.Camera }) => {
      rendererRef.current = gl;
      resetRendererState(gl);
      cameraRef.current = camera as GeometryViewportCamera;
      cameraRef.current.up.set(0, cameraState.viewPreset === "top" ? -1 : 0, cameraState.viewPreset === "top" ? 0 : 1);
      syncViewportBindings();
    },
    [syncViewportBindings],
  );

  const assignMeasurementAnchor = useCallback(
    (anchor: MeasurementAnchor, snapMode: MeasurementState["snapMode"]) => {
      setMeasurement((current) => {
        if (!current.firstAnchor) {
          return {
            ...current,
            firstAnchor: anchor,
            snapMode,
            lastEditedSlot: "a",
          };
        }
        if (!current.secondAnchor) {
          return {
            ...current,
            secondAnchor: anchor,
            snapMode,
            lastEditedSlot: "b",
          };
        }
        return {
          ...current,
          secondAnchor: anchor,
          snapMode,
          lastEditedSlot: "b",
        };
      });
    },
    [],
  );

  const handleObjectSelect = useCallback(
    (id: string) => {
      const object = allObjects.find((entry) => entry.id === id) ?? null;
      setSelectedObjectId(id);
      if (!measurement.enabled) return;
      if (!object) return;
      assignMeasurementAnchor(buildMeasurementAnchor(object), "selection");
    },
    [allObjects, assignMeasurementAnchor, measurement.enabled],
  );

  const useDatumOriginAnchor = useCallback(() => {
    if (!datumOrigin) return;
    assignMeasurementAnchor(buildDatumOriginAnchor(datumOrigin), "datum");
  }, [assignMeasurementAnchor, datumOrigin]);

  const switchSelectedAnchorType = useCallback(
    (anchorType: "start" | "midpoint" | "end") => {
      if (!selectedObject || !supportsEndpointAnchors(selectedObject)) return;

      setMeasurement((current) => {
        const replaceSlot =
          current.lastEditedSlot === "a" &&
          current.firstAnchor?.objectId === selectedObject.id
            ? "a"
            : current.lastEditedSlot === "b" &&
                current.secondAnchor?.objectId === selectedObject.id
              ? "b"
              : current.secondAnchor?.objectId === selectedObject.id
                ? "b"
                : current.firstAnchor?.objectId === selectedObject.id
                  ? "a"
                  : null;

        if (!replaceSlot) return current;

        const nextAnchor = buildMeasurementAnchor(selectedObject, anchorType);
        return replaceSlot === "a"
          ? {
              ...current,
              firstAnchor: nextAnchor,
              snapMode: "selection",
              lastEditedSlot: "a",
            }
          : {
              ...current,
              secondAnchor: nextAnchor,
              snapMode: "selection",
              lastEditedSlot: "b",
            };
      });
    },
    [selectedObject],
  );

  const selectedAnchorType = useMemo(() => {
    if (!selectedObject) return null;
    if (
      measurement.lastEditedSlot === "a" &&
      measurement.firstAnchor?.objectId === selectedObject.id
    ) {
      return measurement.firstAnchor.anchorType;
    }
    if (
      measurement.lastEditedSlot === "b" &&
      measurement.secondAnchor?.objectId === selectedObject.id
    ) {
      return measurement.secondAnchor.anchorType;
    }
    if (measurement.secondAnchor?.objectId === selectedObject.id) {
      return measurement.secondAnchor.anchorType;
    }
    if (measurement.firstAnchor?.objectId === selectedObject.id) {
      return measurement.firstAnchor.anchorType;
    }
    return null;
  }, [
    measurement.firstAnchor,
    measurement.lastEditedSlot,
    measurement.secondAnchor,
    selectedObject,
  ]);

  useEffect(() => {
    if (!scene) {
      resetRendererState(rendererRef.current);
      setPanelOpen(false);
      setLayerVisibility({});
      setSelectedObjectId(null);
      setSectionCut({ enabled: false, positionMm: 0 });
      setOverlayVisibility({
        datumAxes: false,
        roofFallVectors: false,
        selectedMemberAxes: false,
      });
      setMeasurement({
        enabled: false,
        firstAnchor: null,
        secondAnchor: null,
        snapMode: "selection",
        lastEditedSlot: "a",
      });
      return;
    }
    resetRendererState(rendererRef.current);
    setPanelOpen(false);
    setLayerVisibility(
      Object.fromEntries(
        scene.layers.map((layer) => [layer.id, layer.visibleByDefault]),
      ),
    );
    setSelectedObjectId(null);
    setSectionCut({ enabled: false, positionMm: Math.round(lengthMm / 2) });
    setOverlayVisibility({
      datumAxes: false,
      roofFallVectors: false,
      selectedMemberAxes: false,
    });
    setMeasurement({
      enabled: false,
      firstAnchor: null,
      secondAnchor: null,
      snapMode: "selection",
      lastEditedSlot: "a",
    });
  }, [lengthMm, scene]);

  const viewportRestoreSignature = `${viewportKey}:${
    viewportState?.cameraState ? "saved" : sceneBounds ? "ready" : "empty"
  }`;

  useEffect(() => {
    if (viewportRestoreSignatureRef.current === viewportRestoreSignature) return;
    if (!viewportState?.cameraState && !sceneBounds) {
      viewportRestoreSignatureRef.current = viewportRestoreSignature;
      return;
    }
    viewportRestoreSignatureRef.current = viewportRestoreSignature;
    setCameraState((current) => {
      const nextState = clampCameraStateToScene({
        state:
          viewportState?.cameraState ??
          defaultCameraStateForScene({
            sceneBounds,
            sceneFitDistance,
          }),
        sceneBounds,
      });
      return cameraStatesEqual(current, nextState) ? current : nextState;
    });
  }, [sceneBounds, sceneFitDistance, viewportRestoreSignature, viewportState]);

  useEffect(() => {
    setCameraState((current) =>
      clampCameraStateToScene({
        state: current,
        sceneBounds,
      }),
    );
  }, [sceneBounds]);

  useEffect(() => {
    setRectDiagnostic(
      rectDiagnostics(
        canvasShellRef.current,
        rendererRef.current?.domElement,
      ),
    );
  }, [sceneKey, sectionCut.enabled, allObjects.length]);

  useEffect(() => {
    return () => {
      disposeRenderer(rendererRef.current);
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.localClippingEnabled = sectionCut.enabled;
    }
  }, [sectionCut.enabled]);

  useEffect(() => {
    applyCameraPose(cameraState);
  }, [applyCameraPose, cameraState]);

  const clippingPlanes = useMemo(
    () =>
      sectionCut.enabled
        ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionCut.positionMm)]
        : [],
    [sectionCut.enabled, sectionCut.positionMm],
  );
  const sectionCutBoundary = useMemo(() => {
    if (!sceneBounds || !sectionCut.enabled) return null;
    const padding = Math.max(sceneBounds.size * 0.06, 200);
    const yMin = sceneBounds.min.y - padding;
    const yMax = sceneBounds.max.y + padding;
    const zMin = sceneBounds.min.z - padding;
    const zMax = sceneBounds.max.z + padding;
    const x = sectionCut.positionMm;
    return [
      { x, y: yMin, z: zMin },
      { x, y: yMax, z: zMin },
      { x, y: yMax, z: zMax },
      { x, y: yMin, z: zMax },
    ];
  }, [sceneBounds, sectionCut.enabled, sectionCut.positionMm]);
  const datumAxisLength = useMemo(
    () =>
      sceneBounds
        ? Math.min(Math.max(sceneBounds.size * 0.18, 450), 1400)
        : 800,
    [sceneBounds],
  );
  const roofFallVectorLength = useMemo(
    () =>
      sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.12, 280), 900) : 450,
    [sceneBounds],
  );
  const selectedAxisLength = useMemo(
    () =>
      sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.08, 220), 700) : 320,
    [sceneBounds],
  );

  if (!geometryPreview) {
    return (
      <section
        className={styles.state}
        aria-label="3D geometry viewport unavailable"
      >
        <h3 className={styles.stateTitle}>3D Unavailable</h3>
        <p className={styles.stateText}>
          This workbench context did not provide a geometry preview.
        </p>
      </section>
    );
  }

  if (geometryPreview.kind === "error") {
    return (
      <section className={styles.state} aria-label="3D geometry viewport error">
        <h3 className={styles.stateTitle}>3D Preview Error</h3>
        <p className={styles.stateText}>{geometryPreview.message}</p>
      </section>
    );
  }

  if (geometryPreview.kind === "unsupported") {
    return (
      <section
        className={styles.state}
        aria-label="3D geometry viewport unsupported"
      >
        <h3 className={styles.stateTitle}>3D Preview Unsupported</h3>
        <p className={styles.stateText}>{geometryPreview.message}</p>
        <p className={styles.stateMeta}>
          Preview mode: {previewModeLabel(geometryPreview.previewMode)}
        </p>
        {geometryPreview.validation ? (
          <p className={styles.stateMeta}>
            Validation: {geometryPreview.validation.status}
            {geometryPreview.validation.unsupportedReasons.length
              ? ` · ${geometryPreview.validation.unsupportedReasons.join(" | ")}`
              : ""}
          </p>
        ) : null}
      </section>
    );
  }

  if (!scene) {
    return (
      <section
        className={styles.state}
        aria-label="3D geometry viewport unavailable"
      >
        <h3 className={styles.stateTitle}>3D Unavailable</h3>
        <p className={styles.stateText}>
          This workbench context did not provide a renderable geometry scene.
        </p>
      </section>
    );
  }

  return (
    <section
      className={styles.viewport}
      aria-label="3D geometry verification viewport"
    >
      <div
        ref={canvasShellRef}
        className={styles.canvasShell}
        data-testid="geometry-3d-canvas-shell"
        data-native-selection-suppressed="true"
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          setSelectedObjectId(null);
        }}
      >
        <div
          className={styles.canvasToolbar}
          data-allow-native-selection="true"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={
                panelOpen ? styles.activeToolbarButton : styles.resetButton
              }
              onClick={() => setPanelOpen((current) => !current)}
            >
              Workspace panel
            </button>
          </div>
          <div className={styles.toolbarSpacer} />
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={styles.resetButton}
              onClick={fitScene}
            >
              Fit to scene
            </button>
          </div>
        </div>

        {panelOpen ? (
          <aside
            className={styles.workspacePanel}
            data-testid="workspace-panel"
            data-allow-native-selection="true"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <div className={styles.workspacePanelContent}>
              <div className={styles.workspacePanelHeader}>
                <p className={styles.workspacePanelTitle}>Workspace Panel</p>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={() => setPanelOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className={styles.panel}>
                <p className={styles.eyebrow}>3D Verification</p>
                <h3 className={styles.heading}>
                  {previewModeLabel(geometryPreview.previewMode)}
                </h3>
                <p className={styles.meta}>
                  Kernel validation: {geometryPreview.validation.status}
                </p>
                <p className={styles.meta}>
                  Family: {geometryPreview.config.family}
                </p>
              </div>

              <div className={styles.panel}>
                <p className={styles.eyebrow}>Layers</p>
                <div className={styles.layerList}>
                  {scene.layers.map((layer) => (
                    <label key={layer.id} className={styles.layerItem}>
                      <input
                        type="checkbox"
                        checked={Boolean(layerVisibility[layer.id])}
                        onChange={(event) =>
                          setLayerVisibility((current) => ({
                            ...current,
                            [layer.id]: event.target.checked,
                          }))
                        }
                      />
                      <span>{layer.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.panel} data-testid="inspection-panel">
                <p className={styles.eyebrow}>Inspection</p>
                <div className={styles.sectionBlock}>
                  <label className={styles.layerItem}>
                    <input
                      type="checkbox"
                      checked={sectionCut.enabled}
                      onChange={(event) =>
                        setSectionCut((current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    <span>Section cut</span>
                  </label>
                  <label className={styles.sliderField}>
                    <span className={styles.sliderLabel}>
                      Section position (mm)
                    </span>
                    <input
                      data-testid="section-cut-slider"
                      aria-label="Section position (mm)"
                      type="range"
                      min="0"
                      max={String(lengthMm)}
                      step="10"
                      value={String(sectionCut.positionMm)}
                      onChange={(event) =>
                        setSectionCut((current) => ({
                          ...current,
                          positionMm: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <div className={styles.sectionMetaRow}>
                    <p className={styles.meta}>
                      Cut X: {Math.round(sectionCut.positionMm)} mm
                    </p>
                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={() =>
                        setSectionCut((current) => ({
                          ...current,
                          positionMm: Math.round(lengthMm / 2),
                        }))
                      }
                    >
                      Center
                    </button>
                  </div>
                </div>

                <div className={styles.sectionBlock}>
                  <p className={styles.eyebrow}>Debug Overlays</p>
                  <div className={styles.layerList}>
                    <label className={styles.layerItem}>
                      <input
                        type="checkbox"
                        checked={overlayVisibility.datumAxes}
                        onChange={(event) =>
                          setOverlayVisibility((current) => ({
                            ...current,
                            datumAxes: event.target.checked,
                          }))
                        }
                      />
                      <span>Datum axes</span>
                    </label>
                    <label className={styles.layerItem}>
                      <input
                        type="checkbox"
                        checked={overlayVisibility.roofFallVectors}
                        onChange={(event) =>
                          setOverlayVisibility((current) => ({
                            ...current,
                            roofFallVectors: event.target.checked,
                          }))
                        }
                      />
                      <span>Roof fall vectors</span>
                    </label>
                    <label className={styles.layerItem}>
                      <input
                        type="checkbox"
                        checked={overlayVisibility.selectedMemberAxes}
                        onChange={(event) =>
                          setOverlayVisibility((current) => ({
                            ...current,
                            selectedMemberAxes: event.target.checked,
                          }))
                        }
                      />
                      <span>Selected member axes</span>
                    </label>
                  </div>
                </div>

                <div
                  className={styles.sectionBlock}
                  data-testid="measurement-panel"
                >
                  <p className={styles.eyebrow}>Measurement</p>
                  <label className={styles.layerItem}>
                    <input
                      type="checkbox"
                      checked={measurement.enabled}
                      onChange={(event) =>
                        setMeasurement((current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    <span>Enable measurement</span>
                  </label>
                  <div className={styles.buttonRow}>
                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={() =>
                        setMeasurement((current) => ({
                          ...current,
                          firstAnchor: null,
                          secondAnchor: null,
                          snapMode: "selection",
                          lastEditedSlot: "a",
                        }))
                      }
                    >
                      Clear probe
                    </button>
                    <button
                      type="button"
                      className={styles.resetButton}
                      disabled={!measurement.enabled}
                      onClick={useDatumOriginAnchor}
                    >
                      Use datum origin
                    </button>
                  </div>
                  <dl className={styles.measurementList}>
                    <div className={styles.inspectorRow}>
                      <dt>A source</dt>
                      <dd>{measurementA?.objectId ?? "Not set"}</dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>A anchor</dt>
                      <dd>
                        {measurementA
                          ? formatAnchorType(measurementA.anchorType)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>A point</dt>
                      <dd>
                        {measurementA
                          ? formatPoint(measurementA.point)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>B source</dt>
                      <dd>{measurementB?.objectId ?? "Not set"}</dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>B anchor</dt>
                      <dd>
                        {measurementB
                          ? formatAnchorType(measurementB.anchorType)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>B point</dt>
                      <dd>
                        {measurementB
                          ? formatPoint(measurementB.point)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>ΔX</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(measurementDeltaPoint.x)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>ΔY</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(measurementDeltaPoint.y)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>ΔZ</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(measurementDeltaPoint.z)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>3D distance</dt>
                      <dd>
                        {measurementDistanceMm != null
                          ? formatDistanceMm(measurementDistanceMm)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>Plan distance</dt>
                      <dd>
                        {measurementPlanDistanceMm != null
                          ? formatDistanceMm(measurementPlanDistanceMm)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>Rise/fall</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(Math.abs(measurementDeltaPoint.z))
                          : "Not set"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className={styles.panel}>
                <p className={styles.eyebrow}>Inspector</p>
                {measurement.enabled && selectedObjectSupportsAnchorSwitch ? (
                  <div className={styles.anchorSwitchRow}>
                    {(
                      [
                        ["start", "Start"],
                        ["midpoint", "Mid"],
                        ["end", "End"],
                      ] as const
                    ).map(([anchorType, label]) => (
                      <button
                        key={anchorType}
                        type="button"
                        className={
                          selectedAnchorType === anchorType
                            ? styles.activeToolbarButton
                            : styles.resetButton
                        }
                        onClick={() => switchSelectedAnchorType(anchorType)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <dl className={styles.inspectorList}>
                  <div className={styles.inspectorRow}>
                    <dt>Focus</dt>
                    <dd>{formatCameraFocusMode(cameraState.focusMode)}</dd>
                  </div>
                  <div className={styles.inspectorRow}>
                    <dt>Target</dt>
                    <dd>{formatPoint(cameraState.target)}</dd>
                  </div>
                  <div className={styles.inspectorRow}>
                    <dt>View</dt>
                    <dd>{formatCameraPreset(cameraState.viewPreset)}</dd>
                  </div>
                  {sectionCut.enabled ? (
                    <div className={styles.inspectorRow}>
                      <dt>Section cut</dt>
                      <dd>
                        Active at X = {Math.round(sectionCut.positionMm)} mm
                      </dd>
                    </div>
                  ) : null}
                  {measurement.enabled ? (
                    <>
                      <div className={styles.inspectorRow}>
                        <dt>Probe A</dt>
                        <dd>
                          {measurementA
                            ? formatPoint(measurementA.point)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe B</dt>
                        <dd>
                          {measurementB
                            ? formatPoint(measurementB.point)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe ΔX</dt>
                        <dd>
                          {measurementDeltaPoint
                            ? formatDistanceMm(measurementDeltaPoint.x)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe ΔY</dt>
                        <dd>
                          {measurementDeltaPoint
                            ? formatDistanceMm(measurementDeltaPoint.y)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe ΔZ</dt>
                        <dd>
                          {measurementDeltaPoint
                            ? formatDistanceMm(measurementDeltaPoint.z)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe 3D</dt>
                        <dd>
                          {measurementDistanceMm != null
                            ? formatDistanceMm(measurementDistanceMm)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe plan</dt>
                        <dd>
                          {measurementPlanDistanceMm != null
                            ? formatDistanceMm(measurementPlanDistanceMm)
                            : "Not set"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  {objectSummary(selectedObject).map((entry) => (
                    <div key={entry.label} className={styles.inspectorRow}>
                      <dt>{entry.label}</dt>
                      <dd>{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </aside>
        ) : null}

        <div
          aria-hidden="true"
          className={styles.viewportDiagnostics}
          data-testid="geometry-3d-viewport-diagnostics"
          data-scene-key={sceneKey}
          data-scene-object-count={String(allObjects.length)}
          data-layer-count={String(scene?.layers.length ?? 0)}
          data-finite-bounds={String(finiteBounds)}
          data-finite-bounds-min={sceneBounds && finiteBounds ? formatVector(sceneBounds.min) : ""}
          data-finite-bounds-max={sceneBounds && finiteBounds ? formatVector(sceneBounds.max) : ""}
          data-finite-bounds-size={sceneBounds && finiteBounds ? String(Number(sceneBounds.size.toFixed(3))) : ""}
          data-house-roof-qa-status={houseRoofDiagnostics.qaStatus}
          data-house-roof-qa-failure-reason={houseRoofDiagnostics.qaFailureReason}
          data-house-roof-topology-final-face-count={String(houseRoofDiagnostics.topologyFinalFaceCount)}
          data-house-roof-topology-valley-count={String(houseRoofDiagnostics.topologyValleyCount)}
          data-house-roof-topology-disconnected-source-face-count={String(houseRoofDiagnostics.topologyDisconnectedSourceFaceCount)}
          data-house-roof-topology-internal-eave-height-segment-count={String(houseRoofDiagnostics.topologyInternalEaveHeightSegmentCount)}
          data-house-roof-solid-expected-count={String(houseRoofDiagnostics.expectedSolidCount)}
          data-house-roof-solid-rendered-count={String(houseRoofDiagnostics.renderedSolidCount)}
          data-house-roof-solid-skipped-count={String(houseRoofDiagnostics.skippedSolidCount)}
          data-house-opening-count={String(houseOpeningDiagnostics.totalCount)}
          data-house-opening-valid-count={String(houseOpeningDiagnostics.validCount)}
          data-house-opening-host-edge-resolved-count={String(houseOpeningDiagnostics.hostEdgeResolvedCount)}
          data-house-opening-host-edge-unresolved-count={String(houseOpeningDiagnostics.hostEdgeUnresolvedCount)}
          data-house-opening-rendered-marker-count={String(houseOpeningDiagnostics.renderedMarkerCount)}
          data-house-opening-skipped-invalid-count={String(houseOpeningDiagnostics.skippedInvalidCount)}
          data-house-opening-unresolved-valid-count={String(houseOpeningDiagnostics.unresolvedValidCount)}
          data-top-view-screen-axis={cameraState.viewPreset === "top" ? "world_x_left_world_y_down" : ""}
          data-clipping-enabled={String(sectionCut.enabled)}
          data-selected-object-id={selectedObjectId ?? ""}
          data-hovered-object-id={controlledHoveredObjectId ?? ""}
          data-shell-width={String(rectDiagnostic.shellWidth)}
          data-shell-height={String(rectDiagnostic.shellHeight)}
          data-canvas-width={String(rectDiagnostic.canvasWidth)}
          data-canvas-height={String(rectDiagnostic.canvasHeight)}
          data-canvas-contained={String(rectDiagnostic.canvasContained)}
        />

        <Canvas
          key={useOrthographicTopCamera ? "top-orthographic" : "perspective"}
          className={styles.canvas}
          orthographic={useOrthographicTopCamera}
          camera={initialCamera}
          data-testid="geometry-3d-canvas"
          onCreated={handleCanvasCreated}
        >
          <color attach="background" args={["#f4f1ea"]} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[1, -1, 1.5]} intensity={1.1} />
          {sectionCutBoundary ? (
            <SectionCutHint boundary={sectionCutBoundary} />
          ) : null}
          {overlayVisibility.datumAxes ? (
            <group data-testid="datum-axes">
              <ArrowOverlay
                testId="datum-axis-x"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(
                  geometryPreview.assembly.datum.origin,
                  geometryPreview.assembly.datum.xAxis,
                  datumAxisLength,
                )}
                color="#c44141"
              />
              <ArrowOverlay
                testId="datum-axis-y"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(
                  geometryPreview.assembly.datum.origin,
                  geometryPreview.assembly.datum.yAxis,
                  datumAxisLength,
                )}
                color="#2e8f4f"
              />
              <ArrowOverlay
                testId="datum-axis-z"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(
                  geometryPreview.assembly.datum.origin,
                  geometryPreview.assembly.datum.zAxis,
                  datumAxisLength,
                )}
                color="#3d67ba"
              />
            </group>
          ) : null}
          {displayMode === "pergolas" && overlayVisibility.roofFallVectors
            ? geometryPreview.assembly.roofPlanes.map((roofPlane) => {
                const start = centroid(roofPlane.boundary);
                const normalizedFall = pointToVector({
                  x: roofPlane.fallVector.x,
                  y: roofPlane.fallVector.y,
                  z: roofPlane.fallVector.z,
                }).normalize();
                const end = vectorToPoint(
                  pointToVector(start).add(
                    normalizedFall.multiplyScalar(roofFallVectorLength),
                  ),
                );
                return (
                  <ArrowOverlay
                    key={roofPlane.id}
                    testId={`roof-fall-vector-${roofPlane.id}`}
                    start={start}
                    end={end}
                    color="#c28a1e"
                  />
                );
              })
            : null}
          {overlayVisibility.selectedMemberAxes && selectedMember ? (
            <group data-testid="selected-member-axes">
              <ArrowOverlay
                testId="selected-member-axis-x"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(
                  selectedMember.localFrame.origin,
                  selectedMember.localFrame.xAxis,
                  selectedAxisLength,
                )}
                color="#c44141"
              />
              <ArrowOverlay
                testId="selected-member-axis-y"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(
                  selectedMember.localFrame.origin,
                  selectedMember.localFrame.yAxis,
                  selectedAxisLength,
                )}
                color="#2e8f4f"
              />
              <ArrowOverlay
                testId="selected-member-axis-z"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(
                  selectedMember.localFrame.origin,
                  selectedMember.localFrame.zAxis,
                  selectedAxisLength,
                )}
                color="#3d67ba"
              />
            </group>
          ) : null}
          {measurement.enabled ? (
            <MeasurementProbeOverlay
              firstAnchor={measurementA}
              secondAnchor={measurementB}
              clippingPlanes={clippingPlanes}
              markerRadiusMm={measurementMarkerRadiusMm}
            />
          ) : null}
          {scene.layers.flatMap((layer) =>
            layerVisibility[layer.id] !== false
              ? layer.objects.map((object) => {
                  // Cross-viewport hover matching: scene objects carry both
                  // a 3D-scene `id` ("house-solid-deck-1") and an optional
                  // workbench-level source id ("deck-1") that lives EITHER
                  // at `object.sourceId` (set on surfaces) OR
                  // `object.metadata.sourceId` (set on solids built via
                  // `house/envelopeSolids.ts`). PlanViewport emits the
                  // workbench-level id (via `topProjectionShapeClassifier`);
                  // the 3D side matches against either form so a plan hover
                  // on "deck-1" highlights the matching scene prism without
                  // the parent needing to know the prism naming scheme.
                  // Selection still uses raw `id` because the existing
                  // selection contract already produces 3D-scene ids on
                  // click.
                  const workbenchId =
                    ("sourceId" in object && typeof object.sourceId === "string"
                      ? object.sourceId
                      : null) ??
                    (typeof object.metadata?.sourceId === "string"
                      ? object.metadata.sourceId
                      : null);
                  const hovered =
                    controlledHoveredObjectId != null &&
                    (controlledHoveredObjectId === object.id ||
                      controlledHoveredObjectId === workbenchId);
                  return (
                    <SceneObjectNode
                      key={object.id}
                      object={object}
                      color={LAYER_COLORS[layer.id] ?? "#6c7a86"}
                      selected={selectedObjectId === object.id}
                      hovered={hovered}
                      onSelect={handleObjectSelect}
                      onHoverEnter={() =>
                        handleObjectHoverEnter(workbenchId ?? object.id)
                      }
                      onHoverLeave={() =>
                        handleObjectHoverLeave(workbenchId ?? object.id)
                      }
                      onFocus={focusObjectById}
                      clippingPlanes={clippingPlanes}
                    />
                  );
                })
              : [],
          )}
          <OrbitControls
            ref={handleControlsRef}
            makeDefault
            enablePan
            enableRotate={lockedViewPreset !== "top"}
            enableZoom
            target={[
              cameraState.target.x,
              cameraState.target.y,
              cameraState.target.z,
            ]}
            enableDamping
            dampingFactor={0.12}
            screenSpacePanning
            zoomToCursor
            rotateSpeed={0.72}
            panSpeed={0.9}
            zoomSpeed={ORBIT_ZOOM_SPEED}
            minDistance={
              sceneBounds ? Math.max(sceneBounds.size * 0.18, 250) : 250
            }
            maxDistance={
              sceneBounds ? Math.max(sceneBounds.size * 14, 14000) : 14000
            }
            minPolarAngle={0.04}
            maxPolarAngle={Math.PI - 0.08}
            mouseButtons={{
              // Mirror the touch bindings: left-button drag rotates in 3D
              // and pans in Plan view. This makes one-finger trackpad drag
              // do the natural thing on laptops, while desktop mice get the
              // standard left-drag-to-rotate convention. Right-button drag
              // stays bound to the same action as a fallback for users who
              // prefer right-click navigation.
              LEFT:
                lockedViewPreset === "top"
                  ? THREE.MOUSE.PAN
                  : THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT:
                lockedViewPreset === "top"
                  ? THREE.MOUSE.PAN
                  : THREE.MOUSE.ROTATE,
            }}
            touches={{
              ONE:
                lockedViewPreset === "top"
                  ? THREE.TOUCH.PAN
                  : THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN,
            }}
            onEnd={() => {
              const controls = controlsRef.current;
              const camera = cameraRef.current;
              const sceneCenter = sceneBounds?.center;
              if (!controls || !camera || !sceneCenter) return;

              const nextTarget = {
                x: controls.target.x,
                y: controls.target.y,
                z: controls.target.z,
              };
              const nextPosition = {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
              };
              const nextFocusMode: GeometryCameraFocusMode = pointsRoughlyEqual(
                nextTarget,
                sceneCenter,
                focusToleranceMm,
              )
                ? "scene"
                : selectedFocusPoint &&
                    pointsRoughlyEqual(
                      nextTarget,
                      selectedFocusPoint,
                      focusToleranceMm,
                    )
                  ? "selection"
                  : "manual";

              persistCameraState({
                position: nextPosition,
                target: nextTarget,
                distanceMm: camera.position.distanceTo(controls.target),
                viewPreset:
                  lockedViewPreset && lockedViewPreset !== "custom"
                    ? lockedViewPreset
                    : "custom",
                focusMode: nextFocusMode,
              });
            }}
          />
        </Canvas>
      </div>
    </section>
  );
}
