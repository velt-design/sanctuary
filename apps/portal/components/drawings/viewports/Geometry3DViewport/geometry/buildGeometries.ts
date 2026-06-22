import * as THREE from "three";
import type {
  Point3,
  RenderMesh3D,
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneMemberPrismObject,
  ViewerSceneObject,
  ViewerSceneRoofCladdingPanelObject,
} from "@sp/geometry";
import { emptyGeometry, vectorFromPoint } from "./lineBuilders";
import {
  isFinitePoint,
  isRenderableLine,
  isRenderablePolygon,
  isRenderableRenderMesh,
  MIN_RENDERABLE_POLYGON_AREA_MM2,
} from "./scenePointHelpers";

/**
 * Buffer-geometry builders + the supporting projected-polygon and
 * end-cut clipping math the viewport renderers consume. Pure THREE +
 * scene-type code; no React, no scene-state coupling.
 *
 * The four geometric layers stacked in this module:
 *  - Plane / frame derivation (`buildPlaneFrame`, `buildPolygonFrame`,
 *    `normalizeNonZeroVector`) — converts a `Plane3` or a polygon into
 *    a local orthonormal frame the rest of the pipeline projects
 *    against.
 *  - Projected-polygon math (`prepareSlabBoundary`,
 *    `triangulateProjectedPolygon`, plus the `projected*` helpers) —
 *    cleans co-incident vertices, drops collinear runs, ear-clips a
 *    valid polygon, and re-projects the boundary back into 3D using
 *    the captured frame.
 *  - End-cut clipping (`LocalClipPlane`, `clipFaceToPlane`,
 *    `clipFacesToEndCuts`, `geometryFromFaces`) — applies the
 *    member's `endCuts` planes to a per-member face list, emits cap
 *    faces from intersection points.
 *  - Public builders (`buildPolygonGeometry`, `buildPolygonSlabGeometry`,
 *    `buildProfileExtrusionGeometry`, `buildRectangularCapGeometry`,
 *    `buildClippedBoxGeometry`, `buildClippedProfileExtrusionGeometry`,
 *    `buildRenderMeshGeometry`, `buildLinearSolidPlacement`,
 *    `isRenderableSlab`) — consumed by the per-object renderers and
 *    helper code that materialises geometry outside the main viewport component.
 *
 * `POLYGON_TRIANGULATION_EPSILON_MM` and `CLIP_EPSILON_MM` are the two
 * load-bearing tolerances. Both are deliberately tight (1e-5 and 1e-6
 * mm respectively) — the polygon-cleaning loop relies on
 * sub-millimetre precision to detect collinear segments, and the
 * clip-plane intersection step depends on the tolerance to decide
 * which face-edges to keep, intersect, or drop. Loosening either has
 * caused both missing facets and double-rendered ones in past
 * iterations; do not relax without re-running the visual QA suite.
 *
 * `metadata*Value` helpers stay in `deckVisual.ts` (typed for the
 * deck/solid surface metadata shape); the `numericMetadataValue` here
 * is the generic-metadata variant used by member-prism renderers.
 */

const POLYGON_TRIANGULATION_EPSILON_MM = 1e-6;
const CLIP_EPSILON_MM = 1e-5;

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

export function buildLinearSolidPlacement(object: ViewerSceneHouseLinearSolidObject): {
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

export function buildProfileExtrusionGeometry(
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

export function buildRectangularCapGeometry(
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

export function numericMetadataValue(
  metadata: ViewerSceneObject["metadata"],
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}
