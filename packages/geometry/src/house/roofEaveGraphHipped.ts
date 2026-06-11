import type { GeometryMetadata, HouseRoofFeature3D, HouseRoofFeatureKind, Polygon3, RoofPlane3D } from '../contracts';
import { lineLength } from '../math3d';
import { RIDGE_COLLAPSE_EPSILON_MM, ROOF_JOIN_FEATURE_MIN_LENGTH_MM } from './constants';
import { line, point, signedAreaXY, vertexFeatureKind, type JoinedRoofEdge, type JoinedRoofFacet } from './_internal';
import { buildRoofPlane } from './roofPlane';
import {
  buildJoinedRoofFacetFromRegion,
  buildJoinedRoofFacets,
  buildJoinedRoofFeatures,
  countJoinedRoofInternalEaveHeightSegments,
} from './roofJoinedFacets';
import { mergeAssignedRoofRegions } from './roofJoinedDissolve';
import {
  assignRoofRegion,
  buildJoinedRoofEdges,
  buildRectilinearRoofBaseRegions,
  roofHeightFromEdge,
  splitRoofRegionsByPlaneIntersections,
} from './roofJoinedRegions';
import {
  canonicalRoofSegmentKey,
  cleanRoofPolygon2D,
  clipRoofPolygonByScalar,
  compareRoofPoints,
  orientRoofFeatureLine,
  point2FromPoint3,
  roofPolygonArea,
  roofPolygonIsSimple,
  roofRegionInsideEave,
  roofSegmentOverlapLength2D,
} from './roof2D';

function findEaveVertexIndex(candidate: { x: number; y: number; z: number }, eavePolygon: Polygon3, eaveHeightMm: number): number | null {
  if (Math.abs(candidate.z - eaveHeightMm) > 1) return null;
  for (let index = 0; index < eavePolygon.length; index += 1) {
    const vertex = eavePolygon[index]!;
    if (Math.hypot(candidate.x - vertex.x, candidate.y - vertex.y) <= 1) return index;
  }
  return null;
}

