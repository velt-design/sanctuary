import type { IntegerPoint2D, OrthogonalPolygon } from "./types";

/**
 * PR-SS-2 (2026-06-19): vertex motion in the orthogonal straight-
 * skeleton wavefront.
 *
 * For an axis-aligned orthogonal polygon (CCW), every vertex has an
 * interior angle of either 90° (convex) or 270° (reflex). Both kinds
 * move along the angle bisector at speed √2 (because the wavefront
 * advances at unit speed perpendicular to each edge, and the
 * bisector lies at 45° to each — so 1/sin(45°) = √2).
 *
 * The bisector direction is always one of four 45° diagonals:
 *   NE = (+1, +1), NW = (-1, +1), SW = (-1, -1), SE = (+1, -1).
 *
 * We store velocities as integer-component vectors of magnitude √2
 * (i.e. components are ±1, never normalized to length 1) so all
 * future position computations stay in integer coordinates when
 * paired with integer event times.
 *
 * Position at time t from a vertex with start position p and
 * velocity v is:  position(t) = p + v · t.
 *
 * Concretely: at integer time t, a vertex with NE velocity sits at
 * (p.x + t, p.y + t) — still integer.
 */

type VertexClass = "convex" | "reflex";

type VertexMotion = {
  /** Vertex classification — convex (90°) or reflex (270°). */
  classification: VertexClass;
  /**
   * Bisector velocity, with components in {-1, +1}. Magnitude is √2
   * (the speed at which axis-aligned polygon vertices traverse their
   * bisectors when the wavefront advances at unit speed perpendicular
   * to each edge).
   */
  velocity: IntegerPoint2D;
};

/**
 * Determine the interior-angle class of vertex `polygon[index]`
 * given its two incident edges. For a CCW polygon:
 *   - left turn  (cross product > 0) → convex (90°)
 *   - right turn (cross product < 0) → reflex (270°)
 *   - straight   (cross product = 0) → invalid (rejected by validate)
 */
export function classifyVertex(
  polygon: OrthogonalPolygon,
  index: number,
): VertexClass {
  const n = polygon.length;
  const prev = polygon[(index - 1 + n) % n]!;
  const curr = polygon[index]!;
  const next = polygon[(index + 1) % n]!;
  const incomingDx = curr.x - prev.x;
  const incomingDy = curr.y - prev.y;
  const outgoingDx = next.x - curr.x;
  const outgoingDy = next.y - curr.y;
  // 2D cross product: positive for CCW (left) turn, negative for CW (right) turn.
  const cross = incomingDx * outgoingDy - incomingDy * outgoingDx;
  if (cross > 0) return "convex";
  if (cross < 0) return "reflex";
  // cross === 0 → collinear, but `validateOrthogonalPolygon` would
  // have rejected this earlier. Defensive default.
  return "convex";
}

/**
 * Compute the bisector velocity vector for a vertex of an axis-
 * aligned orthogonal polygon. Returns a vector with components in
 * {-1, +1} representing one of NE / NW / SW / SE; magnitude √2.
 *
 * Derivation:
 *
 * At a convex corner, the interior angle is 90°. Its bisector is
 * along the sum of the reversed-incoming and outgoing edge unit
 * vectors:
 *
 *   bisector = (-incoming) + outgoing
 *
 * Reason: the interior angle opens between the reversed incoming
 * direction (pointing back along the incoming edge, away from
 * `prev`) and the outgoing direction (toward `next`). The vector
 * sum of two perpendicular unit vectors lies along the bisector.
 * For CCW convex, this points INTO the polygon body.
 *
 * At a reflex corner, the wavefront vertex motion is the same line
 * but the OPPOSITE direction — because the two adjacent edges,
 * each moving inward perpendicular to themselves, push the reflex
 * vertex AWAY from where it sat (toward the polygon body). Algebra:
 *
 *   reflex_velocity = -(bisector) = incoming - outgoing
 *
 * Worked example for v=(5,5) reflex of an L-shape (incoming (-1,0)
 * from the east, outgoing (0,1) heading north): both adjacent edges
 * move inward (south + west respectively). The intersection point
 * of the two moving edges moves SW at speed √2. The formula gives
 * `(−(−1, 0)) + (0, 1)` negated = `(1, 1)` negated = `(−1, −1)` —
 * SW. ✓
 *
 * Worked example for v=(0,0) convex of a rectangle (incoming
 * (0,−1) from the north, outgoing (1,0) heading east): the inward
 * bisector is NE. Formula: `(0, 1) + (1, 0) = (1, 1)` — NE. ✓
 */
export function computeVertexMotion(
  polygon: OrthogonalPolygon,
  index: number,
): VertexMotion {
  const classification = classifyVertex(polygon, index);
  const n = polygon.length;
  const prev = polygon[(index - 1 + n) % n]!;
  const curr = polygon[index]!;
  const next = polygon[(index + 1) % n]!;
  const incomingSignX = Math.sign(curr.x - prev.x);
  const incomingSignY = Math.sign(curr.y - prev.y);
  const outgoingSignX = Math.sign(next.x - curr.x);
  const outgoingSignY = Math.sign(next.y - curr.y);
  // Interior-angle bisector (convex inward direction):
  //   bisector = (-incoming) + outgoing
  const bisectorX = -incomingSignX + outgoingSignX;
  const bisectorY = -incomingSignY + outgoingSignY;
  // Reflex: the wavefront-vertex motion is the opposite direction
  // (both adjacent edges moving inward push the corner toward the
  // body, not away from it).
  const velocityX = classification === "convex" ? bisectorX : -bisectorX;
  const velocityY = classification === "convex" ? bisectorY : -bisectorY;
  return {
    classification,
    velocity: { x: velocityX, y: velocityY },
  };
}
