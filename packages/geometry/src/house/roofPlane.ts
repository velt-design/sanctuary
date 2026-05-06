import type { Line3, Plane3, Point3, Polygon3, RoofPlane3D, Vector3 } from '../contracts';
import { dotProduct, normalizeVector, planeFromPoints, subtractPoints } from '../math3d';
import { ROOF_JOIN_EPSILON_MM } from './constants';
import {
  clamp,
  finiteVectorLength,
  point,
  pointInPolygon2D,
  pointOnRoofSegment2D,
  type RoofPoint2,
} from './_internal';

export type RoofSolidPlaneEquation = {
  normal: Vector3;
  constant: number;
};

export function roofSolidPlaneEquationFromPlane(plane: Plane3): RoofSolidPlaneEquation | null {
  const normal = normalizeVector(plane.normal);
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return {
    normal,
    constant: dotProduct(normal, plane.origin),
  };
}

export function pointOnRoofPolygonBoundary(candidate: RoofPoint2, polygon: Polygon3): boolean {
  const point3 = point(candidate.x, candidate.y, 0);
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnRoofSegment2D(point3, polygon[index]!, polygon[(index + 1) % polygon.length]!)) return true;
  }
  return false;
}

export function pointInOrOnRoofPolygon(candidate: RoofPoint2, polygon: Polygon3): boolean {
  return pointInPolygon2D(candidate, polygon) || pointOnRoofPolygonBoundary(candidate, polygon);
}

export function roofPlaneHeightAtXY(roofPlane: RoofPlane3D, x: number, y: number): number | null {
  if (!pointInOrOnRoofPolygon({ x, y }, roofPlane.boundary)) return null;
  const planeEquation = roofSolidPlaneEquationFromPlane(roofPlane.plane);
  if (!planeEquation || Math.abs(planeEquation.normal.z) <= 1e-6) return null;
  return (
    planeEquation.constant -
    planeEquation.normal.x * x -
    planeEquation.normal.y * y
  ) / planeEquation.normal.z;
}

export function roofPlaneEquationHeightAtXY(
  planeEquation: RoofSolidPlaneEquation,
  x: number,
  y: number,
): number | null {
  if (Math.abs(planeEquation.normal.z) <= 1e-6) return null;
  return (
    planeEquation.constant -
    planeEquation.normal.x * x -
    planeEquation.normal.y * y
  ) / planeEquation.normal.z;
}

export function roofFeatureHeightAtXY(
  feature: Line3,
  x: number,
  y: number,
): number | null {
  const dx = feature.end.x - feature.start.x;
  const dy = feature.end.y - feature.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return null;
  if (!pointOnRoofSegment2D(point(x, y, 0), feature.start, feature.end)) return null;
  const useX = Math.abs(dx) >= Math.abs(dy);
  const denominator = useX ? dx : dy;
  if (Math.abs(denominator) <= 1e-6) return null;
  const t = useX ? (x - feature.start.x) / denominator : (y - feature.start.y) / denominator;
  if (t < -1e-3 || t > 1 + 1e-3) return null;
  return feature.start.z + (feature.end.z - feature.start.z) * clamp(t, 0, 1);
}

export function roofHeightAtXY(input: {
  x: number;
  y: number;
  roofPlanes: RoofPlane3D[];
  fallbackZ: number;
}): number {
  let bestZ = Number.NEGATIVE_INFINITY;
  for (const roofPlane of input.roofPlanes) {
    const z = roofPlaneHeightAtXY(roofPlane, input.x, input.y);
    if (z == null) continue;
    bestZ = Math.max(bestZ, z);
  }
  return Number.isFinite(bestZ) ? bestZ : input.fallbackZ;
}

export function buildRoofPlane(input: {
  id: string;
  boundary: Polygon3;
  highPoint: Point3;
  lowPoint: Point3;
  ridgeAxis: 'x' | 'y' | 'pyramid';
  pitchDeg: number;
  metadata?: Record<string, string | number | boolean | null>;
}): RoofPlane3D {
  return {
    id: input.id,
    boundary: input.boundary,
    plane: planeFromPoints(input.boundary[0]!, input.boundary[1]!, input.boundary[2]!),
    fallVector: normalizeVector(subtractPoints(input.lowPoint, input.highPoint)),
    metadata: {
      roofForm: 'hipped',
      ridgeAxis: input.ridgeAxis,
      pitchDeg: input.pitchDeg,
      ...(input.metadata ?? {}),
    },
  };
}
