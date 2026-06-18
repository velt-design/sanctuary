import { describe, expect, it } from "vitest";
import type {
  AxisAlignedRectangle,
  HouseComposition,
} from "./types";
import { validateHouseComposition } from "./validateHouseComposition";

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

describe("validateHouseComposition (PR-COMP1)", () => {
  it("accepts a single-rectangle composition with no joins", () => {
    const composition: HouseComposition = {
      primitives: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
      joins: [],
    };
    expect(validateHouseComposition(composition)).toEqual({ ok: true });
  });

  it("rejects empty compositions", () => {
    expect(validateHouseComposition({ primitives: [], joins: [] })).toEqual({
      ok: false,
      error: { code: "empty_composition" },
    });
  });

  it("rejects non-positive rectangles", () => {
    const zeroWidth: HouseComposition = {
      primitives: [rect({ x: 0, y: 0, w: 0, d: 4000 })],
      joins: [],
    };
    expect(validateHouseComposition(zeroWidth)).toEqual({
      ok: false,
      error: { code: "non_positive_rectangle", primitiveIndex: 0 },
    });

    const negativeDepth: HouseComposition = {
      primitives: [rect({ x: 0, y: 0, w: 6000, d: -100 })],
      joins: [],
    };
    expect(validateHouseComposition(negativeDepth)).toEqual({
      ok: false,
      error: { code: "non_positive_rectangle", primitiveIndex: 0 },
    });
  });

  it("rejects unsupported primitive kinds", () => {
    const composition: HouseComposition = {
      primitives: [
        rect({ x: 0, y: 0, w: 6000, d: 4000 }),
        { kind: "unknown", reserved: true },
      ],
      joins: [],
    };
    expect(validateHouseComposition(composition)).toEqual({
      ok: false,
      error: {
        code: "unsupported_primitive_kind",
        primitiveIndex: 1,
        kind: "unknown",
      },
    });
  });

  describe("two-rectangle L composition (Graham–Oratia shape)", () => {
    // Main: 12.5m × 8m at origin (0, 0); extension: 5.8m × 2.4m
    // hanging south so its NORTH edge runs along y=0 from x=0 to x=5814.
    // The main's SOUTH edge runs along y=0 from x=0 to x=12500.
    // Extension's north edge is fully contained within main's south edge.
    const main = rect({ x: 0, y: 0, w: 12500, d: 8000 });
    const extension = rect({ x: 0, y: -2400, w: 5814, d: 2400 });
    const lComposition: HouseComposition = {
      primitives: [main, extension],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "south",
          toPrimitiveIndex: 1,
          toEdge: "north",
        },
      ],
    };

    it("accepts the join", () => {
      expect(validateHouseComposition(lComposition)).toEqual({ ok: true });
    });

    it("rejects same-axis edges (south↔south)", () => {
      const bad: HouseComposition = {
        ...lComposition,
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "south",
            toPrimitiveIndex: 1,
            toEdge: "south",
          },
        ],
      };
      expect(validateHouseComposition(bad)).toMatchObject({
        ok: false,
        error: { code: "join_edges_same_axis" },
      });
    });

    it("rejects perpendicular edges (south↔east)", () => {
      const bad: HouseComposition = {
        ...lComposition,
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "south",
            toPrimitiveIndex: 1,
            toEdge: "east",
          },
        ],
      };
      expect(validateHouseComposition(bad)).toMatchObject({
        ok: false,
        error: { code: "join_edges_same_axis" },
      });
    });

    it("rejects joins where the named edges do not overlap (snap gap)", () => {
      // Extension placed with a 100mm gap south of the main block.
      const gappedExtension = rect({ x: 0, y: -2500, w: 5814, d: 2400 });
      const bad: HouseComposition = {
        primitives: [main, gappedExtension],
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "south",
            toPrimitiveIndex: 1,
            toEdge: "north",
          },
        ],
      };
      expect(validateHouseComposition(bad)).toMatchObject({
        ok: false,
        error: { code: "join_edges_do_not_overlap" },
      });
    });

    it("rejects joins referencing invalid primitive indexes", () => {
      const bad: HouseComposition = {
        ...lComposition,
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "south",
            toPrimitiveIndex: 5,
            toEdge: "north",
          },
        ],
      };
      expect(validateHouseComposition(bad)).toMatchObject({
        ok: false,
        error: { code: "invalid_join_index", joinIndex: 0, referenced: 5 },
      });
    });
  });

  describe("interior overlap", () => {
    it("rejects two rectangles whose interiors overlap", () => {
      const a = rect({ x: 0, y: 0, w: 6000, d: 4000 });
      // Overlaps the right half of `a`.
      const b = rect({ x: 3000, y: 0, w: 6000, d: 4000 });
      expect(
        validateHouseComposition({ primitives: [a, b], joins: [] }),
      ).toMatchObject({
        ok: false,
        error: { code: "primitive_interiors_overlap", primitiveIndexA: 0, primitiveIndexB: 1 },
      });
    });

    it("accepts two rectangles that touch on a shared edge (no interior overlap)", () => {
      // Side-by-side, sharing the right edge of `a` with the left
      // edge of `b`.
      const a = rect({ x: 0, y: 0, w: 6000, d: 4000 });
      const b = rect({ x: 6000, y: 0, w: 5000, d: 4000 });
      expect(
        validateHouseComposition({
          primitives: [a, b],
          joins: [
            {
              fromPrimitiveIndex: 0,
              fromEdge: "east",
              toPrimitiveIndex: 1,
              toEdge: "west",
            },
          ],
        }),
      ).toEqual({ ok: true });
    });
  });
});
