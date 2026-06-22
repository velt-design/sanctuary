import type { Point3, Polygon3, RenderMesh3D, RoofPlane3D, Vector3 } from '../contracts';
import { crossProduct, dotProduct, lineLength, normalizeVector, scaleVector, subtractPoints } from '../math3d';
import { ROOF_JOIN_EPSILON_MM, ROOF_REGION_MIN_AREA_MM2, WORLD_Z } from './constants';
import {
  clamp,
  edgeOutwardVector,
  finiteVectorLength,
  line,
  miterCornerPoint,
  negateVector,
  point,
  signedAreaXY,
  translatePointByVector,
  type HouseRoofPerimeterEdgeKind,
} from './_internal';
import { type RoofSolidPlaneEquation } from './roofPlane';

type RoofSolidLine = {
  point: Point3;
  direction: Vector3;
};

type RoofSolidEdgeReference = {
  roofPlaneIndex: number;
  edgeIndex: number;
  start: Point3;
  end: Point3;
};

type RoofSolidAdjacency = {
  edgeMap: Map<string, RoofSolidEdgeReference[]>;
  invalidRoofPlaneIndexes: Set<number>;
};

type RoofSolidBottomEdge = {
  line: RoofSolidLine;
  perimeter: boolean;
  perimeterRole?: HouseRoofPerimeterEdgeKind | null;
};

type ProjectedRoofMeshPoint = {
  index: number;
  projected: { x: number; y: number };
};

function renderMeshIsFinite(mesh: RenderMesh3D): boolean {
  return (
    mesh.vertices.length >= 6 &&
    mesh.faces.length > 0 &&
    mesh.vertices.every((candidate) =>
      Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z),
    ) &&
    mesh.faces.every((face) =>
      face.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length),
    )
  );
}

