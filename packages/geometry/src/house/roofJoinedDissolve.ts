import type { Polygon3 } from '../contracts';
import { ROOF_JOIN_EPSILON_MM, ROOF_JOIN_FEATURE_MIN_LENGTH_MM, ROOF_REGION_MIN_AREA_MM2 } from './constants';
import {
  type JoinedRoofEdge,
  type JoinedRoofRegion,
  type RoofPoint2,
} from './_internal';
import {
  addRoofDissolveSplitPoint,
  cleanRoofPolygon2D,
  point2FromPoint3,
  pointOnRoofSegment2,
  roofPoint2FromKey,
  roofPoint2Key,
  roofPointDistance2,
  roofPolygonArea,
  roofPolygonCentroid,
  roofPolygonIsSimple,
  roofRegionInsideEave,
  roofSegmentIntersectionPoint,
  roofSegmentOverlapLength2D,
  roofSegmentParam,
  signedArea2D,
} from './roof2D';

type RoofDissolveSegment = {
  start: RoofPoint2;
  end: RoofPoint2;
};

type RoofRegionDissolveResult =
  | {
      ok: true;
      footprints: RoofPoint2[][];
      sourceRegionCount: number;
      discardedLoopCount: number;
    }
  | {
      ok: false;
      reason: string;
      sourceRegionCount: number;
    };

function splitRoofDissolveSegments(segments: RoofDissolveSegment[]): RoofDissolveSegment[] {
  const splitPoints = segments.map((segment) => [segment.start, segment.end]);

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    const first = segments[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const second = segments[secondIndex]!;
      const firstDx = first.end.x - first.start.x;
      const firstDy = first.end.y - first.start.y;
      const secondDx = second.end.x - second.start.x;
      const secondDy = second.end.y - second.start.y;
      const firstLength = Math.hypot(firstDx, firstDy);
      const secondLength = Math.hypot(secondDx, secondDy);
      if (firstLength <= ROOF_JOIN_EPSILON_MM || secondLength <= ROOF_JOIN_EPSILON_MM) continue;

      const directionCross = Math.abs(firstDx * secondDy - firstDy * secondDx) / (firstLength * secondLength);
      if (directionCross <= 1e-6) {
        for (const candidate of [first.start, first.end]) {
          if (pointOnRoofSegment2(candidate, second.start, second.end)) {
            addRoofDissolveSplitPoint(splitPoints[secondIndex]!, candidate);
          }
        }
        for (const candidate of [second.start, second.end]) {
          if (pointOnRoofSegment2(candidate, first.start, first.end)) {
            addRoofDissolveSplitPoint(splitPoints[firstIndex]!, candidate);
          }
        }
        continue;
      }

      const intersection = roofSegmentIntersectionPoint(first.start, first.end, second.start, second.end);
      if (!intersection) continue;
      addRoofDissolveSplitPoint(splitPoints[firstIndex]!, intersection);
      addRoofDissolveSplitPoint(splitPoints[secondIndex]!, intersection);
    }
  }

  const fragments: RoofDissolveSegment[] = [];
  for (const [index, segment] of segments.entries()) {
    const ordered = splitPoints[index]!
      .map((candidate) => ({
        point: roofPoint2FromKey(roofPoint2Key(candidate)),
        t: roofSegmentParam(segment.start, segment.end, candidate),
      }))
      .filter((candidate) => candidate.t >= -ROOF_JOIN_EPSILON_MM && candidate.t <= 1 + ROOF_JOIN_EPSILON_MM)
      .sort((a, b) => a.t - b.t);
    const unique: RoofPoint2[] = [];
    for (const candidate of ordered) {
      addRoofDissolveSplitPoint(unique, candidate.point);
    }
    for (let pointIndex = 0; pointIndex < unique.length - 1; pointIndex += 1) {
      const start = unique[pointIndex]!;
      const end = unique[pointIndex + 1]!;
      if (roofPointDistance2(start, end) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) continue;
      fragments.push({ start, end });
    }
  }
  return fragments;
}

function addDissolvedRoofBoundaryFragment(fragments: Map<string, number>, start: RoofPoint2, end: RoofPoint2): void {
  const startKey = roofPoint2Key(start);
  const endKey = roofPoint2Key(end);
  if (startKey === endKey) return;
  const key = `${startKey}|${endKey}`;
  const reverseKey = `${endKey}|${startKey}`;
  const reverseCount = fragments.get(reverseKey) ?? 0;
  if (reverseCount > 1) {
    fragments.set(reverseKey, reverseCount - 1);
    return;
  }
  if (reverseCount === 1) {
    fragments.delete(reverseKey);
    return;
  }
  fragments.set(key, (fragments.get(key) ?? 0) + 1);
}

