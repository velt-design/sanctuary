import { describe, expect, it } from 'vitest';
import type { GeometryConfig, HouseAttachmentStrategy, Line3, Point3, Polygon3 } from './contracts';
import { buildHouseModel3D, buildHouseReferenceGeometry } from './houseModel';

type HouseModel = NonNullable<ReturnType<typeof buildHouseModel3D>>;

function makeFootprint(widthMm = 6000, depthMm = 1800): Polygon3 {
  return [
    { x: 0, y: -depthMm, z: 0 },
    { x: widthMm, y: -depthMm, z: 0 },
    { x: widthMm, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
}

function pointOnSegment2D(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-2) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-2) return false;
  return dot <= dx * dx + dy * dy + 1e-2;
}

function pointInPolygon2D(candidate: { x: number; y: number }, polygon: Polygon3): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.y > candidate.y !== previous.y > candidate.y &&
      candidate.x < ((previous.x - current.x) * (candidate.y - current.y)) / (previous.y - current.y || 1) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInOrOnPolygon2D(candidate: { x: number; y: number }, polygon: Polygon3): boolean {
  return (
    pointInPolygon2D(candidate, polygon) ||
    polygon.some((start, index) => pointOnSegment2D(candidate, start, polygon[(index + 1) % polygon.length]!))
  );
}

function segmentInsidePolygon2D(
  start: { x: number; y: number },
  end: { x: number; y: number },
  polygon: Polygon3,
): boolean {
  return [0, 0.25, 0.5, 0.75, 1].every((sample) =>
    pointInOrOnPolygon2D(
      {
        x: start.x + (end.x - start.x) * sample,
        y: start.y + (end.y - start.y) * sample,
      },
      polygon,
    ),
  );
}

