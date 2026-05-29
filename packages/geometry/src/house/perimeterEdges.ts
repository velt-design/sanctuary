import type { HouseRoofForm, Line3, Point3, Polygon3, RoofPlane3D } from '../contracts';
import { dotProduct, lineLength, normalizeVector, subtractPoints } from '../math3d';
import { ROOF_JOIN_EPSILON_MM, ROOF_JOIN_FEATURE_MIN_LENGTH_MM } from './constants';
import {
  edgeOutwardVector,
  finiteVectorLength,
  line,
  point,
  type HouseRoofPerimeterEdge,
  type HouseRoofPerimeterEdgeKind,
} from './_internal';
import { roofPlaneEquationHeightAtXY, roofSolidPlaneEquationFromPlane } from './roofPlane';

const DRAIN_EDGE_MIN_PROJECTION = 0.25;
const DRAIN_EDGE_LOW_Z_TOLERANCE_MM = 1;

function pointOnSegment2D(candidate: Point3, start: Point3, end: Point3, toleranceMm = 1e-3): boolean {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const offset = { x: candidate.x - start.x, y: candidate.y - start.y };
  const segmentLengthSq = segment.x * segment.x + segment.y * segment.y;
  if (segmentLengthSq <= toleranceMm * toleranceMm) return false;
  const cross = segment.x * offset.y - segment.y * offset.x;
  if (Math.abs(cross) > toleranceMm * Math.sqrt(segmentLengthSq)) return false;
  const projection = offset.x * segment.x + offset.y * segment.y;
  return projection >= -toleranceMm && projection <= segmentLengthSq + toleranceMm;
}