function selectNextDissolvedRoofSegment(
  candidateKeys: string[],
  unused: Map<string, RoofDissolveSegment>,
  previous: RoofPoint2,
  current: RoofPoint2,
): string | null {
  if (candidateKeys.length === 0) return null;
  if (candidateKeys.length === 1) return candidateKeys[0] ?? null;
  const incomingX = current.x - previous.x;
  const incomingY = current.y - previous.y;
  const incomingLength = Math.hypot(incomingX, incomingY);
  if (incomingLength <= ROOF_JOIN_EPSILON_MM) return [...candidateKeys].sort()[0] ?? null;

  return [...candidateKeys]
    .map((key) => {
      const segment = unused.get(key)!;
      const outgoingX = segment.end.x - segment.start.x;
      const outgoingY = segment.end.y - segment.start.y;
      const cross = incomingX * outgoingY - incomingY * outgoingX;
      const dot = incomingX * outgoingX + incomingY * outgoingY;
      const angle = Math.atan2(cross, dot);
      return {
        key,
        leftTurnAngle: angle <= ROOF_JOIN_EPSILON_MM ? angle + Math.PI * 2 : angle,
      };
    })
    .sort((a, b) => a.leftTurnAngle - b.leftTurnAngle || a.key.localeCompare(b.key))[0]?.key ?? null;
}

function polygonizeDissolvedRoofSegments(segments: Map<string, RoofDissolveSegment>): RoofPoint2[][] | null {
  const unused = new Map(segments);
  const outgoing = new Map<string, string[]>();
  for (const [key, segment] of unused) {
    const startKey = roofPoint2Key(segment.start);
    const existing = outgoing.get(startKey) ?? [];
    existing.push(key);
    outgoing.set(startKey, existing);
  }

  const loops: RoofPoint2[][] = [];
  while (unused.size > 0) {
    const firstEntry = unused.entries().next().value as [string, RoofDissolveSegment] | undefined;
    if (!firstEntry) break;
    const [firstKey, firstSegment] = firstEntry;
    unused.delete(firstKey);

    const startKey = roofPoint2Key(firstSegment.start);
    let currentKey = roofPoint2Key(firstSegment.end);
    const loop: RoofPoint2[] = [firstSegment.start, firstSegment.end];
    let previousPoint = firstSegment.start;
    let currentPoint = firstSegment.end;
    let guard = 0;

    while (currentKey !== startKey && guard <= segments.size + 1) {
      guard += 1;
      const candidates = (outgoing.get(currentKey) ?? []).filter((key) => unused.has(key));
      const nextKey = selectNextDissolvedRoofSegment(candidates, unused, previousPoint, currentPoint);
      if (!nextKey) return null;
      const nextSegment = unused.get(nextKey);
      if (!nextSegment) return null;
      unused.delete(nextKey);
      loop.push(nextSegment.end);
      previousPoint = nextSegment.start;
      currentPoint = nextSegment.end;
      currentKey = roofPoint2Key(nextSegment.end);
    }

    if (currentKey !== startKey) return null;
    const cleaned = cleanRoofPolygon2D(loop);
    if (cleaned.length < 3 || roofPolygonArea(cleaned) <= ROOF_REGION_MIN_AREA_MM2) return null;
    loops.push(signedArea2D(cleaned) < 0 ? [...cleaned].reverse() : cleaned);
  }

  return loops;
}

function roofPolygonContactLengthWithEdge(polygon: RoofPoint2[], edge: JoinedRoofEdge): number {
  let contactLength = 0;
  const edgeStart = point2FromPoint3(edge.start);
  const edgeEnd = point2FromPoint3(edge.end);
  for (let index = 0; index < polygon.length; index += 1) {
    contactLength += roofSegmentOverlapLength2D(polygon[index]!, polygon[(index + 1) % polygon.length]!, edgeStart, edgeEnd);
  }
  return contactLength;
}

