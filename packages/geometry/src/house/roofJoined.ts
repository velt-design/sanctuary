import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  HouseRoofRidgeAxis,
  Line3,
  Point2,
  Point3,
  Polygon2,
  Polygon3,
  RoofPlane3D,
} from '../contracts';
import { lineLength } from '../math3d';
import { RIDGE_COLLAPSE_EPSILON_MM, ROOF_JOIN_EPSILON_MM } from './constants';
import { closestPointOnLineSegment2D, findInteriorRoofNode, isOrthogonalFootprint, polygonLineInterval } from './footprintMath';
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
  vertexFeatureKind,
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

export function buildBentSpineJoinedGableRoofX(input: {
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

export function reflectRoofBuildResultAcrossX(input: {
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

export function swapRoofBuildResultAxes(input: {
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

/**
 * One terminal-end click target in plan view: an isoceles triangle
 * anchored on the eave edge, pointing inward (into the house). Used by
 * `buildTopProjectionViewModel` to emit `kind: 'house_terminal_end'`
 * shapes that the plan view can hit-test for the Dutch-hip toggle.
 *
 * The triangle is a synthetic marker, not the actual hip facet's plan
 * footprint -- markers always exist for both open and closed states so
 * the user can re-close an opened end. `isOpen` is metadata for the
 * renderer to style closed (filled hip) vs open (gable) differently.
 */
export type HouseTerminalEndMarker = {
  endId: string;
  sourceFootprintEdgeIndex: number;
  isOpen: boolean;
  markerPolygon: Polygon2;
  /** Eave midpoint (mm). Useful for label/anchor placement. */
  eaveMidpoint: Point2;
};

const DEFAULT_TERMINAL_MARKER_HEIGHT_MM = 1500;
const DEFAULT_TERMINAL_MARKER_HEIGHT_RATIO = 0.25;
const TERMINAL_MARKER_AXIS_TOLERANCE_MM = 1e-6;

/**
 * Derive a clickable inward-pointing triangle for each terminal end of a
 * hipped (or hipped-with-Dutch-hip) roof. Triangles are sized as the
 * smaller of `markerHeightMm` (default 1500mm) and a quarter of the
 * eave length so the marker scales with the house but never overpowers
 * a small footprint.
 *
 * The terminal-end set comes from `deriveHouseGableTerminalEndsFromFootprint`,
 * so id schemes match exactly. The trailing index in
 * `house-gable-end-{axis}-N` is `(footprint edge index) + 1` for both
 * axes (the joined Y wrapper preserves edge indexes through `swapPointAxes`).
 */
export function deriveHouseTerminalEndMarkers(input: {
  footprint: Polygon3;
  ridgeAxis: HouseRoofRidgeAxis;
  openGableEndIds?: ReadonlyArray<string> | null;
  markerHeightMm?: number;
}): HouseTerminalEndMarker[] {
  const terminals = deriveHouseGableTerminalEndsFromFootprint({
    footprint: input.footprint,
    ridgeAxis: input.ridgeAxis,
  });
  if (terminals.length === 0) return [];
  const openSet = new Set(input.openGableEndIds ?? []);
  const orientation = signedAreaXY(input.footprint) >= 0 ? 1 : -1;
  const markerHeightCap = input.markerHeightMm ?? DEFAULT_TERMINAL_MARKER_HEIGHT_MM;

  return terminals
    .map((terminal) => {
      const trailing = terminal.id.match(/-(\d+)$/);
      if (!trailing) return null;
      const edgeIndex = Number(trailing[1]) - 1;
      if (!Number.isFinite(edgeIndex) || edgeIndex < 0 || edgeIndex >= input.footprint.length) {
        return null;
      }
      const start = input.footprint[edgeIndex]!;
      const end = input.footprint[(edgeIndex + 1) % input.footprint.length]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length <= TERMINAL_MARKER_AXIS_TOLERANCE_MM) return null;
      // Inward normal: rotate edge vector 90 deg toward the interior.
      // For a CCW polygon (signedArea > 0) the interior is left of the
      // edge -> rotate CCW: (-dy, dx). For CW, rotate the other way.
      const inwardX = (-dy * orientation) / length;
      const inwardY = (dx * orientation) / length;
      const apexInset = Math.min(markerHeightCap, length * DEFAULT_TERMINAL_MARKER_HEIGHT_RATIO);
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const apex: Point2 = {
        x: midX + inwardX * apexInset,
        y: midY + inwardY * apexInset,
      };
      const markerPolygon: Polygon2 = [
        { x: start.x, y: start.y },
        { x: end.x, y: end.y },
        apex,
      ];
      return {
        endId: terminal.id,
        sourceFootprintEdgeIndex: edgeIndex,
        isOpen: openSet.has(terminal.id),
        markerPolygon,
        eaveMidpoint: { x: midX, y: midY },
      } satisfies HouseTerminalEndMarker;
    })
    .filter((marker): marker is HouseTerminalEndMarker => marker !== null);
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

export function buildComplexFootprintRoof(input: {
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
