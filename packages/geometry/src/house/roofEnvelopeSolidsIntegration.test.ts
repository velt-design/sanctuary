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
} from "../contracts";
import { deriveHouseGableTerminalEnds } from "../houseRoofCapabilities";
import { buildHouseFootprintPolygon } from "../footprints";
import {
  buildHouseModel3D,
  buildHouseModel3DFromRawHouseInput,
  buildHouseReferenceGeometry,
} from "../houseModel";
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
} from "./houseModelTestSupport";

describe("house model roof envelope and solids", () => {
  it("uses house gutter projection as the rendered outside face offset", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        gutterWidthMm: 150,
        gutterProjectionMm: 160,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    expect(model.eave.gutterLines?.[0]).toEqual({
      start: { x: -450, y: -2250, z: 2400 },
      end: { x: 6450, y: -2250, z: 2400 },
    });
    expectPolygon3CloseTo(model.eave.gutterBoundaries?.[0], [
      { x: -610, y: -2410, z: 2400 },
      { x: 6610, y: -2410, z: 2400 },
      { x: 6460, y: -2260, z: 2400 },
      { x: -460, y: -2260, z: 2400 },
    ]);
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.start, {
      x: -450,
      y: -2250,
      z: 2355,
    });
    expectPoint3CloseTo(
      model.solids?.linearSolids[0]?.renderMesh?.vertices[0],
      { x: -610, y: -2410, z: 2310 },
    );
    expectPoint3CloseTo(
      model.solids?.linearSolids[0]?.renderMesh?.vertices[3],
      { x: -460, y: -2260, z: 2310 },
    );
    expectHouseGutterSolidsMiteredAroundCorners(model);
  });

  it("builds a fascia-under-gutter zone with clamped safe line bounds", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        strategy: "fascia_under_gutter",
        fasciaHeightMm: 180,
      }),
      attachmentEdge: makeAttachmentEdge(2600),
    });

    expect(model?.attachmentTarget?.kind).toBe("zone");
    expect(model?.attachmentTarget?.strategy).toBe("fascia_under_gutter");
    expect(model?.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
    expect(model?.attachmentTarget?.zone?.topZMm).toBe(2400);
    expect(model?.attachmentTarget?.zone?.bottomZMm).toBe(2220);
    expect(model?.attachmentTarget?.zone?.safeLine?.start.z).toBe(2400);
    expect(model?.attachmentTarget?.zone?.boundary?.[0]?.z).toBe(2220);
  });

  it("uses wall height for facade boundaries and eave height for roof and gutter references", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        eaveHeightMm: 3100,
        wallHeightMm: 5800,
      }),
      attachmentEdge: makeAttachmentEdge(3100),
    });

    expect(model?.wallSegments[0]?.boundary[2]?.z).toBe(5800);
    expect(model?.eave.gutterLines?.[0]?.start.z).toBe(3100);
    expect(model?.roofPlanes[0]?.boundary[0]?.z).toBe(3100);
  });

  it("threads house model geometry into house reference output for both attached and freestanding configs", () => {
    const attached = buildHouseReferenceGeometry({
      config: makeConfig({
        connectionType: "fascia",
        strategy: "fascia_under_gutter",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const freestanding = buildHouseReferenceGeometry({
      config: makeConfig({
        connectionType: "freestanding",
        strategy: "soffit_brackets",
      }),
      attachmentEdge: null,
    });

    expect(attached.wallPlane?.normal).toEqual({ x: 0, y: -1, z: 0 });
    expect(attached.fasciaLine).toEqual(makeAttachmentEdge());
    expect(attached.model?.roofPlanes).toHaveLength(4);
    expect(attached.attachmentTarget?.kind).toBe("zone");
    // PR8b: freestanding houses now populate `model` so multi-form workbench
    // rendering can show their walls/roof/decks. Pergola-attachment fields
    // (wallPlane, fasciaLine, roofEdgeLine, attachmentTarget) stay null --
    // there's no pergola wall to bind to.
    expect(freestanding.wallPlane).toBeNull();
    expect(freestanding.attachmentTarget).toBeNull();
    expect(freestanding.model?.roofPlanes).toHaveLength(4);
    expect(freestanding.model?.wallSegments.length).toBeGreaterThan(0);
  });

  it("omits house-side eave package geometry for supported rectangular gable roofs", () => {
    const rectFootprint = makeFootprint();
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: rectFootprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: allTerminalEndIdsForHippedConfig(rectFootprint, "x"),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    const joinGutter = model.eave.gutterLines?.find(
      (candidate) =>
        Math.abs(candidate.start.y - 450) <= 1 &&
        Math.abs(candidate.end.y - 450) <= 1,
    );
    const joinFascia = model.eave.fasciaPolygons?.find((boundary) =>
      boundary.every((candidate) => Math.abs(candidate.y - 450) <= 1),
    );
    const joinSoffit = model.eave.soffitPolygons?.find(
      (boundary) =>
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x - 6450) <= 1 &&
            Math.abs(candidate.y - 450) <= 1,
        ) &&
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x + 450) <= 1 &&
            Math.abs(candidate.y - 450) <= 1,
        ),
    );

    expectRoofQaValid(model);
    expect(model.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
    expect(joinGutter).toBeUndefined();
    expect(joinFascia).toBeUndefined();
    expect(joinSoffit).toBeUndefined();
    expect(model.eave.gutterLines).toHaveLength(1);
  });

  it("omits house-side eave package geometry for supported orthogonal hipped roofs", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: "hipped",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    const joinGutter = model.eave.gutterLines?.find(
      (candidate) =>
        Math.abs(candidate.start.y - 450) <= 1 &&
        Math.abs(candidate.end.y - 450) <= 1,
    );
    const joinFascia = model.eave.fasciaPolygons?.find((boundary) =>
      boundary.every((candidate) => Math.abs(candidate.y - 450) <= 1),
    );
    const joinSoffit = model.eave.soffitPolygons?.find(
      (boundary) =>
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x - 6450) <= 1 &&
            Math.abs(candidate.y - 450) <= 1,
        ) &&
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x + 450) <= 1 &&
            Math.abs(candidate.y - 450) <= 1,
        ),
    );

    expectRoofQaValid(model);
    expect(model.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
    expect(joinGutter).toBeUndefined();
    expect(joinFascia).toBeUndefined();
    expect(joinSoffit).toBeUndefined();
    expect(model.eave.gutterLines).toHaveLength(3);
  });
});
