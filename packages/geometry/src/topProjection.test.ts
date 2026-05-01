import { describe, expect, it } from "vitest";
import {
  buildTopProjectionParityReport,
  buildTopProjectionViewModelFromScene,
  buildTopProjectionViewModel,
  buildViewerSceneModel,
  solveAssembly3D,
  type GeometryConfig,
  type GeometryTopProjectionViewModel,
  type HouseSurfaceSolidKind,
  type HouseAttachmentStrategy,
  type Point2,
  type Polygon3,
  type RenderMesh3D,
  type ViewerSceneModel,
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

function addHouseModelContext(config: GeometryConfig): GeometryConfig {
  const footprint = makeHouseFootprint(7200);
  const strategy: HouseAttachmentStrategy = "fascia_under_gutter";
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
        eaveHeightMm: 2400,
        wallHeightMm: 2400,
        roofPitchDeg: 25,
        attachmentStrategy: strategy,
        decks: [
          {
            id: "deck-main",
            kind: "deck",
            shape: "custom",
            outline: [
              { x: 900, y: 300, z: 0 },
              { x: 4200, y: 300, z: 0 },
              { x: 4200, y: 2100, z: 0 },
              { x: 900, y: 2100, z: 0 },
            ],
            elevationMode: "aligned_to_threshold",
            levelOffsetMm: 0,
            hostEdgeId: "footprint-edge-3",
            isAttached: true,
            surfaceMaterial: "timber_decking",
          },
        ],
        openings: [
          {
            id: "opening-main",
            label: "Opening",
            kind: "slider",
            panelCount: 3,
            wallId: "front",
            hostEdgeId: "footprint-edge-3",
            widthMm: 1600,
            heightMm: 2100,
            sillHeightMm: 0,
            offsetAlongWallMm: 1800,
            validation: {
              status: "valid",
              codes: [],
              message: null,
            },
          },
        ],
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

function toPoint2(point: { x: number; y: number }): Point2 {
  return {
    x: Number(point.x.toFixed(6)),
    y: Number(point.y.toFixed(6)),
  };
}

function normalizedPointSet(points: Point2[]): string[] {
  return points
    .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    .sort();
}

function makeSceneWithHouseSolid(input: {
  id: string;
  kind: HouseSurfaceSolidKind;
  boundary: Polygon3;
  renderMesh: RenderMesh3D;
}): ViewerSceneModel {
  return {
    layers: [
      {
        id: "house-solids",
        label: "House Solids",
        visibleByDefault: true,
        objects: [
          {
            id: input.id,
            type: "house_surface_solid",
            sourceId: input.id,
            kind: input.kind,
            boundary: input.boundary,
            plane: {
              origin: input.boundary[0] ?? { x: 0, y: 0, z: 0 },
              xAxis: { x: 1, y: 0, z: 0 },
              yAxis: { x: 0, y: 1, z: 0 },
              normal: { x: 0, y: 0, z: 1 },
            },
            thicknessMm: 100,
            renderMesh: input.renderMesh,
          },
        ],
      },
    ],
  };
}

describe("buildTopProjectionViewModel", () => {
  it("projects viewer scene roof, deck, member, and opening shapes into world XY", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const solved = solveAssembly3D(addHouseModelContext(fixture.config));
    if (!solved.ok) throw new Error(solved.error);

    const assembly = structuredClone(solved.value);

    const scene = buildViewerSceneModel(assembly);
    const sceneObjects = scene.layers.flatMap((layer) => layer.objects);
    const projection = buildTopProjectionViewModel(assembly);
    const sceneProjection = buildTopProjectionViewModelFromScene(scene, {
      referenceShapes: projection.shapes.filter((shape) => shape.sourceType === "house_reference"),
    });

    expect(sceneProjection).toEqual(projection);

    const roofObject = sceneObjects.find((object) => object.type === "roof_plane");
    if (!roofObject || roofObject.type !== "roof_plane") throw new Error("Expected roof plane object.");
    const roofShape = projection.shapes.find((shape) => shape.sourceObjectId === roofObject.id);
    expect(roofShape).toMatchObject({
      sourceType: "roof_plane",
      family: "pergola",
      kind: "roof_plane",
      sourceId: roofObject.sourceId,
      metadata: expect.objectContaining({ topProjectionRole: "top_visible" }),
    });
    expect(normalizedPointSet(roofShape?.polygon ?? [])).toEqual(
      normalizedPointSet(roofObject.boundary.map(toPoint2)),
    );

    const deckObject = sceneObjects.find(
      (object) => object.type === "house_surface_solid" && object.kind === "deck",
    );
    if (!deckObject || deckObject.type !== "house_surface_solid" || !deckObject.renderMesh) {
      throw new Error("Expected deck solid object.");
    }
    const deckShape = projection.shapes.find((shape) => shape.sourceObjectId === deckObject.id);
    expect(deckShape).toMatchObject({
      sourceType: "house_surface_solid",
      family: "house",
      kind: "deck",
      sourceId: deckObject.sourceId,
      metadata: expect.objectContaining({ sourceId: "deck-main", topProjectionRole: "top_visible" }),
    });
    expect(normalizedPointSet(deckShape?.polygon ?? [])).toEqual(
      normalizedPointSet(deckObject.boundary.map(toPoint2)),
    );

    const memberObject = sceneObjects.find((object) => object.type === "member_prism" && object.role === "rafter");
    if (!memberObject || memberObject.type !== "member_prism") throw new Error("Expected rafter member object.");
    const memberShape = projection.shapes.find((shape) => shape.sourceObjectId === memberObject.id);
    expect(memberShape).toMatchObject({
      sourceType: "member_prism",
      family: "pergola",
      kind: "rafter",
      sourceId: memberObject.sourceId,
    });
    expect(memberShape?.polygon.length).toBe(4);

    const openingObject = sceneObjects.find(
      (object) =>
        object.type === "house_surface" &&
        object.kind === "opening_marker" &&
        object.metadata?.openingId === "opening-main",
    );
    if (!openingObject || openingObject.type !== "house_surface") throw new Error("Expected opening marker object.");
    const openingShape = projection.shapes.find((shape) => shape.sourceObjectId === openingObject.id);
    expect(openingShape).toMatchObject({
      sourceType: "house_surface",
      family: "house",
      kind: "opening_marker",
      sourceId: openingObject.sourceId,
      metadata: expect.objectContaining({ openingId: "opening-main", topProjectionRole: "context" }),
    });
    const openingXs = [...new Set((openingShape?.polygon ?? []).map((point) => Number(point.x.toFixed(3))))].sort();
    const openingYs = (openingShape?.polygon ?? []).map((point) => point.y);
    const markerXs = [...new Set(openingObject.boundary.map((point) => Number(point.x.toFixed(3))))].sort();
    const markerYs = openingObject.boundary.map((point) => point.y);
    expect(openingXs).toEqual(markerXs);
    expect(Math.min(...openingYs)).toBeLessThan(Math.min(...markerYs));
    expect(Math.max(...openingYs)).toBeGreaterThan(Math.max(...markerYs));

    expect(projection.coordinateSpace).toBe("world_xy_mm");
    expect(projection.screenAxis).toEqual({
      x: "world_x_left",
      y: "world_y_down",
    });
    expect(projection.extents?.widthMm).toBeGreaterThan(0);
    expect(projection.extents?.heightMm).toBeGreaterThan(0);
  });

  it("projects objects that exist only in the supplied viewer scene", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const solved = solveAssembly3D(addHouseModelContext(fixture.config));
    if (!solved.ok) throw new Error(solved.error);

    const scene = buildViewerSceneModel(solved.value);
    const sceneOnlyObject = {
      id: "scene-only-attachment-edge",
      type: "reference_line" as const,
      sourceId: "scene-only-source",
      kind: "attachment_edge" as const,
      line: {
        start: { x: -1000, y: -200, z: 1200 },
        end: { x: -250, y: -200, z: 1200 },
      },
      metadata: {
        source: "scene-only",
      },
    };
    const sceneProjection = buildTopProjectionViewModelFromScene({
      ...scene,
      layers: [
        ...scene.layers,
        {
          id: "scene-only",
          label: "Scene Only",
          visibleByDefault: true,
          objects: [sceneOnlyObject],
        },
      ],
    });

    expect(buildTopProjectionViewModel(solved.value).shapes.find((shape) => shape.sourceObjectId === sceneOnlyObject.id)).toBeUndefined();
    expect(sceneProjection.shapes.find((shape) => shape.sourceObjectId === sceneOnlyObject.id)).toMatchObject({
      id: "reference_line:scene-only-attachment-edge",
      sourceObjectId: sceneOnlyObject.id,
      sourceId: "scene-only-source",
      sourceType: "reference_line",
      family: "reference",
      kind: "attachment_edge",
      zMin: 1200,
      zMax: 1200,
      metadata: {
        source: "scene-only",
        topProjectionRole: "context",
      },
    });
  });

  it("projects roof and deck solids from the semantic top boundary instead of mesh ring order", () => {
    const bottomRing: Polygon3 = [
      { x: 40, y: 25, z: 0 },
      { x: 1040, y: 25, z: 0 },
      { x: 1040, y: 525, z: 0 },
      { x: 40, y: 525, z: 0 },
    ];
    const topRing: Polygon3 = [
      { x: 0, y: 0, z: 140 },
      { x: 1000, y: 0, z: 140 },
      { x: 1000, y: 500, z: 140 },
      { x: 0, y: 500, z: 140 },
    ];
    const scene = makeSceneWithHouseSolid({
      id: "deck-top-visible",
      kind: "deck",
      boundary: topRing,
      renderMesh: {
        vertices: [...bottomRing, ...topRing],
        faces: [
          [0, 2, 1],
          [0, 3, 2],
          [4, 6, 5],
          [4, 7, 6],
          [0, 1, 5],
          [0, 5, 4],
          [1, 2, 6],
          [1, 6, 5],
          [2, 3, 7],
          [2, 7, 6],
          [3, 0, 4],
          [3, 4, 7],
        ],
      },
    });

    const deckShape = buildTopProjectionViewModelFromScene(scene).shapes.find(
      (shape) => shape.sourceObjectId === "deck-top-visible",
    );

    expect(normalizedPointSet(deckShape?.polygon ?? [])).toEqual(normalizedPointSet(topRing.map(toPoint2)));
    expect(normalizedPointSet(deckShape?.polygon ?? [])).not.toEqual(normalizedPointSet(bottomRing.map(toPoint2)));
    expect(deckShape?.metadata).toMatchObject({ topProjectionRole: "top_visible" });
  });

  it("projects sloped roof solids from the semantic roof top boundary instead of the underside", () => {
    const bottomRing: Polygon3 = [
      { x: 60, y: 40, z: 2300 },
      { x: 1260, y: 40, z: 2300 },
      { x: 1260, y: 760, z: 2240 },
      { x: 60, y: 760, z: 2240 },
    ];
    const roofRing: Polygon3 = [
      { x: 0, y: 0, z: 2500 },
      { x: 1200, y: 0, z: 2500 },
      { x: 1200, y: 700, z: 2420 },
      { x: 0, y: 700, z: 2420 },
    ];
    const scene = makeSceneWithHouseSolid({
      id: "roof-top-visible",
      kind: "roof",
      boundary: roofRing,
      renderMesh: {
        vertices: [...bottomRing, ...roofRing],
        faces: [
          [0, 2, 1],
          [0, 3, 2],
          [4, 5, 6],
          [4, 6, 7],
          [0, 1, 5],
          [0, 5, 4],
          [1, 2, 6],
          [1, 6, 5],
          [2, 3, 7],
          [2, 7, 6],
          [3, 0, 4],
          [3, 4, 7],
        ],
      },
    });

    const roofShape = buildTopProjectionViewModelFromScene(scene).shapes.find(
      (shape) => shape.sourceObjectId === "roof-top-visible",
    );

    expect(normalizedPointSet(roofShape?.polygon ?? [])).toEqual(normalizedPointSet(roofRing.map(toPoint2)));
    expect(normalizedPointSet(roofShape?.polygon ?? [])).not.toEqual(normalizedPointSet(bottomRing.map(toPoint2)));
    expect(roofShape?.metadata).toMatchObject({ topProjectionRole: "top_visible" });
  });

  it("projects other mesh-backed solids from the highest non-vertical surface without trusting winding", () => {
    const bottomRing: Polygon3 = [
      { x: 20, y: 10, z: 100 },
      { x: 820, y: 10, z: 100 },
      { x: 820, y: 150, z: 100 },
      { x: 20, y: 150, z: 100 },
    ];
    const topRing: Polygon3 = [
      { x: 0, y: 0, z: 220 },
      { x: 800, y: 0, z: 220 },
      { x: 800, y: 120, z: 220 },
      { x: 0, y: 120, z: 220 },
    ];
    const scene: ViewerSceneModel = {
      layers: [
        {
          id: "house-linear-solids",
          label: "House Linear Solids",
          visibleByDefault: true,
          objects: [
            {
              id: "gutter-top-visible",
              type: "house_linear_solid",
              sourceId: "gutter-top-visible",
              kind: "gutter",
              centerline: {
                start: { x: 0, y: 60, z: 160 },
                end: { x: 800, y: 60, z: 160 },
              },
              localFrame: {
                origin: { x: 0, y: 60, z: 160 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                zAxis: { x: 0, y: 0, z: 1 },
              },
              profileWidthMm: 120,
              profileDepthMm: 120,
              renderMesh: {
                vertices: [...bottomRing, ...topRing],
                faces: [
                  [0, 2, 1],
                  [0, 3, 2],
                  [4, 6, 5],
                  [4, 7, 6],
                  [0, 1, 5],
                  [0, 5, 4],
                  [1, 2, 6],
                  [1, 6, 5],
                  [2, 3, 7],
                  [2, 7, 6],
                  [3, 0, 4],
                  [3, 4, 7],
                ],
              },
            },
          ],
        },
      ],
    };

    const gutterShape = buildTopProjectionViewModelFromScene(scene).shapes.find(
      (shape) => shape.sourceObjectId === "gutter-top-visible",
    );

    expect(normalizedPointSet(gutterShape?.polygon ?? [])).toEqual(normalizedPointSet(topRing.map(toPoint2)));
    expect(normalizedPointSet(gutterShape?.polygon ?? [])).not.toEqual(normalizedPointSet(bottomRing.map(toPoint2)));
    expect(gutterShape?.metadata).toMatchObject({ topProjectionRole: "top_visible" });
  });

  it("classifies lower house envelope solids as hidden from the normal top view", () => {
    const wallRing: Polygon3 = [
      { x: 0, y: -100, z: 0 },
      { x: 1200, y: -100, z: 0 },
      { x: 1200, y: 0, z: 2400 },
      { x: 0, y: 0, z: 2400 },
    ];
    const roofRing: Polygon3 = [
      { x: 0, y: -900, z: 2600 },
      { x: 1200, y: -900, z: 2600 },
      { x: 1200, y: 100, z: 2600 },
      { x: 0, y: 100, z: 2600 },
    ];
    const scene = {
      layers: [
        ...makeSceneWithHouseSolid({
          id: "wall-hidden-from-top",
          kind: "wall",
          boundary: wallRing,
          renderMesh: {
            vertices: wallRing,
            faces: [[0, 1, 2], [0, 2, 3]],
          },
        }).layers,
        ...makeSceneWithHouseSolid({
          id: "roof-visible-from-top",
          kind: "roof",
          boundary: roofRing,
          renderMesh: {
            vertices: roofRing,
            faces: [[0, 1, 2], [0, 2, 3]],
          },
        }).layers,
      ],
    };

    const projection = buildTopProjectionViewModelFromScene(scene);
    const wallShape = projection.shapes.find((shape) => shape.sourceObjectId === "wall-hidden-from-top");
    const roofShape = projection.shapes.find((shape) => shape.sourceObjectId === "roof-visible-from-top");

    expect(wallShape?.metadata).toMatchObject({ topProjectionRole: "hidden_from_top" });
    expect(roofShape?.metadata).toMatchObject({ topProjectionRole: "top_visible" });
    expect(projection.extents).toMatchObject({
      minX: 0,
      minY: -900,
      maxX: 1200,
      maxY: 100,
    });
  });
});

describe("buildTopProjectionParityReport", () => {
  it("passes when a scene-first projection matches the 3D top-view contract", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const solved = solveAssembly3D(addHouseModelContext(fixture.config));
    if (!solved.ok) throw new Error(solved.error);

    const scene = buildViewerSceneModel(solved.value);
    const projection = buildTopProjectionViewModel(solved.value);
    const report = buildTopProjectionParityReport(scene, projection, {
      renderedShapeIds: projection.shapes
        .filter((shape) => shape.metadata?.topProjectionRole !== "hidden_from_top")
        .map((shape) => shape.id),
    });

    expect(report).toMatchObject({
      status: "pass",
      screenAxis: "world_x_left_world_y_down",
    });
    expect(report.topVisibleShapeCount).toBeGreaterThan(0);
    expect(report.issues).toEqual([]);
  });

  it("reports screen-axis mismatches", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const solved = solveAssembly3D(addHouseModelContext(fixture.config));
    if (!solved.ok) throw new Error(solved.error);

    const scene = buildViewerSceneModel(solved.value);
    const projection: GeometryTopProjectionViewModel = {
      ...buildTopProjectionViewModel(solved.value),
      screenAxis: {
        x: "world_x_right",
        y: "world_y_down".replace("down", "up") as "world_y_down",
      },
    };
    const report = buildTopProjectionParityReport(scene, projection);

    expect(report.status).toBe("fail");
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "screen_axis_mismatch" }));
  });

  it("reports missing top-visible scene objects", () => {
    const scene = makeSceneWithHouseSolid({
      id: "roof-missing-projection",
      kind: "roof",
      boundary: [
        { x: 0, y: 0, z: 100 },
        { x: 100, y: 0, z: 100 },
        { x: 100, y: 100, z: 100 },
        { x: 0, y: 100, z: 100 },
      ],
      renderMesh: {
        vertices: [
          { x: 0, y: 0, z: 100 },
          { x: 100, y: 0, z: 100 },
          { x: 100, y: 100, z: 100 },
          { x: 0, y: 100, z: 100 },
        ],
        faces: [[0, 1, 2], [0, 2, 3]],
      },
    });
    const projection: GeometryTopProjectionViewModel = {
      coordinateSpace: "world_xy_mm",
      screenAxis: { x: "world_x_left", y: "world_y_down" },
      shapes: [],
      extents: null,
    };
    const report = buildTopProjectionParityReport(scene, projection);

    expect(report.status).toBe("fail");
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_top_visible_shape",
        sourceObjectId: "roof-missing-projection",
      }),
    );
  });

  it("reports hidden shapes in extents and hidden rendered shapes", () => {
    const wallRing: Polygon3 = [
      { x: -500, y: -500, z: 0 },
      { x: 1500, y: -500, z: 0 },
      { x: 1500, y: 0, z: 2400 },
      { x: -500, y: 0, z: 2400 },
    ];
    const roofRing: Polygon3 = [
      { x: 0, y: 0, z: 2600 },
      { x: 1000, y: 0, z: 2600 },
      { x: 1000, y: 1000, z: 2600 },
      { x: 0, y: 1000, z: 2600 },
    ];
    const scene: ViewerSceneModel = {
      layers: [
        ...makeSceneWithHouseSolid({
          id: "wall-hidden-for-parity",
          kind: "wall",
          boundary: wallRing,
          renderMesh: { vertices: wallRing, faces: [[0, 1, 2], [0, 2, 3]] },
        }).layers,
        ...makeSceneWithHouseSolid({
          id: "roof-visible-for-parity",
          kind: "roof",
          boundary: roofRing,
          renderMesh: { vertices: roofRing, faces: [[0, 1, 2], [0, 2, 3]] },
        }).layers,
      ],
    };
    const projection = buildTopProjectionViewModelFromScene(scene);
    const wallShape = projection.shapes.find((shape) => shape.sourceObjectId === "wall-hidden-for-parity");
    if (!wallShape) throw new Error("Expected hidden wall projection shape.");
    const projectionWithHiddenExtents: GeometryTopProjectionViewModel = {
      ...projection,
      extents: {
        minX: -500,
        minY: -500,
        maxX: 1500,
        maxY: 1000,
        widthMm: 2000,
        heightMm: 1500,
      },
    };

    const report = buildTopProjectionParityReport(scene, projectionWithHiddenExtents, {
      renderedShapeIds: [wallShape.id],
    });

    expect(report.status).toBe("fail");
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "hidden_shape_in_extents" }));
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "hidden_shape_rendered",
        shapeId: wallShape.id,
      }),
    );
  });
});
