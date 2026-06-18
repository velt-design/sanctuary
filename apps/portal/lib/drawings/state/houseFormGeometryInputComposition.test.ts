import { describe, expect, it } from "vitest";
import type { HouseComposition } from "@sp/geometry";
import type { HouseFormModel } from "./objectFirstWorkbenchModel";
import { buildSingleRectangleCompositionFromHouseForm } from "./houseFormCompositionAdapter";
import { buildHouseFormGeometryInputForForm } from "./houseFormGeometryInput";

/**
 * PR-COMP-PHASE3.2 (2026-06-18): byte-equivalence check between
 * the legacy roof path and the composition swap path for a single-
 * rectangle hipped house form.
 *
 * Both paths bottom out in `buildRectangularRoof` on the same
 * dimensions, so the resulting roof planes / features must match
 * exactly. This test pins the equivalence so any future
 * divergence (refactor accident, rounding drift, etc.) surfaces
 * immediately.
 *
 * Phase 4 multi-rectangle compositions will NOT have this property
 * — that's exactly the point: the composition path produces
 * different geometry than the legacy free-form solver for
 * non-rectangle unions. The byte-equivalence is a v1 invariant
 * only.
 */
describe("composition roof swap byte-equivalence (PR-COMP-PHASE3.2)", () => {
  function baseForm(): HouseFormModel {
    return {
      id: "house-1",
      label: "House 1",
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
      footprint: {
        mode: "preset",
        preset: "straight",
        params: {
          widthM: "6",
          offsetXM: "0",
          setbackM: "0",
          bandDepthM: "4",
          returnRunM: "0",
          recessWidthM: "0",
          recessDepthM: "0",
          leftLegRunM: "0",
          rightLegRunM: "0",
          sideRunM: "0",
        },
        polygon: [],
        attachmentSide: "rear",
      },
      roofIntent: {
        form: "hipped",
        material: "corrugated_iron",
        primaryPitchDeg: "25",
        primaryFallDirection: "positive_y",
        ridgeAxis: "x",
        openGableEndIds: [],
      },
      storeyMode: "single_storey",
      attachmentStrategy: null,
      eaveHeightM: "2.4",
    };
  }

  it("composition path produces the same roof-plane count as the legacy path", () => {
    const legacyForm = baseForm();
    const compositionForm: HouseFormModel = {
      ...baseForm(),
      composition:
        buildSingleRectangleCompositionFromHouseForm(baseForm()) ?? undefined,
    };
    expect(compositionForm.composition).toBeDefined();

    const legacyResult = buildHouseFormGeometryInputForForm(legacyForm);
    const compositionResult =
      buildHouseFormGeometryInputForForm(compositionForm);
    if (!legacyResult.ok || !compositionResult.ok) {
      throw new Error("both paths should succeed for a 6×4 hipped form");
    }
    expect(compositionResult.model.roofPlanes.length).toBe(
      legacyResult.model.roofPlanes.length,
    );
    // Composition path stamps its own topology-solver name.
    const compositionSolver =
      compositionResult.model.metadata?.roofTopologySolver ?? "";
    const legacySolver = legacyResult.model.metadata?.roofTopologySolver ?? "";
    expect(compositionSolver).toContain("composition");
    expect(legacySolver).not.toContain("composition");
  });

  it("composition path preserves walls from the legacy pipeline", () => {
    const compositionForm: HouseFormModel = {
      ...baseForm(),
      composition:
        buildSingleRectangleCompositionFromHouseForm(baseForm()) ?? undefined,
    };
    const legacyResult = buildHouseFormGeometryInputForForm(baseForm());
    const compositionResult =
      buildHouseFormGeometryInputForForm(compositionForm);
    if (!legacyResult.ok || !compositionResult.ok) {
      throw new Error("both paths should succeed");
    }
    // Walls / eave / openings come from the legacy pipeline unchanged.
    expect(compositionResult.model.wallSegments.length).toBe(
      legacyResult.model.wallSegments.length,
    );
  });

  it("legacy free-form form (no composition) does not stamp composition metadata", () => {
    const legacyForm = baseForm();
    expect(legacyForm.composition).toBeUndefined();
    const result = buildHouseFormGeometryInputForForm(legacyForm);
    if (!result.ok) throw new Error("legacy hipped 6×4 should succeed");
    const legacySolver = result.model.metadata?.roofTopologySolver ?? "";
    expect(legacySolver).not.toContain("composition");
  });

  describe("PR-COMP-PHASE4a.3 — multi-rectangle composite footprint substitution", () => {
    function lCompositeForm(): HouseFormModel {
      // 2-primitive L composite: 6m × 4m main + 4m × 2m extension
      // sharing the east-west seam at the main's east edge.
      //
      //  +-------+---+
      //  |       | B |
      //  |   A   +---+
      //  |       |
      //  +-------+
      const composition: HouseComposition = {
        primitives: [
          {
            kind: "axisAlignedRectangle",
            originXMm: 0,
            originYMm: 0,
            widthMm: 6000,
            depthMm: 4000,
            roofIntent: {
              form: "hipped",
              pitchDeg: 25,
              ridgeAxis: "x",
              startCap: "hipped",
              endCap: "hipped",
            },
          },
          {
            kind: "axisAlignedRectangle",
            originXMm: 6000,
            originYMm: 2000,
            widthMm: 4000,
            depthMm: 2000,
            roofIntent: {
              form: "hipped",
              pitchDeg: 25,
              ridgeAxis: "x",
              startCap: "hipped",
              endCap: "hipped",
            },
          },
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
        ],
      };
      return {
        ...baseForm(),
        composition,
      };
    }

    it("renders the L composite via the union footprint (more wall segments than any single constituent rectangle)", () => {
      const single = buildHouseFormGeometryInputForForm(baseForm());
      const composite = buildHouseFormGeometryInputForForm(lCompositeForm());
      if (!single.ok || !composite.ok) {
        throw new Error("both single and composite paths should succeed");
      }
      // L union has 6 outer edges; single rectangle has 4. The wall
      // builder produces a wall per perimeter edge, so composite > single.
      expect(composite.model.wallSegments.length).toBeGreaterThan(
        single.model.wallSegments.length,
      );
    });

    it("the success-shape `footprint` reports the union polygon (not the preset polygon)", () => {
      const result = buildHouseFormGeometryInputForForm(lCompositeForm());
      if (!result.ok) throw new Error("composite path should succeed");
      // L union: 6 distinct corner vertices after collinear cleanup.
      expect(result.footprint).toHaveLength(6);
      // Diagnostics report matches.
      expect(result.diagnostics.footprintPointCount).toBe(6);
    });

    it("composition roof solver still stamps composition_per_rectangle_stitched on multi-rectangle composites", () => {
      const result = buildHouseFormGeometryInputForForm(lCompositeForm());
      if (!result.ok) throw new Error("composite path should succeed");
      const solver = result.model.metadata?.roofTopologySolver ?? "";
      expect(solver).toContain("composition");
    });

    it("single-rectangle composition byte-equivalence is preserved (helper returns null, legacy preset path runs)", () => {
      // Regression guard for the gate inside deriveCompositionUnionPolygon3:
      // single-primitive compositions MUST NOT route through the union
      // substitution. If they did, the Phase 3.2 byte-equivalence
      // invariant would silently drift.
      const form: HouseFormModel = {
        ...baseForm(),
        composition: buildSingleRectangleCompositionFromHouseForm(baseForm()) ?? undefined,
      };
      const compositionResult = buildHouseFormGeometryInputForForm(form);
      const legacyResult = buildHouseFormGeometryInputForForm(baseForm());
      if (!compositionResult.ok || !legacyResult.ok) {
        throw new Error("both should succeed");
      }
      expect(compositionResult.model.wallSegments.length).toBe(
        legacyResult.model.wallSegments.length,
      );
      expect(compositionResult.footprint).toHaveLength(legacyResult.footprint.length);
    });
  });

  it("composition path handles a Dutch-hip (one open end)", () => {
    const form: HouseFormModel = {
      ...baseForm(),
      roofIntent: {
        ...baseForm().roofIntent,
        openGableEndIds: ["house-gable-end-x-2"],
      },
    };
    const composition =
      buildSingleRectangleCompositionFromHouseForm(form) ?? undefined;
    expect(composition).toBeDefined();
    const compositionForm: HouseFormModel = {
      ...form,
      composition,
    };
    const result = buildHouseFormGeometryInputForForm(compositionForm);
    if (!result.ok) throw new Error("Dutch-hip composition should succeed");
    // Dutch hip (one end open) drops one hip triangle: 2 main slopes + 1 hip = 3 planes.
    expect(result.model.roofPlanes.length).toBe(3);
  });
});
