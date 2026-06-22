import { describe, expect, it } from "vitest";
import type {
  AttachmentSide,
  GeometryConfig,
  HouseAttachmentStrategy,
  HouseFootprintPreset,
  HouseRoofForm,
  Line3,
  Point3,
  Polygon3,
  RawHouseInput,
  RenderMesh3D,
} from "./contracts";
import { deriveHouseGableTerminalEnds } from "./houseRoofCapabilities";
import { buildHouseFootprintPolygon } from "./footprints";
import {
  buildHouseModel3D,
  buildHouseModel3DFromRawHouseInput,
  buildHouseReferenceGeometry,
} from "./houseModel";
import {
  makeFootprint,
  makePresetFootprint,
  HOUSE_FOOTPRINT_PRESETS,
  HOUSE_ROOF_FORMS,
  ATTACHMENT_SIDES,
  pointOnSegment2D,
  pointInPolygon2D,
  pointInOrOnPolygon2D,
  segmentInsidePolygon2D,
  roofPointKey,
  roofSegmentKey,
  roofPointKeyXY,
  roofSegmentKeyXY,
  rebuildRoofPerimeterPolygon,
  eavePolygonFromModel,
  polygonAreaXY,
  signedPolygonAreaXY,
  reflexEaveVertices,
  expectRoofFacetsCoverEaveOnce,
  expectRoofQaValid,
  expectRoofFacetsInsideEave,
  roofBoundarySegmentCounts,
  roofBoundarySegments,
  expectJoinedRoofFeaturesBackedByFinalFacets,
  expectRoofBoundaryEavePointsAtEaveHeight,
  expectValleysStartAtReentrantCorners,
  expectNoInternalEaveHeightRoofSeams,
  makeConfig,
  allTerminalEndIdsForHippedConfig,
  makePlacedFootprint,
  makeFrontFootprint,
  makeLeftFootprint,
  makeRightFootprint,
  makeAttachmentEdge,
  expectPoint3CloseTo,
  pointDistanceSquared3,
  vectorLength3,
  normalizeVector3,
  dotPoint3,
  countRenderMeshVerticalFaces,
  pointDistanceToSegment2D,
  sourceEdgeLineFromModel,
  polygonIsHorizontal,
  countRenderMeshFacesAlignedToNormal,
  expectUnorderedSegment3CloseTo,
  lineLength3,
  crossPoint3,
  subtractPoint3,
  distanceToLine3D,
  expectPolygon3CloseTo,
  expectPolygon3CloseToIgnoringRotation,
  expectSolidBoundariesExact,
  expectVerticalPrismRenderMesh,
  expectMiteredRenderMeshesAroundCorners,
  polygonOutwardVectorXY,
  expectHouseGutterBoundariesUseProjection,
  expectHouseGutterSolidsMiteredAroundCorners,
  expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes,
  expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes,
  expectHouseRoofFeatureFlashings,
} from "./house/houseModelTestSupport";

