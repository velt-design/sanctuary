import { describe, expect, it } from "vitest";
import { computeOrthogonalStraightSkeleton } from "./solve";
import { classifyVertex } from "./bisector";
import type { OrthogonalPolygon, StraightSkeleton } from "./types";

/**
 * PR-SS-2 part 2 (2026-06-19): split-event spec.
 *
 * Part 1 handled edge-collapse only (convex polygons → rectangles).
 * Part 2 adds split events so reflex vertices (L / T / U / + shapes)
 * solve. The tests below are the TDD spec; they were written before
 * the implementation.
 *
 * Two classes of assertion:
 *   - EXACT node positions/times for the cases I hand-traced and am
 *     confident about (square, rectangles, asymmetric L).
 *   - STRUCTURAL invariants for the degenerate / many-reflex shapes
 *     (symmetric-L canary, T, U, +): the solver succeeds, every
 *     polygon edge (eave) is represented in the skeleton, and the
 *     reflex count is reflected by interior structure. These are the
 *     properties the roof translator (PR-SS-3) actually consumes;
 *     pinning exact node folding in a 4-way coincidence would be
 *     over-fitting the implementation.
 */

function interiorNodeKeys(skeleton: StraightSkeleton): Set<string> {
  return new Set(
    skeleton.nodes
      .filter((n) => n.time > 0)
      .map((n) => `${n.position.x},${n.position.y}@${n.time}`),
  );
}

/** Every polygon edge id must appear as the left or right eave of at
 * least one skeleton edge — i.e. the skeleton "covers" every eave.
 * This is the topology bridge: facet count == covered eave count. */
function coveredPolygonEdgeIds(skeleton: StraightSkeleton): Set<number> {
  const ids = new Set<number>();
  for (const e of skeleton.edges) {
    ids.add(e.leftPolygonEdgeId);
    ids.add(e.rightPolygonEdgeId);
  }
  return ids;
}

function reflexCount(polygon: OrthogonalPolygon): number {
  let count = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    if (classifyVertex(polygon, i) === "reflex") count += 1;
  }
  return count;
}

function allNodePositionsAreIntegers(skeleton: StraightSkeleton): boolean {
  return skeleton.nodes.every(
    (n) => Number.isInteger(n.position.x) && Number.isInteger(n.position.y),
  );
}

describe("computeOrthogonalStraightSkeleton — square", () => {
  it("produces a single central convergence node for a 10x10 square", () => {
    const square: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = computeOrthogonalStraightSkeleton(square);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
    const { skeleton } = result;
    const interiorNodes = skeleton.nodes.filter((n) => n.time > 0);
    expect(interiorNodes.length).toBeGreaterThanOrEqual(1);
    for (const node of interiorNodes) {
      expect(node.position).toEqual({ x: 5, y: 5 });
      expect(node.time).toBe(5);
    }
  });
});

describe("computeOrthogonalStraightSkeleton — rectangle (non-square)", () => {
  it("produces a complete horizontal ridge for a 10x6 wide rectangle", () => {
    const rect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ];
    const result = computeOrthogonalStraightSkeleton(rect);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
    const keys = interiorNodeKeys(result.skeleton);
    // Short (vertical) edges collapse at t=3 → ridge ends (3,3),(7,3).
    // They form simultaneously and are joined directly by the final
    // ridge edge (no travelling midpoint node — that only appears when
    // the ends form at different times, as in composites).
    expect(keys.has("3,3@3")).toBe(true);
    expect(keys.has("7,3@3")).toBe(true);
    // All four eaves represented, and a ridge edge connects the ends.
    expect(coveredPolygonEdgeIds(result.skeleton)).toEqual(new Set([0, 1, 2, 3]));
    const ridge = result.skeleton.edges.find((e) => {
      const a = result.skeleton.nodes[e.fromNodeIndex]!;
      const b = result.skeleton.nodes[e.toNodeIndex]!;
      return a.time === 3 && b.time === 3;
    });
    expect(ridge, "ridge edge between the two ridge ends").toBeDefined();
  });

  it("produces a complete vertical ridge for a 6x10 tall rectangle", () => {
    const rect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = computeOrthogonalStraightSkeleton(rect);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
    const keys = interiorNodeKeys(result.skeleton);
    expect(keys.has("3,3@3")).toBe(true);
    expect(keys.has("3,7@3")).toBe(true);
    expect(coveredPolygonEdgeIds(result.skeleton)).toEqual(new Set([0, 1, 2, 3]));
  });

  it("keeps node positions integral for an odd-dimension rectangle (rounding contract)", () => {
    // 10x5: the short edges collapse at t=2.5 at x=2.5/7.5 — half-mm
    // coordinates. The 2x internal solve keeps the math exact; output
    // rounds to the nearest integer millimetre. The contract under
    // test is "output is always integer", not the specific rounding.
    const rect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];
    const result = computeOrthogonalStraightSkeleton(rect);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
    expect(allNodePositionsAreIntegers(result.skeleton)).toBe(true);
  });
});

