import type { HouseRoofFeatureKind, Polygon3 } from '../contracts';
import { ROOF_JOIN_EPSILON_MM, ROOF_JOIN_FEATURE_MIN_LENGTH_MM, ROOF_REGION_MIN_AREA_MM2 } from './constants';
import {
  type JoinedRoofEdge,
  type JoinedRoofRegion,
  type JoinedRoofWavefrontLoop,
  type JoinedRoofWavefrontResult,
  type JoinedRoofWavefrontSegment,
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
  roofSegmentIntersectionPoint,
  roofSegmentParam,
  signedArea2D,
} from './roof2D';

function joinedRoofWavefrontVertexVelocity(
  previous: JoinedRoofWavefrontSegment,
  current: JoinedRoofWavefrontSegment,
): RoofPoint2 {
  return {
    x: previous.edge.inwardNormal.x + current.edge.inwardNormal.x,
    y: previous.edge.inwardNormal.y + current.edge.inwardNormal.y,
  };
}

function joinedRoofWavefrontLoopArea(loop: JoinedRoofWavefrontLoop): number {
  return signedArea2D(loop.segments.map((segment) => segment.start));
}

function joinedRoofWavefrontVertexKind(loop: JoinedRoofWavefrontLoop, index: number): HouseRoofFeatureKind {
  const area = joinedRoofWavefrontLoopArea(loop);
  const previous = loop.segments[(index - 1 + loop.segments.length) % loop.segments.length]!;
  const current = loop.segments[index]!;
  const previousVector = {
    x: previous.end.x - previous.start.x,
    y: previous.end.y - previous.start.y,
  };
  const nextVector = {
    x: current.end.x - current.start.x,
    y: current.end.y - current.start.y,
  };
  const cross = previousVector.x * nextVector.y - previousVector.y * nextVector.x;
  return Math.sign(cross || 1) === Math.sign(area || 1) ? 'hip' : 'valley';
}

function movedRoofPoint(candidate: RoofPoint2, velocity: RoofPoint2, distanceMm: number): RoofPoint2 {
  return {
    x: candidate.x + velocity.x * distanceMm,
    y: candidate.y + velocity.y * distanceMm,
  };
}

function joinedRoofWavefrontMovedSegments(
  loop: JoinedRoofWavefrontLoop,
  distanceMm: number,
): JoinedRoofWavefrontSegment[] {
  return loop.segments.map((segment, index) => {
    const previous = loop.segments[(index - 1 + loop.segments.length) % loop.segments.length]!;
    const next = loop.segments[(index + 1) % loop.segments.length]!;
    const startVelocity = joinedRoofWavefrontVertexVelocity(previous, segment);
    const endVelocity = joinedRoofWavefrontVertexVelocity(segment, next);
    return {
      edge: segment.edge,
      start: movedRoofPoint(segment.start, startVelocity, distanceMm),
      end: movedRoofPoint(segment.end, endVelocity, distanceMm),
    };
  });
}

