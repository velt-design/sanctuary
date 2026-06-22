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
 * solver. Part 2 adds split events (reflex vertices) and ridge
 * finalization, so L / T / U / H / + composites solve — not just
 * rectangles.
 *
 * Algorithm (event-driven wavefront contraction):
 *
 *   1. Initialize the wavefront from the polygon: every vertex is an
 *      active wavefront vertex with a position, a ±1/±1 bisector
 *      velocity, and prev/next pointers into one circular doubly
 *      linked list. (After a split the single list holds two
 *      independent loops — no separate sub-polygon structures.)
 *   2. Seed the event queue with an EDGE_COLLAPSE per wavefront edge
 *      and a SPLIT per reflex vertex.
 *   3. Pop the earliest event (ties broken by insertion order —
 *      deterministic, and correctness does not depend on the order):
 *        - EDGE_COLLAPSE: the two endpoints meet; merge into one
 *          skeleton node, spawn the merged corner, re-queue its edges.
 *        - SPLIT: a reflex vertex reaches the interior of an opposing
 *          eave; cut that eave, producing two loops that evolve on.
 *   4. After every event, resolve coincidences: any two non-adjacent
 *      wavefront vertices that have arrived at the same point are a
 *      vertex event (split the loop at that point). This is how the
 *      degenerate simultaneous coincidences (the symmetric-L canary,
 *      square centre) are handled without perturbation.
 *   5. A loop that reduces to two vertices is a finished ridge: emit
 *      the final ridge edge and retire it.
 *
 * Exactness / the integer-mm guarantee
 * ------------------------------------
 * Orthogonal-skeleton event times and node coordinates are always
 * half-integers (every wavefront edge is a translate of an integer
 * axis-aligned polygon edge; a node's time is half the gap between two
 * parallel edges). We therefore solve in an internal 2x coordinate
 * space where every event time and position is an exact integer, with
 * a guard that rejects any time that is not integral in 2x space
 * (`time_not_integral_in_2x`) rather than silently rounding mid-solve.
 * Only at output do we halve and round to the nearest millimetre — a
 * skeleton node can genuinely fall on a half-mm (e.g. a 10x5 rect),
 * and sub-mm rounding is invisible at roof scale. This isolates the
 * one documented rounding step and keeps the internal solve exact and
 * deterministic.
 *
 * Known limitation (part 2)
 * -------------------------
 * Perfectly symmetric shapes where an entire eave-pair collapses to a
 * ridge line in a single instant AND reflex valleys arrive at that
 * same instant/point (e.g. a T whose bar is exactly twice as tall as
 * the ridge offset, with a centred stem) are not yet handled: the
 * solver returns a typed `unsupported_topology` error rather than a
 * wrong skeleton, so the orchestrator (PR-SS-4) can fall back. The
 * 4-way coincidence of the symmetric-L canary IS handled (vertex
 * events); the open case is the N-way simultaneous ridge-line
 * collapse. Real designer composites are not perfectly symmetric
 * (e.g. Graham–Oratia is 12500x8000 + 5814x2400), so this does not
 * block the composition corpus; closing it is tracked for a follow-up.
 */

type StraightSkeletonError =
  | { code: "invalid_polygon"; cause: OrthogonalPolygonValidationError }
  | { code: "unsupported_topology"; reason: string };

type StraightSkeletonResult =
  | { ok: true; skeleton: StraightSkeleton }
  | { ok: false; error: StraightSkeletonError };

/** Internal coordinate scale (see exactness note above). */
const SCALE = 2;

type WavefrontVertex = {
  /** Stable index in `vertices`. Used by skeleton edges. */
  index: number;
  /** Position (2x space) at `birthTime`. Position at time t is `position + velocity·(t − birthTime)`. */
  position: IntegerPoint2D;
  birthTime: number;
  velocity: IntegerPoint2D;
  prevIndex: number;
  nextIndex: number;
  /**
   * Polygon edge id of the edge between THIS vertex and its NEXT
   * vertex. Survives merges/splits so skeleton edges keep the
   * original eave attribution.
   */
  outgoingEdgeId: number;
  /** Inward unit normal (±1 on one axis) of the outgoing edge. */
  outgoingEdgeNormal: IntegerPoint2D;
  /** Skeleton-node index this wavefront vertex was born at. */
  skeletonNodeIndex: number;
  alive: boolean;
};

