import type {
  HouseRoofMaterial,
  HouseRoofMaterialProfileKind,
  HouseRoofMaterialVisual3D,
  Point3,
  RoofPlane3D,
  Vector3,
} from '../contracts';
import { crossProduct, dotProduct, lineLength, normalizeVector, scaleVector, subtractPoints } from '../math3d';
import {
  DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
  ROOF_JOIN_EPSILON_MM,
  ROOF_REGION_MIN_AREA_MM2,
} from './constants';
import {
  finiteRoofQaPoint,
  finiteVectorLength,
  line,
  point,
  polygonArea3D,
  translatePointByVector,
} from './_internal';
import { roofPlaneTopNormal } from './roofSolids';

type HouseRoofMaterialSettings = {
  profileKind: HouseRoofMaterialProfileKind;
  spacingMm: number;
  lineDirection: 'fall' | 'across';
};

type HouseRoofMaterialProjection = {
  u: number;
  v: number;
};

function houseRoofMaterialSettings(material: HouseRoofMaterial): HouseRoofMaterialSettings {
  switch (material) {
    case 'trapezoidal_5_rib':
      return { profileKind: 'rib', spacingMm: 190, lineDirection: 'fall' };
    case 'eurotray_300':
      return { profileKind: 'seam', spacingMm: 300, lineDirection: 'fall' };
    case 'eurotray_500':
      return { profileKind: 'seam', spacingMm: 500, lineDirection: 'fall' };
    case 'shingles':
      return { profileKind: 'course', spacingMm: 250, lineDirection: 'across' };
    case 'corrugated_iron':
    default:
      return { profileKind: 'rib', spacingMm: 76.2, lineDirection: 'fall' };
  }
}

function pointOnHouseRoofMaterialProjectedSegment(
  candidate: HouseRoofMaterialProjection,
  start: HouseRoofMaterialProjection,
  end: HouseRoofMaterialProjection,
): boolean {
  const dx = end.u - start.u;
  const dy = end.v - start.v;
  const cross = (candidate.u - start.u) * dy - (candidate.v - start.v) * dx;
  if (Math.abs(cross) > ROOF_JOIN_EPSILON_MM) return false;
  const dot = (candidate.u - start.u) * dx + (candidate.v - start.v) * dy;
  if (dot < -ROOF_JOIN_EPSILON_MM) return false;
  return dot <= dx * dx + dy * dy + ROOF_JOIN_EPSILON_MM;
}

function pointInHouseRoofMaterialProjectedPolygon(
  candidate: HouseRoofMaterialProjection,
  polygon: HouseRoofMaterialProjection[],
): boolean {
  if (
    polygon.some((start, index) =>
      pointOnHouseRoofMaterialProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
    )
  ) {
    return true;
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.v > candidate.v !== previous.v > candidate.v &&
      candidate.u < ((previous.u - current.u) * (candidate.v - current.v)) / (previous.v - current.v || 1) + current.u;
    if (intersects) inside = !inside;
  }
  return inside;
}

function projectedHouseRoofMaterialPolygonArea(polygon: HouseRoofMaterialProjection[]): number {
  if (polygon.length < 3) return 0;
  return Math.abs(
    polygon.reduce((sum, current, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      return sum + current.u * next.v - next.u * current.v;
    }, 0) / 2,
  );
}

function uniqueHouseRoofMaterialProjectedPointCount(polygon: HouseRoofMaterialProjection[]): number {
  return new Set(
    polygon.map((candidate) => `${Math.round(candidate.u / ROOF_JOIN_EPSILON_MM)},${Math.round(candidate.v / ROOF_JOIN_EPSILON_MM)}`),
  ).size;
}