function joinedRoofWavefrontEdgeCollapseDistance(loop: JoinedRoofWavefrontLoop, index: number): number | null {
  const segment = loop.segments[index]!;
  const previous = loop.segments[(index - 1 + loop.segments.length) % loop.segments.length]!;
  const next = loop.segments[(index + 1) % loop.segments.length]!;
  const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
  if (length <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const unitX = (segment.end.x - segment.start.x) / length;
  const unitY = (segment.end.y - segment.start.y) / length;
  const startVelocity = joinedRoofWavefrontVertexVelocity(previous, segment);
  const endVelocity = joinedRoofWavefrontVertexVelocity(segment, next);
  const lengthChange = (endVelocity.x - startVelocity.x) * unitX + (endVelocity.y - startVelocity.y) * unitY;
  if (lengthChange >= -ROOF_JOIN_EPSILON_MM) return null;
  const distance = -length / lengthChange;
  return distance > ROOF_JOIN_EPSILON_MM ? distance : null;
}

function joinedRoofWavefrontSplitDistance(
  loop: JoinedRoofWavefrontLoop,
  vertexIndex: number,
  edgeIndex: number,
): number | null {
  const previousIndex = (vertexIndex - 1 + loop.segments.length) % loop.segments.length;
  if (edgeIndex === previousIndex || edgeIndex === vertexIndex) return null;
  if ((edgeIndex + 1) % loop.segments.length === vertexIndex) return null;

  const vertexSegment = loop.segments[vertexIndex]!;
  const previousSegment = loop.segments[previousIndex]!;
  const target = loop.segments[edgeIndex]!;
  const targetNext = loop.segments[(edgeIndex + 1) % loop.segments.length]!;
  const vertexVelocity = joinedRoofWavefrontVertexVelocity(previousSegment, vertexSegment);
  const targetStartVelocity = joinedRoofWavefrontVertexVelocity(
    loop.segments[(edgeIndex - 1 + loop.segments.length) % loop.segments.length]!,
    target,
  );
  const targetEndVelocity = joinedRoofWavefrontVertexVelocity(target, targetNext);
  const targetDx = target.end.x - target.start.x;
  const targetDy = target.end.y - target.start.y;
  const targetLength = Math.hypot(targetDx, targetDy);
  if (targetLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;

  let distance: number | null = null;
  if (Math.abs(targetDy) <= ROOF_JOIN_EPSILON_MM) {
    const denominator = vertexVelocity.y - targetStartVelocity.y;
    if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM) return null;
    distance = (target.start.y - vertexSegment.start.y) / denominator;
  } else if (Math.abs(targetDx) <= ROOF_JOIN_EPSILON_MM) {
    const denominator = vertexVelocity.x - targetStartVelocity.x;
    if (Math.abs(denominator) <= ROOF_JOIN_EPSILON_MM) return null;
    distance = (target.start.x - vertexSegment.start.x) / denominator;
  } else {
    return null;
  }

  if (distance <= ROOF_JOIN_EPSILON_MM) return null;
  const vertexAtEvent = movedRoofPoint(vertexSegment.start, vertexVelocity, distance);
  const targetStartAtEvent = movedRoofPoint(target.start, targetStartVelocity, distance);
  const targetEndAtEvent = movedRoofPoint(target.end, targetEndVelocity, distance);
  if (!pointOnRoofSegment2(vertexAtEvent, targetStartAtEvent, targetEndAtEvent)) return null;
  if (
    roofPointDistance2(vertexAtEvent, targetStartAtEvent) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM ||
    roofPointDistance2(vertexAtEvent, targetEndAtEvent) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM
  ) {
    return null;
  }
  return distance;
}

function findNextJoinedRoofWavefrontDistance(loops: JoinedRoofWavefrontLoop[]): number | null {
  let selected: number | null = null;
  const accept = (distance: number | null) => {
    if (distance === null || !Number.isFinite(distance) || distance <= ROOF_JOIN_EPSILON_MM) return;
    selected = selected === null ? distance : Math.min(selected, distance);
  };

  for (const loop of loops) {
    if (loop.segments.length < 3) continue;
    for (let index = 0; index < loop.segments.length; index += 1) {
      accept(joinedRoofWavefrontEdgeCollapseDistance(loop, index));
    }
    for (let vertexIndex = 0; vertexIndex < loop.segments.length; vertexIndex += 1) {
      if (joinedRoofWavefrontVertexKind(loop, vertexIndex) !== 'valley') continue;
      for (let edgeIndex = 0; edgeIndex < loop.segments.length; edgeIndex += 1) {
        accept(joinedRoofWavefrontSplitDistance(loop, vertexIndex, edgeIndex));
      }
    }
  }

  return selected;
}

function joinedRoofWavefrontSweptRegions(
  loop: JoinedRoofWavefrontLoop,
  distanceMm: number,
): JoinedRoofRegion[] {
  const movedSegments = joinedRoofWavefrontMovedSegments(loop, distanceMm);
  const regions: JoinedRoofRegion[] = [];
  for (const [index, segment] of loop.segments.entries()) {
    // Stationary edges (zero inward normal -- open-gable caps in
    // partial-open joined topology) represent a vertical gable wall,
    // not a slope facet. They should produce NO roof regions. In the
    // simple case (both endpoints flanked by edges with opposite
    // normals on either side of the stationary edge), the swept
    // quad collapses to zero area and is filtered by the area
    // threshold below. But when the adjacent edges' normals both
    // point in the SAME direction (recess / staircase-style reflex
    // corners), both endpoints slide along the stationary edge in
    // unison, giving the swept quad real area despite the edge
    // being conceptually "stationary". That phantom region is the
    // root cause of Mode B (overlapping_boundary_fragments) failures
    // -- two consecutive wavefront iterations produce the same
    // phantom triangle in opposite winding, breaking the dissolve
    // fragment-cancellation pass. Skip explicitly.
    const inwardNormal = segment.edge.inwardNormal;
    if (Math.hypot(inwardNormal.x, inwardNormal.y) <= ROOF_JOIN_EPSILON_MM) continue;
    const moved = movedSegments[index]!;
    const footprint = cleanRoofPolygon2D([segment.start, segment.end, moved.end, moved.start]);
    if (footprint.length < 3 || roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) continue;
    regions.push({ edge: segment.edge, footprint });
  }
  return regions;
}

function splitJoinedRoofWavefrontSegments(
  segments: JoinedRoofWavefrontSegment[],
): JoinedRoofWavefrontSegment[] {
  const splitPoints = segments.map((segment) => [segment.start, segment.end]);

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    const first = segments[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const second = segments[secondIndex]!;
      const firstLength = Math.hypot(first.end.x - first.start.x, first.end.y - first.start.y);
      const secondLength = Math.hypot(second.end.x - second.start.x, second.end.y - second.start.y);
      if (firstLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM || secondLength <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      const directionCross =
        Math.abs((first.end.x - first.start.x) * (second.end.y - second.start.y) - (first.end.y - first.start.y) * (second.end.x - second.start.x)) /
        (firstLength * secondLength);
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

  const fragments: JoinedRoofWavefrontSegment[] = [];
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
      if (roofPointDistance2(start, end) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      fragments.push({ edge: segment.edge, start, end });
    }
  }
  return fragments;
}

function removeCanceledJoinedRoofWavefrontSegments(
  fragments: JoinedRoofWavefrontSegment[],
): { segments: JoinedRoofWavefrontSegment[]; canceledCount: number; nonManifoldCount: number } {
  const remaining = new Map<string, JoinedRoofWavefrontSegment[]>();
  let canceledCount = 0;
  let nonManifoldCount = 0;

  for (const fragment of fragments) {
    const startKey = roofPoint2Key(fragment.start);
    const endKey = roofPoint2Key(fragment.end);
    if (startKey === endKey) continue;
    const key = `${startKey}|${endKey}`;
    const reverseKey = `${endKey}|${startKey}`;
    const reverse = remaining.get(reverseKey);
    if (reverse?.length) {
      reverse.pop();
      canceledCount += 1;
      if (reverse.length === 0) remaining.delete(reverseKey);
      continue;
    }
    const existing = remaining.get(key) ?? [];
    if (existing.length > 0) nonManifoldCount += 1;
    existing.push(fragment);
    remaining.set(key, existing);
  }

  return {
    segments: [...remaining.values()].flat(),
    canceledCount,
    nonManifoldCount,
  };
}

function polygonizeJoinedRoofWavefrontSegments(
  segments: JoinedRoofWavefrontSegment[],
): JoinedRoofWavefrontLoop[] | null {
  const unused = new Map<string, JoinedRoofWavefrontSegment>();
  const outgoing = new Map<string, string[]>();
  for (const [index, segment] of segments.entries()) {
    const key = `${roofPoint2Key(segment.start)}|${roofPoint2Key(segment.end)}|${index}`;
    unused.set(key, segment);
    const startKey = roofPoint2Key(segment.start);
    const existing = outgoing.get(startKey) ?? [];
    existing.push(key);
    outgoing.set(startKey, existing);
  }

  const loops: JoinedRoofWavefrontLoop[] = [];
  while (unused.size > 0) {
    const firstEntry = unused.entries().next().value as [string, JoinedRoofWavefrontSegment] | undefined;
    if (!firstEntry) break;
    const [firstKey, firstSegment] = firstEntry;
    unused.delete(firstKey);
    const startKey = roofPoint2Key(firstSegment.start);
    let currentKey = roofPoint2Key(firstSegment.end);
    const loopSegments: JoinedRoofWavefrontSegment[] = [firstSegment];
    let guard = 0;
    while (currentKey !== startKey && guard <= segments.length + 1) {
      guard += 1;
      const candidates = (outgoing.get(currentKey) ?? []).filter((key) => unused.has(key)).sort();
      const nextKey = candidates[0];
      if (!nextKey) return null;
      const nextSegment = unused.get(nextKey);
      if (!nextSegment) return null;
      unused.delete(nextKey);
      loopSegments.push(nextSegment);
      currentKey = roofPoint2Key(nextSegment.end);
    }
    if (currentKey !== startKey) return null;
    if (loopSegments.length >= 3 && Math.abs(joinedRoofWavefrontLoopArea({ segments: loopSegments })) > ROOF_REGION_MIN_AREA_MM2) {
      loops.push({ segments: loopSegments });
    }
  }
  return loops;
}

function advanceJoinedRoofWavefrontLoop(input: {
  loop: JoinedRoofWavefrontLoop;
  distanceMm: number;
}): {
  loops: JoinedRoofWavefrontLoop[];
  canceledSegmentCount: number;
  nonManifoldSegmentCount: number;
  failureReason: string | null;
} {
  const movedSegments = joinedRoofWavefrontMovedSegments(input.loop, input.distanceMm).filter(
    (segment) => roofPointDistance2(segment.start, segment.end) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM * ROOF_JOIN_FEATURE_MIN_LENGTH_MM,
  );
  if (movedSegments.length < 3) {
    return { loops: [], canceledSegmentCount: 0, nonManifoldSegmentCount: 0, failureReason: null };
  }

  const splitSegments = splitJoinedRoofWavefrontSegments(movedSegments);
  const canceled = removeCanceledJoinedRoofWavefrontSegments(splitSegments);
  if (canceled.nonManifoldCount > 0) {
    return {
      loops: [],
      canceledSegmentCount: canceled.canceledCount,
      nonManifoldSegmentCount: canceled.nonManifoldCount,
      failureReason: 'roof_wavefront_non_manifold_boundary',
    };
  }
  if (canceled.segments.length === 0) {
    return {
      loops: [],
      canceledSegmentCount: canceled.canceledCount,
      nonManifoldSegmentCount: 0,
      failureReason: null,
    };
  }
  const loops = polygonizeJoinedRoofWavefrontSegments(canceled.segments);
  if (!loops) {
    return {
      loops: [],
      canceledSegmentCount: canceled.canceledCount,
      nonManifoldSegmentCount: canceled.nonManifoldCount,
      failureReason: 'roof_wavefront_unclosed_boundary',
    };
  }
  return {
    loops,
    canceledSegmentCount: canceled.canceledCount,
    nonManifoldSegmentCount: 0,
    failureReason: null,
  };
}

export function buildJoinedRoofWavefrontRegions(input: {
  eavePolygon: Polygon3;
  edges: JoinedRoofEdge[];
}): JoinedRoofWavefrontResult {
  let loops: JoinedRoofWavefrontLoop[] = [
    {
      segments: input.edges.map((edge) => ({
        edge,
        start: point2FromPoint3(edge.start),
        end: point2FromPoint3(edge.end),
      })),
    },
  ];
  const regions: JoinedRoofRegion[] = [];
  let failureReason: string | null = null;
  let eventCount = 0;
  let maxLoopCount = loops.length;
  let canceledSegmentCount = 0;
  let nonManifoldSegmentCount = 0;
  const maxEvents = Math.max(16, input.edges.length * input.edges.length * 4);

  while (loops.length > 0 && eventCount < maxEvents) {
    const distanceMm = findNextJoinedRoofWavefrontDistance(loops);
    if (distanceMm === null) {
      failureReason = 'roof_wavefront_missing_next_event';
      break;
    }
    eventCount += 1;
    const nextLoops: JoinedRoofWavefrontLoop[] = [];
    for (const loop of loops) {
      regions.push(...joinedRoofWavefrontSweptRegions(loop, distanceMm));
      const advanced = advanceJoinedRoofWavefrontLoop({ loop, distanceMm });
      canceledSegmentCount += advanced.canceledSegmentCount;
      nonManifoldSegmentCount += advanced.nonManifoldSegmentCount;
      failureReason ??= advanced.failureReason;
      nextLoops.push(...advanced.loops);
    }
    if (failureReason) break;
    loops = nextLoops;
    maxLoopCount = Math.max(maxLoopCount, loops.length);
  }

  if (!failureReason && loops.length > 0) {
    failureReason = 'roof_wavefront_event_limit';
  }

  return {
    regions,
    failureReason,
    metadata: {
      roofWavefrontSolverMode: 'active_rectilinear_wavefront',
      roofWavefrontEventCount: eventCount,
      roofWavefrontMaxLoopCount: maxLoopCount,
      roofWavefrontAtomCount: regions.length,
      roofWavefrontCanceledSegmentCount: canceledSegmentCount,
      roofWavefrontNonManifoldSegmentCount: nonManifoldSegmentCount,
      roofWavefrontFailureReason: failureReason,
    },
  };
}