describe("house model geometry builder", () => {
  it("builds walls, hipped roof planes, eave references, and a soffit attachment target", () => {
    const model = buildHouseModel3D({
      config: makeConfig({ wallHeightMm: 3100 }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    expect(model.wallSegments.map((segment) => segment.id)).toEqual([
      "house-wall-1",
      "house-wall-2",
      "house-wall-3",
      "house-wall-4",
    ]);
    expect(model.wallSegments[0]?.boundary[2]?.z).toBe(3100);
    expect(model.roofPlanes.map((plane) => plane.id)).toEqual([
      "house-roof-min-y",
      "house-roof-max-y",
      "house-roof-min-x",
      "house-roof-max-x",
    ]);
    expect(
      model.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === "x"),
    ).toBe(true);
    expect(model.metadata?.roofGeometry).toBe("rectangular_hipped");
    expectRoofQaValid(model);
    expectRoofBoundaryEavePointsAtEaveHeight(model, 2400);
    expect(model.eave.gutterLines).toHaveLength(3);
    expect(
      model.roofFlashings?.some(
        (flashing) =>
          flashing.metadata?.sourceEdgeId === "footprint-edge-3" &&
          flashing.metadata?.flashingRole === "house_apron" &&
          flashing.metadata?.houseRoofPerimeterRole === "house_apron_edge",
      ),
    ).toBe(true);
    expect(model.eave.fasciaPolygons).toHaveLength(3);
    expect(model.eave.soffitPolygons).toHaveLength(3);
    expect(model.wallSegments[0]?.boundary[0]).toEqual({
      x: 0,
      y: -1800,
      z: 0,
    });
    expect(model.wallSegments[0]?.boundary[1]).toEqual({
      x: 6000,
      y: -1800,
      z: 0,
    });
    expect(model.eave.gutterLines?.[0]?.start).toEqual({
      x: -450,
      y: -2250,
      z: 2400,
    });
    expect(model.eave.gutterLines?.[0]?.end).toEqual({
      x: 6450,
      y: -2250,
      z: 2400,
    });
    expect(model.eave.fasciaPolygons?.[0]?.[0]).toEqual({
      x: -450,
      y: -2250,
      z: 2400,
    });
    expect(model.eave.fasciaPolygons?.[0]?.[1]).toEqual({
      x: 6450,
      y: -2250,
      z: 2400,
    });
    expect(model.eave.fasciaPolygons?.[0]?.[2]?.z).toBe(2220);
    expect(model.eave.soffitPolygons?.[0]).toEqual([
      { x: -450, y: -2250, z: 2400 },
      { x: 6450, y: -2250, z: 2400 },
      { x: 6000, y: -1800, z: 2400 },
      { x: 0, y: -1800, z: 2400 },
    ]);
    expect(
      model.solids?.surfaceSolids.filter((solid) => solid.kind === "wall"),
    ).toHaveLength(4);
    expect(
      model.solids?.surfaceSolids.filter((solid) => solid.kind === "roof"),
    ).toHaveLength(4);
    expect(
      model.solids?.surfaceSolids.filter((solid) => solid.kind === "soffit"),
    ).toHaveLength(3);
    expect(model.solids?.linearSolids).toHaveLength(3);
    expect(model.solids?.linearSolids[0]).toMatchObject({
      kind: "gutter",
      profileWidthMm: 125,
      profileDepthMm: 90,
    });
    expectPoint3CloseTo(
      model.solids?.surfaceSolids.find((solid) => solid.kind === "wall")
        ?.boundary[0],
      {
        x: 0,
        y: -1800,
        z: 0,
      },
    );
    expectPoint3CloseTo(
      model.solids?.surfaceSolids.find((solid) => solid.kind === "fascia")
        ?.boundary[0],
      {
        x: -450,
        y: -2250,
        z: 2400,
      },
    );
    expectPoint3CloseTo(
      model.solids?.surfaceSolids.find((solid) => solid.kind === "soffit")
        ?.boundary[0],
      {
        x: -450,
        y: -2250,
        z: 2400,
      },
    );
    expectPoint3CloseTo(
      model.solids?.surfaceSolids.find((solid) => solid.kind === "soffit")
        ?.boundary[1],
      {
        x: 6450,
        y: -2250,
        z: 2400,
      },
    );
    expectPoint3CloseTo(
      model.solids?.surfaceSolids.find((solid) => solid.kind === "wall")
        ?.renderMesh?.vertices[0],
      {
        x: 0,
        y: -1800,
        z: 0,
      },
    );
    expectPoint3CloseTo(
      model.solids?.surfaceSolids.find((solid) => solid.kind === "fascia")
        ?.renderMesh?.vertices[0],
      {
        x: -459,
        y: -2259,
        z: 2220,
      },
    );
    expectPoint3CloseTo(
      model.solids?.linearSolids[0]?.renderMesh?.vertices[0],
      {
        x: -575,
        y: -2375,
        z: 2310,
      },
    );
    expectPolygon3CloseTo(model.eave.gutterBoundaries?.[0], [
      { x: -575, y: -2375, z: 2400 },
      { x: 6575, y: -2375, z: 2400 },
      { x: 6450, y: -2250, z: 2400 },
      { x: -450, y: -2250, z: 2400 },
    ]);
    expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectHouseRoofFeatureFlashings(model, ["ridge", "hip"]);
    expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.start, {
      x: -450,
      y: -2250,
      z: 2355,
    });
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.end, {
      x: 6450,
      y: -2250,
      z: 2355,
    });
    expectHouseGutterSolidsMiteredAroundCorners(model);
    expect(model.attachmentTarget?.kind).toBe("line");
    expect(model.attachmentTarget?.line).toEqual(makeAttachmentEdge());
  });
});

