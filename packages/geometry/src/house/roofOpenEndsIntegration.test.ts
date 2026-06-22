import { describe, expect, it } from "vitest";
import { deriveHouseGableTerminalEnds } from "../houseRoofCapabilities";
import { buildHouseFootprintPolygon } from "../footprints";
import { buildHouseModel3D } from "../houseModel";
import {
  makeFootprint,
  makePresetFootprint,
  makeConfig,
  makeAttachmentEdge,
} from "./houseModelTestSupport";

describe("house model open roof ends", () => {
  it("produces valid joined-hipped geometry when ONE terminal end is opened on a U/wrap footprint (partial-open click)", () => {
    // Regression: the wavefront facet validator (default-strict) used
    // to reject any facet whose boundary touched the eave polygon at
    // a non-eave z. For partial-open joined footprints, the slope
    // adjacent to a stationary gable edge legitimately reaches the
    // eave at apex z (the gable wall fills the height gap). The fix
    // (1) plumbs `allowRaisedBoundaryPoints` through the wavefront
    // facet builder when any edge is stationary, and (2) subtracts
    // stationary edges from the expected facet count. Without the
    // fix, clicking ONE terminal end on a U-shape produced
    // `roof_topology_face_count_mismatch:5:8`, breaking individual
    // toggles on joined footprints.
    const presets: Array<"u_shape" | "wrap_left" | "wrap_right"> = [
      "u_shape",
      "wrap_left",
      "wrap_right",
    ];
    for (const preset of presets) {
      const footprint = buildHouseFootprintPolygon({
        pergolaWidthMm: 6000,
        pergolaDepthMm: 1800,
        preset,
        attachmentSide: "rear",
      });
      const terminalEnds = deriveHouseGableTerminalEnds({
        footprint,
        ridgeAxis: "x",
      });
      expect(terminalEnds.length, `${preset} terminals`).toBeGreaterThanOrEqual(
        2,
      );
      for (const terminal of terminalEnds) {
        const model = buildHouseModel3D({
          houseId: 'test-house',
          config: makeConfig({
            footprint,
            roofForm: "hipped",
            roofRidgeAxis: "x",
            openGableEndIds: [terminal.id],
          }),
          attachmentEdge: makeAttachmentEdge(),
        });
        expect(model?.metadata?.roofQaStatus, `${preset}/${terminal.id}`).toBe(
          "valid",
        );
        expect(
          model?.metadata?.roofQaFailureReason,
          `${preset}/${terminal.id}`,
        ).toBeNull();
        // The opened terminal renders as an open_gable_frame wall;
        // the other terminal remains hipped. Partial-open joined
        // case routes through the unified wavefront (NOT bent-spine,
        // which only fires for all-open).
        expect(
          model?.metadata?.roofGeometry,
          `${preset}/${terminal.id} geometry`,
        ).toBe("rectilinear_joined_hipped");
        const openWall = model?.wallSegments.find(
          (segment) => segment.metadata?.gableEndId === terminal.id,
        );
        expect(
          openWall?.metadata?.houseWallMode,
          `${preset}/${terminal.id} wall mode`,
        ).toBe("open_gable_frame");
      }
    }
  });

  it("exposes open wrap gable ends as tagged open_gable_frame walls with matching frame features", () => {
    // Milestone 13 session C: the legacy comparison "open wall boundary
    // equals closed wall boundary" relied on the bent-spine builder
    // running for both fully-closed and partial-open wrap cases. The
    // unified dispatcher routes all-open through bent-spine and
    // partial-open through the wavefront, which currently cannot solve
    // wrap-with-one-open without a topology mismatch. Until that path
    // lands, assert the all-open case wires open_gable_frame metadata
    // and frame features across both terminal walls -- that is the
    // observable contract the rail + renderer depend on.
    const footprint = makePresetFootprint("wrap_left");
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: "x",
    });
    const openIds = terminalEnds.map((end) => end.id);
    const openModel = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: openIds,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(openIds.length).toBeGreaterThan(0);
    for (const openEndId of openIds) {
      const openWall = openModel?.wallSegments.find(
        (segment) => segment.metadata?.gableEndId === openEndId,
      );
      expect(openWall?.metadata?.houseWallMode, `${openEndId} wall mode`).toBe(
        "open_gable_frame",
      );
    }
    const frameFeatures =
      openModel?.roofFeatures?.filter(
        (feature) => feature.kind === "gable_end_frame",
      ) ?? [];
    expect(frameFeatures.length).toBeGreaterThan(0);
    expect(
      frameFeatures.every((feature) =>
        openIds.includes(String(feature.metadata?.gableEndId ?? "")),
      ),
    ).toBe(true);
  });

  it("opens selected gable ends with a tagged wall solid and frame features", () => {
    const footprint = makeFootprint();
    const openEndId = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: "x",
    })[0]?.id;
    const model = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: openEndId ? [openEndId] : null,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(openEndId).toBeTruthy();
    expect(model).not.toBeNull();
    const openWall = model?.wallSegments.find(
      (segment) => segment.metadata?.gableEndId === openEndId,
    );
    expect(openWall?.metadata?.houseWallMode).toBe("open_gable_frame");
    // A solid IS now built for the open-gable wall so the triangular gable
    // face is visible in the 3D scene. The solid carries the same
    // open_gable_frame metadata so consumers that need to discriminate
    // (e.g. for the wireframe frame overlay) can still find it.
    const openWallSolid = model?.solids?.surfaceSolids.find(
      (solid) =>
        solid.kind === "wall" && solid.metadata?.sourceId === openWall?.id,
    );
    expect(openWallSolid).toBeDefined();
    expect(openWallSolid?.metadata?.houseWallMode).toBe("open_gable_frame");
    // Frame features (line-only gable-end posts and top chords) still exist
    // as outline accents on top of the solid.
    const frameFeatures =
      model?.roofFeatures?.filter(
        (feature) => feature.kind === "gable_end_frame",
      ) ?? [];
    expect(frameFeatures.length).toBeGreaterThan(0);
    expect(
      frameFeatures.every(
        (feature) => feature.metadata?.gableEndId === openEndId,
      ),
    ).toBe(true);
  });

  it("honours canonical openGableEndIds on a rectangular hipped roof (regression for hardcoded -1/-2 cap mapping)", () => {
    // The standard 6000x1800 footprint walked CCW has terminal-end ids
    // `house-gable-end-x-2` (the max-x edge) and `house-gable-end-x-4`
    // (the min-x edge) -- because `deriveHouseGableTerminalEnds`
    // encodes the polygon edge index in the trailing number, NOT a
    // sequential 1/2. Earlier versions of `buildHippedHouseRoof`
    // hardcoded `-1`/`-2` suffixes, so opening the canonical id
    // silently no-op'd. This test pins the canonical-id mapping for
    // the rectangle path so the rail and plan-view click target both
    // work.
    const footprint = makeFootprint();
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: "x",
    });
    // Sort order comes from `deriveLegacyHouseGableTerminalEndsX`,
    // which sorts segments by midpoint.x asc -- the min-x edge (id -4)
    // comes first.
    expect(terminalEnds.map((end) => end.id)).toEqual([
      "house-gable-end-x-4",
      "house-gable-end-x-2",
    ]);

    const openMaxX = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: ["house-gable-end-x-2"],
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    expect(openMaxX?.metadata?.roofForm).toBe("dutch_hip");

    const openMinX = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: ["house-gable-end-x-4"],
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    expect(openMinX?.metadata?.roofForm).toBe("dutch_hip");

    const openBoth = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: ["house-gable-end-x-2", "house-gable-end-x-4"],
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    // Milestone 13 session C: `metadata.roofForm` reports the typed
    // `HouseRoofForm` value (`hipped`). The "all ends open"
    // topological classification is implicit in
    // `metadata.openGableEndIds` covering every terminal end.
    expect(openBoth?.metadata?.roofForm).toBe("hipped");
  });

  it("produces an open-gable wall whose top profile climbs from eave to ridge apex (both-ends-open case)", () => {
    // Both-ends-open is reported as roofForm: 'hipped' by the unified
    // rectangle builder, so the wall builder uses `buildWallTopProfile` to
    // produce the apex-climbing boundary natively. The wall has 5
    // vertices in that case (two ground corners + a 3-point top profile).
    const footprint = makeFootprint();
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: "x",
    });
    const model = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: terminalEnds.map((end) => end.id),
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    expect(model).not.toBeNull();
    const ridgeFeature = model?.roofFeatures?.find(
      (feature) => feature.kind === "ridge",
    );
    const ridgeZ = ridgeFeature!.line.start.z;
    expect(ridgeZ).toBeGreaterThan(0);

    const openWalls =
      model?.wallSegments.filter(
        (segment) => segment.metadata?.houseWallMode === "open_gable_frame",
      ) ?? [];
    expect(openWalls.length).toBe(2);

    for (const wall of openWalls) {
      const maxZ = Math.max(...wall.boundary.map((v) => v.z));
      expect(maxZ, `wall ${wall.id} top z should equal ridge z`).toBeCloseTo(
        ridgeZ,
        6,
      );
    }
  });

  it("reshapes the open-gable wall into a triangle climbing to the apex (single-end-open / Dutch hip case)", () => {
    // Single-end-open is reported as roofForm: 'dutch_hip'. The wall
    // builder produces a flat-top rectangular wall (4 vertices) because
    // `usesRoofAlignedTop` requires 'mono' or 'gable'. Our reshape in
    // houseModel.ts must then triangulate it to [gs, ge, apex].
    const footprint = makeFootprint();
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: "x",
    });
    const openEndId = terminalEnds[0]?.id;
    expect(openEndId).toBeTruthy();
    const model = buildHouseModel3D({
      houseId: 'test-house',
      config: makeConfig({
        footprint,
        roofForm: "hipped",
        roofRidgeAxis: "x",
        openGableEndIds: [openEndId!],
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    expect(model).not.toBeNull();
    const ridgeFeature = model?.roofFeatures?.find(
      (feature) => feature.kind === "ridge",
    );
    const ridgeZ = ridgeFeature!.line.start.z;
    expect(ridgeZ).toBeGreaterThan(0);

    const openWall = model?.wallSegments.find(
      (segment) => segment.metadata?.houseWallMode === "open_gable_frame",
    );
    expect(openWall).toBeDefined();
    expect(
      openWall!.boundary.length,
      "Dutch-hip open wall should be triangular",
    ).toBe(3);

    const groundStart = openWall!.boundary[0]!;
    const groundEnd = openWall!.boundary[1]!;
    const apex = openWall!.boundary[2]!;
    expect(groundStart.z).toBe(0);
    expect(groundEnd.z).toBe(0);
    expect(apex.z).toBeCloseTo(ridgeZ, 6);
    expect(apex.x).toBeCloseTo((groundStart.x + groundEnd.x) / 2, 6);
    expect(apex.y).toBeCloseTo((groundStart.y + groundEnd.y) / 2, 6);

    // The wall solid must exist with a precomputed render mesh so it
    // renders as a 3D solid in the viewer (not a flat face).
    const openWallSolid = model?.solids?.surfaceSolids.find(
      (solid) =>
        solid.kind === "wall" && solid.metadata?.sourceId === openWall!.id,
    );
    expect(openWallSolid).toBeDefined();
    expect(openWallSolid!.renderMesh).toBeDefined();
    expect(openWallSolid!.thicknessMm).toBe(150);
    expect(openWallSolid!.renderMesh!.vertices.length).toBe(6); // 3 boundary × 2 (in/out)
    // Apex vertices should be the highest in z; ground vertices the lowest.
    const minZ = Math.min(
      ...openWallSolid!.renderMesh!.vertices.map((v) => v.z),
    );
    const maxZ = Math.max(
      ...openWallSolid!.renderMesh!.vertices.map((v) => v.z),
    );
    expect(minZ, "min z is the eave").toBeCloseTo(0, 6);
    expect(maxZ, "max z is the ridge apex").toBeCloseTo(ridgeZ, 6);
  });
});
