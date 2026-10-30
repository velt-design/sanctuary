export type Point = { x: number; y: number };
export type Segment = { start: Point; end: Point };
/** Outer footprint of the actual solved members, roof and supplied accessories. */
export function physicalFootprint(points: Point[]): Point[] {
  const sorted = [
    ...new Map(
      points.map((p) => [`${p.x},${p.y}`, { x: p.x, y: p.y }]),
    ).values(),
  ].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (rows: Point[]) => {
    const out: Point[] = [];
    for (const p of rows) {
      while (
        out.length > 1 &&
        cross(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(sorted),
    upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
export function segmentAxis(edge: Segment) {
  const d = subtract(edge.end, edge.start),
    length = Math.hypot(d.x, d.y);
  return { length, u: { x: d.x / length, y: d.y / length } };
}
export function polygonEdges(points: Point[]): Segment[] {
  return points.map((start, i) => ({
    start,
    end: points[(i + 1) % points.length],
  }));
}
function pointDistance(p: Point, e: Segment) {
  const { length, u } = segmentAxis(e);
  if (!length) return Math.hypot(p.x - e.start.x, p.y - e.start.y);
  const t = Math.max(0, Math.min(length, dot(subtract(p, e.start), u)));
  return Math.hypot(p.x - e.start.x - u.x * t, p.y - e.start.y - u.y * t);
}
/** Finite edges, including endpoint/corner approaches; never an infinite axis. */
export function segmentDistance(a: Segment, b: Segment): number {
  const r = subtract(a.end, a.start),
    s = subtract(b.end, b.start),
    q = subtract(b.start, a.start),
    cross = (v: Point, w: Point) => v.x * w.y - v.y * w.x,
    den = cross(r, s);
  if (Math.abs(den) > 1e-9) {
    const t = cross(q, s) / den,
      u = cross(q, r) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    pointDistance(a.start, b),
    pointDistance(a.end, b),
    pointDistance(b.start, a),
    pointDistance(b.end, a),
  );
}
export function footprintDistance(points: Point[], target: Segment) {
  return Math.min(
    ...polygonEdges(points).map((edge) => segmentDistance(edge, target)),
  );
}
export type FiniteWitness = { kind: "edge" | "vertex"; index: number };
/** A support edge or vertex supplies one finite NORMAL constraint. Tangential
 * endpoint proximity is eligibility only, never a second translation. */
export function finiteNormalAlignments(
  points: Point[],
  target: Segment,
  tolerance: number,
  allowVertex = true,
) {
  const { u, length } = segmentAxis(target);
  if (!length || points.length < 2) return [];
  const normal = { x: -u.y, y: u.x };
  const signed = points.map((p) => dot(subtract(p, target.start), normal));
  const extremes = [Math.min(...signed), Math.max(...signed)];
  const result: {
    witness: FiniteWitness;
    moving: Segment;
    normal: Point;
    correction: number;
    distance: number;
    gap: number;
  }[] = [];
  for (const value of extremes) {
    const indices = points.flatMap((_, index) =>
      Math.abs(signed[index] - value) < 1e-6 ? [index] : [],
    );
    const edge = indices.find((index) =>
      indices.includes((index + 1) % points.length),
    );
    if (edge !== undefined) {
      const moving = {
        start: points[edge],
        end: points[(edge + 1) % points.length],
      };
      const a = dot(subtract(moving.start, target.start), u),
        b = dot(subtract(moving.end, target.start), u);
      const gap = Math.max(0, -Math.max(a, b), Math.min(a, b) - length),
        distance = Math.hypot(gap, value);
      if (distance <= tolerance)
        result.push({
          witness: { kind: "edge", index: edge },
          moving,
          normal,
          correction: -value,
          distance,
          gap,
        });
    } else if (allowVertex) {
      for (const index of indices) {
        const point = points[index],
          t = dot(subtract(point, target.start), u),
          gap = Math.max(0, -t, t - length),
          distance = Math.hypot(gap, value);
        if (distance <= tolerance)
          result.push({
            witness: { kind: "vertex", index },
            moving: { start: point, end: point },
            normal,
            correction: -value,
            distance,
            gap,
          });
      }
    }
  }
  return result;
}