describe("buildHouseModel3DFromRawHouseInput (milestone 13 phase 2)", () => {
  it("produces the same wall/eave/roof structure as the legacy config-driven path", () => {
    const footprint = makeFootprint(6000, 1800);
    const config = makeConfig({ footprint, wallHeightMm: 3100 });
    const attachmentEdge = makeAttachmentEdge();

    // Legacy path: pre-baked config -> buildHouseModel3D.
    const legacy = buildHouseModel3D({ config, attachmentEdge });
    expect(legacy).not.toBeNull();
    if (!legacy) return;

    // New path: assemble the equivalent RawHouseInput from the test's
    // known inputs, then call the new entry. Pergola context mirrors what
    // the legacy config supplies.
    const rawHouse: RawHouseInput = {
      houseId: "house-main",
      // Test path skips footprint normalization (pergolaContext supplies
      // the resolved Polygon3 directly); raw footprint fields stay null.
      footprintMode: null,
      footprintPolygon: null,
      eaveHeightM: "2.4",
      wallHeightM: "3.1",
      roofPitchDeg: "25",
      roofForm: "hipped",
      roofPrimaryFallDirection: "positive_y",
      roofRidgeAxis: "x",
      roofMaterial: "corrugated_iron",
      attachmentStrategy: "soffit_brackets",
      eave: {
        soffitDepthMm: "450",
        fasciaHeightMm: "180",
        gutterWidthMm: "125",
        gutterDepthMm: "90",
        gutterProjectionMm: "125",
        eaveOverhangMm: "450",
      },
    };
    const fromRaw = buildHouseModel3DFromRawHouseInput({
      rawHouse,
      footprint,
      housePosition: null,
      soffitDepthMm: 450,
      houseUndersideMm: 2400,
      outerUndersideMm: 2137,
      referenceUndersideMm: 2400,
      pergolaAttachment: {
        connectionType: "soffit",
        attachmentSide: "rear",
        attachmentEdge,
        datum: config.datum,
        pergolaLengthMm: 6000,
        pergolaProjectionMm: 3000,
      },
    });
    expect(fromRaw).not.toBeNull();
    if (!fromRaw) return;

    // Structural equivalence: same wall count, same eave height, same
    // roof-plane count + form, same attachment-target shape.
    expect(fromRaw.wallSegments).toHaveLength(legacy.wallSegments.length);
    expect(fromRaw.wallSegments.map((s) => s.id).sort()).toEqual(
      legacy.wallSegments.map((s) => s.id).sort(),
    );
    expect(fromRaw.roofPlanes).toHaveLength(legacy.roofPlanes.length);
    expect(fromRaw.attachmentTarget?.kind).toBe(legacy.attachmentTarget?.kind);
    // Footprint preserved verbatim (pergolaContext supplies it directly).
    expect(fromRaw.footprint).toEqual(legacy.footprint);
  });

  it("builds a real HouseModel3D for a freestanding house (PR-G2: pergolaAttachment = null)", () => {
    // Pre-PR8b this returned null because `buildHouseModelConfig` short-
    // circuited on freestanding. Multi-form workbench rendering needs
    // freestanding forms to surface walls/roof/decks, so the short-circuit
    // moved upstream (in `normalize.ts`) to the genuine "no footprint" gate.
    // PR-G2 dropped the synthetic pergola-context stub: freestanding callers
    // just pass `pergolaAttachment: null` and the geometry function applies
    // the freestanding defaults internally.
    const footprint = makeFootprint();
    const rawHouse: RawHouseInput = {
      houseId: "house-main",
      eaveHeightM: "2.4",
      wallHeightM: "2.4",
      roofForm: "hipped",
    };
    const result = buildHouseModel3DFromRawHouseInput({
      rawHouse,
      footprint,
      pergolaAttachment: null,
    });
    expect(result).not.toBeNull();
    expect(result?.roofPlanes.length).toBeGreaterThan(0);
    expect(result?.wallSegments.length).toBeGreaterThan(0);
    // Pergola attachment fields are absent for freestanding -- the model
    // is a standalone house, not a pergola-attached configuration.
    expect(result?.attachmentTarget?.kind).toBe("none");
  });
});
