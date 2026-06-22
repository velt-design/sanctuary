import type {
  Point3,
  ViewerSceneHouseLineObject,
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneMemberPrismObject,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
} from "@sp/geometry";
import {
  centroid,
  isFinitePoint,
  isRenderableLine,
  isRenderablePolygon,
  linePoints,
  midpoint,
  renderMeshPoints,
} from "../geometry/scenePointHelpers";
import { pointDistance } from "./cameraState";

/**
 * Measurement-tool state and helpers. The 3D viewport's measurement
 * tool tracks up to two anchors (`firstAnchor`, `secondAnchor`); each
 * is either an `MeasurementAnchorType` resolved against a scene object
 * (start / midpoint / end / centroid) or the special `datum_origin`
 * pinned at world zero. The helpers in this module convert a clicked
 * scene object into the appropriate anchor and compute the
 * delta/distance/plan-distance between two anchors for the readout.
 *
 * Pure module — no React, no THREE, no scene access. Anchor resolution
 * runs over the typed scene object, and pointDistance is imported from
 * `cameraState` (which owns the THREE.Vector3 conversion helpers).
 */

type MeasurementAnchorType =
  | "start"
  | "midpoint"
  | "end"
  | "centroid"
  | "datum_origin";

export type MeasurementAnchor = {
  id: string;
  objectId: string | "datum-origin";
  anchorType: MeasurementAnchorType;
  point: Point3;
};

export type MeasurementState = {
  enabled: boolean;
  firstAnchor: MeasurementAnchor | null;
  secondAnchor: MeasurementAnchor | null;
  snapMode: "selection" | "datum";
  lastEditedSlot: "a" | "b";
};

export function formatAnchorType(anchorType: MeasurementAnchorType): string {
  return anchorType === "datum_origin" ? "datum origin" : anchorType;
}

export function pointsForObject(object: ViewerSceneObject): Point3[] {
  if (object.type === "member_prism")
    return linePoints(object.centerline).filter(isFinitePoint);
  if (object.type === "roof_plane" || object.type === "roof_cladding_panel")
    return object.boundary.filter(isFinitePoint);
  if (object.type === "roof_flashing")
    return object.wings.flatMap((wing) =>
      wing.boundary.filter(isFinitePoint),
    );
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

export function focusPointForObject(object: ViewerSceneObject): Point3 {
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

export function supportsEndpointAnchors(
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

export function buildMeasurementAnchor(
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

export function buildDatumOriginAnchor(point: Point3): MeasurementAnchor {
  return {
    id: "datum-origin",
    objectId: "datum-origin",
    anchorType: "datum_origin",
    point,
  };
}

export function formatDistanceMm(distanceMm: number): string {
  return `${Math.round(distanceMm)} mm`;
}

export function measurementDelta(a: Point3 | null, b: Point3 | null): Point3 | null {
  if (!a || !b) return null;
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z,
  };
}

export function measurementDistance(
  a: Point3 | null,
  b: Point3 | null,
): number | null {
  if (!a || !b) return null;
  return pointDistance(a, b);
}

export function measurementPlanDistance(
  a: Point3 | null,
  b: Point3 | null,
): number | null {
  const delta = measurementDelta(a, b);
  if (!delta) return null;
  return Math.sqrt(delta.x * delta.x + delta.y * delta.y);
}
