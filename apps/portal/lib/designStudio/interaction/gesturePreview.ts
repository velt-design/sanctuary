import { footprintDistance, dot } from "./finitePlacement";
import {
  alignmentChoices,
  composeFiniteAlignment,
  validAlignmentGuide,
  type AlignmentGuide,
  alignmentDescription,
} from "./finiteAlignment";
import type { GestureCache, PlacementPoint as Point } from "./placementData";
export type { GestureCache } from "./placementData";
const footprintCentre = (points: Point[]) => ({
  x:
    (Math.min(...points.map((p) => p.x)) +
      Math.max(...points.map((p) => p.x))) /
    2,
  y:
    (Math.min(...points.map((p) => p.y)) +
      Math.max(...points.map((p) => p.y))) /
    2,
});
export type GesturePreview = {
  key: string;
  points: Point[];
  x: number;
  y: number;
  message: string;
  raw?: { x: number; y: number; rotation: number };
  guides?: AlignmentGuide[];
  candidate?: GestureCache["candidates"][number];
  target?: { start: Point; end: Point };
  connection?: GestureCache["candidates"][number];
};

/** Translate a cached solved candidate without solving during pointer movement. */
export function alongCandidate(
  candidate: GestureCache["candidates"][number],
  along: number,
) {
  if (candidate.evaluateAlong) return candidate.evaluateAlong(along);
  if (along === 0) return candidate;
  const delta = {
    x: candidate.tangent.x * along,
    y: candidate.tangent.y * along,
  };
  const pose = {
    ...candidate.pose,
    x: candidate.pose.x + delta.x,
    y: candidate.pose.y + delta.y,
  };
  return {
    ...candidate,
    choice: { ...candidate.choice, alongEdgeMm: along },
    pose,
    consequences: [
      ...new Set([
        ...candidate.consequences,
        ...candidate.incidentJoins.map(
          (label) => label + ": may need repair after moving",
        ),
      ]),
    ],
    points: candidate.points.map((p) => ({
      ...p,
      x: p.x + delta.x,
      y: p.y + delta.y,
    })),
  };
}
/** Pointer hot path: complete cached footprint, finite segments, no solve or authored mutation. */
export function previewGesture(
  cache: GestureCache,
  x: number,
  y: number,
  units: number,
  held?: string,
  departingKey?: string,
): GesturePreview {
  const dx = x - cache.row.position!.x,
    dy = y - cache.row.position!.y;
  const points = cache.freeOutline.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  const centre = footprintCentre(points);
  const ranked = cache.candidates
    .flatMap((candidate) => {
      if (candidate.key === departingKey) return [];
      const tolerance =
        (candidate.key === held?.split("|")[0] ? 18 : 14) * units;
      const distance = footprintDistance(points, candidate.target);
      if (distance > tolerance) return [];
      const c = footprintCentre(candidate.anchorPoints ?? candidate.points);
      const natural = dot(
        { x: centre.x - c.x, y: centre.y - c.y },
        candidate.tangent,
      );
      // A local endpoint can acquire; a distant extension cannot teleport into range.
      if (natural < -tolerance || natural > candidate.travel + tolerance)
        return [];
      const along = Math.max(0, Math.min(candidate.travel, natural));
      return [
        {
          candidate,
          along,
          distance,
          displacement: Math.hypot(
            c.x + candidate.tangent.x * along - centre.x,
            c.y + candidate.tangent.y * along - centre.y,
          ),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.distance -
          (a.candidate.key === held?.split("|")[0] ? 3 * units : 0) -
          (b.distance -
            (b.candidate.key === held?.split("|")[0] ? 3 * units : 0)) ||
        a.displacement - b.displacement ||
        a.candidate.key.localeCompare(b.candidate.key),
    );
  const alignmentLines = cache.lines.filter(
    (line) => line.departureKey !== departingKey,
  );
  const peerChoices = alignmentChoices(points, alignmentLines, units, held);
  const best = ranked[0];
  const houseNormal = best
    ? { x: -best.candidate.tangent.y, y: best.candidate.tangent.x }
    : null;
  const houseScore = best
    ? best.distance -
      (best.candidate.key === held?.split("|")[0] ? 3 * units : 0)
    : Infinity;
  const sameNormalPeer = peerChoices.find(
    (c) => houseNormal && Math.abs(dot(c.normal, houseNormal)) > 0.999,
  );
  // The finite-distance and normal-witness paths subtract world coordinates,
  // normalize segments, project and take hypot independently. Equivalent
  // distances can therefore differ by roundoff, especially after cancellation
  // at a translated origin. A conservative numerical tie policy uses 64 binary64
  // epsilons for both paths (including translation and held-score subtraction),
  // scaled by their actual operands, not just the small residual scores. This
  // is not a general error bound for degenerate geometry. It only arbitrates
  // already-eligible, already-held-adjusted alternatives. It never widens the
  // acquisition/locality gates or rounds physical/pointer/along coordinates.
  const structuralWins = () => {
    if (!Number.isFinite(houseScore)) return false;
    if (!sameNormalPeer || houseScore <= sameNormalPeer.score) return true;
    if (!Number.isFinite(sameNormalPeer.score)) return false;
    const operands = [
      ...cache.freeOutline,
      ...points,
      cache.row.position!,
      { x, y },
      best!.candidate.target.start,
      best!.candidate.target.end,
      sameNormalPeer.target.start,
      sameNormalPeer.target.end,
    ];
    const magnitude = Math.max(
      1,
      Math.abs(houseScore),
      Math.abs(sameNormalPeer.score),
      3 * Math.abs(units),
      ...operands.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]),
    );
    return (
      Number.isFinite(magnitude) &&
      houseScore - sameNormalPeer.score <= 64 * Number.EPSILON * magnitude
    );
  };
  if (best && structuralWins()) {
    let along = best.along,
      candidate = alongCandidate(best.candidate, along);
    const guides: AlignmentGuide[] = [];
    // The one structural binding owns its normal and rotation. A second finite
    // witness can constrain only legal travel along that same house edge.
    const secondary = candidate.unresolved
      ? undefined
      : alignmentChoices(
          candidate.points,
          alignmentLines.filter(
            (l) =>
              l.id !==
              `align:${candidate.choice.houseId}:${candidate.choice.edge}`,
          ),
          units,
          held,
        ).find(
          (c) => houseNormal && Math.abs(dot(c.normal, houseNormal)) < 0.999,
        );
    if (secondary) {
      const component = dot(secondary.normal, candidate.tangent);
      if (
        Math.abs(component) > 0.1 &&
        Math.abs(secondary.correction / component) <= Math.SQRT2 * 18 * units
      ) {
        const nextAlong = along + secondary.correction / component;
        if (nextAlong >= 0 && nextAlong <= candidate.travel) {
          const next = alongCandidate(best.candidate, nextAlong);
          if (validAlignmentGuide(next.points, secondary, units)) {
            candidate = next;
            along = nextAlong;
            guides.push(secondary);
          }
        }
      }
    }
    if (houseNormal)
      guides.unshift({
        key: candidate.key,
        axis:
          Math.abs(houseNormal.x) > 0.999
            ? "x"
            : Math.abs(houseNormal.y) > 0.999
              ? "y"
              : null,
        witness: { kind: "edge", index: -1 },
        moving: candidate.target,
        target: {
          ...candidate.target,
          id: candidate.key,
          label: `House ${candidate.target.side}`,
        },
        normal: houseNormal,
        label: `House ${candidate.target.side}`,
        correction: dot(
          { x: candidate.pose.x - x, y: candidate.pose.y - y },
          houseNormal,
        ),
        score: houseScore,
        shape: [],
      });
    return {
      raw: { x, y, rotation: cache.row.position!.rotation },
      key: [
        candidate.key,
        ...guides.filter((g) => g.key !== candidate.key).map((g) => g.key),
      ].join("|"),
      points: candidate.points,
      x: candidate.pose.x,
      y: candidate.pose.y,
      candidate: candidate.unresolved ? undefined : candidate,
      connection: candidate,
      target: candidate.target,
      guides,
      message: candidate.unresolved
        ? candidate.unresolved.reason
        : `Release to connect · ${cache.method === "facade" ? "Wall" : cache.method} · ${candidate.target.side}${guides.length > 1 ? " · " + alignmentDescription(guides[1]) : ""}${candidate.consequences.length ? " · " + candidate.consequences.join("; ") : ""}`,
    };
  }
  const aligned = composeFiniteAlignment(points, peerChoices, units);
  return {
    raw: { x, y, rotation: cache.row.position!.rotation },
    key: aligned.guides.map((g) => g.key).join("|") || "free",
    points: aligned.points,
    x: x + aligned.dx,
    y: y + aligned.dy,
    target: aligned.guides[0]?.target,
    guides: aligned.guides,
    message: `${cache.bound ? "Release to detach and move" : "Release to place"}${aligned.guides.length ? " · " + aligned.guides.map((g) => alignmentDescription(g)).join(" · ") + " (not connected)" : ""}${cache.bound ? " · Existing joins may need repair" : ""}`,
  };
}

export function initialGesturePreview(cache: GestureCache): GesturePreview {
  return {
    key: "free",
    points: cache.freeOutline,
    x: cache.row.position!.x,
    y: cache.row.position!.y,
    message: "Move to place; compatible nearby edges can connect or align.",
  };
}
/** A starting connection must not capture an intentional outward departure.
 * Only that target is suppressed; a four-screen-pixel return (the existing
 * gesture intent distance) rearms it. Other incoming targets are unchanged. */
export function connectionDeparture(cache: GestureCache) {
  const host = cache.row.object.attachment?.host,
    binding = cache.row.studioAttachment;
  const candidate = cache.candidates.find((c) =>
    host
      ? c.canonicalHost.objectFamily === host.objectFamily &&
        c.canonicalHost.objectId === host.objectId &&
        c.canonicalHost.edgeKind === host.edgeKind &&
        c.canonicalHost.edgeId === host.edgeId
      : !!binding &&
        c.choice.houseId === binding.houseId &&
        c.choice.edge === binding.edge &&
        c.choice.method === binding.method,
  );

  if (!candidate) return null;
  const t = candidate.target,
    mid = { x: (t.start.x + t.end.x) / 2, y: (t.start.y + t.end.y) / 2 };
  const length = Math.hypot(mid.x - t.centre.x, mid.y - t.centre.y);
  return {
    key: candidate.key,
    n: { x: (mid.x - t.centre.x) / length, y: (mid.y - t.centre.y) / length },
    start: cache.row.position!,
    previous: 0,
    peak: 0,
    blocked: false,
  };
}
export function updateConnectionDeparture(
  state: ReturnType<typeof connectionDeparture>,
  x: number,
  y: number,
  units: number,
) {
  if (!state) return undefined;
  const outward =
    (x - state.start.x) * state.n.x + (y - state.start.y) * state.n.y;
  if (outward > state.previous + 1e-6 && outward > 1e-6) {
    state.blocked = true;
    state.peak = Math.max(outward, state.peak);
  }
  if (state.blocked && state.peak - outward >= 4 * units) {
    state.blocked = false;
    state.peak = outward;
  }
  state.previous = outward;
  return state.blocked ? state.key : undefined;
}
