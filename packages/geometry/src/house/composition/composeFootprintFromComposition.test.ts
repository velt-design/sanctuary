import { describe, expect, it } from "vitest";
import type {
  AxisAlignedRectangle,
  HouseComposition,
} from "./types";
import { composeFootprintFromComposition } from "./composeFootprintFromComposition";

function rect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
}): AxisAlignedRectangle {
  return {
    kind: "axisAlignedRectangle",
    originXMm: input.x,
    originYMm: input.y,
    widthMm: input.w,
    depthMm: input.d,
  };
}

describe("composeFootprintFromComposition (PR-COMP1)", () => {
  it("returns the 4 corners of a single rectangle (CCW)", () => {
    const composition: HouseComposition = {
      primitives: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      joins: [],
    };
    const polygon = composeFootprintFromComposition(composition);
    expect(polygon).toHaveLength(4);
    // CCW from south-west: (0,0) → (6000,0) → (6000,4000) → (0,4000)
    const coords = polygon.map((p) => [p.x, p.y]);
    expect(coords).toEqual(
      expect.arrayContaining([
        [0, 0],
        [6000, 0],
        [6000, 4000],
        [0, 4000],
      ]),
    );
  });

  it("merges two rectangles snapped on a long edge into a single 4-corner rectangle", () => {
    // Two 6000 × 4000 rectangles side by side → 12000 × 4000 fused.
    const left = rect({ x: 0, y: 0, w: 6000, d: 4000 });
    const right = rect({ x: 6000, y: 0, w: 6000, d: 4000 });
    const polygon = composeFootprintFromComposition({
      primitives: [left, right],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "east",
          toPrimitiveIndex: 1,
          toEdge: "west",
        },
      ],
    });
    expect(polygon).toHaveLength(4);
    const coords = polygon.map((p) => [p.x, p.y]).sort();
    expect(coords).toEqual([
      [0, 0],
      [0, 4000],
      [12000, 0],
      [12000, 4000],
    ]);
  });

  it("produces a 6-vertex L for the Graham–Oratia v1 footprint", () => {
    // Main: 12500 × 8000 at (0, 0). Extension: 5814 × 2400 at (0, -2400).
    // Expected union: 6-vertex L with the south extension on the SW side.
    const main = rect({ x: 0, y: 0, w: 12500, d: 8000 });
    const extension = rect({ x: 0, y: -2400, w: 5814, d: 2400 });
    const polygon = composeFootprintFromComposition({
      primitives: [main, extension],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "south",
          toPrimitiveIndex: 1,
          toEdge: "north",
        },
      ],
    });
    expect(polygon).toHaveLength(6);
    const coords = polygon.map((p) => [p.x, p.y]).sort((a, b) =>
      a[0]! - b[0]! || a[1]! - b[1]!,
    );
    expect(coords).toEqual([
      [0, -2400],
      [0, 8000],
      [5814, -2400],
      [5814, 0],
      [12500, 0],
      [12500, 8000],
    ]);
  });

  it("produces an 8-vertex T for a three-rectangle composition", () => {
    // Bar: 9000 × 2000 at (0, 0).
    // Stem: 3000 × 3000 at (3000, 2000) snapped on top of the bar.
    // Together: T-shape with 8 corners.
    const bar = rect({ x: 0, y: 0, w: 9000, d: 2000 });
    const stem = rect({ x: 3000, y: 2000, w: 3000, d: 3000 });
    const polygon = composeFootprintFromComposition({
      primitives: [bar, stem],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "north",
          toPrimitiveIndex: 1,
          toEdge: "south",
        },
      ],
    });
    expect(polygon).toHaveLength(8);
    const coords = polygon.map((p) => [p.x, p.y]).sort((a, b) =>
      a[0]! - b[0]! || a[1]! - b[1]!,
    );
    expect(coords).toEqual([
      [0, 0],
      [0, 2000],
      [3000, 2000],
      [3000, 5000],
      [6000, 2000],
      [6000, 5000],
      [9000, 0],
      [9000, 2000],
    ]);
  });

  it("throws when the composition is empty", () => {
    expect(() =>
      composeFootprintFromComposition({ primitives: [], joins: [] }),
    ).toThrow(/empty composition/);
  });

  it("throws when a primitive isn't a rectangle (v1 limit)", () => {
    const composition: HouseComposition = {
      primitives: [{ kind: "unknown", reserved: true }],
      joins: [],
    };
    expect(() => composeFootprintFromComposition(composition)).toThrow(
      /unsupported primitive kind/,
    );
  });
});
