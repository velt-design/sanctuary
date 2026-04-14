import { describe, expect, it } from 'vitest';
import type { GeometryConfig, HouseAttachmentStrategy, HouseRoofMaterial, Line3, Point3, Polygon3, RenderMesh3D } from './contracts';
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

function roofBoundarySegments(model: HouseModel): Map<string, Array<{ roofPlaneIndex: number; edgeIndex: number }>> {
  const segments = new Map<string, Array<{ roofPlaneIndex: number; edgeIndex: number }>>();
  for (const [roofPlaneIndex, roofPlane] of model.roofPlanes.entries()) {
    for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
      const start = roofPlane.boundary[edgeIndex]!;
      const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
      const key = roofSegmentKey(start, end);
      const references = segments.get(key) ?? [];
      references.push({ roofPlaneIndex, edgeIndex });
      segments.set(key, references);
    }
  }
  return segments;
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
  roofMaterial?: HouseRoofMaterial;
  fasciaHeightMm?: number;
  gutterWidthMm?: number;
  gutterProjectionMm?: number;
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
        roofMaterial: input.roofMaterial,
        eaveHeightMm,
        wallHeightMm,
        roofPitchDeg: input.roofPitchDeg ?? 25,
        attachmentStrategy: strategy,
        eave: {
          soffitDepthMm: 450,
          fasciaHeightMm: input.fasciaHeightMm ?? 180,
          gutterWidthMm: input.gutterWidthMm ?? 125,
          gutterDepthMm: 90,
          gutterProjectionMm: input.gutterProjectionMm ?? 125,
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

function pointDistanceSquared3(first: Point3, second: Point3): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2 + (first.z - second.z) ** 2;
}

function vectorLength3(vector: Point3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalizeVector3(vector: Point3): Point3 {
  const length = vectorLength3(vector);
  return length > 0 ? { x: vector.x / length, y: vector.y / length, z: vector.z / length } : { x: 0, y: 0, z: 0 };
}

function dotPoint3(first: Point3, second: Point3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function expectUnorderedSegment3CloseTo(
  firstStart: Point3,
  firstEnd: Point3,
  secondStart: Point3,
  secondEnd: Point3,
): void {
  const directDistance = pointDistanceSquared3(firstStart, secondStart) + pointDistanceSquared3(firstEnd, secondEnd);
  const reversedDistance = pointDistanceSquared3(firstStart, secondEnd) + pointDistanceSquared3(firstEnd, secondStart);
  if (directDistance <= reversedDistance) {
    expectPoint3CloseTo(firstStart, secondStart);
    expectPoint3CloseTo(firstEnd, secondEnd);
  } else {
    expectPoint3CloseTo(firstStart, secondEnd);
    expectPoint3CloseTo(firstEnd, secondStart);
  }
}

function lineLength3(line3: Line3): number {
  return Math.hypot(
    line3.end.x - line3.start.x,
    line3.end.y - line3.start.y,
    line3.end.z - line3.start.z,
  );
}

function crossPoint3(first: Point3, second: Point3): Point3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}

function subtractPoint3(first: Point3, second: Point3): Point3 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  };
}

function distanceToLine3D(candidate: Point3, source: Line3): number {
  const axis = subtractPoint3(source.end, source.start);
  const length = vectorLength3(axis);
  if (length <= 1e-6) return vectorLength3(subtractPoint3(candidate, source.start));
  return vectorLength3(crossPoint3(subtractPoint3(candidate, source.start), axis)) / length;
}

function expectPolygon3CloseTo(actual: Polygon3 | undefined, expected: Polygon3): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(expected.length);
  for (const [index, point] of expected.entries()) {
    expectPoint3CloseTo(actual?.[index], point);
  }
}

function expectSolidBoundariesExact(
  sourceBoundaries: Polygon3[],
  solidBoundaries: Polygon3[],
): void {
  expect(sourceBoundaries.length).toBeGreaterThan(0);
  expect(solidBoundaries).toHaveLength(sourceBoundaries.length);

  for (const [index, sourceBoundary] of sourceBoundaries.entries()) {
    expectPolygon3CloseTo(solidBoundaries[index], sourceBoundary);
  }
}