function worldHouseRoofMaterialPoint(input: {
  origin: Point3;
  acrossAxis: Vector3;
  fallAxis: Vector3;
  offset: Vector3;
  u: number;
  v: number;
}): Point3 {
  return point(
    input.origin.x + input.acrossAxis.x * input.u + input.fallAxis.x * input.v + input.offset.x,
    input.origin.y + input.acrossAxis.y * input.u + input.fallAxis.y * input.v + input.offset.y,
    input.origin.z + input.acrossAxis.z * input.u + input.fallAxis.z * input.v + input.offset.z,
  );
}

function houseRoofMaterialCoordinateValues(min: number, max: number, spacingMm: number): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= ROOF_JOIN_EPSILON_MM || !Number.isFinite(spacingMm) || spacingMm <= ROOF_JOIN_EPSILON_MM) {
    return [];
  }
  const values: number[] = [];
  const start = Math.ceil(min / spacingMm) * spacingMm;
  for (let value = start; value <= max + ROOF_JOIN_EPSILON_MM; value += spacingMm) {
    if (value > min + ROOF_JOIN_EPSILON_MM && value < max - ROOF_JOIN_EPSILON_MM) {
      values.push(value);
    }
    if (values.length > 1000) break;
  }
  if (values.length === 0) values.push((min + max) / 2);
  return values;
}