function roofPointKey(candidate: { x: number; y: number; z: number }): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)},${candidate.z.toFixed(3)}`;
}

function roofSegmentKey(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): string {
  const startKey = roofPointKey(start);
  const endKey = roofPointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function eavePolygonFromModel(model: HouseModel): Polygon3 {
  return (model.eave.gutterLines ?? []).map((candidate) => ({ x: candidate.start.x, y: candidate.start.y, z: 0 }));
}

function polygonAreaXY(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function signedPolygonAreaXY(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function reflexEaveVertices(model: HouseModel): Polygon3 {
  const eavePolygon = eavePolygonFromModel(model);
  const area = signedPolygonAreaXY(eavePolygon);
  return eavePolygon.filter((current, index) => {
    const previous = eavePolygon[(index - 1 + eavePolygon.length) % eavePolygon.length]!;
    const next = eavePolygon[(index + 1) % eavePolygon.length]!;
    const previousVector = { x: current.x - previous.x, y: current.y - previous.y };
    const nextVector = { x: next.x - current.x, y: next.y - current.y };
    const cross = previousVector.x * nextVector.y - previousVector.y * nextVector.x;
    return Math.sign(cross || 1) !== Math.sign(area || 1);
  });
}

function expectRoofFacetsCoverEaveOnce(model: HouseModel): void {
  const eaveArea = polygonAreaXY(eavePolygonFromModel(model));
  const facetArea = model.roofPlanes.reduce((sum, plane) => sum + polygonAreaXY(plane.boundary), 0);
  expect(Math.abs(facetArea - eaveArea)).toBeLessThan(100);
}

function expectRoofQaValid(model: HouseModel): void {
  expect(model.metadata?.roofQaStatus).toBe('valid');
  expect(model.eave.metadata?.roofQaStatus).toBe('valid');
  expect(typeof model.metadata?.roofQaFacetAreaMm2).toBe('number');
  expect(typeof model.metadata?.roofQaEaveAreaMm2).toBe('number');
  expect(typeof model.metadata?.roofQaAreaDeltaMm2).toBe('number');
  expect(model.metadata?.roofQaRejectedFacetCount).toBe(0);
  expect(model.metadata?.roofQaFailureReason).toBeNull();
  expect(model.roofPlanes.every((plane) => plane.metadata?.roofQaStatus === 'valid')).toBe(true);
  expect(model.roofFeatures?.every((feature) => feature.metadata?.roofQaStatus === 'valid')).toBe(true);
  expect(Math.abs(Number(model.metadata?.roofQaAreaDeltaMm2 ?? Number.NaN))).toBeLessThanOrEqual(100);
}

function expectRoofFacetsInsideEave(model: HouseModel, eaveHeightMm: number): void {
  const eavePolygon = eavePolygonFromModel(model);
  expect(eavePolygon.length).toBeGreaterThan(3);
  for (const roofPlane of model.roofPlanes) {
    for (let index = 0; index < roofPlane.boundary.length; index += 1) {
      const start = roofPlane.boundary[index]!;
      const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
      expect(segmentInsidePolygon2D(start, end, eavePolygon), `${roofPlane.id} segment ${index}`).toBe(true);
    }
  }
}

function roofBoundarySegmentCounts(model: HouseModel): Map<string, number> {
  const counts = new Map<string, number>();
  for (const roofPlane of model.roofPlanes) {
    for (let index = 0; index < roofPlane.boundary.length; index += 1) {
      const start = roofPlane.boundary[index]!;
      const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
      const key = roofSegmentKey(start, end);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function expectJoinedRoofFeaturesBackedByFinalFacets(model: HouseModel): void {
  const eavePolygon = eavePolygonFromModel(model);
  const counts = roofBoundarySegmentCounts(model);
  expect(model.roofFeatures?.length ?? 0).toBeGreaterThan(0);
  for (const feature of model.roofFeatures ?? []) {
    expect(feature.metadata?.roofFeatureSource, feature.id).toBe('facet_adjacency');
    expect(counts.get(roofSegmentKey(feature.line.start, feature.line.end)) ?? 0, feature.id).toBe(2);
    expect(segmentInsidePolygon2D(feature.line.start, feature.line.end, eavePolygon), feature.id).toBe(true);
  }
}

function expectRoofBoundaryEavePointsAtEaveHeight(model: HouseModel, eaveHeightMm: number): void {
  const eavePolygon = eavePolygonFromModel(model);
  for (const roofPlane of model.roofPlanes) {
    for (const candidate of roofPlane.boundary) {
      if (eavePolygon.some((start, index) => pointOnSegment2D(candidate, start, eavePolygon[(index + 1) % eavePolygon.length]!))) {
        expect(Math.abs(candidate.z - eaveHeightMm), `${roofPlane.id} ${roofPointKey(candidate)}`).toBeLessThanOrEqual(1);
      }
    }
  }
}

function expectValleysStartAtReentrantCorners(model: HouseModel, eaveHeightMm: number, expectedCount: number): void {
  const reflexVertices = reflexEaveVertices(model);
  const valleys = model.roofFeatures?.filter((feature) => feature.kind === 'valley') ?? [];
  expect(reflexVertices).toHaveLength(expectedCount);
  expect(valleys).toHaveLength(expectedCount);
  for (const vertex of reflexVertices) {
    const matchingValley = valleys.find(
      (feature) =>
        Math.abs(feature.line.start.x - vertex.x) <= 1 &&
        Math.abs(feature.line.start.y - vertex.y) <= 1 &&
        Math.abs(feature.line.start.z - eaveHeightMm) <= 1,
    );
    expect(matchingValley, `${vertex.x},${vertex.y}`).toBeDefined();
    expect(matchingValley?.metadata?.roofFeatureSource).toBe('facet_adjacency');
  }
}

function expectNoInternalEaveHeightRoofSeams(model: HouseModel, eaveHeightMm: number): void {
  const eavePolygon = eavePolygonFromModel(model);
  const internalSegments: string[] = [];
  for (const roofPlane of model.roofPlanes) {
    for (let index = 0; index < roofPlane.boundary.length; index += 1) {
      const start = roofPlane.boundary[index]!;
      const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
      if (Math.abs(start.z - eaveHeightMm) > 1 || Math.abs(end.z - eaveHeightMm) > 1) continue;
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
      const onEaveBoundary =
        eavePolygon.reduce((overlap, edgeStart, edgeIndex) => {
          const edgeEnd = eavePolygon[(edgeIndex + 1) % eavePolygon.length]!;
          if (!pointOnSegment2D(start, edgeStart, edgeEnd) && !pointOnSegment2D(end, edgeStart, edgeEnd)) {
            return overlap;
          }
          const axis = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'x' : 'y';
          const segmentMin = Math.min(start[axis], end[axis]);
          const segmentMax = Math.max(start[axis], end[axis]);
          const edgeMin = Math.min(edgeStart[axis], edgeEnd[axis]);
          const edgeMax = Math.max(edgeStart[axis], edgeEnd[axis]);
          return overlap + Math.max(0, Math.min(segmentMax, edgeMax) - Math.max(segmentMin, edgeMin));
        }, 0) >= segmentLength - 5;
      if (!onEaveBoundary) internalSegments.push(`${roofPlane.id}:${roofSegmentKey(start, end)}`);
    }
  }
  expect(internalSegments).toEqual([]);
  expect(model.metadata?.roofTopologyInternalEaveHeightSegmentCount).toBe(0);
}

function makeConfig(input: {
  footprint?: Polygon3;
  connectionType?: GeometryConfig['connection']['type'];
  attachmentSide?: GeometryConfig['connection']['attachmentSide'];
  strategy?: HouseAttachmentStrategy;
  eaveHeightMm?: number;
  wallHeightMm?: number;
  roofPitchDeg?: number;
  fasciaHeightMm?: number;
  eaveOverhangMm?: number;
} = {}): GeometryConfig {
  const footprint = input.footprint ?? makeFootprint();
  const strategy = input.strategy ?? 'soffit_brackets';
  const eaveHeightMm = input.eaveHeightMm ?? 2400;
  const wallHeightMm = input.wallHeightMm ?? eaveHeightMm;

  return {
    projectId: 'project_house',
    estimateId: 'estimate_house',
    designRequestId: null,
    family: 'mono',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: 6000, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 6000,
      projectionMm: 3000,
      roofPitchDeg: 5,
    },
    roof: {
      material: 'acrylic',
      mode: null,
      fallDirection: 'positiveY',
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: null,
      farEdgeGutterMode: null,
      houseSetbackMm: null,
      outerSetbackMm: null,
      effectiveRunMm: null,
      riseMm: null,
      maxFallMm: null,
    },
    connection: {
      type: input.connectionType ?? 'soffit',
      attachmentSide: input.attachmentSide ?? 'rear',
    },
    supports: {
      postMode: 'standard',
      postCount: 2,
      postCutHeightMm: 2400,
      footingType: 'slab',
      postConnectionType: 'slab_anchors',
      groundCondition: 'easy',
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: eaveHeightMm,
        outerUndersideMm: 2137,
        referenceUndersideMm: eaveHeightMm,
      },
      profiles: {
        post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
        rafter: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
        supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        gutter: { shape: 'rectangular', widthMm: 100, depthMm: 100 },
        ridge: null,
        boxPerimeter: null,
      },
      framing: {
        rafterCount: 11,
        rafterSpacingMm: 600,
      },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint,
      attachmentStrategy: strategy,
      model: {
        footprint,
        storeyMode: 'single_storey',
        wallConstruction: 'timber_frame',
        roofForm: 'hipped',
        eaveHeightMm,
        wallHeightMm,
        roofPitchDeg: input.roofPitchDeg ?? 25,
        attachmentStrategy: strategy,
        eave: {
          soffitDepthMm: 450,
          fasciaHeightMm: input.fasciaHeightMm ?? 180,
          gutterWidthMm: 125,
          gutterDepthMm: 90,
          gutterProjectionMm: 125,
          eaveOverhangMm: input.eaveOverhangMm ?? 450,
        },
      },
    },
  };
}

function makePlacedFootprint(input: { offsetX: number; width: number; facadeY?: number; depth?: number }): Polygon3 {
  const facadeY = input.facadeY ?? 0;
  const depth = input.depth ?? 1800;
  return [
    { x: input.offsetX, y: facadeY - depth, z: 0 },
    { x: input.offsetX + input.width, y: facadeY - depth, z: 0 },
    { x: input.offsetX + input.width, y: facadeY, z: 0 },
    { x: input.offsetX, y: facadeY, z: 0 },
  ];
}

function makeFrontFootprint(input: { offsetX?: number; width?: number; facadeY: number; depth?: number }): Polygon3 {
  const offsetX = input.offsetX ?? 0;
  const width = input.width ?? 6000;
  const depth = input.depth ?? 1800;
  return [
    { x: offsetX, y: input.facadeY + depth, z: 0 },
    { x: offsetX + width, y: input.facadeY + depth, z: 0 },
    { x: offsetX + width, y: input.facadeY, z: 0 },
    { x: offsetX, y: input.facadeY, z: 0 },
  ];
}

function makeLeftFootprint(input: { offsetY?: number; width?: number; facadeX: number; depth?: number }): Polygon3 {
  const offsetY = input.offsetY ?? 0;
  const width = input.width ?? 3000;
  const depth = input.depth ?? 1800;
  return [
    { x: input.facadeX - depth, y: offsetY, z: 0 },
    { x: input.facadeX - depth, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY, z: 0 },
  ];
}

function makeRightFootprint(input: { offsetY?: number; width?: number; facadeX: number; depth?: number }): Polygon3 {
  const offsetY = input.offsetY ?? 0;
  const width = input.width ?? 3000;
  const depth = input.depth ?? 1800;
  return [
    { x: input.facadeX + depth, y: offsetY, z: 0 },
    { x: input.facadeX + depth, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY + width, z: 0 },
    { x: input.facadeX, y: offsetY, z: 0 },
  ];
}

function makeAttachmentEdge(z = 2400) {
  return {
    start: { x: 0, y: 0, z },
    end: { x: 6000, y: 0, z },
  };
}

function expectPoint3CloseTo(actual: Point3 | undefined, expected: Point3): void {
  expect(actual).toBeDefined();
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
  expect(actual?.z).toBeCloseTo(expected.z, 6);
}

function lineLength3(line3: Line3): number {
  return Math.hypot(
    line3.end.x - line3.start.x,
    line3.end.y - line3.start.y,
    line3.end.z - line3.start.z,
  );
}

function runAxis(boundary: Polygon3): Point3 {
  const sourceLength = lineLength3({ start: boundary[0]!, end: boundary[1]! });
  return {
    x: (boundary[1]!.x - boundary[0]!.x) / sourceLength,
    y: (boundary[1]!.y - boundary[0]!.y) / sourceLength,
    z: (boundary[1]!.z - boundary[0]!.z) / sourceLength,
  };
}

function dotPointDeltaWithAxis(start: Point3, end: Point3, axis: Point3): number {
  return (end.x - start.x) * axis.x + (end.y - start.y) * axis.y + (end.z - start.z) * axis.z;
}

function expectRectangularBoundaryExtendedAlongRun(
  actual: Polygon3 | undefined,
  source: Polygon3,
  extensionMm: number,
): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(4);
  const axis = runAxis(source);
  expectPoint3CloseTo(actual?.[0], {
    x: source[0]!.x - axis.x * extensionMm,
    y: source[0]!.y - axis.y * extensionMm,
    z: source[0]!.z - axis.z * extensionMm,
  });
  expectPoint3CloseTo(actual?.[1], {
    x: source[1]!.x + axis.x * extensionMm,
    y: source[1]!.y + axis.y * extensionMm,
    z: source[1]!.z + axis.z * extensionMm,
  });
  expectPoint3CloseTo(actual?.[2], {
    x: source[2]!.x + axis.x * extensionMm,
    y: source[2]!.y + axis.y * extensionMm,
    z: source[2]!.z + axis.z * extensionMm,
  });
  expectPoint3CloseTo(actual?.[3], {
    x: source[3]!.x - axis.x * extensionMm,
    y: source[3]!.y - axis.y * extensionMm,
    z: source[3]!.z - axis.z * extensionMm,
  });
}

function expectSurfaceSolidBoundariesExtendAroundCorners(
  sourceBoundaries: Polygon3[],
  solidBoundaries: Polygon3[],
  extensionMm: number,
): void {
  expect(sourceBoundaries.length).toBeGreaterThan(0);
  expect(solidBoundaries).toHaveLength(sourceBoundaries.length);

  for (const [index, sourceBoundary] of sourceBoundaries.entries()) {
    expectRectangularBoundaryExtendedAlongRun(solidBoundaries[index], sourceBoundary, extensionMm);
  }

  for (const [index, sourceBoundary] of sourceBoundaries.entries()) {
    const nextIndex = (index + 1) % sourceBoundaries.length;
    const nextSourceBoundary = sourceBoundaries[nextIndex]!;
    const solidBoundary = solidBoundaries[index]!;
    const nextSolidBoundary = solidBoundaries[nextIndex]!;
    const axis = runAxis(sourceBoundary);
    const nextAxis = runAxis(nextSourceBoundary);
    const corner = sourceBoundary[1]!;

    expectPoint3CloseTo(nextSourceBoundary[0], corner);
    expect(dotPointDeltaWithAxis(corner, solidBoundary[1]!, axis)).toBeCloseTo(extensionMm, 6);
    expect(dotPointDeltaWithAxis(nextSolidBoundary[0]!, corner, nextAxis)).toBeCloseTo(extensionMm, 6);
  }
}

function expectHouseGutterSolidsExtendAroundCorners(model: HouseModel): void {
  const gutterLines = model.eave.gutterLines ?? [];
  const gutterSolids = model.solids?.linearSolids.filter((solid) => solid.kind === 'gutter') ?? [];

  expect(gutterLines.length).toBeGreaterThan(0);
  expect(gutterSolids).toHaveLength(gutterLines.length);

  for (const [index, gutterLine] of gutterLines.entries()) {
    const gutterSolid = gutterSolids[index]!;
    const sourceLength = lineLength3(gutterLine);
    const xAxis = {
      x: (gutterLine.end.x - gutterLine.start.x) / sourceLength,
      y: (gutterLine.end.y - gutterLine.start.y) / sourceLength,
      z: (gutterLine.end.z - gutterLine.start.z) / sourceLength,
    };
    const extensionMm = gutterSolid.profileWidthMm / 2;
    const centerlineZ = gutterLine.start.z - gutterSolid.profileDepthMm / 2;

    expectPoint3CloseTo(gutterSolid.centerline.start, {
      x: gutterLine.start.x - xAxis.x * extensionMm,
      y: gutterLine.start.y - xAxis.y * extensionMm,
      z: centerlineZ - xAxis.z * extensionMm,
    });
    expectPoint3CloseTo(gutterSolid.centerline.end, {
      x: gutterLine.end.x + xAxis.x * extensionMm,
      y: gutterLine.end.y + xAxis.y * extensionMm,
      z: centerlineZ + xAxis.z * extensionMm,
    });
    expectPoint3CloseTo(gutterSolid.localFrame.origin, gutterSolid.centerline.start);
    expect(gutterSolid.localFrame.xAxis.x).toBeCloseTo(xAxis.x, 6);
    expect(gutterSolid.localFrame.xAxis.y).toBeCloseTo(xAxis.y, 6);
    expect(gutterSolid.localFrame.xAxis.z).toBeCloseTo(xAxis.z, 6);
    expect(lineLength3(gutterSolid.centerline)).toBeCloseTo(sourceLength + gutterSolid.profileWidthMm, 6);
  }

  for (const [index, gutterLine] of gutterLines.entries()) {
    const nextIndex = (index + 1) % gutterLines.length;
    const nextGutterLine = gutterLines[nextIndex]!;
    const gutterSolid = gutterSolids[index]!;
    const nextGutterSolid = gutterSolids[nextIndex]!;
    const currentLength = lineLength3(gutterLine);
    const nextLength = lineLength3(nextGutterLine);
    const currentAxis = {
      x: (gutterLine.end.x - gutterLine.start.x) / currentLength,
      y: (gutterLine.end.y - gutterLine.start.y) / currentLength,
      z: (gutterLine.end.z - gutterLine.start.z) / currentLength,
    };
    const nextAxis = {
      x: (nextGutterLine.end.x - nextGutterLine.start.x) / nextLength,
      y: (nextGutterLine.end.y - nextGutterLine.start.y) / nextLength,
      z: (nextGutterLine.end.z - nextGutterLine.start.z) / nextLength,
    };
    const currentVertex = gutterLine.end;

    expectPoint3CloseTo(nextGutterLine.start, currentVertex);
    expect(
      (gutterSolid.centerline.end.x - currentVertex.x) * currentAxis.x +
        (gutterSolid.centerline.end.y - currentVertex.y) * currentAxis.y +
        (gutterSolid.centerline.end.z - (currentVertex.z - gutterSolid.profileDepthMm / 2)) * currentAxis.z,
    ).toBeCloseTo(gutterSolid.profileWidthMm / 2, 6);
    expect(
      (currentVertex.x - nextGutterSolid.centerline.start.x) * nextAxis.x +
        (currentVertex.y - nextGutterSolid.centerline.start.y) * nextAxis.y +
        (currentVertex.z - nextGutterSolid.profileDepthMm / 2 - nextGutterSolid.centerline.start.z) * nextAxis.z,
    ).toBeCloseTo(nextGutterSolid.profileWidthMm / 2, 6);
  }
}

function expectHouseWallAndFasciaSolidsExtendAroundCorners(model: HouseModel): void {
  const wallSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'wall') ?? [];
  const fasciaPolygons = model.eave.fasciaPolygons ?? [];
  const fasciaSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'fascia') ?? [];

  expectSurfaceSolidBoundariesExtendAroundCorners(
    model.wallSegments.map((segment) => segment.boundary),
    wallSolids.map((solid) => solid.boundary),
    45,
  );
  expect(wallSolids.every((solid) => solid.thicknessMm === 90)).toBe(true);
  expectSurfaceSolidBoundariesExtendAroundCorners(
    fasciaPolygons,
    fasciaSolids.map((solid) => solid.boundary),
    9,
  );
  expect(fasciaSolids.every((solid) => solid.thicknessMm === 18)).toBe(true);
}

describe('house model geometry builder', () => {
  it('builds walls, hipped roof planes, eave references, and a soffit attachment target', () => {
    const model = buildHouseModel3D({
      config: makeConfig({ wallHeightMm: 3100 }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    expect(model.wallSegments.map((segment) => segment.id)).toEqual([
      'house-wall-1',
      'house-wall-2',
      'house-wall-3',
      'house-wall-4',
    ]);
    expect(model.wallSegments[0]?.boundary[2]?.z).toBe(3100);
    expect(model.roofPlanes.map((plane) => plane.id)).toEqual([
      'house-roof-min-y',
      'house-roof-max-y',
      'house-roof-min-x',
      'house-roof-max-x',
    ]);
    expect(model.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === 'x')).toBe(true);
    expect(model.metadata?.roofGeometry).toBe('rectangular_hipped');
    expectRoofQaValid(model);
    expectRoofBoundaryEavePointsAtEaveHeight(model, 2400);
    expect(model.eave.gutterLines).toHaveLength(4);
    expect(model.eave.fasciaPolygons).toHaveLength(4);
    expect(model.eave.soffitPolygons).toHaveLength(4);
    expect(model.wallSegments[0]?.boundary[0]).toEqual({ x: 0, y: -1800, z: 0 });
    expect(model.wallSegments[0]?.boundary[1]).toEqual({ x: 6000, y: -1800, z: 0 });
    expect(model.eave.gutterLines?.[0]?.start).toEqual({ x: -450, y: -2250, z: 2400 });
    expect(model.eave.gutterLines?.[0]?.end).toEqual({ x: 6450, y: -2250, z: 2400 });
    expect(model.eave.fasciaPolygons?.[0]?.[0]).toEqual({ x: -450, y: -2250, z: 2400 });
    expect(model.eave.fasciaPolygons?.[0]?.[1]).toEqual({ x: 6450, y: -2250, z: 2400 });
    expect(model.eave.fasciaPolygons?.[0]?.[2]?.z).toBe(2220);
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'wall')).toHaveLength(4);
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'roof')).toHaveLength(4);
    expect(model.solids?.linearSolids).toHaveLength(4);
    expect(model.solids?.linearSolids[0]).toMatchObject({
      kind: 'gutter',
      profileWidthMm: 125,
      profileDepthMm: 90,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'wall')?.boundary[0], {
      x: -45,
      y: -1800,
      z: 0,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'fascia')?.boundary[0], {
      x: -459,
      y: -2250,
      z: 2400,
    });
    expectHouseWallAndFasciaSolidsExtendAroundCorners(model);
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.start, { x: -512.5, y: -2250, z: 2355 });
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.end, { x: 6512.5, y: -2250, z: 2355 });
    expectHouseGutterSolidsExtendAroundCorners(model);
    expect(model.attachmentTarget?.kind).toBe('line');
    expect(model.attachmentTarget?.line).toEqual(makeAttachmentEdge());
  });

  it('builds wall/eave geometry and selected-facade targets from a custom recessed footprint', () => {
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
        strategy: 'facade_ledger',
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
      { start: { x: -1000, y: -1400, z: 0 }, end: { x: -2000, y: -1400, z: 0 } },
      { start: { x: -2000, y: -1400, z: 0 }, end: { x: -2000, y: -2600, z: 0 } },
      { start: { x: -2000, y: -2600, z: 0 }, end: { x: -1000, y: -2600, z: 0 } },
    ]);
    expect(model?.eave.gutterLines).toHaveLength(7);
    expect(model?.eave.gutterLines?.[0]?.start).toEqual({ x: -1000, y: -3050, z: 2400 });
    expect(model?.roofPlanes.every((plane) => Number.isFinite(plane.boundary[0]?.x))).toBe(true);
    expect(model?.roofPlanes.length).toBeGreaterThan(3);
    expect(model?.roofPlanes.every((plane) => !plane.id.includes('house-roof-wing'))).toBe(true);
    expect(model?.roofFeatures?.some((feature) => feature.kind === 'ridge')).toBe(true);
    expect(model?.roofFeatures?.some((feature) => feature.kind === 'hip')).toBe(true);
    expect(model?.roofFeatures?.some((feature) => feature.kind === 'valley')).toBe(true);
    expect(model?.roofFeatures?.every((feature) => feature.metadata?.roofGeometry === 'rectilinear_joined_hipped')).toBe(true);
    expect(model?.metadata?.roofGeometry).toBe('rectilinear_joined_hipped');
    expect(model?.metadata?.roofFacetMergeMode).toBe('active_rectilinear_wavefront');
    expect(model?.metadata?.roofFacetCount).toBe(model?.roofPlanes.length);
    expect(model?.metadata?.roofTopologyFinalFaceCount).toBe(model?.roofPlanes.length);
    expect(model?.metadata?.roofTopologyDisconnectedSourceFaceCount).toBe(0);
    expect(Number(model?.metadata?.roofFacetCount ?? 0)).toBeLessThan(Number(model?.metadata?.roofSplitRegionCount ?? Number.POSITIVE_INFINITY));
    expect(model?.metadata?.roofWingCount).toBeUndefined();
    expectRoofQaValid(model!);
    expectRoofFacetsInsideEave(model!, 2400);
    expectRoofBoundaryEavePointsAtEaveHeight(model!, 2400);
    expectNoInternalEaveHeightRoofSeams(model!, 2400);
    expectRoofFacetsCoverEaveOnce(model!);
    expectJoinedRoofFeaturesBackedByFinalFacets(model!);
    expect(model?.solids?.surfaceSolids.filter((solid) => solid.kind === 'roof')).toHaveLength(model?.roofPlanes.length ?? 0);
    expect(model?.solids?.linearSolids).toHaveLength(7);
    expectHouseWallAndFasciaSolidsExtendAroundCorners(model);
    expectHouseGutterSolidsExtendAroundCorners(model);
    expect(model?.attachmentTarget?.kind).toBe('plane');
    expect(model?.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
  });

  it('keeps screenshot-style U roof facets inside the eave polygon void', () => {
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
        attachmentSide: 'front',
        strategy: 'fascia_under_gutter',
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

    expect(model?.metadata?.roofGeometry).toBe('rectilinear_joined_hipped');
    expect(model?.metadata?.roofFacetMergeMode).toBe('active_rectilinear_wavefront');
    expect(model?.metadata?.roofRejectedFacetCount).toBe(0);
    expect(model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expectRoofQaValid(model!);
    expect(model?.roofPlanes).toHaveLength(model?.eave.gutterLines?.length ?? 0);
    expect(model?.roofPlanes).toHaveLength(8);
    expect(model?.metadata?.roofTopologyFinalFaceCount).toBe(model?.roofPlanes.length);
    expect(model?.metadata?.roofTopologySourceEdgeCount).toBe(model?.eave.gutterLines?.length);
    expect(model?.metadata?.roofTopologyDisconnectedSourceFaceCount).toBe(0);
    expect(model?.metadata?.roofTopologyValleyCount).toBe(2);
    expect(Number(model?.metadata?.roofFacetCount ?? 0)).toBeLessThan(Number(model?.metadata?.roofSplitRegionCount ?? Number.POSITIVE_INFINITY));
    expect(Number(model?.metadata?.roofFacetCount ?? 0)).toBeLessThan(Number(model?.metadata?.roofWavefrontAtomCount ?? Number.POSITIVE_INFINITY));
    expect(model?.roofPlanes.every((plane) => !plane.id.includes('house-roof-wing'))).toBe(true);
    expect(model?.roofPlanes.every((plane) => Number.isFinite(plane.boundary[0]?.x))).toBe(true);
    expect(model?.roofFeatures?.map((feature) => feature.kind)).toEqual(expect.arrayContaining(['ridge', 'hip', 'valley']));
    expectRoofFacetsInsideEave(model!, 2500);
    expectRoofBoundaryEavePointsAtEaveHeight(model!, 2500);
    expectNoInternalEaveHeightRoofSeams(model!, 2500);
    expectRoofFacetsCoverEaveOnce(model!);
    expectJoinedRoofFeaturesBackedByFinalFacets(model!);
    expectValleysStartAtReentrantCorners(model!, 2500, 2);
    expect(model?.solids?.surfaceSolids.filter((solid) => solid.kind === 'roof')).toHaveLength(model?.roofPlanes.length ?? 0);
  });

  it('keeps side-attached L roof features backed by the final joined facets', () => {
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
        attachmentSide: 'left',
        strategy: 'soffit_brackets',
        eaveHeightMm: 2500,
        wallHeightMm: 2800,
        roofPitchDeg: 20,
        eaveOverhangMm: 600,
      }),
      attachmentEdge: makeAttachmentEdge(2500),
    });

    expect(model?.metadata?.roofGeometry).toBe('rectilinear_joined_hipped');
    expect(model?.metadata?.roofFacetMergeMode).toBe('active_rectilinear_wavefront');
    expect(model?.metadata?.roofFallbackFeatureCount).toBe(0);
    expectRoofQaValid(model!);
    expect(model?.metadata?.roofTopologyDisconnectedSourceFaceCount).toBe(0);
    expect(model?.roofPlanes.every((plane) => !plane.id.includes('house-roof-wing'))).toBe(true);
    expect(model?.roofFeatures?.map((feature) => feature.kind)).toEqual(expect.arrayContaining(['ridge', 'hip', 'valley']));
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

  it('builds a fascia-under-gutter zone with clamped safe line bounds', () => {
    const model = buildHouseModel3D({
      config: makeConfig({ strategy: 'fascia_under_gutter', fasciaHeightMm: 180 }),
      attachmentEdge: makeAttachmentEdge(2600),
    });

    expect(model?.attachmentTarget?.kind).toBe('zone');
    expect(model?.attachmentTarget?.strategy).toBe('fascia_under_gutter');
    expect(model?.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
    expect(model?.attachmentTarget?.zone?.topZMm).toBe(2400);
    expect(model?.attachmentTarget?.zone?.bottomZMm).toBe(2220);
    expect(model?.attachmentTarget?.zone?.safeLine?.start.z).toBe(2400);
    expect(model?.attachmentTarget?.zone?.boundary?.[0]?.z).toBe(2220);
  });

  it('projects fascia-under-gutter targets onto the setback house facade while preserving legacy references', () => {
    const originalAttachmentEdge = makeAttachmentEdge(2600);
    const house = buildHouseReferenceGeometry({
      config: makeConfig({
        footprint: makePlacedFootprint({ offsetX: -1000, width: 8000, facadeY: -400, depth: 2000 }),
        connectionType: 'fascia',
        strategy: 'fascia_under_gutter',
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

  it('projects front-side attachment targets onto the selected front facade while preserving solver references', () => {
    const originalAttachmentEdge = makeAttachmentEdge(2600);
    const house = buildHouseReferenceGeometry({
      config: makeConfig({
        attachmentSide: 'front',
        footprint: makeFrontFootprint({ offsetX: -1000, width: 8000, facadeY: 3400, depth: 2000 }),
        connectionType: 'fascia',
        strategy: 'fascia_under_gutter',
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

  it('clips left-side soffit bracket targets to the overlapping selected side facade span', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        attachmentSide: 'left',
        footprint: makeLeftFootprint({ offsetY: 500, width: 2000, facadeX: -300, depth: 1200 }),
        strategy: 'soffit_brackets',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe('line');
    expect(model?.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: -300, y: 500, z: 2400 },
      end: { x: -300, y: 2500, z: 2400 },
    });
  });

  it('selects the right-side wall source for side facade ledger targets', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        attachmentSide: 'right',
        footprint: makeRightFootprint({ offsetY: 500, width: 2000, facadeX: 6300, depth: 1200 }),
        strategy: 'facade_ledger',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe('plane');
    expect(model?.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: 6300, y: 500, z: 2400 },
      end: { x: 6300, y: 2500, z: 2400 },
    });
    expect(model?.attachmentTarget?.plane?.origin.x).toBe(6300);
  });

  it('selects the selected-side source wall for post-supported tieback metadata', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        attachmentSide: 'left',
        footprint: makeLeftFootprint({ offsetY: 250, width: 2000, facadeX: -400, depth: 1200 }),
        strategy: 'post_supported_tieback',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe('metadata_only');
    expect(model?.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
    expect(model?.attachmentTarget?.metadata).toEqual({ tieback: true });
  });

  it('clips projected attachment target spans to the overlapping house facade width', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: makePlacedFootprint({ offsetX: 1000, width: 3000 }),
        strategy: 'soffit_brackets',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe('line');
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: 1000, y: 0, z: 2400 },
      end: { x: 4000, y: 0, z: 2400 },
    });
  });

  it('emits no visible attachment target line when the pergola span does not overlap the selected facade', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: makePlacedFootprint({ offsetX: 7000, width: 1000 }),
        strategy: 'soffit_brackets',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe('line');
    expect(model?.attachmentTarget?.line).toBeNull();
    expect(model?.attachmentTarget?.metadata).toEqual({
      attachmentSpanStatus: 'no_overlap',
    });
  });

  it('uses projected facade lines for facade ledger targets', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: makePlacedFootprint({ offsetX: -500, width: 7000, facadeY: -300 }),
        strategy: 'facade_ledger',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.attachmentTarget?.kind).toBe('plane');
    expect(model?.attachmentTarget?.line).toEqual({
      start: { x: 0, y: -300, z: 2400 },
      end: { x: 6000, y: -300, z: 2400 },
    });
    expect(model?.attachmentTarget?.plane?.origin.y).toBe(-300);
  });

  it('maps attachment strategies into deterministic target kinds', () => {
    const cases: Array<[HouseAttachmentStrategy, string]> = [
      ['soffit_brackets', 'line'],
      ['fascia_under_gutter', 'zone'],
      ['facade_ledger', 'plane'],
      ['post_supported_tieback', 'metadata_only'],
      ['none', 'none'],
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

  it('uses ridge-axis and pyramid roof metadata for long, deep, and square footprints', () => {
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

    expect(wide?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === 'x')).toBe(true);
    expect(deep?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === 'y')).toBe(true);
    expect(square?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === 'pyramid')).toBe(true);
    expect(square?.roofPlanes.every((plane) => plane.boundary.length === 3)).toBe(true);
  });

  it('uses wall height for facade boundaries and eave height for roof and gutter references', () => {
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

  it('threads house model geometry into house reference output and keeps freestanding null', () => {
    const attached = buildHouseReferenceGeometry({
      config: makeConfig({ connectionType: 'fascia', strategy: 'fascia_under_gutter' }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const freestanding = buildHouseReferenceGeometry({
      config: makeConfig({
        connectionType: 'freestanding',
        strategy: 'soffit_brackets',
      }),
      attachmentEdge: null,
    });

    expect(attached.wallPlane?.normal).toEqual({ x: 0, y: -1, z: 0 });
    expect(attached.fasciaLine).toEqual(makeAttachmentEdge());
    expect(attached.model?.roofPlanes).toHaveLength(4);
    expect(attached.attachmentTarget?.kind).toBe('zone');
    expect(freestanding.wallPlane).toBeNull();
    expect(freestanding.model).toBeNull();
    expect(freestanding.attachmentTarget).toBeNull();
  });
});
