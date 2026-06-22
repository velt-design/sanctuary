import type { Point3, Polygon3 } from '../contracts';
import { lineLength } from '../math3d';
import {
  boundingBox,
  line,
  lineIntersection2,
  point,
  signedAreaXY,
} from './_internal';

const HOUSE_FOOTPRINT_CANONICALIZATION_PRECISION_MM = 0.001;

type CanonicalizedHouseFootprint = {
  footprint: Polygon3;
  status: 'none' | 'canonicalized';
  precisionMm: number;
  pointCountBefore: number;
  pointCountAfter: number;
};

function canonicalizeCoord(value: number, precisionMm: number): number {
  const rounded = Math.round(value / precisionMm) * precisionMm;
  const stable = Number(rounded.toFixed(6));
  return Object.is(stable, -0) ? 0 : stable;
}

function pointsEqual(a: Point3, b: Point3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function residueCollinearPoint(input: {
  previous: Point3;
  current: Point3;
  next: Point3;
  precisionMm: number;
}): boolean {
  const previousSegmentLength = lineLength(line(input.previous, input.current));
  const nextSegmentLength = lineLength(line(input.current, input.next));
  if (
    previousSegmentLength > input.precisionMm &&
    nextSegmentLength > input.precisionMm
  ) {
    return false;
  }
  return (
    (input.previous.x === input.current.x && input.current.x === input.next.x) ||
    (input.previous.y === input.current.y && input.current.y === input.next.y)
  );
}

export function canonicalizeHouseFootprintPolygon(
  footprint: Polygon3,
  precisionMm = HOUSE_FOOTPRINT_CANONICALIZATION_PRECISION_MM,
): CanonicalizedHouseFootprint {
  const rounded = footprint.map((candidate) =>
    point(
      canonicalizeCoord(candidate.x, precisionMm),
      canonicalizeCoord(candidate.y, precisionMm),
      canonicalizeCoord(candidate.z, precisionMm),
    ),
  );
  const deduped: Polygon3 = [];
  for (const candidate of rounded) {
    const previous = deduped[deduped.length - 1];
    if (previous && pointsEqual(previous, candidate)) continue;
    deduped.push(candidate);
  }
  if (deduped.length > 1 && pointsEqual(deduped[0]!, deduped[deduped.length - 1]!)) {
    deduped.pop();
  }

  const cleaned = [...deduped];
  let changed = true;
  while (changed && cleaned.length >= 3) {
    changed = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]!;
      const current = cleaned[index]!;
      const next = cleaned[(index + 1) % cleaned.length]!;
      if (!residueCollinearPoint({ previous, current, next, precisionMm })) {
        continue;
      }
      cleaned.splice(index, 1);
      changed = true;
      break;
    }
  }

  const pointCountChanged = cleaned.length !== footprint.length;
  const coordinateChanged =
    !pointCountChanged &&
    cleaned.some((candidate, index) => !pointsEqual(candidate, footprint[index]!));
  return {
    footprint: cleaned,
    status: pointCountChanged || coordinateChanged ? 'canonicalized' : 'none',
    precisionMm,
    pointCountBefore: footprint.length,
    pointCountAfter: cleaned.length,
  };
}

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

export function isRectanglePolygon(polygon: Polygon3): boolean {
  if (polygon.length !== 4) return false;
  const box = boundingBox(polygon);
  return polygon.every((candidate) =>
    (Math.abs(candidate.x - box.minX) <= 1e-6 || Math.abs(candidate.x - box.maxX) <= 1e-6) &&
    (Math.abs(candidate.y - box.minY) <= 1e-6 || Math.abs(candidate.y - box.maxY) <= 1e-6),
  );
}
