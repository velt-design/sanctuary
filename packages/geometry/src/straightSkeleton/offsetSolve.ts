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
 * PR-SS-2 part 3 (2026-06-20): equidistance / offset-line orthogonal
 * straight-skeleton solver — the convergence rework.
 *
 * WHY A REWRITE. The kinematic-vertex solver (`solve.ts`) tracks each
 * wavefront vertex with an independent velocity. That is exact for edge
 * collapses (a ridge vertex inherits the well-defined "avg-of-dying"
 * along-ridge velocity) but breaks at convergences (the +/H centre),
 * where a ridge vertex is born from a coincidence of non-adjacent
 * vertices and its along-ridge SLIDE is globally determined — provably
 * not computable from any local velocity rule (decision-log PR-SS-2 p3).
 *
 * THE MODEL. Track the wavefront as a cyclic list of MOVING EDGES
 * (offset lines), not vertices. Each edge is axis-aligned with a fixed
 * coordinate and inward normal; at time t its line is at `coord+sign·t`.
 * A vertex is the INTERSECTION of two consecutive edges' lines — derived,
 * never a guessed velocity. Orthogonal ⇒ consecutive edges alternate
 * axes ⇒ every vertex is a clean perpendicular intersection. Ridge
 * "vertices" (two adjacent parallel edges, formed transiently by an edge
 * collapse) are resolved by the next event, never assigned a velocity.
 *
 * EXACTNESS. Solve in 2x integer space (event times integral; guarded);
 * halve+round at output — same contract as `solve.ts`.
 *
 * STATUS: under construction behind `offsetSolve.test.ts`. Not wired;
 * `index.ts` keeps exporting the kinematic solver until this reaches
 * parity on rect/L/T/U AND solves +/H.
 *
 * This commit implements the CONVEX case (rectangles): edge events +
 * the 2-edge ridge finalization. Reflex/split and convergence land next.
 */

export type OffsetSkeletonError =
  | { code: "invalid_polygon"; cause: OrthogonalPolygonValidationError }
  | { code: "unsupported_topology"; reason: string };

export type OffsetSkeletonResult =
  | { ok: true; skeleton: StraightSkeleton }
  | { ok: false; error: OffsetSkeletonError };

const SCALE = 2;

type WEdge = {
  index: number;
  axis: "H" | "V";
  /** Moving coordinate at birthTime: y for H, x for V. */
  coord: number;
  /** Inward normal sign on the edge's constant axis (+1 / −1). */
  sign: number;
  birthTime: number;
  polygonEdgeId: number;
  prevIndex: number;
  nextIndex: number;
  alive: boolean;
  /** Skeleton node at this edge's START vertex (prev ∩ this). */
  startNodeIndex: number;
};

function edgeOffset(e: WEdge, time: number): number {
  return e.coord + e.sign * (time - e.birthTime);
}

/** Inward normal (constant-axis coord + sign) of CCW edge a→b. */
function edgeNormal(a: IntegerPoint2D, b: IntegerPoint2D): {
  axis: "H" | "V";
  coord: number;
  sign: number;
} {
  if (a.y === b.y) {
    // Horizontal edge at y = a.y. CCW interior is on the left of a→b:
    // going +x ⇒ interior above (+y); going −x ⇒ below (−y).
    return { axis: "H", coord: a.y, sign: b.x > a.x ? 1 : -1 };
  }
  // Vertical edge at x = a.x. Going +y ⇒ interior left (−x); −y ⇒ +x.
  return { axis: "V", coord: a.x, sign: b.y > a.y ? -1 : 1 };
}