export function roofPlanePerimeterOverlapSegment(
  roofPlane: RoofPlane3D,
  edge: HouseRoofPerimeterEdge,
): Line3 | null {
  const edgeDirection = normalizeVector(subtractPoints(edge.roofEnd, edge.roofStart));
  for (let index = 0; index < roofPlane.boundary.length; index += 1) {
    const start = roofPlane.boundary[index]!;
    const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
    if (!pointOnSegment2D(start, edge.roofStart, edge.roofEnd)) continue;
    if (!pointOnSegment2D(end, edge.roofStart, edge.roofEnd)) continue;
    if (lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
    const segmentDirection = normalizeVector(subtractPoints(end, start));
    return dotProduct(segmentDirection, edgeDirection) >= 0
      ? line(start, end)
      : line(end, start);
  }
  return null;
}

export function roofPlaneTouchesPerimeterEdge(roofPlane: RoofPlane3D, edge: HouseRoofPerimeterEdge): boolean {
  return roofPlanePerimeterOverlapSegment(roofPlane, edge) !== null;
}

function edgeDrainProjection(edge: HouseRoofPerimeterEdge, roofPlane: RoofPlane3D): number {
  const outward = edgeOutwardVector(edge.perimeterPolygon, edge.index);
  const fallAxisXY = normalizeVector({
    x: roofPlane.fallVector.x,
    y: roofPlane.fallVector.y,
    z: 0,
  });
  if (finiteVectorLength(fallAxisXY) <= ROOF_JOIN_EPSILON_MM) return Number.NEGATIVE_INFINITY;
  return dotProduct(fallAxisXY, outward);
}

function roofPlaneBoundaryMinZ(roofPlane: RoofPlane3D): number {
  return roofPlane.boundary.reduce((selected, candidate) => Math.min(selected, candidate.z), Number.POSITIVE_INFINITY);
}

function roofPlaneOverlapIsLowDrainEdge(
  edge: HouseRoofPerimeterEdge,
  roofPlane: RoofPlane3D,
  overlapSegment: Line3,
): boolean {
  const drainProjection = edgeDrainProjection(edge, roofPlane);
  if (drainProjection < DRAIN_EDGE_MIN_PROJECTION) return false;
  const minBoundaryZ = roofPlaneBoundaryMinZ(roofPlane);
  return (
    Math.abs(overlapSegment.start.z - minBoundaryZ) <= DRAIN_EDGE_LOW_Z_TOLERANCE_MM &&
    Math.abs(overlapSegment.end.z - minBoundaryZ) <= DRAIN_EDGE_LOW_Z_TOLERANCE_MM
  );
}

export function classifyHousePerimeterEdges(input: {
  edges: HouseRoofPerimeterEdge[];
  joinSourceEdgeId?: string | null;
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
}): HouseRoofPerimeterEdge[] {
  return input.edges.map((edge) => {
    const adjacentRoofPlanes = input.roofPlanes.flatMap((roofPlane) => {
      const overlapSegment = roofPlanePerimeterOverlapSegment(roofPlane, edge);
      if (!overlapSegment) return [];
      const drainProjection = edgeDrainProjection(edge, roofPlane);
      return [{
        roofPlane,
        overlapSegment,
        drainProjection,
        lowDrainEdge: roofPlaneOverlapIsLowDrainEdge(edge, roofPlane, overlapSegment),
      }];
    });
    const drainingAdjacentRoofPlanes = adjacentRoofPlanes.filter((candidate) => candidate.lowDrainEdge);
    const primaryAdjacentRoofPlane =
      (drainingAdjacentRoofPlanes.length > 0 ? drainingAdjacentRoofPlanes : adjacentRoofPlanes).length === 0
        ? null
        : (drainingAdjacentRoofPlanes.length > 0 ? drainingAdjacentRoofPlanes : adjacentRoofPlanes).reduce<{
            roofPlane: RoofPlane3D;
            drainProjection: number;
          } | null>((selected, candidate) => {
            if (!selected) return candidate;
            if (drainingAdjacentRoofPlanes.length > 0) {
              return candidate.drainProjection > selected.drainProjection ? candidate : selected;
            }
            return Math.abs(candidate.drainProjection) > Math.abs(selected.drainProjection)
              ? candidate
              : selected;
          }, null);
    const maxDrainProjection = adjacentRoofPlanes.reduce(
      (selected, candidate) => Math.max(selected, candidate.drainProjection),
      Number.NEGATIVE_INFINITY,
    );
    const minDrainProjection = adjacentRoofPlanes.reduce(
      (selected, candidate) => Math.min(selected, candidate.drainProjection),
      Number.POSITIVE_INFINITY,
    );

    if (edge.sourceEdgeId === input.joinSourceEdgeId) {
      return {
        ...edge,
        edgeKind: 'house_apron_edge',
        sourceRoofPlaneId: primaryAdjacentRoofPlane?.roofPlane.id ?? edge.sourceRoofPlaneId ?? null,
        flashingRole: 'house_apron',
      };
    }
    if (drainingAdjacentRoofPlanes.length > 0) {
      return {
        ...edge,
        edgeKind: 'drain_eave',
        sourceRoofPlaneId: primaryAdjacentRoofPlane?.roofPlane.id ?? edge.sourceRoofPlaneId ?? null,
        flashingRole: null,
      };
    }
    return {
      ...edge,
      edgeKind: 'weather_flashed_edge',
      sourceRoofPlaneId: primaryAdjacentRoofPlane?.roofPlane.id ?? edge.sourceRoofPlaneId ?? null,
      flashingRole:
        input.roofForm === 'mono' && minDrainProjection <= -DRAIN_EDGE_MIN_PROJECTION
          ? 'high_side'
          : 'rake',
    };
  });
}

export function buildHouseRoofPerimeterEdges(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  roofPlanes: RoofPlane3D[];
  eaveHeightMm: number;
  joinSourceEdgeId?: string | null;
}): HouseRoofPerimeterEdge[] {
  if (input.footprint.length !== input.eavePolygon.length) return [];

  const monoRoofPlane = input.roofForm === 'mono' && input.roofPlanes.length > 0 ? input.roofPlanes[0]! : null;
  const monoRoofPlaneEquation = monoRoofPlane
    ? roofSolidPlaneEquationFromPlane(monoRoofPlane.plane)
    : null;
  const baseEdges = input.footprint.map((wallStart, index) => {
    const wallEnd = input.footprint[(index + 1) % input.footprint.length]!;
    const eaveStartXY = input.eavePolygon[index]!;
    const eaveEndXY = input.eavePolygon[(index + 1) % input.eavePolygon.length]!;
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const roofStartZ =
      monoRoofPlaneEquation
        ? roofPlaneEquationHeightAtXY(monoRoofPlaneEquation, eaveStartXY.x, eaveStartXY.y) ?? input.eaveHeightMm
        : input.eaveHeightMm;
    const roofEndZ =
      monoRoofPlaneEquation
        ? roofPlaneEquationHeightAtXY(monoRoofPlaneEquation, eaveEndXY.x, eaveEndXY.y) ?? input.eaveHeightMm
        : input.eaveHeightMm;
    const roofStart = point(eaveStartXY.x, eaveStartXY.y, roofStartZ);
    const roofEnd = point(eaveEndXY.x, eaveEndXY.y, roofEndZ);

    return {
      index,
      sourceEdgeId,
      edgeKind: 'drain_eave' as HouseRoofPerimeterEdgeKind,
      perimeterId: 'house-main-roof',
      perimeterPolygon: input.eavePolygon,
      wallStart,
      wallEnd,
      eaveStart: roofStart,
      eaveEnd: roofEnd,
      roofStart,
      roofEnd,
      sourceRoofPlaneId: monoRoofPlane?.id ?? null,
      flashingRole: null,
    };
  });

  return classifyHousePerimeterEdges({
    edges: baseEdges,
    joinSourceEdgeId: input.joinSourceEdgeId ?? null,
    roofForm: input.roofForm,
    roofPlanes: input.roofPlanes,
  });
}

// PR-T8 (2026-05-29): `buildMonoAppendagePerimeterEdges` and
// `buildAppendagePerimeterEdges` removed alongside the appendage
// feature. The latter filtered roof planes by
// `roofGeometry === 'appendage_band'` metadata; no roof plane carries
// that metadata anymore, so the call became a permanent no-op before
// removal. The former was only called from inside the no-op filter.
