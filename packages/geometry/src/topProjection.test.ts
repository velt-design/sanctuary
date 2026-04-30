import { describe, expect, it } from "vitest";
import {
  buildTopProjectionViewModel,
  buildViewerSceneModel,
  solveAssembly3D,
  type GeometryConfig,
  type HouseAttachmentStrategy,
  type Point2,
  type Polygon3,
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

describe("buildTopProjectionViewModel", () => {
  it("projects viewer scene roof, deck, member, and opening shapes into world XY", () => {
    const fixture = requireSupportedFixture("mono_attached_soffit_away_standard");
    const solved = solveAssembly3D(addHouseModelContext(fixture.config));
    if (!solved.ok) throw new Error(solved.error);

    const assembly = structuredClone(solved.value);
    const deckSolid = assembly.house.model?.solids?.surfaceSolids.find((solid) => solid.kind === "deck");
    if (!deckSolid?.renderMesh) throw new Error("Expected solved deck render mesh.");
    const boundaryLength = deckSolid.boundary.length;
    deckSolid.renderMesh.vertices = deckSolid.renderMesh.vertices.map((vertex, index) =>
      index < boundaryLength
        ? {
            ...vertex,
            x: vertex.x + 37,
          }
        : vertex,
    );

    const scene = buildViewerSceneModel(assembly);
    const sceneObjects = scene.layers.flatMap((layer) => layer.objects);
    const projection = buildTopProjectionViewModel(assembly);

    const roofObject = sceneObjects.find((object) => object.type === "roof_plane");
    if (!roofObject || roofObject.type !== "roof_plane") throw new Error("Expected roof plane object.");
    const roofShape = projection.shapes.find((shape) => shape.sourceObjectId === roofObject.id);
    expect(roofShape).toMatchObject({
      sourceType: "roof_plane",
      family: "pergola",
      kind: "roof_plane",
      sourceId: roofObject.sourceId,
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
      metadata: expect.objectContaining({ sourceId: "deck-main" }),
    });
    expect(normalizedPointSet(deckShape?.polygon ?? [])).toEqual(
      normalizedPointSet(deckObject.renderMesh.vertices.slice(0, deckObject.boundary.length).map(toPoint2)),
    );
    expect(normalizedPointSet(deckShape?.polygon ?? [])).not.toEqual(
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
      metadata: expect.objectContaining({ openingId: "opening-main" }),
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
      x: "world_x_right",
      y: "world_y_down",
    });
    expect(projection.extents?.widthMm).toBeGreaterThan(0);
    expect(projection.extents?.heightMm).toBeGreaterThan(0);
  });
});
