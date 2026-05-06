import type { Line3, Point3, Polygon3 } from '../contracts';
import { lineLength } from '../math3d';
import {
  boundingBox,
  clamp,
  distanceToSegment2D,
  line,
  lineIntersection2,
  point,
  pointInPolygon2D,
  polygonCentroid2D,
  signedAreaXY,
  uniqueSorted,
} from './_internal';

export function isOrthogonalFootprint(polygon: Polygon3): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    if (lineLength(line(current, next)) <= 1e-6) return false;
    if (Math.abs(current.x - next.x) > 1e-6 && Math.abs(current.y - next.y) > 1e-6) {
      return false;
    }
  }
  return Math.abs(signedAreaXY(polygon)) > 1e-6;
}

export function offsetFootprintPolygon(footprint: Polygon3, offsetMm: number): Polygon3 | null {
  if (!isOrthogonalFootprint(footprint)) return null;
  const orientation = signedAreaXY(footprint) >= 0 ? 1 : -1;
  const shiftedEdges = footprint.map((current, index) => {
    const next = footprint[(index + 1) % footprint.length]!;
    const length = lineLength(line(current, next));
    const unitX = (next.x - current.x) / length;
    const unitY = (next.y - current.y) / length;
    const outward = orientation >= 0
      ? { x: unitY, y: -unitX }
      : { x: -unitY, y: unitX };
    return {
      start: point(current.x + outward.x * offsetMm, current.y + outward.y * offsetMm, 0),
      end: point(next.x + outward.x * offsetMm, next.y + outward.y * offsetMm, 0),
    };
  });

  const offset: Polygon3 = [];
  for (let index = 0; index < shiftedEdges.length; index += 1) {
    const previous = shiftedEdges[(index - 1 + shiftedEdges.length) % shiftedEdges.length]!;
    const current = shiftedEdges[index]!;
    const intersection = lineIntersection2(previous.start, previous.end, current.start, current.end);
    offset.push(intersection ? point(intersection.x, intersection.y, 0) : current.start);
  }
  return offset.every((candidate) => Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) ? offset : null;
}

export function clearanceToPolygon(candidate: { x: number; y: number }, polygon: Polygon3): number {
  let clearance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    clearance = Math.min(clearance, distanceToSegment2D(candidate, polygon[index]!, polygon[(index + 1) % polygon.length]!));
  }
  return clearance;
}

export function findInteriorRoofNode(polygon: Polygon3): { point: Point3; clearanceMm: number } {
  const box = boundingBox(polygon);
  const candidates: Array<{ x: number; y: number }> = [
    { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
    polygonCentroid2D(polygon),
  ];
  const xs = uniqueSorted([box.minX, box.maxX, ...polygon.map((candidate) => candidate.x)]);
  const ys = uniqueSorted([box.minY, box.maxY, ...polygon.map((candidate) => candidate.y)]);
  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const x = (xs[xIndex]! + xs[xIndex + 1]!) / 2;
      const y = (ys[yIndex]! + ys[yIndex + 1]!) / 2;
      candidates.push({ x, y });
    }
  }

  let selected = candidates[0]!;
  let selectedClearance = -1;
  for (const candidate of candidates) {
    if (!pointInPolygon2D(candidate, polygon)) continue;
    const clearance = clearanceToPolygon(candidate, polygon);
    if (clearance > selectedClearance) {
      selected = candidate;
      selectedClearance = clearance;
    }
  }

  if (selectedClearance <= 0) {
    selectedClearance = Math.max(1, Math.min(box.maxX - box.minX, box.maxY - box.minY) / 4);
  }
  return { point: point(selected.x, selected.y, 0), clearanceMm: selectedClearance };
}

export function polygonLineInterval(input: {
  polygon: Polygon3;
  axis: 'x' | 'y';
  coordinate: number;
  through: number;
}): { min: number; max: number } | null {
  const intersections: number[] = [];
  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    if (input.axis === 'x') {
      if (Math.abs(start.y - end.y) <= 1e-6) continue;
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      if (input.coordinate <= minY || input.coordinate > maxY) continue;
      intersections.push(start.x);
    } else {
      if (Math.abs(start.x - end.x) <= 1e-6) continue;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      if (input.coordinate <= minX || input.coordinate > maxX) continue;
      intersections.push(start.y);
    }
  }
  intersections.sort((a, b) => a - b);
  for (let index = 0; index < intersections.length - 1; index += 2) {
    const min = intersections[index]!;
    const max = intersections[index + 1]!;
    if (input.through >= min - 1e-6 && input.through <= max + 1e-6) {
      return { min, max };
    }
  }
  return null;
}

export function closestPointOnLineSegment2D(candidate: Point3, source: Line3): Point3 {
  const dx = source.end.x - source.start.x;
  const dy = source.end.y - source.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return source.start;
  const ratio = clamp(((candidate.x - source.start.x) * dx + (candidate.y - source.start.y) * dy) / lengthSq, 0, 1);
  return point(source.start.x + dx * ratio, source.start.y + dy * ratio, source.start.z + (source.end.z - source.start.z) * ratio);
}

export function isRectanglePolygon(polygon: Polygon3): boolean {
  if (polygon.length !== 4) return false;
  const box = boundingBox(polygon);
  return polygon.every((candidate) =>
    (Math.abs(candidate.x - box.minX) <= 1e-6 || Math.abs(candidate.x - box.maxX) <= 1e-6) &&
    (Math.abs(candidate.y - box.minY) <= 1e-6 || Math.abs(candidate.y - box.maxY) <= 1e-6),
  );
}