export function buildVerticalPrismRenderMesh(planFootprint: Polygon3, bottomZ: number, topZ: number): RenderMesh3D | undefined {
  if (planFootprint.length < 3 || !Number.isFinite(bottomZ) || !Number.isFinite(topZ)) return undefined;
  if (Math.abs(topZ - bottomZ) <= 1e-6 || Math.abs(signedAreaXY(planFootprint)) <= 1e-6) return undefined;

  const bottom = Math.min(bottomZ, topZ);
  const top = Math.max(bottomZ, topZ);
  const vertices = [
    ...planFootprint.map((candidate) => point(candidate.x, candidate.y, bottom)),
    ...planFootprint.map((candidate) => point(candidate.x, candidate.y, top)),
  ];
  const vertexCount = planFootprint.length;
  const faces: [number, number, number][] = [];

  for (let index = 1; index < vertexCount - 1; index += 1) {
    faces.push([0, index + 1, index]);
    faces.push([vertexCount, vertexCount + index, vertexCount + index + 1]);
  }

  for (let index = 0; index < vertexCount; index += 1) {
    const nextIndex = (index + 1) % vertexCount;
    faces.push([index, nextIndex, vertexCount + nextIndex]);
    faces.push([index, vertexCount + nextIndex, vertexCount + index]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

/**
 * Extrude a convex polygonal boundary perpendicular to its own plane by
 * `thicknessMm`, producing a closed manifold mesh. Used for walls whose
 * face boundary is non-flat-topped (e.g. open-gable end walls whose top
 * profile climbs from the eave up to the ridge apex and back down).
 *
 * The boundary is assumed convex and to wind counter-clockwise when viewed
 * from the +planeNormal direction. This matches `buildWallSegments`, which
 * emits walls as `[groundStart, groundEnd, ...topProfile.reverse()]` where
 * the plane normal points away from the building interior.
 *
 * The result thickens the boundary by half-thickness in each direction
 * along `planeNormal`, fan-triangulates the two faces, and bridges the
 * sides with quads (two triangles each).
 */
export function buildPolygonalWallRenderMesh(
  boundary: Polygon3,
  planeNormal: Vector3,
  thicknessMm: number,
): RenderMesh3D | undefined {
  if (boundary.length < 3 || !Number.isFinite(thicknessMm) || thicknessMm <= 0) return undefined;
  const normalLength = Math.hypot(planeNormal.x, planeNormal.y, planeNormal.z);
  if (!Number.isFinite(normalLength) || normalLength <= 1e-9) return undefined;

  const unitNormal = normalizeVector(planeNormal);
  const halfThickness = thicknessMm / 2;
  const outwardOffset = scaleVector(unitNormal, halfThickness);
  const inwardOffset = scaleVector(unitNormal, -halfThickness);

  const outerVertices = boundary.map((candidate) => translatePointByVector(candidate, outwardOffset));
  const innerVertices = boundary.map((candidate) => translatePointByVector(candidate, inwardOffset));
  const vertices: Point3[] = [...outerVertices, ...innerVertices];
  const N = boundary.length;
  const faces: [number, number, number][] = [];

  // Outer face (fan-triangulate from boundary[0]) -- winding [0, i, i+1]
  // produces outward-facing normals when the boundary is CCW-from-outside.
  for (let i = 1; i < N - 1; i += 1) {
    faces.push([0, i, i + 1]);
  }

  // Inner face -- reverse winding so normals point inward (away from outer).
  for (let i = 1; i < N - 1; i += 1) {
    faces.push([N, N + i + 1, N + i]);
  }

  // Side faces -- each boundary edge becomes a quad
  // (outer_i, outer_next, inner_next, inner_i), split into two triangles.
  for (let i = 0; i < N; i += 1) {
    const nextIndex = (i + 1) % N;
    faces.push([i, nextIndex, N + nextIndex]);
    faces.push([i, N + nextIndex, N + i]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

export function boundaryZRange(boundary: Polygon3): { bottomZ: number; topZ: number } | null {
  if (!boundary.length) return null;
  const zValues = boundary.map((candidate) => candidate.z);
  const bottomZ = Math.min(...zValues);
  const topZ = Math.max(...zValues);
  return Number.isFinite(bottomZ) && Number.isFinite(topZ) && topZ - bottomZ > 1e-6
    ? { bottomZ, topZ }
    : null;
}

export function buildMiteredOffsetStripFootprints(
  sourcePolygon: Polygon3,
  outerOffsetMm: number,
  innerOffsetMm: number,
): Polygon3[] | null {
  if (
    sourcePolygon.length < 3 ||
    !Number.isFinite(outerOffsetMm) ||
    !Number.isFinite(innerOffsetMm) ||
    Math.abs(outerOffsetMm - innerOffsetMm) <= 1e-6 ||
    Math.abs(signedAreaXY(sourcePolygon)) <= 1e-6
  ) {
    return null;
  }
  if (
    sourcePolygon.some(
      (current, index) => lineLength(line(current, sourcePolygon[(index + 1) % sourcePolygon.length]!)) <= 1e-6,
    )
  ) {
    return null;
  }

  const outerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x + outward.x * outerOffsetMm, start.y + outward.y * outerOffsetMm, 0),
      end: point(end.x + outward.x * outerOffsetMm, end.y + outward.y * outerOffsetMm, 0),
    };
  });
  const innerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x + outward.x * innerOffsetMm, start.y + outward.y * innerOffsetMm, 0),
      end: point(end.x + outward.x * innerOffsetMm, end.y + outward.y * innerOffsetMm, 0),
    };
  });

  const footprints: Polygon3[] = [];
  for (let index = 0; index < sourcePolygon.length; index += 1) {
    const previousIndex = (index - 1 + sourcePolygon.length) % sourcePolygon.length;
    const nextIndex = (index + 1) % sourcePolygon.length;
    const previousOuter = outerEdges[previousIndex]!;
    const currentOuter = outerEdges[index]!;
    const nextOuter = outerEdges[nextIndex]!;
    const previousInner = innerEdges[previousIndex]!;
    const currentInner = innerEdges[index]!;
    const nextInner = innerEdges[nextIndex]!;

    const outerStart = miterCornerPoint(previousOuter, currentOuter);
    const outerEnd = miterCornerPoint(currentOuter, nextOuter);
    const innerEnd = miterCornerPoint(currentInner, nextInner);
    const innerStart = miterCornerPoint(previousInner, currentInner);

    if (!outerStart || !outerEnd || !innerEnd || !innerStart) return null;
    const footprint = [
      outerStart,
      outerEnd,
      innerEnd,
      innerStart,
    ];
    if (Math.abs(signedAreaXY(footprint)) <= 1e-6) return null;
    footprints.push(footprint);
  }

  return footprints;
}