export function computeOrthogonalStraightSkeletonOffset(
  polygon: OrthogonalPolygon,
): OffsetSkeletonResult {
  const validation = validateOrthogonalPolygon(polygon);
  if (!validation.ok) {
    return { ok: false, error: { code: "invalid_polygon", cause: validation.error } };
  }
  const n = polygon.length;
  const scaled = polygon.map((p) => ({ x: p.x * SCALE, y: p.y * SCALE }));

  const nodes: SkeletonNode[] = [];
  const edges: SkeletonEdge[] = [];
  const wedges: WEdge[] = [];

  for (let i = 0; i < n; i += 1) {
    const a = scaled[i]!;
    const b = scaled[(i + 1) % n]!;
    const nrm = edgeNormal(a, b);
    nodes.push({ position: { x: a.x, y: a.y }, time: 0, sourceEdgeIds: [(i - 1 + n) % n, i] });
    wedges.push({
      index: i,
      axis: nrm.axis,
      coord: nrm.coord,
      sign: nrm.sign,
      birthTime: 0,
      polygonEdgeId: i,
      prevIndex: (i - 1 + n) % n,
      nextIndex: (i + 1) % n,
      alive: true,
      startNodeIndex: i,
    });
  }

  let failure: OffsetSkeletonError | null = null;
  function fail(reason: string): void {
    if (!failure) failure = { code: "unsupported_topology", reason };
  }

  function addNode(position: IntegerPoint2D, time: number, sourceEdgeIds: number[]): number {
    const idx = nodes.length;
    nodes.push({ position, time, sourceEdgeIds });
    return idx;
  }

  function addSkeletonEdge(from: number, to: number, left: number, right: number): void {
    if (from === to) return;
    const pf = nodes[from]!.position;
    const pt = nodes[to]!.position;
    if (pf.x === pt.x && pf.y === pt.y) return;
    edges.push({ fromNodeIndex: from, toNodeIndex: to, leftPolygonEdgeId: left, rightPolygonEdgeId: right });
  }

  /**
   * Time at which edge E collapses to zero length: when its two
   * (perpendicular) neighbours' offset lines coincide. Returns null if
   * they never meet in the future, or if a neighbour is parallel to E
   * (a transient ridge, resolved by another event).
   */
  function collapseTime(e: WEdge): number | null {
    const p = wedges[e.prevIndex]!;
    const nn = wedges[e.nextIndex]!;
    if (!p.alive || !nn.alive) return null;
    if (p.axis === e.axis || nn.axis === e.axis) return null; // parallel neighbour
    // p and nn are both the opposite axis to E; E collapses when their
    // moving coordinates coincide.
    const refTime = Math.max(p.birthTime, nn.birthTime, e.birthTime);
    const pOff = edgeOffset(p, refTime);
    const nOff = edgeOffset(nn, refTime);
    const rel = p.sign - nn.sign;
    if (rel === 0) return null;
    // (p.sign − nn.sign)·dt = nOff − pOff  ⇒  dt = (nOff − pOff)/rel.
    const dt = (nOff - pOff) / rel;
    const t = refTime + dt;
    if (t <= e.birthTime) return null;
    return t;
  }

  /** Vertex between perpendicular edges A,B at time t (A.next===B). */
  function vertexAt(a: WEdge, b: WEdge, time: number): IntegerPoint2D | null {
    if (a.axis === b.axis) return null;
    const h = a.axis === "H" ? a : b;
    const v = a.axis === "V" ? a : b;
    return { x: edgeOffset(v, time), y: edgeOffset(h, time) };
  }

  /** CCW travel direction along edge E (normal rotated −90°). */
  function travelDir(e: WEdge): IntegerPoint2D {
    return e.axis === "H" ? { x: e.sign, y: 0 } : { x: 0, y: -e.sign };
  }

  /** Is the vertex between A,B (A.next===B) a reflex (concave) corner? */
  function isReflexVertex(a: WEdge, b: WEdge): boolean {
    if (a.axis === b.axis) return false;
    const da = travelDir(a);
    const db = travelDir(b);
    return da.x * db.y - da.y * db.x < 0;
  }

  /**
   * Earliest future time the reflex vertex between A,B reaches the strict
   * interior of non-incident edge E. Positions come from offset lines —
   * exact, no velocity. Returns null if no such hit.
   */
  function splitTime(a: WEdge, b: WEdge, e: WEdge): number | null {
    if (!e.alive || e.index === a.index || e.index === b.index) return null;
    const vEdge = a.axis === "V" ? a : b;
    const hEdge = a.axis === "H" ? a : b;
    const refTime = Math.max(a.birthTime, b.birthTime, e.birthTime);
    const ep = wedges[e.prevIndex]!;
    const en = wedges[e.nextIndex]!;
    if (e.axis === "H") {
      const rel = hEdge.sign - e.sign;
      if (rel === 0) return null;
      const dt = (edgeOffset(e, refTime) - edgeOffset(hEdge, refTime)) / rel;
      const t = refTime + dt;
      if (t <= refTime) return null;
      const s = vertexAt(ep, e, t);
      const q = vertexAt(e, en, t);
      if (!s || !q) return null;
      const rx = edgeOffset(vEdge, t);
      const lo = Math.min(s.x, q.x);
      const hi = Math.max(s.x, q.x);
      if (rx <= lo || rx >= hi) return null;
      return t;
    }
    const rel = vEdge.sign - e.sign;
    if (rel === 0) return null;
    const dt = (edgeOffset(e, refTime) - edgeOffset(vEdge, refTime)) / rel;
    const t = refTime + dt;
    if (t <= refTime) return null;
    const s = vertexAt(ep, e, t);
    const q = vertexAt(e, en, t);
    if (!s || !q) return null;
    const ry = edgeOffset(hEdge, t);
    const lo = Math.min(s.y, q.y);
    const hi = Math.max(s.y, q.y);
    if (ry <= lo || ry >= hi) return null;
    return t;
  }

  let aliveCount = n;

  /** If `survivor`'s loop is now exactly two parallel edges, that loop is
   * a finished ridge: emit it and retire both edges. */
  function finalizeIfTwoLoop(survivor: WEdge): boolean {
    const other = wedges[survivor.nextIndex]!;
    if (!other.alive || other.nextIndex !== survivor.index) return false;
    addSkeletonEdge(
      survivor.startNodeIndex,
      other.startNodeIndex,
      survivor.polygonEdgeId,
      other.polygonEdgeId,
    );
    survivor.alive = false;
    other.alive = false;
    aliveCount -= 2;
    return true;
  }

  type Ev =
    | { kind: "collapse"; time: number; eIndex: number }
    | { kind: "split"; time: number; bIndex: number; eIndex: number }
    | { kind: "ridge"; time: number; aIndex: number }
    | { kind: "slab"; time: number; seedIndex: number };

  /** Time two adjacent parallel opposite-normal edges (a, a.next=b)
   * meet — i.e. a ridge between them closes. */
  function ridgeMeetTime(a: WEdge, b: WEdge): number | null {
    if (a.axis !== b.axis || a.sign === b.sign) return null;
    const refTime = Math.max(a.birthTime, b.birthTime);
    const rel = a.sign - b.sign;
    if (rel === 0) return null;
    const dt = (edgeOffset(b, refTime) - edgeOffset(a, refTime)) / rel;
    const t = refTime + dt;
    if (t <= refTime) return null;
    return t;
  }

  /** Walk the loop containing `seed`; return its edges if they are ALL
   * the same axis (a degenerate "slab" — a band between parallel eaves,
   * possibly with straight-vertex junctions). Such a loop has no normal
   * collapse/ridge event and must be retired as one ridge line. */
  function loopIfAllOneAxis(seed: WEdge): WEdge[] | null {
    const loop: WEdge[] = [];
    let cur = seed;
    for (let i = 0; i < wedges.length + 1; i += 1) {
      if (!cur.alive || cur.axis !== seed.axis) return null;
      loop.push(cur);
      cur = wedges[cur.nextIndex]!;
      if (cur.index === seed.index) return loop.length >= 3 ? loop : null;
    }
    return null;
  }

  /** Time a one-axis slab closes: its +normal and −normal sides coincide.
   * Requires a single offset on each side (uniform band). */
  function slabCollapseTime(loop: WEdge[]): number | null {
    const refTime = Math.max(...loop.map((e) => e.birthTime));
    let plus: number | null = null;
    let minus: number | null = null;
    for (const e of loop) {
      const off = edgeOffset(e, refTime);
      if (e.sign > 0) {
        if (plus !== null && plus !== off) return null;
        plus = off;
      } else {
        if (minus !== null && minus !== off) return null;
        minus = off;
      }
    }
    if (plus === null || minus === null) return null;
    // plus side moves +1/unit, minus side −1/unit: meet at (minus−plus)/2.
    const dt = (minus - plus) / 2;
    const t = refTime + dt;
    if (t < refTime) return null;
    return t;
  }

  let safety = 0;
  const maxIters = n * n * 16 + 128;

  while (aliveCount > 0) {
    safety += 1;
    if (safety > maxIters) {
      return { ok: false, error: { code: "unsupported_topology", reason: "event loop exceeded iterations" } };
    }

    // Rebuild the event set from the current wavefront (small N; robust —
    // no stale-event bookkeeping). Earliest wins; ties: collapse before
    // split, then lowest index — deterministic, correctness-independent.
    const candidates: Ev[] = [];
    const consider = (ev: Ev): void => {
      if (!Number.isInteger(ev.time)) {
        fail(`time_not_integral_in_2x: ${ev.kind} t=${ev.time}`);
        return;
      }
      candidates.push(ev);
    };
    for (const e of wedges) {
      if (!e.alive) continue;
      // One-axis "slab" loop (a band of parallel eaves with straight-vertex
      // junctions) — has no normal event; retire it as one ridge line.
      const slabLoop = loopIfAllOneAxis(e);
      if (slabLoop && Math.min(...slabLoop.map((w) => w.index)) === e.index) {
        const st = slabCollapseTime(slabLoop);
        if (st !== null) consider({ kind: "slab", time: st, seedIndex: e.index });
      }
      const ct = collapseTime(e);
      if (ct !== null) consider({ kind: "collapse", time: ct, eIndex: e.index });
      const nb = wedges[e.nextIndex]!;
      // Ridge collapse: adjacent parallel opposite-normal pair. Exclude a
      // 2-edge loop (finalized separately) and the 3-edge case where the
      // pair's flanks are the same edge (p===q) — there the third
      // (perpendicular) edge collapses first.
      if (nb.alive && nb.index !== e.index && nb.nextIndex !== e.index && e.axis === nb.axis && e.sign !== nb.sign) {
        const flankP = wedges[e.prevIndex]!;
        const flankQ = wedges[nb.nextIndex]!;
        // Both flanks must be perpendicular (a clean ridge). If a flank is
        // collinear with its edge (a straight-vertex junction) the ridge
        // is degenerate; let the slab path resolve that loop instead.
        if (
          flankP.index !== flankQ.index &&
          flankP.axis !== e.axis &&
          flankQ.axis !== nb.axis
        ) {
          const rt = ridgeMeetTime(e, nb);
          if (rt !== null) consider({ kind: "ridge", time: rt, aIndex: e.index });
        }
      }
      const a = wedges[e.prevIndex]!;
      if (a.alive && isReflexVertex(a, e)) {
        for (const target of wedges) {
          if (!target.alive) continue;
          const st = splitTime(a, e, target);
          if (st !== null) consider({ kind: "split", time: st, bIndex: e.index, eIndex: target.index });
        }
      }
    }
    if (failure) return { ok: false, error: failure };
    if (candidates.length === 0) break;
    // Earliest event wins. Tie-break at equal time: SPLIT < COLLAPSE <
    // RIDGE < SLAB.
    //  - split first: a simultaneous collapse can extend the split's
    //    target eave into a parallel-ridge state whose extent is
    //    undefined; cutting first keeps the extent valid.
    //  - ridge before slab: a clean parallel pair resolves before the
    //    degenerate one-axis slab loop is retired.
    const rank = (k: Ev["kind"]) =>
      k === "split" ? 0 : k === "collapse" ? 1 : k === "ridge" ? 2 : 3;
    let event: Ev = candidates[0]!;
    for (const ev of candidates) {
      if (
        ev.time < event.time ||
        (ev.time === event.time && rank(ev.kind) < rank(event.kind))
      ) {
        event = ev;
      }
    }

    if (event.kind === "collapse") {
      const e = wedges[event.eIndex]!;
      const p = wedges[e.prevIndex]!;
      const nn = wedges[e.nextIndex]!;
      const startV = vertexAt(p, e, event.time);
      const endV = vertexAt(e, nn, event.time);
      if (!startV || !endV || startV.x !== endV.x || startV.y !== endV.y) {
        return { ok: false, error: { code: "unsupported_topology", reason: `edge ${e.index} endpoints did not meet at t=${event.time}` } };
      }
      const mergeNode = addNode(startV, event.time, [e.polygonEdgeId]);
      addSkeletonEdge(e.startNodeIndex, mergeNode, p.polygonEdgeId, e.polygonEdgeId);
      addSkeletonEdge(nn.startNodeIndex, mergeNode, e.polygonEdgeId, nn.polygonEdgeId);
      e.alive = false;
      aliveCount -= 1;
      p.nextIndex = nn.index;
      nn.prevIndex = p.index;
      nn.startNodeIndex = mergeNode;
      finalizeIfTwoLoop(p);
    } else if (event.kind === "ridge") {
      const a = wedges[event.aIndex]!;
      const b = wedges[a.nextIndex]!;
      const p = wedges[a.prevIndex]!;
      const q = wedges[b.nextIndex]!;
      const mA = vertexAt(p, a, event.time);
      const mB = vertexAt(b, q, event.time);
      if (!mA || !mB) {
        return { ok: false, error: { code: "unsupported_topology", reason: `ridge ${a.index}/${b.index}: degenerate flank at t=${event.time}` } };
      }
      const nodeA = addNode(mA, event.time, [a.polygonEdgeId]);
      const nodeB = mA.x === mB.x && mA.y === mB.y ? nodeA : addNode(mB, event.time, [b.polygonEdgeId]);
      // a and b retire to the ridge: their start vertices trace in, and
      // a ridge skeleton edge spans the two flank nodes (if distinct).
      addSkeletonEdge(a.startNodeIndex, nodeA, p.polygonEdgeId, a.polygonEdgeId);
      addSkeletonEdge(b.startNodeIndex, nodeB, a.polygonEdgeId, b.polygonEdgeId);
      if (nodeA !== nodeB) addSkeletonEdge(nodeA, nodeB, a.polygonEdgeId, b.polygonEdgeId);
      // q's old start vertex (b ∩ q) also retires to the ridge — emit its
      // trace (the second flank's valley/hip) before reassigning, else
      // that eave's facet boundary is lost on asymmetric shapes.
      addSkeletonEdge(q.startNodeIndex, nodeB, b.polygonEdgeId, q.polygonEdgeId);
      a.alive = false;
      b.alive = false;
      aliveCount -= 2;
      p.nextIndex = q.index;
      q.prevIndex = p.index;
      q.startNodeIndex = nodeB;
      finalizeIfTwoLoop(p);
    } else if (event.kind === "slab") {
      // A one-axis slab: a band between parallel eaves (with straight-
      // vertex junctions where stems met). It retires to a single ridge
      // line; each loop vertex projects onto the ridge, junctions above
      // the ridge connect down to it.
      const seed = wedges[event.seedIndex]!;
      const loop = loopIfAllOneAxis(seed);
      if (!loop) {
        return { ok: false, error: { code: "unsupported_topology", reason: `slab seed ${seed.index} not a one-axis loop` } };
      }
      const horizontal = seed.axis === "H";
      // Ridge coordinate (the line the slab closes onto).
      const plusEdge = loop.find((e) => e.sign > 0)!;
      const ridgeCoord = edgeOffset(plusEdge, event.time);
      // For each loop vertex (= each edge's start vertex), project its
      // node onto the ridge and connect.
      type RidgePoint = { along: number; nodeIndex: number; sourceNode: number };
      const points: RidgePoint[] = [];
      for (const e of loop) {
        const src = nodes[e.startNodeIndex]!.position;
        const along = horizontal ? src.x : src.y;
        const ridgePos: IntegerPoint2D = horizontal
          ? { x: src.x, y: ridgeCoord }
          : { x: ridgeCoord, y: src.y };
        let nodeIndex: number;
        if (src.x === ridgePos.x && src.y === ridgePos.y) {
          nodeIndex = e.startNodeIndex; // already on the ridge (a cap end)
        } else {
          nodeIndex = addNode(ridgePos, event.time, [e.polygonEdgeId]);
          // junction above the ridge connects down to it
          addSkeletonEdge(e.startNodeIndex, nodeIndex, e.polygonEdgeId, e.polygonEdgeId);
        }
        points.push({ along, nodeIndex, sourceNode: e.startNodeIndex });
      }
      points.sort((u, v) => u.along - v.along);
      for (let i = 0; i + 1 < points.length; i += 1) {
        const u = points[i]!;
        const v = points[i + 1]!;
        addSkeletonEdge(u.nodeIndex, v.nodeIndex, plusEdge.polygonEdgeId, plusEdge.polygonEdgeId);
      }
      for (const e of loop) {
        e.alive = false;
        aliveCount -= 1;
      }
    } else {
      const b = wedges[event.bIndex]!;
      const a = wedges[b.prevIndex]!;
      const e = wedges[event.eIndex]!;
      const ep = wedges[e.prevIndex]!;
      const en = wedges[e.nextIndex]!;
      const hit = vertexAt(a, b, event.time);
      if (!hit) {
        return { ok: false, error: { code: "unsupported_topology", reason: `split: reflex ${b.index} has no position` } };
      }
      const splitNode = addNode(hit, event.time, [a.polygonEdgeId, b.polygonEdgeId]);
      // Valley from the reflex vertex (at B's start) to the split point.
      addSkeletonEdge(b.startNodeIndex, splitNode, a.polygonEdgeId, b.polygonEdgeId);

      // Cut E at the hit point into E1 (E.start→P, reuse E) and E2
      // (P→E.end, new). Two loops result:
      //   Loop with B: … ep → E1 → b → …   (E1.next = b)
      //   Loop with A: … a → E2 → en → …    (a.next = E2)
      const e2: WEdge = {
        index: wedges.length,
        axis: e.axis,
        coord: e.coord,
        sign: e.sign,
        birthTime: e.birthTime,
        polygonEdgeId: e.polygonEdgeId,
        prevIndex: a.index,
        nextIndex: en.index,
        alive: true,
        startNodeIndex: splitNode,
      };
      wedges.push(e2);
      aliveCount += 1;
      // E1 = e (reused): start→P, now followed by b.
      e.nextIndex = b.index;
      b.prevIndex = e.index;
      b.startNodeIndex = splitNode;
      void ep;
      // a's loop now goes a → e2 → en.
      a.nextIndex = e2.index;
      en.prevIndex = e2.index;
      finalizeIfTwoLoop(e);
      finalizeIfTwoLoop(e2);
    }
    if (failure) return { ok: false, error: failure };
  }

  const aliveEdges = wedges.filter((w) => w.alive);
  if (aliveEdges.length !== 0) {
    return {
      ok: false,
      error: { code: "unsupported_topology", reason: `incomplete_wavefront: ${aliveEdges.length} edges remain` },
    };
  }

  const outNodes: SkeletonNode[] = nodes.map((node) => ({
    position: { x: Math.round(node.position.x / SCALE), y: Math.round(node.position.y / SCALE) },
    time: node.time / SCALE,
    sourceEdgeIds: node.sourceEdgeIds,
  }));

  // Dedupe coincident nodes: a convergence can be reached by separate
  // events that each place a node at the same point. The roof translator
  // keys adjacency by node index, so two indices at one point read as a
  // gap. Collapse them to a single canonical index per position.
  const canonical = new Map<string, number>();
  const remap = outNodes.map((node, i) => {
    const key = `${node.position.x},${node.position.y}`;
    const existing = canonical.get(key);
    if (existing === undefined) {
      canonical.set(key, i);
      return i;
    }
    return existing;
  });
  const dedupedEdges = edges
    .map((e) => ({
      ...e,
      fromNodeIndex: remap[e.fromNodeIndex]!,
      toNodeIndex: remap[e.toNodeIndex]!,
    }))
    .filter((e) => e.fromNodeIndex !== e.toNodeIndex);

  return { ok: true, skeleton: { nodes: outNodes, edges: dedupedEdges, polygonEdgeCount: n } };
}
