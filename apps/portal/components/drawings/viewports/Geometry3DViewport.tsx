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
import type { WorkbenchMode } from "@/lib/drawings/state/houseFirstWorkbenchModel";
import { blockNativeSelectionEvent } from "./nativeSelection";
import styles from "./Geometry3DViewport.module.css";

const ORBIT_MOUSE_DISABLED = -1 as THREE.MOUSE;

const HOUSE_DISPLAY_LAYER_IDS = new Set(["house", "house_roof_materials"]);
type AttachmentSide = "rear" | "front" | "left" | "right";

type SceneBounds = {
  min: Point3;
  max: Point3;
  center: Point3;
  size: number;
};

function sceneForDisplayMode(
  scene: ViewerSceneModel,
  displayMode: WorkbenchMode,
): ViewerSceneModel {
  if (displayMode !== "house") return scene;
  return {
    ...scene,
    layers: scene.layers.filter((layer) => HOUSE_DISPLAY_LAYER_IDS.has(layer.id)),
  };
}

type SectionCutState = {
  enabled: boolean;
  positionMm: number;
};

type OverlayVisibility = {
  datumAxes: boolean;
  roofFallVectors: boolean;
  selectedMemberAxes: boolean;
};

type MeasurementAnchorType =
  | "start"
  | "midpoint"
  | "end"
  | "centroid"
  | "datum_origin";

type MeasurementAnchor = {
  id: string;
  objectId: string | "datum-origin";
  anchorType: MeasurementAnchorType;
  point: Point3;
};

type MeasurementState = {
  enabled: boolean;
  firstAnchor: MeasurementAnchor | null;
  secondAnchor: MeasurementAnchor | null;
  snapMode: "selection" | "datum";
  lastEditedSlot: "a" | "b";
};

export type GeometryCameraPreset = "iso" | "front" | "right" | "top" | "custom";

export type GeometryCameraFocusMode = "scene" | "selection" | "manual";

export type GeometryCameraState = {
  position: Point3;
  target: Point3;
  distanceMm: number;
  viewPreset: GeometryCameraPreset;
  focusMode: GeometryCameraFocusMode;
};

export type Geometry3DViewportState = {
  cameraState: GeometryCameraState;
};

type ViewportRectDiagnostics = {
  shellWidth: number;
  shellHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasContained: boolean;
};

type HouseRoofViewportDiagnostics = {
  qaStatus: string;
  qaFailureReason: string;
  topologyFinalFaceCount: number;
  topologyValleyCount: number;
  topologyDisconnectedSourceFaceCount: number;
  topologyInternalEaveHeightSegmentCount: number;
  expectedSolidCount: number;
  renderedSolidCount: number;
  skippedSolidCount: number;
};

type HouseOpeningViewportDiagnostics = {
  totalCount: number;
  validCount: number;
  hostEdgeResolvedCount: number;
  hostEdgeUnresolvedCount: number;
  renderedMarkerCount: number;
  skippedInvalidCount: number;
  unresolvedValidCount: number;
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

const MIN_RENDERABLE_POLYGON_AREA_MM2 = 1;
const POLYGON_TRIANGULATION_EPSILON_MM = 1e-6;

function linePoints(line: { start: Point3; end: Point3 }): Point3[] {
  return [line.start, line.end];
}

function isFinitePoint(point: Point3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  );
}

function isRenderableRenderMesh(mesh: RenderMesh3D | undefined): mesh is RenderMesh3D {
  return Boolean(
    mesh &&
      mesh.vertices.length >= 3 &&
      mesh.faces.length > 0 &&
      mesh.vertices.every(isFinitePoint) &&
      mesh.faces.every((face) =>
        face.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length),
      ),
  );
}

function renderMeshPoints(mesh: RenderMesh3D | undefined): Point3[] {
  return isRenderableRenderMesh(mesh) ? mesh.vertices : [];
}

function isRenderableLine(line: { start: Point3; end: Point3 }): boolean {
  if (!isFinitePoint(line.start) || !isFinitePoint(line.end)) return false;
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const dz = line.end.z - line.start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.001;
}

