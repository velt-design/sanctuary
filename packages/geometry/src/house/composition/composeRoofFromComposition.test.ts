import { describe, expect, it } from "vitest";
import type {
  AxisAlignedRectangle,
  HouseComposition,
  RectangleRoofIntent,
} from "./types";
import { composeRoofFromComposition } from "./composeRoofFromComposition";
import { composeFootprintFromComposition } from "./composeFootprintFromComposition";
import { applyRoofQa } from "../roofQa";

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
      // PR-SS-4: single hipped rectangles route through the rectangular
      // builder (ridge-axis honoured), not the per-rectangle stitched path.
      expect(result.metadata.roofTopologySolver).toBe(
        "composition_single_rectangle",
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

    it("unifies all-hipped composites into one skeleton roof even when per-primitive intents differ (PR-SS-7)", () => {
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
      // PR-SS-7: per-primitive intent differences (here: pitch 25 vs 30)
      // are a v1 authoring artifact and must not force the broken
      // per-rectangle stitched fallback. All rectangles are hipped, so
      // the union (a 12m x 4m rectangle) resolves to ONE coherent
      // skeleton roof — 4 facets — at the first rectangle's pitch.
      expect(result.metadata.roofTopologySolver).toBe(
        "orthogonal_straight_skeleton",
      );
      expect(result.metadata.roofGeometry).toBe("composition_unified");
      expect(result.roofPlanes).toHaveLength(4);
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
        "orthogonal_straight_skeleton",
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
        "orthogonal_straight_skeleton",
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
        "orthogonal_straight_skeleton",
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

  // PR-SS-7 (2026-06-21): regression for the live Jess-Oratia H. Captured
  // from the workbench (proj_cf4afb59) via Save bug report. The 3-rect
  // dumbbell carries DRIFTED per-primitive intents from drag-resize +
  // joins (rect2.ridgeAxis 'x', rect0/1 startCap 'open_gable', pitch 5).
  // Before PR-SS-7 the differing intents skipped the unified skeleton and
  // fell to the per-rectangle stitched solve, which overlaps at the joins
  // and fails roof QA with `outside_eave_or_spans_void`. The composite is
  // all-hipped, so it must resolve to ONE coherent skeleton roof even
  // without a composite-intent override.
  describe("Jess-Oratia H — drifted per-primitive intents (PR-SS-7)", () => {
    const composition: HouseComposition = {
      primitives: [
        rect({
          x: 0,
          y: -9219,
          w: 6000,
          d: 16795,
          intent: { form: "hipped", pitchDeg: 5, ridgeAxis: "y", startCap: "open_gable", endCap: "hipped" },
        }),
        rect({
          x: 6000,
          y: -6471,
          w: 19366,
          d: 8368,
          intent: { form: "hipped", pitchDeg: 5, ridgeAxis: "y", startCap: "open_gable", endCap: "hipped" },
        }),
        rect({
          x: 25366,
          y: -12517,
          w: 9362,
          d: 21454,
          intent: { form: "hipped", pitchDeg: 5, ridgeAxis: "x", startCap: "hipped", endCap: "hipped" },
        }),
      ],
      joins: [
        { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
        { fromPrimitiveIndex: 1, fromEdge: "east", toPrimitiveIndex: 2, toEdge: "west" },
      ],
    };

    it("resolves to a unified skeleton roof WITHOUT a composite-intent override", () => {
      const result = composeRoofFromComposition({ composition, eaveHeightMm: 2400 });
      expect(result.metadata.roofTopologySolver).toBe("orthogonal_straight_skeleton");
      expect(result.metadata.roofGeometry).toBe("composition_unified");
      expect(result.roofPlanes.length).toBeGreaterThanOrEqual(12);
    });

    it("passes roof QA against the union polygon (no outside_eave_or_spans_void)", () => {
      const result = composeRoofFromComposition({ composition, eaveHeightMm: 2400 });
      const union = composeFootprintFromComposition(composition);
      const qa = applyRoofQa({
        roof: {
          roofPlanes: result.roofPlanes,
          roofFeatures: result.roofFeatures,
          metadata: result.metadata,
        },
        eavePolygon: union.map((p) => ({ x: p.x, y: p.y, z: 0 })),
      });
      expect(qa.metadata.roofQaStatus).toBe("valid");
      expect(qa.metadata.roofQaFailureReason ?? null).toBeNull();
    });
  });
});
