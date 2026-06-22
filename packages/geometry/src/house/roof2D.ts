import type { Line3, Point3, Polygon3 } from '../contracts';
import { ROOF_JOIN_EPSILON_MM } from './constants';
import { clamp, line, type RoofPoint2 } from './_internal';
import { pointInOrOnRoofPolygon, pointOnRoofPolygonBoundary } from './roofPlane';

export function point2FromPoint3(candidate: Point3): RoofPoint2 {
  return { x: candidate.x, y: candidate.y };
}

export function roofPointDistance2(a: RoofPoint2, b: RoofPoint2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function signedArea2D(points: RoofPoint2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function cleanRoofPolygon2D(points: RoofPoint2[]): RoofPoint2[] {
  const withoutDuplicates: RoofPoint2[] = [];
  for (const candidate of points) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1];
    if (previous && roofPointDistance2(previous, candidate) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
      continue;
    }
    withoutDuplicates.push(candidate);
  }
  if (
    withoutDuplicates.length > 1 &&
    roofPointDistance2(withoutDuplicates[0]!, withoutDuplicates[withoutDuplicates.length - 1]!) <=
      ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
  ) {
    withoutDuplicates.pop();
  }

  if (withoutDuplicates.length < 3) return withoutDuplicates;

  const cleaned: RoofPoint2[] = [];
  for (let index = 0; index < withoutDuplicates.length; index += 1) {
    const previous = withoutDuplicates[(index - 1 + withoutDuplicates.length) % withoutDuplicates.length]!;
    const current = withoutDuplicates[index]!;
    const next = withoutDuplicates[(index + 1) % withoutDuplicates.length]!;
    const cross =
      (current.x - previous.x) * (next.y - current.y) -
      (current.y - previous.y) * (next.x - current.x);
    if (Math.abs(cross) <= ROOF_JOIN_EPSILON_MM) continue;
    cleaned.push(current);
  }
  return cleaned.length >= 3 ? cleaned : withoutDuplicates;
}

export function roofPoint3Key(candidate: Point3): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)},${candidate.z.toFixed(3)}`;
}

export function roofPoint2Key(candidate: RoofPoint2): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)}`;
}

export function canonicalRoofSegmentKey(start: Point3, end: Point3): string {
  const startKey = roofPoint3Key(start);
  const endKey = roofPoint3Key(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

export function compareRoofPoints(a: Point3, b: Point3): number {
  return a.x - b.x || a.y - b.y || a.z - b.z;
}

export function orientRoofFeatureLine(start: Point3, end: Point3, eaveHeightMm: number): Line3 {
  const startAtEave = Math.abs(start.z - eaveHeightMm) <= ROOF_JOIN_EPSILON_MM;
  const endAtEave = Math.abs(end.z - eaveHeightMm) <= ROOF_JOIN_EPSILON_MM;
  if (startAtEave && !endAtEave) return line(start, end);
  if (!startAtEave && endAtEave) return line(end, start);
  return compareRoofPoints(start, end) <= 0 ? line(start, end) : line(end, start);
}

export function clipRoofPolygonByScalar(
  polygon: RoofPoint2[],
  scalar: (candidate: RoofPoint2) => number,
): RoofPoint2[] {
  if (polygon.length < 3) return [];
  const clipped: RoofPoint2[] = [];

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
        : {
            x: current.x + (next.x - current.x) * clamp(currentValue / denominator, 0, 1),
            y: current.y + (next.y - current.y) * clamp(currentValue / denominator, 0, 1),
          };

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      if (intersection) clipped.push(intersection);
    } else if (!currentInside && nextInside) {
      if (intersection) clipped.push(intersection);
      clipped.push(next);
    }
  }

  return cleanRoofPolygon2D(clipped);
}

export function roofPolygonArea(polygon: RoofPoint2[]): number {
  return Math.abs(signedArea2D(polygon));
}