describe("computeOrthogonalStraightSkeleton — split events (L / T / U / +)", () => {
  // Symmetric L canary: a 10x10 square minus its top-right 5x5 quad.
  // At t=2.5 (1x) three things coincide simultaneously: edge e1 and
  // edge e4 collapse AND the reflex vertex's SW trajectory lands
  // exactly on convex vertex v0. This is the bookkeeping torture test.
  const SYMMETRIC_L: OrthogonalPolygon = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 5, y: 5 }, // reflex
    { x: 5, y: 10 },
    { x: 0, y: 10 },
  ];

  // Asymmetric L: events fall at distinct times, so the reflex vertex
  // splits a clean edge interior (no vertex coincidence).
  const ASYMMETRIC_L: OrthogonalPolygon = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 12 },
    { x: 18, y: 12 }, // reflex
    { x: 18, y: 20 },
    { x: 0, y: 20 },
  ];

  // T: bottom bar 40x14 + off-centre stem (x∈[14,24]). 2 reflex, 8
  // edges. Deliberately asymmetric so events fall at distinct times —
  // realistic for designer composites (see SYMMETRIC_T_LIMITATION).
  const T_SHAPE: OrthogonalPolygon = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 14 },
    { x: 24, y: 14 }, // reflex
    { x: 24, y: 30 },
    { x: 14, y: 30 },
    { x: 14, y: 14 }, // reflex
    { x: 0, y: 14 },
  ];

  // U: 40x24 with an off-centre notch (x∈[12,26]) down to y=10.
  const U_SHAPE: OrthogonalPolygon = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 24 },
    { x: 26, y: 24 },
    { x: 26, y: 10 }, // reflex
    { x: 12, y: 10 }, // reflex
    { x: 12, y: 24 },
    { x: 0, y: 24 },
  ];

  // Plus / cross with arms of different lengths. 4 reflex, 12 edges.
  const PLUS_SHAPE: OrthogonalPolygon = [
    { x: 16, y: 0 },
    { x: 28, y: 0 },
    { x: 28, y: 10 }, // reflex
    { x: 44, y: 10 },
    { x: 44, y: 20 },
    { x: 28, y: 20 }, // reflex
    { x: 28, y: 40 },
    { x: 16, y: 40 },
    { x: 16, y: 20 }, // reflex
    { x: 0, y: 20 },
    { x: 0, y: 10 },
    { x: 16, y: 10 }, // reflex
  ];

  // A perfectly symmetric T: the bar (height 10) makes the whole bar
  // ridge collapse in one instant while both valleys arrive at the
  // same point. Documented part-2 limitation — must degrade to a
  // typed error, never wrong geometry.
  const SYMMETRIC_T_LIMITATION: OrthogonalPolygon = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 },
    { x: 20, y: 10 }, // reflex
    { x: 20, y: 20 },
    { x: 10, y: 20 },
    { x: 10, y: 10 }, // reflex
    { x: 0, y: 10 },
  ];

  it("no longer returns unsupported_topology for the symmetric L canary", () => {
    const result = computeOrthogonalStraightSkeleton(SYMMETRIC_L);
    expect(result.ok).toBe(true);
  });

  it("symmetric L: covers all 6 eaves and emits a valley from the reflex corner", () => {
    const result = computeOrthogonalStraightSkeleton(SYMMETRIC_L);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const { skeleton } = result;
    expect(coveredPolygonEdgeIds(skeleton)).toEqual(
      new Set([0, 1, 2, 3, 4, 5]),
    );
    expect(allNodePositionsAreIntegers(skeleton)).toBe(true);
    // The hand-derived skeleton has its 3-way junction at (3,3) — the
    // reflex valley terminus and the ridge convergence (2.5,2.5 → 3,3
    // after rounding). Assert an interior node exists there.
    const keys = interiorNodeKeys(skeleton);
    expect([...keys].some((k) => k.startsWith("3,3@"))).toBe(true);
  });

  it("asymmetric L: clean interior split, all 6 eaves covered", () => {
    const result = computeOrthogonalStraightSkeleton(ASYMMETRIC_L);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const { skeleton } = result;
    expect(coveredPolygonEdgeIds(skeleton)).toEqual(
      new Set([0, 1, 2, 3, 4, 5]),
    );
    expect(allNodePositionsAreIntegers(skeleton)).toBe(true);
    // The reflex at (18,12) splits the bottom eave at (12,6) (=24,12
    // in 2x → 12,6 in 1x). Assert the split node exists.
    const keys = interiorNodeKeys(skeleton);
    expect([...keys].some((k) => k.startsWith("12,6@"))).toBe(true);
  });

  it("T / U / + : every eave covered, solver succeeds", () => {
    for (const polygon of [T_SHAPE, U_SHAPE, PLUS_SHAPE]) {
      const result = computeOrthogonalStraightSkeleton(polygon);
      expect(result.ok, JSON.stringify(polygon)).toBe(true);
      if (!result.ok) continue;
      const covered = coveredPolygonEdgeIds(result.skeleton);
      const expected = new Set(polygon.map((_, i) => i));
      expect(covered, `coverage for ${polygon.length}-gon`).toEqual(expected);
      expect(allNodePositionsAreIntegers(result.skeleton)).toBe(true);
      // Sanity: at least `reflexCount` interior nodes (one valley
      // terminus per reflex vertex, plus ridge nodes).
      const interior = result.skeleton.nodes.filter((n) => n.time > 0);
      expect(interior.length).toBeGreaterThanOrEqual(reflexCount(polygon));
    }
  });

  it("degrades gracefully (typed error, not wrong geometry) on the symmetric-T limitation", () => {
    // Documented part-2 limitation: an N-way simultaneous ridge-line
    // collapse is not yet solved. The contract is that it returns a
    // typed unsupported_topology error so the orchestrator can fall
    // back — NOT that it silently produces a wrong skeleton. When a
    // follow-up closes the gap, flip this to expect ok:true.
    const result = computeOrthogonalStraightSkeleton(SYMMETRIC_T_LIMITATION);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_topology");
  });
});

describe("computeOrthogonalStraightSkeleton — input validation passthrough", () => {
  it("rejects a non-orthogonal polygon", () => {
    const skew: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 1 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = computeOrthogonalStraightSkeleton(skew);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_polygon");
  });
});