type EdgeCollapseEvent = {
  kind: "edge_collapse";
  time: number;
  fromVertexIndex: number;
  toVertexIndex: number;
};

type SplitEvent = {
  kind: "split";
  time: number;
  reflexVertexIndex: number;
};

type Event = EdgeCollapseEvent | SplitEvent;

function positionAtTime(vertex: WavefrontVertex, time: number): IntegerPoint2D {
  const dt = time - vertex.birthTime;
  return {
    x: vertex.position.x + vertex.velocity.x * dt,
    y: vertex.position.y + vertex.velocity.y * dt,
  };
}

/** Inward unit normal of the directed edge p→q for a CCW polygon
 * (interior on the left): rotate the edge direction +90°. */
function inwardNormal(p: IntegerPoint2D, q: IntegerPoint2D): IntegerPoint2D {
  return { x: -Math.sign(q.y - p.y), y: Math.sign(q.x - p.x) };
}

/**
 * Time at which the wavefront edge a→b collapses to zero length, or
 * null if it never does. Edges stay axis-aligned, so the collapse is
 * governed by the closing velocity along the edge's axis.
 */
function edgeCollapseTime(a: WavefrontVertex, b: WavefrontVertex): number | null {
  const refTime = Math.max(a.birthTime, b.birthTime);
  const aRef = positionAtTime(a, refTime);
  const bRef = positionAtTime(b, refTime);
  const edgeDx = bRef.x - aRef.x;
  const edgeDy = bRef.y - aRef.y;
  const closingVx = a.velocity.x - b.velocity.x;
  const closingVy = a.velocity.y - b.velocity.y;
  if (edgeDy === 0) {
    if (closingVx === 0) return null;
    const dt = edgeDx / closingVx;
    if (dt <= 0) return null;
    return refTime + dt;
  }
  if (edgeDx === 0) {
    if (closingVy === 0) return null;
    const dt = edgeDy / closingVy;
    if (dt <= 0) return null;
    return refTime + dt;
  }
  // A non-axis-aligned wavefront edge means the algorithm produced an
  // inconsistent corner — should not happen for orthogonal input.
  return null;
}

/**
 * Velocity of the corner formed by merging the two ENDPOINTS of a
 * collapsing edge. For an orthogonal polygon the surviving edges
 * around such a corner are always parallel (edges alternate H/V), so
 * the merged vertex is a ridge vertex that slides along the ridge.
 * The slide velocity is the average of the two dying vertices'
 * velocities — their shared axis component (±1) is the ridge
 * direction, the opposing component cancels to 0.
 */
function ridgeMergeVelocity(
  dyingA: WavefrontVertex,
  dyingB: WavefrontVertex,
): IntegerPoint2D {
  return {
    x: (dyingA.velocity.x + dyingB.velocity.x) / 2,
    y: (dyingA.velocity.y + dyingB.velocity.y) / 2,
  };
}

/**
 * Velocity of a corner whose two edges are perpendicular — every
 * convex corner created by a split or a vertex event: the sum of the
 * two edges' inward unit normals (±1 on each axis).
 */