export function roofPolygonCentroid(polygon: RoofPoint2[]): RoofPoint2 {
  const area = signedArea2D(polygon);
  if (Math.abs(area) <= ROOF_JOIN_EPSILON_MM) {
    const total = polygon.reduce((sum, candidate) => ({ x: sum.x + candidate.x, y: sum.y + candidate.y }), { x: 0, y: 0 });
    return {
      x: total.x / Math.max(1, polygon.length),
      y: total.y / Math.max(1, polygon.length),
    };
  }
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const cross = current.x * next.y - next.x * current.y;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function segmentInsideRoofPolygon(start: RoofPoint2, end: RoofPoint2, polygon: Polygon3): boolean {
  const samples = [0.2, 0.4, 0.6, 0.8];
  return samples.every((sample) =>
    pointInOrOnRoofPolygon(
      {
        x: start.x + (end.x - start.x) * sample,
        y: start.y + (end.y - start.y) * sample,
      },
      polygon,
    ),
  );
}

export function roofSegmentOverlapLength2D(
  aStart: RoofPoint2,
  aEnd: RoofPoint2,
  bStart: RoofPoint2,
  bEnd: RoofPoint2,
): number {
  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;
  const aLength = Math.hypot(aDx, aDy);
  const bLength = Math.hypot(bDx, bDy);
  if (aLength <= ROOF_JOIN_EPSILON_MM || bLength <= ROOF_JOIN_EPSILON_MM) return 0;
  const directionCross = Math.abs(aDx * bDy - aDy * bDx) / (aLength * bLength);
  if (directionCross > 1e-6) return 0;
  const bStartDistance = Math.abs((bStart.x - aStart.x) * aDy - (bStart.y - aStart.y) * aDx) / aLength;
  const bEndDistance = Math.abs((bEnd.x - aStart.x) * aDy - (bEnd.y - aStart.y) * aDx) / aLength;
  if (bStartDistance > ROOF_JOIN_EPSILON_MM || bEndDistance > ROOF_JOIN_EPSILON_MM) return 0;

  const unitX = aDx / aLength;
  const unitY = aDy / aLength;
  const aMin = 0;
  const aMax = aLength;
  const bProjectionStart = (bStart.x - aStart.x) * unitX + (bStart.y - aStart.y) * unitY;
  const bProjectionEnd = (bEnd.x - aStart.x) * unitX + (bEnd.y - aStart.y) * unitY;
  const bMin = Math.min(bProjectionStart, bProjectionEnd);
  const bMax = Math.max(bProjectionStart, bProjectionEnd);
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function roofSegmentsProperlyIntersect2D(
  aStart: RoofPoint2,
  aEnd: RoofPoint2,
  bStart: RoofPoint2,
  bEnd: RoofPoint2,
): boolean {
  const pointOnSegment = (candidate: RoofPoint2, start: RoofPoint2, end: RoofPoint2): boolean => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
    if (Math.abs(cross) > 1e-2) return false;
    const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
    if (dot < -1e-2) return false;
    const lengthSq = dx * dx + dy * dy;
    return dot <= lengthSq + 1e-2;
  };
  if (
    pointOnSegment(aStart, bStart, bEnd) ||
    pointOnSegment(aEnd, bStart, bEnd) ||
    pointOnSegment(bStart, aStart, aEnd) ||
    pointOnSegment(bEnd, aStart, aEnd)
  ) {
    return false;
  }
  const a1 = (aEnd.x - aStart.x) * (bStart.y - aStart.y) - (aEnd.y - aStart.y) * (bStart.x - aStart.x);
  const a2 = (aEnd.x - aStart.x) * (bEnd.y - aStart.y) - (aEnd.y - aStart.y) * (bEnd.x - aStart.x);
  const b1 = (bEnd.x - bStart.x) * (aStart.y - bStart.y) - (bEnd.y - bStart.y) * (aStart.x - bStart.x);
  const b2 = (bEnd.x - bStart.x) * (aEnd.y - bStart.y) - (bEnd.y - bStart.y) * (aEnd.x - bStart.x);
  return (
    a1 * a2 < -ROOF_JOIN_EPSILON_MM &&
    b1 * b2 < -ROOF_JOIN_EPSILON_MM
  );
}

export function roofPolygonIsSimple(polygon: RoofPoint2[]): boolean {
  for (let firstIndex = 0; firstIndex < polygon.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % polygon.length;
    for (let secondIndex = firstIndex + 1; secondIndex < polygon.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % polygon.length;
      if (
        firstIndex === secondIndex ||
        firstNext === secondIndex ||
        secondNext === firstIndex
      ) {
        continue;
      }
      if (
        roofSegmentsProperlyIntersect2D(
          polygon[firstIndex]!,
          polygon[firstNext]!,
          polygon[secondIndex]!,
          polygon[secondNext]!,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function roofSegmentInsidePolygonStrict(start: RoofPoint2, end: RoofPoint2, polygon: Polygon3): boolean {
  if (!pointInOrOnRoofPolygon(start, polygon) || !pointInOrOnRoofPolygon(end, polygon)) return false;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (!pointInOrOnRoofPolygon(midpoint, polygon)) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const edgeStart = point2FromPoint3(polygon[index]!);
    const edgeEnd = point2FromPoint3(polygon[(index + 1) % polygon.length]!);
    if (roofSegmentsProperlyIntersect2D(start, end, edgeStart, edgeEnd)) return false;
  }
  return true;
}

export function roofRegionInsideEave(region: RoofPoint2[], eavePolygon: Polygon3): boolean {
  return region.every((candidate, index) =>
    roofSegmentInsidePolygonStrict(candidate, region[(index + 1) % region.length]!, eavePolygon),
  );
}

export function roofPointOnEaveBoundaryAtWrongHeight(candidate: Point3, eavePolygon: Polygon3, eaveHeightMm: number): boolean {
  return (
    pointOnRoofPolygonBoundary(point2FromPoint3(candidate), eavePolygon) &&
    Math.abs(candidate.z - eaveHeightMm) > 1
  );
}

export function roofPoint2FromKey(key: string): RoofPoint2 {
  const [x, y] = key.split(',').map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

export function pointOnRoofSegment2(candidate: RoofPoint2, start: RoofPoint2, end: RoofPoint2): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-2) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-2) return false;
  return dot <= dx * dx + dy * dy + 1e-2;
}

export function roofSegmentParam(start: RoofPoint2, end: RoofPoint2, candidate: RoofPoint2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return 0;
  return ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq;
}

export function addRoofDissolveSplitPoint(points: RoofPoint2[], candidate: RoofPoint2): void {
  if (!points.some((existing) => roofPointDistance2(existing, candidate) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM)) {
    points.push(candidate);
  }
}

export function roofSegmentIntersectionPoint(
  aStart: RoofPoint2,
  aEnd: RoofPoint2,
  bStart: RoofPoint2,
  bEnd: RoofPoint2,
): RoofPoint2 | null {
  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;
  const denominator = aDx * bDy - aDy * bDx;
  if (Math.abs(denominator) <= 1e-6) return null;
  const t = ((bStart.x - aStart.x) * bDy - (bStart.y - aStart.y) * bDx) / denominator;
  const u = ((bStart.x - aStart.x) * aDy - (bStart.y - aStart.y) * aDx) / denominator;
  if (t < -ROOF_JOIN_EPSILON_MM || t > 1 + ROOF_JOIN_EPSILON_MM) return null;
  if (u < -ROOF_JOIN_EPSILON_MM || u > 1 + ROOF_JOIN_EPSILON_MM) return null;
  return {
    x: aStart.x + aDx * clamp(t, 0, 1),
    y: aStart.y + aDy * clamp(t, 0, 1),
  };
}