function expectVerticalPrismRenderMesh(renderMesh: RenderMesh3D | undefined, bottomZ: number, topZ: number): void {
  expect(renderMesh).toBeDefined();
  expect(renderMesh?.vertices).toHaveLength(8);
  expect(renderMesh?.faces).toHaveLength(12);
  for (const vertex of renderMesh?.vertices.slice(0, 4) ?? []) {
    expect(vertex.z).toBeCloseTo(bottomZ, 6);
  }
  for (const vertex of renderMesh?.vertices.slice(4) ?? []) {
    expect(vertex.z).toBeCloseTo(topZ, 6);
  }
}

function expectMiteredRenderMeshesAroundCorners(
  renderMeshes: Array<RenderMesh3D | undefined>,
  bottomZ: number,
  topZ: number,
): void {
  expect(renderMeshes.length).toBeGreaterThan(0);
  for (const renderMesh of renderMeshes) {
    expectVerticalPrismRenderMesh(renderMesh, bottomZ, topZ);
  }

  for (const [index, renderMesh] of renderMeshes.entries()) {
    const nextRenderMesh = renderMeshes[(index + 1) % renderMeshes.length]!;
    expectPoint3CloseTo(renderMesh?.vertices[1], nextRenderMesh?.vertices[0]!);
    expectPoint3CloseTo(renderMesh?.vertices[2], nextRenderMesh?.vertices[3]!);
    expectPoint3CloseTo(renderMesh?.vertices[5], nextRenderMesh?.vertices[4]!);
    expectPoint3CloseTo(renderMesh?.vertices[6], nextRenderMesh?.vertices[7]!);
  }
}

function polygonOutwardVectorXY(polygon: Polygon3, edgeIndex: number): { x: number; y: number } {
  const start = polygon[edgeIndex]!;
  const end = polygon[(edgeIndex + 1) % polygon.length]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return { x: 0, y: 0 };
  const area = signedPolygonAreaXY(polygon);
  return area >= 0
    ? { x: dy / length, y: -dx / length }
    : { x: -dy / length, y: dx / length };
}

function expectHouseGutterBoundariesUseProjection(model: HouseModel): void {
  const eavePolygon = eavePolygonFromModel(model);
  const gutterBoundaries = model.eave.gutterBoundaries ?? [];
  const gutterLines = model.eave.gutterLines ?? [];
  const gutterSolids = model.solids?.linearSolids.filter((solid) => solid.kind === 'gutter') ?? [];
  const outerOffsetMm = model.eave.gutterProjectionMm ?? 0;

  expect(gutterBoundaries).toHaveLength(gutterLines.length);

  for (const [index, boundary] of gutterBoundaries.entries()) {
    const gutterLine = gutterLines[index]!;
    const gutterSolid = gutterSolids[index]!;
    const outward = polygonOutwardVectorXY(eavePolygon, index);
    const innerOffsetMm = outerOffsetMm - gutterSolid.profileWidthMm;
    const offsets = boundary.map(
      (candidate) =>
        (candidate.x - gutterLine.start.x) * outward.x +
        (candidate.y - gutterLine.start.y) * outward.y,
    );

    expectPolygon3CloseTo(boundary, [
      {
        x: gutterSolid.renderMesh!.vertices[4]!.x,
        y: gutterSolid.renderMesh!.vertices[4]!.y,
        z: gutterLine.start.z,
      },
      {
        x: gutterSolid.renderMesh!.vertices[5]!.x,
        y: gutterSolid.renderMesh!.vertices[5]!.y,
        z: gutterLine.start.z,
      },
      {
        x: gutterSolid.renderMesh!.vertices[6]!.x,
        y: gutterSolid.renderMesh!.vertices[6]!.y,
        z: gutterLine.start.z,
      },
      {
        x: gutterSolid.renderMesh!.vertices[7]!.x,
        y: gutterSolid.renderMesh!.vertices[7]!.y,
        z: gutterLine.start.z,
      },
    ]);
    expect(offsets[0]).toBeCloseTo(outerOffsetMm, 6);
    expect(offsets[1]).toBeCloseTo(outerOffsetMm, 6);
    expect(offsets[2]).toBeCloseTo(innerOffsetMm, 6);
    expect(offsets[3]).toBeCloseTo(innerOffsetMm, 6);
  }

  for (const [index, boundary] of gutterBoundaries.entries()) {
    const nextBoundary = gutterBoundaries[(index + 1) % gutterBoundaries.length]!;
    expectPoint3CloseTo(boundary[1], nextBoundary[0]!);
    expectPoint3CloseTo(boundary[2], nextBoundary[3]!);
  }
}

