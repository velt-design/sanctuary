import * as THREE from "three";
import type {
  Point3,
  RenderMesh3D,
  ViewerSceneRoofCladdingPanelObject,
} from "@sp/geometry";
import { emptyGeometry, vectorFromPoint } from "./lineBuilders";
import {
  isFinitePoint,
  isRenderablePolygon,
  isRenderableRenderMesh,
  MIN_RENDERABLE_POLYGON_AREA_MM2,
} from "../scene";

/**
 * Polygon, render-mesh and slab buffer construction. This module owns
 * plane-frame projection, polygon cleanup and deterministic ear clipping.
 */

const POLYGON_TRIANGULATION_EPSILON_MM = 1e-6;

export function buildPolygonGeometry(points: Point3[]): THREE.BufferGeometry {
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

export function offsetPolygon(points: Point3[], normal: Point3, distanceMm: number): Point3[] {
  return points.map((point) => ({
    x: point.x + normal.x * distanceMm,
    y: point.y + normal.y * distanceMm,
    z: point.z + normal.z * distanceMm,
  }));
}

export function normalizeNonZeroVector(vector: THREE.Vector3): THREE.Vector3 | null {
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

export function isRenderableSlab(
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
