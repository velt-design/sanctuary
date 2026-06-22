import type { HouseRoofFeature3D, Point3, Polygon3 } from '../contracts';
import { ROOF_JOIN_EPSILON_MM, ROOF_REGION_MIN_AREA_MM2 } from './constants';
import { isOrthogonalFootprint } from './footprintMath';
import {
  point,
  samePoint3WithinTolerance,
  signedAreaXY,
  vertexFeatureKind,
  type BentSpineTerminalGableClosure,
  type HouseFootprintOpenSide,
  type HouseGableTerminalEnd,
  type HouseGableTerminalIntersection,
  type JoinedRoofFacet,
} from './_internal';
import { cleanRoofPolygon2D, point2FromPoint3, roofPoint3Key, roofPolygonArea } from './roof2D';
import { buildJoinedRoofFacets, buildJoinedRoofFeatures } from './roofJoinedFacets';
import { edgeLiesOnConvexHull, outwardNormalForEdge, ridgeGraphTerminalNodes } from './roofJoinedHipped';
import { buildJoinedRoofEdges, roofHeightFromEdge } from './roofJoinedRegions';

export function deriveHouseFootprintOpenSide(polygon: Polygon3): HouseFootprintOpenSide | null {
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

export function deriveBentSpineTerminalIntersectionsX(input: {
  footprint: Polygon3;
  ridgeFeatures: HouseRoofFeature3D[];
}): HouseGableTerminalIntersection[] | null {
  if (!input.ridgeFeatures.length) return null;
  // Phase 2: accept ridge graphs containing diagonal connector
  // segments. For asymmetric orthogonal polygons (custom L / U / T
  // whose wings have different widths), the wavefront's medial-axis
  // approximation produces a diagonal where two perpendicular wing
  // ridges converge at slightly offset meeting points -- e.g. a
  // y-arm ridge ending at (1500, 1500) connected to an x-arm ridge
  // starting at (2000, 1000) by a (1500, 1500) -> (2000, 1000)
  // diagonal. The previous axis-aligned guard rejected the entire
  // ridge graph in those cases, forcing fallback to a legacy
  // "all axis-perpendicular edges are terminals" heuristic that
  // over-included body-side edges and missed real wing tips. The
  // ray-cast terminal derivation below uses ONLY the degree-1 nodes
  // (true graph endpoints) and the axis dominant direction of each
  // node's incident ridge segment to find the polygon edge that's
  // the wing tip -- the diagonal connector lives between degree-2
  // interior nodes and never participates in the derivation, so
  // the relaxed check is correctness-preserving on the cases the
  // strict check used to accept (rectangle / preset L / preset U)
  // and unlocks the cases it used to reject.
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

export function buildBentSpineGableTerminalEndsX(input: {
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
    roofForm: 'hipped',
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

export function deriveBentSpineTerminalGableClosures(input: {
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

export function applyBentSpineTerminalGableClosures(input: {
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