function expectHouseGutterSolidsMiteredAroundCorners(model: HouseModel): void {
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
    const centerlineZ = gutterLine.start.z - gutterSolid.profileDepthMm / 2;

    expectPoint3CloseTo(gutterSolid.centerline.start, {
      x: gutterLine.start.x,
      y: gutterLine.start.y,
      z: centerlineZ,
    });
    expectPoint3CloseTo(gutterSolid.centerline.end, {
      x: gutterLine.end.x,
      y: gutterLine.end.y,
      z: centerlineZ,
    });
    expectPoint3CloseTo(gutterSolid.localFrame.origin, gutterSolid.centerline.start);
    expect(gutterSolid.localFrame.xAxis.x).toBeCloseTo(xAxis.x, 6);
    expect(gutterSolid.localFrame.xAxis.y).toBeCloseTo(xAxis.y, 6);
    expect(gutterSolid.localFrame.xAxis.z).toBeCloseTo(xAxis.z, 6);
    expect(lineLength3(gutterSolid.centerline)).toBeCloseTo(sourceLength, 6);
    expectVerticalPrismRenderMesh(gutterSolid.renderMesh, centerlineZ - gutterSolid.profileDepthMm / 2, centerlineZ + gutterSolid.profileDepthMm / 2);
  }

  expectMiteredRenderMeshesAroundCorners(
    gutterSolids.map((solid) => solid.renderMesh),
    gutterSolids[0]!.centerline.start.z - gutterSolids[0]!.profileDepthMm / 2,
    gutterSolids[0]!.centerline.start.z + gutterSolids[0]!.profileDepthMm / 2,
  );
  expectHouseGutterBoundariesUseProjection(model);
}

function expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes(model: HouseModel): void {
  const wallSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'wall') ?? [];
  const fasciaPolygons = model.eave.fasciaPolygons ?? [];
  const fasciaSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'fascia') ?? [];
  const soffitPolygons = model.eave.soffitPolygons ?? [];
  const soffitSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'soffit') ?? [];

  expectSolidBoundariesExact(
    model.wallSegments.map((segment) => segment.boundary),
    wallSolids.map((solid) => solid.boundary),
  );
  expect(wallSolids.every((solid) => solid.thicknessMm === 90)).toBe(true);
  expectMiteredRenderMeshesAroundCorners(wallSolids.map((solid) => solid.renderMesh), 0, model.wallSegments[0]!.boundary[2]!.z);
  expectSolidBoundariesExact(
    fasciaPolygons,
    fasciaSolids.map((solid) => solid.boundary),
  );
  expect(fasciaSolids.every((solid) => solid.thicknessMm === 18)).toBe(true);
  expectMiteredRenderMeshesAroundCorners(fasciaSolids.map((solid) => solid.renderMesh), 2220, 2400);
  expectSolidBoundariesExact(
    soffitPolygons,
    soffitSolids.map((solid) => solid.boundary),
  );
  expect(soffitSolids.every((solid) => solid.thicknessMm === 10)).toBe(true);
  expectMiteredRenderMeshesAroundCorners(soffitSolids.map((solid) => solid.renderMesh), 2395, 2405);
}

function expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model: HouseModel): void {
  const roofSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'roof') ?? [];

  expect(roofSolids).toHaveLength(model.roofPlanes.length);
  expectSolidBoundariesExact(
    model.roofPlanes.map((roofPlane) => roofPlane.boundary),
    roofSolids.map((solid) => solid.boundary),
  );

  for (const [roofPlaneIndex, roofPlane] of model.roofPlanes.entries()) {
    const roofSolid = roofSolids[roofPlaneIndex]!;
    const renderMesh = roofSolid.renderMesh;
    const roofNormal = normalizeVector3(roofPlane.plane.normal);
    const topPlaneConstant = dotPoint3(roofNormal, roofPlane.plane.origin);
    const expectedBottomPlaneOffset = roofNormal.z >= 0 ? -120 : 120;

    expect(roofSolid.thicknessMm).toBe(120);
    expect(renderMesh).toBeDefined();
    expect(renderMesh?.vertices).toHaveLength(roofPlane.boundary.length * 2);
    expect(renderMesh?.faces.length).toBeGreaterThan(0);
    expectPolygon3CloseTo(renderMesh?.vertices.slice(0, roofPlane.boundary.length), roofPlane.boundary);

    for (const bottomVertex of renderMesh?.vertices.slice(roofPlane.boundary.length) ?? []) {
      expect(dotPoint3(roofNormal, bottomVertex) - topPlaneConstant).toBeCloseTo(expectedBottomPlaneOffset, 4);
    }
  }

  for (const references of roofBoundarySegments(model).values()) {
    if (references.length !== 2) continue;
    const [firstReference, secondReference] = references;
    const firstSolid = roofSolids[firstReference!.roofPlaneIndex]!;
    const secondSolid = roofSolids[secondReference!.roofPlaneIndex]!;
    const firstBoundaryLength = firstSolid.boundary.length;
    const secondBoundaryLength = secondSolid.boundary.length;
    const firstNext = (firstReference!.edgeIndex + 1) % firstBoundaryLength;
    const secondNext = (secondReference!.edgeIndex + 1) % secondBoundaryLength;

    expectUnorderedSegment3CloseTo(
      firstSolid.renderMesh!.vertices[firstBoundaryLength + firstReference!.edgeIndex]!,
      firstSolid.renderMesh!.vertices[firstBoundaryLength + firstNext]!,
      secondSolid.renderMesh!.vertices[secondBoundaryLength + secondReference!.edgeIndex]!,
      secondSolid.renderMesh!.vertices[secondBoundaryLength + secondNext]!,
    );
  }
}