function clipHouseRoofMaterialLine(input: {
  polygon: HouseRoofMaterialProjection[];
  fixedAxis: 'u' | 'v';
  fixedValue: number;
}): Array<{ start: HouseRoofMaterialProjection; end: HouseRoofMaterialProjection }> {
  const intersections: number[] = [];
  const variableAxis = input.fixedAxis === 'u' ? 'v' : 'u';

  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    const startFixedDistance = start[input.fixedAxis] - input.fixedValue;
    const endFixedDistance = end[input.fixedAxis] - input.fixedValue;

    if (Math.abs(startFixedDistance) <= ROOF_JOIN_EPSILON_MM && Math.abs(endFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(start[variableAxis], end[variableAxis]);
      continue;
    }

    if (Math.abs(startFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(start[variableAxis]);
      continue;
    }

    if (Math.abs(endFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(end[variableAxis]);
      continue;
    }

    if (startFixedDistance * endFixedDistance < 0) {
      const ratio = startFixedDistance / (startFixedDistance - endFixedDistance);
      intersections.push(start[variableAxis] + (end[variableAxis] - start[variableAxis]) * ratio);
    }
  }

  const sorted = [...intersections]
    .filter((candidate) => Number.isFinite(candidate))
    .sort((a, b) => a - b)
    .reduce<number[]>((unique, candidate) => {
      const previous = unique[unique.length - 1];
      if (previous === undefined || Math.abs(candidate - previous) > ROOF_JOIN_EPSILON_MM) unique.push(candidate);
      return unique;
    }, []);

  const segments: Array<{ start: HouseRoofMaterialProjection; end: HouseRoofMaterialProjection }> = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startValue = sorted[index]!;
    const endValue = sorted[index + 1]!;
    if (endValue - startValue <= 1) continue;
    const midpointValue = (startValue + endValue) / 2;
    const midpoint =
      input.fixedAxis === 'u'
        ? { u: input.fixedValue, v: midpointValue }
        : { u: midpointValue, v: input.fixedValue };
    if (!pointInHouseRoofMaterialProjectedPolygon(midpoint, input.polygon)) continue;

    segments.push(
      input.fixedAxis === 'u'
        ? {
            start: { u: input.fixedValue, v: startValue },
            end: { u: input.fixedValue, v: endValue },
          }
        : {
            start: { u: startValue, v: input.fixedValue },
            end: { u: endValue, v: input.fixedValue },
          },
    );
  }

  return segments;
}

export function buildHouseRoofMaterialVisualForPlane(input: {
  roofPlane: RoofPlane3D;
  material: HouseRoofMaterial;
}): HouseRoofMaterialVisual3D | null {
  const settings = houseRoofMaterialSettings(input.material);
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;
  if (!input.roofPlane.boundary.every(finiteRoofQaPoint) || polygonArea3D(input.roofPlane.boundary) <= ROOF_REGION_MIN_AREA_MM2) {
    return null;
  }

  const rawFall = normalizeVector(input.roofPlane.fallVector);
  if (finiteVectorLength(rawFall) <= ROOF_JOIN_EPSILON_MM) return null;
  const normalFallDot = dotProduct(rawFall, topNormal);
  const fallAxis = normalizeVector({
    x: rawFall.x - topNormal.x * normalFallDot,
    y: rawFall.y - topNormal.y * normalFallDot,
    z: rawFall.z - topNormal.z * normalFallDot,
  });
  if (finiteVectorLength(fallAxis) <= ROOF_JOIN_EPSILON_MM) return null;

  const acrossAxis = normalizeVector(crossProduct(topNormal, fallAxis));
  if (finiteVectorLength(acrossAxis) <= ROOF_JOIN_EPSILON_MM) return null;

  const origin = input.roofPlane.plane.origin;
  const projected = input.roofPlane.boundary.map((candidate) => {
    const relative = subtractPoints(candidate, origin);
    return {
      u: dotProduct(relative, acrossAxis),
      v: dotProduct(relative, fallAxis),
    };
  });
  if (
    projected.length < 3 ||
    uniqueHouseRoofMaterialProjectedPointCount(projected) < 3 ||
    projectedHouseRoofMaterialPolygonArea(projected) <= ROOF_REGION_MIN_AREA_MM2
  ) {
    return null;
  }

  const coordinates =
    settings.lineDirection === 'fall'
      ? houseRoofMaterialCoordinateValues(
          Math.min(...projected.map((candidate) => candidate.u)),
          Math.max(...projected.map((candidate) => candidate.u)),
          settings.spacingMm,
        )
      : houseRoofMaterialCoordinateValues(
          Math.min(...projected.map((candidate) => candidate.v)),
          Math.max(...projected.map((candidate) => candidate.v)),
          settings.spacingMm,
        );
  const offset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM);
  const lines = coordinates.flatMap((fixedValue) =>
    clipHouseRoofMaterialLine({
      polygon: projected,
      fixedAxis: settings.lineDirection === 'fall' ? 'u' : 'v',
      fixedValue,
    }).map((segment) =>
      line(
        worldHouseRoofMaterialPoint({
          origin,
          acrossAxis,
          fallAxis,
          offset,
          u: segment.start.u,
          v: segment.start.v,
        }),
        worldHouseRoofMaterialPoint({
          origin,
          acrossAxis,
          fallAxis,
          offset,
          u: segment.end.u,
          v: segment.end.v,
        }),
      ),
    ),
  ).filter((candidate) => lineLength(candidate) > 1 && finiteRoofQaPoint(candidate.start) && finiteRoofQaPoint(candidate.end));

  if (lines.length === 0) return null;

  return {
    id: `house-roof-material-${input.roofPlane.id}`,
    roofPlaneId: input.roofPlane.id,
    material: input.material,
    profileKind: settings.profileKind,
    lines,
    plane: {
      ...input.roofPlane.plane,
      origin: translatePointByVector(input.roofPlane.plane.origin, offset),
    },
    spacingMm: settings.spacingMm,
    surfaceOffsetMm: DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
    metadata: {
      source: 'house_model',
      sourceRoofPlaneId: input.roofPlane.id,
      material: input.material,
      profileKind: settings.profileKind,
      lineDirection: settings.lineDirection,
      spacingMm: settings.spacingMm,
      surfaceOffsetMm: DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
      lineCount: lines.length,
    },
  };
}

export function buildHouseRoofMaterialVisuals(input: {
  roofPlanes: RoofPlane3D[];
  material: HouseRoofMaterial;
}): HouseRoofMaterialVisual3D[] {
  return input.roofPlanes
    .map((roofPlane) => buildHouseRoofMaterialVisualForPlane({ roofPlane, material: input.material }))
    .filter((visual): visual is HouseRoofMaterialVisual3D => visual !== null);
}