function dissolveJoinedRoofRegions(edge: JoinedRoofEdge, regions: JoinedRoofRegion[]): RoofRegionDissolveResult {
  if (!regions.length) {
    return { ok: false, reason: 'missing_source_regions', sourceRegionCount: 0 };
  }

  const segments: RoofDissolveSegment[] = [];
  for (const region of regions) {
    const cleanedFootprint = cleanRoofPolygon2D(region.footprint);
    const footprint = signedArea2D(cleanedFootprint) < 0 ? [...cleanedFootprint].reverse() : cleanedFootprint;
    for (let index = 0; index < footprint.length; index += 1) {
      const start = footprint[index]!;
      const end = footprint[(index + 1) % footprint.length]!;
      if (roofPointDistance2(start, end) <= ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) continue;
      segments.push({ start, end });
    }
  }

  const boundaryFragmentCounts = new Map<string, number>();
  for (const fragment of splitRoofDissolveSegments(segments)) {
    addDissolvedRoofBoundaryFragment(boundaryFragmentCounts, fragment.start, fragment.end);
  }

  const boundarySegments = new Map<string, RoofDissolveSegment>();
  for (const [key, count] of boundaryFragmentCounts) {
    if (count !== 1) {
      return { ok: false, reason: 'overlapping_boundary_fragments', sourceRegionCount: regions.length };
    }
    const [startKey, endKey] = key.split('|');
    if (!startKey || !endKey) {
      return { ok: false, reason: 'invalid_boundary_fragment_key', sourceRegionCount: regions.length };
    }
    boundarySegments.set(key, { start: roofPoint2FromKey(startKey), end: roofPoint2FromKey(endKey) });
  }

  const loops = polygonizeDissolvedRoofSegments(boundarySegments);
  if (!loops) {
    return { ok: false, reason: 'unclosed_boundary_graph', sourceRegionCount: regions.length };
  }
  const loopCandidates = loops
    .map((loop) => ({
      loop,
      contactLength: roofPolygonContactLengthWithEdge(loop, edge),
      area: roofPolygonArea(loop),
    }))
    .sort((a, b) => b.contactLength - a.contactLength || b.area - a.area);
  const sourceContactLoops = loopCandidates.filter((candidate) => candidate.contactLength > ROOF_JOIN_FEATURE_MIN_LENGTH_MM);
  const disconnectedLoops = loopCandidates.filter((candidate) => candidate.contactLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM);
  if (sourceContactLoops.length === 0) {
    return {
      ok: false,
      reason: 'merged_face_missing_source_edge_contact',
      sourceRegionCount: regions.length,
    };
  }

  const footprints = [...sourceContactLoops.map((candidate) => candidate.loop), ...disconnectedLoops.map((candidate) => candidate.loop)]
    .map((loop) => cleanRoofPolygon2D(loop))
    .filter((loop) => loop.length >= 3 && roofPolygonArea(loop) > ROOF_REGION_MIN_AREA_MM2);
  for (const footprint of footprints) {
    if (!roofPolygonIsSimple(footprint)) {
      return { ok: false, reason: 'self_intersecting_merged_face', sourceRegionCount: regions.length };
    }
  }

  return { ok: true, footprints, sourceRegionCount: regions.length, discardedLoopCount: 0 };
}

export function mergeAssignedRoofRegions(regions: JoinedRoofRegion[]): {
  regions: JoinedRoofRegion[];
  topologyFailureReason: string | null;
  dissolvedRegionCount: number;
  atomicRegionCount: number;
  discardedLoopCount: number;
} {
  const byEdge = new Map<number, JoinedRoofRegion[]>();
  for (const region of regions) {
    const existing = byEdge.get(region.edge.index) ?? [];
    existing.push(region);
    byEdge.set(region.edge.index, existing);
  }

  const merged: JoinedRoofRegion[] = [];
  let topologyFailureReason: string | null = null;
  let dissolvedRegionCount = 0;
  let discardedLoopCount = 0;
  for (const edgeRegions of byEdge.values()) {
    const edge = edgeRegions[0]!.edge;
    const dissolved = dissolveJoinedRoofRegions(edge, edgeRegions);
    if (!dissolved.ok) {
      topologyFailureReason ??= `${edge.id}:${dissolved.reason}`;
      continue;
    }
    dissolvedRegionCount += Math.max(0, dissolved.sourceRegionCount - 1);
    discardedLoopCount += dissolved.discardedLoopCount;
    merged.push(...dissolved.footprints.map((footprint) => ({ edge, footprint })));
  }

  return {
    regions: merged.sort(
      (a, b) =>
        a.edge.index - b.edge.index ||
        roofPolygonCentroid(a.footprint).x - roofPolygonCentroid(b.footprint).x ||
        roofPolygonCentroid(a.footprint).y - roofPolygonCentroid(b.footprint).y,
    ),
    topologyFailureReason,
    dissolvedRegionCount,
    atomicRegionCount: regions.length,
    discardedLoopCount,
  };
}

export function validateJoinedRoofRegionFootprint(region: RoofPoint2[], eavePolygon: Polygon3): RoofPoint2[] | null {
  const footprint = cleanRoofPolygon2D(region);
  if (footprint.length < 3) return null;
  if (footprint.some((candidate) => !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y))) return null;
  if (roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) return null;
  if (!roofPolygonIsSimple(footprint)) return null;
  if (!roofRegionInsideEave(footprint, eavePolygon)) return null;
  return footprint;
}

export function sortJoinedRoofRegions(regions: JoinedRoofRegion[]): JoinedRoofRegion[] {
  return [...regions].sort(
    (a, b) =>
      a.edge.index - b.edge.index ||
      roofPolygonCentroid(a.footprint).x - roofPolygonCentroid(b.footprint).x ||
      roofPolygonCentroid(a.footprint).y - roofPolygonCentroid(b.footprint).y,
  );
}
