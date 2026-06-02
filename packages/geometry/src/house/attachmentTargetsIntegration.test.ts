import { describe, expect, it } from "vitest";
import type {
  AttachmentSide,
  GeometryConfig,
  HouseAttachmentStrategy,
  HouseFootprintPreset,
  HouseRoofForm,
  HouseRoofMaterial,
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
  expectHouseRoofMaterialVisuals,
} from "./houseModelTestSupport";

describe("house model attachment targets", () => {
  it("exposes every attachable perimeter edge as a discoverable roof-eave snap target", () => {
    // Step 6 of the first-class spatial-entities migration. The snap engine
    // (step 7) will consume `model.roofEaves` to surface roof-edge candidates
    // for pergola attachment. Each perimeter edge produces one descriptor
    // with a stable id and the eave line at gutter height. The list
    // includes draining edges (`drain_eave`) AND non-draining attachable
    // ones (`weather_flashed_edge`, `house_apron_edge`) so pergolas can
    // snap to opened Dutch-hip gables and L-/U-shape apron edges. See
    // `docs/decision-log.md` 2026-05-13 "Pergola Snap to Every House
    // Perimeter Edge".
    const model = buildHouseModel3D({
      config: makeConfig(),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    const roofEaves = model.roofEaves ?? [];
    expect(roofEaves.length).toBeGreaterThan(0);
    const allowedEdgeKinds: ReadonlySet<string> = new Set([
      "drain_eave",
      "weather_flashed_edge",
      "house_apron_edge",
    ]);
    for (const eave of roofEaves) {
      expect(eave.id).toMatch(/^roof-eave-/);
      expect(allowedEdgeKinds.has(eave.edgeKind)).toBe(true);
      expect(eave.sourceEdgeId).toBeTruthy();
      expect(typeof eave.eaveLine.start.x).toBe("number");
      expect(typeof eave.eaveLine.end.x).toBe("number");
      expect(typeof eave.eaveLine.start.z).toBe("number");
    }
    // Stable id format — the snap engine will round-trip through
    // `host.edgeId` so id stability matters across re-solves.
    const ids = new Set(roofEaves.map((eave) => eave.id));
    expect(ids.size).toBe(roofEaves.length);
    // Eaves live at gutter height (eaveHeightMm = 2400 in the fixture).
    for (const eave of roofEaves) {
      expect(eave.eaveLine.start.z).toBeCloseTo(2400, 1);
      expect(eave.eaveLine.end.z).toBeCloseTo(2400, 1);
    }
  });

  it("projects fascia-under-gutter targets onto the setback house facade while preserving legacy references", () => {
    const originalAttachmentEdge = makeAttachmentEdge(2600);
    const house = buildHouseReferenceGeometry({
      config: makeConfig({
        footprint: makePlacedFootprint({
          offsetX: -1000,
          width: 8000,
          facadeY: -400,
          depth: 2000,
        }),
        connectionType: "fascia",
        strategy: "fascia_under_gutter",
        fasciaHeightMm: 180,
      }),
      attachmentEdge: originalAttachmentEdge,
    });

    expect(house.roofEdgeLine).toEqual(originalAttachmentEdge);
    expect(house.fasciaLine).toEqual(originalAttachmentEdge);
    expect(house.attachmentTarget?.line).toEqual({
      start: { x: 0, y: -400, z: 2400 },
      end: { x: 6000, y: -400, z: 2400 },
    });
    expect(house.attachmentTarget?.zone?.boundary).toEqual([
      { x: 6000, y: -400, z: 2220 },
      { x: 0, y: -400, z: 2220 },
      { x: 0, y: -400, z: 2400 },
      { x: 6000, y: -400, z: 2400 },
    ]);
  });

  it("projects front-side attachment targets onto the selected front facade while preserving solver references", () => {
    const originalAttachmentEdge = makeAttachmentEdge(2600);
    const house = buildHouseReferenceGeometry({
      config: makeConfig({
        attachmentSide: "front",
        footprint: makeFrontFootprint({
          offsetX: -1000,
          width: 8000,
          facadeY: 3400,
          depth: 2000,
        }),
        connectionType: "fascia",
        strategy: "fascia_under_gutter",
        fasciaHeightMm: 180,
      }),
      attachmentEdge: originalAttachmentEdge,
    });

    expect(house.roofEdgeLine).toEqual(originalAttachmentEdge);
    expect(house.fasciaLine).toEqual(originalAttachmentEdge);
    expect(house.attachmentTarget?.line).toEqual({
      start: { x: 0, y: 3400, z: 2400 },
      end: { x: 6000, y: 3400, z: 2400 },
    });
    expect(house.attachmentTarget?.zone?.boundary).toEqual([
      { x: 6000, y: 3400, z: 2220 },
      { x: 0, y: 3400, z: 2220 },
      { x: 0, y: 3400, z: 2400 },
      { x: 6000, y: 3400, z: 2400 },
    ]);
  });

  it("clips left-side soffit bracket targets to the overlapping selected side facade span", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        attachmentSide: "left",
        footprint: makeLeftFootprint({
          offsetY: 500,
          width: 2000,
          facadeX: -300,
          depth: 1200,
        }),
        strategy: "soffit_brackets",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe("line");
    expect(model?.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: -300, y: 500, z: 2400 },
      end: { x: -300, y: 2500, z: 2400 },
    });
  });

  it("selects the right-side wall source for side facade ledger targets", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        attachmentSide: "right",
        footprint: makeRightFootprint({
          offsetY: 500,
          width: 2000,
          facadeX: 6300,
          depth: 1200,
        }),
        strategy: "facade_ledger",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe("plane");
    expect(model?.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: 6300, y: 500, z: 2400 },
      end: { x: 6300, y: 2500, z: 2400 },
    });
    expect(model?.attachmentTarget?.plane?.origin.x).toBe(6300);
  });

  it("selects the selected-side source wall for post-supported tieback metadata", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        attachmentSide: "left",
        footprint: makeLeftFootprint({
          offsetY: 250,
          width: 2000,
          facadeX: -400,
          depth: 1200,
        }),
        strategy: "post_supported_tieback",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe("metadata_only");
    expect(model?.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
    expect(model?.attachmentTarget?.metadata).toEqual({ tieback: true });
  });

  it("clips projected attachment target spans to the overlapping house facade width", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: makePlacedFootprint({ offsetX: 1000, width: 3000 }),
        strategy: "soffit_brackets",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe("line");
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: 1000, y: 0, z: 2400 },
      end: { x: 4000, y: 0, z: 2400 },
    });
  });

  it("emits no visible attachment target line when the pergola span does not overlap the selected facade", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: makePlacedFootprint({ offsetX: 7000, width: 1000 }),
        strategy: "soffit_brackets",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe("line");
    expect(model?.attachmentTarget?.line).toBeNull();
    expect(model?.attachmentTarget?.metadata).toEqual({
      attachmentSpanStatus: "no_overlap",
    });
  });

  it("uses projected facade lines for facade ledger targets", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: makePlacedFootprint({
          offsetX: -500,
          width: 7000,
          facadeY: -300,
        }),
        strategy: "facade_ledger",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe("plane");
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: 0, y: -300, z: 2400 },
      end: { x: 6000, y: -300, z: 2400 },
    });
    expect(model?.attachmentTarget?.plane?.origin.y).toBe(-300);
  });

  it("maps attachment strategies into deterministic target kinds", () => {
    const cases: Array<[HouseAttachmentStrategy, string]> = [
      ["soffit_brackets", "line"],
      ["fascia_under_gutter", "zone"],
      ["facade_ledger", "plane"],
      ["post_supported_tieback", "metadata_only"],
      ["none", "none"],
    ];

    for (const [strategy, kind] of cases) {
      const model = buildHouseModel3D({
        config: makeConfig({ strategy }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model?.attachmentTarget?.kind).toBe(kind);
      expect(model?.attachmentTarget?.strategy).toBe(strategy);
    }
  });
});
