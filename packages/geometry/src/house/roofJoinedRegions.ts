import type { Polygon3 } from '../contracts';
import { RIDGE_COLLAPSE_EPSILON_MM, ROOF_JOIN_EPSILON_MM, ROOF_REGION_MIN_AREA_MM2 } from './constants';
import {
  pointInPolygon2D,
  signedAreaXY,
  uniqueSorted,
  vertexFeatureKind,
  type JoinedRoofEdge,
  type JoinedRoofRegion,
  type RoofPoint2,
} from './_internal';
import {
  cleanRoofPolygon2D,
  clipRoofPolygonByScalar,
  point2FromPoint3,
  roofPolygonArea,
  roofPolygonCentroid,
  segmentInsideRoofPolygon,
} from './roof2D';

export function buildJoinedRoofEdges(eavePolygon: Polygon3): JoinedRoofEdge[] {
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

export function roofHeightFromEdge(input: {
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

export function buildRectilinearRoofBaseRegions(eavePolygon: Polygon3): RoofPoint2[][] {
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

export function splitRoofRegionsByPlaneIntersections(input: {
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

/**
 * A "stationary" edge is one with zero inward normal -- used by the
 * Dutch-hip / open-gable mechanism (milestone 13 session B) to mark a
 * terminal-end edge as "this face is a vertical gable wall, no roof
 * slope advances inward." For region-based facet assignment, stationary
 * edges produce roof height = eave height everywhere, which would
 * otherwise win every region's lowest-height comparison and assign all
 * regions to the wall edge. Skipping them in candidate selection is the
 * right semantic: a wall edge contributes no roof plane.
 */
function roofEdgeIsStationary(edge: JoinedRoofEdge): boolean {
  return (
    Math.abs(edge.inwardNormal.x) <= ROOF_JOIN_EPSILON_MM &&
    Math.abs(edge.inwardNormal.y) <= ROOF_JOIN_EPSILON_MM
  );
}

export function assignRoofRegion(input: {
  footprint: RoofPoint2[];
  edges: JoinedRoofEdge[];
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  pitchRisePerRun: number;
}): JoinedRoofRegion | null {
  const centroid = roofPolygonCentroid(input.footprint);
  const candidates = input.edges
    .filter((edge) => !roofEdgeIsStationary(edge))
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
