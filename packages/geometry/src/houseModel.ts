import type {
  AttachmentSide,
  DatumFrame3,
  GeometryConfig,
  GeometryMetadata,
  HouseDeck3D,
  HouseDeckConfig,
  HouseAttachmentStrategy,
  HouseAttachmentTarget3D,
  HouseModel3D,
  HouseRoofAppendageForm,
  HouseReferenceGeometry,
  HouseRoofFeature3D,
  HouseRoofFeatureKind,
  HouseRoofForm,
  HouseRoofMaterial,
  HouseRoofMaterialProfileKind,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  HouseRoofMaterialVisual3D,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RenderMesh3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from './contracts';
import {
  normalizeHouseRoofPitchDegForForm,
  validateHouseRoofSelection,
  type HouseRoofAppendageSupport,
} from './houseRoofValidation';
import {
  crossProduct,
  dotProduct,
  lineLength,
  normalizeVector,
  planeFromOriginAxes,
  planeFromPoints,
  scaleVector,
  subtractPoints,
} from './math3d';
import { buildHouseSideAttachmentLine } from './footprints';
import {
  DEFAULT_DECK_SURFACE_THICKNESS_MM,
  DEFAULT_EAVE_HEIGHT_MM,
  DEFAULT_EAVE_OVERHANG_MM,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_FASCIA_SOLID_THICKNESS_MM,
  DEFAULT_GUTTER_DEPTH_MM,
  DEFAULT_GUTTER_PROJECTION_MM,
  DEFAULT_GUTTER_WIDTH_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
  DEFAULT_HOUSE_ROOF_MATERIAL,
  DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
  DEFAULT_ROOF_PITCH_DEG,
  DEFAULT_ROOF_SOLID_THICKNESS_MM,
  DEFAULT_SOFFIT_DEPTH_MM,
  DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
  DEFAULT_WALL_SOLID_THICKNESS_MM,
  RIDGE_COLLAPSE_EPSILON_MM,
  ROOF_JOIN_EPSILON_MM,
  ROOF_JOIN_FEATURE_MIN_LENGTH_MM,
  ROOF_REGION_MIN_AREA_MM2,
  WORLD_Z,
} from './house/constants';
import {
  axisRange,
  boundingBox,
  clamp,
  distanceSquared2,
  finiteNumber,
  finiteVectorLength,
  line,
  lineIntersection2,
  lineIntersectionT2D,
  midpoint2,
  point,
  pointInPolygon2D,
  pointOnRoofSegment2D,
  polygonCentroid2D,
  positiveNumber,
  rectangleCornersFromBox,
  reflectPointAcrossX,
  reflectVectorAcrossX,
  signedAreaXY,
  swapPointAxes,
  swapVectorAxes,
  edgeOutwardVector,
  finiteRoofQaPoint,
  miterCornerPoint,
  negateVector,
  polygonArea3D,
  translatePointByVector,
  uniqueSorted,
  type BentSpineTerminalGableClosure,
  type HouseRoofBuildResult,
  type HouseRoofPerimeterEdge,
  type HouseRoofPerimeterEdgeKind,
  type HouseRoofPerimeterFlashingRole,
  type HouseRoofPerimeterLine,
  type HouseRoofPerimeterPolygon,
  type JoinedRoofEdge,
  type JoinedRoofFacet,
  type JoinedRoofFacetBuildResult,
  type JoinedRoofFeatureDraft,
  type JoinedRoofRegion,
  type JoinedRoofWavefrontLoop,
  type JoinedRoofWavefrontResult,
  type JoinedRoofWavefrontSegment,
  type RoofPoint2,
} from './house/_internal';
import {
  buildAppendagePerimeterEdges,
  buildHouseRoofPerimeterEdges,
  buildMonoAppendagePerimeterEdges,
  classifyHousePerimeterEdges,
  roofPlanePerimeterOverlapSegment,
  roofPlaneTouchesPerimeterEdge,
} from './house/perimeterEdges';
import { buildWallSegments, wallBoundaryHasFlatTop } from './house/walls';
import {
  buildRoofPlane,
  pointInOrOnRoofPolygon,
  pointOnRoofPolygonBoundary,
  roofFeatureHeightAtXY,
  roofHeightAtXY,
  roofPlaneEquationHeightAtXY,
  roofPlaneHeightAtXY,
  roofSolidBottomPlaneEquation,
  roofSolidPlaneEquationFromPlane,
  type RoofSolidPlaneEquation,
} from './house/roofPlane';
import {
  buildPerimeterOffsetStripFootprints,
  buildPolygonFasciaPolygons,
  buildPolygonGutterBoundaries,
  buildPolygonGutterLines,
  buildPolygonSoffitPolygons,
  isEavePackageEdge,
} from './house/eave';
import {
  buildRectangleHippedRoof,
  buildRectangleRoofFeatures,
} from './house/roofRectangleHipped';
import {
  addRoofDissolveSplitPoint,
  canonicalRoofSegmentKey,
  cleanRoofPolygon2D,
  clipRoofPolygonByScalar,
  compareRoofPoints,
  orientRoofFeatureLine,
  point2FromPoint3,
  pointOnRoofSegment2,
  roofPoint2FromKey,
  roofPoint2Key,
  roofPoint3Key,
  roofPointDistance2,
  roofPointOnEaveBoundaryAtWrongHeight,
  roofPolygonArea,
  roofPolygonCentroid,
  roofPolygonIsSimple,
  roofRegionInsideEave,
  roofSegmentIntersectionPoint,
  roofSegmentInsidePolygonStrict,
  roofSegmentOverlapLength2D,
  roofSegmentParam,
  roofSegmentsProperlyIntersect2D,
  segmentInsideRoofPolygon,
  signedArea2D,
} from './house/roof2D';
import { buildJoinedRoofWavefrontRegions } from './house/roofJoinedWavefront';
import {
  mergeAssignedRoofRegions,
  sortJoinedRoofRegions,
  validateJoinedRoofRegionFootprint,
} from './house/roofJoinedDissolve';
import {
  closestPointOnLineSegment2D,
  clearanceToPolygon,
  findInteriorRoofNode,
  isOrthogonalFootprint,
  isRectanglePolygon,
  offsetFootprintPolygon,
  polygonLineInterval,
} from './house/footprintMath';
import { buildHouseOpenings } from './house/openings';


type HouseGableTerminalEnd = {
  id: string;
  sourceEdgeId: string;
  label: string;
};

type HouseGableTerminalIntersection = {
  edgeIndex: number;
  nodePoint: Point3;
  point: Point3;
};

type HouseFootprintOpenSide = {
  bridgeEdgeIndex: number;
  direction: { x: number; y: number };
};

function monoPerimeterProjection(edge: HouseRoofPerimeterEdge, fallAxisXY: Vector3): number {
  const midpointX = (edge.roofStart.x + edge.roofEnd.x) / 2;
  const midpointY = (edge.roofStart.y + edge.roofEnd.y) / 2;
  return midpointX * fallAxisXY.x + midpointY * fallAxisXY.y;
}

function monoPerimeterAlignment(edge: HouseRoofPerimeterEdge, axisXY: Vector3): number {
  const edgeVector = normalizeVector({
    x: edge.roofEnd.x - edge.roofStart.x,
    y: edge.roofEnd.y - edge.roofStart.y,
    z: 0,
  });
  return Math.abs(dotProduct(edgeVector, axisXY));
}

function monoWeatherFlashingRole(
  edge: HouseRoofPerimeterEdge,
  fallAxisXY: Vector3,
): HouseRoofPerimeterFlashingRole {
  const acrossAxisXY = normalizeVector({ x: -fallAxisXY.y, y: fallAxisXY.x, z: 0 });
  return monoPerimeterAlignment(edge, acrossAxisXY) >= monoPerimeterAlignment(edge, fallAxisXY)
    ? 'high_side'
    : 'rake';
}

function samePoint3WithinTolerance(left: Point3, right: Point3, toleranceMm = 1e-3): boolean {
  return (
    Math.abs(left.x - right.x) <= toleranceMm &&
    Math.abs(left.y - right.y) <= toleranceMm &&
    Math.abs(left.z - right.z) <= toleranceMm
  );
}

function attachmentSideFromPerimeterEdge(edge: HouseRoofPerimeterEdge): AttachmentSide | null {
  const dx = edge.eaveEnd.x - edge.eaveStart.x;
  const dy = edge.eaveEnd.y - edge.eaveStart.y;
  if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6) return null;
  const outward = edgeOutwardVector(edge.perimeterPolygon, edge.index);
  if (Math.abs(outward.x) >= Math.abs(outward.y)) {
    return outward.x >= 0 ? 'right' : 'left';
  }
  return outward.y >= 0 ? 'front' : 'rear';
}

function buildAppendageSupportAnalysisFromPerimeterEdges(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
}): HouseRoofAppendageSupportAnalysis {
  const orderedEdges = [...input.perimeterEdges].sort((left, right) => left.index - right.index);
  type CandidateEdge = HouseRoofPerimeterEdge & { hostEdge: AttachmentSide };
  const candidates = orderedEdges.map((edge) => ({
    edge,
    hostEdge: edge.edgeKind === 'drain_eave' ? attachmentSideFromPerimeterEdge(edge) : null,
  }));
  const runs: CandidateEdge[][] = [];
  let currentRun: CandidateEdge[] = [];

  for (const candidate of candidates) {
    if (!candidate.hostEdge) {
      if (currentRun.length > 0) {
        runs.push(currentRun);
        currentRun = [];
      }
      continue;
    }
    const current = { ...candidate.edge, hostEdge: candidate.hostEdge };
    const previous = currentRun[currentRun.length - 1];
    if (
      previous &&
      previous.hostEdge === current.hostEdge &&
      previous.perimeterId === current.perimeterId &&
      previous.index + 1 === current.index
    ) {
      currentRun.push(current);
      continue;
    }
    if (currentRun.length > 0) runs.push(currentRun);
    currentRun = [current];
  }
  if (currentRun.length > 0) runs.push(currentRun);

  if (runs.length > 1) {
    const firstRun = runs[0]!;
    const lastRun = runs[runs.length - 1]!;
    const firstEdge = firstRun[0]!;
    const lastEdge = lastRun[lastRun.length - 1]!;
    const firstPerimeterLength = firstEdge.perimeterPolygon.length;
    if (
      firstRun[0]?.hostEdge === lastRun[0]?.hostEdge &&
      firstEdge.perimeterId === lastEdge.perimeterId &&
      firstEdge.index === 0 &&
      lastEdge.index === firstPerimeterLength - 1
    ) {
      runs[0] = [...lastRun, ...firstRun];
      runs.pop();
    }
  }

  const blockedReasonsBySide: Partial<Record<AttachmentSide, string>> = {
    rear: 'The rear edge does not expose one continuous exterior eave-like appendage run on this roof.',
    front: 'The front edge does not expose one continuous exterior eave-like appendage run on this roof.',
    left: 'The left edge does not expose one continuous exterior eave-like appendage run on this roof.',
    right: 'The right edge does not expose one continuous exterior eave-like appendage run on this roof.',
  };
  const runsBySide = new Map<AttachmentSide, CandidateEdge[][]>();
  for (const run of runs) {
    const hostEdge = run[0]?.hostEdge;
    if (!hostEdge) continue;
    const collection = runsBySide.get(hostEdge) ?? [];
    collection.push(run);
    runsBySide.set(hostEdge, collection);
  }

  const hostRunsBySide: Partial<Record<AttachmentSide, HouseRoofAppendageHostRun>> = {};
  const supportedHostEdges: AttachmentSide[] = [];
  for (const side of ['rear', 'front', 'left', 'right'] as const) {
    const sideRuns = runsBySide.get(side) ?? [];
    if (sideRuns.length === 1) {
      const run = sideRuns[0]!;
      supportedHostEdges.push(side);
      hostRunsBySide[side] = {
        hostEdge: side,
        start: run[0]!.eaveStart,
        end: run[run.length - 1]!.eaveEnd,
        sourceEdgeIds: run.map((edge) => edge.sourceEdgeId),
        sourceRoofPlaneId: run[0]!.sourceRoofPlaneId ?? null,
        perimeterRole: 'drain_eave',
      };
      delete blockedReasonsBySide[side];
      continue;
    }
    if (sideRuns.length > 1) {
      blockedReasonsBySide[side] = `The ${side} edge resolves to multiple exterior appendage runs on this roof.`;
    }
  }

  return {
    supportedHostEdges,
    hostRunsBySide,
    blockedReasonsBySide,
  };
}

function vertexFeatureKind(polygon: Polygon3, index: number): HouseRoofFeatureKind {
  const area = signedAreaXY(polygon);
  const previous = polygon[(index - 1 + polygon.length) % polygon.length]!;
  const current = polygon[index]!;
  const next = polygon[(index + 1) % polygon.length]!;
  const prevVector = { x: current.x - previous.x, y: current.y - previous.y };
  const nextVector = { x: next.x - current.x, y: next.y - current.y };
  const cross = prevVector.x * nextVector.y - prevVector.y * nextVector.x;
  return Math.sign(cross || 1) === Math.sign(area || 1) ? 'hip' : 'valley';
}

export type HouseRoofAppendageHostRun = {
  hostEdge: AttachmentSide;
  start: Point3;
  end: Point3;
  sourceEdgeIds: string[];
  sourceRoofPlaneId?: string | null;
  perimeterRole: 'drain_eave';
};

export type HouseRoofAppendageSupportAnalysis = HouseRoofAppendageSupport & {
  hostRunsBySide: Partial<Record<AttachmentSide, HouseRoofAppendageHostRun>>;
};

type RoofQaStatus = 'valid' | 'invalid';

type HouseRoofQaResult = {
  status: RoofQaStatus;
  facetAreaMm2: number;
  eaveAreaMm2: number;
  areaDeltaMm2: number;
  rejectedFacetCount: number;
  failureReason: string | null;
};

const ROOF_QA_AREA_TOLERANCE_MIN_MM2 = 100;
const ROOF_QA_AREA_TOLERANCE_RATIO = 0.001;

function isPerimeterFlashingEdge(edgeKind: HouseRoofPerimeterEdgeKind): boolean {
  return edgeKind === 'weather_flashed_edge' || edgeKind === 'house_apron_edge';
}

function finiteRoofQaVector(candidate: Vector3): boolean {
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
}

function finiteRoofQaPlane(plane: Plane3): boolean {
  return (
    finiteRoofQaPoint(plane.origin) &&
    finiteRoofQaVector(plane.xAxis) &&
    finiteRoofQaVector(plane.yAxis) &&
    finiteRoofQaVector(plane.normal) &&
    Math.hypot(plane.xAxis.x, plane.xAxis.y, plane.xAxis.z) > ROOF_JOIN_EPSILON_MM &&
    Math.hypot(plane.yAxis.x, plane.yAxis.y, plane.yAxis.z) > ROOF_JOIN_EPSILON_MM &&
    Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z) > ROOF_JOIN_EPSILON_MM
  );
}

function roofQaMetadata(result: HouseRoofQaResult): GeometryMetadata {
  return {
    roofQaStatus: result.status,
    roofQaFacetAreaMm2: Math.round(result.facetAreaMm2),
    roofQaEaveAreaMm2: Math.round(result.eaveAreaMm2),
    roofQaAreaDeltaMm2: Math.round(result.areaDeltaMm2),
    roofQaRejectedFacetCount: result.rejectedFacetCount,
    roofQaFailureReason: result.failureReason,
  };
}

function validateRoofPlaneForQa(roofPlane: RoofPlane3D, eavePolygon: Polygon3): string | null {
  if (roofPlane.boundary.length < 3) return `${roofPlane.id}:too_few_points`;
  if (!roofPlane.boundary.every(finiteRoofQaPoint)) return `${roofPlane.id}:non_finite_boundary`;
  if (!finiteRoofQaPlane(roofPlane.plane)) return `${roofPlane.id}:non_finite_plane`;

  const footprint = cleanRoofPolygon2D(roofPlane.boundary.map(point2FromPoint3));
  if (footprint.length < 3) return `${roofPlane.id}:degenerate_plan`;
  if (roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) return `${roofPlane.id}:zero_plan_area`;
  if (!roofPolygonIsSimple(footprint)) return `${roofPlane.id}:self_intersecting_plan`;
  if (!roofRegionInsideEave(footprint, eavePolygon)) return `${roofPlane.id}:outside_eave_or_spans_void`;

  const centroid = roofPolygonCentroid(footprint);
  const roofGeometry =
    typeof roofPlane.metadata?.roofGeometry === 'string'
      ? roofPlane.metadata.roofGeometry
      : null;
  if (
    roofGeometry !== 'footprint_flat' &&
    roofGeometry !== 'footprint_mono' &&
    !pointInOrOnRoofPolygon(centroid, eavePolygon)
  ) {
    return `${roofPlane.id}:centroid_outside_eave`;
  }
  return null;
}

function validateHouseRoofQa(input: {
  roofPlanes: RoofPlane3D[];
  eavePolygon: Polygon3;
  rejectedFacetCount?: number;
  failureReason?: string | null;
}): HouseRoofQaResult {
  const eaveAreaMm2 = Math.abs(signedAreaXY(input.eavePolygon));
  let facetAreaMm2 = 0;
  let failureReason: string | null = input.failureReason ?? null;

  if (
    input.eavePolygon.length < 3 ||
    input.eavePolygon.some((candidate) => !finiteRoofQaPoint(candidate)) ||
    eaveAreaMm2 <= ROOF_REGION_MIN_AREA_MM2
  ) {
    failureReason = 'invalid_eave_polygon';
  } else {
    const eaveFootprint = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3));
    if (!roofPolygonIsSimple(eaveFootprint)) failureReason = 'self_intersecting_eave_polygon';
  }

  if (input.roofPlanes.length === 0 && !failureReason) {
    failureReason = 'missing_roof_facets';
  }

  for (const roofPlane of input.roofPlanes) {
    const footprint = cleanRoofPolygon2D(roofPlane.boundary.map(point2FromPoint3));
    if (footprint.length >= 3) {
      facetAreaMm2 += roofPolygonArea(footprint);
    }
    failureReason ??= validateRoofPlaneForQa(roofPlane, input.eavePolygon);
  }

  const rejectedFacetCount = Math.max(0, input.rejectedFacetCount ?? 0);
  if (rejectedFacetCount > 0 && !failureReason) {
    failureReason = 'rejected_roof_facets';
  }

  const areaDeltaMm2 = facetAreaMm2 - eaveAreaMm2;
  const areaToleranceMm2 = Math.max(ROOF_QA_AREA_TOLERANCE_MIN_MM2, eaveAreaMm2 * ROOF_QA_AREA_TOLERANCE_RATIO);
  if (!failureReason && Math.abs(areaDeltaMm2) > areaToleranceMm2) {
    failureReason = 'roof_area_mismatch';
  }

  return {
    status: failureReason ? 'invalid' : 'valid',
    facetAreaMm2,
    eaveAreaMm2,
    areaDeltaMm2,
    rejectedFacetCount,
    failureReason,
  };
}

function applyRoofQa(input: {
  roof: HouseRoofBuildResult;
  eavePolygon: Polygon3;
  rejectedFacetCount?: number;
}): HouseRoofBuildResult {
  const topologyFailureReason =
    typeof input.roof.metadata.roofTopologyFailureReason === 'string'
      ? input.roof.metadata.roofTopologyFailureReason
      : null;
  const qaMetadata = roofQaMetadata(
    validateHouseRoofQa({
      roofPlanes: input.roof.roofPlanes,
      eavePolygon: input.eavePolygon,
      rejectedFacetCount: input.rejectedFacetCount,
      failureReason: topologyFailureReason,
    }),
  );
  const topologyMetadata = Object.fromEntries(
    Object.entries(input.roof.metadata).filter(
      ([key]) =>
        key === 'roofFacetMergeMode' ||
        key.startsWith('roofTopology') ||
        key.startsWith('roofWavefront'),
    ),
  );
  return {
    roofPlanes: input.roof.roofPlanes.map((roofPlane) => ({
      ...roofPlane,
      metadata: {
        ...roofPlane.metadata,
        ...topologyMetadata,
        ...qaMetadata,
      },
    })),
    roofFeatures: input.roof.roofFeatures.map((feature) => ({
      ...feature,
      metadata: {
        ...feature.metadata,
        ...topologyMetadata,
        ...qaMetadata,
      },
    })),
    terminalClosures: input.roof.terminalClosures,
    metadata: {
      ...input.roof.metadata,
      ...qaMetadata,
    },
  };
}

function buildJoinedRoofEdges(eavePolygon: Polygon3): JoinedRoofEdge[] {
  const area = signedAreaXY(eavePolygon);
  const edges: JoinedRoofEdge[] = [];
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const start = eavePolygon[index]!;
    const end = eavePolygon[(index + 1) % eavePolygon.length]!;
    const lengthMm = Math.hypot(end.x - start.x, end.y - start.y);
    if (lengthMm <= RIDGE_COLLAPSE_EPSILON_MM) continue;
    const unitX = (end.x - start.x) / lengthMm;
    const unitY = (end.y - start.y) / lengthMm;
    edges.push({
      index,
      id: `house-eave-edge-${index + 1}`,
      start,
      end,
      inwardNormal:
        area >= 0
          ? { x: -unitY, y: unitX }
          : { x: unitY, y: -unitX },
      lengthMm,
      ridgeAxis: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'x' : 'y',
    });
  }
  return edges;
}

function roofRunFromEdge(edge: JoinedRoofEdge, candidate: RoofPoint2): number {
  return (candidate.x - edge.start.x) * edge.inwardNormal.x + (candidate.y - edge.start.y) * edge.inwardNormal.y;
}