function classifySourceEdgeEnvelopeFeature(input: {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
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

function buildSourceEdgeEnvelopeFeatures(input: {
  facets: JoinedRoofFacet[];
  edges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): HouseRoofFeature3D[] {
  const segments = new Map<
    string,
    {
      start: { x: number; y: number; z: number };
      end: { x: number; y: number; z: number };
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

  const drafts: {
    kind: HouseRoofFeatureKind;
    line: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } };
    sourceEdgeIds: string[];
  }[] = [];
  const seen = new Set<string>();
  for (const segment of segments.values()) {
    if (segment.count < 2 || segment.sourceEdgeIndexes.size < 2) continue;
    const featureLine = orientRoofFeatureLine(segment.start, segment.end, input.eaveHeightMm);
    const featureKey = canonicalRoofSegmentKey(featureLine.start, featureLine.end);
    if (seen.has(featureKey)) continue;
    seen.add(featureKey);
    const sourceEdges = [...segment.sourceEdgeIndexes]
      .map((index) => input.edges.find((edge) => edge.index === index))
      .filter((edge): edge is JoinedRoofEdge => Boolean(edge));
    drafts.push({
      kind: classifySourceEdgeEnvelopeFeature({
        start: featureLine.start,
        end: featureLine.end,
        sourceEdges,
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      line: featureLine,
      sourceEdgeIds: sourceEdges.map((edge) => edge.id).sort(),
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
        roofForm: 'hipped',
        footprintFollowing: true,
        roofGeometry: 'rectilinear_joined_hipped',
        sourceEdgeIds: draft.sourceEdgeIds.join(','),
        roofFeatureSource: 'facet_adjacency',
      },
    };
  });
}

function sourceEdgeEaveContactLength(input: {
  footprint: ReturnType<typeof cleanRoofPolygon2D>;
  edge: JoinedRoofEdge;
}): number {
  let contactLength = 0;
  const edgeStart = point2FromPoint3(input.edge.start);
  const edgeEnd = point2FromPoint3(input.edge.end);
  for (let index = 0; index < input.footprint.length; index += 1) {
    contactLength += roofSegmentOverlapLength2D(
      input.footprint[index]!,
      input.footprint[(index + 1) % input.footprint.length]!,
      edgeStart,
      edgeEnd,
    );
  }
  return contactLength;
}

function segmentOnEaveBoundary(input: {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): boolean {
  if (Math.abs(input.start.z - input.eaveHeightMm) > 1 || Math.abs(input.end.z - input.eaveHeightMm) > 1) {
    return false;
  }
  const segmentLength = lineLength(line(input.start, input.end));
  let overlapLength = 0;
  for (let index = 0; index < input.eavePolygon.length; index += 1) {
    overlapLength += roofSegmentOverlapLength2D(
      point2FromPoint3(input.start),
      point2FromPoint3(input.end),
      point2FromPoint3(input.eavePolygon[index]!),
      point2FromPoint3(input.eavePolygon[(index + 1) % input.eavePolygon.length]!),
    );
  }
  return overlapLength >= segmentLength - ROOF_JOIN_FEATURE_MIN_LENGTH_MM;
}

function countInvalidSourceEdgeCoverageEaveSeams(input: {
  facets: JoinedRoofFacet[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): number {
  const segments = new Map<string, { sourceEdgeIndexes: Set<number>; count: number }>();
  for (const facet of input.facets) {
    for (let index = 0; index < facet.boundary.length; index += 1) {
      const start = facet.boundary[index]!;
      const end = facet.boundary[(index + 1) % facet.boundary.length]!;
      if (
        Math.abs(start.z - input.eaveHeightMm) > 1 ||
        Math.abs(end.z - input.eaveHeightMm) > 1 ||
        lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM ||
        segmentOnEaveBoundary({ start, end, eavePolygon: input.eavePolygon, eaveHeightMm: input.eaveHeightMm })
      ) {
        continue;
      }
      const key = canonicalRoofSegmentKey(start, end);
      const existing = segments.get(key);
      if (existing) {
        existing.sourceEdgeIndexes.add(facet.edge.index);
        existing.count += 1;
      } else {
        segments.set(key, { sourceEdgeIndexes: new Set([facet.edge.index]), count: 1 });
      }
    }
  }

  let invalidCount = 0;
  for (const segment of segments.values()) {
    if (segment.count === 2 && segment.sourceEdgeIndexes.size === 1) continue;
    invalidCount += 1;
  }
  return invalidCount;
}

function buildRoofBoundarySegmentCounts(
  facets: JoinedRoofFacet[],
): Map<string, { count: number; sourceEdgeIndexes: Set<number>; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }> {
  const segments = new Map<
    string,
    {
      count: number;
      sourceEdgeIndexes: Set<number>;
      start: { x: number; y: number; z: number };
      end: { x: number; y: number; z: number };
    }
  >();
  for (const facet of facets) {
    for (let index = 0; index < facet.boundary.length; index += 1) {
      const start = facet.boundary[index]!;
      const end = facet.boundary[(index + 1) % facet.boundary.length]!;
      if (lineLength(line(start, end)) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      const key = canonicalRoofSegmentKey(start, end);
      const existing = segments.get(key);
      if (existing) {
        existing.count += 1;
        existing.sourceEdgeIndexes.add(facet.edge.index);
      } else {
        segments.set(key, {
          count: 1,
          sourceEdgeIndexes: new Set([facet.edge.index]),
          start,
          end,
        });
      }
    }
  }
  return segments;
}

function countUnbackedInternalBoundarySegments(input: {
  facets: JoinedRoofFacet[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): number {
  let count = 0;
  for (const segment of buildRoofBoundarySegmentCounts(input.facets).values()) {
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
    if (segment.count !== 2 || segment.sourceEdgeIndexes.size < 2) count += 1;
  }
  return count;
}

function countUnclassifiedRoofFeatures(input: {
  features: HouseRoofFeature3D[];
  facets: JoinedRoofFacet[];
  eavePolygon: Polygon3;
}): number {
  const segmentCounts = buildRoofBoundarySegmentCounts(input.facets);
  let count = 0;
  for (const feature of input.features) {
    const segment = segmentCounts.get(canonicalRoofSegmentKey(feature.line.start, feature.line.end));
    if (!segment || segment.count !== 2 || segment.sourceEdgeIndexes.size < 2) {
      count += 1;
      continue;
    }
    if (!input.eavePolygon.length) {
      count += 1;
    }
  }
  return count;
}

function semanticFailureReason(input: {
  sourceEdgeCount: number;
  expectedFaceCount: number;
  closedFaceCount: number;
  duplicateFacetCount: number;
  fallbackFeatureCount: number;
  unbackedBoundaryCount: number;
  unclassifiedFeatureCount: number;
  internalEaveHeightSegmentCount: number;
  existingFailureReason: string | null;
  allowSplitSourceFaces?: boolean;
}): string | null {
  if (input.existingFailureReason) return input.existingFailureReason;
  if (input.sourceEdgeCount !== input.expectedFaceCount) return 'roof_topology_missing_source_edge_face';
  if (!input.allowSplitSourceFaces && input.closedFaceCount !== input.expectedFaceCount) {
    return `roof_topology_face_count_mismatch:${input.closedFaceCount}:${input.expectedFaceCount}`;
  }
  if (input.allowSplitSourceFaces && input.closedFaceCount < input.expectedFaceCount) {
    return `roof_topology_face_count_mismatch:${input.closedFaceCount}:${input.expectedFaceCount}`;
  }
  if (!input.allowSplitSourceFaces && input.duplicateFacetCount > 0) return 'roof_topology_duplicate_source_faces';
  if (input.fallbackFeatureCount > 0) return 'roof_topology_fallback_features';
  if (input.unbackedBoundaryCount > 0) return 'roof_topology_unbacked_internal_boundary';
  if (input.unclassifiedFeatureCount > 0) return 'roof_topology_unclassified_internal_segment';
  if (input.internalEaveHeightSegmentCount > 0) return 'roof_topology_internal_eave_height_seams';
  return null;
}

function buildSourceEdgeCoverageFacets(input: {
  eavePolygon: Polygon3;
  edges: JoinedRoofEdge[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): {
  facets: JoinedRoofFacet[];
  metadata: GeometryMetadata;
} {
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
    .filter((region): region is NonNullable<ReturnType<typeof assignRoofRegion>> => Boolean(region));
  const mergedRegions = mergeAssignedRoofRegions(assignedRegions);
  const facets: JoinedRoofFacet[] = [];
  const sourceEdgeContactLengths = new Map<number, number>();
  for (const region of mergedRegions.regions) {
    const footprint = cleanRoofPolygon2D(region.footprint);
    sourceEdgeContactLengths.set(
      region.edge.index,
      (sourceEdgeContactLengths.get(region.edge.index) ?? 0) +
        sourceEdgeEaveContactLength({ footprint, edge: region.edge }),
    );
  }
  let rejectedFacetCount = 0;
  let failureEdgeId: string | null = null;
  let failureReason: string | null =
    typeof mergedRegions.topologyFailureReason === 'string'
      ? mergedRegions.topologyFailureReason
      : null;

  for (const region of mergedRegions.regions) {
    const footprint = cleanRoofPolygon2D(region.footprint);
    const sourceEdgeHasContact =
      (sourceEdgeContactLengths.get(region.edge.index) ?? 0) >
      ROOF_JOIN_FEATURE_MIN_LENGTH_MM;
    const facet = buildJoinedRoofFacetFromRegion({
      region: { edge: region.edge, footprint },
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      pitchRisePerRun: input.pitchRisePerRun,
    });
    if (!facet || !sourceEdgeHasContact) {
      rejectedFacetCount += 1;
      failureEdgeId ??= region.edge.id;
      failureReason ??=
        !sourceEdgeHasContact
          ? `${region.edge.id}:missing_source_edge_contact`
          : `${region.edge.id}:invalid_source_edge_coverage_face`;
      continue;
    }
    facets.push(facet);
  }

  const eaveAreaMm2 = Math.abs(signedAreaXY(input.eavePolygon));
  const facetAreaMm2 = facets.reduce((sum, facet) => sum + roofPolygonArea(facet.footprint), 0);
  const areaDeltaMm2 = facetAreaMm2 - eaveAreaMm2;
  const coverageGapAreaMm2 = Math.max(0, -areaDeltaMm2);
  const coverageOverlapAreaMm2 = Math.max(0, areaDeltaMm2);
  const areaToleranceMm2 = Math.max(100, eaveAreaMm2 * 0.001);
  if (!failureReason && facets.length !== input.edges.length) {
    const sourceEdgeCount = new Set(facets.map((facet) => facet.edge.index)).size;
    if (sourceEdgeCount !== input.edges.length) {
      const missingEdge = input.edges.find((edge) => !facets.some((facet) => facet.edge.index === edge.index));
      failureEdgeId = missingEdge?.id ?? null;
      failureReason = `${failureEdgeId ?? 'house-eave-edge'}:missing_source_edge_face`;
    }
  }
  if (!failureReason && Math.abs(areaDeltaMm2) > areaToleranceMm2) {
    failureReason = 'roof_area_mismatch';
  }

  return {
    facets: facets.sort((left, right) => left.edge.index - right.edge.index),
    metadata: {
      roofTopologyCoverageQaStatus: failureReason ? 'invalid' : 'valid',
      roofTopologyCoverageFailureReason: failureReason,
      roofTopologyCoverageGapAreaMm2: Math.round(coverageGapAreaMm2),
      roofTopologyCoverageOverlapAreaMm2: Math.round(coverageOverlapAreaMm2),
      roofTopologyCoverageAreaDeltaMm2: Math.round(areaDeltaMm2),
      roofTopologyFailureEdgeId: failureEdgeId,
      roofTopologyFailureReason: failureReason,
      roofRejectedFacetCount: rejectedFacetCount,
      roofFacetCount: facets.length,
      roofBaseRegionCount: baseRegions.length,
      roofSplitRegionCount: splitRegions.length,
      roofAssignedRegionCount: assignedRegions.length,
      roofAtomicRegionCount: mergedRegions.atomicRegionCount,
      roofDissolvedRegionCount: mergedRegions.dissolvedRegionCount,
      roofDiscardedDissolveLoopCount: mergedRegions.discardedLoopCount,
    },
  };
}

function buildSourceEdgeExactPartitionFacets(input: {
  eavePolygon: Polygon3;
  edges: JoinedRoofEdge[];
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): {
  facets: JoinedRoofFacet[];
  metadata: GeometryMetadata;
} {
  const eaveFootprint = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3));
  const facets: JoinedRoofFacet[] = [];
  let rejectedFacetCount = 0;
  let failureEdgeId: string | null = null;
  let failureReason: string | null = null;

  for (const edge of input.edges) {
    let footprint = eaveFootprint;
    for (const otherEdge of input.edges) {
      if (otherEdge.index === edge.index) continue;
      footprint = clipRoofPolygonByScalar(footprint, (candidate) =>
        roofHeightFromEdge({
          edge,
          candidate,
          eaveHeightMm: input.eaveHeightMm,
          pitchRisePerRun: input.pitchRisePerRun,
        }) -
        roofHeightFromEdge({
          edge: otherEdge,
          candidate,
          eaveHeightMm: input.eaveHeightMm,
          pitchRisePerRun: input.pitchRisePerRun,
        }),
      );
      if (roofPolygonArea(footprint) <= 1) break;
    }

    footprint = cleanRoofPolygon2D(footprint);
    const sourceEdgeHasContact =
      sourceEdgeEaveContactLength({ footprint, edge }) >
      ROOF_JOIN_FEATURE_MIN_LENGTH_MM;
    const footprintValid =
      footprint.length >= 3 &&
      roofPolygonArea(footprint) > 1 &&
      roofPolygonIsSimple(footprint) &&
      roofRegionInsideEave(footprint, input.eavePolygon);
    const facet =
      footprintValid && sourceEdgeHasContact
        ? buildJoinedRoofFacetFromRegion({
            region: { edge, footprint },
            eavePolygon: input.eavePolygon,
            eaveHeightMm: input.eaveHeightMm,
            pitchRisePerRun: input.pitchRisePerRun,
          })
        : null;

    if (!facet) {
      rejectedFacetCount += 1;
      failureEdgeId ??= edge.id;
      failureReason ??= !footprintValid
        ? `${edge.id}:invalid_exact_partition_face`
        : `${edge.id}:missing_source_edge_contact`;
      continue;
    }
    facets.push(facet);
  }

  const eaveAreaMm2 = Math.abs(signedAreaXY(input.eavePolygon));
  const facetAreaMm2 = facets.reduce((sum, facet) => sum + roofPolygonArea(facet.footprint), 0);
  const areaDeltaMm2 = facetAreaMm2 - eaveAreaMm2;
  const areaToleranceMm2 = Math.max(100, eaveAreaMm2 * 0.001);
  const sourceEdgeCount = new Set(facets.map((facet) => facet.edge.index)).size;
  if (!failureReason && facets.length !== input.edges.length) {
    const missingEdge = input.edges.find((edge) => !facets.some((facet) => facet.edge.index === edge.index));
    failureEdgeId = missingEdge?.id ?? null;
    failureReason = `${failureEdgeId ?? 'house-eave-edge'}:missing_source_edge_face`;
  }
  if (!failureReason && sourceEdgeCount !== input.edges.length) {
    failureReason = 'roof_topology_duplicate_source_faces';
  }
  if (!failureReason && Math.abs(areaDeltaMm2) > areaToleranceMm2) {
    failureReason = 'roof_area_mismatch';
  }

  return {
    facets: facets.sort((left, right) => left.edge.index - right.edge.index),
    metadata: {
      roofTopologyExactPartitionQaStatus: failureReason ? 'invalid' : 'valid',
      roofTopologyExactPartitionFailureReason: failureReason,
      roofTopologyExactPartitionFaceCount: facets.length,
      roofTopologyCoverageGapAreaMm2: Math.round(Math.max(0, -areaDeltaMm2)),
      roofTopologyCoverageOverlapAreaMm2: Math.round(Math.max(0, areaDeltaMm2)),
      roofTopologyCoverageAreaDeltaMm2: Math.round(areaDeltaMm2),
      roofTopologyFailureEdgeId: failureEdgeId,
      roofTopologyFailureReason: failureReason,
      roofRejectedFacetCount: rejectedFacetCount,
      roofFacetCount: facets.length,
      roofBaseRegionCount: 0,
      roofSplitRegionCount: 0,
      roofAssignedRegionCount: facets.length,
      roofAtomicRegionCount: facets.length,
      roofDissolvedRegionCount: 0,
      roofDiscardedDissolveLoopCount: 0,
    },
  };
}

function buildLowerEnvelopeDiagnosticRoof(input: {
  eavePolygon: Polygon3;
  edges: ReturnType<typeof buildJoinedRoofEdges>;
  eaveHeightMm: number;
  roofPitchDeg: number;
  pitchRisePerRun: number;
}): {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  metadata: GeometryMetadata;
} {
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
    .filter((region): region is NonNullable<ReturnType<typeof assignRoofRegion>> => Boolean(region));
  const facets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;

  for (const region of assignedRegions) {
    const facet = buildJoinedRoofFacetFromRegion({
      region,
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      pitchRisePerRun: input.pitchRisePerRun,
    });
    if (facet) facets.push(facet);
  }

  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  for (const facet of facets) {
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
          sourceEdgeId: facet.edge.id,
          footprintFollowing: true,
          roofGeometry: 'rectilinear_joined_hipped',
          roofTopologySolver: 'eave_graph_lower_envelope_diagnostic',
        },
      }),
    );
    renderedFacets.push(facet);
  }

  const roofFeatures = buildJoinedRoofFeatures({
    facets: renderedFacets,
    edges: input.edges,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: 'hipped',
    roofGeometry: 'rectilinear_joined_hipped',
  });

  return {
    roofPlanes,
    roofFeatures,
    metadata: {
      roofTopologyDiagnosticPlaneCount: roofPlanes.length,
      roofTopologyDiagnosticFeatureCount: roofFeatures.length,
      roofTopologyDiagnosticBaseRegionCount: baseRegions.length,
      roofTopologyDiagnosticSplitRegionCount: splitRegions.length,
      roofTopologyDiagnosticAssignedRegionCount: assignedRegions.length,
      roofTopologyDiagnosticRejectedFacetCount: skippedDegenerateFacetCount,
    },
  };
}

export function buildEaveGraphJoinedHippedRoof(input: {
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
    return {
      roofPlanes: [],
      roofFeatures: [],
      metadata: {
        roofTopologySolver: 'source_edge_coverage_partition',
        roofTopologyFailureReason: 'invalid_roof_pitch',
      },
    };
  }

  const eavePolygon = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3)).map((candidate) =>
    point(candidate.x, candidate.y, 0),
  );
  const edges = buildJoinedRoofEdges(eavePolygon);
  const diagnostic = buildLowerEnvelopeDiagnosticRoof({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    roofPitchDeg: input.roofPitchDeg,
    pitchRisePerRun,
  });
  let topologyFailureEdgeId: string | null = null;
  let topologyFailureReason: string | null = null;
  const exactFacetResult = buildSourceEdgeExactPartitionFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const coverageFacetResult = buildSourceEdgeCoverageFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const legacyFacetResult = buildJoinedRoofFacets({
    eavePolygon,
    edges,
    eaveHeightMm: input.eaveHeightMm,
    pitchRisePerRun,
  });
  const assessCandidate = (
    facetResult: typeof legacyFacetResult,
    options?: { allowSplitSourceFaces?: boolean },
  ): string | null => {
    const candidateFeatures = buildSourceEdgeEnvelopeFeatures({
      facets: facetResult.facets,
      edges,
      eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
    });
    const sourceEdgeCount = new Set(facetResult.facets.map((facet) => facet.edge.index)).size;
    const fallbackFeatureCount = candidateFeatures.filter(
      (feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback',
    ).length;
    return semanticFailureReason({
      sourceEdgeCount,
      expectedFaceCount: edges.length,
      closedFaceCount: facetResult.facets.length,
      duplicateFacetCount: Math.max(0, facetResult.facets.length - sourceEdgeCount),
      fallbackFeatureCount,
      unbackedBoundaryCount: countUnbackedInternalBoundarySegments({
        facets: facetResult.facets,
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      unclassifiedFeatureCount: countUnclassifiedRoofFeatures({
        features: candidateFeatures,
        facets: facetResult.facets,
        eavePolygon,
      }),
      internalEaveHeightSegmentCount: countJoinedRoofInternalEaveHeightSegments({
        facets: facetResult.facets,
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      }),
      existingFailureReason:
        typeof facetResult.metadata.roofTopologyFailureReason === 'string'
          ? facetResult.metadata.roofTopologyFailureReason
          : null,
      allowSplitSourceFaces: options?.allowSplitSourceFaces,
    });
  };
  const exactSemanticFailureReason = assessCandidate(exactFacetResult);
  const legacySemanticFailureReason = assessCandidate(legacyFacetResult);
  const coverageSemanticFailureReason = assessCandidate(coverageFacetResult, {
    allowSplitSourceFaces: true,
  });
  const useExactCommittedPath = exactSemanticFailureReason === null;
  const useLegacyCommittedPath = !useExactCommittedPath && legacySemanticFailureReason === null;
  const facetResult = useExactCommittedPath
    ? exactFacetResult
    : useLegacyCommittedPath
      ? legacyFacetResult
      : coverageFacetResult;
  const topologySolver = useExactCommittedPath
    ? 'source_edge_exact_envelope_partition'
    : useLegacyCommittedPath
      ? 'eave_graph_source_edge_envelope'
      : 'source_edge_coverage_partition';
  const facetMergeMode = useExactCommittedPath
    ? 'source_edge_exact_envelope_partition'
    : useLegacyCommittedPath
      ? 'source_edge_envelope'
      : 'source_edge_coverage_partition';
  topologyFailureReason =
    typeof facetResult.metadata.roofTopologyFailureReason === 'string'
      ? facetResult.metadata.roofTopologyFailureReason
      : null;
  topologyFailureReason ??= useExactCommittedPath
    ? exactSemanticFailureReason
    : useLegacyCommittedPath
      ? legacySemanticFailureReason
      : coverageSemanticFailureReason;

  const roofPlanes: RoofPlane3D[] = [];
  const renderedFacets: JoinedRoofFacet[] = [];
  let skippedDegenerateFacetCount = 0;
  for (const facet of facetResult.facets) {
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
      topologyFailureEdgeId ??= facet.edge.id;
      topologyFailureReason ??= `${facet.edge.id}:degenerate_closed_face`;
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
          roofTopologySolver: topologySolver,
        },
      }),
    );
    renderedFacets.push(facet);
  }

  const roofFeatures = buildSourceEdgeEnvelopeFeatures({
    facets: renderedFacets,
    edges,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const rawInternalEaveHeightSegmentCount = countJoinedRoofInternalEaveHeightSegments({
    facets: renderedFacets,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const internalEaveHeightSegmentCount = countInvalidSourceEdgeCoverageEaveSeams({
    facets: renderedFacets,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const fallbackFeatureCount = roofFeatures.filter(
    (feature) => feature.metadata?.roofFeatureSource === 'reentrant_fallback',
  ).length;
  const unbackedBoundaryCount = countUnbackedInternalBoundarySegments({
    facets: renderedFacets,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
  });
  const unclassifiedFeatureCount = countUnclassifiedRoofFeatures({
    features: roofFeatures,
    facets: renderedFacets,
    eavePolygon,
  });
  const valleyFeatureCount = roofFeatures.filter((feature) => feature.kind === 'valley').length;
  const sourceEdgeCount = new Set(renderedFacets.map((facet) => facet.edge.index)).size;
  const closedFaceCount = roofPlanes.length;
  const expectedFaceCount = edges.length;
  const duplicateFacetCount = Math.max(0, renderedFacets.length - sourceEdgeCount);
  const eaveAreaMm2 = Math.abs(signedAreaXY(eavePolygon));
  const facetAreaMm2 = renderedFacets.reduce((sum, facet) => sum + roofPolygonArea(facet.footprint), 0);
  const coverageGapAreaMm2 = Math.max(0, eaveAreaMm2 - facetAreaMm2);
  const overlapAreaMm2 = Math.max(0, facetAreaMm2 - eaveAreaMm2);
  if (!topologyFailureReason && sourceEdgeCount !== expectedFaceCount) {
    const missingEdge = edges.find((edge) => !renderedFacets.some((facet) => facet.edge.index === edge.index));
    topologyFailureEdgeId = missingEdge?.id ?? null;
    topologyFailureReason = `${topologyFailureEdgeId ?? 'house-eave-edge'}:missing_source_edge_face`;
  }
  topologyFailureReason = semanticFailureReason({
    sourceEdgeCount,
    expectedFaceCount,
    closedFaceCount,
    duplicateFacetCount,
    fallbackFeatureCount,
    unbackedBoundaryCount,
    unclassifiedFeatureCount,
    internalEaveHeightSegmentCount: rawInternalEaveHeightSegmentCount,
    existingFailureReason: topologyFailureReason,
  });
  return {
    roofPlanes,
    roofFeatures,
    metadata: {
      ...facetResult.metadata,
      ...diagnostic.metadata,
      roofTopologySolver: topologySolver,
      roofFacetMergeMode: facetMergeMode,
      roofTopologyExactPartitionQaStatus: exactFacetResult.metadata.roofTopologyExactPartitionQaStatus,
      roofTopologyExactPartitionFailureReason: exactFacetResult.metadata.roofTopologyExactPartitionFailureReason,
      roofTopologyExactPartitionFaceCount: exactFacetResult.metadata.roofTopologyExactPartitionFaceCount,
      roofTopologyCoverageQaStatus: coverageFacetResult.metadata.roofTopologyCoverageQaStatus,
      roofTopologyCoverageFailureReason: coverageFacetResult.metadata.roofTopologyCoverageFailureReason,
      roofTopologySemanticQaStatus: topologyFailureReason ? 'invalid' : 'valid',
      roofTopologySemanticFailureReason: topologyFailureReason,
      roofTopologyFailureEdgeId: topologyFailureEdgeId,
      roofTopologyFailureReason: topologyFailureReason,
      roofTopologyClosedFaceCount: closedFaceCount,
      roofTopologyExpectedFaceCount: expectedFaceCount,
      roofTopologyFinalFaceCount: closedFaceCount,
      roofTopologySourceEdgeCount: sourceEdgeCount,
      roofTopologyChordViolationCount: unbackedBoundaryCount,
      roofTopologyUnbackedBoundaryCount: unbackedBoundaryCount,
      roofTopologyInternalEaveHeightSegmentCount: internalEaveHeightSegmentCount,
      roofTopologyRawInternalEaveHeightSegmentCount: rawInternalEaveHeightSegmentCount,
      roofTopologyCoverageGapAreaMm2: Math.round(coverageGapAreaMm2),
      roofTopologyOverlapAreaMm2: Math.round(overlapAreaMm2),
      roofTopologyDanglingFeatureCount: 0,
      roofTopologyUnclassifiedFeatureCount: unclassifiedFeatureCount,
      roofTopologyDuplicateFacetCount: duplicateFacetCount,
      roofTopologyLegacySemanticQaStatus: legacySemanticFailureReason ? 'invalid' : 'valid',
      roofTopologyLegacySemanticFailureReason: legacySemanticFailureReason,
      roofTopologyCoverageSemanticQaStatus: coverageSemanticFailureReason ? 'invalid' : 'valid',
      roofTopologyCoverageSemanticFailureReason: coverageSemanticFailureReason,
      roofTopologyExactPartitionSemanticQaStatus: exactSemanticFailureReason ? 'invalid' : 'valid',
      roofTopologyExactPartitionSemanticFailureReason: exactSemanticFailureReason,
      roofRejectedFacetCount:
        (typeof facetResult.metadata.roofRejectedFacetCount === 'number'
          ? facetResult.metadata.roofRejectedFacetCount
          : 0) + skippedDegenerateFacetCount,
      roofBaseRegionCount: facetResult.metadata.roofBaseRegionCount,
      roofSplitRegionCount: facetResult.metadata.roofSplitRegionCount,
      roofAssignedRegionCount: facetResult.metadata.roofAssignedRegionCount,
      roofFacetCount: roofPlanes.length,
      roofFeatureCount: roofFeatures.length,
      roofFallbackFeatureCount: fallbackFeatureCount,
      roofTopologyValleyCount: valleyFeatureCount,
    },
  };
}