function cornerVelocity(
  incomingEdgeNormal: IntegerPoint2D,
  outgoingEdgeNormal: IntegerPoint2D,
): IntegerPoint2D {
  return {
    x: incomingEdgeNormal.x + outgoingEdgeNormal.x,
    y: incomingEdgeNormal.y + outgoingEdgeNormal.y,
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
  // Work in 2x integer space so every event time / node position is
  // an exact integer (see module note). Input is already validated
  // integer, so scaled coords are exact.
  const scaled = polygon.map((p) => ({ x: p.x * SCALE, y: p.y * SCALE }));

  const nodes: SkeletonNode[] = [];
  const edges: SkeletonEdge[] = [];
  const vertices: WavefrontVertex[] = [];

  for (let i = 0; i < n; i += 1) {
    const motion = computeVertexMotion(polygon, i);
    const cur = scaled[i]!;
    const next = scaled[(i + 1) % n]!;
    nodes.push({
      position: { x: cur.x, y: cur.y },
      time: 0,
      sourceEdgeIds: [(i - 1 + n) % n, i],
    });
    vertices.push({
      index: i,
      position: { x: cur.x, y: cur.y },
      birthTime: 0,
      velocity: motion.velocity,
      prevIndex: (i - 1 + n) % n,
      nextIndex: (i + 1) % n,
      outgoingEdgeId: i,
      outgoingEdgeNormal: inwardNormal(cur, next),
      skeletonNodeIndex: i,
      alive: true,
    });
  }

  let insertionCounter = 0;
  type QueueEntry = { event: Event; insertionOrder: number };
  const queue: QueueEntry[] = [];

  let failure: StraightSkeletonError | null = null;

  /** Guard: every chosen event time must be an exact integer in 2x
   * space, else the half-integer assumption was violated. */
  function assertIntegralTime(time: number, context: string): boolean {
    if (!Number.isInteger(time)) {
      failure = {
        code: "unsupported_topology",
        reason: `time_not_integral_in_2x: ${context} produced t=${time}`,
      };
      return false;
    }
    return true;
  }

  function pushEvent(event: Event): void {
    insertionCounter += 1;
    queue.push({ event, insertionOrder: insertionCounter });
  }

  function pushEdgeCollapse(from: WavefrontVertex, to: WavefrontVertex): void {
    const time = edgeCollapseTime(from, to);
    if (time === null) return;
    if (!assertIntegralTime(time, "edge_collapse")) return;
    pushEvent({ kind: "edge_collapse", time, fromVertexIndex: from.index, toVertexIndex: to.index });
  }

  /**
   * Earliest time at which reflex vertex R reaches the STRICT interior
   * of a non-incident wavefront edge (a split). Coincidences with a
   * vertex (edge endpoint) are intentionally excluded here — they are
   * handled by the coincidence pass as vertex events.
   */
  function findSplit(reflex: WavefrontVertex, afterTime: number): SplitEvent | null {
    let best: { time: number } | null = null;
    for (const edge of vertices) {
      if (!edge.alive) continue;
      const a = edge;
      const b = vertices[edge.nextIndex]!;
      if (!b.alive) continue;
      // Skip edges incident to the reflex vertex.
      if (a.index === reflex.index || b.index === reflex.index) continue;
      if (a.index === reflex.prevIndex && b.index === reflex.index) continue;

      const refTime = Math.max(a.birthTime, b.birthTime, reflex.birthTime);
      const aRef = positionAtTime(a, refTime);
      const bRef = positionAtTime(b, refTime);
      const rRef = positionAtTime(reflex, refTime);
      let time: number | null = null;
      let pos: IntegerPoint2D | null = null;
      if (aRef.y === bRef.y) {
        // Horizontal edge at y = aRef.y, moving with a.velocity.y.
        const rate = a.velocity.y - reflex.velocity.y;
        if (rate === 0) continue;
        const dt = (rRef.y - aRef.y) / rate;
        if (dt <= 0) continue;
        const t = refTime + dt;
        const rx = rRef.x + reflex.velocity.x * dt;
        const ax = aRef.x + a.velocity.x * dt;
        const bx = bRef.x + b.velocity.x * dt;
        const lo = Math.min(ax, bx);
        const hi = Math.max(ax, bx);
        if (rx <= lo || rx >= hi) continue; // strict interior only
        time = t;
        pos = { x: rx, y: rRef.y + reflex.velocity.y * dt };
      } else if (aRef.x === bRef.x) {
        const rate = a.velocity.x - reflex.velocity.x;
        if (rate === 0) continue;
        const dt = (rRef.x - aRef.x) / rate;
        if (dt <= 0) continue;
        const t = refTime + dt;
        const ry = rRef.y + reflex.velocity.y * dt;
        const ay = aRef.y + a.velocity.y * dt;
        const by = bRef.y + b.velocity.y * dt;
        const lo = Math.min(ay, by);
        const hi = Math.max(ay, by);
        if (ry <= lo || ry >= hi) continue;
        time = t;
        pos = { x: rRef.x + reflex.velocity.x * dt, y: ry };
      } else {
        continue;
      }
      if (time === null || pos === null) continue;
      if (time <= afterTime) continue;
      if (best === null || time < best.time) best = { time };
    }
    if (best === null) return null;
    return { kind: "split", time: best.time, reflexVertexIndex: reflex.index };
  }

  function isReflex(v: WavefrontVertex): boolean {
    // A reflex wavefront vertex is one whose two edges are
    // perpendicular and turn clockwise — equivalently the cross
    // product of incoming→outgoing edge normals is negative. For our
    // purposes, recompute against current neighbours.
    const prev = vertices[v.prevIndex]!;
    const inNormal = prev.outgoingEdgeNormal;
    const outNormal = v.outgoingEdgeNormal;
    // Reflex iff the corner velocity (normal sum) points "outward"
    // relative to a convex corner. Detect via the cross product of the
    // two normals: convex corners turn one way, reflex the other.
    const cross = inNormal.x * outNormal.y - inNormal.y * outNormal.x;
    return cross < 0;
  }

  function scheduleSplitsForReflexVertices(afterTime: number): void {
    for (const v of vertices) {
      if (!v.alive) continue;
      if (!isReflex(v)) continue;
      const split = findSplit(v, afterTime);
      if (split && assertIntegralTime(split.time, "split")) pushEvent(split);
    }
  }

  // Seed events.
  for (let i = 0; i < n; i += 1) {
    pushEdgeCollapse(vertices[i]!, vertices[vertices[i]!.nextIndex]!);
  }
  scheduleSplitsForReflexVertices(0);

  let activeVertexCount = n;
  let safetyCounter = 0;
  const maxIterations = n * n * 16 + 64;

  // Create a new skeleton node and return its index.
  function addNode(position: IntegerPoint2D, time: number, sourceEdgeIds: number[]): number {
    const idx = nodes.length;
    nodes.push({ position, time, sourceEdgeIds });
    return idx;
  }

  function addSkeletonEdge(
    fromNodeIndex: number,
    toNodeIndex: number,
    leftPolygonEdgeId: number,
    rightPolygonEdgeId: number,
  ): void {
    if (fromNodeIndex === toNodeIndex) return;
    if (
      nodes[fromNodeIndex]!.position.x === nodes[toNodeIndex]!.position.x &&
      nodes[fromNodeIndex]!.position.y === nodes[toNodeIndex]!.position.y
    ) {
      return; // skip zero-length edges (degenerate ridge, e.g. square)
    }
    edges.push({ fromNodeIndex, toNodeIndex, leftPolygonEdgeId, rightPolygonEdgeId });
  }

  /** If `survivor` now sits in a 2-vertex loop, emit the final ridge
   * edge and retire both. Returns true if it finalized. */
  function finalizeIfTwoCycle(survivor: WavefrontVertex): boolean {
    const other = vertices[survivor.nextIndex]!;
    if (!other.alive || !survivor.alive) return false;
    if (other.nextIndex !== survivor.index) return false; // not a 2-cycle
    addSkeletonEdge(
      survivor.skeletonNodeIndex,
      other.skeletonNodeIndex,
      survivor.outgoingEdgeId,
      other.outgoingEdgeId,
    );
    survivor.alive = false;
    other.alive = false;
    activeVertexCount -= 2;
    return true;
  }

  function handleEdgeCollapse(event: EdgeCollapseEvent): void {
    const from = vertices[event.fromVertexIndex]!;
    const to = vertices[event.toVertexIndex]!;
    if (!from.alive || !to.alive) return;
    if (from.nextIndex !== to.index || to.prevIndex !== from.index) return;

    const mergePos = positionAtTime(from, event.time);
    const verify = positionAtTime(to, event.time);
    if (mergePos.x !== verify.x || mergePos.y !== verify.y) {
      failure = {
        code: "unsupported_topology",
        reason: `edge_collapse endpoints did not meet at t=${event.time}: ${JSON.stringify(mergePos)} vs ${JSON.stringify(verify)}`,
      };
      return;
    }

    const newNodeIdx = addNode(mergePos, event.time, [from.outgoingEdgeId]);
    addSkeletonEdge(
      from.skeletonNodeIndex,
      newNodeIdx,
      vertices[from.prevIndex]!.outgoingEdgeId,
      from.outgoingEdgeId,
    );
    addSkeletonEdge(to.skeletonNodeIndex, newNodeIdx, from.outgoingEdgeId, to.outgoingEdgeId);

    const prevVertex = vertices[from.prevIndex]!;
    const nextVertex = vertices[to.nextIndex]!;
    from.alive = false;
    to.alive = false;
    activeVertexCount -= 2;

    if (activeVertexCount <= 0) return;

    const merged: WavefrontVertex = {
      index: vertices.length,
      position: mergePos,
      birthTime: event.time,
      velocity: ridgeMergeVelocity(from, to),
      prevIndex: prevVertex.index,
      nextIndex: nextVertex.index,
      outgoingEdgeId: to.outgoingEdgeId,
      outgoingEdgeNormal: to.outgoingEdgeNormal,
      skeletonNodeIndex: newNodeIdx,
      alive: true,
    };
    vertices.push(merged);
    prevVertex.nextIndex = merged.index;
    nextVertex.prevIndex = merged.index;
    activeVertexCount += 1;

    if (finalizeIfTwoCycle(merged)) return;
    pushEdgeCollapse(prevVertex, merged);
    pushEdgeCollapse(merged, nextVertex);
  }

  function handleSplit(event: SplitEvent): void {
    const reflex = vertices[event.reflexVertexIndex]!;
    if (!reflex.alive) return;
    if (!isReflex(reflex)) return;

    // Validity is decided by geometry at processing time, NOT by
    // re-deriving the event time: when a split is simultaneous with an
    // edge collapse that extends the hit eave, the reflex is already
    // sitting on the eave (dt=0) and a re-derivation would wrongly
    // discard it. Instead, find the edge a→b whose strict interior the
    // reflex occupies right now; if none, this event is stale.
    const rPos = positionAtTime(reflex, event.time);
    let aIndex = -1;
    for (const edge of vertices) {
      if (!edge.alive) continue;
      const a = edge;
      const b = vertices[edge.nextIndex]!;
      if (!b.alive) continue;
      if (a.index === reflex.index || b.index === reflex.index) continue;
      if (a.index === reflex.prevIndex && b.index === reflex.index) continue;
      const ap = positionAtTime(a, event.time);
      const bp = positionAtTime(b, event.time);
      if (ap.y === bp.y && rPos.y === ap.y) {
        const lo = Math.min(ap.x, bp.x);
        const hi = Math.max(ap.x, bp.x);
        if (rPos.x > lo && rPos.x < hi) {
          aIndex = a.index;
          break;
        }
      } else if (ap.x === bp.x && rPos.x === ap.x) {
        const lo = Math.min(ap.y, bp.y);
        const hi = Math.max(ap.y, bp.y);
        if (rPos.y > lo && rPos.y < hi) {
          aIndex = a.index;
          break;
        }
      }
    }
    if (aIndex < 0) return;

    const a = vertices[aIndex]!;
    const b = vertices[a.nextIndex]!;
    const p = vertices[reflex.prevIndex]!;
    const q = vertices[reflex.nextIndex]!;

    const splitNodeIdx = addNode(rPos, event.time, [a.outgoingEdgeId, reflex.outgoingEdgeId]);
    // Valley from the reflex vertex to the split point. The valley
    // separates the reflex vertex's OWN two eaves (its incoming edge
    // `p.outgoingEdgeId` and its outgoing edge `reflex.outgoingEdgeId`)
    // — not the hit edge. Correct left/right attribution is what lets
    // the roof translator (PR-SS-3) collect each facet's boundary.
    addSkeletonEdge(
      reflex.skeletonNodeIndex,
      splitNodeIdx,
      p.outgoingEdgeId,
      reflex.outgoingEdgeId,
    );
    reflex.alive = false;
    activeVertexCount -= 1;

    // Loop 1 (carries the reflex's outgoing edge toward q):
    //   a → s1 → q → … → a    with edge(a→s1)=a.edgeId, edge(s1→q)=reflex.edgeId
    const s1: WavefrontVertex = {
      index: vertices.length,
      position: rPos,
      birthTime: event.time,
      velocity: cornerVelocity(a.outgoingEdgeNormal, reflex.outgoingEdgeNormal),
      prevIndex: a.index,
      nextIndex: q.index,
      outgoingEdgeId: reflex.outgoingEdgeId,
      outgoingEdgeNormal: reflex.outgoingEdgeNormal,
      skeletonNodeIndex: splitNodeIdx,
      alive: true,
    };
    vertices.push(s1);
    // Loop 2 (carries the reflex's incoming edge from p):
    //   p → s2 → b → … → p    with edge(p→s2)=p.edgeId, edge(s2→b)=a.edgeId
    const s2: WavefrontVertex = {
      index: vertices.length,
      position: rPos,
      birthTime: event.time,
      velocity: cornerVelocity(p.outgoingEdgeNormal, a.outgoingEdgeNormal),
      prevIndex: p.index,
      nextIndex: b.index,
      outgoingEdgeId: a.outgoingEdgeId,
      outgoingEdgeNormal: a.outgoingEdgeNormal,
      skeletonNodeIndex: splitNodeIdx,
      alive: true,
    };
    vertices.push(s2);
    activeVertexCount += 2;

    a.nextIndex = s1.index;
    q.prevIndex = s1.index;
    p.nextIndex = s2.index;
    b.prevIndex = s2.index;

    for (const v of [s1, s2]) {
      if (!v.alive) continue;
      if (finalizeIfTwoCycle(v)) continue;
      pushEdgeCollapse(vertices[v.prevIndex]!, v);
      pushEdgeCollapse(v, vertices[v.nextIndex]!);
    }
  }

  /**
   * Vertex event: two non-adjacent alive vertices have arrived at the
   * same point. Merge them into one node and split their shared loop
   * into two. Returns true if a coincidence was resolved.
   */
  function resolveCoincidence(time: number): boolean {
    const alive = vertices.filter((v) => v.alive);
    for (let i = 0; i < alive.length; i += 1) {
      for (let j = i + 1; j < alive.length; j += 1) {
        const u = alive[i]!;
        const w = alive[j]!;
        if (!u.alive || !w.alive) continue;
        // Only vertices that arrived at the point by MOTION are a
        // coincidence. Vertices freshly born at this instant (the
        // s1/s2/m1/m2 outputs of a split or vertex event) legitimately
        // share the split point and must not be re-merged — that would
        // loop forever.
        if (u.birthTime >= time || w.birthTime >= time) continue;
        if (u.nextIndex === w.index || u.prevIndex === w.index) continue; // adjacent → edge collapse
        const up = positionAtTime(u, time);
        const wp = positionAtTime(w, time);
        if (up.x !== wp.x || up.y !== wp.y) continue;

        const mergePos = up;
        const nodeIdx = addNode(mergePos, time, [u.outgoingEdgeId, w.outgoingEdgeId]);
        addSkeletonEdge(u.skeletonNodeIndex, nodeIdx, vertices[u.prevIndex]!.outgoingEdgeId, u.outgoingEdgeId);
        addSkeletonEdge(w.skeletonNodeIndex, nodeIdx, vertices[w.prevIndex]!.outgoingEdgeId, w.outgoingEdgeId);

        const up_ = vertices[u.prevIndex]!;
        const un = vertices[u.nextIndex]!;
        const wp_ = vertices[w.prevIndex]!;
        const wn = vertices[w.nextIndex]!;
        u.alive = false;
        w.alive = false;
        activeVertexCount -= 2;

        // Loop 1: …→ wp_ → m1 → un → …   (the arc from u.next around to w)
        const m1: WavefrontVertex = {
          index: vertices.length,
          position: mergePos,
          birthTime: time,
          velocity: cornerVelocity(wp_.outgoingEdgeNormal, u.outgoingEdgeNormal),
          prevIndex: wp_.index,
          nextIndex: un.index,
          outgoingEdgeId: u.outgoingEdgeId,
          outgoingEdgeNormal: u.outgoingEdgeNormal,
          skeletonNodeIndex: nodeIdx,
          alive: true,
        };
        vertices.push(m1);
        // Loop 2: …→ up_ → m2 → wn → …
        const m2: WavefrontVertex = {
          index: vertices.length,
          position: mergePos,
          birthTime: time,
          velocity: cornerVelocity(up_.outgoingEdgeNormal, w.outgoingEdgeNormal),
          prevIndex: up_.index,
          nextIndex: wn.index,
          outgoingEdgeId: w.outgoingEdgeId,
          outgoingEdgeNormal: w.outgoingEdgeNormal,
          skeletonNodeIndex: nodeIdx,
          alive: true,
        };
        vertices.push(m2);
        activeVertexCount += 2;

        wp_.nextIndex = m1.index;
        un.prevIndex = m1.index;
        up_.nextIndex = m2.index;
        wn.prevIndex = m2.index;

        for (const v of [m1, m2]) {
          if (!v.alive) continue;
          if (finalizeIfTwoCycle(v)) continue;
          pushEdgeCollapse(vertices[v.prevIndex]!, v);
          pushEdgeCollapse(v, vertices[v.nextIndex]!);
        }
        return true;
      }
    }
    return false;
  }

  while (activeVertexCount > 1 && queue.length > 0) {
    safetyCounter += 1;
    if (safetyCounter > maxIterations) {
      return {
        ok: false,
        error: { code: "unsupported_topology", reason: `event loop exceeded ${maxIterations} iterations` },
      };
    }

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
      handleEdgeCollapse(event);
    } else {
      handleSplit(event);
    }
    if (failure) return { ok: false, error: failure };

    // Resolve any coincidences created at this time, then reschedule
    // split events for the (possibly changed) reflex set.
    while (resolveCoincidence(event.time)) {
      if (failure) return { ok: false, error: failure };
    }
    // Any event can change the wavefront enough to enable a new split
    // (e.g. an edge collapse extends an eave into a reflex vertex's
    // path), so reschedule splits after every event. Stale duplicates
    // are filtered when processed.
    scheduleSplitsForReflexVertices(event.time);
    if (failure) return { ok: false, error: failure };
  }

  // Completeness invariant: a correct wavefront contracts to nothing —
  // every vertex is consumed by an event (the last ridge edges retire
  // their pairs). If alive vertices remain with the queue drained, a
  // convergence was left unresolved (e.g. the +/H centre); the skeleton
  // graph would be incomplete (dangling ridge ends, overlapping facets).
  // Fail loudly with a typed error rather than returning a broken graph.
  const remaining = vertices.filter((v) => v.alive).length;
  if (remaining > 0) {
    return {
      ok: false,
      error: {
        code: "unsupported_topology",
        reason: `incomplete_wavefront: ${remaining} vertices unconsumed (unresolved convergence)`,
      },
    };
  }

  // Output: halve the 2x coordinates back to millimetres, rounding the
  // genuine half-mm nodes to the nearest integer (documented contract).
  const outNodes: SkeletonNode[] = nodes.map((node) => ({
    position: { x: Math.round(node.position.x / SCALE), y: Math.round(node.position.y / SCALE) },
    time: node.time / SCALE,
    sourceEdgeIds: node.sourceEdgeIds,
  }));

  return {
    ok: true,
    skeleton: { nodes: outNodes, edges, polygonEdgeCount: n },
  };
}
