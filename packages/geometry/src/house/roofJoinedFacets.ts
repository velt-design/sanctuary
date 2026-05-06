import type { HouseRoofFeature3D, HouseRoofFeatureKind, HouseRoofForm, Line3, Point3, Polygon3 } from '../contracts';
import { lineLength } from '../math3d';
import { ROOF_JOIN_EPSILON_MM, ROOF_JOIN_FEATURE_MIN_LENGTH_MM } from './constants';
import {
  line,
  point,
  vertexFeatureKind,
  type JoinedRoofEdge,
  type JoinedRoofFacet,
  type JoinedRoofFacetBuildResult,
  type JoinedRoofFeatureDraft,
  type JoinedRoofRegion,
} from './_internal';
import {
  canonicalRoofSegmentKey,
  cleanRoofPolygon2D,
  compareRoofPoints,
  orientRoofFeatureLine,
  point2FromPoint3,
  roofPointOnEaveBoundaryAtWrongHeight,
  roofSegmentOverlapLength2D,
  segmentInsideRoofPolygon,
} from './roof2D';
import { mergeAssignedRoofRegions, sortJoinedRoofRegions, validateJoinedRoofRegionFootprint } from './roofJoinedDissolve';
import { assignRoofRegion, buildRectilinearRoofBaseRegions, roofHeightFromEdge, splitRoofRegionsByPlaneIntersections } from './roofJoinedRegions';
import { buildJoinedRoofWavefrontRegions } from './roofJoinedWavefront';

export function buildJoinedRoofFacetFromRegion(input: {
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

export function buildJoinedRoofFacets(input: {
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

export function countJoinedRoofInternalEaveHeightSegments(input: {
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

export function buildJoinedRoofFeatures(input: {
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
