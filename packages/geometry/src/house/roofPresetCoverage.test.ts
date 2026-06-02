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

describe("house model roof preset coverage", () => {
  it("builds wall/eave geometry and selected-facade targets from a custom recessed footprint", () => {
    const footprint: Polygon3 = [
      { x: -1000, y: -2600, z: 0 },
      { x: 7000, y: -2600, z: 0 },
      { x: 7000, y: -400, z: 0 },
      { x: -1000, y: -400, z: 0 },
      { x: -1000, y: -1400, z: 0 },
      { x: -2000, y: -1400, z: 0 },
      { x: -2000, y: -2600, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        strategy: "facade_ledger",
        eaveOverhangMm: 450,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    expect(model?.footprint).toEqual(footprint);
    expect(model?.wallSegments).toHaveLength(7);
    expect(model?.wallSegments.map((segment) => segment.line)).toEqual([
      { start: { x: -1000, y: -2600, z: 0 }, end: { x: 7000, y: -2600, z: 0 } },
      { start: { x: 7000, y: -2600, z: 0 }, end: { x: 7000, y: -400, z: 0 } },
      { start: { x: 7000, y: -400, z: 0 }, end: { x: -1000, y: -400, z: 0 } },
      { start: { x: -1000, y: -400, z: 0 }, end: { x: -1000, y: -1400, z: 0 } },
      {
        start: { x: -1000, y: -1400, z: 0 },
        end: { x: -2000, y: -1400, z: 0 },
      },
      {
        start: { x: -2000, y: -1400, z: 0 },
        end: { x: -2000, y: -2600, z: 0 },
      },
      {
        start: { x: -2000, y: -2600, z: 0 },
        end: { x: -1000, y: -2600, z: 0 },
      },
    ]);
    expect(model?.eave.gutterLines).toHaveLength(4);
    expect(
      model?.eave.gutterLines?.every(
        (line) => Number.isFinite(line.start.x) && Number.isFinite(line.end.y),
      ),
    ).toBe(true);
    expect(
      model?.roofPlanes.every((plane) => Number.isFinite(plane.boundary[0]?.x)),
    ).toBe(true);
    expect(model?.roofPlanes.length).toBeGreaterThan(3);
    expect(
      model?.roofPlanes.every((plane) => !plane.id.includes("house-roof-wing")),
    ).toBe(true);
    expect(
      model?.roofFeatures?.some((feature) => feature.kind === "ridge"),
    ).toBe(true);
    expect(model?.roofFeatures?.some((feature) => feature.kind === "hip")).toBe(
      true,
    );
    expect(
      model?.roofFeatures?.some((feature) => feature.kind === "valley"),
    ).toBe(true);
    expect(
      model?.roofFeatures?.every(
        (feature) =>
          feature.metadata?.roofGeometry === "rectilinear_joined_hipped",
      ),
    ).toBe(true);
    expect(model?.metadata?.roofGeometry).toBe("rectilinear_joined_hipped");
    expect(model?.metadata?.roofFacetMergeMode).toBe(
      "active_rectilinear_wavefront",
    );
    expect(model?.metadata?.roofFacetCount).toBe(model?.roofPlanes.length);
    expect(model?.metadata?.roofTopologyFinalFaceCount).toBe(
      model?.roofPlanes.length,
    );
    expect(model?.metadata?.roofTopologyDisconnectedSourceFaceCount).toBe(0);
    expect(Number(model?.metadata?.roofFacetCount ?? 0)).toBeLessThan(
      Number(model?.metadata?.roofSplitRegionCount ?? Number.POSITIVE_INFINITY),
    );
    expect(model?.metadata?.roofWingCount).toBeUndefined();
    expectRoofQaValid(model!);
    expectRoofFacetsInsideEave(model!, 2400);
    expectRoofBoundaryEavePointsAtEaveHeight(model!, 2400);
    expectNoInternalEaveHeightRoofSeams(model!, 2400);
    expectRoofFacetsCoverEaveOnce(model!);
    expectJoinedRoofFeaturesBackedByFinalFacets(model!);
    expect(
      model?.solids?.surfaceSolids.filter((solid) => solid.kind === "roof"),
    ).toHaveLength(model?.roofPlanes.length ?? 0);
    expect(model?.solids?.linearSolids).toHaveLength(4);
    expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectHouseRoofFeatureFlashings(model, ["ridge", "hip", "valley"]);
    expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectHouseGutterSolidsMiteredAroundCorners(model);
    expect(model?.attachmentTarget?.kind).toBe("plane");
    expect(model?.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-3");
  });

  it("uses ridge-axis and pyramid roof metadata for long, deep, and square footprints", () => {
    const wide = buildHouseModel3D({
      config: makeConfig({ footprint: makeFootprint(6000, 1800) }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const deep = buildHouseModel3D({
      config: makeConfig({ footprint: makeFootprint(1800, 6000) }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const square = buildHouseModel3D({
      config: makeConfig({ footprint: makeFootprint(4000, 4000) }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(
      wide?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === "x"),
    ).toBe(true);
    expect(
      deep?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === "y"),
    ).toBe(true);
    expect(
      square?.roofPlanes.every(
        (plane) => plane.metadata?.ridgeAxis === "pyramid",
      ),
    ).toBe(true);
    expect(
      square?.roofPlanes.every((plane) => plane.boundary.length === 3),
    ).toBe(true);
  });

  it("builds flat roofs for orthogonal L-shaped footprints without downgrading the roof form", () => {
    const lFootprint: Polygon3 = [
      { x: 0, y: -2400, z: 0 },
      { x: 4200, y: -2400, z: 0 },
      { x: 4200, y: -1200, z: 0 },
      { x: 6000, y: -1200, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: lFootprint,
        roofForm: "flat",
        roofPitchDeg: 0,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe("flat");
    expect(model?.metadata?.roofQaStatus).toBe("valid");
    expect(model?.roofPlanes).toHaveLength(1);
    expect(model?.roofFeatures).toHaveLength(0);
  });

  it("builds mono roofs with the selected shared fall direction", () => {
    const positiveX = buildHouseModel3D({
      config: makeConfig({
        roofForm: "mono",
        roofPrimaryFallDirection: "positive_x",
        roofPitchDeg: 10,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const negativeY = buildHouseModel3D({
      config: makeConfig({
        roofForm: "mono",
        roofPrimaryFallDirection: "negative_y",
        roofPitchDeg: 10,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(positiveX?.metadata?.roofForm).toBe("mono");
    expect(positiveX?.metadata?.roofQaStatus).toBe("valid");
    expect(positiveX?.roofPlanes[0]?.metadata?.roofPrimaryFallDirection).toBe(
      "positive_x",
    );
    expect((positiveX?.roofPlanes[0]?.fallVector.x ?? 0) > 0).toBe(true);
    expect((negativeY?.roofPlanes[0]?.fallVector.y ?? 0) < 0).toBe(true);
  });

  it("builds mono roofs for representative orthogonal non-straight footprints", () => {
    const footprints: Polygon3[] = [
      [
        { x: -1800, y: -1800, z: 0 },
        { x: 6000, y: -1800, z: 0 },
        { x: 6000, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 2400, z: 0 },
        { x: -1800, y: 2400, z: 0 },
      ],
      [
        { x: -1800, y: -1800, z: 0 },
        { x: 7800, y: -1800, z: 0 },
        { x: 7800, y: 2400, z: 0 },
        { x: 6000, y: 2400, z: 0 },
        { x: 6000, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 2400, z: 0 },
        { x: -1800, y: 2400, z: 0 },
      ],
      [
        { x: -1800, y: -1800, z: 0 },
        { x: 6000, y: -1800, z: 0 },
        { x: 6000, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1800, z: 0 },
        { x: 2400, y: 1800, z: 0 },
        { x: 2400, y: 3600, z: 0 },
        { x: -1800, y: 3600, z: 0 },
      ],
    ];

    for (const footprint of footprints) {
      const model = buildHouseModel3D({
        config: makeConfig({
          footprint,
          roofForm: "mono",
          roofPrimaryFallDirection: "positive_y",
          roofPitchDeg: 20,
        }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model?.metadata?.roofGeometry).toBe("footprint_mono");
      expect(model?.roofPlanes).toHaveLength(1);
      expectRoofQaValid(model!);
    }
  });

  it("builds valid house roof geometry for every preset and live roof form", () => {
    for (const preset of HOUSE_FOOTPRINT_PRESETS) {
      const footprint = buildHouseFootprintPolygon({
        pergolaWidthMm: 6000,
        pergolaDepthMm: 1800,
        preset,
        attachmentSide: "rear",
      });

      for (const roofForm of HOUSE_ROOF_FORMS) {
        const model = buildHouseModel3D({
          config: makeConfig({
            footprint,
            roofForm,
            roofPitchDeg: roofForm === "flat" ? 0 : 20,
            roofPrimaryFallDirection: "negative_y",
            roofRidgeAxis: "x",
          }),
          attachmentEdge: makeAttachmentEdge(),
        });

        expect(model, `${preset}/${roofForm} model`).not.toBeNull();
        if (!model) continue;
        expect(model.metadata?.roofForm).toBe(roofForm);
        expect(model.metadata?.roofGeometry).toBe(
          roofForm === "flat"
            ? "footprint_flat"
            : roofForm === "mono"
              ? "footprint_mono"
              : preset === "straight"
                ? "rectangular_hipped"
                : "rectilinear_joined_hipped",
        );
        expect(model.roofPlanes.length).toBeGreaterThan(0);
        expectRoofQaValid(model);
      }
    }
  });

  it("builds valid hipped roofs for every preset attachment-side rotation", () => {
    for (const attachmentSide of ATTACHMENT_SIDES) {
      for (const preset of HOUSE_FOOTPRINT_PRESETS) {
        const footprint = buildHouseFootprintPolygon({
          pergolaWidthMm: 6000,
          pergolaDepthMm: 1800,
          preset,
          attachmentSide,
        });

        for (const roofForm of ["hipped"] as const) {
          const model = buildHouseModel3D({
            config: makeConfig({
              footprint,
              attachmentSide,
              roofForm,
              roofPitchDeg: 20,
              roofRidgeAxis: "x",
            }),
            attachmentEdge: makeAttachmentEdge(),
          });

          expect(
            model,
            `${preset}/${attachmentSide}/${roofForm} model`,
          ).not.toBeNull();
          if (!model) continue;
          expect(model.metadata?.roofForm).toBe(roofForm);
          expect(
            model.metadata?.roofGeometry,
            `${preset}/${attachmentSide}/${roofForm} geometry`,
          ).not.toBeNull();
          expect(
            model.roofPlanes.length,
            `${preset}/${attachmentSide}/${roofForm} roof planes`,
          ).toBeGreaterThan(0);
          expectRoofQaValid(model);
        }
      }
    }
  });

  it("auto-heals zero hipped roof pitches to visible roof geometry", () => {
    for (const roofForm of ["hipped"] as const) {
      const model = buildHouseModel3D({
        config: makeConfig({
          footprint: makePresetFootprint("wrap_left"),
          roofForm,
          roofPitchDeg: 0,
          roofRidgeAxis: "x",
        }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model, roofForm).not.toBeNull();
      if (!model) continue;
      expect(model.roofPlanes.length, roofForm).toBeGreaterThan(0);
      expect(
        model.roofPlanes.every((plane) => plane.metadata?.pitchDeg === 5),
        roofForm,
      ).toBe(true);
      expectRoofQaValid(model);
    }
  });

  it("aligns mono wall tops to the roof plane without dropping below the wall height", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: "mono",
        roofPrimaryFallDirection: "positive_y",
        roofPitchDeg: 10,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    const rightWall = model?.wallSegments[1];
    expect(rightWall?.boundary).toHaveLength(4);
    expect(rightWall?.boundary[2]?.z ?? Number.NaN).toBeGreaterThan(2400);
    expect(rightWall?.boundary[3]?.z ?? Number.NaN).toBeGreaterThan(2400);
  });

  it("cleans up screenshot-style mono joins against the attachment-side facade edge", () => {
    const footprint: Polygon3 = [
      { x: -2800, y: 7200, z: 0 },
      { x: 8800, y: 7200, z: 0 },
      { x: 8800, y: 400, z: 0 },
      { x: 7000, y: 400, z: 0 },
      { x: 7000, y: 5400, z: 0 },
      { x: -1000, y: 5400, z: 0 },
      { x: -1000, y: 400, z: 0 },
      { x: -2800, y: 400, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        attachmentSide: "front",
        strategy: "fascia_under_gutter",
        roofForm: "mono",
        roofMaterial: "trapezoidal_5_rib",
        roofPitchDeg: 20,
        roofPrimaryFallDirection: "positive_y",
        eaveHeightMm: 2500,
        wallHeightMm: 2500,
        fasciaHeightMm: 300,
        eaveOverhangMm: 1000,
      }),
      attachmentEdge: makeAttachmentEdge(2500),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    const eavePolygon = eavePolygonFromModel(model);
    const joinEdge = model.eave.gutterLines?.find(
      (candidate) =>
        Math.abs(candidate.start.y - 5400) <= 1 &&
        Math.abs(candidate.end.y - 5400) <= 1 &&
        Math.abs(candidate.start.x - 7000) <= 1 &&
        Math.abs(candidate.end.x + 1000) <= 1,
    );
    const joinFascia = model.eave.fasciaPolygons?.find(
      (boundary) =>
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x - 7000) <= 1 &&
            Math.abs(candidate.y - 5400) <= 1,
        ) &&
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x + 1000) <= 1 &&
            Math.abs(candidate.y - 5400) <= 1,
        ),
    );
    const joinSoffit = model.eave.soffitPolygons?.find(
      (boundary) =>
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x - 7000) <= 1 &&
            Math.abs(candidate.y - 5400) <= 1,
        ) &&
        boundary.some(
          (candidate) =>
            Math.abs(candidate.x + 1000) <= 1 &&
            Math.abs(candidate.y - 5400) <= 1,
        ),
    );
    const roofMaterialVisual = model.roofMaterialVisuals?.[0];
    const soffitSolids =
      model.solids?.surfaceSolids.filter((solid) => solid.kind === "soffit") ??
      [];
    const roofSolid = model.solids?.surfaceSolids.find(
      (solid) => solid.kind === "roof",
    );
    const gutterSolids =
      model.solids?.linearSolids.filter((solid) => solid.kind === "gutter") ??
      [];
    const fasciaSolids =
      model.solids?.surfaceSolids.filter((solid) => solid.kind === "fascia") ??
      [];
    const joinedWall = model.wallSegments.find(
      (segment) => segment.sourceEdgeId === "footprint-edge-5",
    );
    const wallTopHeights = model.wallSegments.flatMap((segment) =>
      segment.boundary.slice(2).map((point) => point.z),
    );
    const monoPerimeterFlashings =
      model.roofFlashings?.filter(
        (flashing) => typeof flashing.metadata?.flashingRole === "string",
      ) ?? [];

    expectRoofQaValid(model);
    expect(model.metadata?.roofGeometry).toBe("footprint_mono");
    expect(model.metadata?.roofPrimaryFallDirection).toBe("positive_y");
    expect(
      model.solids?.surfaceSolids.filter((solid) => solid.kind === "roof"),
    ).toHaveLength(1);
    expect(joinEdge).toBeUndefined();
    expect(joinFascia).toBeUndefined();
    expect(joinSoffit).toBeUndefined();
    expect(eavePolygon[4]).toEqual({ x: 7000, y: 5400, z: 0 });
    expect(eavePolygon[5]).toEqual({ x: -1000, y: 5400, z: 0 });
    expect(model.attachmentTarget?.sourceEdgeId).toBe("footprint-edge-5");
    expect(model.attachmentTarget?.line).toEqual({
      start: { x: 0, y: 5400, z: 2500 },
      end: { x: 6000, y: 5400, z: 2500 },
    });
    expect(model.roofPlanes).toHaveLength(1);
    const joinBoundaryStart = model.roofPlanes[0]?.boundary.find(
      (candidate) =>
        Math.abs(candidate.x - 7000) <= 1 && Math.abs(candidate.y - 5400) <= 1,
    );
    const joinBoundaryEnd = model.roofPlanes[0]?.boundary.find(
      (candidate) =>
        Math.abs(candidate.x + 1000) <= 1 && Math.abs(candidate.y - 5400) <= 1,
    );
    expect(joinBoundaryStart).toBeDefined();
    expect(joinBoundaryEnd).toBeDefined();
    expect(joinBoundaryStart?.z ?? Number.NaN).toBeGreaterThan(2500);
    expect(joinBoundaryStart?.z).toBeCloseTo(
      joinBoundaryEnd?.z ?? Number.NaN,
      6,
    );
    expect(model.eave.gutterLines).toHaveLength(1);
    expect(model.eave.fasciaPolygons).toHaveLength(1);
    expect(model.eave.soffitPolygons).toHaveLength(1);
    expect(joinedWall?.boundary[2]?.z).toBeCloseTo(
      joinBoundaryEnd?.z ?? Number.NaN,
      6,
    );
    expect(joinedWall?.boundary[3]?.z).toBeCloseTo(
      joinBoundaryStart?.z ?? Number.NaN,
      6,
    );
    expect(Math.min(...wallTopHeights)).toBeGreaterThan(2500);
    expect(Math.max(...wallTopHeights)).toBeGreaterThan(3500);
    expect(model.eave.gutterLines![0]).toEqual({
      start: { x: -3800, y: 8200, z: 2500 },
      end: { x: 9800, y: 8200, z: 2500 },
    });
    expect(
      model.eave.soffitPolygons!.every(
        (boundary) => !polygonIsHorizontal(boundary),
      ),
    ).toBe(true);
    expect(
      soffitSolids.every(
        (solid) =>
          solid.metadata?.houseRoofEdgeKind === "drain_eave" &&
          solid.metadata?.houseRoofPerimeterRole === "drain_eave" &&
          solid.metadata?.houseRoofSoffitMode === "sloped_underroof" &&
          solid.metadata?.sourceRoofPlaneId === "house-roof-mono-1" &&
          solid.renderMesh === undefined &&
          !polygonIsHorizontal(solid.boundary),
      ),
    ).toBe(true);
    expect(
      gutterSolids.map((solid) => solid.metadata?.houseRoofPerimeterRole),
    ).toEqual(["drain_eave"]);
    expect(
      fasciaSolids.map((solid) => solid.metadata?.houseRoofPerimeterRole),
    ).toEqual(["drain_eave"]);
    expect(
      monoPerimeterFlashings.map((flashing) => flashing.metadata?.sourceEdgeId),
    ).toEqual([
      "footprint-edge-2",
      "footprint-edge-3",
      "footprint-edge-4",
      "footprint-edge-5",
      "footprint-edge-6",
      "footprint-edge-7",
      "footprint-edge-8",
    ]);
    expect(
      monoPerimeterFlashings.find(
        (flashing) => flashing.metadata?.sourceEdgeId === "footprint-edge-5",
      )?.metadata,
    ).toMatchObject({
      flashingRole: "house_apron",
      houseRoofPerimeterRole: "house_apron_edge",
      flashingTreatment: "house_perimeter_folded",
      position: "house_apron",
      roofGeometry: "footprint_mono",
    });
    expect(
      monoPerimeterFlashings.every((flashing) => flashing.wings.length === 2),
    ).toBe(true);
    expect(
      monoPerimeterFlashings.every((flashing) => {
        const sourceEdgeId = String(flashing.metadata?.sourceEdgeId ?? "");
        const sourceEdge = sourceEdgeLineFromModel(model, sourceEdgeId);
        if (!sourceEdge) return false;
        return flashing.wings.every((wing) =>
          wing.boundary.every(
            (candidate) =>
              pointDistanceToSegment2D(
                candidate,
                sourceEdge.start,
                sourceEdge.end,
              ) <= 1600,
          ),
        );
      }),
    ).toBe(true);
    expect(
      monoPerimeterFlashings
        .filter((flashing) => flashing.metadata?.position === "high_side")
        .map((flashing) => flashing.metadata?.sourceEdgeId),
    ).toEqual(["footprint-edge-3", "footprint-edge-7"]);
    const roofNormal = normalizeVector3(model.roofPlanes[0]!.plane.normal);
    expect(
      countRenderMeshFacesAlignedToNormal(
        roofSolid?.renderMesh,
        roofNormal.z >= 0
          ? { x: -roofNormal.x, y: -roofNormal.y, z: -roofNormal.z }
          : roofNormal,
      ),
    ).toBe(0);
    expect(countRenderMeshVerticalFaces(roofSolid?.renderMesh)).toBe(2);
    expect(roofMaterialVisual?.lines.length ?? 0).toBeGreaterThan(0);
    expect(
      roofMaterialVisual?.lines.every(
        (candidate) =>
          Number.isFinite(candidate.start.x) &&
          Number.isFinite(candidate.start.y) &&
          Number.isFinite(candidate.start.z) &&
          Number.isFinite(candidate.end.x) &&
          Number.isFinite(candidate.end.y) &&
          Number.isFinite(candidate.end.z),
      ),
    ).toBe(true);
  });
});
