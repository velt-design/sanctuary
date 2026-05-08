import { describe, expect, it } from 'vitest';
import type { Point2 } from '@sp/geometry';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';
import { resolveMoveSnap } from './resolveMoveSnap';

// 4m x 2m rectangle near the origin. Edge ordering (CCW around centroid in
// world_x_right / world_y_down):
//   edge 0: bottom (y = 0,    x from 0 -> 4000)  -- outward normal = (0, -1)
//   edge 1: right  (x = 4000, y from 0 -> 2000)  -- outward normal = (+1, 0)
//   edge 2: top    (y = 2000, x from 4000 -> 0)  -- outward normal = (0, +1)
//   edge 3: left   (x = 0,    y from 2000 -> 0)  -- outward normal = (-1, 0)
const RECT: Point2[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 2000 },
  { x: 0, y: 2000 },
];

function wallTarget(start: Point2, end: Point2, edgeKind: SnapLineTarget['edgeKind'] = 'wall'): SnapLineTarget {
  return {
    id: `target-${start.x}-${start.y}-${end.x}-${end.y}`,
    sourceObjectId: 'house-1',
    edgeKind,
    start,
    end,
  };
}

describe('resolveMoveSnap', () => {
  it('returns null when no targets are provided', () => {
    expect(
      resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 100, y: 0 },
        lineTargets: [],
      }),
    ).toBeNull();
  });

  it('returns null when the polygon has fewer than 3 vertices', () => {
    expect(
      resolveMoveSnap({
        originalPolygon: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        naturalDeltaMm: { x: 0, y: 0 },
        lineTargets: [wallTarget({ x: 0, y: 1000 }, { x: 1000, y: 1000 })],
      }),
    ).toBeNull();
  });

  it('snaps the right edge to a vertical wall when the natural drag lands close', () => {
    // Natural drag pushes the rect 200mm to the right. A vertical wall sits
    // at x = 4150 -- 50mm to the right of the right edge's natural position
    // (4000 + 200 = 4200, target at 4150, correction = 50).
    const wall = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 });
    const result = resolveMoveSnap({
      originalPolygon: RECT,
      naturalDeltaMm: { x: 200, y: 0 },
      lineTargets: [wall],
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edgeIndex).toBe(1); // right edge
    expect(result.edgeSnap.target.id).toBe(wall.id);
    // Adjusted delta: the right edge sits exactly at x=4150 after the move,
    // so the 2D delta x-component is 4150 - 4000 = 150.
    expect(result.adjustedDeltaMm.x).toBeCloseTo(150, 3);
    // Y component preserved (parallel-to-edge sliding stays free).
    expect(result.adjustedDeltaMm.y).toBeCloseTo(0, 3);
  });

  it('preserves the natural parallel-to-edge component when snapping perpendicular', () => {
    // Diagonal drag (200, 300). Right edge wants to land at x=4150 (snap
    // sweet-spot 50mm correction). The y component must stay at 300 --
    // user is sliding the rect diagonally, the snap only constrains x.
    const wall = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 });
    const result = resolveMoveSnap({
      originalPolygon: RECT,
      naturalDeltaMm: { x: 200, y: 300 },
      lineTargets: [wall],
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.adjustedDeltaMm.x).toBeCloseTo(150, 3);
    expect(result.adjustedDeltaMm.y).toBeCloseTo(300, 3);
  });

  it('chooses the edge whose snap correction is smallest when multiple edges are within tolerance', () => {
    // Two walls in range:
    //   - Right wall at x=4220 (right edge naturally at 4200 -> correction 20mm)
    //   - Top wall at y=2230  (top edge naturally at 2200 -> correction 30mm)
    // Both within default 250mm tolerance; right edge wins.
    const rightWall = wallTarget({ x: 4220, y: -1000 }, { x: 4220, y: 3000 });
    const topWall = wallTarget({ x: -1000, y: 2230 }, { x: 5000, y: 2230 });
    const result = resolveMoveSnap({
      originalPolygon: RECT,
      naturalDeltaMm: { x: 200, y: 200 },
      lineTargets: [rightWall, topWall],
    });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edgeIndex).toBe(1);
    expect(result.edgeSnap.target.id).toBe(rightWall.id);
  });

  it('returns null when every candidate is outside the tolerance', () => {
    // Wall is 500mm away from the natural right-edge position; default
    // tolerance is 250mm so this should NOT snap.
    const wall = wallTarget({ x: 4700, y: -1000 }, { x: 4700, y: 3000 });
    expect(
      resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 200, y: 0 },
        lineTargets: [wall],
      }),
    ).toBeNull();
  });

  it('returns null when no candidate is parallel to any edge', () => {
    // 45-degree diagonal target: not parallel to any rect edge.
    const wall = wallTarget({ x: 4000, y: 0 }, { x: 5000, y: 1000 });
    expect(
      resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 200, y: 0 },
        lineTargets: [wall],
      }),
    ).toBeNull();
  });

  it('snap result preserves edgeKind so the consumer can filter by family rules (e.g. exclude roof_eave for decks)', () => {
    // The MoveTool's host is responsible for pre-filtering targets by
    // edgeKind (decks pass walls only; pergolas pass walls + roof_eaves).
    // Here we verify the result faithfully exposes the target's edgeKind
    // so downstream consumers (attachment formation, indicator render)
    // can act on it.
    const eave = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 }, 'roof_eave');
    const result = resolveMoveSnap({
      originalPolygon: RECT,
      naturalDeltaMm: { x: 200, y: 0 },
      lineTargets: [eave],
    });
    expect(result?.edgeSnap.target.edgeKind).toBe('roof_eave');
  });
});
