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

describe("house model joined roof topology", () => {
  it("keeps screenshot-style U roof facets inside the eave polygon void", () => {
    const footprint: Polygon3 = [
      { x: -1000, y: 9000, z: 0 },
      { x: 9000, y: 9000, z: 0 },
      { x: 9000, y: 5000, z: 0 },
      { x: 6000, y: 5000, z: 0 },
      { x: 6000, y: 6500, z: 0 },
      { x: 2000, y: 6500, z: 0 },
      { x: 2000, y: 5000, z: 0 },
      { x: -1000, y: 5000, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        attachmentSide: "front",
        strategy: "fascia_under_gutter",
        eaveHeightMm: 2500,
        wallHeightMm: 2500,
        roofPitchDeg: 20,
        fasciaHeightMm: 300,
        eaveOverhangMm: 1000,
      }),
      attachmentEdge: {
        start: { x: 0, y: 0, z: 2500 },
        end: { x: 6000, y: 0, z: 2500 },
      },
    });

    expect(model?.metadata?.roofGeometry).toBe("rectilinear_joined_hipped");
    expect(model?.metadata?.roofTopologySolver).toBe("eave_graph_source_edge_envelope");
    expect(model?.metadata?.roofFacetMergeMode).toBe("source_edge_envelope");
    expect(model?.metadata?.roofRejectedFacetCount).toBe(0);
    expect(model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expectRoofQaValid(model!);
    expect(model?.roofPlanes.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(model?.metadata?.roofTopologyFinalFaceCount).toBe(
      model?.roofPlanes.length,
    );
    expect(model?.metadata?.roofTopologyDiagnosticPlaneCount).toBeGreaterThan(
      model?.roofPlanes.length ?? 0,
    );
    expect(model?.metadata?.roofTopologySourceEdgeCount).toBe(8);
    expect(model?.metadata?.roofTopologyFailureReason).toBeNull();
    expect(model?.metadata?.roofTopologyValleyCount).toBe(2);
    expect(String(model?.metadata?.roofTopologyFailureReason ?? "")).not.toContain(
      "unclosed_boundary_graph",
    );
    expect(
      model?.roofPlanes.every((plane) => !plane.id.includes("house-roof-wing")),
    ).toBe(true);
    expect(
      model?.roofPlanes.every((plane) => Number.isFinite(plane.boundary[0]?.x)),
    ).toBe(true);
    expect(model?.roofFeatures?.map((feature) => feature.kind)).toEqual(
      expect.arrayContaining(["ridge", "hip", "valley"]),
    );
    expectRoofFacetsInsideEave(model!, 2500);
    expectRoofBoundaryEavePointsAtEaveHeight(model!, 2500);
    expectNoInternalEaveHeightRoofSeams(model!, 2500);
    expectRoofFacetsCoverEaveOnce(model!);
    expectJoinedRoofFeaturesBackedByFinalFacets(model!);
    expectValleysStartAtReentrantCorners(model!, 2500, 2);
    expect(
      model?.solids?.surfaceSolids.filter((solid) => solid.kind === "roof"),
    ).toHaveLength(model?.roofPlanes.length ?? 0);
    expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model!);
    expectHouseRoofFeatureFlashings(model!, ["ridge", "hip", "valley"]);
  });

  it("omits house roof feature flashings when roof QA rejects the roof geometry", () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: [
          { x: 0, y: 0, z: 0 },
          { x: 6000, y: 0, z: 0 },
          { x: Number.NaN, y: 1800, z: 0 },
          { x: 0, y: 1800, z: 0 },
        ],
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    expect(model?.metadata?.roofQaStatus).toBe("invalid");
    expect(model?.metadata?.roofQaFailureReason).toBe("invalid_eave_polygon");
    expect(model?.roofFeatures?.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(model?.roofFlashings).toEqual([]);
  });

  it("keeps side-attached L roof features backed by the final joined facets", () => {
    const footprint: Polygon3 = [
      { x: -2600, y: 0, z: 0 },
      { x: -2600, y: 3500, z: 0 },
      { x: -1600, y: 3500, z: 0 },
      { x: -1600, y: 2000, z: 0 },
      { x: -400, y: 2000, z: 0 },
      { x: -400, y: 0, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        attachmentSide: "left",
        strategy: "soffit_brackets",
        eaveHeightMm: 2500,
        wallHeightMm: 2800,
        roofPitchDeg: 20,
        eaveOverhangMm: 600,
      }),
      attachmentEdge: makeAttachmentEdge(2500),
    });

    expect(model?.metadata?.roofGeometry).toBe("rectilinear_joined_hipped");
    expect(model?.metadata?.roofTopologySolver).toBe("eave_graph_source_edge_envelope");
    expect(model?.metadata?.roofFacetMergeMode).toBe("source_edge_envelope");
    expect(model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expectRoofQaValid(model!);
    expect(model?.metadata?.roofTopologyFailureReason).toBeNull();
    expect(
      model?.roofPlanes.every((plane) => !plane.id.includes("house-roof-wing")),
    ).toBe(true);
    expect(model?.roofFeatures?.map((feature) => feature.kind)).toEqual(
      expect.arrayContaining(["ridge", "hip", "valley"]),
    );
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: -400, y: 0, z: 2500 },
      end: { x: -400, y: 2000, z: 2500 },
    });
    expectRoofFacetsInsideEave(model!, 2500);
    expectRoofBoundaryEavePointsAtEaveHeight(model!, 2500);
    expectNoInternalEaveHeightRoofSeams(model!, 2500);
    expectRoofFacetsCoverEaveOnce(model!);
    expectJoinedRoofFeaturesBackedByFinalFacets(model!);
  });

  it("builds joined orthogonal gable roofs instead of blocking supported topology", () => {
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
        roofForm: "hipped",
        roofRidgeAxis: "x",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe("hipped");
    expect(model?.metadata?.roofQaStatus).toBe("valid");
    // The unified Dutch-hip pipeline reports its geometry as
    // `rectilinear_joined_hipped` even for the all-ends-open shape
    // that legacy gable produced. The metadata is a topology label,
    // not the user-facing form.
    expect(model?.metadata?.roofGeometry).toBe("rectilinear_joined_hipped");
    expect((model?.roofPlanes.length ?? 0) > 1).toBe(true);
    expect(
      model?.roofFeatures?.some((feature) => feature.kind === "ridge"),
    ).toBe(true);
    expect(
      model?.roofFeatures?.some((feature) => feature.kind === "valley"),
    ).toBe(true);
  });

  it("builds a bent-spine joined gable for U footprints and exposes only the outer end frames", () => {
    const uFootprint: Polygon3 = [
      { x: -1800, y: -1800, z: 0 },
      { x: 7800, y: -1800, z: 0 },
      { x: 7800, y: 2400, z: 0 },
      { x: 6000, y: 2400, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 2400, z: 0 },
      { x: -1800, y: 2400, z: 0 },
    ];
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint: uFootprint,
      ridgeAxis: "x",
    });
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: uFootprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: terminalEnds.map((end) => end.id),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(terminalEnds.map((end) => end.sourceEdgeId)).toEqual([
      "footprint-edge-7",
      "footprint-edge-3",
    ]);
    expect(model?.metadata?.roofQaStatus).toBe("valid");
    expect(model?.metadata?.roofGeometry).toBe("bent_spine_joined_gable");
    const ridges =
      model?.roofFeatures?.filter((feature) => feature.kind === "ridge") ?? [];
    expect(ridges).toHaveLength(3);
    expect(
      ridges.every(
        (feature) =>
          feature.line.start.x === feature.line.end.x ||
          feature.line.start.y === feature.line.end.y,
      ),
    ).toBe(true);
  });

  it("builds peaked gable end wall profiles for bent-spine U footprints", () => {
    const uFootprint: Polygon3 = [
      { x: -1800, y: -1800, z: 0 },
      { x: 7800, y: -1800, z: 0 },
      { x: 7800, y: 2400, z: 0 },
      { x: 6000, y: 2400, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 2400, z: 0 },
      { x: -1800, y: 2400, z: 0 },
    ];
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint: uFootprint,
      ridgeAxis: "y",
    });
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: uFootprint,
        roofForm: "hipped",
        roofRidgeAxis: "y",
        openGableEndIds: terminalEnds.map((end) => end.id),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofGeometry).toBe("bent_spine_joined_gable");
    const terminalWalls = (model?.wallSegments ?? []).filter((wall) =>
      terminalEnds.some(
        (terminalEnd) => terminalEnd.sourceEdgeId === wall.sourceEdgeId,
      ),
    );
    expect(terminalWalls.length).toBe(terminalEnds.length);
    for (const wall of terminalWalls) {
      const topProfile = wall.boundary.slice(2).reverse();
      expect(topProfile.length).toBeGreaterThanOrEqual(3);
      const endpointRise = Math.max(
        topProfile[0]!.z,
        topProfile[topProfile.length - 1]!.z,
      );
      const interiorPeak = Math.max(
        ...topProfile.slice(1, -1).map((point3) => point3.z),
      );
      expect(interiorPeak).toBeGreaterThan(endpointRise);
    }
  });

  it("keeps the ridge-y rear bridge joined to the bent spine without a floating center gable", () => {
    const uFootprint: Polygon3 = [
      { x: -1800, y: -1800, z: 0 },
      { x: 7800, y: -1800, z: 0 },
      { x: 7800, y: 2400, z: 0 },
      { x: 6000, y: 2400, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 2400, z: 0 },
      { x: -1800, y: 2400, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: uFootprint,
        roofForm: "hipped",
        roofRidgeAxis: "y",
        openGableEndIds: allTerminalEndIdsForHippedConfig(uFootprint, "y"),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofGeometry).toBe("bent_spine_joined_gable");
    expect(model?.metadata?.roofQaStatus).toBe("valid");
    expect(model?.metadata?.roofFacetMergeMode).toBe(
      "active_rectilinear_wavefront_bent_spine",
    );
    expect(
      model?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === "y"),
    ).toBe(true);
    expect(model?.metadata?.roofTerminalClosureCount).toBe(2);

    const terminalSourceEdgeIds = deriveHouseGableTerminalEnds({
      footprint: uFootprint,
      ridgeAxis: "y",
    }).map((terminalEnd) =>
      terminalEnd.sourceEdgeId.replace("footprint-edge-", "house-eave-edge-"),
    );
    expect(
      (model?.roofPlanes ?? []).some((plane) =>
        terminalSourceEdgeIds.includes(
          String(plane.metadata?.sourceEdgeId ?? ""),
        ),
      ),
    ).toBe(false);
    const ridgeFeatures = (model?.roofFeatures ?? []).filter(
      (feature) => feature.kind === "ridge",
    );

    const ridgeZMax = Math.max(
      ...ridgeFeatures.flatMap((feature) => [
        feature.line.start.z,
        feature.line.end.z,
      ]),
    );
    const planeZMax = Math.max(
      ...(model?.roofPlanes ?? []).flatMap((plane) =>
        plane.boundary.map((point3) => point3.z),
      ),
    );
    expect(planeZMax).toBeLessThanOrEqual(ridgeZMax + 1e-6);
  });

  it("limits joined U gable eave packages to the true draining perimeter edges", () => {
    const uFootprint: Polygon3 = [
      { x: -1800, y: -1800, z: 0 },
      { x: 7800, y: -1800, z: 0 },
      { x: 7800, y: 2400, z: 0 },
      { x: 6000, y: 2400, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 2400, z: 0 },
      { x: -1800, y: 2400, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: uFootprint,
        roofForm: "hipped",
        roofRidgeAxis: "y",
        openGableEndIds: allTerminalEndIdsForHippedConfig(uFootprint, "y"),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    const gutterEdgeIds = (model?.solids?.linearSolids ?? [])
      .filter((solid) => solid.kind === "gutter")
      .map((solid) => solid.metadata?.sourceEdgeId)
      .sort();
    const fasciaEdgeIds = (model?.solids?.surfaceSolids ?? [])
      .filter((solid) => solid.kind === "fascia")
      .map((solid) => solid.metadata?.sourceEdgeId)
      .sort();
    const soffitEdgeIds = (model?.solids?.surfaceSolids ?? [])
      .filter((solid) => solid.kind === "soffit")
      .map((solid) => solid.metadata?.sourceEdgeId)
      .sort();

    expect(model?.metadata?.roofGeometry).toBe("bent_spine_joined_gable");
    expect(model?.metadata?.roofQaStatus).toBe("valid");
    expect(gutterEdgeIds).toEqual([
      "footprint-edge-1",
      "footprint-edge-2",
      "footprint-edge-4",
      "footprint-edge-6",
      "footprint-edge-8",
    ]);
    expect(fasciaEdgeIds).toEqual(gutterEdgeIds);
    expect(soffitEdgeIds).toEqual(gutterEdgeIds);
    expect(gutterEdgeIds).not.toContain("footprint-edge-3");
    expect(gutterEdgeIds).not.toContain("footprint-edge-5");
    expect(gutterEdgeIds).not.toContain("footprint-edge-7");
  });

  it("builds bent-spine joined gables for wrap presets with explicit terminal closure metadata", () => {
    const presets: Array<"wrap_left" | "wrap_right"> = [
      "wrap_left",
      "wrap_right",
    ];

    for (const preset of presets) {
      const footprint = makePresetFootprint(preset);
      const terminalEnds = deriveHouseGableTerminalEnds({
        footprint,
        ridgeAxis: "x",
      });
      const model = buildHouseModel3D({
        config: makeConfig({
          footprint,
          roofForm: "hipped",
          roofRidgeAxis: "x",
          openGableEndIds: terminalEnds.map((end) => end.id),
        }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model?.metadata?.roofGeometry).toBe("bent_spine_joined_gable");
      expect(model?.metadata?.roofQaStatus).toBe("valid");
      expect(model?.metadata?.roofTerminalClosureCount).toBe(2);
      expect(
        (model?.roofFeatures ?? []).filter(
          (feature) => feature.kind === "ridge",
        ),
      ).toHaveLength(3);
      expect(
        (model?.roofFeatures ?? []).filter(
          (feature) => feature.kind === "valley",
        ),
      ).toHaveLength(2);

      const terminalWalls = (model?.wallSegments ?? []).filter((wall) =>
        terminalEnds.some(
          (terminalEnd) => terminalEnd.sourceEdgeId === wall.sourceEdgeId,
        ),
      );
      expect(terminalWalls).toHaveLength(2);
      expect(
        terminalWalls.every(
          (wall) => wall.metadata?.houseWallClosureKind === "terminal_gable",
        ),
      ).toBe(true);
      for (const wall of terminalWalls) {
        const topProfile = wall.boundary.slice(2).reverse();
        expect(topProfile.length).toBeGreaterThanOrEqual(3);
        const endpointRise = Math.max(
          topProfile[0]!.z,
          topProfile[topProfile.length - 1]!.z,
        );
        const interiorPeak = Math.max(
          ...topProfile.slice(1, -1).map((point3) => point3.z),
        );
        expect(interiorPeak).toBeGreaterThan(endpointRise);
      }

      const closurePlanes = (model?.roofPlanes ?? []).filter(
        (plane) => plane.metadata?.roofTerminalClosureFacet === true,
      );
      expect(closurePlanes.length).toBeGreaterThan(0);
      expect(
        closurePlanes.some((plane) =>
          String(
            plane.metadata?.roofTerminalClosureSourceEdgeIds ?? "",
          ).includes(terminalEnds[0]!.sourceEdgeId),
        ),
      ).toBe(true);
      expect(
        closurePlanes.some((plane) =>
          String(
            plane.metadata?.roofTerminalClosureSourceEdgeIds ?? "",
          ).includes(terminalEnds[1]!.sourceEdgeId),
        ),
      ).toBe(true);
    }
  });

  it("builds roof-aligned gable end walls with a ridge apex on the selected axis", () => {
    const footprint = makeFootprint();
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        roofPitchDeg: 15,
        openGableEndIds: allTerminalEndIdsForHippedConfig(footprint, "x"),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    // Milestone 13 session C: the rectangular all-open case (legacy
    // gable form) is reshaped to a 3-point triangle [groundStart,
    // groundEnd, apex] in `buildHouseModel3D` instead of the legacy
    // 5-point gable wall. Visually identical when wallHeight ==
    // eaveHeight (the default for this fixture).
    const gableEndWall = model?.wallSegments[1];
    expect(gableEndWall?.boundary).toHaveLength(3);
    const [groundStart, groundEnd, apex] = gableEndWall?.boundary ?? [];
    expect(groundStart?.z).toBe(0);
    expect(groundEnd?.z).toBe(0);
    expect((apex?.z ?? 0) > 2400).toBe(true);
    expect(apex?.x).toBeCloseTo(
      ((groundStart?.x ?? 0) + (groundEnd?.x ?? 0)) / 2,
      6,
    );
    expect(apex?.y).toBeCloseTo(
      ((groundStart?.y ?? 0) + (groundEnd?.y ?? 0)) / 2,
      6,
    );
  });

  it("blocks unsupported hipped topology instead of falling back to a bounding box roof", () => {
    const nonOrthogonal: Polygon3 = [
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1600, z: 0 },
      { x: 5600, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: nonOrthogonal,
        roofForm: "hipped",
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe("hipped");
    expect(model?.metadata?.roofQaStatus).toBe("invalid");
    expect(model?.metadata?.roofQaFailureReason).toBe(
      "unsupported_hipped_topology",
    );
    expect(model?.roofPlanes).toHaveLength(0);
  });

  // PR-T8 (2026-05-29): Four appendage-band tests removed with the
  // appendage feature cull (one shared band; host-run span; unsupported
  // host edge; no continuous exterior host run).
});