function roofSolidPointKey(candidate: Point3): string {
  return [
    Math.round(candidate.x / ROOF_JOIN_EPSILON_MM),
    Math.round(candidate.y / ROOF_JOIN_EPSILON_MM),
    Math.round(candidate.z / ROOF_JOIN_EPSILON_MM),
  ].join(',');
}

export function roofSolidEdgeKey(start: Point3, end: Point3): string {
  const startKey = roofSolidPointKey(start);
  const endKey = roofSolidPointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

export function buildRoofSolidAdjacency(roofPlanes: RoofPlane3D[]): RoofSolidAdjacency {
  const edgeMap = new Map<string, RoofSolidEdgeReference[]>();
  const invalidRoofPlaneIndexes = new Set<number>();

  for (const [roofPlaneIndex, roofPlane] of roofPlanes.entries()) {
    if (roofPlane.boundary.length < 3) {
      invalidRoofPlaneIndexes.add(roofPlaneIndex);
      continue;
    }
    for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
      const start = roofPlane.boundary[edgeIndex]!;
      const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
      if (lineLength(line(start, end)) <= ROOF_JOIN_EPSILON_MM) {
        invalidRoofPlaneIndexes.add(roofPlaneIndex);
        continue;
      }
      const key = roofSolidEdgeKey(start, end);
      const references = edgeMap.get(key) ?? [];
      references.push({ roofPlaneIndex, edgeIndex, start, end });
      edgeMap.set(key, references);
    }
  }

  for (const references of edgeMap.values()) {
    const uniqueRoofPlaneIndexes = new Set(references.map((reference) => reference.roofPlaneIndex));
    if (references.length > 2 || uniqueRoofPlaneIndexes.size !== references.length) {
      for (const reference of references) {
        invalidRoofPlaneIndexes.add(reference.roofPlaneIndex);
      }
    }
  }

  return { edgeMap, invalidRoofPlaneIndexes };
}

