import type { GeometryMetadata, HouseRoofFeature3D, Point3, Polygon3, RoofPlane3D } from '../contracts';
import { lineLength } from '../math3d';
import { RIDGE_COLLAPSE_EPSILON_MM, ROOF_JOIN_EPSILON_MM } from './constants';
import {
  line,
  point,
  signedAreaXY,
  type JoinedRoofFacet,
  type RoofPoint2,
} from './_internal';
import { cleanRoofPolygon2D, point2FromPoint3, roofPoint2Key } from './roof2D';
import { buildRoofPlane } from './roofPlane';
import { buildJoinedRoofFacets, buildJoinedRoofFeatures } from './roofJoinedFacets';
import { buildJoinedRoofEdges } from './roofJoinedRegions';

export function buildJoinedRectilinearHippedRoof(input: {
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

export function ridgeGraphTerminalNodes(features: HouseRoofFeature3D[]): Array<{
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

export function roofFeaturesAreAxisAligned(features: HouseRoofFeature3D[]): boolean {
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

export function edgeLiesOnConvexHull(input: {
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

export function outwardNormalForEdge(input: {
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
