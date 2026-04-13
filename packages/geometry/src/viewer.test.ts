import { describe, expect, it } from "vitest";
import {
  buildViewerSceneModel,
  solveAssembly3D,
  type GeometryConfig,
  type HouseAttachmentStrategy,
  type Polygon3,
  type ViewerSceneObject,
} from "@sp/geometry";
import { getGeometryFixtureCase } from "./fixtures";

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== "supported") {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

function makeHouseFootprint(lengthMm: number, depthMm = 1800): Polygon3 {
  return [
    { x: 0, y: -depthMm, z: 0 },
    { x: lengthMm, y: -depthMm, z: 0 },
    { x: lengthMm, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
}

function makePlacedHouseFootprint(input: { offsetX: number; width: number; facadeY: number; depth: number }): Polygon3 {
  return [
    { x: input.offsetX, y: input.facadeY - input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY - input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY, z: 0 },
    { x: input.offsetX, y: input.facadeY, z: 0 },
  ];
}

function makeFrontHouseFootprint(input: { offsetX: number; width: number; facadeY: number; depth: number }): Polygon3 {
  return [
    { x: input.offsetX, y: input.facadeY + input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY + input.depth, z: 0 },
    { x: input.offsetX + input.width, y: input.facadeY, z: 0 },
    { x: input.offsetX, y: input.facadeY, z: 0 },
  ];
}

function makeLeftHouseFootprint(input: { offsetY: number; width: number; facadeX: number; depth: number }): Polygon3 {
  return [
    { x: input.facadeX - input.depth, y: input.offsetY, z: 0 },
    { x: input.facadeX - input.depth, y: input.offsetY + input.width, z: 0 },
    { x: input.facadeX, y: input.offsetY + input.width, z: 0 },
    { x: input.facadeX, y: input.offsetY, z: 0 },
  ];
}

function pointsForViewerObject(object: ViewerSceneObject) {
  if (object.type === "member_prism") {
    return [object.centerline.start, object.centerline.end];
  }
  if (object.type === "roof_plane" || object.type === "roof_cladding_panel") {
    return object.boundary;
  }
  if (object.type === "roof_flashing") {
    return object.wings.flatMap((wing) => wing.boundary);
  }
  if (object.type === "reference_line" || object.type === "house_line") {
    return [object.line.start, object.line.end];
  }
  if (object.type === "house_surface_solid") {
    return object.boundary;
  }
  if (object.type === "house_linear_solid") {
    return [object.centerline.start, object.centerline.end];
  }
  return object.boundary;
}

function addHouseModelContext(
  config: GeometryConfig,
  input: {
    lengthMm: number;
    eaveHeightMm: number;
    strategy?: HouseAttachmentStrategy;
    footprint?: Polygon3;
  },
): GeometryConfig {
  const footprint = input.footprint ?? makeHouseFootprint(input.lengthMm);
  const strategy = input.strategy ?? "fascia_under_gutter";

  return {
    ...config,
    houseContext: {
      ...config.houseContext,
      footprint,
      attachmentStrategy: strategy,
      model: {
        footprint,
        storeyMode: "single_storey",
        wallConstruction: "timber_frame",
        roofForm: "hipped",
        eaveHeightMm: input.eaveHeightMm,
        wallHeightMm: input.eaveHeightMm,
        roofPitchDeg: 25,
        attachmentStrategy: strategy,
        eave: {
          soffitDepthMm: 450,
          fasciaHeightMm: 180,
          gutterWidthMm: 125,
          gutterDepthMm: 90,
          gutterProjectionMm: 125,
          eaveOverhangMm: 450,
        },
      },
    },
  };
}

describe("buildViewerSceneModel", () => {
  it("produces deterministic layer grouping for mono, gable, and box assemblies", () => {
    const fixtureIds = {
      mono_attached_soffit_away_standard: [
        "house",
        "posts",
        "beams",
        "support_beams",
        "rafters",
        "joiners",
        "gutters",
        "roof_cladding",
        "roof_planes",
        "attachment_edge",
      ],
      gable_attached_standard: [
        "house",
        "posts",
        "beams",
        "support_beams",
        "rafters",
        "joiners",
        "gutters",
        "roof_cladding",
        "roof_planes",
        "attachment_edge",
      ],
      box_attached_standard: [
        "house",
        "posts",
        "beams",
        "rafters",
        "joiners",
        "gutters",
        "roof_cladding",
        "roof_planes",
        "attachment_edge",
      ],
    } as const;

    for (const [fixtureId, expectedLayers] of Object.entries(fixtureIds)) {
      const fixture = requireSupportedFixture(fixtureId);
      const solveResult = solveAssembly3D(fixture.config);
      if (!solveResult.ok) {
        throw new Error(
          `Expected fixture ${fixtureId} to solve: ${solveResult.error}`,
        );
      }

      const scene = buildViewerSceneModel(solveResult.value);
      expect(
        scene.layers.map((layer) => layer.id),
        fixtureId,
      ).toEqual(expectedLayers);
    }
  });

  it("renders semantic house model geometry instead of legacy flat house references", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = addHouseModelContext(fixture.config, {
      lengthMm: 6000,
      eaveHeightMm: 2400,
      strategy: "fascia_under_gutter",
    });
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const houseLayer = buildViewerSceneModel(solveResult.value).layers.find(
      (layer) => layer.id === "house",
    );
    const objects = houseLayer?.objects ?? [];
    const objectKinds = objects.map((object) =>
      object.type === "house_surface" ||
      object.type === "house_line" ||
      object.type === "house_surface_solid" ||
      object.type === "house_linear_solid"
        ? `${object.type}:${object.kind}`
        : `${object.type}:${object.id}`,
    );

    expect(houseLayer?.visibleByDefault).toBe(true);
    expect(objectKinds).toEqual(
      expect.arrayContaining([
        "house_surface_solid:wall",
        "house_surface_solid:roof",
        "house_surface_solid:soffit",
        "house_surface_solid:fascia",
        "house_linear_solid:gutter",
        "house_surface:attachment_zone",
        "house_line:roof_feature",
        "house_line:attachment_target",
      ]),
    );
    expect(objects.some((object) => object.id === "house-wall-plane")).toBe(false);
    expect(objects.some((object) => object.id === "house-fascia-line")).toBe(false);
    expect(objects.some((object) => object.id === "house-roof-edge-line")).toBe(false);
  });

  it("renders moved semantic house attachment targets at the projected facade", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = addHouseModelContext(fixture.config, {
      lengthMm: 6000,
      eaveHeightMm: 2400,
      strategy: "soffit_brackets",
      footprint: makePlacedHouseFootprint({
        offsetX: -1000,
        width: 8000,
        facadeY: -400,
        depth: 2000,
      }),
    });
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const houseTarget = buildViewerSceneModel(solveResult.value)
      .layers.flatMap((layer) => layer.objects)
      .find((object) => object.id === "house-attachment-target-line");

    expect(solveResult.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2400 },
      end: { x: 6000, y: 0, z: 2400 },
    });
    expect(houseTarget).toMatchObject({
      type: "house_line",
      kind: "attachment_target",
      line: {
        start: { x: 0, y: -400, z: 2400 },
        end: { x: 6000, y: -400, z: 2400 },
      },
    });

    const scene = buildViewerSceneModel(solveResult.value);
    const points = scene.layers.flatMap((layer) =>
      layer.objects.flatMap(pointsForViewerObject),
    );
    const ys = points.map((point) => point.y);
    expect(points.length).toBeGreaterThan(0);
    expect(points.every((point) => Number.isFinite(point.x))).toBe(true);
    expect(points.every((point) => Number.isFinite(point.y))).toBe(true);
    expect(points.every((point) => Number.isFinite(point.z))).toBe(true);
    expect(Math.min(...ys)).toBeLessThanOrEqual(-2450);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(2950);
  });

  it("renders front-side semantic house targets at the selected facade", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = addHouseModelContext(
      {
        ...fixture.config,
        connection: {
          ...fixture.config.connection,
          attachmentSide: "front",
        },
      },
      {
        lengthMm: 6000,
        eaveHeightMm: 2400,
        strategy: "soffit_brackets",
        footprint: makeFrontHouseFootprint({
          offsetX: -1000,
          width: 8000,
          facadeY: 3400,
          depth: 2000,
        }),
      },
    );
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const houseTarget = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "house-attachment-target-line");
    const points = scene.layers.flatMap((layer) =>
      layer.objects.flatMap(pointsForViewerObject),
    );

    expect(solveResult.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2400 },
      end: { x: 6000, y: 0, z: 2400 },
    });
    expect(houseTarget).toMatchObject({
      type: "house_line",
      kind: "attachment_target",
      line: {
        start: { x: 0, y: 3400, z: 2400 },
        end: { x: 6000, y: 3400, z: 2400 },
      },
    });
    expect(points.every((point) => Number.isFinite(point.x))).toBe(true);
    expect(Math.max(...points.map((point) => point.y))).toBeGreaterThanOrEqual(
      5850,
    );
  });

  it("renders side semantic house targets at the selected facade", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = addHouseModelContext(
      {
        ...fixture.config,
        connection: {
          ...fixture.config.connection,
          attachmentSide: "left",
        },
      },
      {
        lengthMm: 6000,
        eaveHeightMm: 2400,
        strategy: "soffit_brackets",
        footprint: makeLeftHouseFootprint({
          offsetY: 500,
          width: 2000,
          facadeX: -300,
          depth: 1200,
        }),
      },
    );
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const houseTarget = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "house-attachment-target-line");
    const points = scene.layers.flatMap((layer) =>
      layer.objects.flatMap(pointsForViewerObject),
    );

    expect(houseTarget).toMatchObject({
      type: "house_line",
      kind: "attachment_target",
      line: {
        start: { x: -300, y: 500, z: 2400 },
        end: { x: -300, y: 2500, z: 2400 },
      },
    });
    expect(points.every((point) => Number.isFinite(point.x))).toBe(true);
    expect(Math.min(...points.map((point) => point.x))).toBeLessThanOrEqual(
      -1950,
    );
  });

  it("keeps a front-side recessed gable house scene finite and within the semantic house extents", () => {
    const fixture = requireSupportedFixture("gable_attached_standard");
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
    const config = addHouseModelContext(
      {
        ...fixture.config,
        connection: {
          ...fixture.config.connection,
          attachmentSide: "front",
        },
      },
      {
        lengthMm: 5000,
        eaveHeightMm: 2500,
        strategy: "fascia_under_gutter",
        footprint,
      },
    );
    config.houseContext.model!.roofPitchDeg = 20;
    config.houseContext.model!.eave!.soffitDepthMm = 600;
    config.houseContext.model!.eave!.fasciaHeightMm = 300;
    config.houseContext.model!.eave!.eaveOverhangMm = 1000;

    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const houseObjects =
      scene.layers.find((layer) => layer.id === "house")?.objects ?? [];
    const roofFeatureObjects = houseObjects.filter(
      (object) => object.type === "house_line" && object.kind === "roof_feature",
    );
    const solidHousePoints = houseObjects
      .filter(
        (object) =>
          object.type === "house_surface_solid" ||
          object.type === "house_linear_solid",
      )
      .flatMap(pointsForViewerObject);
    const xs = solidHousePoints.map((point) => point.x);
    const ys = solidHousePoints.map((point) => point.y);
    const zs = solidHousePoints.map((point) => point.z);

    expect(solveResult.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2700 },
      end: { x: 6500, y: 0, z: 2700 },
    });
    expect(solveResult.value.house.model?.metadata?.roofGeometry).toBe(
      "rectilinear_joined_hipped",
    );
    expect(solveResult.value.house.model?.metadata?.roofFacetMergeMode).toBe(
      "active_rectilinear_wavefront",
    );
    expect(solveResult.value.house.model?.metadata?.roofQaStatus).toBe("valid");
    expect(solveResult.value.house.model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expect(solveResult.value.house.model?.roofPlanes).toHaveLength(8);
    expect(solveResult.value.house.model?.metadata?.roofTopologyFinalFaceCount).toBe(
      solveResult.value.house.model?.roofPlanes.length,
    );
    expect(solveResult.value.house.model?.metadata?.roofTopologyDisconnectedSourceFaceCount).toBe(0);
    expect(solveResult.value.house.model?.metadata?.roofTopologyInternalEaveHeightSegmentCount).toBe(0);
    expect(solveResult.value.house.model?.metadata?.roofTopologyValleyCount).toBe(2);
    expect(
      Number(solveResult.value.house.model?.metadata?.roofFacetCount ?? 0),
    ).toBeLessThan(
      Number(
        solveResult.value.house.model?.metadata?.roofSplitRegionCount ??
          Number.POSITIVE_INFINITY,
      ),
    );
    expect(
      solveResult.value.house.model?.roofPlanes.every(
        (plane) => !plane.id.includes("house-roof-wing"),
      ),
    ).toBe(true);
    expect(roofFeatureObjects.map((object) => object.metadata?.featureKind)).toEqual(
      expect.arrayContaining(["ridge", "hip", "valley"]),
    );
    expect(
      roofFeatureObjects.every(
        (object) => object.metadata?.roofFeatureSource === "facet_adjacency",
      ),
    ).toBe(true);
    expect(
      roofFeatureObjects.filter((object) => object.metadata?.featureKind === "valley"),
    ).toHaveLength(2);
    expect(
      houseObjects.filter((object) => object.type === "house_line" && object.kind === "roof_outline"),
    ).toHaveLength(0);
    expect(
      houseObjects.filter((object) => object.type === "house_surface_solid" && object.kind === "roof"),
    ).toHaveLength(solveResult.value.house.model?.roofPlanes.length ?? 0);
    expect(scene.metadata).toMatchObject({
      houseRoofQaStatus: "valid",
      houseRoofTopologyInternalEaveHeightSegmentCount: 0,
      houseRoofTopologyValleyCount: 2,
      houseRoofSolidSkippedCount: 0,
    });
    expect(houseObjects.some((object) => object.type === "house_surface_solid")).toBe(
      true,
    );
    expect(houseObjects.some((object) => object.type === "house_linear_solid")).toBe(
      true,
    );
    expect(solidHousePoints.length).toBeGreaterThan(0);
    expect(solidHousePoints.every((point) => Number.isFinite(point.x))).toBe(true);
    expect(solidHousePoints.every((point) => Number.isFinite(point.y))).toBe(true);
    expect(solidHousePoints.every((point) => Number.isFinite(point.z))).toBe(true);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-2100);
    expect(Math.max(...xs)).toBeLessThanOrEqual(10100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(3900);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10100);
    expect(Math.max(...zs)).toBeLessThan(6500);
  });

  it("skips invalid or degenerate semantic house scene objects", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = addHouseModelContext(fixture.config, {
      lengthMm: 6000,
      eaveHeightMm: 2400,
      strategy: "soffit_brackets",
    });
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const mutated = structuredClone(solveResult.value);
    if (!mutated.house.model) {
      throw new Error("Expected semantic house model.");
    }

    const invalidWallId = mutated.house.model.solids!.surfaceSolids.find((solid) => solid.kind === "wall")!.id;
    const invalidRoofId = mutated.house.model.solids!.surfaceSolids.find((solid) => solid.kind === "roof")!.id;
    const invalidGutterId = mutated.house.model.solids!.linearSolids[0]!.id;
    const invalidFrameGutterId = mutated.house.model.solids!.linearSolids[2]!.id;
    mutated.house.model.solids!.surfaceSolids.find((solid) => solid.kind === "wall")!.boundary = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    mutated.house.model.solids!.surfaceSolids.find((solid) => solid.kind === "roof")!.boundary[0] = {
      x: Number.NaN,
      y: -2250,
      z: 2400,
    };
    mutated.house.model.solids!.linearSolids[0]!.centerline = {
      start: { x: -450, y: -2250, z: 2400 },
      end: { x: -450, y: -2250, z: 2400 },
    };
    mutated.house.model.solids!.linearSolids[2]!.localFrame = {
      origin: { x: 5950, y: 450, z: 2355 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 1, y: 0, z: 0 },
      zAxis: { x: 1, y: 0, z: 0 },
    };
    mutated.house.attachmentTarget = {
      ...mutated.house.attachmentTarget!,
      line: {
        start: { x: Number.POSITIVE_INFINITY, y: 0, z: 2400 },
        end: { x: 6000, y: 0, z: 2400 },
      },
    };

    const houseObjects =
      buildViewerSceneModel(mutated).layers.find((layer) => layer.id === "house")
        ?.objects ?? [];

    expect(houseObjects.some((object) => object.id === invalidWallId)).toBe(
      false,
    );
    expect(houseObjects.some((object) => object.id === invalidRoofId)).toBe(
      false,
    );
    expect(
      houseObjects.some((object) => object.id === invalidGutterId),
    ).toBe(false);
    expect(
      houseObjects.some((object) => object.id === invalidFrameGutterId),
    ).toBe(false);
    expect(
      houseObjects.some(
        (object) => object.id === "house-attachment-target-line",
      ),
    ).toBe(false);
    expect(houseObjects.some((object) => object.id === "house-solid-house-wall-2")).toBe(
      true,
    );
    expect(
      houseObjects.some((object) => object.id === "house-solid-gutter-2"),
    ).toBe(true);

    const points = houseObjects.flatMap(pointsForViewerObject);
    expect(points.every((point) => Number.isFinite(point.x))).toBe(true);
    expect(points.every((point) => Number.isFinite(point.y))).toBe(true);
    expect(points.every((point) => Number.isFinite(point.z))).toBe(true);
  });

  it("quarantines QA-invalid semantic roof solids while keeping house context diagnostics", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = addHouseModelContext(fixture.config, {
      lengthMm: 6000,
      eaveHeightMm: 2400,
      strategy: "soffit_brackets",
    });
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const mutated = structuredClone(solveResult.value);
    if (!mutated.house.model?.solids) {
      throw new Error("Expected semantic house model solids.");
    }
    const expectedRoofCount = mutated.house.model.roofPlanes.length;
    mutated.house.model.metadata = {
      ...mutated.house.model.metadata,
      roofQaStatus: "invalid",
      roofQaFailureReason: "test_spans_recess_void",
      roofQaFacetAreaMm2: 10,
      roofQaEaveAreaMm2: 100,
      roofQaAreaDeltaMm2: -90,
      roofQaRejectedFacetCount: 1,
    };
    mutated.house.model.eave.metadata = {
      ...mutated.house.model.eave.metadata,
      ...mutated.house.model.metadata,
    };

    const scene = buildViewerSceneModel(mutated);
    const houseObjects =
      scene.layers.find((layer) => layer.id === "house")?.objects ?? [];

    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_surface_solid" && object.kind === "roof",
      ),
    ).toBe(false);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_surface_solid" && object.kind === "wall",
      ),
    ).toBe(true);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_surface_solid" && object.kind === "soffit",
      ),
    ).toBe(true);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_surface_solid" && object.kind === "fascia",
      ),
    ).toBe(true);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_linear_solid" && object.kind === "gutter",
      ),
    ).toBe(true);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_line" && object.kind === "roof_feature",
      ),
    ).toBe(true);

    const roofOutlines = houseObjects.filter(
      (object) => object.type === "house_line" && object.kind === "roof_outline",
    );
    expect(roofOutlines).toHaveLength(mutated.house.model.eave.gutterLines?.length ?? 0);
    expect(roofOutlines[0]?.metadata).toMatchObject({
      roofQaStatus: "invalid",
      roofQaFailureReason: "test_spans_recess_void",
      roofRenderSkipReason: "roof_qa_invalid",
      roofSolidSkippedCount: expectedRoofCount,
    });
    expect(scene.metadata).toMatchObject({
      houseRoofQaStatus: "invalid",
      houseRoofQaFailureReason: "test_spans_recess_void",
      houseRoofSolidExpectedCount: expectedRoofCount,
      houseRoofSolidSceneCount: 0,
      houseRoofSolidSkippedCount: expectedRoofCount,
    });

    const points = houseObjects.flatMap(pointsForViewerObject);
    expect(points.every((point) => Number.isFinite(point.x))).toBe(true);
    expect(points.every((point) => Number.isFinite(point.y))).toBe(true);
    expect(points.every((point) => Number.isFinite(point.z))).toBe(true);
  });

  it("keeps legacy house references as fallback when no house model exists", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const config = structuredClone(fixture.config);
    config.houseContext.model = null;

    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const houseLayer = buildViewerSceneModel(solveResult.value).layers.find(
      (layer) => layer.id === "house",
    );

    expect(houseLayer?.objects.map((object) => object.id)).toEqual(
      expect.arrayContaining(["house-wall-plane", "house-roof-edge-line"]),
    );
    expect(
      houseLayer?.objects.some((object) => object.type === "house_surface"),
    ).toBe(false);
    expect(
      houseLayer?.objects.some((object) => object.type === "house_line"),
    ).toBe(false);
  });

  it("does not render semantic house model objects for freestanding assemblies", () => {
    const fixture = requireSupportedFixture("gable_freestanding_standard");
    const config = addHouseModelContext(fixture.config, {
      lengthMm: 6500,
      eaveHeightMm: 2700,
      strategy: "facade_ledger",
    });
    const solveResult = solveAssembly3D(config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const houseLayer = buildViewerSceneModel(solveResult.value).layers.find(
      (layer) => layer.id === "house",
    );

    expect(
      houseLayer?.objects.some((object) => object.type === "house_surface"),
    ).toBe(false);
    expect(
      houseLayer?.objects.some((object) => object.type === "house_line"),
    ).toBe(false);
  });

  it("preserves member geometry fields for rendered member objects", () => {
    const fixture = requireSupportedFixture("gable_attached_standard");
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const ridge = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) => object.type === "member_prism" && object.id === "ridge",
      );

    expect(ridge).toMatchObject({
      id: "ridge",
      type: "member_prism",
      role: "ridge",
      sourceId: "ridge",
      renderMode: "prism",
    });

    if (!ridge || ridge.type !== "member_prism") {
      throw new Error("Expected ridge member prism.");
    }

    expect(ridge.lengthMm).toBeGreaterThan(0);
    expect(ridge.centerline.start.x).toBe(-25);
    expect(ridge.centerline.end.x).toBe(6525);
    expect(ridge.profile.depthMm).toBeGreaterThan(0);
    expect(ridge.localFrame.origin.y).toBe(2000);
    expect(ridge.localFrame.yAxis).toEqual({ x: 0, y: 1, z: 0 });
    expect(ridge.localFrame.zAxis).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("preserves gable rafter gutter-line end cuts for the viewer", () => {
    const fixture = requireSupportedFixture("gable_attached_standard");
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const outerGutter = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-gutter",
      );
    const houseRafter = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "house-rafter-1",
      );
    const outerRafter = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-rafter-1",
      );

    if (!outerGutter || outerGutter.type !== "member_prism") {
      throw new Error("Expected outer gutter member prism.");
    }
    if (!outerRafter || outerRafter.type !== "member_prism") {
      throw new Error("Expected outer rafter member prism.");
    }

    const outerGutterInsideY =
      outerGutter.centerline.start.y +
      (outerGutter.profile.anchors?.backFaceY ?? 0);
    expect(houseRafter).toMatchObject({
      id: "house-rafter-1",
      type: "member_prism",
    });
    if (houseRafter?.type === "member_prism") {
      expect(houseRafter.endCuts).toEqual([
        {
          end: "end",
          plane: {
            normal: { x: 0, y: 1, z: 0 },
            offsetMm: 1975,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
      ]);
    }
    expect(outerRafter.centerline.end.y).toBeCloseTo(outerGutterInsideY, 6);
    expect(outerRafter.endCuts).toEqual(
      expect.arrayContaining([
        {
          end: "start",
          plane: {
            normal: { x: 0, y: -1, z: 0 },
            offsetMm: -2025,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
        {
          end: "end",
          plane: {
            normal: { x: 0, y: 1, z: 0 },
            offsetMm: outerGutterInsideY,
            keepSide: "negative",
          },
          preClipExtensionMm: 150,
        },
      ]),
    );
  });

  it("preserves corrected beam and rafter local-frame orientation for the viewer", () => {
    const fixture = requireSupportedFixture(
      "mono_attached_soffit_away_standard",
    );
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const outerBeam = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-beam",
      );
    const rafter = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) => object.type === "member_prism" && object.id === "rafter-1",
      );

    if (!outerBeam || outerBeam.type !== "member_prism") {
      throw new Error("Expected outer beam member prism.");
    }
    if (!rafter || rafter.type !== "member_prism") {
      throw new Error("Expected mono rafter member prism.");
    }

    expect(outerBeam.localFrame.yAxis).toEqual({ x: 0, y: 1, z: 0 });
    expect(outerBeam.localFrame.zAxis).toEqual({ x: 0, y: 0, z: 1 });
    expect(rafter.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(rafter.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(rafter.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(rafter.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(rafter.localFrame.zAxis.y).toBeCloseTo(0.074447, 5);
    expect(rafter.localFrame.zAxis.z).toBeCloseTo(0.997225, 5);
  });

  it("renders the mono gutter from an outline-backed profile extrusion", () => {
    const fixture = requireSupportedFixture(
      "mono_attached_soffit_away_standard",
    );
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const outerGutter = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-gutter",
      );

    expect(outerGutter).toMatchObject({
      id: "outer-gutter",
      type: "member_prism",
      renderMode: "outline_extrusion",
    });

    if (!outerGutter || outerGutter.type !== "member_prism") {
      throw new Error("Expected outer gutter member prism.");
    }

    expect(outerGutter.profile.profileKey).toBe("sp_gutter");
    expect(outerGutter.profile.shape).toBe("custom");
    expect(outerGutter.lengthMm).toBe(6090);
    expect(outerGutter.profile.sectionOutline?.length).toBeGreaterThanOrEqual(
      3,
    );
    expect(outerGutter.profile.anchors).toMatchObject({
      backFaceY: -50,
      frontFaceY: 50,
      roofBearingFaceY: -24.003203,
      roofBearingFaceZ: 73.009886,
    });
    expect(outerGutter.metadata).toMatchObject({
      renderedFromOutline: true,
      bodyInsetStartMm: 3,
      bodyInsetEndMm: 3,
      endCapStartMm: 3,
      endCapEndMm: 3,
      endCapWidthMm: 100,
      endCapDepthMm: 150,
    });
  });

  it("renders mono joiners from the DXF-backed outline profile", () => {
    const fixture = requireSupportedFixture(
      "mono_attached_soffit_away_standard",
    );
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const joiner = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) => object.type === "member_prism" && object.id === "joiner-1",
      );

    expect(joiner).toMatchObject({
      id: "joiner-1",
      type: "member_prism",
      renderMode: "outline_extrusion",
    });

    if (!joiner || joiner.type !== "member_prism") {
      throw new Error("Expected joiner member prism.");
    }

    expect(joiner.profile.profileKey).toBe("sp_joiners");
    expect(joiner.profile.shape).toBe("custom");
    expect(joiner.profile.widthMm).toBe(50);
    expect(joiner.profile.depthMm).toBe(16);
    expect(joiner.profile.sectionOutline).toHaveLength(20);
  });

  it("moves the mono outer support beam into a hidden structural layer when the outer edge is an integrated SP gutter", () => {
    const fixture = requireSupportedFixture(
      "mono_attached_soffit_away_standard",
    );
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const beamLayer = scene.layers.find((layer) => layer.id === "beams");
    const supportBeamLayer = scene.layers.find(
      (layer) => layer.id === "support_beams",
    );
    const gutterLayer = scene.layers.find((layer) => layer.id === "gutters");

    expect(
      beamLayer?.objects.some((object) => object.id === "outer-beam"),
    ).toBe(false);
    expect(supportBeamLayer?.visibleByDefault).toBe(false);
    expect(
      supportBeamLayer?.objects.find((object) => object.id === "outer-beam"),
    ).toMatchObject({
      id: "outer-beam",
      type: "member_prism",
      role: "beam",
    });
    expect(gutterLayer?.visibleByDefault).toBe(true);
    expect(
      gutterLayer?.objects.find((object) => object.id === "outer-gutter"),
    ).toMatchObject({
      id: "outer-gutter",
      type: "member_prism",
      role: "gutter",
    });
  });

  it("keeps standard gable gutters primary and routes paired support beams into the hidden support layer", () => {
    const attachedFixture = requireSupportedFixture("gable_attached_standard");
    const attachedSolveResult = solveAssembly3D(attachedFixture.config);
    if (!attachedSolveResult.ok) {
      throw new Error(attachedSolveResult.error);
    }

    const attachedScene = buildViewerSceneModel(attachedSolveResult.value);
    const attachedBeamLayer = attachedScene.layers.find(
      (layer) => layer.id === "beams",
    );
    const attachedSupportLayer = attachedScene.layers.find(
      (layer) => layer.id === "support_beams",
    );
    const attachedGutter = attachedScene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-gutter",
      );

    expect(
      attachedBeamLayer?.objects.some((object) => object.id === "outer-beam"),
    ).toBe(false);
    expect(attachedSupportLayer?.visibleByDefault).toBe(false);
    expect(
      attachedSupportLayer?.objects.find(
        (object) => object.id === "outer-beam",
      ),
    ).toMatchObject({
      id: "outer-beam",
      type: "member_prism",
      role: "beam",
    });
    expect(attachedGutter).toMatchObject({
      id: "outer-gutter",
      type: "member_prism",
      renderMode: "outline_extrusion",
    });

    if (!attachedGutter || attachedGutter.type !== "member_prism") {
      throw new Error("Expected attached gable outer gutter member prism.");
    }

    expect(attachedGutter.profile.profileKey).toBe("sp_gutter");
    expect(attachedGutter.lengthMm).toBe(6590);
    expect(attachedGutter.metadata).toMatchObject({
      bodyInsetStartMm: 3,
      bodyInsetEndMm: 3,
      endCapWidthMm: 100,
      endCapDepthMm: 150,
    });

    const freestandingFixture = requireSupportedFixture(
      "gable_freestanding_standard",
    );
    const freestandingSolveResult = solveAssembly3D(freestandingFixture.config);
    if (!freestandingSolveResult.ok) {
      throw new Error(freestandingSolveResult.error);
    }

    const freestandingScene = buildViewerSceneModel(
      freestandingSolveResult.value,
    );
    const freestandingBeamLayer = freestandingScene.layers.find(
      (layer) => layer.id === "beams",
    );
    const freestandingSupportLayer = freestandingScene.layers.find(
      (layer) => layer.id === "support_beams",
    );
    const houseGutter = freestandingScene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "house-gutter",
      );
    const outerGutter = freestandingScene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-gutter",
      );

    expect(
      freestandingBeamLayer?.objects.some(
        (object) => object.id === "house-beam",
      ),
    ).toBe(false);
    expect(
      freestandingBeamLayer?.objects.some(
        (object) => object.id === "outer-beam",
      ),
    ).toBe(false);
    expect(freestandingSupportLayer?.visibleByDefault).toBe(false);
    expect(
      freestandingSupportLayer?.objects.map((object) => object.id).sort(),
    ).toEqual(["house-beam", "outer-beam"]);

    if (
      !houseGutter ||
      houseGutter.type !== "member_prism" ||
      !outerGutter ||
      outerGutter.type !== "member_prism"
    ) {
      throw new Error("Expected freestanding gable gutter member prisms.");
    }

    expect(houseGutter.renderMode).toBe("outline_extrusion");
    expect(outerGutter.renderMode).toBe("outline_extrusion");
    expect(houseGutter.profile.profileKey).toBe("sp_gutter");
    expect(outerGutter.profile.profileKey).toBe("sp_gutter");
    expect(houseGutter.lengthMm).toBe(6590);
    expect(outerGutter.lengthMm).toBe(6590);
  });

  it("preserves roof-plane geometry fields for rendered roof-plane objects", () => {
    const fixture = requireSupportedFixture("box_attached_standard");
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const roofPlane = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) => object.type === "roof_plane" && object.id === "box-roof",
      );

    expect(roofPlane).toMatchObject({
      id: "box-roof",
      type: "roof_plane",
      sourceId: "box-roof",
    });

    if (!roofPlane || roofPlane.type !== "roof_plane") {
      throw new Error("Expected box roof plane.");
    }

    expect(roofPlane.boundary).toHaveLength(4);
    expect(roofPlane.plane.origin.y).toBe(150);
    expect(roofPlane.fallVector.y).toBeGreaterThan(0);
  });

  it("projects mono acrylic roof cladding panels into their own visible layer and hides structural roof planes by default", () => {
    const fixture = requireSupportedFixture(
      "mono_attached_soffit_away_standard",
    );
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const claddingLayer = scene.layers.find(
      (layer) => layer.id === "roof_cladding",
    );
    const flashingLayer = scene.layers.find(
      (layer) => layer.id === "roof_flashings",
    );
    const roofPlaneLayer = scene.layers.find(
      (layer) => layer.id === "roof_planes",
    );
    const panel = claddingLayer?.objects.find(
      (object) =>
        object.type === "roof_cladding_panel" &&
        object.id === "acrylic-panel-1",
    );

    expect(claddingLayer?.visibleByDefault).toBe(true);
    expect(roofPlaneLayer?.visibleByDefault).toBe(false);
    expect(panel).toMatchObject({
      id: "acrylic-panel-1",
      type: "roof_cladding_panel",
      sourceId: "acrylic-panel-1",
      material: "acrylic",
      thicknessMm: 6,
    });

    if (!panel || panel.type !== "roof_cladding_panel") {
      throw new Error("Expected mono acrylic cladding panel object.");
    }

    expect(panel.boundary).toHaveLength(4);
    expect(panel.metadata).toMatchObject({
      index: 1,
      areaMm2: expect.any(Number),
      gutterEmbedMm: 15,
    });
  });

  it("projects gable acrylic roof cladding into visible house and outer roof-half layers while keeping roof planes secondary", () => {
    const fixture = requireSupportedFixture("gable_attached_standard");
    const acrylicFixture = structuredClone(fixture);
    acrylicFixture.config.roof.material = "acrylic";
    acrylicFixture.config.roofCovering.kind = "acrylic";
    acrylicFixture.config.roofCovering.houseAllowanceMm = 50;

    const solveResult = solveAssembly3D(acrylicFixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const claddingLayer = scene.layers.find(
      (layer) => layer.id === "roof_cladding",
    );
    const flashingLayer = scene.layers.find(
      (layer) => layer.id === "roof_flashings",
    );
    const roofPlaneLayer = scene.layers.find(
      (layer) => layer.id === "roof_planes",
    );
    const housePanel = claddingLayer?.objects.find(
      (object) =>
        object.type === "roof_cladding_panel" &&
        object.id === "house-acrylic-panel-1",
    );
    const outerPanel = claddingLayer?.objects.find(
      (object) =>
        object.type === "roof_cladding_panel" &&
        object.id === "outer-acrylic-panel-1",
    );
    const ridgeFlashing = flashingLayer?.objects.find(
      (object) =>
        object.type === "roof_flashing" && object.id === "ridge-flashing",
    );
    const houseJoiner = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "house-joiner-1",
      );
    const outerJoiner = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-joiner-1",
      );

    expect(claddingLayer?.visibleByDefault).toBe(true);
    expect(flashingLayer?.visibleByDefault).toBe(true);
    expect(roofPlaneLayer?.visibleByDefault).toBe(false);
    expect(housePanel).toMatchObject({
      id: "house-acrylic-panel-1",
      type: "roof_cladding_panel",
      material: "acrylic",
      thicknessMm: 6,
    });
    expect(outerPanel).toMatchObject({
      id: "outer-acrylic-panel-1",
      type: "roof_cladding_panel",
      material: "acrylic",
      thicknessMm: 6,
    });
    expect(ridgeFlashing).toMatchObject({
      id: "ridge-flashing",
      type: "roof_flashing",
      thicknessMm: 1,
      metadata: {
        position: "ridge",
        girthMm: 300,
        wingLengthMm: 150,
      },
    });
    if (!ridgeFlashing || ridgeFlashing.type !== "roof_flashing") {
      throw new Error("Expected ridge flashing object.");
    }
    expect(ridgeFlashing.wings).toHaveLength(2);

    if (
      !houseJoiner ||
      houseJoiner.type !== "member_prism" ||
      !outerJoiner ||
      outerJoiner.type !== "member_prism"
    ) {
      throw new Error("Expected gable acrylic joiner member prisms.");
    }

    expect(houseJoiner.renderMode).toBe("outline_extrusion");
    expect(outerJoiner.renderMode).toBe("outline_extrusion");
    expect(houseJoiner.profile.profileKey).toBe("sp_joiners");
    expect(outerJoiner.profile.profileKey).toBe("sp_joiners");
    expect(houseJoiner.endCuts).toEqual([
      {
        end: "end",
        plane: {
          normal: { x: 0, y: 1, z: 0 },
          offsetMm: 1975,
          keepSide: "negative",
        },
        preClipExtensionMm: 50,
      },
    ]);
    expect(outerJoiner.endCuts).toEqual([
      {
        end: "end",
        plane: {
          normal: { x: 0, y: -1, z: 0 },
          offsetMm: -2025,
          keepSide: "negative",
        },
        preClipExtensionMm: 50,
      },
    ]);
  });

  it("falls back to line render metadata when a non-rectangular profile is missing its section outline", () => {
    const fixture = requireSupportedFixture(
      "mono_attached_soffit_away_standard",
    );
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const mutated = structuredClone(solveResult.value);
    const beam = mutated.members.find((member) => member.id === "outer-beam");
    if (!beam) {
      throw new Error("Expected outer-beam.");
    }
    beam.profile.shape = "custom";
    beam.profile.sectionOutline = null;

    const scene = buildViewerSceneModel(mutated);
    const outerBeam = scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object) =>
          object.type === "member_prism" && object.id === "outer-beam",
      );

    expect(outerBeam).toMatchObject({
      id: "outer-beam",
      type: "member_prism",
      renderMode: "line_fallback",
    });

    if (!outerBeam || outerBeam.type !== "member_prism") {
      throw new Error("Expected outer beam member object.");
    }

    expect(outerBeam.metadata).toMatchObject({
      profileShapeFallback: true,
      unsupportedProfileShape: "custom",
    });
  });

  it("is independent of source member ordering", () => {
    const fixture = requireSupportedFixture("gable_freestanding_standard");
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const reordered = structuredClone(solveResult.value);
    reordered.members.reverse();
    reordered.roofPlanes.reverse();

    expect(buildViewerSceneModel(reordered)).toEqual(
      buildViewerSceneModel(solveResult.value),
    );
  });
});
