import { describe, expect, it } from 'vitest';
import type { Polygon3 } from '../contracts';
import { buildJoinedRectilinearHippedRoof } from './roofJoinedHipped';

/**
 * Session B of milestone 13: joined-hipped roofs honour the
 * `stationaryEdgeIndexes` parameter to produce Dutch-hip / open-gable
 * topology. The wavefront naturally handles zero-inward-normal edges --
 * setting that on a terminal-end edge causes adjacent facets to reach
 * the eave on the open side, exactly matching the rectangular Dutch-hip
 * the user expects.
 *
 * These tests focus on the joined / L-shape path (rectangle Dutch-hip is
 * tested in `roofRectangle.test.ts`).
 */

// L-shape footprint: long-east wing (8x3) joined to a short-north wing
// (2x2). Vertices walked CCW so signedArea > 0.
//
//      (0,5)----(2,5)
//       |        |
//       |        |
//       |        +----(8,3)
//       |             |
//       |             |
//      (0,0)--------(8,0)
//
// Edge indexes (matching buildJoinedRoofEdges' walk order):
//   0: bottom (0,0) -> (8,0)        -- south wing south face
//   1: right  (8,0) -> (8,3)        -- south wing east face (terminal end)
//   2: inner  (8,3) -> (2,3)        -- south wing north face inner
//   3: middle (2,3) -> (2,5)        -- north wing east face
//   4: top    (2,5) -> (0,5)        -- north wing north face (terminal end)
//   5: left   (0,5) -> (0,0)        -- west face
function lShapeFootprint(): Polygon3 {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 8000, y: 0, z: 0 },
    { x: 8000, y: 3000, z: 0 },
    { x: 2000, y: 3000, z: 0 },
    { x: 2000, y: 5000, z: 0 },
    { x: 0, y: 5000, z: 0 },
  ];
}

describe('buildJoinedRectilinearHippedRoof Dutch-hip support (milestone 13 session B)', () => {
  const baseInput = {
    eaveHeightMm: 2400,
    roofPitchDeg: 25,
  };

  it('legacy hipped output (no stationary edges) is unchanged when stationaryEdgeIndexes is omitted', () => {
    const legacy = buildJoinedRectilinearHippedRoof({
      eavePolygon: lShapeFootprint(),
      ...baseInput,
    });
    const explicitEmpty = buildJoinedRectilinearHippedRoof({
      eavePolygon: lShapeFootprint(),
      ...baseInput,
      stationaryEdgeIndexes: [],
    });
    expect(explicitEmpty.roofPlanes).toHaveLength(legacy.roofPlanes.length);
    expect(legacy.roofPlanes.length).toBeGreaterThan(0);
  });

  it('opens a terminal-end edge by removing its facet from the output', () => {
    // Open the east face of the south wing (edge index 1: (8,0)->(8,3)).
    // That face is perpendicular to the south wing's X-axis ridge, so
    // it's a terminal end; opening it should remove the hip facet that
    // covered it. Adjacent facets (south face + inner-north face) still
    // exist; their shape adjusts to reach the eave on the open side via
    // the wavefront's zero-velocity-edge handling.
    const open = buildJoinedRectilinearHippedRoof({
      eavePolygon: lShapeFootprint(),
      ...baseInput,
      stationaryEdgeIndexes: [1],
    });
    const closed = buildJoinedRectilinearHippedRoof({
      eavePolygon: lShapeFootprint(),
      ...baseInput,
    });
    // Open output has fewer facets than the fully-hipped baseline.
    expect(open.roofPlanes.length).toBeLessThan(closed.roofPlanes.length);
    // No facet in the open output is sourced from the stationary edge.
    // (sourceEdgeId metadata uses the edge's `id` field, not its index;
    // the joined builder ids edges as `house-eave-edge-${index + 1}`.)
    expect(
      open.roofPlanes.every(
        (plane) => plane.metadata?.sourceEdgeId !== 'house-eave-edge-2',
      ),
    ).toBe(true);
  });

  it('opening a non-terminal edge still produces valid roof topology (defensive case)', () => {
    // Edge 5 is the long west face -- opening it via the stationary
    // mechanism is unusual (a real user would only open terminal ends)
    // but the builder shouldn't crash. Verify the output is non-empty
    // and the stationary edge isn't sourcing any facet.
    const result = buildJoinedRectilinearHippedRoof({
      eavePolygon: lShapeFootprint(),
      ...baseInput,
      stationaryEdgeIndexes: [5],
    });
    expect(result.roofPlanes.length).toBeGreaterThan(0);
    expect(
      result.roofPlanes.every(
        (plane) => plane.metadata?.sourceEdgeId !== 'house-eave-edge-6',
      ),
    ).toBe(true);
  });

  it('stationary edges produce no roof features anchored to that edge', () => {
    const open = buildJoinedRectilinearHippedRoof({
      eavePolygon: lShapeFootprint(),
      ...baseInput,
      stationaryEdgeIndexes: [1],
    });
    // Hip features link facet boundaries; with the stationary edge's
    // facet gone, no hip feature should sit at the stationary edge's
    // midpoint (8000, 1500).
    const stationaryMidX = 8000;
    const stationaryMidY = 1500;
    const featureNearStationary = open.roofFeatures.find((feature) => {
      const midX = (feature.line.start.x + feature.line.end.x) / 2;
      const midY = (feature.line.start.y + feature.line.end.y) / 2;
      return Math.abs(midX - stationaryMidX) < 100 && Math.abs(midY - stationaryMidY) < 100;
    });
    expect(featureNearStationary).toBeUndefined();
  });
});
