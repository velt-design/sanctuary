import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanPoint } from '../dragLifecycle';

export type SnapKind = 'endpoint' | 'midpoint' | 'edge' | 'centroid';

/**
 * A line-shaped snap target — for edges that aren't a polygon boundary, like
 * roof eaves at gutter height projected to plan space, or standalone wall
 * segments that aren't part of a closed body. Step 7a of the first-class
 * spatial-entities migration: `HouseModel3D.roofEaves` is the canonical input
 * source for `edgeKind: 'roof_eave'` line targets.
 */
export type SnapLineTarget = {
  /** Stable id (e.g. `roof-eave-${sourceEdgeId}`). */
  id: string;
  sourceObjectId: string;
  /** Domain edge kind for downstream attachment routing — e.g. `'roof_eave'`, `'wall'`. */
  edgeKind: string;
  start: PlanPoint;
  end: PlanPoint;
};

export type SnapTarget = {
  kind: SnapKind;
  point: PlanPoint;
  shapeId: string;
  sourceObjectId: string;
  edgeIndex?: number;
  /**
   * Domain edge kind (e.g. `'roof_eave'`, `'wall'`) when the candidate came
   * from a `SnapLineTarget`. Undefined for polygon-derived candidates — the
   * downstream consumer infers domain meaning from the shape's family/kind.
   */
  edgeKind?: string;
  priorityScore: number;
  distanceMm: number;
};

export type SnapEngineInput = {
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
  /** Optional standalone line snap targets (eaves, etc.). */
  lineTargets?: ReadonlyArray<SnapLineTarget>;
  enabledKinds: ReadonlyArray<SnapKind>;
  toleranceMm: number;
};

export type SnapQuery = {
  point: PlanPoint;
};

export type SnapEngine = {
  query: (query: SnapQuery) => SnapTarget[];
};

const PRIORITY_BY_KIND: Record<SnapKind, number> = {
  endpoint: 100,
  midpoint: 80,
  edge: 60,
  centroid: 40,
};

function distance(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function closestPointOnSegment(query: PlanPoint, a: PlanPoint, b: PlanPoint): PlanPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((query.x - a.x) * dx + (query.y - a.y) * dy) / lengthSq));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function shapeCentroid(shape: GeometryTopProjectionShape): PlanPoint | null {
  if (!shape.polygon.length) return null;
  let sumX = 0;
  let sumY = 0;
  for (const point of shape.polygon) {
    sumX += point.x;
    sumY += point.y;
  }
  return { x: sumX / shape.polygon.length, y: sumY / shape.polygon.length };
}

function pushIfWithin(
  out: SnapTarget[],
  candidate: Omit<SnapTarget, 'distanceMm' | 'priorityScore'> & { kind: SnapKind },
  query: PlanPoint,
  toleranceMm: number,
): void {
  const distanceMm = distance(query, candidate.point);
  if (distanceMm > toleranceMm) return;
  out.push({
    ...candidate,
    distanceMm,
    priorityScore: PRIORITY_BY_KIND[candidate.kind],
  });
}

export function createSnapEngine(input: SnapEngineInput): SnapEngine {
  const enabled = new Set<SnapKind>(input.enabledKinds);
  const tolerance = input.toleranceMm;

  return {
    query({ point }) {
      const results: SnapTarget[] = [];
      for (const shape of input.shapes) {
        const polygon = shape.polygon;
        if (!polygon.length) continue;
        if (enabled.has('endpoint')) {
          for (const vertex of polygon) {
            pushIfWithin(
              results,
              {
                kind: 'endpoint',
                point: { x: vertex.x, y: vertex.y },
                shapeId: shape.id,
                sourceObjectId: shape.sourceObjectId,
              },
              point,
              tolerance,
            );
          }
        }
        if (enabled.has('midpoint') || enabled.has('edge')) {
          for (let index = 0; index < polygon.length; index += 1) {
            const a = polygon[index]!;
            const b = polygon[(index + 1) % polygon.length]!;
            if (enabled.has('midpoint')) {
              pushIfWithin(
                results,
                {
                  kind: 'midpoint',
                  point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                  shapeId: shape.id,
                  sourceObjectId: shape.sourceObjectId,
                  edgeIndex: index,
                },
                point,
                tolerance,
              );
            }
            if (enabled.has('edge')) {
              const projected = closestPointOnSegment(point, a, b);
              pushIfWithin(
                results,
                {
                  kind: 'edge',
                  point: projected,
                  shapeId: shape.id,
                  sourceObjectId: shape.sourceObjectId,
                  edgeIndex: index,
                },
                point,
                tolerance,
              );
            }
          }
        }
        if (enabled.has('centroid')) {
          const centroid = shapeCentroid(shape);
          if (centroid) {
            pushIfWithin(
              results,
              {
                kind: 'centroid',
                point: centroid,
                shapeId: shape.id,
                sourceObjectId: shape.sourceObjectId,
              },
              point,
              tolerance,
            );
          }
        }
      }
      // Line snap targets — single-segment candidates with no centroid or
      // wraparound. Endpoint and midpoint produce one candidate each;
      // edge produces a perpendicular foot. `edgeKind` is preserved so
      // downstream attachment routing can distinguish roof_eave from wall.
      for (const target of input.lineTargets ?? []) {
        if (enabled.has('endpoint')) {
          pushIfWithin(
            results,
            {
              kind: 'endpoint',
              point: { x: target.start.x, y: target.start.y },
              shapeId: target.id,
              sourceObjectId: target.sourceObjectId,
              edgeKind: target.edgeKind,
            },
            point,
            tolerance,
          );
          pushIfWithin(
            results,
            {
              kind: 'endpoint',
              point: { x: target.end.x, y: target.end.y },
              shapeId: target.id,
              sourceObjectId: target.sourceObjectId,
              edgeKind: target.edgeKind,
            },
            point,
            tolerance,
          );
        }
        if (enabled.has('midpoint')) {
          pushIfWithin(
            results,
            {
              kind: 'midpoint',
              point: {
                x: (target.start.x + target.end.x) / 2,
                y: (target.start.y + target.end.y) / 2,
              },
              shapeId: target.id,
              sourceObjectId: target.sourceObjectId,
              edgeKind: target.edgeKind,
            },
            point,
            tolerance,
          );
        }
        if (enabled.has('edge')) {
          const projected = closestPointOnSegment(point, target.start, target.end);
          pushIfWithin(
            results,
            {
              kind: 'edge',
              point: projected,
              shapeId: target.id,
              sourceObjectId: target.sourceObjectId,
              edgeKind: target.edgeKind,
            },
            point,
            tolerance,
          );
        }
      }
      results.sort(
        (lhs, rhs) =>
          rhs.priorityScore - lhs.priorityScore || lhs.distanceMm - rhs.distanceMm,
      );
      return results;
    },
  };
}

export function bestSnapTarget(targets: SnapTarget[]): SnapTarget | null {
  return targets[0] ?? null;
}