function intersectRoofSolidPlanes(
  first: RoofSolidPlaneEquation,
  second: RoofSolidPlaneEquation,
): RoofSolidLine | null {
  const direction = crossProduct(first.normal, second.normal);
  const directionLengthSq = dotProduct(direction, direction);
  if (directionLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return null;

  const scaledSecondNormal = scaleVector(second.normal, first.constant);
  const scaledFirstNormal = scaleVector(first.normal, second.constant);
  const pointOnLine = scaleVector(
    crossProduct(
      {
        x: scaledSecondNormal.x - scaledFirstNormal.x,
        y: scaledSecondNormal.y - scaledFirstNormal.y,
        z: scaledSecondNormal.z - scaledFirstNormal.z,
      },
      direction,
    ),
    1 / directionLengthSq,
  );

  return {
    point: point(pointOnLine.x, pointOnLine.y, pointOnLine.z),
    direction: normalizeVector(direction),
  };
}

function roofSolidVerticalCutPlane(start: Point3, end: Point3): RoofSolidPlaneEquation | null {
  const edgeDirection = normalizeVector(subtractPoints(end, start));
  if (finiteVectorLength(edgeDirection) <= ROOF_JOIN_EPSILON_MM) return null;
  const normal = normalizeVector(crossProduct(edgeDirection, WORLD_Z));
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return {
    normal,
    constant: dotProduct(normal, start),
  };
}

function buildRoofSolidBottomEdge(input: {
  edgeReference: RoofSolidEdgeReference;
  edgeReferences: RoofSolidEdgeReference[];
  bottomPlanes: Array<RoofSolidPlaneEquation | null>;
  perimeterRole?: HouseRoofPerimeterEdgeKind | null;
}): RoofSolidBottomEdge | null {
  const currentBottomPlane = input.bottomPlanes[input.edgeReference.roofPlaneIndex];
  if (!currentBottomPlane) return null;

  if (input.edgeReferences.length === 2) {
    const adjacentReference = input.edgeReferences.find(
      (reference) => reference.roofPlaneIndex !== input.edgeReference.roofPlaneIndex,
    );
    const adjacentBottomPlane = typeof adjacentReference?.roofPlaneIndex === 'number'
      ? input.bottomPlanes[adjacentReference.roofPlaneIndex]
      : null;
    if (!adjacentBottomPlane) return null;
    const miterLine = intersectRoofSolidPlanes(currentBottomPlane, adjacentBottomPlane);
    if (miterLine) return { line: miterLine, perimeter: false };
  }

  if (input.edgeReferences.length > 2) return null;
  const cutPlane = roofSolidVerticalCutPlane(input.edgeReference.start, input.edgeReference.end);
  const cutLine = cutPlane ? intersectRoofSolidPlanes(currentBottomPlane, cutPlane) : null;
  const closePerimeter =
    input.edgeReferences.length === 1 &&
    input.perimeterRole !== 'weather_flashed_edge' &&
    input.perimeterRole !== 'house_apron_edge';
  return cutLine
    ? {
        line: cutLine,
        perimeter: closePerimeter,
        perimeterRole: input.perimeterRole ?? null,
      }
    : null;
}

function closestPointOnRoofSolidLine(candidate: Point3, source: RoofSolidLine): Point3 {
  const directionLengthSq = dotProduct(source.direction, source.direction);
  if (directionLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return source.point;
  const ratio = dotProduct(subtractPoints(candidate, source.point), source.direction) / directionLengthSq;
  return translatePointByVector(source.point, scaleVector(source.direction, ratio));
}

function intersectRoofSolidLines(
  first: RoofSolidLine,
  second: RoofSolidLine,
  fallbackNear: Point3,
): Point3 | null {
  const firstDirection = normalizeVector(first.direction);
  const secondDirection = normalizeVector(second.direction);
  const directionCross = crossProduct(firstDirection, secondDirection);
  const directionCrossLengthSq = dotProduct(directionCross, directionCross);
  const betweenOrigins = subtractPoints(first.point, second.point);

  if (directionCrossLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
    const separation = finiteVectorLength(crossProduct(subtractPoints(second.point, first.point), firstDirection));
    return separation <= 1e-2 ? closestPointOnRoofSolidLine(fallbackNear, first) : null;
  }

  const firstLengthSq = dotProduct(firstDirection, firstDirection);
  const secondLengthSq = dotProduct(secondDirection, secondDirection);
  const directionDot = dotProduct(firstDirection, secondDirection);
  const firstOriginDot = dotProduct(firstDirection, betweenOrigins);
  const secondOriginDot = dotProduct(secondDirection, betweenOrigins);
  const denominator = firstLengthSq * secondLengthSq - directionDot * directionDot;
  if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return null;

  const firstRatio = (directionDot * secondOriginDot - secondLengthSq * firstOriginDot) / denominator;
  const secondRatio = (firstLengthSq * secondOriginDot - directionDot * firstOriginDot) / denominator;
  const firstPoint = translatePointByVector(first.point, scaleVector(firstDirection, firstRatio));
  const secondPoint = translatePointByVector(second.point, scaleVector(secondDirection, secondRatio));
  if (lineLength(line(firstPoint, secondPoint)) > 1e-2) return null;
  return point(
    (firstPoint.x + secondPoint.x) / 2,
    (firstPoint.y + secondPoint.y) / 2,
    (firstPoint.z + secondPoint.z) / 2,
  );
}

function projectRoofMeshPoint(candidate: Point3, normal: Vector3): { x: number; y: number } {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  if (absX >= absY && absX >= absZ) return { x: candidate.y, y: candidate.z };
  if (absY >= absX && absY >= absZ) return { x: candidate.x, y: candidate.z };
  return { x: candidate.x, y: candidate.y };
}

function roofMeshProjectedPointDistanceSquared(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function signedRoofMeshProjectedArea(points: Array<{ x: number; y: number }>): number {
  return points.reduce((sum, current, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function roofMeshProjectedCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function roofMeshPointOnProjectedSegment(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  if (Math.abs(roofMeshProjectedCross(start, end, candidate)) > ROOF_JOIN_EPSILON_MM) return false;
  const dot =
    (candidate.x - start.x) * (end.x - start.x) +
    (candidate.y - start.y) * (end.y - start.y);
  if (dot < -ROOF_JOIN_EPSILON_MM) return false;
  return dot <= roofMeshProjectedPointDistanceSquared(start, end) + ROOF_JOIN_EPSILON_MM;
}

function roofMeshProjectedSegmentsIntersect(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
): boolean {
  const firstA = roofMeshProjectedCross(firstStart, firstEnd, secondStart);
  const firstB = roofMeshProjectedCross(firstStart, firstEnd, secondEnd);
  const secondA = roofMeshProjectedCross(secondStart, secondEnd, firstStart);
  const secondB = roofMeshProjectedCross(secondStart, secondEnd, firstEnd);

  if (Math.abs(firstA) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(secondStart, firstStart, firstEnd)) {
    return true;
  }
  if (Math.abs(firstB) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(secondEnd, firstStart, firstEnd)) {
    return true;
  }
  if (Math.abs(secondA) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(firstStart, secondStart, secondEnd)) {
    return true;
  }
  if (Math.abs(secondB) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(firstEnd, secondStart, secondEnd)) {
    return true;
  }

  return firstA * firstB < 0 && secondA * secondB < 0;
}

function roofMeshProjectedPolygonSelfIntersects(points: Array<{ x: number; y: number }>): boolean {
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % points.length;
    for (let secondIndex = firstIndex + 1; secondIndex < points.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % points.length;
      if (firstIndex === secondIndex || firstNext === secondIndex || secondNext === firstIndex) continue;
      if (
        roofMeshProjectedSegmentsIntersect(
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

function roofMeshPointInProjectedTriangle(
  candidate: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  return (
    roofMeshProjectedCross(a, b, candidate) >= -ROOF_JOIN_EPSILON_MM &&
    roofMeshProjectedCross(b, c, candidate) >= -ROOF_JOIN_EPSILON_MM &&
    roofMeshProjectedCross(c, a, candidate) >= -ROOF_JOIN_EPSILON_MM
  );
}

function roofMeshProjectedTriangleArea(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return Math.abs(roofMeshProjectedCross(a, b, c)) / 2;
}

function roofMeshProjectedTriangleCentroid(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

function roofMeshPointInProjectedPolygon(
  candidate: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (
    polygon.some((start, index) =>
      roofMeshPointOnProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
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

function prepareProjectedRoofMeshPolygon(points: Point3[], normal: Vector3): ProjectedRoofMeshPoint[] | null {
  const projected = points.map((candidate, index) => ({
    index,
    projected: projectRoofMeshPoint(candidate, normal),
  }));
  const cleaned: ProjectedRoofMeshPoint[] = [];

  for (const candidate of projected) {
    const previous = cleaned[cleaned.length - 1];
    if (
      !previous ||
      roofMeshProjectedPointDistanceSquared(previous.projected, candidate.projected) >
        ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
    ) {
      cleaned.push(candidate);
    }
  }

  if (
    cleaned.length > 2 &&
    roofMeshProjectedPointDistanceSquared(cleaned[0]!.projected, cleaned[cleaned.length - 1]!.projected) <=
      ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
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
      const first = {
        x: current.projected.x - previous.projected.x,
        y: current.projected.y - previous.projected.y,
      };
      const second = {
        x: next.projected.x - current.projected.x,
        y: next.projected.y - current.projected.y,
      };
      const cross = first.x * second.y - first.y * second.x;
      const dot = first.x * second.x + first.y * second.y;
      if (Math.abs(cross) <= ROOF_JOIN_EPSILON_MM && dot >= -ROOF_JOIN_EPSILON_MM) {
        cleaned.splice(index, 1);
        removedCollinear = true;
        break;
      }
    }
  }

  const uniqueProjected = new Set(
    cleaned.map((candidate) => `${candidate.projected.x.toFixed(6)},${candidate.projected.y.toFixed(6)}`),
  );
  const area = signedRoofMeshProjectedArea(cleaned.map((candidate) => candidate.projected));
  if (cleaned.length < 3 || uniqueProjected.size < 3 || Math.abs(area) <= ROOF_REGION_MIN_AREA_MM2) return null;
  return area > 0 ? cleaned : [...cleaned].reverse();
}

function triangulateRoofMeshPolygon(points: Point3[], normal: Vector3): Array<[number, number, number]> | null {
  const prepared = prepareProjectedRoofMeshPolygon(points, normal);
  if (!prepared) return null;
  const projected = prepared.map((candidate) => candidate.projected);
  if (roofMeshProjectedPolygonSelfIntersects(projected)) return null;

  const remaining = prepared.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  let guard = 0;

  while (remaining.length > 3 && guard < projected.length * projected.length) {
    guard += 1;
    let clipped = false;

    for (let remainingIndex = 0; remainingIndex < remaining.length; remainingIndex += 1) {
      const previousIndex = remaining[(remainingIndex - 1 + remaining.length) % remaining.length]!;
      const currentIndex = remaining[remainingIndex]!;
      const nextIndex = remaining[(remainingIndex + 1) % remaining.length]!;
      const previous = projected[previousIndex]!;
      const current = projected[currentIndex]!;
      const next = projected[nextIndex]!;

      if (roofMeshProjectedCross(previous, current, next) <= ROOF_JOIN_EPSILON_MM) continue;
      if (
        remaining.some((candidateIndex) => {
          if (candidateIndex === previousIndex || candidateIndex === currentIndex || candidateIndex === nextIndex) {
            return false;
          }
          return roofMeshPointInProjectedTriangle(projected[candidateIndex]!, previous, current, next);
        })
      ) {
        continue;
      }

      const centroid = roofMeshProjectedTriangleCentroid(previous, current, next);
      if (!roofMeshPointInProjectedPolygon(centroid, projected)) continue;

      triangles.push([
        prepared[previousIndex]!.index,
        prepared[currentIndex]!.index,
        prepared[nextIndex]!.index,
      ]);
      remaining.splice(remainingIndex, 1);
      clipped = true;
      break;
    }

    if (!clipped) return null;
  }

  if (remaining.length === 3) {
    const [a, b, c] = remaining as [number, number, number];
    if (roofMeshProjectedTriangleArea(projected[a]!, projected[b]!, projected[c]!) <= ROOF_REGION_MIN_AREA_MM2) {
      return null;
    }
    const centroid = roofMeshProjectedTriangleCentroid(projected[a]!, projected[b]!, projected[c]!);
    if (!roofMeshPointInProjectedPolygon(centroid, projected)) return null;
    triangles.push([prepared[a]!.index, prepared[b]!.index, prepared[c]!.index]);
  }

  const triangulatedArea = triangles.reduce((sum, [a, b, c]) => {
    const projectedA = projectRoofMeshPoint(points[a]!, normal);
    const projectedB = projectRoofMeshPoint(points[b]!, normal);
    const projectedC = projectRoofMeshPoint(points[c]!, normal);
    return sum + roofMeshProjectedTriangleArea(projectedA, projectedB, projectedC);
  }, 0);
  const polygonArea = Math.abs(signedRoofMeshProjectedArea(projected));
  if (Math.abs(triangulatedArea - polygonArea) > Math.max(1, polygonArea * 0.001)) return null;

  return triangles;
}

function orientRoofMeshFace(
  vertices: Point3[],
  face: [number, number, number],
  normal: Vector3,
): [number, number, number] {
  const a = vertices[face[0]]!;
  const b = vertices[face[1]]!;
  const c = vertices[face[2]]!;
  const faceNormal = crossProduct(subtractPoints(b, a), subtractPoints(c, a));
  return dotProduct(faceNormal, normal) >= 0 ? face : [face[0], face[2], face[1]];
}

export function buildRoofSolidRenderMesh(input: {
  roofPlanes: RoofPlane3D[];
  roofPlaneIndex: number;
  adjacency: RoofSolidAdjacency;
  bottomPlanes: Array<RoofSolidPlaneEquation | null>;
  includeBottomFaces?: boolean;
  perimeterEdgeRoles?: Map<string, HouseRoofPerimeterEdgeKind>;
}): RenderMesh3D | undefined {
  if (input.adjacency.invalidRoofPlaneIndexes.has(input.roofPlaneIndex)) return undefined;
  const roofPlane = input.roofPlanes[input.roofPlaneIndex];
  const bottomPlane = input.bottomPlanes[input.roofPlaneIndex];
  if (!roofPlane || !bottomPlane || roofPlane.boundary.length < 3) return undefined;

  const roofNormal = normalizeVector(roofPlane.plane.normal);
  if (finiteVectorLength(roofNormal) <= ROOF_JOIN_EPSILON_MM || Math.abs(roofNormal.z) <= ROOF_JOIN_EPSILON_MM) {
    return undefined;
  }
  const topNormal = roofNormal.z >= 0 ? roofNormal : negateVector(roofNormal);
  const triangles = triangulateRoofMeshPolygon(roofPlane.boundary, topNormal);
  if (!triangles) return undefined;

  const bottomEdges: RoofSolidBottomEdge[] = [];
  for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
    const start = roofPlane.boundary[edgeIndex]!;
    const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
    const edgeKey = roofSolidEdgeKey(start, end);
    const edgeReferences = input.adjacency.edgeMap.get(edgeKey) ?? [];
    const edgeReference = edgeReferences.find(
      (reference) => reference.roofPlaneIndex === input.roofPlaneIndex && reference.edgeIndex === edgeIndex,
    );
    if (!edgeReference || edgeReferences.length === 0 || edgeReferences.length > 2) return undefined;
    const bottomEdge = buildRoofSolidBottomEdge({
      edgeReference,
      edgeReferences,
      bottomPlanes: input.bottomPlanes,
      perimeterRole:
        input.perimeterEdgeRoles?.get(`${roofPlane.id}:${edgeIndex}`) ?? null,
    });
    if (!bottomEdge) return undefined;
    bottomEdges.push(bottomEdge);
  }

  const bottomVertices: Point3[] = [];
  for (let vertexIndex = 0; vertexIndex < roofPlane.boundary.length; vertexIndex += 1) {
    const previousBottomEdge = bottomEdges[(vertexIndex - 1 + bottomEdges.length) % bottomEdges.length]!;
    const currentBottomEdge = bottomEdges[vertexIndex]!;
    const bottomVertex = intersectRoofSolidLines(
      previousBottomEdge.line,
      currentBottomEdge.line,
      roofPlane.boundary[vertexIndex]!,
    );
    if (!bottomVertex) return undefined;
    if (Math.abs(dotProduct(bottomPlane.normal, bottomVertex) - bottomPlane.constant) > 1e-2) return undefined;
    bottomVertices.push(bottomVertex);
  }

  const vertices = [...roofPlane.boundary, ...bottomVertices];
  const vertexCount = roofPlane.boundary.length;
  const faces: [number, number, number][] = [];
  for (const face of triangles) {
    faces.push(orientRoofMeshFace(vertices, face, topNormal));
    if (input.includeBottomFaces ?? true) {
      faces.push(orientRoofMeshFace(
        vertices,
        [face[0] + vertexCount, face[2] + vertexCount, face[1] + vertexCount],
        negateVector(topNormal),
      ));
    }
  }

  for (let edgeIndex = 0; edgeIndex < bottomEdges.length; edgeIndex += 1) {
    if (!bottomEdges[edgeIndex]!.perimeter) continue;
    const nextIndex = (edgeIndex + 1) % vertexCount;
    faces.push([edgeIndex, nextIndex, vertexCount + nextIndex]);
    faces.push([edgeIndex, vertexCount + nextIndex, vertexCount + edgeIndex]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

export function polygonAveragePoint3D(points: Polygon3): Point3 {
  const total = points.reduce(
    (sum, current) => ({
      x: sum.x + current.x,
      y: sum.y + current.y,
      z: sum.z + current.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const divisor = Math.max(1, points.length);
  return point(total.x / divisor, total.y / divisor, total.z / divisor);
}

function cleanPolygon3D(points: Polygon3): Polygon3 {
  const withoutDuplicates: Polygon3 = [];
  for (const candidate of points) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1];
    if (previous && finiteVectorLength(subtractPoints(candidate, previous)) <= ROOF_JOIN_EPSILON_MM) continue;
    withoutDuplicates.push(candidate);
  }

  if (
    withoutDuplicates.length > 1 &&
    finiteVectorLength(subtractPoints(withoutDuplicates[0]!, withoutDuplicates[withoutDuplicates.length - 1]!)) <=
      ROOF_JOIN_EPSILON_MM
  ) {
    withoutDuplicates.pop();
  }

  if (withoutDuplicates.length < 3) return withoutDuplicates;

  const cleaned: Polygon3 = [];
  for (let index = 0; index < withoutDuplicates.length; index += 1) {
    const previous = withoutDuplicates[(index - 1 + withoutDuplicates.length) % withoutDuplicates.length]!;
    const current = withoutDuplicates[index]!;
    const next = withoutDuplicates[(index + 1) % withoutDuplicates.length]!;
    const first = subtractPoints(current, previous);
    const second = subtractPoints(next, current);
    if (finiteVectorLength(crossProduct(first, second)) <= ROOF_JOIN_EPSILON_MM) continue;
    cleaned.push(current);
  }

  return cleaned.length >= 3 ? cleaned : withoutDuplicates;
}

export function clipPolygon3DByScalar(
  polygon: Polygon3,
  scalar: (candidate: Point3) => number,
): Polygon3 {
  if (polygon.length < 3) return [];
  const clipped: Polygon3 = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const currentValue = scalar(current);
    const nextValue = scalar(next);
    const currentInside = currentValue <= ROOF_JOIN_EPSILON_MM;
    const nextInside = nextValue <= ROOF_JOIN_EPSILON_MM;
    const denominator = currentValue - nextValue;
    const intersection =
      Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM
        ? null
        : translatePointByVector(
            current,
            scaleVector(subtractPoints(next, current), clamp(currentValue / denominator, 0, 1)),
          );

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      if (intersection) clipped.push(intersection);
    } else if (!currentInside && nextInside) {
      if (intersection) clipped.push(intersection);
      clipped.push(next);
    }
  }

  return cleanPolygon3D(clipped);
}

export function roofPlaneTopNormal(roofPlane: RoofPlane3D): Vector3 | null {
  const normal = normalizeVector(roofPlane.plane.normal);
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return normal.z >= 0 ? normal : negateVector(normal);
}
