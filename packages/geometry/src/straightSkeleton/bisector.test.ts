import { describe, expect, it } from "vitest";
import { classifyVertex, computeVertexMotion } from "./bisector";
import type { OrthogonalPolygon } from "./types";

const RECT_10x6: OrthogonalPolygon = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 6 },
  { x: 0, y: 6 },
];

// L-shape CCW: 5 convex + 1 reflex.
// Main rectangle (0..10) x (0..5) with NW extension (0..5) x (5..10).
const L_SHAPE: OrthogonalPolygon = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 5, y: 5 }, // reflex (inside corner)
  { x: 5, y: 10 },
  { x: 0, y: 10 },
];

describe("classifyVertex", () => {
  it("classifies all 4 rectangle corners as convex", () => {
    for (let i = 0; i < RECT_10x6.length; i += 1) {
      expect(classifyVertex(RECT_10x6, i), `vertex ${i}`).toBe("convex");
    }
  });

  it("classifies the L-shape's inside corner as reflex; the other 5 as convex", () => {
    expect(classifyVertex(L_SHAPE, 0)).toBe("convex");
    expect(classifyVertex(L_SHAPE, 1)).toBe("convex");
    expect(classifyVertex(L_SHAPE, 2)).toBe("convex");
    expect(classifyVertex(L_SHAPE, 3)).toBe("reflex");
    expect(classifyVertex(L_SHAPE, 4)).toBe("convex");
    expect(classifyVertex(L_SHAPE, 5)).toBe("convex");
  });
});

describe("computeVertexMotion — convex corners point inward (NE/NW/SW/SE diagonal)", () => {
  it("rectangle corner velocities point toward the interior", () => {
    const v0 = computeVertexMotion(RECT_10x6, 0); // (0,0) SW corner → NE
    expect(v0.classification).toBe("convex");
    expect(v0.velocity).toEqual({ x: 1, y: 1 });

    const v1 = computeVertexMotion(RECT_10x6, 1); // (10,0) SE corner → NW
    expect(v1.classification).toBe("convex");
    expect(v1.velocity).toEqual({ x: -1, y: 1 });

    const v2 = computeVertexMotion(RECT_10x6, 2); // (10,6) NE corner → SW
    expect(v2.classification).toBe("convex");
    expect(v2.velocity).toEqual({ x: -1, y: -1 });

    const v3 = computeVertexMotion(RECT_10x6, 3); // (0,6) NW corner → SE
    expect(v3.classification).toBe("convex");
    expect(v3.velocity).toEqual({ x: 1, y: -1 });
  });
});

describe("computeVertexMotion — reflex corner velocity matches both-edges-move-inward", () => {
  it("L-shape inside corner at (5,5) moves SW", () => {
    // The two edges adjacent to (5,5):
    //   (10,5)→(5,5) horizontal at y=5, interior below → moves south at speed 1
    //   (5,5)→(5,10) vertical at x=5, interior to the west → moves west at speed 1
    // Their intersection point moves to (5-t, 5-t) as t advances —
    // velocity (-1, -1). The reflex bisector must agree.
    const reflex = computeVertexMotion(L_SHAPE, 3);
    expect(reflex.classification).toBe("reflex");
    expect(reflex.velocity).toEqual({ x: -1, y: -1 });
  });

  it("L-shape's 5 convex corners point inward toward the L body", () => {
    // v0=(0,0) SW corner of L → NE
    expect(computeVertexMotion(L_SHAPE, 0).velocity).toEqual({ x: 1, y: 1 });
    // v1=(10,0) SE corner of L → NW
    expect(computeVertexMotion(L_SHAPE, 1).velocity).toEqual({ x: -1, y: 1 });
    // v2=(10,5) NE corner of L's main rect → SW
    expect(computeVertexMotion(L_SHAPE, 2).velocity).toEqual({ x: -1, y: -1 });
    // v4=(5,10) NE corner of L's extension → SW
    expect(computeVertexMotion(L_SHAPE, 4).velocity).toEqual({ x: -1, y: -1 });
    // v5=(0,10) NW corner of L → SE
    expect(computeVertexMotion(L_SHAPE, 5).velocity).toEqual({ x: 1, y: -1 });
  });
});