function roofHeightFromEdge(input: {
  edge: JoinedRoofEdge;
  candidate: RoofPoint2;
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): number {
  return input.eaveHeightMm + roofRunFromEdge(input.edge, input.candidate) * input.pitchRisePerRun;
}

function roofPlaneReachableFromEdge(input: {
  edge: JoinedRoofEdge;
  candidate: RoofPoint2;
  eavePolygon: Polygon3;
}): boolean {
  const run = roofRunFromEdge(input.edge, input.candidate);
  if (run < -ROOF_JOIN_EPSILON_MM) return false;
  const edgeDx = input.edge.end.x - input.edge.start.x;
  const edgeDy = input.edge.end.y - input.edge.start.y;
  const edgeLength = Math.hypot(edgeDx, edgeDy);
  if (edgeLength <= ROOF_JOIN_EPSILON_MM) return false;
  const unitX = edgeDx / edgeLength;
  const unitY = edgeDy / edgeLength;
  const projectionT = (input.candidate.x - input.edge.start.x) * unitX + (input.candidate.y - input.edge.start.y) * unitY;
  const source = {
    x: input.edge.start.x + unitX * projectionT,
    y: input.edge.start.y + unitY * projectionT,
  };
  if (projectionT >= -ROOF_JOIN_EPSILON_MM && projectionT <= input.edge.lengthMm + ROOF_JOIN_EPSILON_MM) {
    return segmentInsideRoofPolygon(source, input.candidate, input.eavePolygon);
  }

  if (projectionT < 0 && vertexFeatureKind(input.eavePolygon, input.edge.index) === 'valley') {
    return segmentInsideRoofPolygon(point2FromPoint3(input.edge.start), input.candidate, input.eavePolygon);
  }

  const endVertexIndex = (input.edge.index + 1) % input.eavePolygon.length;
  if (projectionT > input.edge.lengthMm && vertexFeatureKind(input.eavePolygon, endVertexIndex) === 'valley') {
    return segmentInsideRoofPolygon(point2FromPoint3(input.edge.end), input.candidate, input.eavePolygon);
  }

  return false;
}

function buildRectilinearRoofBaseRegions(eavePolygon: Polygon3): RoofPoint2[][] {
  const xs = uniqueSorted(eavePolygon.map((candidate) => candidate.x));
  const ys = uniqueSorted(eavePolygon.map((candidate) => candidate.y));
  const regions: RoofPoint2[][] = [];
  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const minX = xs[xIndex]!;
      const maxX = xs[xIndex + 1]!;
      const minY = ys[yIndex]!;
      const maxY = ys[yIndex + 1]!;
      if (maxX - minX <= RIDGE_COLLAPSE_EPSILON_MM || maxY - minY <= RIDGE_COLLAPSE_EPSILON_MM) continue;
      const midpoint = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      if (!pointInPolygon2D(midpoint, eavePolygon)) continue;
      regions.push([
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ]);
    }
  }
  return regions;
}