function polygonArea3D(points: Point3[]): number {
  if (points.length < 3) return 0;
  const origin = points[0]!;
  let area = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = {
      x: points[index]!.x - origin.x,
      y: points[index]!.y - origin.y,
      z: points[index]!.z - origin.z,
    };
    const b = {
      x: points[index + 1]!.x - origin.x,
      y: points[index + 1]!.y - origin.y,
      z: points[index + 1]!.z - origin.z,
    };
    const cross = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
    area += Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2;
  }
  return area;
}

function uniquePointCount(points: Point3[]): number {
  return new Set(
    points.map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`),
  ).size;
}

function isRenderablePolygon(points: Point3[]): boolean {
  return (
    points.length >= 3 &&
    points.every(isFinitePoint) &&
    uniquePointCount(points) >= 3 &&
    polygonArea3D(points) > MIN_RENDERABLE_POLYGON_AREA_MM2
  );
}

function allSceneBoundsFinite(bounds: SceneBounds | null): boolean {
  if (!bounds) return false;
  return [
    bounds.min.x,
    bounds.min.y,
    bounds.min.z,
    bounds.max.x,
    bounds.max.y,
    bounds.max.z,
    bounds.center.x,
    bounds.center.y,
    bounds.center.z,
    bounds.size,
  ].every(Number.isFinite);
}

function rectContains(outer: DOMRect, inner: DOMRect): boolean {
  const tolerancePx = 1;
  return (
    inner.left >= outer.left - tolerancePx &&
    inner.top >= outer.top - tolerancePx &&
    inner.right <= outer.right + tolerancePx &&
    inner.bottom <= outer.bottom + tolerancePx
  );
}

function rectDiagnostics(
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

function sceneMetadataString(scene: ViewerSceneModel, key: string): string | null {
  const value = scene.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function sceneMetadataNumber(scene: ViewerSceneModel, key: string): number | null {
  const value = scene.metadata?.[key];
  return typeof value === "number" ? value : null;
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

function collectHouseOpeningViewportDiagnostics(
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

function metadataAttachmentSide(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): AttachmentSide | null {
  const value = metadata?.[key];
  return value === "rear" || value === "front" || value === "left" || value === "right"
    ? value
    : null;
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

function pointToVector(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function vectorToPoint(vector: THREE.Vector3): Point3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function formatVector(vector: { x: number; y: number; z: number }): string {
  return `${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)}`;
}

function centroid(points: Point3[]): Point3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  const total = points.reduce(
    (current, point) => ({
      x: current.x + point.x,
      y: current.y + point.y,
      z: current.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

function offsetPoint(
  origin: Point3,
  direction: { x: number; y: number; z: number },
  distance: number,
): Point3 {
  const vector = pointToVector(origin).add(
    new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(
      distance,
    ),
  );
  return vectorToPoint(vector);
}

function formatPoint(point: Point3): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)} mm`;
}

function formatCameraFocusMode(focusMode: GeometryCameraFocusMode): string {
  if (focusMode === "scene") return "Scene";
  if (focusMode === "selection") return "Selected";
  return "Manual";
}

function formatCameraPreset(viewPreset: GeometryCameraPreset): string {
  if (viewPreset === "iso") return "Iso";
  if (viewPreset === "front") return "Front";
  if (viewPreset === "right") return "Right";
  if (viewPreset === "custom") return "Custom";
  return "Top";
}

function midpoint(start: Point3, end: Point3): Point3 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  };
}

function formatAnchorType(anchorType: MeasurementAnchorType): string {
  return anchorType === "datum_origin" ? "datum origin" : anchorType;
}

function boundingSize(points: Point3[]): number {
  if (points.length === 0) return 1000;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
    1000,
  );
}