function expectHouseRoofFeatureFlashings(model: HouseModel, expectedKinds: Array<'ridge' | 'hip' | 'valley'>): void {
  const featureById = new Map((model.roofFeatures ?? []).map((feature) => [feature.id, feature]));
  const roofSegments = roofBoundarySegments(model);
  const expectedFeatures = (model.roofFeatures ?? []).filter((feature) => {
    if (feature.metadata?.roofFeatureSource === 'reentrant_fallback') return false;
    return (roofSegments.get(roofSegmentKey(feature.line.start, feature.line.end)) ?? []).length === 2;
  });
  const flashings = model.roofFlashings ?? [];

  expect(flashings).toHaveLength(expectedFeatures.length);
  expect(flashings.map((flashing) => flashing.metadata?.featureKind)).toEqual(expect.arrayContaining(expectedKinds));

  for (const flashing of flashings) {
    const sourceFeatureId = flashing.metadata?.sourceFeatureId;
    const feature = typeof sourceFeatureId === 'string' ? featureById.get(sourceFeatureId) : undefined;
    expect(feature, flashing.id).toBeDefined();
    if (!feature) continue;

    const adjacentReferences = roofSegments.get(roofSegmentKey(feature.line.start, feature.line.end)) ?? [];
    const adjacentPlaneIndexes = adjacentReferences.map((reference) => reference.roofPlaneIndex).sort((a, b) => a - b);

    expect(flashing.thicknessMm).toBe(1);
    expect(flashing.metadata).toMatchObject({
      source: 'house_model',
      sourceFeatureId: feature.id,
      featureKind: feature.kind,
      position: feature.kind,
      girthMm: 300,
      wingLengthMm: 150,
      thicknessMm: 1,
      surfaceOffsetMm: 0.5,
    });
    expect(flashing.wings).toHaveLength(2);

    const wingPlaneIndexes = flashing.wings.map((wing) => {
      expect(wing.boundary.length, wing.id).toBeGreaterThanOrEqual(3);
      expect(wing.boundary.every((candidate) => Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z))).toBe(true);
      expect(Math.min(...wing.boundary.map((candidate) => distanceToLine3D(candidate, feature.line))), wing.id).toBeLessThanOrEqual(1);
      expect(Math.max(...wing.boundary.map((candidate) => distanceToLine3D(candidate, feature.line))), wing.id).toBeLessThanOrEqual(151);

      const roofPlaneIndex = model.roofPlanes.findIndex((roofPlane) => wing.id === `${flashing.id}-${roofPlane.id}-wing`);
      expect(roofPlaneIndex, wing.id).toBeGreaterThanOrEqual(0);

      const roofPlane = model.roofPlanes[roofPlaneIndex]!;
      const roofNormal = normalizeVector3(roofPlane.plane.normal);
      const topNormal = roofNormal.z >= 0 ? roofNormal : { x: -roofNormal.x, y: -roofNormal.y, z: -roofNormal.z };
      const topPlaneConstant = dotPoint3(topNormal, roofPlane.plane.origin);
      const projectedBoundary = wing.boundary.map((candidate) => ({
        x: candidate.x - topNormal.x * 0.5,
        y: candidate.y - topNormal.y * 0.5,
        z: candidate.z - topNormal.z * 0.5,
      }));
      for (let index = 0; index < projectedBoundary.length; index += 1) {
        expect(
          segmentInsidePolygon2D(projectedBoundary[index]!, projectedBoundary[(index + 1) % projectedBoundary.length]!, roofPlane.boundary),
          `${wing.id} edge ${index}`,
        ).toBe(true);
      }
      for (const candidate of wing.boundary) {
        expect(dotPoint3(topNormal, candidate) - topPlaneConstant, `${wing.id} ${roofPointKey(candidate)}`).toBeCloseTo(0.5, 3);
      }

      return roofPlaneIndex;
    }).sort((a, b) => a - b);

    expect(wingPlaneIndexes, flashing.id).toEqual(adjacentPlaneIndexes);
  }
}

