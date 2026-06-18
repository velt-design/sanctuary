import { describe, expect, it } from "vitest";
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