function pointsForObject(object: ViewerSceneObject): Point3[] {
  if (object.type === "member_prism")
    return linePoints(object.centerline).filter(isFinitePoint);
  if (object.type === "roof_plane" || object.type === "roof_cladding_panel")
    return object.boundary.filter(isFinitePoint);
  if (object.type === "roof_flashing")
    return object.wings.flatMap((wing) =>
      wing.boundary.filter(isFinitePoint),
    );
  if (object.type === "house_roof_material")
    return object.lines.flatMap((line) => linePoints(line)).filter(isFinitePoint);
  if (object.type === "reference_line")
    return linePoints(object.line).filter(isFinitePoint);
  if (object.type === "house_line")
    return isRenderableLine(object.line) ? linePoints(object.line) : [];
  if (object.type === "house_surface")
    return isRenderablePolygon(object.boundary) ? object.boundary : [];
  if (object.type === "house_surface_solid") {
    const meshPoints = renderMeshPoints(object.renderMesh);
    if (meshPoints.length) return meshPoints;
    return isRenderablePolygon(object.boundary) ? object.boundary : [];
  }
  if (object.type === "house_linear_solid") {
    const meshPoints = renderMeshPoints(object.renderMesh);
    if (meshPoints.length) return meshPoints;
    return isRenderableLine(object.centerline)
      ? linePoints(object.centerline)
      : [];
  }
  return object.boundary.filter(isFinitePoint);
}

function focusPointForObject(object: ViewerSceneObject): Point3 {
  if (object.type === "member_prism")
    return midpoint(object.centerline.start, object.centerline.end);
  if (object.type === "reference_line" || object.type === "house_line")
    return midpoint(object.line.start, object.line.end);
  if (object.type === "house_linear_solid") {
    const points = pointsForObject(object);
    return points.length
      ? centroid(points)
      : midpoint(object.centerline.start, object.centerline.end);
  }
  return centroid(pointsForObject(object));
}

function supportsEndpointAnchors(
  object: ViewerSceneObject | null,
): object is
  | ViewerSceneMemberPrismObject
  | ViewerSceneReferenceLineObject
  | ViewerSceneHouseLineObject
  | ViewerSceneHouseLinearSolidObject {
  return (
    object?.type === "member_prism" ||
    object?.type === "reference_line" ||
    object?.type === "house_line" ||
    object?.type === "house_linear_solid"
  );
}

function resolveAnchorPoint(
  object: ViewerSceneObject,
  anchorType: MeasurementAnchorType,
): Point3 {
  if (object.type === "member_prism") {
    if (anchorType === "start") return object.centerline.start;
    if (anchorType === "end") return object.centerline.end;
    return midpoint(object.centerline.start, object.centerline.end);
  }

  if (object.type === "reference_line" || object.type === "house_line") {
    if (anchorType === "start") return object.line.start;
    if (anchorType === "end") return object.line.end;
    return midpoint(object.line.start, object.line.end);
  }

  if (object.type === "house_linear_solid") {
    if (anchorType === "start") return object.centerline.start;
    if (anchorType === "end") return object.centerline.end;
    return midpoint(object.centerline.start, object.centerline.end);
  }

  return centroid(pointsForObject(object));
}

function defaultAnchorTypeForObject(
  object: ViewerSceneObject,
): MeasurementAnchorType {
  if (
    object.type === "member_prism" ||
    object.type === "reference_line" ||
    object.type === "house_line" ||
    object.type === "house_linear_solid"
  )
    return "midpoint";
  return "centroid";
}

function buildMeasurementAnchor(
  object: ViewerSceneObject,
  anchorType = defaultAnchorTypeForObject(object),
): MeasurementAnchor {
  return {
    id: `${object.id}:${anchorType}`,
    objectId: object.id,
    anchorType,
    point: resolveAnchorPoint(object, anchorType),
  };
}

function buildDatumOriginAnchor(point: Point3): MeasurementAnchor {
  return {
    id: "datum-origin",
    objectId: "datum-origin",
    anchorType: "datum_origin",
    point,
  };
}

function formatDistanceMm(distanceMm: number): string {
  return `${Math.round(distanceMm)} mm`;
}

function measurementDelta(a: Point3 | null, b: Point3 | null): Point3 | null {
  if (!a || !b) return null;
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z,
  };
}

function measurementDistance(
  a: Point3 | null,
  b: Point3 | null,
): number | null {
  if (!a || !b) return null;
  return pointDistance(a, b);
}

function measurementPlanDistance(
  a: Point3 | null,
  b: Point3 | null,
): number | null {
  const delta = measurementDelta(a, b);
  if (!delta) return null;
  return Math.sqrt(delta.x * delta.x + delta.y * delta.y);
}

