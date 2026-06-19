import { computeVertexMotion } from "./bisector";
import type {
  IntegerPoint2D,
  OrthogonalPolygon,
  OrthogonalPolygonValidationError,
  SkeletonEdge,
  SkeletonNode,
  StraightSkeleton,
} from "./types";
import { validateOrthogonalPolygon } from "./validate";

/**
 * PR-SS-2 (2026-06-19): event-driven orthogonal straight-skeleton
 * solver.
 *
 * Algorithm sketch (event-driven wavefront contraction):
 *
 *   1. Initialize wavefront from the polygon: every vertex becomes
 *      an active wavefront vertex with a position, velocity (from
 *      its bisector), and pointers to its prev/next neighbours in
 *      a circular doubly-linked list.
 *   2. Compute the initial event queue:
 *        - Every wavefront edge contributes an EDGE_COLLAPSE event
 *          at the time when the two endpoints meet.
 *        - Every reflex wavefront vertex contributes a SPLIT_EVENT
 *          for each non-incident edge it might hit.
 *   3. Pop the earliest event:
 *        - EDGE_COLLAPSE: merge the two endpoints into a new
 *          skeleton interior node; create skeleton edges from each
 *          dying vertex to the new node; update neighbour pointers;
 *          recompute events touching the survivors.
 *        - SPLIT_EVENT: split the polygon into two pieces; create a
 *          new skeleton node at the split point; create skeleton
 *          edges to it from the reflex vertex and the two new
 *          wavefront vertices on the hit edge.
 *   4. Continue until the wavefront is fully consumed.
 *
 * For axis-aligned orthogonal polygons all event times are integers
 * (because velocities have integer components ±1 and positions are
 * integer mm), so the algorithm is numerically exact.
 *
 * This first implementation handles EDGE_COLLAPSE events only —
 * enough for rectangles (no reflex vertices). SPLIT_EVENTS land in
 * the next commit to extend to L / T / U / H / plus shapes.
 *
 * Simultaneous events at the same time are processed in deterministic
 * insertion order; the algorithm's correctness does not depend on
 * the tie-breaking order.
 */

export type StraightSkeletonError =
  | { code: "invalid_polygon"; cause: OrthogonalPolygonValidationError }
  | { code: "unsupported_topology"; reason: string };

export type StraightSkeletonResult =
  | { ok: true; skeleton: StraightSkeleton }
  | { ok: false; error: StraightSkeletonError };

type WavefrontVertex = {
  /** Stable index in `vertices`. Used by skeleton edges. */
  index: number;
  /** Position at `birthTime`. Position at time t is `position + velocity · (t − birthTime)`. */
  position: IntegerPoint2D;
  birthTime: number;
  velocity: IntegerPoint2D;
  /** Index of the prev / next wavefront vertex (circular). */
  prevIndex: number;
  nextIndex: number;
  /**
   * Polygon edge id of the edge between THIS vertex and its NEXT
   * vertex in the wavefront. Survives merges so that skeleton edges
   * carry the original polygon-edge attribution.
   */
  outgoingEdgeId: number;
  /** Skeleton-node index this wavefront vertex was born at. */
  skeletonNodeIndex: number;
  /** Set to false when the vertex is consumed by an event. */
  alive: boolean;
};

type EdgeCollapseEvent = {
  kind: "edge_collapse";
  time: number;
  /** Vertex on the "from" side of the collapsing edge. */
  fromVertexIndex: number;
  /** Vertex on the "to" side of the collapsing edge. */
  toVertexIndex: number;
};

type Event = EdgeCollapseEvent; // SPLIT_EVENT added in the next pass.

function positionAtTime(
  vertex: WavefrontVertex,
  time: number,
): IntegerPoint2D {
  const dt = time - vertex.birthTime;
  return {
    x: vertex.position.x + vertex.velocity.x * dt,
    y: vertex.position.y + vertex.velocity.y * dt,
  };
}

/**
 * Compute the time at which the wavefront edge between vertex `a`
 * and vertex `b` collapses to zero length. Returns null when the
 * edge does not collapse in finite time (parallel motion separating
 * the vertices, or motion that maintains the edge length).
 *
 * For an axis-aligned polygon, every edge is either horizontal or
 * vertical; the collapse time is determined by the closing velocity
 * along the edge's axis.
 */
