import { describe, expect, it } from "vitest";
import { computeOrthogonalStraightSkeleton } from "./solve";
import type { OrthogonalPolygon } from "./types";

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
    // 4 polygon vertices + interior merge node(s). For a square all
    // 4 corners reach the center at the same time; exact node count
    // depends on whether simultaneous events fold into one node or
    // produce a degenerate chain. Either way: at least one interior
    // node at the center (5, 5).
    const interiorNodes = skeleton.nodes.filter((n) => n.time > 0);
    expect(interiorNodes.length).toBeGreaterThanOrEqual(1);
    // All interior nodes for a 10x10 square should sit at (5, 5)
    // at time 5.
    for (const node of interiorNodes) {
      expect(node.position).toEqual({ x: 5, y: 5 });
      expect(node.time).toBe(5);
    }
  });
});

describe("computeOrthogonalStraightSkeleton — rectangle (non-square)", () => {
  it("produces a horizontal ridge for a 10x6 wide rectangle", () => {
    const rect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ];
    const result = computeOrthogonalStraightSkeleton(rect);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
    const { skeleton } = result;
    // 4 polygon vertices (time 0) + interior nodes from the
    // collapses. The 2 short edges (left + right) collapse at
    // t=3 at positions (3, 3) and (7, 3). After both collapses
    // the wavefront has degenerated to a horizontal segment;
    // the final collapse happens at t=5 at (5, 3).
    const interiorNodes = skeleton.nodes.filter((n) => n.time > 0);
    const interiorPositions = new Set(
      interiorNodes.map((n) => `${n.position.x},${n.position.y}@${n.time}`),
    );
    expect(interiorPositions.has("3,3@3")).toBe(true);
    expect(interiorPositions.has("7,3@3")).toBe(true);
  });

  it("produces a vertical ridge for a 6x10 tall rectangle", () => {
    const rect: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = computeOrthogonalStraightSkeleton(rect);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
    const { skeleton } = result;
    const interiorNodes = skeleton.nodes.filter((n) => n.time > 0);
    const interiorPositions = new Set(
      interiorNodes.map((n) => `${n.position.x},${n.position.y}@${n.time}`),
    );
    expect(interiorPositions.has("3,3@3")).toBe(true);
    expect(interiorPositions.has("3,7@3")).toBe(true);
  });
});

describe("computeOrthogonalStraightSkeleton — split-event support (not yet implemented)", () => {
  it("returns an unsupported_topology error for an L-shape with a reflex vertex", () => {
    const lShape: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = computeOrthogonalStraightSkeleton(lShape);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_topology");
  });
});
