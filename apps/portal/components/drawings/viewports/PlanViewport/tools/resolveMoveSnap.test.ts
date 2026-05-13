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

  describe('corner snap (two non-parallel targets in tolerance)', () => {
    it('snaps to a corner when two perpendicular targets are both within tolerance, landing the polygon corner on their intersection', () => {
      // Natural drag pushes the rect by (200, 150). With RECT at origin:
      //   - Right edge naturally lands at x = 4200, snaps to vertical wall at x=4150 (correction 50mm)
      //   - Top edge naturally lands at y = 2150, snaps to horizontal wall at y=2200 (correction 50mm)
      // Corner intersection: (4150, 2200). The polygon's top-right corner
      // (originally 4000, 2000) should land there → 2D delta = (150, 200).
      const verticalWall = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 });
      const horizontalWall = wallTarget({ x: -1000, y: 2200 }, { x: 5000, y: 2200 });
      const result = resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 200, y: 150 },
        lineTargets: [verticalWall, horizontalWall],
      });
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.secondary).not.toBeNull();
      expect(result.secondary).toBeDefined();
      // Primary + secondary must be on different edges
      expect(result.secondary?.edgeIndex).not.toBe(result.edgeIndex);
      // Adjusted delta lands both edges on their targets
      expect(result.adjustedDeltaMm.x).toBeCloseTo(150, 3);
      expect(result.adjustedDeltaMm.y).toBeCloseTo(200, 3);
      // Corner vertex = intersection of the two target lines
      expect(result.cornerVertex?.x).toBeCloseTo(4150, 3);
      expect(result.cornerVertex?.y).toBeCloseTo(2200, 3);
    });

    it('omits secondary when only one target is in tolerance (single-snap path unchanged)', () => {
      const verticalWall = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 });
      // Horizontal wall is 800mm away from the top edge's natural position
      // (top edge naturally at y=2150, target y=2950 → correction 800mm,
      // outside 250mm tolerance).
      const distantHorizontalWall = wallTarget({ x: -1000, y: 2950 }, { x: 5000, y: 2950 });
      const result = resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 200, y: 150 },
        lineTargets: [verticalWall, distantHorizontalWall],
      });
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.secondary ?? null).toBeNull();
      expect(result.cornerVertex ?? null).toBeNull();
      // Single-snap path: x corrects to 150 (primary wall snap), y stays at 150 (free).
      expect(result.adjustedDeltaMm.x).toBeCloseTo(150, 3);
      expect(result.adjustedDeltaMm.y).toBeCloseTo(150, 3);
    });

    it('omits secondary when the best second candidate is parallel to the primary target', () => {
      // Two vertical walls — both parallel to each other. The closer one wins
      // as primary; the farther one is rejected as a corner partner because
      // it's parallel.
      const wallA = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 });
      const wallB = wallTarget({ x: 4220, y: -1000 }, { x: 4220, y: 3000 });
      const result = resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 200, y: 0 },
        lineTargets: [wallA, wallB],
      });
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.secondary ?? null).toBeNull();
    });

    it('omits secondary when the angle between targets is below cornerMinAngleDeg', () => {
      // Custom cornerMinAngleDeg = 60°. Two walls at a 30° angle don't
      // qualify as a corner pair (the geometry might just be a slight
      // angle change in the perimeter, not a real corner).
      const horizontalWall = wallTarget({ x: -1000, y: 2200 }, { x: 5000, y: 2200 });
      // A target at ~30° from horizontal: dx=1000, dy ≈ 577 (tan 30°).
      // To pass the parallelism check the polygon's edge must be parallel
      // to the target -- so this target is for a polygon edge that lives
      // along the same axis. We construct a polygon with an oblique edge.
      const obliquePoly: Point2[] = [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 2000 },
        { x: 3000, y: 2000 + 577 }, // edge from (3000, 2577) to (4000, 2000) ≈ -30° from horizontal
        { x: 0, y: 2000 },
      ];
      const obliqueWall = wallTarget(
        { x: 3000, y: 2200 + 577 },
        { x: 4000, y: 2200 },
      );
      const result = resolveMoveSnap({
        originalPolygon: obliquePoly,
        naturalDeltaMm: { x: 0, y: 150 },
        lineTargets: [horizontalWall, obliqueWall],
        cornerMinAngleDeg: 60,
      });
      expect(result).not.toBeNull();
      if (!result) return;
      // Only one snap should win; the perpendicular partner is rejected
      // because the angle between the targets (~30°) is below 60°.
      expect(result.secondary ?? null).toBeNull();
    });

    it('does NOT pick the same polygon edge for primary and secondary (corner requires two distinct edges)', () => {
      // Two vertical walls at slightly different x positions; with
      // cornerMinAngleDeg lowered to 0° they would PASS the parallelism
      // gate (cross product = 0 ≥ sin(0) = 0). The excludeEdgeIndex guard
      // prevents both snaps landing on the same polygon edge regardless.
      // (Realistic users won't pass cornerMinAngleDeg=0, but this pins
      // the secondary-edge-distinctness contract.)
      const wallA = wallTarget({ x: 4150, y: -1000 }, { x: 4150, y: 3000 });
      const wallB = wallTarget({ x: 4170, y: -1000 }, { x: 4170, y: 3000 });
      const result = resolveMoveSnap({
        originalPolygon: RECT,
        naturalDeltaMm: { x: 200, y: 0 },
        lineTargets: [wallA, wallB],
        cornerMinAngleDeg: 0,
      });
      expect(result).not.toBeNull();
      if (!result) return;
      // If a secondary IS emitted, its edge index must differ from the primary's.
      if (result.secondary) {
        expect(result.secondary.edgeIndex).not.toBe(result.edgeIndex);
      }
    });
  });
});
