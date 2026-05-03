import { distanceBetweenOutlinePoints, MIN_OUTLINE_SEGMENT_M } from './drawOutlineToolGeometry';
import type { DrawOutlinePoint } from './drawOutlineToolState';

type DrawOutlineValidationIssueCode =
  | 'too-few-points'
  | 'non-finite-point'
  | 'duplicate-adjacent-point'
  | 'zero-area'
  | 'self-intersection';

export type DrawOutlineValidationIssue = {
  code: DrawOutlineValidationIssueCode;
  message: string;
  pointIndex?: number;
  segmentIndex?: number;
  segmentIndexes?: [number, number];
  pointCount?: number;
  minPointCount?: number;
};

type DrawOutlineValidationResult = { ok: true } | { ok: false; issue: DrawOutlineValidationIssue };

const MIN_OUTLINE_POINT_COUNT = 3;

export function validateDrawOutlinePoints(points: DrawOutlinePoint[]): DrawOutlineValidationResult {
  if (points.length < MIN_OUTLINE_POINT_COUNT) {
    return {
      ok: false,
      issue: {
        code: 'too-few-points',
        message: 'Add at least 3 points before closing the outline.',
        pointCount: points.length,
        minPointCount: MIN_OUTLINE_POINT_COUNT,
      },
    };
  }

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    if (!Number.isFinite(current.alongM) || !Number.isFinite(current.depthM)) {
      return {
        ok: false,
        issue: {
          code: 'non-finite-point',
          message: 'House footprint outline points need finite along/depth values.',
          pointIndex: index,
        },
      };
    }
    if (distanceBetweenOutlinePoints(current, next) < MIN_OUTLINE_SEGMENT_M) {
      return {
        ok: false,
        issue: {
          code: 'duplicate-adjacent-point',
          message: 'House footprint outline cannot include duplicate consecutive points.',
          segmentIndex: index,
        },
      };
    }
  }

  for (let index = 0; index < points.length; index += 1) {
    const a1 = points[index]!;
    const a2 = points[(index + 1) % points.length]!;
    for (let jndex = index + 1; jndex < points.length; jndex += 1) {
      if (areAdjacentSegments(index, jndex, points.length)) continue;
      const b1 = points[jndex]!;
      const b2 = points[(jndex + 1) % points.length]!;
      if (outlineSegmentsIntersect(a1, a2, b1, b2)) {
        return {
          ok: false,
          issue: {
            code: 'self-intersection',
            message: 'House footprint outline cannot self-intersect.',
            segmentIndexes: [index, jndex],
          },
        };
      }
    }
  }

  if (Math.abs(signedPolygonArea(points)) <= 1e-9) {
    return {
      ok: false,
      issue: {
        code: 'zero-area',
        message: 'House footprint outline needs a non-zero area.',
      },
    };
  }

  return { ok: true };
}

function signedPolygonArea(points: DrawOutlinePoint[]): number {
  return (
    points.reduce((sum, current, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + current.alongM * next.depthM - next.alongM * current.depthM;
    }, 0) / 2
  );
}

function areAdjacentSegments(firstIndex: number, secondIndex: number, pointCount: number): boolean {
  return Math.abs(firstIndex - secondIndex) <= 1 || (firstIndex === 0 && secondIndex === pointCount - 1);
}

function orientation(a: DrawOutlinePoint, b: DrawOutlinePoint, c: DrawOutlinePoint): number {
  return (b.depthM - a.depthM) * (c.alongM - b.alongM) - (b.alongM - a.alongM) * (c.depthM - b.depthM);
}

function outlinePointOnSegment(a: DrawOutlinePoint, b: DrawOutlinePoint, c: DrawOutlinePoint): boolean {
  return (
    b.alongM <= Math.max(a.alongM, c.alongM) + 1e-9 &&
    b.alongM + 1e-9 >= Math.min(a.alongM, c.alongM) &&
    b.depthM <= Math.max(a.depthM, c.depthM) + 1e-9 &&
    b.depthM + 1e-9 >= Math.min(a.depthM, c.depthM)
  );
}

function outlineSegmentsIntersect(a1: DrawOutlinePoint, a2: DrawOutlinePoint, b1: DrawOutlinePoint, b2: DrawOutlinePoint): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (Math.abs(o1) <= 1e-9 && outlinePointOnSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= 1e-9 && outlinePointOnSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= 1e-9 && outlinePointOnSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= 1e-9 && outlinePointOnSegment(b1, a2, b2)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}
