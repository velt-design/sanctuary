import { describe, expect, it } from "vitest";
import { computeOrthogonalStraightSkeletonOffset as solveOffset } from "./offsetSolve";
import type { OrthogonalPolygon, StraightSkeleton } from "./types";

/**
 * PR-SS-2 part 3 (2026-06-20): spec for the equidistance/offset-line
 * solver (`offsetSolve.ts`) — the convergence rewrite.
 *
 * The offset model tracks the wavefront as moving EDGES and derives each
 * node as the exact intersection of two edge lines — no kinematic vertex
 * velocities, so the ridge-slide ambiguity that blocked the kinematic
 * solver at convergences (+/H) disappears. Event types: edge collapse,
 * ridge collapse (parallel opposite-normal pair meeting), and split
 * (reflex hits an eave). Tie-break SPLIT < COLLAPSE < RIDGE.
 *
 * STATUS: every rectilinear shape now produces a COMPLETE, full-eave-
 * coverage, integer-output skeleton — including +, H, and the symmetric
 * canaries the kinematic solver could not. Roof-level area-conservation
 * (facets partition the footprint, verified through the translator) holds
 * for square / rect / L / symmetric-T / U. Asymmetric T / + / H still
 * have one open piece — the reflex-meet junction must ride down to
 * connect to the main ridge (a collinear "straight vertex" continuation);
 * until that lands their facets overlap, so the solver stays UNWIRED
 * (the kinematic `solve.ts` remains the translator's solver).
 */

function coveredEdgeIds(s: StraightSkeleton): Set<number> {
  const ids = new Set<number>();
  for (const e of s.edges) {
    ids.add(e.leftPolygonEdgeId);
    ids.add(e.rightPolygonEdgeId);
  }
  return ids;
}

const SHAPES: Record<string, OrthogonalPolygon> = {
  square: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  rect10x6: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }],
  rect10x5: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }],
  Lsymmetric: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 10 }],
  Lasymmetric: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 12 }, { x: 18, y: 12 }, { x: 18, y: 20 }, { x: 0, y: 20 }],
  Tsymmetric: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  U: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 10 }, { x: 12, y: 10 }, { x: 12, y: 24 }, { x: 0, y: 24 }],
  Tasymmetric: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 14 }, { x: 24, y: 14 }, { x: 24, y: 30 }, { x: 14, y: 30 }, { x: 14, y: 14 }, { x: 0, y: 14 }],
  plus: [{ x: 16, y: 0 }, { x: 28, y: 0 }, { x: 28, y: 10 }, { x: 44, y: 10 }, { x: 44, y: 20 }, { x: 28, y: 20 }, { x: 28, y: 40 }, { x: 16, y: 40 }, { x: 16, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 10 }, { x: 16, y: 10 }],
  H: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 44 }, { x: 30, y: 44 }, { x: 30, y: 26 }, { x: 10, y: 26 }, { x: 10, y: 44 }, { x: 0, y: 44 }],
};

describe("offsetSolve — complete skeleton (full coverage, integer output) for every shape", () => {
  for (const [name, polygon] of Object.entries(SHAPES)) {
    it(`${name}: solves with every eave covered and integer node positions`, () => {
      const r = solveOffset(polygon);
      expect(r.ok, JSON.stringify((r as { error?: unknown }).error)).toBe(true);
      if (!r.ok) return;
      expect(coveredEdgeIds(r.skeleton)).toEqual(new Set(polygon.map((_, i) => i)));
      expect(
        r.skeleton.nodes.every((nd) => Number.isInteger(nd.position.x) && Number.isInteger(nd.position.y)),
      ).toBe(true);
      // No duplicate coincident nodes referenced by edges (the translator
      // keys adjacency by index; coincident indices would read as a gap).
      const referenced = new Set<number>();
      for (const e of r.skeleton.edges) {
        referenced.add(e.fromNodeIndex);
        referenced.add(e.toNodeIndex);
      }
      const positions = new Map<string, number>();
      for (const idx of referenced) {
        const p = r.skeleton.nodes[idx]!.position;
        const key = `${p.x},${p.y}`;
        const prev = positions.get(key);
        expect(prev === undefined || prev === idx, `duplicate node at ${key}`).toBe(true);
        positions.set(key, idx);
      }
    });
  }
});

describe("offsetSolve — validation passthrough", () => {
  it("rejects a non-orthogonal polygon", () => {
    const r = solveOffset([
      { x: 0, y: 0 },
      { x: 10, y: 1 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("invalid_polygon");
  });
});