function splitRoofRegionsByPlaneIntersections(input: {
  regions: RoofPoint2[][];
  edges: JoinedRoofEdge[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): RoofPoint2[][] {
  let regions = input.regions;
  for (let firstIndex = 0; firstIndex < input.edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < input.edges.length; secondIndex += 1) {
      const first = input.edges[firstIndex]!;
      const second = input.edges[secondIndex]!;
      const nextRegions: RoofPoint2[][] = [];
      for (const region of regions) {
        const regionArea = roofPolygonArea(region);
        const scalar = (candidate: RoofPoint2) =>
          roofHeightFromEdge({
            edge: first,
            candidate,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          }) -
          roofHeightFromEdge({
            edge: second,
            candidate,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          });
        const firstSide = clipRoofPolygonByScalar(region, scalar);
        const secondSide = clipRoofPolygonByScalar(region, (candidate) => -scalar(candidate));
        const firstArea = roofPolygonArea(firstSide);
        const secondArea = roofPolygonArea(secondSide);
        if (
          firstArea > ROOF_REGION_MIN_AREA_MM2 &&
          secondArea > ROOF_REGION_MIN_AREA_MM2 &&
          firstArea < regionArea - ROOF_REGION_MIN_AREA_MM2 &&
          secondArea < regionArea - ROOF_REGION_MIN_AREA_MM2
        ) {
          nextRegions.push(firstSide, secondSide);
          continue;
        }
        const kept = firstArea >= secondArea ? firstSide : secondSide;
        if (roofPolygonArea(kept) > ROOF_REGION_MIN_AREA_MM2) nextRegions.push(kept);
      }
      regions = nextRegions;
    }
  }
  return regions;
}

function assignRoofRegion(input: {
  footprint: RoofPoint2[];
  edges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofRegion | null {
  const centroid = roofPolygonCentroid(input.footprint);
  const candidates = input.edges
    .filter((edge) => roofPlaneReachableFromEdge({ edge, candidate: centroid, eavePolygon: input.eavePolygon }))
    .map((edge) => ({
      edge,
      height: roofHeightFromEdge({
        edge,
        candidate: centroid,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun: input.pitchRisePerRun,
      }),
    }))
    .sort((a, b) => a.height - b.height || a.edge.index - b.edge.index);
  const selected = candidates[0];
  if (!selected) return null;
  return { edge: selected.edge, footprint: cleanRoofPolygon2D(input.footprint) };
}

function buildJoinedRoofFacetFromRegion(input: {
  region: JoinedRoofRegion;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  pitchRisePerRun: number;
  allowRaisedBoundaryPoints?: boolean;
}): JoinedRoofFacet | null {
  const footprint = validateJoinedRoofRegionFootprint(input.region.footprint, input.eavePolygon);
  if (!footprint) return null;

  const boundary = footprint.map((candidate) =>
    point(
      candidate.x,
      candidate.y,
      roofHeightFromEdge({
        edge: input.region.edge,
        candidate,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun: input.pitchRisePerRun,
      }),
    ),
  );
  if (boundary.some((candidate) => !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y) || !Number.isFinite(candidate.z))) {
    return null;
  }
  if (
    !input.allowRaisedBoundaryPoints &&
    boundary.some((candidate) => roofPointOnEaveBoundaryAtWrongHeight(candidate, input.eavePolygon, input.eaveHeightMm))
  ) {
    return null;
  }
  return { edge: input.region.edge, footprint, boundary };
}

function buildJoinedRoofFacets(input: {
  eavePolygon: Polygon3;
  edges: JoinedRoofEdge[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofFacetBuildResult {
  const baseRegions = buildRectilinearRoofBaseRegions(input.eavePolygon);
  const splitRegions = splitRoofRegionsByPlaneIntersections({
    regions: baseRegions,
    edges: input.edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun: input.pitchRisePerRun,
  });
  const assignedRegions = splitRegions
    .map((footprint) =>
      assignRoofRegion({
        footprint,
        edges: input.edges,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun: input.pitchRisePerRun,
      }),
    )
    .filter((region): region is JoinedRoofRegion => Boolean(region));
  const wavefrontRegions = buildJoinedRoofWavefrontRegions({
    eavePolygon: input.eavePolygon,
    edges: input.edges,
  });
  const mergedRegions = mergeAssignedRoofRegions(wavefrontRegions.regions);
  const facets: JoinedRoofFacet[] = [];
  let rejectedFacetCount = 0;

  for (const region of sortJoinedRoofRegions(mergedRegions.regions)) {
    const facet = buildJoinedRoofFacetFromRegion({
      region,
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      pitchRisePerRun: input.pitchRisePerRun,
    });
    if (facet) {
      facets.push(facet);
    } else {
      rejectedFacetCount += 1;
    }
  }

  const internalEaveHeightSegmentCount = countJoinedRoofInternalEaveHeightSegments({
    facets,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const sourceEdgeCount = new Set(facets.map((facet) => facet.edge.index)).size;
  const disconnectedSourceFaceCount = Math.max(0, facets.length - sourceEdgeCount);
  let topologyFailureReason = wavefrontRegions.failureReason ?? mergedRegions.topologyFailureReason;
  if (!topologyFailureReason && facets.length !== input.edges.length) {
    topologyFailureReason = `roof_topology_face_count_mismatch:${facets.length}:${input.edges.length}`;
  }
  if (!topologyFailureReason && disconnectedSourceFaceCount > 0) {
    topologyFailureReason = 'roof_topology_disconnected_source_faces';
  }
  if (!topologyFailureReason && internalEaveHeightSegmentCount > 0) {
    topologyFailureReason = 'roof_topology_internal_eave_height_seams';
  }

  return {
    facets,
    metadata: {
      roofFacetMergeMode: 'active_rectilinear_wavefront',
      ...wavefrontRegions.metadata,
      roofBaseRegionCount: baseRegions.length,
      roofSplitRegionCount: splitRegions.length,
      roofAssignedRegionCount: assignedRegions.length,
      roofAtomicRegionCount: mergedRegions.atomicRegionCount,
      roofDissolvedRegionCount: mergedRegions.dissolvedRegionCount,
      roofDiscardedDissolveLoopCount: mergedRegions.discardedLoopCount,
      roofFacetComponentCount: mergedRegions.regions.length,
      roofPreservedRegionFacetCount: facets.length,
      roofRejectedFacetCount: rejectedFacetCount,
      roofTopologyFailureReason: topologyFailureReason,
      roofTopologyFinalFaceCount: facets.length,
      roofTopologySourceEdgeCount: sourceEdgeCount,
      roofTopologyDisconnectedSourceFaceCount: disconnectedSourceFaceCount,
      roofTopologyInternalEaveHeightSegmentCount: internalEaveHeightSegmentCount,
      roofTopologyProjectionViolationCount: 0,
    },
  };
}

function roofFeatureTouchesPoint(feature: Line3, candidate: Point3): boolean {
  return (
    Math.hypot(feature.start.x - candidate.x, feature.start.y - candidate.y, feature.start.z - candidate.z) <= 1 ||
    Math.hypot(feature.end.x - candidate.x, feature.end.y - candidate.y, feature.end.z - candidate.z) <= 1
  );
}

function countJoinedRoofInternalEaveHeightSegments(input: {
  facets: JoinedRoofFacet[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): number {
  const seen = new Set<string>();
  for (const facet of input.facets) {
    for (let index = 0; index < facet.boundary.length; index += 1) {
      const start = facet.boundary[index]!;
      const end = facet.boundary[(index + 1) % facet.boundary.length]!;
      if (
        Math.abs(start.z - input.eaveHeightMm) > 1 ||
        Math.abs(end.z - input.eaveHeightMm) > 1 ||
        lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM
      ) {
        continue;
      }
      if (
        segmentOnEaveBoundary({
          start,
          end,
          eavePolygon: input.eavePolygon,
          eaveHeightMm: input.eaveHeightMm,
        })
      ) {
        continue;
      }
      seen.add(canonicalRoofSegmentKey(start, end));
    }
  }
  return seen.size;
}

function segmentOnEaveBoundary(input: { start: Point3; end: Point3; eavePolygon: Polygon3; eaveHeightMm: number }): boolean {
  if (
    Math.abs(input.start.z - input.eaveHeightMm) > ROOF_JOIN_EPSILON_MM ||
    Math.abs(input.end.z - input.eaveHeightMm) > ROOF_JOIN_EPSILON_MM
  ) {
    return false;
  }
  let overlapLength = 0;
  const segmentLength = lineLength(line(input.start, input.end));
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const edgeStart = input.eavePolygon[index]!;
    const edgeEnd = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    overlapLength += roofSegmentOverlapLength2D(
      point2FromPoint3(input.start),
      point2FromPoint3(input.end),
      point2FromPoint3(edgeStart),
      point2FromPoint3(edgeEnd),
    );
  }
  return overlapLength >= segmentLength - ROOF_JOIN_FEATURE_MIN_LENGTH_MM;
}

function findEaveVertexIndex(candidate: Point3, eavePolygon: Polygon3, eaveHeightMm: number): number | null {
  if (Math.abs(candidate.z - eaveHeightMm) > 1) return null;
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const vertex = eavePolygon[index]!;
    if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= 1) return index;
  }
  return null;
}

function findEaveVertexIndexXY(candidate: Point3, eavePolygon: Polygon3): number | null {
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const vertex = eavePolygon[index]!;
    if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= 1) return index;
  }
  return null;
}

function classifyJoinedRoofFeature(input: {
  start: Point3;
  end: Point3;
  sourceEdges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): HouseRoofFeatureKind {
  const startVertexIndex = findEaveVertexIndex(input.start, input.eavePolygon, input.eaveHeightMm);
  if (startVertexIndex !== null) return vertexFeatureKind(input.eavePolygon, startVertexIndex);
  const endVertexIndex = findEaveVertexIndex(input.end, input.eavePolygon, input.eaveHeightMm);
  if (endVertexIndex !== null) return vertexFeatureKind(input.eavePolygon, endVertexIndex);
  if (Math.min(input.start.z, input.end.z) > input.eaveHeightMm + 1) return 'ridge';
  if (input.sourceEdges.length >= 2) {
    const first = input.sourceEdges[0]!;
    const second = input.sourceEdges[1]!;
    const normalDot = first.inwardNormal.x * second.inwardNormal.x + first.inwardNormal.y * second.inwardNormal.y;
    if (normalDot < -0.5) return 'ridge';
  }
  return 'hip';
}

function buildJoinedRoofFeatures(input: {
  facets: JoinedRoofFacet[];
  edges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofForm: HouseRoofForm;
  roofGeometry: string;
}): HouseRoofFeature3D[] {
  const segments = new Map<
    string,
    {
      start: Point3;
      end: Point3;
      sourceEdgeIndexes: Set<number>;
      count: number;
    }
  >();

  for (const facet of input.facets) {
    for (let index = 0; index < facet.boundary.length; index += 1) {
      const start = facet.boundary[index]!;
      const end = facet.boundary[(index + 1) % facet.boundary.length]!;
      if (lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      const key = canonicalRoofSegmentKey(start, end);
      const existing = segments.get(key);
      if (existing) {
        existing.sourceEdgeIndexes.add(facet.edge.index);
        existing.count += 1;
      } else {
        segments.set(key, { start, end, sourceEdgeIndexes: new Set([facet.edge.index]), count: 1 });
      }
    }
  }

  const drafts: JoinedRoofFeatureDraft[] = [];
  const seen = new Set<string>();
  for (const segment of segments.values()) {
    if (segment.count < 2) continue;
    if (segment.sourceEdgeIndexes.size < 2) continue;
    if (
      segmentOnEaveBoundary({
        start: segment.start,
        end: segment.end,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      })
    ) {
      continue;
    }
    const sourceEdges = [...segment.sourceEdgeIndexes]
      .map((index) => input.edges.find((edge) => edge.index === index))
      .filter((edge): edge is JoinedRoofEdge => Boolean(edge));
    const featureLine = orientRoofFeatureLine(segment.start, segment.end, input.eaveHeightMm);
    const featureKey = canonicalRoofSegmentKey(featureLine.start, featureLine.end);
    if (seen.has(featureKey)) continue;
    seen.add(featureKey);
    drafts.push({
      kind: classifyJoinedRoofFeature({
        start: featureLine.start,
        end: featureLine.end,
        sourceEdges,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      line: featureLine,
      sourceEdgeIds: sourceEdges.map((edge) => edge.id).sort(),
      roofFeatureSource: 'facet_adjacency',
    });
  }

  const highCandidates = input.facets.flatMap((facet) =>
    facet.boundary.filter((candidate) => candidate.z > input.eaveHeightMm + 1),
  );
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    if (vertexFeatureKind(input.eavePolygon, index) !== 'valley') continue;
    const vertex = point(input.eavePolygon[index]!.x, input.eavePolygon[index]!.y, input.eaveHeightMm);
    if (drafts.some((draft) => draft.kind === 'valley' && roofFeatureTouchesPoint(draft.line, vertex))) continue;
    const target = [...highCandidates]
      .filter((candidate) => {
        if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return false;
        return segmentInsideRoofPolygon(vertex, candidate, input.eavePolygon);
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - vertex.x, a.y - vertex.y) - Math.hypot(b.x - vertex.x, b.y - vertex.y) ||
          a.z - b.z,
      )[0];
    if (!target || lineLength(line(vertex, target)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
    const featureLine = orientRoofFeatureLine(vertex, target, input.eaveHeightMm);
    const featureKey = canonicalRoofSegmentKey(featureLine.start, featureLine.end);
    if (seen.has(featureKey)) continue;
    seen.add(featureKey);
    const previousEdge = input.edges.find((edge) => edge.index === (index - 1 + input.eavePolygon.length) % input.eavePolygon.length);
    const nextEdge = input.edges.find((edge) => edge.index === index);
    drafts.push({
      kind: 'valley',
      line: featureLine,
      sourceEdgeIds: [previousEdge?.id, nextEdge?.id].filter((edgeId): edgeId is string => Boolean(edgeId)).sort(),
      roofFeatureSource: 'reentrant_fallback',
    });
  }

  const kindOrder: Record<HouseRoofFeatureKind, number> = {
    ridge: 0,
    hip: 1,
    valley: 2,
    gable_end_frame: 3,
  };
  drafts.sort(
    (a, b) =>
      kindOrder[a.kind] - kindOrder[b.kind] ||
      compareRoofPoints(a.line.start, b.line.start) ||
      compareRoofPoints(a.line.end, b.line.end),
  );

  const counters: Record<HouseRoofFeatureKind, number> = {
    ridge: 0,
    hip: 0,
    valley: 0,
    gable_end_frame: 0,
  };
  return drafts.map((draft) => {
    counters[draft.kind] += 1;
    return {
      id: `house-roof-${draft.kind}-${counters[draft.kind]}`,
      kind: draft.kind,
      line: draft.line,
      metadata: {
        roofForm: input.roofForm,
        footprintFollowing: true,
        roofGeometry: input.roofGeometry,
        sourceEdgeIds: draft.sourceEdgeIds.join(','),
        roofFeatureSource: draft.roofFeatureSource,
      },
    };
  });
}

function buildJoinedRectilinearHippedRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  metadata?: GeometryMetadata;
} {
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  if (!Number.isFinite(pitchRisePerRun) || pitchRisePerRun <= 0) {
    return { roofPlanes: [], roofFeatures: [] };
  }
  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (eavePolygon.length < 4 || Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM) {
    return { roofPlanes: [], roofFeatures: [] };
  }
  const edges = buildJoinedRoofEdges(eavePolygon);
  const facetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const facets = facetResult.facets;

  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;
  for (const facet of facets) {
    const highPoint = facet.boundary.reduce((selected, candidate) => (candidate.z > selected.z ? candidate : selected), facet.boundary[0]!);
    const lowPoint = point((facet.edge.start.x + facet.edge.end.x) / 2, (facet.edge.start.y + facet.edge.end.y) / 2, input.eaveHeightMm);
    if (lineLength(line(lowPoint, highPoint)) <= RIDGE_COLLAPSE_EPSILON_MM) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${roofPlanes.length + 1}`,
        boundary: facet.boundary,
        highPoint,
        lowPoint,
        ridgeAxis: facet.edge.ridgeAxis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'rectilinear_joined_hipped',
        },
      }),
    );
    renderedFacets.push(facet);
  }

  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'hipped',
    roofGeometry: 'rectilinear_joined_hipped',
  });
  const fallbackFeatureCount = roofFeatures.filter((feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback').length;
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const topologyFailureReason =
    typeof facetResult.metadata.roofTopologyFailureReason === 'string'
      ? facetResult.metadata.roofTopologyFailureReason
      : fallbackFeatureCount > 0
        ? 'roof_topology_fallback_features'
        : null;
  return {
    roofPlanes,
    roofFeatures,
    metadata: {
      ...facetResult.metadata,
      roofTopologyFailureReason: topologyFailureReason,
      roofRejectedFacetCount:
        (typeof facetResult.metadata.roofRejectedFacetCount === 'number' ? facetResult.metadata.roofRejectedFacetCount : 0) +
        skippedDegenerateFacetCount,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}

function ridgeGraphTerminalNodes(features: HouseRoofFeature3D[]): Array<{
  point: Point3;
  neighbor: Point3;
}> {
  const ridges = features.filter((feature) => feature.kind === 'ridge');
  const degreeByKey = new Map<string, number>();
  const pointByKey = new Map<string, Point3>();
  const neighborsByKey = new Map<string, Point3[]>();

  for (const ridge of ridges) {
    const startKey = roofPoint2Key(point2FromPoint3(ridge.line.start));
    const endKey = roofPoint2Key(point2FromPoint3(ridge.line.end));
    pointByKey.set(startKey, ridge.line.start);
    pointByKey.set(endKey, ridge.line.end);
    degreeByKey.set(startKey, (degreeByKey.get(startKey) ?? 0) + 1);
    degreeByKey.set(endKey, (degreeByKey.get(endKey) ?? 0) + 1);
    neighborsByKey.set(startKey, [...(neighborsByKey.get(startKey) ?? []), ridge.line.end]);
    neighborsByKey.set(endKey, [...(neighborsByKey.get(endKey) ?? []), ridge.line.start]);
  }

  return [...degreeByKey.entries()]
    .filter(([, degree]) => degree === 1)
    .map(([key]) => ({
      point: pointByKey.get(key)!,
      neighbor: neighborsByKey.get(key)?.[0]!,
    }))
    .filter((candidate) => Boolean(candidate.point) && Boolean(candidate.neighbor));
}

function roofFeaturesAreAxisAligned(features: HouseRoofFeature3D[]): boolean {
  return features.every((feature) => {
    const dx = Math.abs(feature.line.end.x - feature.line.start.x);
    const dy = Math.abs(feature.line.end.y - feature.line.start.y);
    return dx <= 1e-6 || dy <= 1e-6;
  });
}

function convexHullRoofPoints(points: RoofPoint2[]): RoofPoint2[] {
  const sorted = [...points]
    .map((point) => ({
      x: Math.round(point.x * 1_000_000) / 1_000_000,
      y: Math.round(point.y * 1_000_000) / 1_000_000,
    }))
    .sort((left, right) => (left.x === right.x ? left.y - right.y : left.x - right.x))
    .filter((point, index, all) =>
      index === 0 || point.x !== all[index - 1]?.x || point.y !== all[index - 1]?.y,
    );
  if (sorted.length <= 2) return sorted;

  const cross = (origin: RoofPoint2, first: RoofPoint2, second: RoofPoint2) =>
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);

  const lower: RoofPoint2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 1e-6) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: RoofPoint2[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 1e-6) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function roofPointOnSegment2D(candidate: RoofPoint2, start: RoofPoint2, end: RoofPoint2): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
  if (Math.abs(cross) > 1e-3) return false;
  const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
  if (dot < -1e-3) return false;
  return dot <= dx * dx + dy * dy + 1e-3;
}

function edgeLiesOnConvexHull(input: {
  polygon: Polygon3;
  edgeIndex: number;
}): boolean {
  const hull = convexHullRoofPoints(input.polygon.map(point2FromPoint3));
  const start = point2FromPoint3(input.polygon[input.edgeIndex]!);
  const end = point2FromPoint3(input.polygon[(input.edgeIndex + 1) % input.polygon.length]!);
  return hull.some((hullStart, index) => {
    const hullEnd = hull[(index + 1) % hull.length]!;
    return roofPointOnSegment2D(start, hullStart, hullEnd) && roofPointOnSegment2D(end, hullStart, hullEnd);
  });
}

function outwardNormalForEdge(input: {
  polygon: Polygon3;
  edgeIndex: number;
}): { x: number; y: number } | null {
  const start = input.polygon[input.edgeIndex]!;
  const end = input.polygon[(input.edgeIndex + 1) % input.polygon.length]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return null;
  const unitX = dx / length;
  const unitY = dy / length;
  return signedAreaXY(input.polygon) >= 0
    ? { x: unitY, y: -unitX }
    : { x: -unitY, y: unitX };
}

function deriveHouseFootprintOpenSide(polygon: Polygon3): HouseFootprintOpenSide | null {
  if (!isOrthogonalFootprint(polygon)) return null;
  const valleyIndexes = polygon
    .map((_, index) => (vertexFeatureKind(polygon, index) === 'valley' ? index : null))
    .filter((index): index is number => index !== null);
  if (valleyIndexes.length !== 2) return null;

  const bridgeEdgeIndex = valleyIndexes.find((index) =>
    valleyIndexes.includes((index + 1) % polygon.length),
  );
  if (bridgeEdgeIndex == null) return null;

  const direction = outwardNormalForEdge({
    polygon,
    edgeIndex: bridgeEdgeIndex,
  });
  if (!direction) return null;
  return {
    bridgeEdgeIndex,
    direction,
  };
}

function deriveLegacyHouseGableTerminalEndsX(input: {
  footprint: Polygon3;
}): HouseGableTerminalEnd[] {
  const segments = input.footprint
    .map((start, index) => {
      const end = input.footprint[(index + 1) % input.footprint.length]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length <= 1e-6) return null;
      const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (axis !== 'y') return null;
      return {
        index,
        sourceEdgeId: `footprint-edge-${index + 1}`,
        midpoint: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => Boolean(segment))
    .sort((left, right) => left.midpoint.x - right.midpoint.x || left.midpoint.y - right.midpoint.y || left.index - right.index);

  return segments.map((segment, index) => ({
    id: `house-gable-end-x-${segment.index + 1}`,
    sourceEdgeId: segment.sourceEdgeId,
    label: `End ${index + 1}`,
  }));
}

function intersectTerminalRayWithFootprint(input: {
  origin: Point3;
  neighbor: Point3;
  polygon: Polygon3;
}): number | null {
  return intersectTerminalRayWithFootprintDetail(input)?.edgeIndex ?? null;
}

function intersectTerminalRayWithFootprintDetail(input: {
  origin: Point3;
  neighbor: Point3;
  polygon: Polygon3;
}): HouseGableTerminalIntersection | null {
  const dx = input.origin.x - input.neighbor.x;
  const dy = input.origin.y - input.neighbor.y;
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const direction = axis === 'x' ? Math.sign(dx || 1) : Math.sign(dy || 1);
  let selectedIndex: number | null = null;
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    if (axis === 'x') {
      if (Math.abs(start.x - end.x) > 1e-6) continue;
      const minY = Math.min(start.y, end.y) - 1e-6;
      const maxY = Math.max(start.y, end.y) + 1e-6;
      if (input.origin.y < minY || input.origin.y > maxY) continue;
      const distance = (start.x - input.origin.x) * direction;
      if (distance <= ROOF_JOIN_EPSILON_MM || distance >= selectedDistance) continue;
      selectedDistance = distance;
      selectedIndex = index;
      continue;
    }
    if (Math.abs(start.y - end.y) > 1e-6) continue;
    const minX = Math.min(start.x, end.x) - 1e-6;
    const maxX = Math.max(start.x, end.x) + 1e-6;
    if (input.origin.x < minX || input.origin.x > maxX) continue;
    const distance = (start.y - input.origin.y) * direction;
    if (distance <= ROOF_JOIN_EPSILON_MM || distance >= selectedDistance) continue;
    selectedDistance = distance;
    selectedIndex = index;
  }

  if (selectedIndex === null) return null;
  const start = input.polygon[selectedIndex]!;
  return axis === 'x'
    ? {
        edgeIndex: selectedIndex,
        nodePoint: input.origin,
        point: point(start.x, input.origin.y, input.origin.z),
      }
    : {
        edgeIndex: selectedIndex,
        nodePoint: input.origin,
        point: point(input.origin.x, start.y, input.origin.z),
      };
}

function deriveBentSpineTerminalIntersectionsX(input: {
  footprint: Polygon3;
  ridgeFeatures: HouseRoofFeature3D[];
}): HouseGableTerminalIntersection[] | null {
  if (!input.ridgeFeatures.length || !roofFeaturesAreAxisAligned(input.ridgeFeatures)) return null;
  const terminalIntersections = ridgeGraphTerminalNodes(input.ridgeFeatures)
    .map((node) =>
      intersectTerminalRayWithFootprintDetail({
        origin: node.point,
        neighbor: node.neighbor,
        polygon: input.footprint,
      }),
    )
    .filter((detail): detail is HouseGableTerminalIntersection => detail !== null);
  const byEdgeIndex = new Map<number, HouseGableTerminalIntersection>();
  for (const detail of terminalIntersections) {
    byEdgeIndex.set(detail.edgeIndex, detail);
  }
  const uniqueIndexes = [...byEdgeIndex.keys()];
  const outerIndexes =
    uniqueIndexes.length > 2
      ? uniqueIndexes.filter((edgeIndex) =>
          edgeLiesOnConvexHull({
            polygon: input.footprint,
            edgeIndex,
          }),
        )
      : uniqueIndexes;
  const selectedIndexes = outerIndexes.length > 0 ? outerIndexes : uniqueIndexes;
  if (!selectedIndexes.length) return null;
  return selectedIndexes
    .map((edgeIndex) => byEdgeIndex.get(edgeIndex)!)
    .sort((left, right) => left.point.x - right.point.x || left.point.y - right.point.y);
}

function buildBentSpineGableTerminalEndsX(input: {
  footprint: Polygon3;
}): HouseGableTerminalEnd[] {
  if (!isOrthogonalFootprint(input.footprint)) return [];
  const eavePolygon = cleanRoofPolygon2D(input.footprint.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (eavePolygon.length < 4 || Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM) return [];

  const edges = buildJoinedRoofEdges(eavePolygon);
  const facetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: 0,
    pitchRisePerRun: 1,
  });
  const ridgeFeatures = buildJoinedRoofFeatures({
    facets: facetResult.facets,
    edges,
    eavePolygon,
    eaveHeightMm: 0,
    roofForm: 'gable',
    roofGeometry: 'bent_spine_joined_gable',
  }).filter((feature) => feature.kind === 'ridge');
  const terminalIntersections = deriveBentSpineTerminalIntersectionsX({
    footprint: eavePolygon,
    ridgeFeatures,
  });
  if (!terminalIntersections) {
    return deriveLegacyHouseGableTerminalEndsX({ footprint: eavePolygon });
  }
  return terminalIntersections
    .map((detail) => ({
      id: `house-gable-end-x-${detail.edgeIndex + 1}`,
      sourceEdgeId: `footprint-edge-${detail.edgeIndex + 1}`,
      midpoint: {
        x: detail.point.x,
        y: detail.point.y,
      },
    }))
    .sort((left, right) => left.midpoint.x - right.midpoint.x || left.midpoint.y - right.midpoint.y)
    .map((candidate, index) => ({
      id: candidate.id,
      sourceEdgeId: candidate.sourceEdgeId,
      label: `End ${index + 1}`,
    }));
}

function deriveBentSpineTerminalGableClosures(input: {
  terminalIntersections: HouseGableTerminalIntersection[] | null;
}): BentSpineTerminalGableClosure[] {
  return (input.terminalIntersections ?? []).map((detail) => ({
    edgeIndex: detail.edgeIndex,
    sourceEdgeId: `footprint-edge-${detail.edgeIndex + 1}`,
    nodePoint: detail.nodePoint,
    point: detail.point,
    axis:
      Math.abs(detail.point.x - detail.nodePoint.x) >= Math.abs(detail.point.y - detail.nodePoint.y)
        ? 'x'
        : 'y',
  }));
}

function applyBentSpineTerminalGableClosures(input: {
  facets: JoinedRoofFacet[];
  terminalClosures: BentSpineTerminalGableClosure[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofFacet[] {
  if (!input.terminalClosures.length) return input.facets;

  const closureByEdgeIndex = new Map(
    input.terminalClosures.map((closure) => [closure.edgeIndex, closure]),
  );
  const closureByNodeKey = new Map(
    input.terminalClosures.map((closure) => [roofPoint3Key(closure.nodePoint), closure]),
  );

  return input.facets.flatMap((facet) => {
    if (closureByEdgeIndex.has(facet.edge.index)) return [];

    const nextBoundary = facet.boundary.map((candidate) => {
      const closure = closureByNodeKey.get(roofPoint3Key(candidate));
      return closure ? closure.point : candidate;
    });
    const nextFootprint = cleanRoofPolygon2D(nextBoundary.map(point2FromPoint3));
    if (nextFootprint.length < 3 || roofPolygonArea(nextFootprint) <= ROOF_REGION_MIN_AREA_MM2) {
      return [];
    }

    const changed = nextBoundary.some(
      (candidate, index) => !samePoint3WithinTolerance(candidate, facet.boundary[index]!),
    );
    if (!changed) return [facet];

    return [{
      ...facet,
      footprint: nextFootprint,
      boundary: nextFootprint.map((candidate) =>
        point(
          candidate.x,
          candidate.y,
          roofHeightFromEdge({
            edge: facet.edge,
            candidate,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          }),
        ),
      ),
    }];
  });
}

function buildLegacyJoinedRectilinearGableRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  metadata?: GeometryMetadata;
} {
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  if (!Number.isFinite(pitchRisePerRun) || pitchRisePerRun <= 0) {
    return { roofPlanes: [], roofFeatures: [] };
  }
  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (
    eavePolygon.length < 4 ||
    Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM ||
    !isOrthogonalFootprint(input.sourceFootprint)
  ) {
    return { roofPlanes: [], roofFeatures: [] };
  }

  const allEdges = buildJoinedRoofEdges(eavePolygon);
  const edges = allEdges.filter((edge) => edge.ridgeAxis === input.ridgeAxis);
  if (edges.length < 2) {
    return { roofPlanes: [], roofFeatures: [] };
  }

  const baseRegions = buildRectilinearRoofBaseRegions(eavePolygon);
  const splitRegions = splitRoofRegionsByPlaneIntersections({
    regions: baseRegions,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const assignedRegions = splitRegions
    .map((footprint) =>
      assignRoofRegion({
        footprint,
        edges,
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
        pitchRisePerRun,
      }),
    )
    .filter((region): region is JoinedRoofRegion => Boolean(region));
  const mergedRegions = mergeAssignedRoofRegions(assignedRegions);
  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;

  for (const region of sortJoinedRoofRegions(mergedRegions.regions)) {
    const facet = buildJoinedRoofFacetFromRegion({
      region,
      eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      pitchRisePerRun,
      allowRaisedBoundaryPoints: true,
    });
    if (!facet) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    const highPoint = facet.boundary.reduce(
      (selected, candidate) => (candidate.z > selected.z ? candidate : selected),
      facet.boundary[0]!,
    );
    const lowPoint = point(
      (facet.edge.start.x + facet.edge.end.x) / 2,
      (facet.edge.start.y + facet.edge.end.y) / 2,
      input.eaveHeightMm,
    );
    if (lineLength(line(lowPoint, highPoint)) <= RIDGE_COLLAPSE_EPSILON_MM) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${roofPlanes.length + 1}`,
        boundary: facet.boundary,
        highPoint,
        lowPoint,
        ridgeAxis: input.ridgeAxis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          roofForm: 'gable',
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'rectilinear_joined_gable',
        },
      }),
    );
    renderedFacets.push(facet);
  }

  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'gable',
    roofGeometry: 'rectilinear_joined_gable',
  }).filter((feature) => feature.kind === 'ridge' || feature.kind === 'valley');
  const fallbackFeatureCount = roofFeatures.filter(
    (feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback',
  ).length;
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const topologyFailureReason =
    typeof mergedRegions.topologyFailureReason === 'string'
      ? mergedRegions.topologyFailureReason
      : roofPlanes.length === 0
        ? 'roof_topology_missing_facets'
        : null;

  return {
    roofPlanes,
    roofFeatures,
    metadata: {
      ridgeAxis: input.ridgeAxis,
      roofFacetMergeMode: 'rectilinear_split_assignment',
      roofBaseRegionCount: baseRegions.length,
      roofSplitRegionCount: splitRegions.length,
      roofAssignedRegionCount: assignedRegions.length,
      roofAtomicRegionCount: mergedRegions.atomicRegionCount,
      roofDissolvedRegionCount: mergedRegions.dissolvedRegionCount,
      roofDiscardedDissolveLoopCount: mergedRegions.discardedLoopCount,
      roofFacetComponentCount: mergedRegions.regions.length,
      roofPreservedRegionFacetCount: roofPlanes.length,
      roofTopologyFailureReason: topologyFailureReason,
      roofRejectedFacetCount: skippedDegenerateFacetCount,
      roofTopologyFinalFaceCount: roofPlanes.length,
      roofTopologySourceEdgeCount: new Set(renderedFacets.map((facet) => facet.edge.index)).size,
      roofTopologyDisconnectedSourceFaceCount: Math.max(
        0,
        roofPlanes.length - new Set(renderedFacets.map((facet) => facet.edge.index)).size,
      ),
      roofTopologyInternalEaveHeightSegmentCount: countJoinedRoofInternalEaveHeightSegments({
        facets: renderedFacets,
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      roofTopologyProjectionViolationCount: 0,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}

function buildBentSpineJoinedGableRoofX(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  if (!Number.isFinite(pitchRisePerRun) || pitchRisePerRun <= 0) {
    return { roofPlanes: [], roofFeatures: [], terminalEnds: [], terminalClosures: [] };
  }
  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  if (eavePolygon.length < 4 || Math.abs(signedAreaXY(eavePolygon)) <= ROOF_JOIN_EPSILON_MM) {
    return { roofPlanes: [], roofFeatures: [], terminalEnds: [], terminalClosures: [] };
  }

  const terminalEnds = buildBentSpineGableTerminalEndsX({ footprint: eavePolygon });
  const edges = buildJoinedRoofEdges(eavePolygon);
  const facetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const rawRoofFeatures = buildJoinedRoofFeatures({
    facets: facetResult.facets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'gable',
    roofGeometry: 'bent_spine_joined_gable',
  }).filter((feature) => feature.kind === 'ridge' || feature.kind === 'valley');
  const terminalIntersections = deriveBentSpineTerminalIntersectionsX({
    footprint: eavePolygon,
    ridgeFeatures: rawRoofFeatures.filter((feature) => feature.kind === 'ridge'),
  });
  const terminalClosures = deriveBentSpineTerminalGableClosures({
    terminalIntersections,
  });
  const closedFacets = applyBentSpineTerminalGableClosures({
    facets: facetResult.facets,
    terminalClosures,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;
  for (const facet of closedFacets) {
    const highPoint = facet.boundary.reduce(
      (selected, candidate) => (candidate.z > selected.z ? candidate : selected),
      facet.boundary[0]!,
    );
    const lowPoint = point(
      (facet.edge.start.x + facet.edge.end.x) / 2,
      (facet.edge.start.y + facet.edge.end.y) / 2,
      input.eaveHeightMm,
    );
    if (lineLength(line(lowPoint, highPoint)) <= RIDGE_COLLAPSE_EPSILON_MM) {
      skippedDegenerateFacetCount += 1;
      continue;
    }
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${roofPlanes.length + 1}`,
        boundary: facet.boundary,
        highPoint,
        lowPoint,
        ridgeAxis: facet.edge.ridgeAxis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          roofForm: 'gable',
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'bent_spine_joined_gable',
          roofTerminalClosureFacet: terminalClosures.some((closure) =>
            facet.boundary.some((candidate) => samePoint3WithinTolerance(candidate, closure.point)),
          ),
          roofTerminalClosureSourceEdgeIds:
            terminalClosures
              .filter((closure) =>
                facet.boundary.some((candidate) => samePoint3WithinTolerance(candidate, closure.point)),
              )
              .map((closure) => closure.sourceEdgeId)
              .join(',') || null,
        },
      }),
    );
    renderedFacets.push(facet);
  }
  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'gable',
    roofGeometry: 'bent_spine_joined_gable',
  }).filter((feature) => feature.kind === 'ridge' || feature.kind === 'valley');
  const fallbackFeatureCount = roofFeatures.filter(
    (feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback',
  ).length;
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const sourceEdgeCount = new Set(renderedFacets.map((facet) => facet.edge.index)).size;
  const disconnectedSourceFaceCount = Math.max(0, renderedFacets.length - sourceEdgeCount);
  const internalEaveHeightSegmentCount = countJoinedRoofInternalEaveHeightSegments({
    facets: renderedFacets,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const topologyFailureReason =
    typeof facetResult.metadata.roofTopologyFailureReason === 'string'
      ? facetResult.metadata.roofTopologyFailureReason
      : disconnectedSourceFaceCount > 0
        ? 'roof_topology_disconnected_source_faces'
        : internalEaveHeightSegmentCount > 0
          ? 'roof_topology_internal_eave_height_seams'
          : null;

  return {
    roofPlanes,
    roofFeatures,
    terminalEnds,
    terminalClosures,
    metadata: {
      ...facetResult.metadata,
      roofGeometry: 'bent_spine_joined_gable',
      roofFacetMergeMode: 'active_rectilinear_wavefront_bent_spine',
      roofTerminalEndCount: terminalEnds.length,
      roofTerminalClosureCount: terminalClosures.length,
      roofTopologyFailureReason: topologyFailureReason,
      roofRejectedFacetCount:
        (typeof facetResult.metadata.roofRejectedFacetCount === 'number'
          ? facetResult.metadata.roofRejectedFacetCount
          : 0) + skippedDegenerateFacetCount,
      roofTopologyFinalFaceCount: roofPlanes.length,
      roofTopologySourceEdgeCount: sourceEdgeCount,
      roofTopologyDisconnectedSourceFaceCount: disconnectedSourceFaceCount,
      roofTopologyInternalEaveHeightSegmentCount: internalEaveHeightSegmentCount,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}

function reflectRoofBuildResultAcrossX(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
  centerX: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  return {
    roofPlanes: input.roofPlanes.map((roofPlane) => {
      const boundary = roofPlane.boundary.map((candidate) =>
        reflectPointAcrossX({ candidate, centerX: input.centerX }),
      );
      return {
        ...roofPlane,
        boundary,
        plane: planeFromBoundary(boundary) ?? roofPlane.plane,
        fallVector: reflectVectorAcrossX(roofPlane.fallVector),
      };
    }),
    roofFeatures: input.roofFeatures.map((feature) => ({
      ...feature,
      line: {
        start: reflectPointAcrossX({ candidate: feature.line.start, centerX: input.centerX }),
        end: reflectPointAcrossX({ candidate: feature.line.end, centerX: input.centerX }),
      },
    })),
    terminalEnds: input.terminalEnds,
    terminalClosures: input.terminalClosures?.map((closure) => ({
      ...closure,
      nodePoint: reflectPointAcrossX({ candidate: closure.nodePoint, centerX: input.centerX }),
      point: reflectPointAcrossX({ candidate: closure.point, centerX: input.centerX }),
    })),
    metadata: input.metadata,
  };
}

function swapRoofBuildResultAxes(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  return {
    roofPlanes: input.roofPlanes.map((roofPlane) => {
      const boundary = roofPlane.boundary.map(swapPointAxes);
      return {
        ...roofPlane,
        boundary,
        plane: planeFromBoundary(boundary) ?? roofPlane.plane,
        fallVector: swapVectorAxes(roofPlane.fallVector),
        metadata:
          roofPlane.metadata
            ? {
                ...roofPlane.metadata,
                ridgeAxis: 'y',
              }
            : roofPlane.metadata,
      };
    }),
    roofFeatures: input.roofFeatures.map((feature) => {
      const metadata =
        feature.metadata && typeof feature.metadata.ridgeAxis === 'string'
          ? {
              ...feature.metadata,
              ridgeAxis: 'y',
            }
          : feature.metadata;
      return {
        ...feature,
        line: {
          start: swapPointAxes(feature.line.start),
          end: swapPointAxes(feature.line.end),
        },
        ...(metadata ? { metadata } : {}),
      };
    }),
    terminalEnds: input.terminalEnds.map((terminalEnd) => ({
      ...terminalEnd,
      id: terminalEnd.id.replace('house-gable-end-x-', 'house-gable-end-y-'),
    })),
    terminalClosures: input.terminalClosures?.map((closure) => ({
      ...closure,
      nodePoint: swapPointAxes(closure.nodePoint),
      point: swapPointAxes(closure.point),
      axis: closure.axis === 'x' ? 'y' : 'x',
    })),
    metadata: input.metadata ? { ...input.metadata, ridgeAxis: 'y' } : undefined,
  };
}

function bridgeSideScore(input: {
  roofFeatures: HouseRoofFeature3D[];
  direction: { x: number; y: number };
}): number | null {
  const horizontalRidges = input.roofFeatures.filter(
    (feature) =>
      feature.kind === 'ridge' &&
      Math.abs(feature.line.start.y - feature.line.end.y) <= 1e-6 &&
      Math.abs(feature.line.start.x - feature.line.end.x) > 1e-6,
  );
  if (!horizontalRidges.length) return null;
  return Math.max(
    ...horizontalRidges.map((feature) => {
      const midpoint = midpoint2(feature.line);
      return midpoint.x * input.direction.x + midpoint.y * input.direction.y;
    }),
  );
}

export function deriveHouseGableTerminalEndsFromFootprint(input: {
  footprint: Polygon3;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseGableTerminalEnd[] {
  if (input.ridgeAxis === 'x') {
    return buildBentSpineGableTerminalEndsX({ footprint: input.footprint });
  }
  return buildBentSpineGableTerminalEndsX({
    footprint: input.footprint.map(swapPointAxes),
  }).map((terminalEnd) => ({
    ...terminalEnd,
    id: terminalEnd.id.replace('house-gable-end-x-', 'house-gable-end-y-'),
  }));
}

function buildJoinedRectilinearGableRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  terminalEnds?: HouseGableTerminalEnd[];
  terminalClosures?: BentSpineTerminalGableClosure[];
  metadata?: GeometryMetadata;
} {
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return { roofPlanes: [], roofFeatures: [], terminalEnds: [], terminalClosures: [] };
  }
  if (input.ridgeAxis === 'x') {
    const bentSpine = buildBentSpineJoinedGableRoofX({
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
    });
    if (
      bentSpine.roofPlanes.length > 0 &&
      roofFeaturesAreAxisAligned(bentSpine.roofFeatures.filter((feature) => feature.kind === 'ridge'))
    ) {
      return bentSpine;
    }
    return buildLegacyJoinedRectilinearGableRoof(input);
  }
  const swappedEavePolygon = input.eavePolygon.map(swapPointAxes);
  const baseBentSpine = swapRoofBuildResultAxes(
    buildBentSpineJoinedGableRoofX({
      eavePolygon: swappedEavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
    }),
  );
  const openSide = deriveHouseFootprintOpenSide(input.sourceFootprint);
  let bentSpine = baseBentSpine;
  if (openSide && Math.abs(openSide.direction.y) > Math.abs(openSide.direction.x)) {
    const box = boundingBox(swappedEavePolygon);
    const reflectedBentSpine = swapRoofBuildResultAxes(
      reflectRoofBuildResultAcrossX({
        ...buildBentSpineJoinedGableRoofX({
          eavePolygon: swappedEavePolygon.map((candidate) =>
            reflectPointAcrossX({ candidate, centerX: (box.minX + box.maxX) / 2 }),
          ),
          eaveHeightMm: input.eaveHeightMm,
          roofPitchDeg: input.roofPitchDeg,
        }),
        centerX: (box.minX + box.maxX) / 2,
      }),
    );
    const baseScore = bridgeSideScore({
      roofFeatures: baseBentSpine.roofFeatures,
      direction: openSide.direction,
    });
    const reflectedScore = bridgeSideScore({
      roofFeatures: reflectedBentSpine.roofFeatures,
      direction: openSide.direction,
    });
    if (
      reflectedScore != null &&
      (baseScore == null || reflectedScore > baseScore + 1e-6)
    ) {
      bentSpine = reflectedBentSpine;
    }
  }
  if (
    bentSpine.roofPlanes.length > 0 &&
    roofFeaturesAreAxisAligned(bentSpine.roofFeatures.filter((feature) => feature.kind === 'ridge'))
  ) {
    return bentSpine;
  }
  return buildLegacyJoinedRectilinearGableRoof(input);
}

function buildComplexRidgeLine(input: {
  eavePolygon: Polygon3;
  node: Point3;
  axis: 'x' | 'y';
  z: number;
  insetMm: number;
}): Line3 | null {
  const interval = polygonLineInterval({
    polygon: input.eavePolygon,
    axis: input.axis,
    coordinate: input.axis === 'x' ? input.node.y : input.node.x,
    through: input.axis === 'x' ? input.node.x : input.node.y,
  });
  if (!interval) return null;
  const inset = Math.min(Math.max(50, input.insetMm / 2), Math.max(0, (interval.max - interval.min) / 3));
  const start = interval.min + inset;
  const end = interval.max - inset;
  if (end - start <= RIDGE_COLLAPSE_EPSILON_MM) return null;
  return input.axis === 'x'
    ? line(point(start, input.node.y, input.z), point(end, input.node.y, input.z))
    : line(point(input.node.x, start, input.z), point(input.node.x, end, input.z));
}

function buildComplexFootprintRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] } {
  const box = boundingBox(input.eavePolygon);
  const axis: 'x' | 'y' = box.maxX - box.minX >= box.maxY - box.minY ? 'x' : 'y';
  const roofNode = findInteriorRoofNode(input.eavePolygon);
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const highZ = input.eaveHeightMm + Math.max(1, roofNode.clearanceMm) * pitchRisePerRun;
  const node = point(roofNode.point.x, roofNode.point.y, highZ);
  const ridgeLine = buildComplexRidgeLine({
    eavePolygon: input.eavePolygon,
    node,
    axis,
    z: highZ,
    insetMm: roofNode.clearanceMm,
  });
  const highTargetForEdge = (edgeMidpoint: Point3) =>
    ridgeLine ? closestPointOnLineSegment2D(edgeMidpoint, ridgeLine) : node;
  const roofPlanes: RoofPlane3D[] = [];

  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const start = input.eavePolygon[index]!;
    const end = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const eaveStart = point(start.x, start.y, input.eaveHeightMm);
    const eaveEnd = point(end.x, end.y, input.eaveHeightMm);
    const edgeMid = point((start.x + end.x) / 2, (start.y + end.y) / 2, input.eaveHeightMm);
    const highPoint = highTargetForEdge(edgeMid);
    if (lineLength(line(eaveStart, eaveEnd)) <= 1e-6 || lineLength(line(edgeMid, highPoint)) <= 1e-6) continue;
    roofPlanes.push(
      buildRoofPlane({
        id: `house-roof-edge-${index + 1}`,
        boundary: [eaveStart, eaveEnd, highPoint],
        highPoint,
        lowPoint: edgeMid,
        ridgeAxis: axis,
        pitchDeg: input.roofPitchDeg,
        metadata: {
          sourceEdgeId: `footprint-edge-${index + 1}`,
          footprintFollowing: true,
        },
      }),
    );
  }

  const roofFeatures: HouseRoofFeature3D[] = [];
  if (ridgeLine) {
    roofFeatures.push({
      id: 'house-roof-ridge-1',
      kind: 'ridge',
      line: ridgeLine,
      metadata: { roofForm: 'hipped', footprintFollowing: true },
    });
  }

  let hipCount = 0;
  let valleyCount = 0;
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    const source = input.eavePolygon[index]!;
    const start = point(source.x, source.y, input.eaveHeightMm);
    const target = ridgeLine ? closestPointOnLineSegment2D(start, ridgeLine) : node;
    if (lineLength(line(start, target)) <= 1e-6) continue;
    const kind = vertexFeatureKind(input.eavePolygon, index);
    if (kind === 'hip') hipCount += 1;
    if (kind === 'valley') valleyCount += 1;
    roofFeatures.push({
      id: kind === 'hip' ? `house-roof-hip-${hipCount}` : `house-roof-valley-${valleyCount}`,
      kind,
      line: line(start, target),
      metadata: { roofForm: 'hipped', footprintFollowing: true },
    });
  }

  return { roofPlanes, roofFeatures };
}

function invalidHouseRoof(input: {
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  roofGeometry: string;
  reason: string;
  metadata?: GeometryMetadata;
}): HouseRoofBuildResult {
  return applyRoofQa({
    roof: {
      roofPlanes: [],
      roofFeatures: [],
      metadata: {
        roofForm: input.roofForm,
        roofGeometry: input.roofGeometry,
        roofTopologyFailureReason: input.reason,
        ...(input.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildFlatHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): HouseRoofBuildResult {
  return applyRoofQa({
    roof: {
      roofPlanes: [
        {
          id: 'house-roof-flat-1',
          boundary: input.eavePolygon.map((candidate) =>
            point(candidate.x, candidate.y, input.eaveHeightMm),
          ),
          plane: planeFromPoints(
            point(input.eavePolygon[0]!.x, input.eavePolygon[0]!.y, input.eaveHeightMm),
            point(input.eavePolygon[1]!.x, input.eavePolygon[1]!.y, input.eaveHeightMm),
            point(input.eavePolygon[2]!.x, input.eavePolygon[2]!.y, input.eaveHeightMm),
          ),
          fallVector: { x: 0, y: 1, z: 0 },
          metadata: {
            roofForm: 'flat',
            roofGeometry: 'footprint_flat',
          },
        },
      ],
      roofFeatures: [],
      metadata: {
        roofForm: 'flat',
        roofGeometry: 'footprint_flat',
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildMonoHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  fallDirection: HouseRoofPrimaryFallDirection;
}): HouseRoofBuildResult {
  const axis =
    input.fallDirection === 'positive_x' || input.fallDirection === 'negative_x' ? 'x' : 'y';
  const range = axisRange(input.eavePolygon, axis);
  const risePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const boundary = input.eavePolygon.map((candidate) => {
    const coordinate = axis === 'x' ? candidate.x : candidate.y;
    const run =
      input.fallDirection === 'positive_x' || input.fallDirection === 'positive_y'
        ? range.max - coordinate
        : coordinate - range.min;
    return point(candidate.x, candidate.y, input.eaveHeightMm + Math.max(0, run) * risePerRun);
  });
  const plane = planeFromPoints(boundary[0]!, boundary[1]!, boundary[2]!);

  return applyRoofQa({
    roof: {
      roofPlanes: [
        {
          id: 'house-roof-mono-1',
          boundary,
          plane,
          fallVector:
            input.fallDirection === 'positive_x'
              ? { x: 1, y: 0, z: -risePerRun }
              : input.fallDirection === 'negative_x'
                ? { x: -1, y: 0, z: -risePerRun }
                : input.fallDirection === 'negative_y'
                  ? { x: 0, y: -1, z: -risePerRun }
                  : { x: 0, y: 1, z: -risePerRun },
          metadata: {
            roofForm: 'mono',
            roofGeometry: 'footprint_mono',
            roofPrimaryFallDirection: input.fallDirection,
            pitchDeg: input.roofPitchDeg,
          },
        },
      ],
      roofFeatures: [],
      metadata: {
        roofForm: 'mono',
        roofGeometry: 'footprint_mono',
        roofPrimaryFallDirection: input.fallDirection,
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildRectangularGableRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  if (!isRectanglePolygon(input.eavePolygon)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'rectangular_gable',
      reason: 'unsupported_gable_topology',
    });
  }

  const box = boundingBox(input.eavePolygon);
  const risePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const corners = rectangleCornersFromBox(box);
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;
  const roofPlanes: RoofPlane3D[] = [];
  let ridge: Line3;

  if (input.ridgeAxis === 'x') {
    const run = (box.maxY - box.minY) / 2;
    const ridgeZ = input.eaveHeightMm + run * risePerRun;
    const ridgeStart = point(box.minX, centerY, ridgeZ);
    const ridgeEnd = point(box.maxX, centerY, ridgeZ);
    ridge = line(ridgeStart, ridgeEnd);
    roofPlanes.push(
      buildRoofPlane({
        id: 'house-roof-gable-min-y',
        boundary: [
          point(corners.minXMinY.x, corners.minXMinY.y, input.eaveHeightMm),
          point(corners.maxXMinY.x, corners.maxXMinY.y, input.eaveHeightMm),
          ridgeEnd,
          ridgeStart,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(centerX, box.minY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
      buildRoofPlane({
        id: 'house-roof-gable-max-y',
        boundary: [
          point(corners.maxXMaxY.x, corners.maxXMaxY.y, input.eaveHeightMm),
          point(corners.minXMaxY.x, corners.minXMaxY.y, input.eaveHeightMm),
          ridgeStart,
          ridgeEnd,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(centerX, box.maxY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
    );
  } else {
    const run = (box.maxX - box.minX) / 2;
    const ridgeZ = input.eaveHeightMm + run * risePerRun;
    const ridgeStart = point(centerX, box.minY, ridgeZ);
    const ridgeEnd = point(centerX, box.maxY, ridgeZ);
    ridge = line(ridgeStart, ridgeEnd);
    roofPlanes.push(
      buildRoofPlane({
        id: 'house-roof-gable-min-x',
        boundary: [
          point(corners.minXMaxY.x, corners.minXMaxY.y, input.eaveHeightMm),
          point(corners.minXMinY.x, corners.minXMinY.y, input.eaveHeightMm),
          ridgeStart,
          ridgeEnd,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(box.minX, centerY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
      buildRoofPlane({
        id: 'house-roof-gable-max-x',
        boundary: [
          point(corners.maxXMinY.x, corners.maxXMinY.y, input.eaveHeightMm),
          point(corners.maxXMaxY.x, corners.maxXMaxY.y, input.eaveHeightMm),
          ridgeEnd,
          ridgeStart,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(box.maxX, centerY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
    );
  }

  return applyRoofQa({
    roof: {
      roofPlanes,
      roofFeatures: [
        {
          id: 'house-roof-ridge-1',
          kind: 'ridge',
          line: ridge,
          metadata: {
            roofForm: 'gable',
            roofGeometry: 'rectangular_gable',
            ridgeAxis: input.ridgeAxis,
          },
        },
      ],
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'rectangular_gable',
        ridgeAxis: input.ridgeAxis,
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

function buildGabledHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'bent_spine_joined_gable',
      reason: 'unsupported_gable_topology',
      metadata: { footprintFollowing: false, ridgeAxis: input.ridgeAxis },
    });
  }

  if (isRectanglePolygon(input.eavePolygon)) {
    return buildRectangularGableRoof({
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
      ridgeAxis: input.ridgeAxis,
    });
  }

  const roof = buildJoinedRectilinearGableRoof(input);
  if (!roof.roofPlanes.length) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'bent_spine_joined_gable',
      reason: 'unsupported_gable_topology',
      metadata: { ...(roof.metadata ?? {}), footprintFollowing: true, ridgeAxis: input.ridgeAxis },
    });
  }

  const bentSpineResult = applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      terminalClosures: roof.terminalClosures,
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'bent_spine_joined_gable',
        footprintFollowing: true,
        ridgeAxis: input.ridgeAxis,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount:
      typeof roof.metadata?.roofRejectedFacetCount === 'number'
        ? roof.metadata.roofRejectedFacetCount
        : 0,
  });
  if (bentSpineResult.metadata.roofQaStatus === 'valid') {
    return bentSpineResult;
  }

  const legacyRoof = buildLegacyJoinedRectilinearGableRoof(input);
  if (!legacyRoof.roofPlanes.length) {
    return bentSpineResult;
  }
  return applyRoofQa({
    roof: {
      roofPlanes: legacyRoof.roofPlanes,
      roofFeatures: legacyRoof.roofFeatures,
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'rectilinear_joined_gable',
        footprintFollowing: true,
        ridgeAxis: input.ridgeAxis,
        ...(legacyRoof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount:
      typeof legacyRoof.metadata?.roofRejectedFacetCount === 'number'
        ? legacyRoof.metadata.roofRejectedFacetCount
        : 0,
  });
}

function buildHippedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
}): HouseRoofBuildResult {
  const box = boundingBox(input.eavePolygon);
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'hipped',
      roofGeometry: 'rectilinear_joined_hipped',
      reason: 'unsupported_hipped_topology',
      metadata: { footprintFollowing: false },
    });
  }
  if (isRectanglePolygon(input.eavePolygon)) {
    return applyRoofQa({
      roof: {
        ...buildRectangleHippedRoof({ ...box, eaveHeightMm: input.eaveHeightMm, roofPitchDeg: input.roofPitchDeg }),
        metadata: { roofForm: 'hipped', roofGeometry: 'rectangular_hipped', footprintFollowing: true },
      },
      eavePolygon: input.eavePolygon,
    });
  }

  const roof = buildJoinedRectilinearHippedRoof(input);
  if (!roof.roofPlanes.length) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'hipped',
      roofGeometry: 'rectilinear_joined_hipped',
      reason: 'unsupported_hipped_topology',
      metadata: { ...(roof.metadata ?? {}), footprintFollowing: true },
    });
  }

  return applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      metadata: {
        roofForm: 'hipped',
        roofGeometry: 'rectilinear_joined_hipped',
        footprintFollowing: true,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount: typeof roof.metadata?.roofRejectedFacetCount === 'number' ? roof.metadata.roofRejectedFacetCount : 0,
  });
}

function buildPrimaryHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  return input.roofForm === 'flat'
    ? buildFlatHouseRoof({
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      })
    : input.roofForm === 'mono'
      ? buildMonoHouseRoof({
          eavePolygon: input.eavePolygon,
          eaveHeightMm: input.eaveHeightMm,
          roofPitchDeg: input.roofPitchDeg,
          fallDirection: input.roofPrimaryFallDirection,
        })
      : input.roofForm === 'gable'
        ? buildGabledHouseRoof({
            sourceFootprint: input.sourceFootprint,
            eavePolygon: input.eavePolygon,
            eaveHeightMm: input.eaveHeightMm,
            roofPitchDeg: input.roofPitchDeg,
            ridgeAxis: input.roofRidgeAxis,
          })
        : buildHippedHouseRoof({
            sourceFootprint: input.sourceFootprint,
            eavePolygon: input.eavePolygon,
            eaveHeightMm: input.eaveHeightMm,
            roofPitchDeg: input.roofPitchDeg,
          });
}

function buildHouseRoofAppendageBand(input: {
  hostRun: HouseRoofAppendageHostRun;
  form: HouseRoofAppendageForm;
  pitchDeg: number;
  attachZ: number;
}): RoofPlane3D[] {
  const bandDepthMm = 1200;
  const risePerRun = Math.tan((input.pitchDeg * Math.PI) / 180);
  const outerZ = input.form === 'flat' ? input.attachZ : input.attachZ - bandDepthMm * risePerRun;
  const outward =
    input.hostRun.hostEdge === 'front'
      ? { x: 0, y: 1, z: 0 }
      : input.hostRun.hostEdge === 'left'
        ? { x: -1, y: 0, z: 0 }
        : input.hostRun.hostEdge === 'right'
          ? { x: 1, y: 0, z: 0 }
          : { x: 0, y: -1, z: 0 };
  const start = point(input.hostRun.start.x, input.hostRun.start.y, input.attachZ);
  const end = point(input.hostRun.end.x, input.hostRun.end.y, input.attachZ);
  const outerStart = point(
    start.x + outward.x * bandDepthMm,
    start.y + outward.y * bandDepthMm,
    outerZ,
  );
  const outerEnd = point(
    end.x + outward.x * bandDepthMm,
    end.y + outward.y * bandDepthMm,
    outerZ,
  );

  switch (input.hostRun.hostEdge) {
    case 'front':
      return [
        {
          id: 'house-roof-appendage-front',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: 0, y: 1, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'front' },
        },
      ];
    case 'left':
      return [
        {
          id: 'house-roof-appendage-left',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: -1, y: 0, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'left' },
        },
      ];
    case 'right':
      return [
        {
          id: 'house-roof-appendage-right',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: 1, y: 0, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'right' },
        },
      ];
    case 'rear':
    default:
      return [
        {
          id: 'house-roof-appendage-rear',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: 0, y: -1, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'rear' },
        },
      ];
  }
}

function deriveHouseRoofAppendageSupportFromPrimaryRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofForm: HouseRoofForm;
  primaryRoof: HouseRoofBuildResult;
  attachmentSourceEdgeId?: string | null;
}): HouseRoofAppendageSupportAnalysis {
  if (input.primaryRoof.metadata.roofQaStatus !== 'valid' || !isOrthogonalFootprint(input.sourceFootprint)) {
    return {
      supportedHostEdges: [],
      hostRunsBySide: {},
      blockedReasonsBySide: {
        rear: 'The rear edge does not expose one continuous exterior eave-like appendage run on this roof.',
        front: 'The front edge does not expose one continuous exterior eave-like appendage run on this roof.',
        left: 'The left edge does not expose one continuous exterior eave-like appendage run on this roof.',
        right: 'The right edge does not expose one continuous exterior eave-like appendage run on this roof.',
      },
    };
  }

  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    roofForm: input.roofForm,
    roofPlanes: input.primaryRoof.roofPlanes,
    eaveHeightMm: input.eaveHeightMm,
    joinSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
  return buildAppendageSupportAnalysisFromPerimeterEdges({
    perimeterEdges,
  });
}

export function deriveHouseRoofAppendageSupportFromFootprint(input: {
  sourceFootprint: Polygon3;
  eaveHeightMm: number;
  eaveOverhangMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  attachmentSourceEdgeId?: string | null;
}): HouseRoofAppendageSupportAnalysis {
  const wallBox = boundingBox(input.sourceFootprint);
  const baseEavePolygon =
    offsetFootprintPolygon(input.sourceFootprint, input.eaveOverhangMm) ?? [
      point(wallBox.minX - input.eaveOverhangMm, wallBox.minY - input.eaveOverhangMm, 0),
      point(wallBox.maxX + input.eaveOverhangMm, wallBox.minY - input.eaveOverhangMm, 0),
      point(wallBox.maxX + input.eaveOverhangMm, wallBox.maxY + input.eaveOverhangMm, 0),
      point(wallBox.minX - input.eaveOverhangMm, wallBox.maxY + input.eaveOverhangMm, 0),
    ];
  const eavePolygon = buildAttachmentAwareMonoEavePolygon({
    footprint: input.sourceFootprint,
    eavePolygon: baseEavePolygon,
    roofForm: input.roofForm,
    attachmentSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
  const primaryRoof = buildPrimaryHouseRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofPitchDeg: input.roofPitchDeg,
    roofForm: input.roofForm,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofRidgeAxis: input.roofRidgeAxis,
  });
  return deriveHouseRoofAppendageSupportFromPrimaryRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: input.roofForm,
    primaryRoof,
    attachmentSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
}

function buildSharedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  roofAppendage?: {
    enabled?: boolean | null;
    form?: HouseRoofAppendageForm | null;
    hostEdge?: AttachmentSide | null;
    pitchDeg?: number | null;
    dropMm?: number | null;
  } | null;
  attachmentSourceEdgeId?: string | null;
}): HouseRoofBuildResult {
  const roofSelectionValidation = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.sourceFootprint,
    appendageEnabled: false,
  });
  if (
    roofSelectionValidation.code === 'unsupported_roof_topology' ||
    roofSelectionValidation.code === 'unsupported_gable_topology' ||
    roofSelectionValidation.code === 'unsupported_hipped_topology' ||
    roofSelectionValidation.code === 'invalid_mono_fall_direction' ||
    roofSelectionValidation.code === 'invalid_ridge_axis'
  ) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: input.roofForm,
      roofGeometry: input.roofForm === 'gable' ? 'bent_spine_joined_gable' : 'rectilinear_joined_hipped',
      reason: roofSelectionValidation.code,
    });
  }

  const primary = buildPrimaryHouseRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofPitchDeg: input.roofPitchDeg,
    roofForm: input.roofForm,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofRidgeAxis: input.roofRidgeAxis,
  });

  if (!input.roofAppendage?.enabled || primary.metadata.roofQaStatus !== 'valid') {
    return primary;
  }
  const appendageSupport = deriveHouseRoofAppendageSupportFromPrimaryRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: input.roofForm,
    primaryRoof: primary,
    attachmentSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
  const appendageValidation = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.sourceFootprint,
    appendageEnabled: Boolean(input.roofAppendage?.enabled),
    appendageHostEdge: input.roofAppendage?.hostEdge ?? 'rear',
    appendageSupport,
  });
  if (
    appendageValidation.code === 'invalid_appendage_topology' ||
    appendageValidation.code === 'invalid_appendage_host_edge'
  ) {
    return {
      ...primary,
      metadata: {
        ...primary.metadata,
        roofQaStatus: 'invalid',
        roofQaFailureReason: appendageValidation.code,
        roofTopologyFailureReason: appendageValidation.code,
      },
    };
  }

  const roofAppendage = input.roofAppendage ?? null;
  const hostRun = appendageSupport.hostRunsBySide[roofAppendage?.hostEdge ?? 'rear'];
  if (!hostRun) {
    return {
      ...primary,
      metadata: {
        ...primary.metadata,
        roofQaStatus: 'invalid',
        roofQaFailureReason: 'invalid_appendage_host_edge',
        roofTopologyFailureReason: 'invalid_appendage_host_edge',
      },
    };
  }
  const appendagePlanes = buildHouseRoofAppendageBand({
    hostRun,
    form: roofAppendage?.form ?? 'mono',
    pitchDeg: finiteNumber(roofAppendage?.pitchDeg, input.roofPitchDeg),
    attachZ: input.eaveHeightMm - positiveNumber(roofAppendage?.dropMm, 450),
  }).map((plane) => ({
    ...plane,
    metadata: {
      ...plane.metadata,
      roofForm: input.roofForm,
      roofAppendageEnabled: true,
      roofAppendageForm: roofAppendage?.form ?? 'mono',
    },
  }));

  return {
    roofPlanes: [...primary.roofPlanes, ...appendagePlanes],
    roofFeatures: primary.roofFeatures,
    metadata: {
      ...primary.metadata,
      roofAppendageEnabled: true,
      roofAppendageForm: roofAppendage?.form ?? 'mono',
      roofAppendageHostEdge: roofAppendage?.hostEdge ?? 'rear',
    },
  };
}

function planeFromBoundary(boundary: Polygon3): Plane3 | null {
  if (boundary.length < 3) return null;
  for (let secondIndex = 1; secondIndex < boundary.length - 1; secondIndex += 1) {
    const plane = planeFromPoints(boundary[0]!, boundary[secondIndex]!, boundary[secondIndex + 1]!);
    if (
      Number.isFinite(plane.normal.x) &&
      Number.isFinite(plane.normal.y) &&
      Number.isFinite(plane.normal.z) &&
      Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z) > 1e-6
    ) {
      return plane;
    }
  }
  return null;
}

function renderMeshIsFinite(mesh: RenderMesh3D): boolean {
  return (
    mesh.vertices.length >= 6 &&
    mesh.faces.length > 0 &&
    mesh.vertices.every((candidate) =>
      Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z),
    ) &&
    mesh.faces.every((face) =>
      face.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length),
    )
  );
}

function buildVerticalPrismRenderMesh(planFootprint: Polygon3, bottomZ: number, topZ: number): RenderMesh3D | undefined {
  if (planFootprint.length < 3 || !Number.isFinite(bottomZ) || !Number.isFinite(topZ)) return undefined;
  if (Math.abs(topZ - bottomZ) <= 1e-6 || Math.abs(signedAreaXY(planFootprint)) <= 1e-6) return undefined;

  const bottom = Math.min(bottomZ, topZ);
  const top = Math.max(bottomZ, topZ);
  const vertices = [
    ...planFootprint.map((candidate) => point(candidate.x, candidate.y, bottom)),
    ...planFootprint.map((candidate) => point(candidate.x, candidate.y, top)),
  ];
  const vertexCount = planFootprint.length;
  const faces: [number, number, number][] = [];

  for (let index = 1; index < vertexCount - 1; index += 1) {
    faces.push([0, index + 1, index]);
    faces.push([vertexCount, vertexCount + index, vertexCount + index + 1]);
  }

  for (let index = 0; index < vertexCount; index += 1) {
    const nextIndex = (index + 1) % vertexCount;
    faces.push([index, nextIndex, vertexCount + nextIndex]);
    faces.push([index, vertexCount + nextIndex, vertexCount + index]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

function boundaryZRange(boundary: Polygon3): { bottomZ: number; topZ: number } | null {
  if (!boundary.length) return null;
  const zValues = boundary.map((candidate) => candidate.z);
  const bottomZ = Math.min(...zValues);
  const topZ = Math.max(...zValues);
  return Number.isFinite(bottomZ) && Number.isFinite(topZ) && topZ - bottomZ > 1e-6
    ? { bottomZ, topZ }
    : null;
}

function buildMiteredStripFootprints(sourcePolygon: Polygon3, halfWidthMm: number): Polygon3[] | null {
  if (!Number.isFinite(halfWidthMm) || halfWidthMm <= 0) return null;
  return buildMiteredOffsetStripFootprints(sourcePolygon, halfWidthMm, -halfWidthMm);
}

function buildMiteredOffsetStripFootprints(
  sourcePolygon: Polygon3,
  outerOffsetMm: number,
  innerOffsetMm: number,
): Polygon3[] | null {
  if (
    sourcePolygon.length < 3 ||
    !Number.isFinite(outerOffsetMm) ||
    !Number.isFinite(innerOffsetMm) ||
    Math.abs(outerOffsetMm - innerOffsetMm) <= 1e-6 ||
    Math.abs(signedAreaXY(sourcePolygon)) <= 1e-6
  ) {
    return null;
  }
  if (
    sourcePolygon.some(
      (current, index) => lineLength(line(current, sourcePolygon[(index + 1) % sourcePolygon.length]!)) <= 1e-6,
    )
  ) {
    return null;
  }

  const outerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x + outward.x * outerOffsetMm, start.y + outward.y * outerOffsetMm, 0),
      end: point(end.x + outward.x * outerOffsetMm, end.y + outward.y * outerOffsetMm, 0),
    };
  });
  const innerEdges = sourcePolygon.map((start, index) => {
    const end = sourcePolygon[(index + 1) % sourcePolygon.length]!;
    const outward = edgeOutwardVector(sourcePolygon, index);
    return {
      start: point(start.x + outward.x * innerOffsetMm, start.y + outward.y * innerOffsetMm, 0),
      end: point(end.x + outward.x * innerOffsetMm, end.y + outward.y * innerOffsetMm, 0),
    };
  });

  const footprints: Polygon3[] = [];
  for (let index = 0; index < sourcePolygon.length; index += 1) {
    const previousIndex = (index - 1 + sourcePolygon.length) % sourcePolygon.length;
    const nextIndex = (index + 1) % sourcePolygon.length;
    const previousOuter = outerEdges[previousIndex]!;
    const currentOuter = outerEdges[index]!;
    const nextOuter = outerEdges[nextIndex]!;
    const previousInner = innerEdges[previousIndex]!;
    const currentInner = innerEdges[index]!;
    const nextInner = innerEdges[nextIndex]!;

    const outerStart = miterCornerPoint(previousOuter, currentOuter);
    const outerEnd = miterCornerPoint(currentOuter, nextOuter);
    const innerEnd = miterCornerPoint(currentInner, nextInner);
    const innerStart = miterCornerPoint(previousInner, currentInner);

    if (!outerStart || !outerEnd || !innerEnd || !innerStart) return null;
    const footprint = [
      outerStart,
      outerEnd,
      innerEnd,
      innerStart,
    ];
    if (Math.abs(signedAreaXY(footprint)) <= 1e-6) return null;
    footprints.push(footprint);
  }

  return footprints;
}


type RoofSolidLine = {
  point: Point3;
  direction: Vector3;
};

type RoofSolidEdgeReference = {
  roofPlaneIndex: number;
  edgeIndex: number;
  start: Point3;
  end: Point3;
};

type RoofSolidAdjacency = {
  edgeMap: Map<string, RoofSolidEdgeReference[]>;
  invalidRoofPlaneIndexes: Set<number>;
};

type RoofSolidBottomEdge = {
  line: RoofSolidLine;
  perimeter: boolean;
  perimeterRole?: HouseRoofPerimeterEdgeKind | null;
};

type ProjectedRoofMeshPoint = {
  index: number;
  projected: { x: number; y: number };
};

function roofSolidPointKey(candidate: Point3): string {
  return [
    Math.round(candidate.x / ROOF_JOIN_EPSILON_MM),
    Math.round(candidate.y / ROOF_JOIN_EPSILON_MM),
    Math.round(candidate.z / ROOF_JOIN_EPSILON_MM),
  ].join(',');
}

function roofSolidEdgeKey(start: Point3, end: Point3): string {
  const startKey = roofSolidPointKey(start);
  const endKey = roofSolidPointKey(end);
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function buildRoofSolidAdjacency(roofPlanes: RoofPlane3D[]): RoofSolidAdjacency {
  const edgeMap = new Map<string, RoofSolidEdgeReference[]>();
  const invalidRoofPlaneIndexes = new Set<number>();

  for (const [roofPlaneIndex, roofPlane] of roofPlanes.entries()) {
    if (roofPlane.boundary.length < 3) {
      invalidRoofPlaneIndexes.add(roofPlaneIndex);
      continue;
    }
    for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
      const start = roofPlane.boundary[edgeIndex]!;
      const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
      if (lineLength(line(start, end)) <= ROOF_JOIN_EPSILON_MM) {
        invalidRoofPlaneIndexes.add(roofPlaneIndex);
        continue;
      }
      const key = roofSolidEdgeKey(start, end);
      const references = edgeMap.get(key) ?? [];
      references.push({ roofPlaneIndex, edgeIndex, start, end });
      edgeMap.set(key, references);
    }
  }

  for (const references of edgeMap.values()) {
    const uniqueRoofPlaneIndexes = new Set(references.map((reference) => reference.roofPlaneIndex));
    if (references.length > 2 || uniqueRoofPlaneIndexes.size !== references.length) {
      for (const reference of references) {
        invalidRoofPlaneIndexes.add(reference.roofPlaneIndex);
      }
    }
  }

  return { edgeMap, invalidRoofPlaneIndexes };
}

function intersectRoofSolidPlanes(
  first: RoofSolidPlaneEquation,
  second: RoofSolidPlaneEquation,
): RoofSolidLine | null {
  const direction = crossProduct(first.normal, second.normal);
  const directionLengthSq = dotProduct(direction, direction);
  if (directionLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return null;

  const scaledSecondNormal = scaleVector(second.normal, first.constant);
  const scaledFirstNormal = scaleVector(first.normal, second.constant);
  const pointOnLine = scaleVector(
    crossProduct(
      {
        x: scaledSecondNormal.x - scaledFirstNormal.x,
        y: scaledSecondNormal.y - scaledFirstNormal.y,
        z: scaledSecondNormal.z - scaledFirstNormal.z,
      },
      direction,
    ),
    1 / directionLengthSq,
  );

  return {
    point: point(pointOnLine.x, pointOnLine.y, pointOnLine.z),
    direction: normalizeVector(direction),
  };
}

function roofSolidVerticalCutPlane(start: Point3, end: Point3): RoofSolidPlaneEquation | null {
  const edgeDirection = normalizeVector(subtractPoints(end, start));
  if (finiteVectorLength(edgeDirection) <= ROOF_JOIN_EPSILON_MM) return null;
  const normal = normalizeVector(crossProduct(edgeDirection, WORLD_Z));
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return {
    normal,
    constant: dotProduct(normal, start),
  };
}

function buildRoofSolidBottomEdge(input: {
  edgeReference: RoofSolidEdgeReference;
  edgeReferences: RoofSolidEdgeReference[];
  bottomPlanes: Array<RoofSolidPlaneEquation | null>;
  perimeterRole?: HouseRoofPerimeterEdgeKind | null;
}): RoofSolidBottomEdge | null {
  const currentBottomPlane = input.bottomPlanes[input.edgeReference.roofPlaneIndex];
  if (!currentBottomPlane) return null;

  if (input.edgeReferences.length === 2) {
    const adjacentReference = input.edgeReferences.find(
      (reference) => reference.roofPlaneIndex !== input.edgeReference.roofPlaneIndex,
    );
    const adjacentBottomPlane = typeof adjacentReference?.roofPlaneIndex === 'number'
      ? input.bottomPlanes[adjacentReference.roofPlaneIndex]
      : null;
    if (!adjacentBottomPlane) return null;
    const miterLine = intersectRoofSolidPlanes(currentBottomPlane, adjacentBottomPlane);
    if (miterLine) return { line: miterLine, perimeter: false };
  }

  if (input.edgeReferences.length > 2) return null;
  const cutPlane = roofSolidVerticalCutPlane(input.edgeReference.start, input.edgeReference.end);
  const cutLine = cutPlane ? intersectRoofSolidPlanes(currentBottomPlane, cutPlane) : null;
  const closePerimeter =
    input.edgeReferences.length === 1 &&
    input.perimeterRole !== 'weather_flashed_edge' &&
    input.perimeterRole !== 'house_apron_edge';
  return cutLine
    ? {
        line: cutLine,
        perimeter: closePerimeter,
        perimeterRole: input.perimeterRole ?? null,
      }
    : null;
}

function closestPointOnRoofSolidLine(candidate: Point3, source: RoofSolidLine): Point3 {
  const directionLengthSq = dotProduct(source.direction, source.direction);
  if (directionLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return source.point;
  const ratio = dotProduct(subtractPoints(candidate, source.point), source.direction) / directionLengthSq;
  return translatePointByVector(source.point, scaleVector(source.direction, ratio));
}

function intersectRoofSolidLines(
  first: RoofSolidLine,
  second: RoofSolidLine,
  fallbackNear: Point3,
): Point3 | null {
  const firstDirection = normalizeVector(first.direction);
  const secondDirection = normalizeVector(second.direction);
  const directionCross = crossProduct(firstDirection, secondDirection);
  const directionCrossLengthSq = dotProduct(directionCross, directionCross);
  const betweenOrigins = subtractPoints(first.point, second.point);

  if (directionCrossLengthSq <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
    const separation = finiteVectorLength(crossProduct(subtractPoints(second.point, first.point), firstDirection));
    return separation <= 1e-2 ? closestPointOnRoofSolidLine(fallbackNear, first) : null;
  }

  const firstLengthSq = dotProduct(firstDirection, firstDirection);
  const secondLengthSq = dotProduct(secondDirection, secondDirection);
  const directionDot = dotProduct(firstDirection, secondDirection);
  const firstOriginDot = dotProduct(firstDirection, betweenOrigins);
  const secondOriginDot = dotProduct(secondDirection, betweenOrigins);
  const denominator = firstLengthSq * secondLengthSq - directionDot * directionDot;
  if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) return null;

  const firstRatio = (directionDot * secondOriginDot - secondLengthSq * firstOriginDot) / denominator;
  const secondRatio = (firstLengthSq * secondOriginDot - directionDot * firstOriginDot) / denominator;
  const firstPoint = translatePointByVector(first.point, scaleVector(firstDirection, firstRatio));
  const secondPoint = translatePointByVector(second.point, scaleVector(secondDirection, secondRatio));
  if (lineLength(line(firstPoint, secondPoint)) > 1e-2) return null;
  return point(
    (firstPoint.x + secondPoint.x) / 2,
    (firstPoint.y + secondPoint.y) / 2,
    (firstPoint.z + secondPoint.z) / 2,
  );
}

function projectRoofMeshPoint(candidate: Point3, normal: Vector3): { x: number; y: number } {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  if (absX >= absY && absX >= absZ) return { x: candidate.y, y: candidate.z };
  if (absY >= absX && absY >= absZ) return { x: candidate.x, y: candidate.z };
  return { x: candidate.x, y: candidate.y };
}

function roofMeshProjectedPointDistanceSquared(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function signedRoofMeshProjectedArea(points: Array<{ x: number; y: number }>): number {
  return points.reduce((sum, current, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function roofMeshProjectedCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function roofMeshPointOnProjectedSegment(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  if (Math.abs(roofMeshProjectedCross(start, end, candidate)) > ROOF_JOIN_EPSILON_MM) return false;
  const dot =
    (candidate.x - start.x) * (end.x - start.x) +
    (candidate.y - start.y) * (end.y - start.y);
  if (dot < -ROOF_JOIN_EPSILON_MM) return false;
  return dot <= roofMeshProjectedPointDistanceSquared(start, end) + ROOF_JOIN_EPSILON_MM;
}

function roofMeshProjectedSegmentsIntersect(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
): boolean {
  const firstA = roofMeshProjectedCross(firstStart, firstEnd, secondStart);
  const firstB = roofMeshProjectedCross(firstStart, firstEnd, secondEnd);
  const secondA = roofMeshProjectedCross(secondStart, secondEnd, firstStart);
  const secondB = roofMeshProjectedCross(secondStart, secondEnd, firstEnd);

  if (Math.abs(firstA) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(secondStart, firstStart, firstEnd)) {
    return true;
  }
  if (Math.abs(firstB) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(secondEnd, firstStart, firstEnd)) {
    return true;
  }
  if (Math.abs(secondA) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(firstStart, secondStart, secondEnd)) {
    return true;
  }
  if (Math.abs(secondB) <= ROOF_JOIN_EPSILON_MM && roofMeshPointOnProjectedSegment(firstEnd, secondStart, secondEnd)) {
    return true;
  }

  return firstA * firstB < 0 && secondA * secondB < 0;
}

function roofMeshProjectedPolygonSelfIntersects(points: Array<{ x: number; y: number }>): boolean {
  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % points.length;
    for (let secondIndex = firstIndex + 1; secondIndex < points.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % points.length;
      if (firstIndex === secondIndex || firstNext === secondIndex || secondNext === firstIndex) continue;
      if (
        roofMeshProjectedSegmentsIntersect(
          points[firstIndex]!,
          points[firstNext]!,
          points[secondIndex]!,
          points[secondNext]!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function roofMeshPointInProjectedTriangle(
  candidate: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  return (
    roofMeshProjectedCross(a, b, candidate) >= -ROOF_JOIN_EPSILON_MM &&
    roofMeshProjectedCross(b, c, candidate) >= -ROOF_JOIN_EPSILON_MM &&
    roofMeshProjectedCross(c, a, candidate) >= -ROOF_JOIN_EPSILON_MM
  );
}

function roofMeshProjectedTriangleArea(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return Math.abs(roofMeshProjectedCross(a, b, c)) / 2;
}

function roofMeshProjectedTriangleCentroid(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

function roofMeshPointInProjectedPolygon(
  candidate: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (
    polygon.some((start, index) =>
      roofMeshPointOnProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
    )
  ) {
    return true;
  }

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

function prepareProjectedRoofMeshPolygon(points: Point3[], normal: Vector3): ProjectedRoofMeshPoint[] | null {
  const projected = points.map((candidate, index) => ({
    index,
    projected: projectRoofMeshPoint(candidate, normal),
  }));
  const cleaned: ProjectedRoofMeshPoint[] = [];

  for (const candidate of projected) {
    const previous = cleaned[cleaned.length - 1];
    if (
      !previous ||
      roofMeshProjectedPointDistanceSquared(previous.projected, candidate.projected) >
        ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
    ) {
      cleaned.push(candidate);
    }
  }

  if (
    cleaned.length > 2 &&
    roofMeshProjectedPointDistanceSquared(cleaned[0]!.projected, cleaned[cleaned.length - 1]!.projected) <=
      ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM
  ) {
    cleaned.pop();
  }

  let removedCollinear = true;
  while (removedCollinear && cleaned.length > 3) {
    removedCollinear = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]!;
      const current = cleaned[index]!;
      const next = cleaned[(index + 1) % cleaned.length]!;
      const first = {
        x: current.projected.x - previous.projected.x,
        y: current.projected.y - previous.projected.y,
      };
      const second = {
        x: next.projected.x - current.projected.x,
        y: next.projected.y - current.projected.y,
      };
      const cross = first.x * second.y - first.y * second.x;
      const dot = first.x * second.x + first.y * second.y;
      if (Math.abs(cross) <= ROOF_JOIN_EPSILON_MM && dot >= -ROOF_JOIN_EPSILON_MM) {
        cleaned.splice(index, 1);
        removedCollinear = true;
        break;
      }
    }
  }

  const uniqueProjected = new Set(
    cleaned.map((candidate) => `${candidate.projected.x.toFixed(6)},${candidate.projected.y.toFixed(6)}`),
  );
  const area = signedRoofMeshProjectedArea(cleaned.map((candidate) => candidate.projected));
  if (cleaned.length < 3 || uniqueProjected.size < 3 || Math.abs(area) <= ROOF_REGION_MIN_AREA_MM2) return null;
  return area > 0 ? cleaned : [...cleaned].reverse();
}

function triangulateRoofMeshPolygon(points: Point3[], normal: Vector3): Array<[number, number, number]> | null {
  const prepared = prepareProjectedRoofMeshPolygon(points, normal);
  if (!prepared) return null;
  const projected = prepared.map((candidate) => candidate.projected);
  if (roofMeshProjectedPolygonSelfIntersects(projected)) return null;

  const remaining = prepared.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  let guard = 0;

  while (remaining.length > 3 && guard < projected.length * projected.length) {
    guard += 1;
    let clipped = false;

    for (let remainingIndex = 0; remainingIndex < remaining.length; remainingIndex += 1) {
      const previousIndex = remaining[(remainingIndex - 1 + remaining.length) % remaining.length]!;
      const currentIndex = remaining[remainingIndex]!;
      const nextIndex = remaining[(remainingIndex + 1) % remaining.length]!;
      const previous = projected[previousIndex]!;
      const current = projected[currentIndex]!;
      const next = projected[nextIndex]!;

      if (roofMeshProjectedCross(previous, current, next) <= ROOF_JOIN_EPSILON_MM) continue;
      if (
        remaining.some((candidateIndex) => {
          if (candidateIndex === previousIndex || candidateIndex === currentIndex || candidateIndex === nextIndex) {
            return false;
          }
          return roofMeshPointInProjectedTriangle(projected[candidateIndex]!, previous, current, next);
        })
      ) {
        continue;
      }

      const centroid = roofMeshProjectedTriangleCentroid(previous, current, next);
      if (!roofMeshPointInProjectedPolygon(centroid, projected)) continue;

      triangles.push([
        prepared[previousIndex]!.index,
        prepared[currentIndex]!.index,
        prepared[nextIndex]!.index,
      ]);
      remaining.splice(remainingIndex, 1);
      clipped = true;
      break;
    }

    if (!clipped) return null;
  }

  if (remaining.length === 3) {
    const [a, b, c] = remaining as [number, number, number];
    if (roofMeshProjectedTriangleArea(projected[a]!, projected[b]!, projected[c]!) <= ROOF_REGION_MIN_AREA_MM2) {
      return null;
    }
    const centroid = roofMeshProjectedTriangleCentroid(projected[a]!, projected[b]!, projected[c]!);
    if (!roofMeshPointInProjectedPolygon(centroid, projected)) return null;
    triangles.push([prepared[a]!.index, prepared[b]!.index, prepared[c]!.index]);
  }

  const triangulatedArea = triangles.reduce((sum, [a, b, c]) => {
    const projectedA = projectRoofMeshPoint(points[a]!, normal);
    const projectedB = projectRoofMeshPoint(points[b]!, normal);
    const projectedC = projectRoofMeshPoint(points[c]!, normal);
    return sum + roofMeshProjectedTriangleArea(projectedA, projectedB, projectedC);
  }, 0);
  const polygonArea = Math.abs(signedRoofMeshProjectedArea(projected));
  if (Math.abs(triangulatedArea - polygonArea) > Math.max(1, polygonArea * 0.001)) return null;

  return triangles;
}

function orientRoofMeshFace(
  vertices: Point3[],
  face: [number, number, number],
  normal: Vector3,
): [number, number, number] {
  const a = vertices[face[0]]!;
  const b = vertices[face[1]]!;
  const c = vertices[face[2]]!;
  const faceNormal = crossProduct(subtractPoints(b, a), subtractPoints(c, a));
  return dotProduct(faceNormal, normal) >= 0 ? face : [face[0], face[2], face[1]];
}

function buildRoofSolidRenderMesh(input: {
  roofPlanes: RoofPlane3D[];
  roofPlaneIndex: number;
  adjacency: RoofSolidAdjacency;
  bottomPlanes: Array<RoofSolidPlaneEquation | null>;
  includeBottomFaces?: boolean;
  perimeterEdgeRoles?: Map<string, HouseRoofPerimeterEdgeKind>;
}): RenderMesh3D | undefined {
  if (input.adjacency.invalidRoofPlaneIndexes.has(input.roofPlaneIndex)) return undefined;
  const roofPlane = input.roofPlanes[input.roofPlaneIndex];
  const bottomPlane = input.bottomPlanes[input.roofPlaneIndex];
  if (!roofPlane || !bottomPlane || roofPlane.boundary.length < 3) return undefined;

  const roofNormal = normalizeVector(roofPlane.plane.normal);
  if (finiteVectorLength(roofNormal) <= ROOF_JOIN_EPSILON_MM || Math.abs(roofNormal.z) <= ROOF_JOIN_EPSILON_MM) {
    return undefined;
  }
  const topNormal = roofNormal.z >= 0 ? roofNormal : negateVector(roofNormal);
  const triangles = triangulateRoofMeshPolygon(roofPlane.boundary, topNormal);
  if (!triangles) return undefined;

  const bottomEdges: RoofSolidBottomEdge[] = [];
  for (let edgeIndex = 0; edgeIndex < roofPlane.boundary.length; edgeIndex += 1) {
    const start = roofPlane.boundary[edgeIndex]!;
    const end = roofPlane.boundary[(edgeIndex + 1) % roofPlane.boundary.length]!;
    const edgeKey = roofSolidEdgeKey(start, end);
    const edgeReferences = input.adjacency.edgeMap.get(edgeKey) ?? [];
    const edgeReference = edgeReferences.find(
      (reference) => reference.roofPlaneIndex === input.roofPlaneIndex && reference.edgeIndex === edgeIndex,
    );
    if (!edgeReference || edgeReferences.length === 0 || edgeReferences.length > 2) return undefined;
    const bottomEdge = buildRoofSolidBottomEdge({
      edgeReference,
      edgeReferences,
      bottomPlanes: input.bottomPlanes,
      perimeterRole:
        input.perimeterEdgeRoles?.get(`${roofPlane.id}:${edgeIndex}`) ?? null,
    });
    if (!bottomEdge) return undefined;
    bottomEdges.push(bottomEdge);
  }

  const bottomVertices: Point3[] = [];
  for (let vertexIndex = 0; vertexIndex < roofPlane.boundary.length; vertexIndex += 1) {
    const previousBottomEdge = bottomEdges[(vertexIndex - 1 + bottomEdges.length) % bottomEdges.length]!;
    const currentBottomEdge = bottomEdges[vertexIndex]!;
    const bottomVertex = intersectRoofSolidLines(
      previousBottomEdge.line,
      currentBottomEdge.line,
      roofPlane.boundary[vertexIndex]!,
    );
    if (!bottomVertex) return undefined;
    if (Math.abs(dotProduct(bottomPlane.normal, bottomVertex) - bottomPlane.constant) > 1e-2) return undefined;
    bottomVertices.push(bottomVertex);
  }

  const vertices = [...roofPlane.boundary, ...bottomVertices];
  const vertexCount = roofPlane.boundary.length;
  const faces: [number, number, number][] = [];
  for (const face of triangles) {
    faces.push(orientRoofMeshFace(vertices, face, topNormal));
    if (input.includeBottomFaces ?? true) {
      faces.push(orientRoofMeshFace(
        vertices,
        [face[0] + vertexCount, face[2] + vertexCount, face[1] + vertexCount],
        negateVector(topNormal),
      ));
    }
  }

  for (let edgeIndex = 0; edgeIndex < bottomEdges.length; edgeIndex += 1) {
    if (!bottomEdges[edgeIndex]!.perimeter) continue;
    const nextIndex = (edgeIndex + 1) % vertexCount;
    faces.push([edgeIndex, nextIndex, vertexCount + nextIndex]);
    faces.push([edgeIndex, vertexCount + nextIndex, vertexCount + edgeIndex]);
  }

  const mesh = { vertices, faces };
  return renderMeshIsFinite(mesh) ? mesh : undefined;
}

function polygonAveragePoint3D(points: Polygon3): Point3 {
  const total = points.reduce(
    (sum, current) => ({
      x: sum.x + current.x,
      y: sum.y + current.y,
      z: sum.z + current.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const divisor = Math.max(1, points.length);
  return point(total.x / divisor, total.y / divisor, total.z / divisor);
}

function cleanPolygon3D(points: Polygon3): Polygon3 {
  const withoutDuplicates: Polygon3 = [];
  for (const candidate of points) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1];
    if (previous && finiteVectorLength(subtractPoints(candidate, previous)) <= ROOF_JOIN_EPSILON_MM) continue;
    withoutDuplicates.push(candidate);
  }

  if (
    withoutDuplicates.length > 1 &&
    finiteVectorLength(subtractPoints(withoutDuplicates[0]!, withoutDuplicates[withoutDuplicates.length - 1]!)) <=
      ROOF_JOIN_EPSILON_MM
  ) {
    withoutDuplicates.pop();
  }

  if (withoutDuplicates.length < 3) return withoutDuplicates;

  const cleaned: Polygon3 = [];
  for (let index = 0; index < withoutDuplicates.length; index += 1) {
    const previous = withoutDuplicates[(index - 1 + withoutDuplicates.length) % withoutDuplicates.length]!;
    const current = withoutDuplicates[index]!;
    const next = withoutDuplicates[(index + 1) % withoutDuplicates.length]!;
    const first = subtractPoints(current, previous);
    const second = subtractPoints(next, current);
    if (finiteVectorLength(crossProduct(first, second)) <= ROOF_JOIN_EPSILON_MM) continue;
    cleaned.push(current);
  }

  return cleaned.length >= 3 ? cleaned : withoutDuplicates;
}

function clipPolygon3DByScalar(
  polygon: Polygon3,
  scalar: (candidate: Point3) => number,
): Polygon3 {
  if (polygon.length < 3) return [];
  const clipped: Polygon3 = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const currentValue = scalar(current);
    const nextValue = scalar(next);
    const currentInside = currentValue <= ROOF_JOIN_EPSILON_MM;
    const nextInside = nextValue <= ROOF_JOIN_EPSILON_MM;
    const denominator = currentValue - nextValue;
    const intersection =
      Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM
        ? null
        : translatePointByVector(
            current,
            scaleVector(subtractPoints(next, current), clamp(currentValue / denominator, 0, 1)),
          );

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      if (intersection) clipped.push(intersection);
    } else if (!currentInside && nextInside) {
      if (intersection) clipped.push(intersection);
      clipped.push(next);
    }
  }

  return cleanPolygon3D(clipped);
}

function roofPlaneTopNormal(roofPlane: RoofPlane3D): Vector3 | null {
  const normal = normalizeVector(roofPlane.plane.normal);
  if (finiteVectorLength(normal) <= ROOF_JOIN_EPSILON_MM) return null;
  return normal.z >= 0 ? normal : negateVector(normal);
}

function buildHouseRoofFeatureFlashingWing(input: {
  flashingId: string;
  featureLine: Line3;
  roofPlane: RoofPlane3D;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  let interiorDirection = normalizeVector(crossProduct(topNormal, featureDirection));
  if (finiteVectorLength(interiorDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const centroidDistance = dotProduct(
    subtractPoints(polygonAveragePoint3D(input.roofPlane.boundary), input.featureLine.start),
    interiorDirection,
  );
  if (Math.abs(centroidDistance) <= ROOF_JOIN_EPSILON_MM) {
    const distances = input.roofPlane.boundary.map((candidate) =>
      dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection),
    );
    const positiveMax = Math.max(...distances);
    const negativeMax = Math.max(...distances.map((distance) => -distance));
    if (negativeMax > positiveMax) interiorDirection = negateVector(interiorDirection);
  } else if (centroidDistance < 0) {
    interiorDirection = negateVector(interiorDirection);
  }

  const distanceFromFeature = (candidate: Point3) =>
    dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection);
  const interiorSide = clipPolygon3DByScalar(
    input.roofPlane.boundary,
    (candidate) => -distanceFromFeature(candidate),
  );
  const strip = clipPolygon3DByScalar(
    interiorSide,
    (candidate) => distanceFromFeature(candidate) - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
  );
  if (strip.length < 3 || polygonArea3D(strip) <= ROOF_REGION_MIN_AREA_MM2) return null;

  const surfaceOffset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM);
  const boundary = strip.map((candidate) => translatePointByVector(candidate, surfaceOffset));
  const plane = {
    ...input.roofPlane.plane,
    origin: translatePointByVector(input.roofPlane.plane.origin, surfaceOffset),
  };

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-wing`,
    boundary,
    plane,
  };
}

function buildHouseRoofFeatureFlashings(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
}): RoofFlashing3D[] {
  const adjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const flashings: RoofFlashing3D[] = [];

  for (const feature of input.roofFeatures) {
    if (feature.kind === 'gable_end_frame') continue;
    if (feature.metadata?.roofFeatureSource === 'reentrant_fallback') continue;
    const edgeReferences = adjacency.edgeMap.get(roofSolidEdgeKey(feature.line.start, feature.line.end)) ?? [];
    const uniqueRoofPlaneIndexes = new Set(edgeReferences.map((reference) => reference.roofPlaneIndex));
    if (edgeReferences.length !== 2 || uniqueRoofPlaneIndexes.size !== 2) continue;
    if (edgeReferences.some((reference) => adjacency.invalidRoofPlaneIndexes.has(reference.roofPlaneIndex))) continue;

    const flashingId = `house-roof-flashing-${feature.id}`;
    const wings = edgeReferences
      .map((reference) => {
        const roofPlane = input.roofPlanes[reference.roofPlaneIndex];
        return roofPlane
          ? buildHouseRoofFeatureFlashingWing({
              flashingId,
              featureLine: feature.line,
              roofPlane,
            })
          : null;
      })
      .filter((wing): wing is RoofFlashing3D['wings'][number] => wing !== null);

    if (wings.length !== 2) continue;
    flashings.push({
      id: flashingId,
      wings,
      thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
      metadata: {
        position: feature.kind,
        source: 'house_model',
        sourceFeatureId: feature.id,
        featureKind: feature.kind,
        girthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
        wingLengthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
        surfaceOffsetMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
        roofGeometry: typeof feature.metadata?.roofGeometry === 'string' ? feature.metadata.roofGeometry : null,
      },
    });
  }

  return flashings;
}

function attachmentTargetPlane(input: {
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): Plane3 | null {
  const attachmentTarget = input.attachmentTarget;
  if (!attachmentTarget) return null;
  if (attachmentTarget.kind === 'zone') return attachmentTarget.zone?.plane ?? null;
  if (attachmentTarget.kind === 'plane') return attachmentTarget.plane ?? null;
  return null;
}

function buildPerimeterRoofFlashingWing(input: {
  flashingId: string;
  edge: HouseRoofPerimeterEdge;
  roofPlane: RoofPlane3D;
  featureLine: Line3;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  let interiorDirection = normalizeVector(crossProduct(topNormal, featureDirection));
  if (finiteVectorLength(interiorDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const centroidDistance = dotProduct(
    subtractPoints(polygonAveragePoint3D(input.roofPlane.boundary), input.featureLine.start),
    interiorDirection,
  );
  if (Math.abs(centroidDistance) <= ROOF_JOIN_EPSILON_MM) {
    const distances = input.roofPlane.boundary.map((candidate) =>
      dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection),
    );
    const positiveMax = Math.max(...distances);
    const negativeMax = Math.max(...distances.map((distance) => -distance));
    if (negativeMax > positiveMax) interiorDirection = negateVector(interiorDirection);
  } else if (centroidDistance < 0) {
    interiorDirection = negateVector(interiorDirection);
  }

  const surfaceOffset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM);
  const inset = scaleVector(interiorDirection, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM);
  const boundary = [
    translatePointByVector(input.featureLine.start, surfaceOffset),
    translatePointByVector(input.featureLine.end, surfaceOffset),
    translatePointByVector(translatePointByVector(input.featureLine.end, inset), surfaceOffset),
    translatePointByVector(translatePointByVector(input.featureLine.start, inset), surfaceOffset),
  ];
  if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;
  const plane = {
    ...input.roofPlane.plane,
    origin: translatePointByVector(input.roofPlane.plane.origin, surfaceOffset),
  };

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-roof-wing`,
    boundary,
    plane,
  };
}

function buildPerimeterReturnFlashingWing(input: {
  flashingId: string;
  edge: HouseRoofPerimeterEdge;
  roofPlane: RoofPlane3D;
  attachmentTarget?: HouseAttachmentTarget3D | null;
  featureLine: Line3;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;

  const roofOffsetNormal = roofPlaneTopNormal(input.roofPlane);
  const roofOffset =
    roofOffsetNormal
      ? scaleVector(roofOffsetNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM)
      : { x: 0, y: 0, z: 0 };
  const topStart = translatePointByVector(input.featureLine.start, roofOffset);
  const topEnd = translatePointByVector(input.featureLine.end, roofOffset);

  if (input.edge.edgeKind === 'house_apron_edge') {
    const wallPlane = attachmentTargetPlane({ attachmentTarget: input.attachmentTarget });
    if (wallPlane) {
      const boundary = [
        input.featureLine.start,
        input.featureLine.end,
        point(
          input.featureLine.end.x,
          input.featureLine.end.y,
          input.featureLine.end.z + DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        ),
        point(
          input.featureLine.start.x,
          input.featureLine.start.y,
          input.featureLine.start.z + DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        ),
      ];
      if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;
      return {
        id: `${input.flashingId}-${input.roofPlane.id}-apron-wing`,
        boundary,
        plane: wallPlane,
      };
    }
  }

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const boundary = [
    topStart,
    topEnd,
    point(topEnd.x, topEnd.y, topEnd.z - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM),
    point(topStart.x, topStart.y, topStart.z - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM),
  ];
  if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-return-wing`,
    boundary,
    plane: planeFromOriginAxes(topStart, featureDirection, WORLD_Z),
  };
}

function buildPerimeterFlashings(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  roofPlanes: RoofPlane3D[];
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): RoofFlashing3D[] {
  const roofPlaneById = new Map(input.roofPlanes.map((roofPlane) => [roofPlane.id, roofPlane]));

  return input.perimeterEdges.flatMap((edge) => {
    if (!isPerimeterFlashingEdge(edge.edgeKind)) return [];
    return input.roofPlanes.flatMap((roofPlane) => {
      const featureLine = roofPlanePerimeterOverlapSegment(roofPlane, edge);
      if (!featureLine) return [];

      const flashingId = `house-roof-flashing-${edge.sourceEdgeId}-${roofPlane.id}`;
      const roofWing = buildPerimeterRoofFlashingWing({
        flashingId,
        edge,
        roofPlane,
        featureLine,
      });
      const returnWing = buildPerimeterReturnFlashingWing({
        flashingId,
        edge,
        roofPlane,
        attachmentTarget: input.attachmentTarget,
        featureLine,
      });
      const wings = [roofWing, returnWing].filter(
        (wing): wing is RoofFlashing3D['wings'][number] => wing !== null,
      );
      if (wings.length !== 2) return [];

      return [{
        id: flashingId,
        wings,
        thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
        metadata: {
          position: edge.flashingRole ?? null,
          source: 'house_model',
          sourceEdgeId: edge.sourceEdgeId,
          sourceRoofPlaneId: roofPlane.id,
          featureKind: null,
          girthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
          wingLengthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
          thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
          surfaceOffsetMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
          roofGeometry:
            typeof roofPlane.metadata?.roofGeometry === 'string' ? roofPlane.metadata.roofGeometry : null,
          houseRoofPerimeterRole: edge.edgeKind,
          flashingRole: edge.flashingRole ?? null,
          flashingTreatment: 'house_perimeter_folded',
        },
      }];
    });
  });
}

type HouseRoofMaterialSettings = {
  profileKind: HouseRoofMaterialProfileKind;
  spacingMm: number;
  lineDirection: 'fall' | 'across';
};

type HouseRoofMaterialProjection = {
  u: number;
  v: number;
};

function houseRoofMaterialSettings(material: HouseRoofMaterial): HouseRoofMaterialSettings {
  switch (material) {
    case 'trapezoidal_5_rib':
      return { profileKind: 'rib', spacingMm: 190, lineDirection: 'fall' };
    case 'eurotray_300':
      return { profileKind: 'seam', spacingMm: 300, lineDirection: 'fall' };
    case 'eurotray_500':
      return { profileKind: 'seam', spacingMm: 500, lineDirection: 'fall' };
    case 'shingles':
      return { profileKind: 'course', spacingMm: 250, lineDirection: 'across' };
    case 'corrugated_iron':
    default:
      return { profileKind: 'rib', spacingMm: 76.2, lineDirection: 'fall' };
  }
}

function pointOnHouseRoofMaterialProjectedSegment(
  candidate: HouseRoofMaterialProjection,
  start: HouseRoofMaterialProjection,
  end: HouseRoofMaterialProjection,
): boolean {
  const dx = end.u - start.u;
  const dy = end.v - start.v;
  const cross = (candidate.u - start.u) * dy - (candidate.v - start.v) * dx;
  if (Math.abs(cross) > ROOF_JOIN_EPSILON_MM) return false;
  const dot = (candidate.u - start.u) * dx + (candidate.v - start.v) * dy;
  if (dot < -ROOF_JOIN_EPSILON_MM) return false;
  return dot <= dx * dx + dy * dy + ROOF_JOIN_EPSILON_MM;
}

function pointInHouseRoofMaterialProjectedPolygon(
  candidate: HouseRoofMaterialProjection,
  polygon: HouseRoofMaterialProjection[],
): boolean {
  if (
    polygon.some((start, index) =>
      pointOnHouseRoofMaterialProjectedSegment(candidate, start, polygon[(index + 1) % polygon.length]!),
    )
  ) {
    return true;
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.v > candidate.v !== previous.v > candidate.v &&
      candidate.u < ((previous.u - current.u) * (candidate.v - current.v)) / (previous.v - current.v || 1) + current.u;
    if (intersects) inside = !inside;
  }
  return inside;
}

function projectedHouseRoofMaterialPolygonArea(polygon: HouseRoofMaterialProjection[]): number {
  if (polygon.length < 3) return 0;
  return Math.abs(
    polygon.reduce((sum, current, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      return sum + current.u * next.v - next.u * current.v;
    }, 0) / 2,
  );
}

function uniqueHouseRoofMaterialProjectedPointCount(polygon: HouseRoofMaterialProjection[]): number {
  return new Set(
    polygon.map((candidate) => `${Math.round(candidate.u / ROOF_JOIN_EPSILON_MM)},${Math.round(candidate.v / ROOF_JOIN_EPSILON_MM)}`),
  ).size;
}

function worldHouseRoofMaterialPoint(input: {
  origin: Point3;
  acrossAxis: Vector3;
  fallAxis: Vector3;
  offset: Vector3;
  u: number;
  v: number;
}): Point3 {
  return point(
    input.origin.x + input.acrossAxis.x * input.u + input.fallAxis.x * input.v + input.offset.x,
    input.origin.y + input.acrossAxis.y * input.u + input.fallAxis.y * input.v + input.offset.y,
    input.origin.z + input.acrossAxis.z * input.u + input.fallAxis.z * input.v + input.offset.z,
  );
}

function houseRoofMaterialCoordinateValues(min: number, max: number, spacingMm: number): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= ROOF_JOIN_EPSILON_MM || !Number.isFinite(spacingMm) || spacingMm <= ROOF_JOIN_EPSILON_MM) {
    return [];
  }
  const values: number[] = [];
  const start = Math.ceil(min / spacingMm) * spacingMm;
  for (let value = start; value <= max + ROOF_JOIN_EPSILON_MM; value += spacingMm) {
    if (value > min + ROOF_JOIN_EPSILON_MM && value < max - ROOF_JOIN_EPSILON_MM) {
      values.push(value);
    }
    if (values.length > 1000) break;
  }
  if (values.length === 0) values.push((min + max) / 2);
  return values;
}

function clipHouseRoofMaterialLine(input: {
  polygon: HouseRoofMaterialProjection[];
  fixedAxis: 'u' | 'v';
  fixedValue: number;
}): Array<{ start: HouseRoofMaterialProjection; end: HouseRoofMaterialProjection }> {
  const intersections: number[] = [];
  const variableAxis = input.fixedAxis === 'u' ? 'v' : 'u';

  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    const startFixedDistance = start[input.fixedAxis] - input.fixedValue;
    const endFixedDistance = end[input.fixedAxis] - input.fixedValue;

    if (Math.abs(startFixedDistance) <= ROOF_JOIN_EPSILON_MM && Math.abs(endFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(start[variableAxis], end[variableAxis]);
      continue;
    }

    if (Math.abs(startFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(start[variableAxis]);
      continue;
    }

    if (Math.abs(endFixedDistance) <= ROOF_JOIN_EPSILON_MM) {
      intersections.push(end[variableAxis]);
      continue;
    }

    if (startFixedDistance * endFixedDistance < 0) {
      const ratio = startFixedDistance / (startFixedDistance - endFixedDistance);
      intersections.push(start[variableAxis] + (end[variableAxis] - start[variableAxis]) * ratio);
    }
  }

  const sorted = [...intersections]
    .filter((candidate) => Number.isFinite(candidate))
    .sort((a, b) => a - b)
    .reduce<number[]>((unique, candidate) => {
      const previous = unique[unique.length - 1];
      if (previous === undefined || Math.abs(candidate - previous) > ROOF_JOIN_EPSILON_MM) unique.push(candidate);
      return unique;
    }, []);

  const segments: Array<{ start: HouseRoofMaterialProjection; end: HouseRoofMaterialProjection }> = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startValue = sorted[index]!;
    const endValue = sorted[index + 1]!;
    if (endValue - startValue <= 1) continue;
    const midpointValue = (startValue + endValue) / 2;
    const midpoint =
      input.fixedAxis === 'u'
        ? { u: input.fixedValue, v: midpointValue }
        : { u: midpointValue, v: input.fixedValue };
    if (!pointInHouseRoofMaterialProjectedPolygon(midpoint, input.polygon)) continue;

    segments.push(
      input.fixedAxis === 'u'
        ? {
            start: { u: input.fixedValue, v: startValue },
            end: { u: input.fixedValue, v: endValue },
          }
        : {
            start: { u: startValue, v: input.fixedValue },
            end: { u: endValue, v: input.fixedValue },
          },
    );
  }

  return segments;
}

function buildHouseRoofMaterialVisualForPlane(input: {
  roofPlane: RoofPlane3D;
  material: HouseRoofMaterial;
}): HouseRoofMaterialVisual3D | null {
  const settings = houseRoofMaterialSettings(input.material);
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;
  if (!input.roofPlane.boundary.every(finiteRoofQaPoint) || polygonArea3D(input.roofPlane.boundary) <= ROOF_REGION_MIN_AREA_MM2) {
    return null;
  }

  const rawFall = normalizeVector(input.roofPlane.fallVector);
  if (finiteVectorLength(rawFall) <= ROOF_JOIN_EPSILON_MM) return null;
  const normalFallDot = dotProduct(rawFall, topNormal);
  const fallAxis = normalizeVector({
    x: rawFall.x - topNormal.x * normalFallDot,
    y: rawFall.y - topNormal.y * normalFallDot,
    z: rawFall.z - topNormal.z * normalFallDot,
  });
  if (finiteVectorLength(fallAxis) <= ROOF_JOIN_EPSILON_MM) return null;

  const acrossAxis = normalizeVector(crossProduct(topNormal, fallAxis));
  if (finiteVectorLength(acrossAxis) <= ROOF_JOIN_EPSILON_MM) return null;

  const origin = input.roofPlane.plane.origin;
  const projected = input.roofPlane.boundary.map((candidate) => {
    const relative = subtractPoints(candidate, origin);
    return {
      u: dotProduct(relative, acrossAxis),
      v: dotProduct(relative, fallAxis),
    };
  });
  if (
    projected.length < 3 ||
    uniqueHouseRoofMaterialProjectedPointCount(projected) < 3 ||
    projectedHouseRoofMaterialPolygonArea(projected) <= ROOF_REGION_MIN_AREA_MM2
  ) {
    return null;
  }

  const coordinates =
    settings.lineDirection === 'fall'
      ? houseRoofMaterialCoordinateValues(
          Math.min(...projected.map((candidate) => candidate.u)),
          Math.max(...projected.map((candidate) => candidate.u)),
          settings.spacingMm,
        )
      : houseRoofMaterialCoordinateValues(
          Math.min(...projected.map((candidate) => candidate.v)),
          Math.max(...projected.map((candidate) => candidate.v)),
          settings.spacingMm,
        );
  const offset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM);
  const lines = coordinates.flatMap((fixedValue) =>
    clipHouseRoofMaterialLine({
      polygon: projected,
      fixedAxis: settings.lineDirection === 'fall' ? 'u' : 'v',
      fixedValue,
    }).map((segment) =>
      line(
        worldHouseRoofMaterialPoint({
          origin,
          acrossAxis,
          fallAxis,
          offset,
          u: segment.start.u,
          v: segment.start.v,
        }),
        worldHouseRoofMaterialPoint({
          origin,
          acrossAxis,
          fallAxis,
          offset,
          u: segment.end.u,
          v: segment.end.v,
        }),
      ),
    ),
  ).filter((candidate) => lineLength(candidate) > 1 && finiteRoofQaPoint(candidate.start) && finiteRoofQaPoint(candidate.end));

  if (lines.length === 0) return null;

  return {
    id: `house-roof-material-${input.roofPlane.id}`,
    roofPlaneId: input.roofPlane.id,
    material: input.material,
    profileKind: settings.profileKind,
    lines,
    plane: {
      ...input.roofPlane.plane,
      origin: translatePointByVector(input.roofPlane.plane.origin, offset),
    },
    spacingMm: settings.spacingMm,
    surfaceOffsetMm: DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
    metadata: {
      source: 'house_model',
      sourceRoofPlaneId: input.roofPlane.id,
      material: input.material,
      profileKind: settings.profileKind,
      lineDirection: settings.lineDirection,
      spacingMm: settings.spacingMm,
      surfaceOffsetMm: DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
      lineCount: lines.length,
    },
  };
}

function buildHouseRoofMaterialVisuals(input: {
  roofPlanes: RoofPlane3D[];
  material: HouseRoofMaterial;
}): HouseRoofMaterialVisual3D[] {
  return input.roofPlanes
    .map((roofPlane) => buildHouseRoofMaterialVisualForPlane({ roofPlane, material: input.material }))
    .filter((visual): visual is HouseRoofMaterialVisual3D => visual !== null);
}

function buildHouseDecks(input: {
  decks: NonNullable<HouseModel3D['decks']>;
}): HouseDeck3D[] {
  return input.decks
    .map((deck) => {
      if (!deck.boundary.length) return null;
      const topZ = Math.round(deck.topSurfaceElevationMm);
      const boundary = deck.boundary.map((point3) => point(point3.x, point3.y, topZ));
      const plane = planeFromBoundary(boundary);
      if (!plane) return null;
      return {
        ...deck,
        boundary,
        plane,
      };
    })
    .filter((deck): deck is HouseDeck3D => deck !== null);
}

function resolveOutwardUnit2D(input: {
  start: Point3;
  end: Point3;
  footprint: Polygon3;
}): { x: number; y: number } | null {
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return null;
  const normalA = { x: -dy / length, y: dx / length };
  const normalB = { x: -normalA.x, y: -normalA.y };
  const midpoint = {
    x: (input.start.x + input.end.x) / 2,
    y: (input.start.y + input.end.y) / 2,
  };
  const probeDistanceMm = 10;
  const probeA = {
    x: midpoint.x + normalA.x * probeDistanceMm,
    y: midpoint.y + normalA.y * probeDistanceMm,
  };
  const probeB = {
    x: midpoint.x + normalB.x * probeDistanceMm,
    y: midpoint.y + normalB.y * probeDistanceMm,
  };
  const probeAInside = pointInPolygon2D(probeA, input.footprint);
  const probeBInside = pointInPolygon2D(probeB, input.footprint);
  if (probeAInside && !probeBInside) return normalB;
  if (!probeAInside && probeBInside) return normalA;

  const centroid = polygonCentroid2D(input.footprint);
  const awayFromCentroid = {
    x: midpoint.x - centroid.x,
    y: midpoint.y - centroid.y,
  };
  return normalA.x * awayFromCentroid.x + normalA.y * awayFromCentroid.y >= 0 ? normalA : normalB;
}

function attachmentSideFromWallLine(input: {
  start: Point3;
  end: Point3;
  footprint: Polygon3;
}): AttachmentSide | null {
  const outward = resolveOutwardUnit2D(input);
  if (!outward) return null;
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? outward.y < 0 ? 'rear' : 'front'
    : outward.x < 0 ? 'left' : 'right';
}

function isAttachmentSide(value: string | null | undefined): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function resolveDeckHostWallSegment(input: {
  deck: HouseDeckConfig;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
}): HouseWallSegment3D | null {
  const requestedEdgeId = input.deck.hostEdgeId?.trim() || input.deck.supportContext?.nearestHouseEdgeId?.trim() || null;
  if (!requestedEdgeId) return null;

  const exactMatch = input.wallSegments.find(
    (segment) =>
      segment.id === requestedEdgeId ||
      segment.sourceEdgeId === requestedEdgeId ||
      segment.metadata?.sourceEdgeId === requestedEdgeId,
  );
  if (exactMatch) return exactMatch;

  if (!isAttachmentSide(requestedEdgeId)) return null;

  return input.wallSegments
    .filter((segment) =>
      attachmentSideFromWallLine({
        start: segment.line.start,
        end: segment.line.end,
        footprint: input.footprint,
      }) === requestedEdgeId,
    )
    .sort((left, right) => lineLength(right.line) - lineLength(left.line))[0] ?? null;
}

function resolvePresetDeckBoundary(input: {
  deck: HouseDeckConfig;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
}): Polygon3 | null {
  const presetRect = input.deck.presetRect;
  if (!presetRect) return null;
  const widthMm = Number(presetRect.widthMm);
  const depthMm = Number(presetRect.depthMm);
  if (!Number.isFinite(widthMm) || !Number.isFinite(depthMm) || widthMm <= 0 || depthMm <= 0) return null;

  const hostWall = resolveDeckHostWallSegment(input);
  if (!hostWall) return null;
  const hostLengthMm = lineLength(hostWall.line);
  if (hostLengthMm <= 1e-6) return null;

  const alongUnit = {
    x: (hostWall.line.end.x - hostWall.line.start.x) / hostLengthMm,
    y: (hostWall.line.end.y - hostWall.line.start.y) / hostLengthMm,
  };
  const outwardUnit = resolveOutwardUnit2D({
    start: hostWall.line.start,
    end: hostWall.line.end,
    footprint: input.footprint,
  });
  if (!outwardUnit) return null;

  const centerOffsetMm = Number.isFinite(presetRect.centerOffsetMm) ? presetRect.centerOffsetMm : 0;
  const detachedGapMm =
    input.deck.isAttached || input.deck.presetType === 'rect_attached'
      ? 0
      : Math.max(0, Number.isFinite(presetRect.detachedGapMm) ? presetRect.detachedGapMm : 0);
  const hostMidpoint = {
    x: (hostWall.line.start.x + hostWall.line.end.x) / 2,
    y: (hostWall.line.start.y + hostWall.line.end.y) / 2,
  };
  const innerCenter = {
    x: hostMidpoint.x + alongUnit.x * centerOffsetMm + outwardUnit.x * detachedGapMm,
    y: hostMidpoint.y + alongUnit.y * centerOffsetMm + outwardUnit.y * detachedGapMm,
  };
  const halfWidthMm = widthMm / 2;
  const start = point(innerCenter.x - alongUnit.x * halfWidthMm, innerCenter.y - alongUnit.y * halfWidthMm, 0);
  const end = point(innerCenter.x + alongUnit.x * halfWidthMm, innerCenter.y + alongUnit.y * halfWidthMm, 0);
  return [
    start,
    end,
    point(end.x + outwardUnit.x * depthMm, end.y + outwardUnit.y * depthMm, 0),
    point(start.x + outwardUnit.x * depthMm, start.y + outwardUnit.y * depthMm, 0),
  ];
}

function resolveHouseDeckBoundary(input: {
  deck: HouseDeckConfig;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
}): Polygon3 | null {
  const outline = input.deck.outline?.length ? input.deck.outline : null;
  if (input.deck.shape === 'custom' && outline && outline.length >= 3) return outline;
  const presetBoundary = resolvePresetDeckBoundary(input);
  if (presetBoundary?.length) return presetBoundary;
  return outline && outline.length >= 3 ? outline : null;
}

function houseWallIsOpenGableFrame(
  wall: Pick<HouseWallSegment3D, 'metadata'>,
): boolean {
  return wall.metadata?.houseWallMode === 'open_gable_frame';
}

function buildOpenGableFrameFeatures(input: {
  wallSegments: HouseWallSegment3D[];
  openTerminalEnds: HouseGableTerminalEnd[];
  roofGeometry: string | null;
}): HouseRoofFeature3D[] {
  const wallBySourceEdgeId = new Map(
    input.wallSegments.map((segment) => [segment.sourceEdgeId ?? '', segment]),
  );
  const features: HouseRoofFeature3D[] = [];

  for (const terminalEnd of input.openTerminalEnds) {
    const wall = wallBySourceEdgeId.get(terminalEnd.sourceEdgeId);
    if (!wall) continue;
    const topProfile = wall.boundary.slice(2).reverse();
    if (topProfile.length < 2) continue;

    const startVertical = line(wall.line.start, topProfile[0]!);
    if (lineLength(startVertical) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM) {
      features.push({
        id: `${terminalEnd.id}-side-a`,
        kind: 'gable_end_frame',
        line: startVertical,
        metadata: {
          roofForm: 'gable',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_post',
        },
      });
    }

    for (let index = 0; index < topProfile.length - 1; index += 1) {
      const topSegment = line(topProfile[index]!, topProfile[index + 1]!);
      if (lineLength(topSegment) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      features.push({
        id: `${terminalEnd.id}-top-${index + 1}`,
        kind: 'gable_end_frame',
        line: topSegment,
        metadata: {
          roofForm: 'gable',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_top_chord',
        },
      });
    }

    const endVertical = line(wall.line.end, topProfile[topProfile.length - 1]!);
    if (lineLength(endVertical) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM) {
      features.push({
        id: `${terminalEnd.id}-side-b`,
        kind: 'gable_end_frame',
        line: endVertical,
        metadata: {
          roofForm: 'gable',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_post',
        },
      });
    }
  }

  return features;
}

function buildHouseEnvelopeSolids(input: {
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  roofForm: HouseRoofForm;
  decks: HouseDeck3D[];
  perimeterEdges: HouseRoofPerimeterEdge[];
  soffitPolygons: HouseRoofPerimeterPolygon[];
  fasciaPolygons: HouseRoofPerimeterPolygon[];
  gutterLines: HouseRoofPerimeterLine[];
  gutterBoundaries: HouseRoofPerimeterPolygon[];
  gutterWidthMm: number;
  gutterDepthMm: number;
}): NonNullable<HouseModel3D['solids']> {
  const surfaceSolids: NonNullable<HouseModel3D['solids']>['surfaceSolids'] = [];
  const linearSolids: NonNullable<HouseModel3D['solids']>['linearSolids'] = [];
  const wallMiterFootprints = buildMiteredStripFootprints(
    input.wallSegments.map((segment) => segment.line.start),
    DEFAULT_WALL_SOLID_THICKNESS_MM / 2,
  );
  const fasciaMiterFootprints = buildPerimeterOffsetStripFootprints({
    edges: input.perimeterEdges,
    outerOffsetMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
    innerOffsetMm: -DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
  });
  const roofSolidAdjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const roofBottomPlanes = input.roofPlanes.map((roofPlane) =>
    roofSolidBottomPlaneEquation(roofPlane.plane, DEFAULT_ROOF_SOLID_THICKNESS_MM),
  );
  const perimeterEdgeRoles = new Map<string, HouseRoofPerimeterEdgeKind>();
  for (const edge of input.perimeterEdges) {
    if (!edge.sourceRoofPlaneId) continue;
    perimeterEdgeRoles.set(`${edge.sourceRoofPlaneId}:${edge.index}`, edge.edgeKind);
  }

  for (const [index, wall] of input.wallSegments.entries()) {
    if (houseWallIsOpenGableFrame(wall)) continue;
    const zRange = boundaryZRange(wall.boundary);
    const renderMesh =
      zRange &&
      wallBoundaryHasFlatTop(wall.boundary) &&
      wallMiterFootprints?.length === input.wallSegments.length
        ? buildVerticalPrismRenderMesh(wallMiterFootprints[index]!, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-${wall.id}`,
      kind: 'wall',
      boundary: wall.boundary,
      plane: wall.plane,
      thicknessMm: DEFAULT_WALL_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: wall.id,
        sourceEdgeId: wall.sourceEdgeId ?? null,
      },
    });
  }

  for (const [roofPlaneIndex, roofPlane] of input.roofPlanes.entries()) {
    const renderMesh = buildRoofSolidRenderMesh({
      roofPlanes: input.roofPlanes,
      roofPlaneIndex,
      adjacency: roofSolidAdjacency,
      bottomPlanes: roofBottomPlanes,
      includeBottomFaces: input.roofForm !== 'mono',
      perimeterEdgeRoles,
    });
    surfaceSolids.push({
      id: `house-solid-${roofPlane.id}`,
      kind: 'roof',
      boundary: roofPlane.boundary,
      plane: roofPlane.plane,
      thicknessMm: DEFAULT_ROOF_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...roofPlane.metadata,
        sourceId: roofPlane.id,
      },
    });
  }

  for (const deck of input.decks) {
    const renderMesh = buildVerticalPrismRenderMesh(
      deck.boundary,
      deck.topSurfaceElevationMm - DEFAULT_DECK_SURFACE_THICKNESS_MM,
      deck.topSurfaceElevationMm,
    );
    surfaceSolids.push({
      id: `house-solid-${deck.id}`,
      kind: 'deck',
      boundary: deck.boundary,
      plane: deck.plane,
      thicknessMm: DEFAULT_DECK_SURFACE_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...deck.metadata,
        sourceId: deck.id,
      },
    });
  }

  for (const [index, soffit] of input.soffitPolygons.entries()) {
    const boundary = soffit.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const z = boundary[0]?.z;
    const renderMesh =
      typeof z === 'number' &&
      Number.isFinite(z) &&
      boundary.every((candidate) => Math.abs(candidate.z - z) <= 1e-6)
      ? buildVerticalPrismRenderMesh(
          boundary,
          z - DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
          z + DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
        )
      : undefined;
    surfaceSolids.push({
      id: `house-solid-soffit-${index + 1}`,
      kind: 'soffit',
      boundary,
      plane,
      thicknessMm: DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-soffit-${index + 1}`,
        sourceEdgeId: soffit.sourceEdgeId,
        houseRoofEdgeKind: soffit.edgeKind,
        houseRoofPerimeterRole: soffit.edgeKind,
        sourceRoofPlaneId: soffit.sourceRoofPlaneId ?? null,
        flashingRole: soffit.flashingRole ?? null,
        houseRoofSoffitMode: soffit.houseRoofSoffitMode ?? null,
      },
    });
  }

  for (const [index, fascia] of input.fasciaPolygons.entries()) {
    const boundary = fascia.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const zRange = boundaryZRange(boundary);
    const renderMesh =
      zRange && fasciaMiterFootprints.length === input.fasciaPolygons.length
        ? buildVerticalPrismRenderMesh(fasciaMiterFootprints[index]!.boundary, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-fascia-${index + 1}`,
      kind: 'fascia',
      boundary,
      plane,
      thicknessMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-fascia-${index + 1}`,
        sourceEdgeId: fascia.sourceEdgeId,
        houseRoofEdgeKind: fascia.edgeKind,
        houseRoofPerimeterRole: fascia.edgeKind,
        flashingRole: fascia.flashingRole ?? null,
        sourceRoofPlaneId: fascia.sourceRoofPlaneId ?? null,
      },
    });
  }

  for (const [index, gutter] of input.gutterLines.entries()) {
    const boundary = input.gutterBoundaries[index]?.boundary;
    const start = gutter.line.start;
    const end = gutter.line.end;
    const gutterLine = line(
      point(start.x, start.y, start.z - input.gutterDepthMm / 2),
      point(end.x, end.y, end.z - input.gutterDepthMm / 2),
    );
    if (lineLength(gutterLine) <= 1e-6) continue;
    const xAxis = normalizeVector(subtractPoints(gutterLine.end, gutterLine.start));
    const perimeterEdge = input.perimeterEdges.find((edge) => edge.sourceEdgeId === gutter.sourceEdgeId);
    const sourcePolygon = perimeterEdge?.perimeterPolygon ?? [];
    const sourceEdgeIndex = perimeterEdge?.index ?? sourceEdgeIndexFromId(gutter.sourceEdgeId, sourcePolygon.length);
    const yAxis =
      sourceEdgeIndex === null || sourcePolygon.length === 0
        ? { x: 0, y: 1, z: 0 }
        : edgeOutwardVector(sourcePolygon, sourceEdgeIndex);
    const localFrame: DatumFrame3 = {
      origin: gutterLine.start,
      xAxis,
      yAxis,
      zAxis: WORLD_Z,
    };
    const gutterBoundaryTopZ = boundary?.[0]?.z;
    const renderMesh =
      boundary && typeof gutterBoundaryTopZ === 'number' && Number.isFinite(gutterBoundaryTopZ)
        ? buildVerticalPrismRenderMesh(
          boundary,
          gutterBoundaryTopZ - input.gutterDepthMm,
          gutterBoundaryTopZ,
        )
        : undefined;
    linearSolids.push({
      id: `house-solid-gutter-${linearSolids.length + 1}`,
      kind: 'gutter',
      centerline: gutterLine,
      localFrame,
      profileWidthMm: input.gutterWidthMm,
      profileDepthMm: input.gutterDepthMm,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-gutter-line-${index + 1}`,
        sourceEdgeId: gutter.sourceEdgeId,
        houseRoofEdgeKind: gutter.edgeKind,
        houseRoofPerimeterRole: gutter.edgeKind,
        flashingRole: gutter.flashingRole ?? null,
        sourceRoofPlaneId: gutter.sourceRoofPlaneId ?? null,
      },
    });
  }

  return { surfaceSolids, linearSolids };
}

function findAttachmentWallSegment(
  wallSegments: HouseWallSegment3D[],
  attachmentEdge: Line3 | null,
): HouseWallSegment3D | null {
  if (!wallSegments.length) return null;
  if (!attachmentEdge) return wallSegments[0] ?? null;

  const attachmentMidpoint = midpoint2(attachmentEdge);
  return wallSegments.reduce<HouseWallSegment3D | null>((selected, candidate) => {
    if (!selected) return candidate;

    const candidateDistance = distanceSquared2(midpoint2(candidate.line), attachmentMidpoint);
    const selectedDistance = distanceSquared2(midpoint2(selected.line), attachmentMidpoint);
    if (candidateDistance < selectedDistance) return candidate;
    if (Math.abs(candidateDistance - selectedDistance) <= 1e-6 && lineLength(candidate.line) > lineLength(selected.line)) {
      return candidate;
    }
    return selected;
  }, null);
}

function clampLineZ(input: { source: Line3; bottomZ: number; topZ: number }): Line3 {
  return {
    start: {
      ...input.source.start,
      z: clamp(input.source.start.z, input.bottomZ, input.topZ),
    },
    end: {
      ...input.source.end,
      z: clamp(input.source.end.z, input.bottomZ, input.topZ),
    },
  };
}

type AttachmentWallProjection = {
  line: Line3 | null;
  wallOrientedLine: Line3 | null;
  metadata?: {
    attachmentSpanStatus: 'no_overlap';
  };
};

function interpolateAttachmentZ(attachmentEdge: Line3, rawStartT: number, rawEndT: number, targetT: number): number {
  const range = rawEndT - rawStartT;
  if (Math.abs(range) <= 1e-6) {
    return (attachmentEdge.start.z + attachmentEdge.end.z) / 2;
  }
  const ratio = (targetT - rawStartT) / range;
  return attachmentEdge.start.z + (attachmentEdge.end.z - attachmentEdge.start.z) * ratio;
}

function projectAttachmentEdgeToWallSegment(
  attachmentEdge: Line3 | null,
  sourceWall: HouseWallSegment3D | null,
): AttachmentWallProjection {
  if (!attachmentEdge || !sourceWall) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const wallLengthMm = lineLength(sourceWall.line);
  if (wallLengthMm <= 1e-6) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const wallUnit = {
    x: (sourceWall.line.end.x - sourceWall.line.start.x) / wallLengthMm,
    y: (sourceWall.line.end.y - sourceWall.line.start.y) / wallLengthMm,
  };
  const projectToWallT = (candidate: Point3): number =>
    (candidate.x - sourceWall.line.start.x) * wallUnit.x +
    (candidate.y - sourceWall.line.start.y) * wallUnit.y;
  const pointAtT = (t: number): Point3 => ({
    x: sourceWall.line.start.x + wallUnit.x * t,
    y: sourceWall.line.start.y + wallUnit.y * t,
    z: interpolateAttachmentZ(attachmentEdge, rawStartT, rawEndT, t),
  });

  const rawStartT = projectToWallT(attachmentEdge.start);
  const rawEndT = projectToWallT(attachmentEdge.end);
  const rawMinT = Math.min(rawStartT, rawEndT);
  const rawMaxT = Math.max(rawStartT, rawEndT);
  const overlapMinT = Math.max(0, rawMinT);
  const overlapMaxT = Math.min(wallLengthMm, rawMaxT);
  if (overlapMaxT - overlapMinT <= 1e-6) {
    return {
      line: null,
      wallOrientedLine: null,
      metadata: { attachmentSpanStatus: 'no_overlap' },
    };
  }

  const orderedStartT = rawStartT <= rawEndT ? overlapMinT : overlapMaxT;
  const orderedEndT = rawStartT <= rawEndT ? overlapMaxT : overlapMinT;
  return {
    line: line(pointAtT(orderedStartT), pointAtT(orderedEndT)),
    wallOrientedLine: line(pointAtT(overlapMinT), pointAtT(overlapMaxT)),
  };
}

function buildZoneBoundary(sourceLine: Line3 | null, bottomZ: number, topZ: number): Polygon3 | null {
  if (!sourceLine) return null;
  return [
    point(sourceLine.start.x, sourceLine.start.y, bottomZ),
    point(sourceLine.end.x, sourceLine.end.y, bottomZ),
    point(sourceLine.end.x, sourceLine.end.y, topZ),
    point(sourceLine.start.x, sourceLine.start.y, topZ),
  ];
}

function resolveStrategy(config: GeometryConfig): HouseAttachmentStrategy {
  return config.houseContext.attachmentStrategy ?? config.houseContext.model?.attachmentStrategy ?? 'none';
}

function averageAttachmentZ(attachmentEdge: Line3 | null, config: GeometryConfig): number {
  if (attachmentEdge) {
    return (attachmentEdge.start.z + attachmentEdge.end.z) / 2;
  }
  return (
    config.structural.heights.referenceUndersideMm ??
    config.structural.heights.houseUndersideMm ??
    DEFAULT_EAVE_HEIGHT_MM
  );
}

function buildSemanticHouseAttachmentEdge(config: GeometryConfig, attachmentEdge: Line3 | null): Line3 | null {
  if (!attachmentEdge || config.connection.type === 'freestanding') return null;

  const z = averageAttachmentZ(attachmentEdge, config);
  return buildHouseSideAttachmentLine({
    attachmentSide: config.connection.attachmentSide,
    pergolaWidthMm: config.dimensions.lengthMm,
    pergolaDepthMm: config.dimensions.projectionMm,
    zMm: z,
  });
}

function buildAttachmentTarget(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
  wallSegments: HouseWallSegment3D[];
  eaveHeightMm: number;
  fasciaHeightMm: number;
}): HouseAttachmentTarget3D {
  const strategy = resolveStrategy(input.config);
  const sourceWall = findAttachmentWallSegment(input.wallSegments, input.attachmentEdge);
  const sourceEdgeId = sourceWall?.sourceEdgeId ?? sourceWall?.id ?? null;
  const targetProjection = projectAttachmentEdgeToWallSegment(input.attachmentEdge, sourceWall);
  const targetLine = targetProjection.line;
  const targetWallOrientedLine = targetProjection.wallOrientedLine;
  const targetMetadata = targetProjection.metadata;

  if (strategy === 'none') {
    return {
      kind: 'none',
      strategy,
      sourceEdgeId,
    };
  }

  if (strategy === 'soffit_brackets') {
    return {
      kind: 'line',
      strategy,
      line: targetLine,
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  if (strategy === 'fascia_under_gutter') {
    const topZMm = input.eaveHeightMm;
    const bottomZMm = input.eaveHeightMm - input.fasciaHeightMm;
    const safeLine = targetLine ? clampLineZ({ source: targetLine, bottomZ: bottomZMm, topZ: topZMm }) : null;
    return {
      kind: 'zone',
      strategy,
      line: safeLine,
      zone: {
        plane: sourceWall?.plane ?? planeFromOriginAxes(input.config.datum.origin, input.config.datum.xAxis, input.config.datum.zAxis),
        topZMm,
        bottomZMm,
        boundary: buildZoneBoundary(targetWallOrientedLine, bottomZMm, topZMm),
        safeLine,
      },
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  if (strategy === 'facade_ledger') {
    return {
      kind: 'plane',
      strategy,
      line: targetLine,
      plane: sourceWall?.plane ?? null,
      sourceEdgeId,
      metadata: targetMetadata,
    };
  }

  return {
    kind: 'metadata_only',
    strategy,
    sourceEdgeId,
    metadata: {
      tieback: true,
    },
  };
}

function sourceEdgeIndexFromId(sourceEdgeId: string | null | undefined, footprintLength: number): number | null {
  if (!sourceEdgeId) return null;
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < footprintLength ? index : null;
}

function buildAttachmentAwareMonoEavePolygon(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  attachmentSourceEdgeId?: string | null;
}): Polygon3 {
  if (input.roofForm !== 'mono') return input.eavePolygon;
  if (input.eavePolygon.length !== input.footprint.length) return input.eavePolygon;

  const sourceEdgeIndex = sourceEdgeIndexFromId(
    input.attachmentSourceEdgeId,
    input.footprint.length,
  );
  if (sourceEdgeIndex === null) return input.eavePolygon;

  const nextIndex = (sourceEdgeIndex + 1) % input.footprint.length;
  return input.eavePolygon.map((candidate, index) => {
    if (index === sourceEdgeIndex || index === nextIndex) {
      const footprintPoint = input.footprint[index]!;
      return point(footprintPoint.x, footprintPoint.y, candidate.z);
    }
    return candidate;
  });
}

export function buildHouseModel3D(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseModel3D | null {
  if (input.config.connection.type === 'freestanding') return null;

  const model = input.config.houseContext.model;
  const footprint = model?.footprint;
  if (!footprint || footprint.length < 3) return null;

  const eaveHeightMm = finiteNumber(
    model.eaveHeightMm,
    input.config.structural.heights.referenceUndersideMm ??
      input.config.structural.heights.houseUndersideMm ??
      DEFAULT_EAVE_HEIGHT_MM,
  );
  const wallHeightMm = finiteNumber(model.wallHeightMm, eaveHeightMm);
  const roofForm = model.roofForm ?? 'hipped';
  const roofPitchDeg = normalizeHouseRoofPitchDegForForm({
    roofForm,
    pitchDeg: finiteNumber(model.roofPitchDeg, DEFAULT_ROOF_PITCH_DEG),
    fallbackPitchDeg: DEFAULT_ROOF_PITCH_DEG,
  });
  const soffitDepthMm = positiveNumber(model.eave?.soffitDepthMm, DEFAULT_SOFFIT_DEPTH_MM);
  const fasciaHeightMm = positiveNumber(model.eave?.fasciaHeightMm, DEFAULT_FASCIA_HEIGHT_MM);
  const gutterWidthMm = positiveNumber(model.eave?.gutterWidthMm, DEFAULT_GUTTER_WIDTH_MM);
  const gutterDepthMm = positiveNumber(model.eave?.gutterDepthMm, DEFAULT_GUTTER_DEPTH_MM);
  const gutterProjectionMm = positiveNumber(model.eave?.gutterProjectionMm, DEFAULT_GUTTER_PROJECTION_MM);
  const eaveOverhangMm = positiveNumber(model.eave?.eaveOverhangMm, DEFAULT_EAVE_OVERHANG_MM);
  const roofMaterial = model.roofMaterial ?? DEFAULT_HOUSE_ROOF_MATERIAL;
  const roofPrimaryFallDirection = model.roofPrimaryFallDirection ?? 'positive_y';
  const roofRidgeAxis = model.roofRidgeAxis ?? 'x';
  const semanticAttachmentEdge = buildSemanticHouseAttachmentEdge(input.config, input.attachmentEdge);
  const preliminaryWallSegments = buildWallSegments(footprint, wallHeightMm, null);
  const preliminaryAttachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: preliminaryWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  const appendageJoinSourceEdgeId =
    preliminaryAttachmentTarget.kind === 'zone' && preliminaryAttachmentTarget.line
      ? preliminaryAttachmentTarget.sourceEdgeId ?? null
      : null;
  const wallBox = boundingBox(footprint);
  const baseEavePolygon =
    offsetFootprintPolygon(footprint, eaveOverhangMm) ?? [
      point(wallBox.minX - eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
      point(wallBox.minX - eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
    ];
  const eavePolygon = buildAttachmentAwareMonoEavePolygon({
    footprint,
    eavePolygon: baseEavePolygon,
    roofForm,
    attachmentSourceEdgeId: appendageJoinSourceEdgeId,
  });
  const roof = buildSharedHouseRoof({
    sourceFootprint: footprint,
    eavePolygon,
    eaveHeightMm,
    roofPitchDeg,
    roofForm,
    roofPrimaryFallDirection,
    roofRidgeAxis,
    roofAppendage: model.roofAppendage ?? null,
    attachmentSourceEdgeId: appendageJoinSourceEdgeId,
  });
  const wallSegments = buildWallSegments(footprint, wallHeightMm, roof);
  const availableTerminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint,
    ridgeAxis: roofRidgeAxis,
  });
  const openTerminalEndIds = new Set(
    roofForm === 'gable' && roof.metadata.roofQaStatus === 'valid'
      ? (model.openGableEndIds ?? []).filter((id) =>
          availableTerminalEnds.some((terminalEnd) => terminalEnd.id === id),
        )
      : [],
  );
  const terminalEndBySourceEdgeId = new Map(
    availableTerminalEnds.map((terminalEnd) => [terminalEnd.sourceEdgeId, terminalEnd]),
  );
  const displayWallSegments = wallSegments.map((segment) => {
    const terminalEnd = segment.sourceEdgeId
      ? terminalEndBySourceEdgeId.get(segment.sourceEdgeId)
      : null;
    if (!terminalEnd || !openTerminalEndIds.has(terminalEnd.id)) return segment;
    return {
      ...segment,
      metadata: {
        ...segment.metadata,
        houseWallMode: 'open_gable_frame',
        gableEndId: terminalEnd.id,
      },
    };
  });
  const frameFeatures = buildOpenGableFrameFeatures({
    wallSegments: displayWallSegments,
    openTerminalEnds: availableTerminalEnds.filter((terminalEnd) =>
      openTerminalEndIds.has(terminalEnd.id),
    ),
    roofGeometry:
      typeof roof.metadata.roofGeometry === 'string' ? roof.metadata.roofGeometry : null,
  });
  const displayRoofFeatures = [...roof.roofFeatures, ...frameFeatures];
  const attachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: displayWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint,
    eavePolygon,
    roofForm,
    roofPlanes: roof.roofPlanes,
    eaveHeightMm,
    joinSourceEdgeId: attachmentTarget.sourceEdgeId ?? null,
  });
  const appendagePerimeterEdges = buildAppendagePerimeterEdges({
    roofPlanes: roof.roofPlanes,
  });
  const allPerimeterEdges = [...perimeterEdges, ...appendagePerimeterEdges];
  const gutterLines = buildPolygonGutterLines({ perimeterEdges: allPerimeterEdges });
  const gutterBoundaries = buildPolygonGutterBoundaries({
    perimeterEdges: allPerimeterEdges,
    gutterWidthMm,
    gutterProjectionMm,
  });
  const fasciaPolygons = buildPolygonFasciaPolygons({
    perimeterEdges: allPerimeterEdges,
    fasciaHeightMm,
  });
  const soffitPolygons = buildPolygonSoffitPolygons({
    perimeterEdges: allPerimeterEdges,
    roofForm,
    roofPlanes: roof.roofPlanes,
  });
  const roofPlanesForSolids = roof.metadata.roofQaStatus === 'valid' ? roof.roofPlanes : [];
  const roofFlashings =
    roof.metadata.roofQaStatus === 'valid'
      ? [
          ...buildHouseRoofFeatureFlashings({
            roofPlanes: roof.roofPlanes,
            roofFeatures: roof.roofFeatures,
          }),
          ...buildPerimeterFlashings({
            perimeterEdges: allPerimeterEdges,
            roofPlanes: roof.roofPlanes,
            attachmentTarget,
          }),
        ]
      : [];
  const roofMaterialVisuals =
    roof.metadata.roofQaStatus === 'valid'
      ? buildHouseRoofMaterialVisuals({
          roofPlanes: roof.roofPlanes,
          material: roofMaterial,
        })
      : [];
  const decks = buildHouseDecks({
    decks:
      (model.decks ?? [])
        .flatMap((deck) => {
          if (!deck) return [];
          const boundary = resolveHouseDeckBoundary({
            deck,
            footprint,
            wallSegments: displayWallSegments,
          });
          if (!boundary?.length) return [];
          return [{
            id: deck.id,
            name: deck.name ?? null,
            kind: deck.kind ?? 'deck',
            shape: deck.shape ?? 'preset',
            presetType: deck.presetType ?? null,
            presetRect: deck.presetRect ?? null,
            boundary,
            plane: planeFromOriginAxes(point(0, 0, 0), { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
            topSurfaceElevationMm:
              finiteNumber(deck.topSurfaceElevationMm, finiteNumber(deck.levelOffsetMm, 0)),
            elevationMode: deck.elevationMode ?? 'ground',
            hostEdgeId: deck.hostEdgeId ?? null,
            isAttached: Boolean(deck.isAttached),
            surfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
            supportClassification: deck.supportContext?.classification ?? 'mixed_or_unclear',
            metadata: {
              deckName: deck.name ?? deck.id,
              deckKind: deck.kind ?? 'deck',
              deckShape: deck.shape ?? 'preset',
              deckPresetType: deck.presetType ?? null,
              deckPresetRectWidthMm: deck.presetRect?.widthMm ?? null,
              deckPresetRectDepthMm: deck.presetRect?.depthMm ?? null,
              deckPresetRectCenterOffsetMm: deck.presetRect?.centerOffsetMm ?? null,
              deckPresetRectDetachedGapMm: deck.presetRect?.detachedGapMm ?? null,
              deckElevationMode: deck.elevationMode ?? 'ground',
              deckHostEdgeId: deck.hostEdgeId ?? null,
              deckIsAttached: Boolean(deck.isAttached),
              deckSurfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
              deckSupportClassification: deck.supportContext?.classification ?? 'mixed_or_unclear',
              deckNearestHouseEdgeId: deck.supportContext?.nearestHouseEdgeId ?? null,
              deckNearestHouseEdgeDistanceMm: deck.supportContext?.nearestHouseEdgeDistanceMm ?? null,
              deckAttachmentContactLengthMm: deck.supportContext?.attachmentContactLengthMm ?? null,
              deckSupportWarnings: deck.supportContext?.warningCodes?.join(',') ?? null,
              deckValidationStatus: deck.validation?.status ?? 'valid',
              deckValidationCodes: deck.validation?.codes?.join(',') ?? null,
            },
          }];
        }) ?? [],
  });
  const openings = buildHouseOpenings({
    openings:
      (model.openings ?? []).map((opening) => ({
        id: opening.id,
        label: opening.label ?? null,
        kind: opening.kind ?? 'window',
        wallId: opening.wallId ?? 'rear',
        hostEdgeId: opening.hostEdgeId ?? null,
        widthMm: finiteNumber(opening.widthMm, 0),
        heightMm: finiteNumber(opening.heightMm, 0),
        sillHeightMm: finiteNumber(opening.sillHeightMm, 0),
        offsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
        panelCount:
          opening.kind === 'slider'
            ? opening.panelCount === 3 || opening.panelCount === 4
              ? opening.panelCount
              : 2
            : null,
        validationStatus: opening.validation?.status === 'invalid' ? 'invalid' : 'valid',
        validationCodes: opening.validation?.codes ?? [],
        validationMessage: opening.validation?.message ?? null,
        metadata: {
          openingLabel: opening.label ?? opening.id,
          openingKind: opening.kind ?? 'window',
          openingPanelCount:
            opening.kind === 'slider'
              ? opening.panelCount === 3 || opening.panelCount === 4
                ? opening.panelCount
                : 2
              : null,
          openingWallId: opening.wallId ?? 'rear',
          openingHostEdgeId: opening.hostEdgeId ?? null,
          openingWidthMm: finiteNumber(opening.widthMm, 0),
          openingHeightMm: finiteNumber(opening.heightMm, 0),
          openingSillHeightMm: finiteNumber(opening.sillHeightMm, 0),
          openingOffsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
          openingValidationStatus: opening.validation?.status ?? 'valid',
          openingValidationCodes: opening.validation?.codes?.join(',') ?? null,
          openingValidationMessage: opening.validation?.message ?? null,
        },
      })) ?? [],
  });

  return {
    footprint,
    wallSegments: displayWallSegments,
    roofPlanes: roof.roofPlanes,
    roofFeatures: displayRoofFeatures,
    roofFlashings,
    roofMaterial,
    roofMaterialVisuals,
    decks,
    openings,
    solids: buildHouseEnvelopeSolids({
      wallSegments: displayWallSegments,
      roofPlanes: roofPlanesForSolids,
      roofForm,
      decks,
      perimeterEdges: allPerimeterEdges,
      soffitPolygons,
      fasciaPolygons,
      gutterLines,
      gutterBoundaries,
      gutterWidthMm,
      gutterDepthMm,
    }),
    eave: {
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
      gutterLines: gutterLines.map((candidate) => candidate.line),
      gutterBoundaries: gutterBoundaries.map((candidate) => candidate.boundary),
      fasciaPolygons: fasciaPolygons.map((candidate) => candidate.boundary),
      soffitPolygons: soffitPolygons.map((candidate) => candidate.boundary),
      metadata: roof.metadata,
    },
    attachmentTarget,
    metadata: {
      roofForm,
      roofMaterial,
      openGableEndIds: [...openTerminalEndIds].join(','),
      storeyMode: model.storeyMode ?? 'single_storey',
      wallConstruction: model.wallConstruction ?? 'timber_frame',
      attachmentStrategy: attachmentTarget.strategy,
      ...roof.metadata,
    },
  };
}

export function buildHouseReferenceGeometry(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseReferenceGeometry {
  if (input.config.connection.type === 'freestanding') {
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: input.config.houseContext.footprint ?? null,
      model: null,
      attachmentTarget: null,
    };
  }

  const wallPlane: Plane3 = planeFromOriginAxes(
    input.config.datum.origin,
    input.config.datum.xAxis,
    input.config.datum.zAxis,
  );
  const model = buildHouseModel3D(input);

  return {
    wallPlane: {
      ...wallPlane,
      normal: { x: 0, y: -1, z: 0 },
    },
    fasciaLine: input.config.connection.type === 'fascia' ? input.attachmentEdge : null,
    roofEdgeLine: input.attachmentEdge,
    soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
    footprint: input.config.houseContext.footprint ?? null,
    model,
    attachmentTarget: model?.attachmentTarget ?? null,
  };
}