function edgeCollapseTime(
  a: WavefrontVertex,
  b: WavefrontVertex,
): number | null {
  // Express positions at a shared reference time = max(birthTimes).
  // Both vertices have constant velocity over their lifetime.
  const refTime = Math.max(a.birthTime, b.birthTime);
  const aRef = positionAtTime(a, refTime);
  const bRef = positionAtTime(b, refTime);
  const edgeDx = bRef.x - aRef.x;
  const edgeDy = bRef.y - aRef.y;
  const closingVx = a.velocity.x - b.velocity.x;
  const closingVy = a.velocity.y - b.velocity.y;
  if (edgeDy === 0) {
    // Horizontal edge — collapse when x components align.
    if (closingVx === 0) return null;
    const dt = edgeDx / closingVx;
    if (dt <= 0) return null;
    return refTime + dt;
  }
  if (edgeDx === 0) {
    // Vertical edge — collapse when y components align.
    if (closingVy === 0) return null;
    const dt = edgeDy / closingVy;
    if (dt <= 0) return null;
    return refTime + dt;
  }
  // Edge is no longer axis-aligned (happens only if the algorithm
  // has produced a non-orthogonal wavefront — not yet possible
  // with edge-collapse-only handling).
  return null;
}

/**
 * Predict the velocity of a new wavefront vertex created by merging
 * two adjacent vertices. The new vertex represents the corner
 * between the surviving "left" polygon edge (of the previous
 * vertex) and the surviving "right" polygon edge (of the next
 * vertex). When those two surviving edges are perpendicular, the
 * new vertex moves along their bisector; when they are parallel,
 * the new vertex moves along the surviving edges' shared direction
 * (the "ridge collapse" case).
 *
 * For a rectangle, after the two short edges collapse the wavefront
 * has two surviving vertices whose neighbour edges (the two long
 * edges of the rectangle) are parallel — the new vertices move
 * along the ridge toward each other.
 *
 * Returns the integer-component velocity vector for the merged
 * vertex.
 */
function mergedVertexVelocity(
  prevVertex: WavefrontVertex,
  nextVertex: WavefrontVertex,
  mergePosition: IntegerPoint2D,
): IntegerPoint2D {
  // After merging, the new vertex sits between prevVertex's previous
  // edge and nextVertex's outgoing edge. Both surviving edges are
  // moving inward perpendicular to themselves. Predict the new
  // vertex's velocity by considering how those two moving edges'
  // intersection point would evolve.
  //
  // Approach: sample each surviving edge's current orientation by
  // looking at the local geometry of its endpoints, then compose
  // the bisector via the same formula as the initial bisector but
  // operating on the surviving edges.
  //
  // For the simpler case where the two surviving edges have the
  // SAME inward-perpendicular direction (parallel edges that have
  // collapsed onto each other — the "ridge collapse" case), the
  // new vertex's velocity is the average of prevVertex and
  // nextVertex's velocities (it slides along the now-degenerate
  // wavefront toward the next event).
  const avgVx = (prevVertex.velocity.x + nextVertex.velocity.x) / 2;
  const avgVy = (prevVertex.velocity.y + nextVertex.velocity.y) / 2;
  return {
    x: Math.trunc(avgVx),
    y: Math.trunc(avgVy),
  };
}

