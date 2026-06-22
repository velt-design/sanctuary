import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  HouseRoofRidgeAxis,
  Polygon3,
  RoofPlane3D,
} from '../contracts';
import { lineLength } from '../math3d';
import { RIDGE_COLLAPSE_EPSILON_MM, ROOF_JOIN_EPSILON_MM } from './constants';
import { isOrthogonalFootprint } from './footprintMath';
import {
  boundingBox,
  line,
  midpoint2,
  planeFromBoundary,
  point,
  reflectPointAcrossX,
  reflectVectorAcrossX,
  samePoint3WithinTolerance,
  signedAreaXY,
  swapPointAxes,
  swapVectorAxes,
  type BentSpineTerminalGableClosure,
  type HouseGableTerminalEnd,
  type JoinedRoofFacet,
  type JoinedRoofRegion,
} from './_internal';
import { cleanRoofPolygon2D, point2FromPoint3 } from './roof2D';
import { buildRoofPlane } from './roofPlane';
import { mergeAssignedRoofRegions, sortJoinedRoofRegions } from './roofJoinedDissolve';
import { buildJoinedRoofFacetFromRegion, buildJoinedRoofFacets, buildJoinedRoofFeatures, countJoinedRoofInternalEaveHeightSegments } from './roofJoinedFacets';
import {
  applyBentSpineTerminalGableClosures,
  buildBentSpineGableTerminalEndsX,
  deriveBentSpineTerminalGableClosures,
  deriveBentSpineTerminalIntersectionsX,
  deriveHouseFootprintOpenSide,
} from './roofJoinedGableTerminals';
import { roofFeaturesAreAxisAligned } from './roofJoinedHipped';
import { assignRoofRegion, buildJoinedRoofEdges, buildRectilinearRoofBaseRegions, splitRoofRegionsByPlaneIntersections } from './roofJoinedRegions';

export function buildLegacyJoinedRectilinearGableRoof(input: {
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
          roofForm: 'hipped',
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
    roofForm: 'hipped',
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
    roofForm: 'hipped',
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
          roofForm: 'hipped',
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
    roofForm: 'hipped',
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

export function buildJoinedRectilinearGableRoof(input: {
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

