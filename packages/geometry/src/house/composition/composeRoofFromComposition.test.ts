import { describe, expect, it } from "vitest";
import type {
  AxisAlignedRectangle,
  HouseComposition,
  RectangleRoofIntent,
} from "./types";
import { composeRoofFromComposition } from "./composeRoofFromComposition";

const HIPPED_X: RectangleRoofIntent = {
  form: "hipped",
  pitchDeg: 25,
  ridgeAxis: "x",
  startCap: "hipped",
  endCap: "hipped",
};

function rect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
  intent?: RectangleRoofIntent;
}): AxisAlignedRectangle {
  return {
    kind: "axisAlignedRectangle",
    originXMm: input.x,
    originYMm: input.y,
    widthMm: input.w,
    depthMm: input.d,
    roofIntent: input.intent ?? HIPPED_X,
  };
}

describe("composeRoofFromComposition (PR-COMP1)", () => {
  describe("single-rectangle composition", () => {
    it("produces a single hipped roof with 4 planes for a 6×4 hipped rectangle", () => {
      const composition: HouseComposition = {
        primitives: [rect({ x: 0, y: 0, w: 6000, d: 4000 })],
        joins: [],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      // Hipped rectangle = 2 trapezoidal main slopes + 2 hip triangles = 4 planes
      expect(result.roofPlanes).toHaveLength(4);
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_per_rectangle_stitched",
      );
    });

    it("produces a flat roof (1 plane) for a flat intent", () => {
      const composition: HouseComposition = {
        primitives: [
          rect({
            x: 0,
            y: 0,
            w: 6000,
            d: 4000,
            intent: { form: "flat" },
          }),
        ],
        joins: [],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      expect(result.roofPlanes).toHaveLength(1);
    });

    it("produces a mono roof (1 plane) with the requested fall direction", () => {
      const composition: HouseComposition = {
        primitives: [
          rect({
            x: 0,
            y: 0,
            w: 6000,
            d: 4000,
            intent: {
              form: "mono",
              pitchDeg: 15,
              fallDirection: "negative_y",
            },
          }),
        ],
        joins: [],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      expect(result.roofPlanes).toHaveLength(1);
      expect(result.roofPlanes[0]?.metadata?.roofPrimaryFallDirection).toBe(
        "negative_y",
      );
    });

    it("honours per-end Dutch-hip toggles (one end hipped, one open)", () => {
      const composition: HouseComposition = {
        primitives: [
          rect({
            x: 0,
            y: 0,
            w: 8000,
            d: 4000,
            intent: {
              form: "hipped",
              pitchDeg: 25,
              ridgeAxis: "x",
              startCap: "hipped",
              endCap: "open_gable",
            },
          }),
        ],
        joins: [],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      // 2 main slopes + 1 hip triangle (only the start end) = 3 planes
      expect(result.roofPlanes).toHaveLength(3);
    });
  });

  describe("fused-rectangle shortcut", () => {
    it("merges two identical-intent rectangles into one hipped roof on the union dimensions", () => {
      // Two 6×4 rectangles snapped on a long edge → 12×4 union.
      const left = rect({ x: 0, y: 0, w: 6000, d: 4000 });
      const right = rect({ x: 6000, y: 0, w: 6000, d: 4000 });
      const composition: HouseComposition = {
        primitives: [left, right],
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "east",
            toPrimitiveIndex: 1,
            toEdge: "west",
          },
        ],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      // Single hipped roof on 12×4 = 4 planes (not 8 from per-rectangle stitching)
      expect(result.roofPlanes).toHaveLength(4);
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_fused_rectangle",
      );
      // No approximation flag — this is the clean case.
      expect(result.metadata.approximationReasons).toBeUndefined();
    });

    it("falls back to stitched solve when intents differ even if union is a rectangle", () => {
      const left = rect({
        x: 0,
        y: 0,
        w: 6000,
        d: 4000,
        intent: {
          form: "hipped",
          pitchDeg: 25,
          ridgeAxis: "x",
          startCap: "hipped",
          endCap: "hipped",
        },
      });
      const right = rect({
        x: 6000,
        y: 0,
        w: 6000,
        d: 4000,
        intent: {
          form: "hipped",
          pitchDeg: 30, // different pitch
          ridgeAxis: "x",
          startCap: "hipped",
          endCap: "hipped",
        },
      });
      const composition: HouseComposition = {
        primitives: [left, right],
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "east",
            toPrimitiveIndex: 1,
            toEdge: "west",
          },
        ],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      // Two independent hipped roofs = 8 planes
      expect(result.roofPlanes).toHaveLength(8);
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_per_rectangle_stitched",
      );
      expect(result.metadata.approximationReasons).toBe(
        "composition_stitched_render",
      );
    });
  });

  describe("L-shape unified solve (Graham–Oratia)", () => {
    it("produces one unified hipped roof with a facet per outer edge for an L composition", () => {
      // Main 12500 × 8000 at (0, 0); extension 5814 × 2400 at (0, -2400).
      // Union polygon has 6 outer edges → 6 facets in the unified topology.
      const main = rect({ x: 0, y: 0, w: 12500, d: 8000 });
      const extension = rect({ x: 0, y: -2400, w: 5814, d: 2400 });
      const composition: HouseComposition = {
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
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      expect(result.roofPlanes).toHaveLength(6);
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_joined_wavefront",
      );
      expect(result.metadata.roofGeometry).toBe("composition_unified");
      expect(result.metadata.approximationReasons).toBeUndefined();
      expect(result.metadata.compositionPrimitiveCount).toBe(2);
      // Reflex corner at the L's inside angle produces a valley.
      const valleys = result.roofFeatures.filter((f) => f.kind === "valley");
      expect(valleys.length).toBeGreaterThanOrEqual(1);
      // All plane ids are unique.
      const ids = result.roofPlanes.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("produces a unified hipped roof for a T composition", () => {
      // Trunk 12000 × 6000 at (0, 0). Crossbar 6000 × 4000 centered on the
      // trunk's north edge → 8-edge perimeter (T-shape).
      const trunk = rect({ x: 0, y: 0, w: 12000, d: 6000 });
      const crossbar = rect({ x: 3000, y: 6000, w: 6000, d: 4000 });
      const composition: HouseComposition = {
        primitives: [trunk, crossbar],
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "north",
            toPrimitiveIndex: 1,
            toEdge: "south",
          },
        ],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_joined_wavefront",
      );
      expect(result.roofPlanes).toHaveLength(8);
      // Two reflex corners at the T → at least 2 valleys.
      const valleys = result.roofFeatures.filter((f) => f.kind === "valley");
      expect(valleys.length).toBeGreaterThanOrEqual(2);
    });

    it("produces a unified hipped roof for a U composition", () => {
      // U shape: two legs 4000 × 8000 with a 6000 × 4000 base spanning them.
      const leftLeg = rect({ x: 0, y: 4000, w: 4000, d: 8000 });
      const base = rect({ x: 0, y: 0, w: 14000, d: 4000 });
      const rightLeg = rect({ x: 10000, y: 4000, w: 4000, d: 8000 });
      const composition: HouseComposition = {
        primitives: [base, leftLeg, rightLeg],
        joins: [
          {
            fromPrimitiveIndex: 0,
            fromEdge: "north",
            toPrimitiveIndex: 1,
            toEdge: "south",
          },
          {
            fromPrimitiveIndex: 0,
            fromEdge: "north",
            toPrimitiveIndex: 2,
            toEdge: "south",
          },
        ],
      };
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_joined_wavefront",
      );
      // U has 8 outer edges → 8 facets.
      expect(result.roofPlanes).toHaveLength(8);
      const valleys = result.roofFeatures.filter((f) => f.kind === "valley");
      expect(valleys.length).toBeGreaterThanOrEqual(2);
    });

    it("supports mixed roof types per rectangle (main hipped + extension skillion)", () => {
      const main = rect({ x: 0, y: 0, w: 12500, d: 8000 });
      const extension = rect({
        x: 0,
        y: -2400,
        w: 5814,
        d: 2400,
        intent: {
          form: "mono",
          pitchDeg: 10,
          fallDirection: "negative_y",
        },
      });
      const composition: HouseComposition = {
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
      const result = composeRoofFromComposition({
        composition,
        eaveHeightMm: 2400,
      });
      // 4 hipped planes (main) + 1 mono plane (extension) = 5 planes
      expect(result.roofPlanes).toHaveLength(5);
    });
  });

  it("throws on empty composition", () => {
    expect(() =>
      composeRoofFromComposition({
        composition: { primitives: [], joins: [] },
        eaveHeightMm: 2400,
      }),
    ).toThrow(/empty composition/);
  });

  it("throws on unsupported primitive kind", () => {
    expect(() =>
      composeRoofFromComposition({
        composition: {
          primitives: [{ kind: "unknown", reserved: true }],
          joins: [],
        },
        eaveHeightMm: 2400,
      }),
    ).toThrow(/unsupported primitive kind/);
  });
});