function fitDistanceForSize(size: number, fovDeg = 40): number {
  const radius = Math.max(size, 1000) / 2;
  const fovRadians = THREE.MathUtils.degToRad(fovDeg / 2);
  return Math.max((radius / Math.tan(fovRadians)) * 1.25, 1200);
}

function directionForPreset(viewPreset: GeometryCameraPreset): THREE.Vector3 {
  if (viewPreset === "front") return new THREE.Vector3(0, -1, 0.28).normalize();
  if (viewPreset === "right") return new THREE.Vector3(1, 0, 0.28).normalize();
  if (viewPreset === "top")
    return new THREE.Vector3(0.06, -0.06, 1).normalize();
  return new THREE.Vector3(1, -1.15, 0.82).normalize();
}

function pointDistance(a: Point3, b: Point3): number {
  return pointToVector(a).distanceTo(pointToVector(b));
}

function pointsRoughlyEqual(
  a: Point3,
  b: Point3,
  toleranceMm: number,
): boolean {
  return pointDistance(a, b) <= toleranceMm;
}

function positionFromDirection(
  target: Point3,
  direction: THREE.Vector3,
  distanceMm: number,
): Point3 {
  const next = pointToVector(target).add(
    direction.clone().multiplyScalar(distanceMm),
  );
  return vectorToPoint(next);
}

function directionFromCameraState(state: GeometryCameraState): THREE.Vector3 {
  const direction = pointToVector(state.position).sub(
    pointToVector(state.target),
  );
  if (direction.lengthSq() < 1e-6) {
    const fallbackPreset =
      state.viewPreset === "custom" ? "iso" : state.viewPreset;
    return directionForPreset(fallbackPreset);
  }
  return direction.normalize();
}

function buildPresetCameraState({
  target,
  distanceMm,
  viewPreset,
  focusMode,
}: {
  target: Point3;
  distanceMm: number;
  viewPreset: Exclude<GeometryCameraPreset, "custom">;
  focusMode: GeometryCameraFocusMode;
}): GeometryCameraState {
  const direction = directionForPreset(viewPreset);
  return {
    position: positionFromDirection(target, direction, distanceMm),
    target,
    distanceMm,
    viewPreset,
    focusMode,
  };
}

function defaultCameraStateForScene(input: {
  sceneBounds: SceneBounds | null;
  sceneFitDistance: number;
}): GeometryCameraState {
  if (!input.sceneBounds) {
    return buildPresetCameraState({
      target: { x: 0, y: 0, z: 500 },
      distanceMm: fitDistanceForSize(2000),
      viewPreset: "iso",
      focusMode: "scene",
    });
  }
  return buildPresetCameraState({
    target: input.sceneBounds.center,
    distanceMm: input.sceneFitDistance,
    viewPreset: "iso",
    focusMode: "scene",
  });
}

function cameraStatesEqual(a: GeometryCameraState, b: GeometryCameraState): boolean {
  return (
    a.distanceMm === b.distanceMm &&
    a.viewPreset === b.viewPreset &&
    a.focusMode === b.focusMode &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z &&
    a.target.x === b.target.x &&
    a.target.y === b.target.y &&
    a.target.z === b.target.z
  );
}

function clampCameraStateToScene(input: {
  state: GeometryCameraState;
  sceneBounds: SceneBounds | null;
}): GeometryCameraState {
  if (!input.sceneBounds) return input.state;
  const minDistance = Math.max(input.sceneBounds.size * 0.18, 250);
  const maxDistance = Math.max(input.sceneBounds.size * 14, 14000);
  const nextDistance = Math.min(Math.max(input.state.distanceMm, minDistance), maxDistance);
  if (nextDistance === input.state.distanceMm) return input.state;
  return {
    ...input.state,
    position: positionFromDirection(
      input.state.target,
      directionFromCameraState(input.state),
      nextDistance,
    ),
    distanceMm: nextDistance,
  };
}