function expectHouseRoofMaterialVisuals(model: HouseModel, material: HouseRoofMaterial): void {
  const visuals = model.roofMaterialVisuals ?? [];

  expect(model.roofMaterial).toBe(material);
  expect(visuals.length).toBeGreaterThan(0);
  expect(visuals.every((visual) => visual.material === material)).toBe(true);

  for (const visual of visuals) {
    const roofPlane = model.roofPlanes.find((candidate) => candidate.id === visual.roofPlaneId);
    expect(roofPlane, visual.id).toBeDefined();
    if (!roofPlane) continue;

    const roofNormal = normalizeVector3(roofPlane.plane.normal);
    const topNormal = roofNormal.z >= 0 ? roofNormal : { x: -roofNormal.x, y: -roofNormal.y, z: -roofNormal.z };
    const topPlaneConstant = dotPoint3(topNormal, roofPlane.plane.origin);
    const fallAxis = normalizeVector3(roofPlane.fallVector);

    expect(visual.surfaceOffsetMm).toBe(2);
    expect(visual.lines.length, visual.id).toBeGreaterThan(0);
    expect(visual.metadata).toMatchObject({
      source: 'house_model',
      sourceRoofPlaneId: roofPlane.id,
      material,
      lineCount: visual.lines.length,
    });

    for (const materialLine of visual.lines) {
      for (const candidate of [materialLine.start, materialLine.end]) {
        expect(dotPoint3(topNormal, candidate) - topPlaneConstant, `${visual.id} ${roofPointKey(candidate)}`).toBeCloseTo(2, 3);
      }

      const projectedStart = {
        x: materialLine.start.x - topNormal.x * 2,
        y: materialLine.start.y - topNormal.y * 2,
        z: materialLine.start.z - topNormal.z * 2,
      };
      const projectedEnd = {
        x: materialLine.end.x - topNormal.x * 2,
        y: materialLine.end.y - topNormal.y * 2,
        z: materialLine.end.z - topNormal.z * 2,
      };
      expect(segmentInsidePolygon2D(projectedStart, projectedEnd, roofPlane.boundary), `${visual.id} clipped`).toBe(true);

      const lineDirection = normalizeVector3(subtractPoint3(materialLine.end, materialLine.start));
      if (material === 'shingles') {
        expect(Math.abs(dotPoint3(lineDirection, fallAxis)), visual.id).toBeLessThan(0.01);
      } else {
        expect(Math.abs(dotPoint3(lineDirection, fallAxis)), visual.id).toBeGreaterThan(0.99);
      }
    }
  }
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
    expect(model.eave.soffitPolygons?.[0]).toEqual([
      { x: -450, y: -2250, z: 2400 },
      { x: 6450, y: -2250, z: 2400 },
      { x: 6000, y: -1800, z: 2400 },
      { x: 0, y: -1800, z: 2400 },
    ]);
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'wall')).toHaveLength(4);
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'roof')).toHaveLength(4);
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'soffit')).toHaveLength(4);
    expect(model.solids?.linearSolids).toHaveLength(4);
    expect(model.solids?.linearSolids[0]).toMatchObject({
      kind: 'gutter',
      profileWidthMm: 125,
      profileDepthMm: 90,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'wall')?.boundary[0], {
      x: 0,
      y: -1800,
      z: 0,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'fascia')?.boundary[0], {
      x: -450,
      y: -2250,
      z: 2400,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'soffit')?.boundary[0], {
      x: -450,
      y: -2250,
      z: 2400,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'soffit')?.boundary[1], {
      x: 6450,
      y: -2250,
      z: 2400,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'wall')?.renderMesh?.vertices[0], {
      x: -45,
      y: -1845,
      z: 0,
    });
    expectPoint3CloseTo(model.solids?.surfaceSolids.find((solid) => solid.kind === 'fascia')?.renderMesh?.vertices[0], {
      x: -459,
      y: -2259,
      z: 2220,
    });
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.renderMesh?.vertices[0], {
      x: -575,
      y: -2375,
      z: 2310,
    });
    expectPolygon3CloseTo(model.eave.gutterBoundaries?.[0], [
      { x: -575, y: -2375, z: 2400 },
      { x: 6575, y: -2375, z: 2400 },
      { x: 6450, y: -2250, z: 2400 },
      { x: -450, y: -2250, z: 2400 },
    ]);
    expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectHouseRoofFeatureFlashings(model, ['ridge', 'hip']);
    expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.start, { x: -450, y: -2250, z: 2355 });
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.end, { x: 6450, y: -2250, z: 2355 });
    expectHouseGutterSolidsMiteredAroundCorners(model);
    expect(model.attachmentTarget?.kind).toBe('line');
    expect(model.attachmentTarget?.line).toEqual(makeAttachmentEdge());
  });

  it('uses house gutter projection as the rendered outside face offset', () => {
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
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.centerline.start, { x: -450, y: -2250, z: 2355 });
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.renderMesh?.vertices[0], { x: -610, y: -2410, z: 2310 });
    expectPoint3CloseTo(model.solids?.linearSolids[0]?.renderMesh?.vertices[3], { x: -460, y: -2260, z: 2310 });
    expectHouseGutterSolidsMiteredAroundCorners(model);
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
    expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectHouseRoofFeatureFlashings(model, ['ridge', 'hip', 'valley']);
    expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes(model);
    expectHouseGutterSolidsMiteredAroundCorners(model);
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
    expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(model!);
    expectHouseRoofFeatureFlashings(model!, ['ridge', 'hip', 'valley']);
  });

  it('omits house roof feature flashings when roof QA rejects the roof geometry', () => {
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
    expect(model?.metadata?.roofQaStatus).toBe('invalid');
    expect(model?.metadata?.roofQaFailureReason).toBe('invalid_eave_polygon');
    expect(model?.roofFeatures?.length).toBeGreaterThan(0);
    expect(model?.roofFlashings).toEqual([]);
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
