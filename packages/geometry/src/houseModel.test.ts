import { describe, expect, it } from 'vitest';
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
  RenderMesh3D,
} from './contracts';
import { deriveHouseGableTerminalEnds } from './houseRoofCapabilities';
import { buildHouseFootprintPolygon } from './footprints';
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

function makePresetFootprint(preset: 'wrap_left' | 'wrap_right'): Polygon3 {
  return buildHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 1800,
    preset,
    attachmentSide: 'rear',
  });
}

const HOUSE_FOOTPRINT_PRESETS: readonly HouseFootprintPreset[] = [
  'straight',
  'l_left',
  'l_right',
  'recess_left',
  'recess_right',
  'u_shape',
  'wrap_left',
  'wrap_right',
];

const HOUSE_ROOF_FORMS: readonly HouseRoofForm[] = ['flat', 'mono', 'gable', 'hipped'];
const ATTACHMENT_SIDES: readonly AttachmentSide[] = ['rear', 'front', 'left', 'right'];

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

function roofPointKeyXY(candidate: { x: number; y: number }): string {
  return `${candidate.x.toFixed(3)},${candidate.y.toFixed(3)}`;
}

function roofSegmentKeyXY(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const startKey = roofPointKeyXY(start);
  const endKey = roofPointKeyXY(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function rebuildRoofPerimeterPolygon(model: HouseModel): Polygon3 | null {
  const directedSegments = model.roofPlanes.flatMap((roofPlane) =>
    roofPlane.boundary.map((start, index) => ({
      start,
      end: roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!,
    })),
  );
  const segmentCounts = new Map<string, number>();
  for (const segment of directedSegments) {
    const key = roofSegmentKeyXY(segment.start, segment.end);
    segmentCounts.set(key, (segmentCounts.get(key) ?? 0) + 1);
  }

  const perimeterSegments = directedSegments
    .filter((segment) => (segmentCounts.get(roofSegmentKeyXY(segment.start, segment.end)) ?? 0) === 1)
    .map((segment) => ({
      start: { x: segment.start.x, y: segment.start.y, z: 0 },
      end: { x: segment.end.x, y: segment.end.y, z: 0 },
    }));
  if (perimeterSegments.length < 3) return null;

  const startKey = roofPointKeyXY(perimeterSegments[0]!.start);
  const polygon: Polygon3 = [perimeterSegments[0]!.start];
  const used = new Set<number>([0]);
  let current = perimeterSegments[0]!.end;
  let guard = 0;

  while (roofPointKeyXY(current) !== startKey && guard < perimeterSegments.length * 2) {
    polygon.push(current);
    guard += 1;
    const nextIndex = perimeterSegments.findIndex((segment, index) => {
      if (used.has(index)) return false;
      return roofPointKeyXY(segment.start) === roofPointKeyXY(current) || roofPointKeyXY(segment.end) === roofPointKeyXY(current);
    });
    if (nextIndex < 0) return null;
    used.add(nextIndex);
    const next = perimeterSegments[nextIndex]!;
    current =
      roofPointKeyXY(next.start) === roofPointKeyXY(current)
        ? next.end
        : next.start;
  }

  return polygon.length >= 3 ? polygon : null;
}

function eavePolygonFromModel(model: HouseModel): Polygon3 {
  const rebuilt = rebuildRoofPerimeterPolygon(model);
  if (rebuilt) return rebuilt;
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
  roofForm?: NonNullable<GeometryConfig['houseContext']['model']>['roofForm'];
  roofPrimaryFallDirection?: NonNullable<GeometryConfig['houseContext']['model']>['roofPrimaryFallDirection'];
  roofRidgeAxis?: NonNullable<GeometryConfig['houseContext']['model']>['roofRidgeAxis'];
  openGableEndIds?: NonNullable<GeometryConfig['houseContext']['model']>['openGableEndIds'];
  roofAppendage?: NonNullable<GeometryConfig['houseContext']['model']>['roofAppendage'];
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
        roofForm: input.roofForm ?? 'hipped',
        roofMaterial: input.roofMaterial,
        eaveHeightMm,
        wallHeightMm,
        roofPitchDeg: input.roofPitchDeg ?? 25,
        roofPrimaryFallDirection: input.roofPrimaryFallDirection ?? 'positive_y',
        roofRidgeAxis: input.roofRidgeAxis ?? 'x',
        openGableEndIds: input.openGableEndIds ?? null,
        roofAppendage: input.roofAppendage ?? null,
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

function countRenderMeshVerticalFaces(mesh: RenderMesh3D | undefined): number {
  if (!mesh) return 0;
  return mesh.faces.reduce((count, [a, b, c]) => {
    const first = mesh.vertices[a];
    const second = mesh.vertices[b];
    const third = mesh.vertices[c];
    if (!first || !second || !third) return count;
    const faceNormal = normalizeVector3({
      x: (second.y - first.y) * (third.z - first.z) - (second.z - first.z) * (third.y - first.y),
      y: (second.z - first.z) * (third.x - first.x) - (second.x - first.x) * (third.z - first.z),
      z: (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x),
    });
    return Math.abs(faceNormal.z) <= 1e-3 ? count + 1 : count;
  }, 0);
}

function pointDistanceToSegment2D(candidate: { x: number; y: number }, start: Point3, end: Point3): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return Math.hypot(candidate.x - start.x, candidate.y - start.y);
  const ratio = Math.min(
    Math.max(((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq, 0),
    1,
  );
  const projectedX = start.x + dx * ratio;
  const projectedY = start.y + dy * ratio;
  return Math.hypot(candidate.x - projectedX, candidate.y - projectedY);
}

function sourceEdgeLineFromModel(model: HouseModel, sourceEdgeId: string): Line3 | null {
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= model.footprint.length) return null;
  return {
    start: model.footprint[index]!,
    end: model.footprint[(index + 1) % model.footprint.length]!,
  };
}

function polygonIsHorizontal(boundary: Polygon3): boolean {
  const z = boundary[0]?.z;
  return typeof z === 'number' && boundary.every((candidate) => Math.abs(candidate.z - z) <= 1e-6);
}

function countRenderMeshFacesAlignedToNormal(mesh: RenderMesh3D | undefined, normal: Point3): number {
  if (!mesh) return 0;
  const unitNormal = normalizeVector3(normal);
  return mesh.faces.reduce((count, [a, b, c]) => {
    const first = mesh.vertices[a];
    const second = mesh.vertices[b];
    const third = mesh.vertices[c];
    if (!first || !second || !third) return count;
    const faceNormal = normalizeVector3({
      x: (second.y - first.y) * (third.z - first.z) - (second.z - first.z) * (third.y - first.y),
      y: (second.z - first.z) * (third.x - first.x) - (second.x - first.x) * (third.z - first.z),
      z: (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x),
    });
    return dotPoint3(faceNormal, unitNormal) >= 0.99 ? count + 1 : count;
  }, 0);
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

function expectPolygon3CloseToIgnoringRotation(actual: Polygon3 | undefined, expected: Polygon3): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(expected.length);
  if (!actual || actual.length !== expected.length) return;

  const startIndexes = actual
    .map((candidate, index) => (
      pointDistanceSquared3(candidate, expected[0]!) <= 1e-6 ? index : null
    ))
    .filter((index): index is number => index !== null);
  expect(startIndexes.length).toBeGreaterThan(0);
  if (startIndexes.length === 0) return;

  const matches = startIndexes.some((startIndex) => {
    const forward = expected.every(
      (point, index) => pointDistanceSquared3(actual[(startIndex + index) % actual.length]!, point) <= 1e-6,
    );
    const reverse = expected.every((point, index) => {
      const actualIndex = (startIndex - index + actual.length) % actual.length;
      return pointDistanceSquared3(actual[actualIndex]!, point) <= 1e-6;
    });
    return forward || reverse;
  });
  expect(matches).toBe(true);
  if (!matches) return;

  const startIndex = startIndexes[0]!;
  const forward = expected.every(
    (point, index) => pointDistanceSquared3(actual[(startIndex + index) % actual.length]!, point) <= 1e-6,
  );
  for (const [index, point] of expected.entries()) {
    const actualIndex = forward
      ? (startIndex + index) % actual.length
      : (startIndex - index + actual.length) % actual.length;
    expectPoint3CloseTo(actual[actualIndex], point);
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

  for (let index = 0; index < renderMeshes.length - 1; index += 1) {
    const renderMesh = renderMeshes[index]!;
    const nextRenderMesh = renderMeshes[index + 1]!;
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
  const gutterBoundaries = model.eave.gutterBoundaries ?? [];
  const gutterLines = model.eave.gutterLines ?? [];
  const gutterSolids = model.solids?.linearSolids.filter((solid) => solid.kind === 'gutter') ?? [];

  expect(gutterBoundaries).toHaveLength(gutterLines.length);

  for (const [index, boundary] of gutterBoundaries.entries()) {
    const gutterLine = gutterLines[index]!;
    const gutterSolid = gutterSolids[index]!;

    expectPolygon3CloseToIgnoringRotation(boundary, [
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
  }

  for (let index = 0; index < gutterBoundaries.length - 1; index += 1) {
    const boundary = gutterBoundaries[index]!;
    const nextBoundary = gutterBoundaries[index + 1]!;
    if (pointDistanceSquared3(gutterLines[index]!.end, gutterLines[index + 1]!.start) > 1e-6) continue;
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

  for (let index = 0; index < gutterLines.length - 1; index += 1) {
    const current = gutterLines[index]!;
    const next = gutterLines[index + 1]!;
    if (pointDistanceSquared3(current.end, next.start) > 1e-6) continue;
    expectPoint3CloseTo(gutterSolids[index]?.renderMesh?.vertices[1], gutterSolids[index + 1]?.renderMesh?.vertices[0]!);
    expectPoint3CloseTo(gutterSolids[index]?.renderMesh?.vertices[2], gutterSolids[index + 1]?.renderMesh?.vertices[3]!);
    expectPoint3CloseTo(gutterSolids[index]?.renderMesh?.vertices[5], gutterSolids[index + 1]?.renderMesh?.vertices[4]!);
    expectPoint3CloseTo(gutterSolids[index]?.renderMesh?.vertices[6], gutterSolids[index + 1]?.renderMesh?.vertices[7]!);
  }
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
  for (const renderMesh of fasciaSolids.map((solid) => solid.renderMesh)) {
    expectVerticalPrismRenderMesh(renderMesh, 2220, 2400);
  }
  for (let index = 0; index < fasciaPolygons.length - 1; index += 1) {
    const current = fasciaPolygons[index]!;
    const next = fasciaPolygons[index + 1]!;
    if (pointDistanceSquared3(current[1]!, next[0]!) > 1e-6) continue;
    expectPoint3CloseTo(fasciaSolids[index]?.renderMesh?.vertices[1], fasciaSolids[index + 1]?.renderMesh?.vertices[0]!);
    expectPoint3CloseTo(fasciaSolids[index]?.renderMesh?.vertices[2], fasciaSolids[index + 1]?.renderMesh?.vertices[3]!);
    expectPoint3CloseTo(fasciaSolids[index]?.renderMesh?.vertices[5], fasciaSolids[index + 1]?.renderMesh?.vertices[4]!);
    expectPoint3CloseTo(fasciaSolids[index]?.renderMesh?.vertices[6], fasciaSolids[index + 1]?.renderMesh?.vertices[7]!);
  }
  expectSolidBoundariesExact(
    soffitPolygons,
    soffitSolids.map((solid) => solid.boundary),
  );
  expect(soffitSolids.every((solid) => solid.thicknessMm === 10)).toBe(true);
  for (const [index, solid] of soffitSolids.entries()) {
    if (polygonIsHorizontal(solid.boundary)) {
      expectVerticalPrismRenderMesh(solid.renderMesh, 2395, 2405);
      continue;
    }
    expect(solid.renderMesh, `soffit ${index + 1}`).toBeUndefined();
  }
  for (let index = 0; index < soffitPolygons.length - 1; index += 1) {
    const current = soffitPolygons[index]!;
    const next = soffitPolygons[index + 1]!;
    if (!polygonIsHorizontal(current) || !polygonIsHorizontal(next)) continue;
    if (pointDistanceSquared3(current[1]!, next[0]!) > 1e-6) continue;
    expectPoint3CloseTo(soffitSolids[index]?.renderMesh?.vertices[1], soffitSolids[index + 1]?.renderMesh?.vertices[0]!);
    expectPoint3CloseTo(soffitSolids[index]?.renderMesh?.vertices[2], soffitSolids[index + 1]?.renderMesh?.vertices[3]!);
    expectPoint3CloseTo(soffitSolids[index]?.renderMesh?.vertices[5], soffitSolids[index + 1]?.renderMesh?.vertices[4]!);
    expectPoint3CloseTo(soffitSolids[index]?.renderMesh?.vertices[6], soffitSolids[index + 1]?.renderMesh?.vertices[7]!);
  }
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
  const flashings = (model.roofFlashings ?? []).filter(
    (flashing) => flashing.metadata?.featureKind != null,
  );

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
    expect(model.eave.gutterLines).toHaveLength(3);
    expect(
      model.roofFlashings?.some(
        (flashing) =>
          flashing.metadata?.sourceEdgeId === 'footprint-edge-3' &&
          flashing.metadata?.flashingRole === 'house_apron' &&
          flashing.metadata?.houseRoofPerimeterRole === 'house_apron_edge',
      ),
    ).toBe(true);
    expect(model.eave.fasciaPolygons).toHaveLength(3);
    expect(model.eave.soffitPolygons).toHaveLength(3);
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
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'soffit')).toHaveLength(3);
    expect(model.solids?.linearSolids).toHaveLength(3);
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

  it('exposes drain eaves as discoverable roof-eave snap targets', () => {
    // Step 6 of the first-class spatial-entities migration. The snap engine
    // (step 7) will consume `model.roofEaves` to surface roof-edge candidates
    // for pergola attachment. Each drain-eave perimeter edge produces one
    // descriptor with a stable id and the eave line at gutter height.
    const model = buildHouseModel3D({
      config: makeConfig(),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    const roofEaves = model.roofEaves ?? [];
    expect(roofEaves.length).toBeGreaterThan(0);
    for (const eave of roofEaves) {
      expect(eave.id).toMatch(/^roof-eave-/);
      expect(eave.edgeKind).toBe('drain_eave');
      expect(eave.sourceEdgeId).toBeTruthy();
      expect(typeof eave.eaveLine.start.x).toBe('number');
      expect(typeof eave.eaveLine.end.x).toBe('number');
      expect(typeof eave.eaveLine.start.z).toBe('number');
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
    expect(model?.eave.gutterLines).toHaveLength(4);
    expect(model?.eave.gutterLines?.every((line) => Number.isFinite(line.start.x) && Number.isFinite(line.end.y))).toBe(true);
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
    expect(model?.solids?.linearSolids).toHaveLength(4);
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
    expect(model?.roofPlanes).toHaveLength(8);
    expect(model?.metadata?.roofTopologyFinalFaceCount).toBe(model?.roofPlanes.length);
    expect(model?.metadata?.roofTopologySourceEdgeCount).toBe(8);
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
    expect(model?.roofFeatures?.length ?? 0).toBeGreaterThanOrEqual(0);
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

  it('builds flat roofs for orthogonal L-shaped footprints without downgrading the roof form', () => {
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
        roofForm: 'flat',
        roofPitchDeg: 0,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe('flat');
    expect(model?.metadata?.roofQaStatus).toBe('valid');
    expect(model?.roofPlanes).toHaveLength(1);
    expect(model?.roofFeatures).toHaveLength(0);
  });

  it('builds mono roofs with the selected shared fall direction', () => {
    const positiveX = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'mono',
        roofPrimaryFallDirection: 'positive_x',
        roofPitchDeg: 10,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const negativeY = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'mono',
        roofPrimaryFallDirection: 'negative_y',
        roofPitchDeg: 10,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(positiveX?.metadata?.roofForm).toBe('mono');
    expect(positiveX?.metadata?.roofQaStatus).toBe('valid');
    expect(positiveX?.roofPlanes[0]?.metadata?.roofPrimaryFallDirection).toBe('positive_x');
    expect((positiveX?.roofPlanes[0]?.fallVector.x ?? 0) > 0).toBe(true);
    expect((negativeY?.roofPlanes[0]?.fallVector.y ?? 0) < 0).toBe(true);
  });

  it('builds mono roofs for representative orthogonal non-straight footprints', () => {
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
          roofForm: 'mono',
          roofPrimaryFallDirection: 'positive_y',
          roofPitchDeg: 20,
        }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model?.metadata?.roofGeometry).toBe('footprint_mono');
      expect(model?.roofPlanes).toHaveLength(1);
      expectRoofQaValid(model!);
    }
  });

  it('builds valid house roof geometry for every preset and live roof form', () => {
    for (const preset of HOUSE_FOOTPRINT_PRESETS) {
      const footprint = buildHouseFootprintPolygon({
        pergolaWidthMm: 6000,
        pergolaDepthMm: 1800,
        preset,
        attachmentSide: 'rear',
      });

      for (const roofForm of HOUSE_ROOF_FORMS) {
        const model = buildHouseModel3D({
          config: makeConfig({
            footprint,
            roofForm,
            roofPitchDeg: roofForm === 'flat' ? 0 : 20,
            roofPrimaryFallDirection: 'negative_y',
            roofRidgeAxis: 'x',
          }),
          attachmentEdge: makeAttachmentEdge(),
        });

        expect(model, `${preset}/${roofForm} model`).not.toBeNull();
        if (!model) continue;
        expect(model.metadata?.roofForm).toBe(roofForm);
        expect(model.metadata?.roofGeometry).toBe(
          roofForm === 'flat'
            ? 'footprint_flat'
            : roofForm === 'mono'
              ? 'footprint_mono'
              : preset === 'straight' && roofForm === 'gable'
                ? 'rectangular_gable'
                : preset === 'straight' && roofForm === 'hipped'
                  ? 'rectangular_hipped'
                  : roofForm === 'gable'
                    ? 'bent_spine_joined_gable'
                    : 'rectilinear_joined_hipped',
        );
        expect(model.roofPlanes.length).toBeGreaterThan(0);
        expectRoofQaValid(model);
      }
    }
  });

  it('builds valid gable and hipped roofs for every preset attachment-side rotation', () => {
    for (const attachmentSide of ATTACHMENT_SIDES) {
      for (const preset of HOUSE_FOOTPRINT_PRESETS) {
        const footprint = buildHouseFootprintPolygon({
          pergolaWidthMm: 6000,
          pergolaDepthMm: 1800,
          preset,
          attachmentSide,
        });

        for (const roofForm of ['gable', 'hipped'] as const) {
          const model = buildHouseModel3D({
            config: makeConfig({
              footprint,
              attachmentSide,
              roofForm,
              roofPitchDeg: 20,
              roofRidgeAxis: 'x',
            }),
            attachmentEdge: makeAttachmentEdge(),
          });

          expect(model, `${preset}/${attachmentSide}/${roofForm} model`).not.toBeNull();
          if (!model) continue;
          expect(model.metadata?.roofForm).toBe(roofForm);
          expect(model.metadata?.roofGeometry, `${preset}/${attachmentSide}/${roofForm} geometry`).not.toBeNull();
          expect(model.roofPlanes.length, `${preset}/${attachmentSide}/${roofForm} roof planes`).toBeGreaterThan(0);
          expectRoofQaValid(model);
        }
      }
    }
  });

  it('auto-heals zero gable and hipped roof pitches to visible roof geometry', () => {
    for (const roofForm of ['gable', 'hipped'] as const) {
      const model = buildHouseModel3D({
        config: makeConfig({
          footprint: makePresetFootprint('wrap_left'),
          roofForm,
          roofPitchDeg: 0,
          roofRidgeAxis: 'x',
        }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model, roofForm).not.toBeNull();
      if (!model) continue;
      expect(model.roofPlanes.length, roofForm).toBeGreaterThan(0);
      expect(model.roofPlanes.every((plane) => plane.metadata?.pitchDeg === 5), roofForm).toBe(true);
      expectRoofQaValid(model);
    }
  });

  it('aligns mono wall tops to the roof plane without dropping below the wall height', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'mono',
        roofPrimaryFallDirection: 'positive_y',
        roofPitchDeg: 10,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    const rightWall = model?.wallSegments[1];
    expect(rightWall?.boundary).toHaveLength(4);
    expect(rightWall?.boundary[2]?.z ?? Number.NaN).toBeGreaterThan(2400);
    expect(rightWall?.boundary[3]?.z ?? Number.NaN).toBeGreaterThan(2400);
  });

  it('cleans up screenshot-style mono joins against the attachment-side facade edge', () => {
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
        attachmentSide: 'front',
        strategy: 'fascia_under_gutter',
        roofForm: 'mono',
        roofMaterial: 'trapezoidal_5_rib',
        roofPitchDeg: 20,
        roofPrimaryFallDirection: 'positive_y',
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
        boundary.some((candidate) => Math.abs(candidate.x - 7000) <= 1 && Math.abs(candidate.y - 5400) <= 1) &&
        boundary.some((candidate) => Math.abs(candidate.x + 1000) <= 1 && Math.abs(candidate.y - 5400) <= 1),
    );
    const joinSoffit = model.eave.soffitPolygons?.find(
      (boundary) =>
        boundary.some((candidate) => Math.abs(candidate.x - 7000) <= 1 && Math.abs(candidate.y - 5400) <= 1) &&
        boundary.some((candidate) => Math.abs(candidate.x + 1000) <= 1 && Math.abs(candidate.y - 5400) <= 1),
    );
    const roofMaterialVisual = model.roofMaterialVisuals?.[0];
    const soffitSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'soffit') ?? [];
    const roofSolid = model.solids?.surfaceSolids.find((solid) => solid.kind === 'roof');
    const gutterSolids = model.solids?.linearSolids.filter((solid) => solid.kind === 'gutter') ?? [];
    const fasciaSolids = model.solids?.surfaceSolids.filter((solid) => solid.kind === 'fascia') ?? [];
    const joinedWall = model.wallSegments.find((segment) => segment.sourceEdgeId === 'footprint-edge-5');
    const wallTopHeights = model.wallSegments.flatMap((segment) => segment.boundary.slice(2).map((point) => point.z));
    const monoPerimeterFlashings = model.roofFlashings?.filter(
      (flashing) => typeof flashing.metadata?.flashingRole === 'string',
    ) ?? [];

    expectRoofQaValid(model);
    expect(model.metadata?.roofGeometry).toBe('footprint_mono');
    expect(model.metadata?.roofPrimaryFallDirection).toBe('positive_y');
    expect(model.solids?.surfaceSolids.filter((solid) => solid.kind === 'roof')).toHaveLength(1);
    expect(joinEdge).toBeUndefined();
    expect(joinFascia).toBeUndefined();
    expect(joinSoffit).toBeUndefined();
    expect(eavePolygon[4]).toEqual({ x: 7000, y: 5400, z: 0 });
    expect(eavePolygon[5]).toEqual({ x: -1000, y: 5400, z: 0 });
    expect(model.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-5');
    expect(model.attachmentTarget?.line).toEqual({
      start: { x: 0, y: 5400, z: 2500 },
      end: { x: 6000, y: 5400, z: 2500 },
    });
    expect(model.roofPlanes).toHaveLength(1);
    const joinBoundaryStart = model.roofPlanes[0]?.boundary.find(
      (candidate) => Math.abs(candidate.x - 7000) <= 1 && Math.abs(candidate.y - 5400) <= 1,
    );
    const joinBoundaryEnd = model.roofPlanes[0]?.boundary.find(
      (candidate) => Math.abs(candidate.x + 1000) <= 1 && Math.abs(candidate.y - 5400) <= 1,
    );
    expect(joinBoundaryStart).toBeDefined();
    expect(joinBoundaryEnd).toBeDefined();
    expect(joinBoundaryStart?.z ?? Number.NaN).toBeGreaterThan(2500);
    expect(joinBoundaryStart?.z).toBeCloseTo(joinBoundaryEnd?.z ?? Number.NaN, 6);
    expect(model.eave.gutterLines).toHaveLength(1);
    expect(model.eave.fasciaPolygons).toHaveLength(1);
    expect(model.eave.soffitPolygons).toHaveLength(1);
    expect(joinedWall?.boundary[2]?.z).toBeCloseTo(joinBoundaryEnd?.z ?? Number.NaN, 6);
    expect(joinedWall?.boundary[3]?.z).toBeCloseTo(joinBoundaryStart?.z ?? Number.NaN, 6);
    expect(Math.min(...wallTopHeights)).toBeGreaterThan(2500);
    expect(Math.max(...wallTopHeights)).toBeGreaterThan(3500);
    expect(model.eave.gutterLines![0]).toEqual({
      start: { x: -3800, y: 8200, z: 2500 },
      end: { x: 9800, y: 8200, z: 2500 },
    });
    expect(model.eave.soffitPolygons!.every((boundary) => !polygonIsHorizontal(boundary))).toBe(true);
    expect(
      soffitSolids.every(
        (solid) =>
          solid.metadata?.houseRoofEdgeKind === 'drain_eave' &&
          solid.metadata?.houseRoofPerimeterRole === 'drain_eave' &&
          solid.metadata?.houseRoofSoffitMode === 'sloped_underroof' &&
          solid.metadata?.sourceRoofPlaneId === 'house-roof-mono-1' &&
          solid.renderMesh === undefined &&
          !polygonIsHorizontal(solid.boundary),
      ),
    ).toBe(true);
    expect(
      gutterSolids.map((solid) => solid.metadata?.houseRoofPerimeterRole),
    ).toEqual(['drain_eave']);
    expect(
      fasciaSolids.map((solid) => solid.metadata?.houseRoofPerimeterRole),
    ).toEqual(['drain_eave']);
    expect(monoPerimeterFlashings.map((flashing) => flashing.metadata?.sourceEdgeId)).toEqual([
      'footprint-edge-2',
      'footprint-edge-3',
      'footprint-edge-4',
      'footprint-edge-5',
      'footprint-edge-6',
      'footprint-edge-7',
      'footprint-edge-8',
    ]);
    expect(
      monoPerimeterFlashings.find((flashing) => flashing.metadata?.sourceEdgeId === 'footprint-edge-5')?.metadata,
    ).toMatchObject({
      flashingRole: 'house_apron',
      houseRoofPerimeterRole: 'house_apron_edge',
      flashingTreatment: 'house_perimeter_folded',
      position: 'house_apron',
      roofGeometry: 'footprint_mono',
    });
    expect(monoPerimeterFlashings.every((flashing) => flashing.wings.length === 2)).toBe(true);
    expect(
      monoPerimeterFlashings.every((flashing) => {
        const sourceEdgeId = String(flashing.metadata?.sourceEdgeId ?? '');
        const sourceEdge = sourceEdgeLineFromModel(model, sourceEdgeId);
        if (!sourceEdge) return false;
        return flashing.wings.every((wing) =>
          wing.boundary.every(
            (candidate) => pointDistanceToSegment2D(candidate, sourceEdge.start, sourceEdge.end) <= 1600,
          ),
        );
      }),
    ).toBe(true);
    expect(
      monoPerimeterFlashings
        .filter((flashing) => flashing.metadata?.position === 'high_side')
        .map((flashing) => flashing.metadata?.sourceEdgeId),
    ).toEqual(['footprint-edge-3', 'footprint-edge-7']);
    const roofNormal = normalizeVector3(model.roofPlanes[0]!.plane.normal);
    expect(
      countRenderMeshFacesAlignedToNormal(
        roofSolid?.renderMesh,
        roofNormal.z >= 0 ? { x: -roofNormal.x, y: -roofNormal.y, z: -roofNormal.z } : roofNormal,
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

  it('omits house-side eave package geometry for supported rectangular gable roofs', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'gable',
        roofRidgeAxis: 'x',
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
    const joinFascia = model.eave.fasciaPolygons?.find(
      (boundary) => boundary.every((candidate) => Math.abs(candidate.y - 450) <= 1),
    );
    const joinSoffit = model.eave.soffitPolygons?.find(
      (boundary) =>
        boundary.some((candidate) => Math.abs(candidate.x - 6450) <= 1 && Math.abs(candidate.y - 450) <= 1) &&
        boundary.some((candidate) => Math.abs(candidate.x + 450) <= 1 && Math.abs(candidate.y - 450) <= 1),
    );

    expectRoofQaValid(model);
    expect(model.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
    expect(joinGutter).toBeUndefined();
    expect(joinFascia).toBeUndefined();
    expect(joinSoffit).toBeUndefined();
    expect(model.eave.gutterLines).toHaveLength(1);
  });

  it('omits house-side eave package geometry for supported orthogonal hipped roofs', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'hipped',
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
    const joinFascia = model.eave.fasciaPolygons?.find(
      (boundary) => boundary.every((candidate) => Math.abs(candidate.y - 450) <= 1),
    );
    const joinSoffit = model.eave.soffitPolygons?.find(
      (boundary) =>
        boundary.some((candidate) => Math.abs(candidate.x - 6450) <= 1 && Math.abs(candidate.y - 450) <= 1) &&
        boundary.some((candidate) => Math.abs(candidate.x + 450) <= 1 && Math.abs(candidate.y - 450) <= 1),
    );

    expectRoofQaValid(model);
    expect(model.attachmentTarget?.sourceEdgeId).toBe('footprint-edge-3');
    expect(joinGutter).toBeUndefined();
    expect(joinFascia).toBeUndefined();
    expect(joinSoffit).toBeUndefined();
    expect(model.eave.gutterLines).toHaveLength(3);
  });

  it('builds joined orthogonal gable roofs instead of blocking supported topology', () => {
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
        roofForm: 'gable',
        roofRidgeAxis: 'x',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe('gable');
    expect(model?.metadata?.roofQaStatus).toBe('valid');
    expect(model?.metadata?.roofGeometry).toBe('bent_spine_joined_gable');
    expect((model?.roofPlanes.length ?? 0) > 1).toBe(true);
    expect(model?.roofFeatures?.some((feature) => feature.kind === 'ridge')).toBe(true);
    expect(model?.roofFeatures?.some((feature) => feature.kind === 'valley')).toBe(true);
  });

  it('builds a bent-spine joined gable for U footprints and exposes only the outer end frames', () => {
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
      ridgeAxis: 'x',
    });
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: uFootprint,
        roofForm: 'gable',
        roofRidgeAxis: 'x',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(terminalEnds.map((end) => end.sourceEdgeId)).toEqual(['footprint-edge-7', 'footprint-edge-3']);
    expect(model?.metadata?.roofQaStatus).toBe('valid');
    expect(model?.metadata?.roofGeometry).toBe('bent_spine_joined_gable');
    const ridges = model?.roofFeatures?.filter((feature) => feature.kind === 'ridge') ?? [];
    expect(ridges).toHaveLength(3);
    expect(ridges.every((feature) => feature.line.start.x === feature.line.end.x || feature.line.start.y === feature.line.end.y)).toBe(true);
  });

  it('builds peaked gable end wall profiles for bent-spine U footprints', () => {
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
      ridgeAxis: 'y',
    });
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: uFootprint,
        roofForm: 'gable',
        roofRidgeAxis: 'y',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofGeometry).toBe('bent_spine_joined_gable');
    const terminalWalls = (model?.wallSegments ?? []).filter((wall) =>
      terminalEnds.some((terminalEnd) => terminalEnd.sourceEdgeId === wall.sourceEdgeId),
    );
    expect(terminalWalls.length).toBe(terminalEnds.length);
    for (const wall of terminalWalls) {
      const topProfile = wall.boundary.slice(2).reverse();
      expect(topProfile.length).toBeGreaterThanOrEqual(3);
      const endpointRise = Math.max(topProfile[0]!.z, topProfile[topProfile.length - 1]!.z);
      const interiorPeak = Math.max(...topProfile.slice(1, -1).map((point3) => point3.z));
      expect(interiorPeak).toBeGreaterThan(endpointRise);
    }
  });

  it('keeps the ridge-y rear bridge joined to the bent spine without a floating center gable', () => {
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
        roofForm: 'gable',
        roofRidgeAxis: 'y',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofGeometry).toBe('bent_spine_joined_gable');
    expect(model?.metadata?.roofQaStatus).toBe('valid');
    expect(model?.metadata?.roofFacetMergeMode).toBe('active_rectilinear_wavefront_bent_spine');
    expect(model?.roofPlanes.every((plane) => plane.metadata?.ridgeAxis === 'y')).toBe(true);
    expect(model?.metadata?.roofTerminalClosureCount).toBe(2);

    const terminalSourceEdgeIds = deriveHouseGableTerminalEnds({
      footprint: uFootprint,
      ridgeAxis: 'y',
    }).map((terminalEnd) => terminalEnd.sourceEdgeId.replace('footprint-edge-', 'house-eave-edge-'));
    expect(
      (model?.roofPlanes ?? []).some((plane) =>
        terminalSourceEdgeIds.includes(String(plane.metadata?.sourceEdgeId ?? '')),
      ),
    ).toBe(false);
    const ridgeFeatures = (model?.roofFeatures ?? []).filter((feature) => feature.kind === 'ridge');

    const ridgeZMax = Math.max(
      ...ridgeFeatures.flatMap((feature) => [feature.line.start.z, feature.line.end.z]),
    );
    const planeZMax = Math.max(
      ...((model?.roofPlanes ?? []).flatMap((plane) => plane.boundary.map((point3) => point3.z))),
    );
    expect(planeZMax).toBeLessThanOrEqual(ridgeZMax + 1e-6);
  });

  it('limits joined U gable eave packages to the true draining perimeter edges', () => {
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
        roofForm: 'gable',
        roofRidgeAxis: 'y',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    const gutterEdgeIds = (model?.solids?.linearSolids ?? [])
      .filter((solid) => solid.kind === 'gutter')
      .map((solid) => solid.metadata?.sourceEdgeId)
      .sort();
    const fasciaEdgeIds = (model?.solids?.surfaceSolids ?? [])
      .filter((solid) => solid.kind === 'fascia')
      .map((solid) => solid.metadata?.sourceEdgeId)
      .sort();
    const soffitEdgeIds = (model?.solids?.surfaceSolids ?? [])
      .filter((solid) => solid.kind === 'soffit')
      .map((solid) => solid.metadata?.sourceEdgeId)
      .sort();

    expect(model?.metadata?.roofGeometry).toBe('bent_spine_joined_gable');
    expect(model?.metadata?.roofQaStatus).toBe('valid');
    expect(gutterEdgeIds).toEqual([
      'footprint-edge-1',
      'footprint-edge-2',
      'footprint-edge-4',
      'footprint-edge-6',
      'footprint-edge-8',
    ]);
    expect(fasciaEdgeIds).toEqual(gutterEdgeIds);
    expect(soffitEdgeIds).toEqual(gutterEdgeIds);
    expect(gutterEdgeIds).not.toContain('footprint-edge-3');
    expect(gutterEdgeIds).not.toContain('footprint-edge-5');
    expect(gutterEdgeIds).not.toContain('footprint-edge-7');
  });

  it('builds bent-spine joined gables for wrap presets with explicit terminal closure metadata', () => {
    const presets: Array<'wrap_left' | 'wrap_right'> = ['wrap_left', 'wrap_right'];

    for (const preset of presets) {
      const footprint = makePresetFootprint(preset);
      const terminalEnds = deriveHouseGableTerminalEnds({
        footprint,
        ridgeAxis: 'x',
      });
      const model = buildHouseModel3D({
        config: makeConfig({
          footprint,
          roofForm: 'gable',
          roofRidgeAxis: 'x',
        }),
        attachmentEdge: makeAttachmentEdge(),
      });

      expect(model?.metadata?.roofGeometry).toBe('bent_spine_joined_gable');
      expect(model?.metadata?.roofQaStatus).toBe('valid');
      expect(model?.metadata?.roofTerminalClosureCount).toBe(2);
      expect((model?.roofFeatures ?? []).filter((feature) => feature.kind === 'ridge')).toHaveLength(3);
      expect((model?.roofFeatures ?? []).filter((feature) => feature.kind === 'valley')).toHaveLength(2);

      const terminalWalls = (model?.wallSegments ?? []).filter((wall) =>
        terminalEnds.some((terminalEnd) => terminalEnd.sourceEdgeId === wall.sourceEdgeId),
      );
      expect(terminalWalls).toHaveLength(2);
      expect(terminalWalls.every((wall) => wall.metadata?.houseWallClosureKind === 'terminal_gable')).toBe(true);
      for (const wall of terminalWalls) {
        const topProfile = wall.boundary.slice(2).reverse();
        expect(topProfile.length).toBeGreaterThanOrEqual(3);
        const endpointRise = Math.max(topProfile[0]!.z, topProfile[topProfile.length - 1]!.z);
        const interiorPeak = Math.max(...topProfile.slice(1, -1).map((point3) => point3.z));
        expect(interiorPeak).toBeGreaterThan(endpointRise);
      }

      const closurePlanes = (model?.roofPlanes ?? []).filter(
        (plane) => plane.metadata?.roofTerminalClosureFacet === true,
      );
      expect(closurePlanes.length).toBeGreaterThan(0);
      expect(
        closurePlanes.some((plane) =>
          String(plane.metadata?.roofTerminalClosureSourceEdgeIds ?? '').includes(terminalEnds[0]!.sourceEdgeId),
        ),
      ).toBe(true);
      expect(
        closurePlanes.some((plane) =>
          String(plane.metadata?.roofTerminalClosureSourceEdgeIds ?? '').includes(terminalEnds[1]!.sourceEdgeId),
        ),
      ).toBe(true);
    }
  });

  it('keeps open wrap gable ends on the same terminal closure geometry as the closed wall', () => {
    const footprint = makePresetFootprint('wrap_left');
    const terminalEnds = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: 'x',
    });
    const openEndId = terminalEnds[0]?.id;
    const openSourceEdgeId = terminalEnds[0]?.sourceEdgeId;
    const closedModel = buildHouseModel3D({
      config: makeConfig({
        footprint,
        roofForm: 'gable',
        roofRidgeAxis: 'x',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });
    const openModel = buildHouseModel3D({
      config: makeConfig({
        footprint,
        roofForm: 'gable',
        roofRidgeAxis: 'x',
        openGableEndIds: openEndId ? [openEndId] : null,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(openEndId).toBeTruthy();
    const closedWall = closedModel?.wallSegments.find((segment) => segment.sourceEdgeId === openSourceEdgeId);
    const openWall = openModel?.wallSegments.find((segment) => segment.metadata?.gableEndId === openEndId);
    expect(openWall?.metadata?.houseWallMode).toBe('open_gable_frame');
    expect(openWall?.metadata?.houseWallClosureKind).toBe('terminal_gable');
    expect(openWall?.boundary).toEqual(closedWall?.boundary);
    const frameFeatures = openModel?.roofFeatures?.filter((feature) => feature.kind === 'gable_end_frame') ?? [];
    expect(frameFeatures.length).toBeGreaterThan(0);
    expect(frameFeatures.every((feature) => feature.metadata?.gableEndId === openEndId)).toBe(true);
  });

  it('builds roof-aligned gable end walls with a ridge apex on the selected axis', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'gable',
        roofRidgeAxis: 'x',
        roofPitchDeg: 15,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    const gableEndWall = model?.wallSegments[1];
    expect(gableEndWall?.boundary).toHaveLength(5);
    const gableTopProfile = gableEndWall?.boundary.slice(2) ?? [];
    expect((gableTopProfile[0]?.z ?? 0) > 2400).toBe(true);
    expect((gableTopProfile[2]?.z ?? 0) > 2400).toBe(true);
    expect(gableTopProfile[1]?.z).toBeGreaterThan(gableTopProfile[0]?.z ?? Number.NEGATIVE_INFINITY);
    expect(gableTopProfile[1]?.z).toBeGreaterThan(gableTopProfile[2]?.z ?? Number.NEGATIVE_INFINITY);
  });

  it('opens selected gable ends as frame-only geometry', () => {
    const footprint = makeFootprint();
    const openEndId = deriveHouseGableTerminalEnds({
      footprint,
      ridgeAxis: 'x',
    })[0]?.id;
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        roofForm: 'gable',
        roofRidgeAxis: 'x',
        openGableEndIds: openEndId ? [openEndId] : null,
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(openEndId).toBeTruthy();
    expect(model).not.toBeNull();
    const openWall = model?.wallSegments.find((segment) => segment.metadata?.gableEndId === openEndId);
    expect(openWall?.metadata?.houseWallMode).toBe('open_gable_frame');
    expect(
      model?.solids?.surfaceSolids.some(
        (solid) => solid.kind === 'wall' && solid.metadata?.sourceId === openWall?.id,
      ),
    ).toBe(false);
    const frameFeatures = model?.roofFeatures?.filter((feature) => feature.kind === 'gable_end_frame') ?? [];
    expect(frameFeatures.length).toBeGreaterThan(0);
    expect(frameFeatures.every((feature) => feature.metadata?.gableEndId === openEndId)).toBe(true);
  });

  it('blocks unsupported hipped topology instead of falling back to a bounding box roof', () => {
    const nonOrthogonal: Polygon3 = [
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1600, z: 0 },
      { x: 5600, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint: nonOrthogonal,
        roofForm: 'hipped',
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe('hipped');
    expect(model?.metadata?.roofQaStatus).toBe('invalid');
    expect(model?.metadata?.roofQaFailureReason).toBe('unsupported_hipped_topology');
    expect(model?.roofPlanes).toHaveLength(0);
  });

  it('adds one shared appendage band on a supported host edge', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'mono',
        roofPrimaryFallDirection: 'positive_y',
        roofAppendage: {
          enabled: true,
          form: 'mono',
          hostEdge: 'front',
          pitchDeg: 5,
          dropMm: 500,
        },
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofAppendageEnabled).toBe(true);
    expect(model?.metadata?.roofQaStatus).toBe('valid');
    expect((model?.roofPlanes.length ?? 0) > 1).toBe(true);
    expect(model?.roofPlanes.some((plane) => plane.metadata?.roofGeometry === 'appendage_band')).toBe(true);
    const appendageSoffits =
      model?.solids?.surfaceSolids.filter(
        (solid) =>
          solid.kind === 'soffit' &&
          solid.metadata?.sourceRoofPlaneId === 'house-roof-appendage-front',
      ) ?? [];
    const appendageFascias =
      model?.solids?.surfaceSolids.filter(
        (solid) =>
          solid.kind === 'fascia' &&
          solid.metadata?.sourceRoofPlaneId === 'house-roof-appendage-front',
      ) ?? [];
    const appendageGutters =
      model?.solids?.linearSolids.filter(
        (solid) =>
          solid.kind === 'gutter' &&
          solid.metadata?.sourceRoofPlaneId === 'house-roof-appendage-front',
      ) ?? [];
    const appendageFlashings =
      model?.roofFlashings?.filter(
        (flashing) => flashing.metadata?.roofGeometry === 'appendage_band',
      ) ?? [];

    expect(appendageSoffits).toHaveLength(1);
    expect(appendageFascias).toHaveLength(1);
    expect(appendageGutters).toHaveLength(1);
    expect(appendageSoffits[0]?.metadata?.houseRoofPerimeterRole).toBe('drain_eave');
    expect(appendageFascias[0]?.metadata?.houseRoofPerimeterRole).toBe('drain_eave');
    expect(appendageGutters[0]?.metadata?.houseRoofPerimeterRole).toBe('drain_eave');
    expect(
      appendageFlashings.map((flashing) => ({
        sourceEdgeId: flashing.metadata?.sourceEdgeId ?? null,
        sourceRoofPlaneId: flashing.metadata?.sourceRoofPlaneId ?? null,
        flashingRole: flashing.metadata?.flashingRole ?? null,
        perimeterRole: flashing.metadata?.houseRoofPerimeterRole ?? null,
      })),
    ).toEqual([
      {
        sourceEdgeId: 'footprint-edge-3',
        sourceRoofPlaneId: 'house-roof-appendage-front',
        flashingRole: 'house_apron',
        perimeterRole: 'house_apron_edge',
      },
      {
        sourceEdgeId: 'house-roof-appendage-front-edge-1',
        sourceRoofPlaneId: 'house-roof-appendage-front',
        flashingRole: 'high_side',
        perimeterRole: 'weather_flashed_edge',
      },
      {
        sourceEdgeId: 'house-roof-appendage-front-edge-2',
        sourceRoofPlaneId: 'house-roof-appendage-front',
        flashingRole: 'rake',
        perimeterRole: 'weather_flashed_edge',
      },
      {
        sourceEdgeId: 'house-roof-appendage-front-edge-4',
        sourceRoofPlaneId: 'house-roof-appendage-front',
        flashingRole: 'rake',
        perimeterRole: 'weather_flashed_edge',
      },
    ]);
    expect(
      appendageFlashings.every((flashing) =>
        flashing.metadata?.houseRoofPerimeterRole === 'weather_flashed_edge' ||
        flashing.metadata?.houseRoofPerimeterRole === 'house_apron_edge',
      ),
    ).toBe(true);
    expect(
      appendageFlashings.every(
        (flashing) =>
          flashing.wings.length === 2 &&
          flashing.metadata?.flashingTreatment === 'house_perimeter_folded',
      ),
    ).toBe(true);
  });

  it('builds appendage bands from the resolved host run span instead of the house bounding box span', () => {
    const footprint: Polygon3 = [
      { x: 0, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 2000, z: 0 },
      { x: 4000, y: 2000, z: 0 },
      { x: 4000, y: 4000, z: 0 },
      { x: 0, y: 4000, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        roofForm: 'mono',
        roofPrimaryFallDirection: 'positive_x',
        roofAppendage: {
          enabled: true,
          form: 'mono',
          hostEdge: 'right',
          pitchDeg: 5,
          dropMm: 450,
        },
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    const appendagePlane = model?.roofPlanes.find((plane) => plane.id === 'house-roof-appendage-right');
    expect(appendagePlane).toBeTruthy();
    expect(Math.abs((appendagePlane?.boundary[1]?.y ?? 0) - (appendagePlane?.boundary[0]?.y ?? 0))).toBe(2900);
    expect(Math.abs((appendagePlane?.boundary[1]?.y ?? 0) - (appendagePlane?.boundary[0]?.y ?? 0))).toBeLessThan(4000);
  });

  it('blocks unsupported appendage host edges while keeping the selected roof family explicit', () => {
    const model = buildHouseModel3D({
      config: makeConfig({
        roofForm: 'gable',
        roofRidgeAxis: 'y',
        roofAppendage: {
          enabled: true,
          form: 'mono',
          hostEdge: 'rear',
          pitchDeg: 5,
          dropMm: 450,
        },
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe('gable');
    expect(model?.metadata?.roofQaStatus).toBe('invalid');
    expect(model?.metadata?.roofQaFailureReason).toBe('invalid_appendage_host_edge');
  });

  it('blocks appendage bands when the footprint exposes no continuous exterior appendage host edge', () => {
    const footprint: Polygon3 = [
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1600, z: 0 },
      { x: 5600, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    const model = buildHouseModel3D({
      config: makeConfig({
        footprint,
        roofForm: 'flat',
        roofAppendage: {
          enabled: true,
          form: 'mono',
          hostEdge: 'rear',
          pitchDeg: 5,
          dropMm: 450,
        },
      }),
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.metadata?.roofForm).toBe('flat');
    expect(model?.metadata?.roofQaStatus).toBe('invalid');
    expect(model?.metadata?.roofQaFailureReason).toBe('invalid_appendage_topology');
  });

  it('builds shared deck geometry for attached, detached, and custom decks', () => {
    const config = makeConfig();
    config.houseContext.model = {
      ...config.houseContext.model!,
      decks: [
        {
          id: 'deck-attached',
          name: 'Attached deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          outline: [
            { x: 0, y: 0, z: 0 },
            { x: 6000, y: 0, z: 0 },
            { x: 6000, y: 3000, z: 0 },
            { x: 0, y: 3000, z: 0 },
          ],
          elevationMode: 'aligned_to_threshold',
          topSurfaceElevationMm: 0,
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
          supportContext: {
            classification: 'threshold_attached',
          },
        },
        {
          id: 'deck-detached',
          name: 'Detached deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_detached',
          outline: [
            { x: 7000, y: 1200, z: 0 },
            { x: 9800, y: 1200, z: 0 },
            { x: 9800, y: 3600, z: 0 },
            { x: 7000, y: 3600, z: 0 },
          ],
          elevationMode: 'stepped',
          topSurfaceElevationMm: 450,
          isAttached: false,
          surfaceMaterial: 'composite',
          supportContext: {
            classification: 'ground_supported',
          },
        },
        {
          id: 'deck-custom',
          name: 'Custom landing',
          kind: 'landing',
          shape: 'custom',
          outline: [
            { x: -2800, y: 800, z: 0 },
            { x: -400, y: 800, z: 0 },
            { x: -400, y: 2200, z: 0 },
            { x: -1600, y: 2200, z: 0 },
            { x: -1600, y: 3200, z: 0 },
            { x: -2800, y: 3200, z: 0 },
          ],
          elevationMode: 'ground',
          topSurfaceElevationMm: 75,
          isAttached: false,
          surfaceMaterial: 'concrete',
          supportContext: {
            classification: 'mixed_or_unclear',
          },
        },
      ],
    };

    const model = buildHouseModel3D({
      config,
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.decks).toHaveLength(3);
    expect(model?.decks!.map((deck) => deck.id)).toEqual([
      'deck-attached',
      'deck-detached',
      'deck-custom',
    ]);

    const attachedDeck = model?.decks!.find((deck) => deck.id === 'deck-attached');
    const detachedDeck = model?.decks!.find((deck) => deck.id === 'deck-detached');
    const customDeck = model?.decks!.find((deck) => deck.id === 'deck-custom');

    expect(attachedDeck?.supportClassification).toBe('threshold_attached');
    expect(attachedDeck?.topSurfaceElevationMm).toBe(0);
    expect(attachedDeck?.boundary.every((point) => point.z === 0)).toBe(true);
    expect(detachedDeck?.supportClassification).toBe('ground_supported');
    expect(detachedDeck?.topSurfaceElevationMm).toBe(450);
    expect(detachedDeck?.boundary.every((point) => point.z === 450)).toBe(true);
    expect(customDeck?.kind).toBe('landing');
    expect(customDeck?.shape).toBe('custom');
    expect(customDeck?.boundary).toHaveLength(6);
    expect(customDeck?.boundary.every((point) => point.z === 75)).toBe(true);

    const deckSolids = model?.solids?.surfaceSolids.filter((solid) => solid.kind === 'deck') ?? [];
    expect(deckSolids).toHaveLength(3);
    const steppedSolid = deckSolids.find((solid) => solid.metadata?.sourceId === 'deck-detached');
    expect(steppedSolid?.thicknessMm).toBe(40);
    expectVerticalPrismRenderMesh(steppedSolid?.renderMesh, 410, 450);
  });
});