function formatMetadata(metadata: ViewerSceneObject["metadata"]): string {
  if (!metadata) return "None";
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

function metadataText(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function metadataNumber(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

function formatDiagnosticToken(value: string): string {
  return value.replace(/_/g, " ");
}

function houseRoofQaSummary(
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

function previewModeLabel(previewMode: GeometryPreviewMode): string {
  if (previewMode === "snapshot_validated") return "Snapshot Validated";
  if (previewMode === "snapshot_local_resolved") return "Snapshot Resolved Locally";
  return "Draft Resolved Locally";
}

function objectSummary(
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

  if (object.type === "house_roof_material") {
    return [
      { label: "Object", value: object.id },
      { label: "Type", value: "house roof material" },
      { label: "Material", value: object.material.replace(/_/g, " ") },
      { label: "Profile", value: object.profileKind },
      { label: "Roof plane", value: object.roofPlaneId },
      { label: "Lines", value: `${object.lines.length}` },
      { label: "Spacing", value: `${Math.round(object.spacingMm)} mm` },
      { label: "Surface offset", value: `${Math.round(object.surfaceOffsetMm)} mm` },
      { label: "Plane origin", value: formatPoint(object.plane.origin) },
      { label: "Plane normal", value: formatVector(object.plane.normal) },
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

function pickableAttachedDeckHostEdgeSide(
  object: ViewerSceneObject | null,
): AttachmentSide | null {
  if (!object) return null;
  if (object.type === "house_surface_solid" && object.kind === "wall") {
    return metadataAttachmentSide(object.metadata, "hostEdgeSide");
  }
  if (object.type === "house_surface" && object.kind === "wall") {
    return metadataAttachmentSide(object.metadata, "hostEdgeSide");
  }
  return null;
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
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseSurfaceSolidObject;
  color: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () => {
      if (object.kind === "wall") {
        return buildPolygonGeometry(object.boundary);
      }
      return (
        buildRenderMeshGeometry(object.renderMesh) ??
        buildPolygonSlabGeometry(object.boundary, object.plane, object.thicknessMm)
      );
    },
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
  const deckMaterial = isDeck ? resolveDeckMaterial(object) : null;
  const deckPalette = isDeck && deckMaterial ? resolveDeckPalette(deckMaterial) : null;
  const deckMuted = isDeck && !selected;
  const bodyOpacity = isDeck ? (selected ? 0.82 : 0.4) : opacity;
  const topOpacity = isDeck ? (selected ? 0.98 : 0.74) : opacity;
  const outlineOpacity = isDeck ? (selected ? 1 : 0.58) : 1;
  const grooveOpacity = isDeck ? (selected ? 0.8 : 0.32) : 1;
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
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneObject;
  color: string;
  selected: boolean;
  onSelect: (id: string) => void;
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
        onSelect={onSelect}
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
  displayMode = "pergolas",
  viewportKey = "geometry3d",
  viewportState,
  onViewportStateChange,
  pendingAttachedDeckHostEdgePick = false,
  onPickAttachedDeckHostEdge,
}: {
  geometryPreview?: GeometryPreviewState | null;
  displayMode?: WorkbenchMode;
  viewportKey?: string;
  viewportState?: Geometry3DViewportState | null;
  onViewportStateChange?: (next: Geometry3DViewportState) => void;
  pendingAttachedDeckHostEdgePick?: boolean;
  onPickAttachedDeckHostEdge?: (side: AttachmentSide) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
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
        viewPreset: "iso",
        focusMode: "scene",
      }),
  );
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
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
    () => (rawScene ? sceneForDisplayMode(rawScene, displayMode) : null),
    [displayMode, rawScene],
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
  const initialCamera = useMemo(() => {
    if (!sceneBounds) {
      return {
        position: [1800, -1800, 1400] as [number, number, number],
        near: 1,
        far: 40000,
        fov: 40,
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
      position: [cameraPosition.x, cameraPosition.y, cameraPosition.z] as [
        number,
        number,
        number,
      ],
      near: 1,
      far: Math.max(sceneBounds.size * 10, 40000),
      fov: 40,
    };
  }, [sceneBounds, sceneFitDistance]);

  const applyCameraPose = useCallback(
    (nextState: GeometryCameraState) => {
      if (!sceneBounds || !cameraRef.current || !controlsRef.current) return;

      const camera = cameraRef.current;
      const controls = controlsRef.current;

      camera.up.set(0, 0, 1);
      camera.position.set(
        nextState.position.x,
        nextState.position.y,
        nextState.position.z,
      );
      camera.near = 1;
      camera.far = Math.max(sceneBounds.size * 12, 40000);
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
      controls.zoomSpeed = 0.95;
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

  const setViewPreset = useCallback(
    (viewPreset: Exclude<GeometryCameraPreset, "custom">) => {
      persistCameraState({
        ...cameraState,
        position: positionFromDirection(
          cameraState.target,
          directionForPreset(viewPreset),
          cameraState.distanceMm,
        ),
        viewPreset,
      });
    },
    [cameraState, persistCameraState],
  );

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
      cameraRef.current = camera as THREE.PerspectiveCamera;
      cameraRef.current.up.set(0, 0, 1);
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
      if (pendingAttachedDeckHostEdgePick) {
        const pickedSide = pickableAttachedDeckHostEdgeSide(object);
        if (pickedSide && onPickAttachedDeckHostEdge) {
          onPickAttachedDeckHostEdge(pickedSide);
        }
        return;
      }
      setSelectedObjectId(id);
      if (!measurement.enabled) return;
      if (!object) return;
      assignMeasurementAnchor(buildMeasurementAnchor(object), "selection");
    },
    [
      allObjects,
      assignMeasurementAnchor,
      measurement.enabled,
      onPickAttachedDeckHostEdge,
      pendingAttachedDeckHostEdgePick,
    ],
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
        <h3 className={styles.stateTitle}>3D View Unavailable</h3>
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
        <h3 className={styles.stateTitle}>3D View Unavailable</h3>
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
          if (pendingAttachedDeckHostEdgePick) return;
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
            {pendingAttachedDeckHostEdgePick ? (
              <span className={styles.activeToolbarButton}>
                Pick house side for new deck
              </span>
            ) : null}
            <button
              type="button"
              className={styles.resetButton}
              onClick={fitScene}
            >
              Fit to scene
            </button>
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => focusSelection(selectedObject)}
              disabled={!selectedObject}
            >
              Focus selection
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            {cameraState.viewPreset === "custom" ? (
              <span className={styles.activeToolbarButton}>Custom</span>
            ) : null}
            {(["iso", "front", "right", "top"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={
                  cameraState.viewPreset === preset
                    ? styles.activeToolbarButton
                    : styles.resetButton
                }
                onClick={() => setViewPreset(preset)}
              >
                {formatCameraPreset(preset)}
              </button>
            ))}
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
          data-clipping-enabled={String(sectionCut.enabled)}
          data-selected-object-id={selectedObjectId ?? ""}
          data-shell-width={String(rectDiagnostic.shellWidth)}
          data-shell-height={String(rectDiagnostic.shellHeight)}
          data-canvas-width={String(rectDiagnostic.canvasWidth)}
          data-canvas-height={String(rectDiagnostic.canvasHeight)}
          data-canvas-contained={String(rectDiagnostic.canvasContained)}
        />

        <Canvas
          className={styles.canvas}
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
              ? layer.objects.map((object) => (
                  <SceneObjectNode
                    key={object.id}
                    object={object}
                    color={LAYER_COLORS[layer.id] ?? "#6c7a86"}
                    selected={selectedObjectId === object.id}
                    onSelect={handleObjectSelect}
                    onFocus={focusObjectById}
                    clippingPlanes={clippingPlanes}
                  />
                ))
              : [],
          )}
          <OrbitControls
            ref={handleControlsRef}
            makeDefault
            enablePan
            enableRotate
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
            zoomSpeed={0.95}
            minDistance={
              sceneBounds ? Math.max(sceneBounds.size * 0.18, 250) : 250
            }
            maxDistance={
              sceneBounds ? Math.max(sceneBounds.size * 14, 14000) : 14000
            }
            minPolarAngle={0.04}
            maxPolarAngle={Math.PI - 0.08}
            mouseButtons={{
              LEFT: ORBIT_MOUSE_DISABLED,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
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
                viewPreset: "custom",
                focusMode: nextFocusMode,
              });
            }}
          />
        </Canvas>
      </div>
    </section>
  );
}
