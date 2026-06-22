import { describe, expect, it } from "vitest";
import {
  buildHouseModelSceneObjects,
  type HouseComposition,
} from "@sp/geometry";
import { buildHouseFormGeometryInputForForm } from "./houseFormGeometryInput";
import type {
  HouseFormModel,
  HouseFormRoofIntentModel,
} from "./objectFirstWorkbenchModel";

/**
 * PR-SS-5 (2026-06-21): regression for the "plan-good / 3D-bad" bug.
 *
 * For multi-rectangle composites the legacy solver fails QA, so
 * `buildHouseModel3D` builds ZERO roof solids (houseModel.ts gates
 * `roofPlanesForSolids` on the legacy `roofQaStatus`). The composition
 * swap then installs the (valid) skeleton roof PLANES, so the 2D plan
 * looks correct — but the 3D viewer renders `solids.surfaceSolids`,
 * which contain only walls, so the roof was missing in 3D.
 *
 * The viewer now falls back to emitting roof PLANES as surfaces when
 * the model has wall solids but no roof solid. This test drives the
 * exact production render path — `buildHouseFormGeometryInputForForm`
 * (legacy build + composition swap) followed by
 * `buildHouseModelSceneObjects` (the viewer scene builder) — on the
 * Jess-Oratia H composite (composition corpus fixture 08) and asserts
 * the 3D scene actually contains the roof.
 */

const hippedRoofIntent: HouseFormRoofIntentModel = {
  form: "hipped",
  primaryPitchDeg: "20",
  primaryFallDirection: "positive_y",
  ridgeAxis: "y",
  openGableEndIds: [],
};

// Jess-Oratia H composite — 3-rect dumbbell captured live from the
// workbench (composition corpus 08-h-3rect-jess-oratia.json). The
// wavefront/legacy solver fails on this footprint; the orthogonal
// straight skeleton produces a unified 12-facet hipped roof.
const jessOratiaComposition: HouseComposition = {
  primitives: [
    {
      kind: "axisAlignedRectangle",
      originXMm: -1.2531927495729178e-7,
      originYMm: -9219.380999731318,
      widthMm: 6000,
      depthMm: 16795.066093,
      roofIntent: {
        form: "hipped",
        pitchDeg: 20,
        ridgeAxis: "y",
        startCap: "hipped",
        endCap: "hipped",
      },
    },
    {
      kind: "axisAlignedRectangle",
      originXMm: 6000.000000316788,
      originYMm: -6470.786490754859,
      widthMm: 19365.688000000002,
      depthMm: 8367.979982427838,
      roofIntent: {
        form: "hipped",
        pitchDeg: 20,
        ridgeAxis: "y",
        startCap: "hipped",
        endCap: "hipped",
      },
    },
    {
      kind: "axisAlignedRectangle",
      originXMm: 25365.688,
      originYMm: -12516.668245327017,
      widthMm: 9362.201000316789,
      depthMm: 21453.862999999998,
      roofIntent: {
        form: "hipped",
        pitchDeg: 20,
        ridgeAxis: "y",
        startCap: "hipped",
        endCap: "hipped",
      },
    },
  ],
  joins: [
    { fromPrimitiveIndex: 0, fromEdge: "east", toPrimitiveIndex: 1, toEdge: "west" },
    { fromPrimitiveIndex: 1, fromEdge: "east", toPrimitiveIndex: 2, toEdge: "west" },
  ],
};

function jessOratiaHouseForm(): HouseFormModel {
  return {
    id: "house-jess-oratia",
    label: "Jess - Oratia",
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    composition: jessOratiaComposition,
    attachmentSide: "rear",
    roofIntent: hippedRoofIntent,
    roofIntentAuthored: true,
    storeyMode: "single_storey",
    attachmentStrategy: null,
    eaveHeightM: "2.4",
  };
}

describe("composition render → 3D scene (PR-SS-5 / PR-SS-6)", () => {
  it("builds thick roof solids for the Jess-Oratia H composite and renders them in 3D", () => {
    const result = buildHouseFormGeometryInputForForm(jessOratiaHouseForm());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const model = result.model;

    // Plan side is correct: the skeleton produced a unified multi-facet
    // hipped roof (12 facets for this H).
    expect(model.roofPlanes.length).toBeGreaterThanOrEqual(12);

    // PR-SS-6: the composition swap now rebuilds the roof's 3D artifacts
    // from the skeleton planes, so the model carries real roof SOLIDS
    // (one extruded solid per facet) alongside the wall solids — not the
    // empty roof the legacy QA gate produced before.
    const surfaceSolids = model.solids?.surfaceSolids ?? [];
    const wallSolids = surfaceSolids.filter((s) => s.kind === "wall");
    const roofSolids = surfaceSolids.filter((s) => s.kind === "roof");
    expect(wallSolids.length).toBeGreaterThan(0);
    expect(roofSolids.length).toBeGreaterThanOrEqual(12);

    // The viewer scene renders those roof solids (thick bodies), so the
    // surface fallback is NOT needed here.
    const scene = buildHouseModelSceneObjects({ model });
    const roofSolidObjects = scene.filter(
      (obj) => obj.type === "house_surface_solid" && obj.kind === "roof",
    );
    expect(roofSolidObjects.length).toBeGreaterThanOrEqual(12);

    // The roof rises above the eave (2400mm) — real hipped geometry, not
    // a flat lid at wall height.
    const zs = roofSolidObjects.flatMap((obj) =>
      "boundary" in obj && Array.isArray(obj.boundary)
        ? obj.boundary.map((p: { z: number }) => p.z)
        : [],
    );
    const maxZ = Math.max(...zs);
    expect(maxZ).toBeGreaterThan(2400);
  });

  it("gives the composite roof an eave overhang with a soffit (PR-SS-8)", () => {
    const result = buildHouseFormGeometryInputForForm(jessOratiaHouseForm());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const model = result.model;

    // The skeleton runs on the overhang-offset union, so the roof eaves
    // project past the wall footprint — and a soffit fills the gap. Before
    // PR-SS-8 the roof was flush (soffit count 0, eave invisible in 3D).
    expect((model.eave.soffitPolygons ?? []).length).toBeGreaterThan(0);
    const soffitSolids = (model.solids?.surfaceSolids ?? []).filter(
      (s) => s.kind === "soffit",
    );
    expect(soffitSolids.length).toBeGreaterThan(0);

    // Roof X-extent exceeds the footprint X-extent by the overhang.
    const fpX = model.footprint.map((p) => p.x);
    const roofX = model.roofPlanes.flatMap((pl) => pl.boundary.map((p) => p.x));
    expect(Math.max(...roofX)).toBeGreaterThan(Math.max(...fpX));
    expect(Math.min(...roofX)).toBeLessThan(Math.min(...fpX));
  });
});