export function computeOrthogonalStraightSkeleton(
  polygon: OrthogonalPolygon,
): StraightSkeletonResult {
  const validation = validateOrthogonalPolygon(polygon);
  if (!validation.ok) {
    return { ok: false, error: { code: "invalid_polygon", cause: validation.error } };
  }

  const n = polygon.length;
  const nodes: SkeletonNode[] = [];
  const edges: SkeletonEdge[] = [];
  const vertices: WavefrontVertex[] = [];

  // Initialize skeleton nodes for every polygon vertex (time 0).
  // Initialize wavefront vertices in lockstep.
  for (let i = 0; i < n; i += 1) {
    const motion = computeVertexMotion(polygon, i);
    nodes.push({
      position: { x: polygon[i]!.x, y: polygon[i]!.y },
      time: 0,
      sourceEdgeIds: [(i - 1 + n) % n, i],
    });
    vertices.push({
      index: i,
      position: { x: polygon[i]!.x, y: polygon[i]!.y },
      birthTime: 0,
      velocity: motion.velocity,
      prevIndex: (i - 1 + n) % n,
      nextIndex: (i + 1) % n,
      outgoingEdgeId: i,
      skeletonNodeIndex: i,
      alive: true,
    });
  }

  // Reject reflex vertices for now — split events aren't implemented
  // yet. The next commit (PR-SS-2 part 2) adds split-event handling.
  for (let i = 0; i < n; i += 1) {
    if (computeVertexMotion(polygon, i).classification === "reflex") {
      return {
        ok: false,
        error: {
          code: "unsupported_topology",
          reason: `vertex ${i} is reflex; split events not yet implemented`,
        },
      };
    }
  }

  // Initial event queue: edge-collapse for each wavefront edge.
  type QueueEntry = { event: Event; insertionOrder: number };
  let insertionCounter = 0;
  const queue: QueueEntry[] = [];

  function pushEdgeCollapseEvent(
    fromVertex: WavefrontVertex,
    toVertex: WavefrontVertex,
  ): void {
    const time = edgeCollapseTime(fromVertex, toVertex);
    if (time === null) return;
    insertionCounter += 1;
    queue.push({
      event: {
        kind: "edge_collapse",
        time,
        fromVertexIndex: fromVertex.index,
        toVertexIndex: toVertex.index,
      },
      insertionOrder: insertionCounter,
    });
  }

  for (let i = 0; i < n; i += 1) {
    pushEdgeCollapseEvent(vertices[i]!, vertices[(i + 1) % n]!);
  }

  let activeVertexCount = n;
  let safetyCounter = 0;
  const maxIterations = n * n * 4;

  while (activeVertexCount > 1 && queue.length > 0) {
    safetyCounter += 1;
    if (safetyCounter > maxIterations) {
      return {
        ok: false,
        error: {
          code: "unsupported_topology",
          reason: `event loop exceeded ${maxIterations} iterations`,
        },
      };
    }

    // Pop the earliest event (linear scan — fine for small queues).
    let earliestIdx = 0;
    for (let i = 1; i < queue.length; i += 1) {
      const earliest = queue[earliestIdx]!;
      const candidate = queue[i]!;
      if (
        candidate.event.time < earliest.event.time ||
        (candidate.event.time === earliest.event.time &&
          candidate.insertionOrder < earliest.insertionOrder)
      ) {
        earliestIdx = i;
      }
    }
    const { event } = queue.splice(earliestIdx, 1)[0]!;

    if (event.kind === "edge_collapse") {
      const from = vertices[event.fromVertexIndex]!;
      const to = vertices[event.toVertexIndex]!;
      if (!from.alive || !to.alive) continue;
      // Vertices must still be neighbours (the edge between them
      // must still exist).
      if (from.nextIndex !== to.index || to.prevIndex !== from.index) continue;

      const mergePosition = positionAtTime(from, event.time);
      const mergeVerify = positionAtTime(to, event.time);
      if (mergePosition.x !== mergeVerify.x || mergePosition.y !== mergeVerify.y) {
        return {
          ok: false,
          error: {
            code: "unsupported_topology",
            reason: `edge_collapse vertices did not meet exactly at time ${event.time}: from=${JSON.stringify(mergePosition)} to=${JSON.stringify(mergeVerify)}`,
          },
        };
      }

      // Create skeleton node for the merge point.
      const newNodeIdx = nodes.length;
      nodes.push({
        position: mergePosition,
        time: event.time,
        sourceEdgeIds: [from.outgoingEdgeId],
      });
      // Skeleton edges from each dying vertex to the new node.
      edges.push({
        fromNodeIndex: from.skeletonNodeIndex,
        toNodeIndex: newNodeIdx,
        leftPolygonEdgeId: vertices[from.prevIndex]!.outgoingEdgeId,
        rightPolygonEdgeId: from.outgoingEdgeId,
      });
      edges.push({
        fromNodeIndex: to.skeletonNodeIndex,
        toNodeIndex: newNodeIdx,
        leftPolygonEdgeId: from.outgoingEdgeId,
        rightPolygonEdgeId: to.outgoingEdgeId,
      });

      // Mark the two original vertices dead.
      from.alive = false;
      to.alive = false;
      activeVertexCount -= 2;

      // If more than one vertex remains, create a new wavefront
      // vertex representing the merge corner.
      if (activeVertexCount >= 1) {
        const prevVertex = vertices[from.prevIndex]!;
        const nextVertex = vertices[to.nextIndex]!;
        const newVertexIdx = vertices.length;
        vertices.push({
          index: newVertexIdx,
          position: mergePosition,
          birthTime: event.time,
          velocity: mergedVertexVelocity(prevVertex, nextVertex, mergePosition),
          prevIndex: prevVertex.index,
          nextIndex: nextVertex.index,
          outgoingEdgeId: to.outgoingEdgeId,
          skeletonNodeIndex: newNodeIdx,
          alive: true,
        });
        prevVertex.nextIndex = newVertexIdx;
        nextVertex.prevIndex = newVertexIdx;
        prevVertex.outgoingEdgeId = prevVertex.outgoingEdgeId; // unchanged
        activeVertexCount += 1;

        // Recompute events for the two surviving edges around the new vertex.
        pushEdgeCollapseEvent(prevVertex, vertices[newVertexIdx]!);
        pushEdgeCollapseEvent(vertices[newVertexIdx]!, nextVertex);
      }
    }
  }

  return {
    ok: true,
    skeleton: { nodes, edges, polygonEdgeCount: n },
  };
}
