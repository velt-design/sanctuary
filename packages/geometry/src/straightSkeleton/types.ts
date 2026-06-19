/**
 * PR-SS-2 (2026-06-19): types for the orthogonal straight-skeleton
 * primitive.
 *
 * A straight skeleton is the standard computational-geometry construct
 * for hipped-roof topology computation: shrink the polygon inward at
 * uniform speed perpendicular to each edge; the loci traced by
 * vertices form the skeleton. For axis-aligned orthogonal polygons,
 * the algorithm has a simplified form (all bisectors are 45°,
 * all event times have closed-form solutions).
 *
 * Architectural rules baked in here:
 *
 *  1. Integer coordinates only. The input polygon must be in integer
 *     millimetres. Floating-point geometry inputs caused the entire
 *     class of bugs that motivated this rewrite — we eliminate that
 *     class by construction at the type boundary.
 *
 *  2. Polygon is CCW orthogonal. Every edge is horizontal or vertical;
 *     consecutive edges alternate axes. Validation rejects anything
 *     else; we do not "try to repair" malformed input.
 *
 *  3. Output is a pure graph. No knowledge of roofs, planes, eaves,
 *     or pitches. The roof translator (PR-SS-3) consumes this graph
 *     and emits roof facets. Other consumers (medial axis, offset
 *     polygons) could use the same graph.
 *
 *  4. No shared mutable state. `computeOrthogonalStraightSkeleton`
 *     is a pure function: same input → same output forever.
 */

/**
 * Integer-millimetre 2D point. The straight-skeleton algorithm
 * operates exclusively on integer coordinates to eliminate float-
 * precision class of bugs.
 */
export type IntegerPoint2D = { x: number; y: number };

/**
 * Axis-aligned orthogonal polygon in counter-clockwise winding.
 * All coordinates are integer millimetres; every edge is horizontal
 * or vertical; consecutive edges alternate axes (no two consecutive
 * horizontal edges). `validateOrthogonalPolygon` enforces these
 * invariants before any solver work.
 */
export type OrthogonalPolygon = ReadonlyArray<IntegerPoint2D>;

/**
 * A node in the straight skeleton: a 2D position plus the wavefront
 * time at which the wavefront reached this point. For roof
 * generation, `time × tan(pitchDeg)` gives the height of this node
 * above the eave.
 */
export type SkeletonNode = {
  /** Position in integer millimetres. */
  position: IntegerPoint2D;
  /**
   * Wavefront time at which this node was created. A node sitting
   * at distance d from the nearest polygon edge has time = d (we
   * measure time in millimetres, with wavefront speed = 1 mm/mm).
   */
  time: number;
  /**
   * The IDs of polygon edges whose wavefronts converged at this
   * node. Used by the roof translator to associate skeleton nodes
   * with their source eave edges.
   */
  sourceEdgeIds: ReadonlyArray<number>;
};

/**
 * A skeleton edge: a segment between two skeleton nodes. Each
 * skeleton edge is the locus of where two consecutive polygon edges'
 * wavefronts met over an interval of time.
 *
 * For roof generation:
 *  - Skeleton edges between two convex-corner-spawned nodes become
 *    ridges (the apex line where two opposing slopes meet).
 *  - Skeleton edges incident to a reflex-corner-spawned node may be
 *    valleys (the line where two adjacent slopes meet at an inside
 *    corner).
 *  - The two polygon edges named here are the eaves of the two
 *    facets that the skeleton edge separates.
 */
export type SkeletonEdge = {
  /** Index of the start node in `StraightSkeleton.nodes`. */
  fromNodeIndex: number;
  /** Index of the end node in `StraightSkeleton.nodes`. */
  toNodeIndex: number;
  /**
   * Polygon edge id on the "left" side of this skeleton edge
   * (looking from fromNode to toNode).
   */
  leftPolygonEdgeId: number;
  /**
   * Polygon edge id on the "right" side of this skeleton edge
   * (looking from fromNode to toNode).
   */
  rightPolygonEdgeId: number;
};

/**
 * Result of `computeOrthogonalStraightSkeleton`. Pure graph; no
 * roof / pitch / height information.
 */
export type StraightSkeleton = {
  nodes: ReadonlyArray<SkeletonNode>;
  edges: ReadonlyArray<SkeletonEdge>;
  /** Number of edges in the source polygon. */
  polygonEdgeCount: number;
};

/**
 * Errors `validateOrthogonalPolygon` can return. Closed union — do
 * not add an `unknown` arm.
 */
export type OrthogonalPolygonValidationError =
  | { code: "too_few_vertices"; vertexCount: number }
  | { code: "non_integer_coordinate"; vertexIndex: number; coordinate: "x" | "y"; value: number }
  | { code: "non_orthogonal_edge"; edgeIndex: number; deltaX: number; deltaY: number }
  | { code: "consecutive_collinear_edges"; edgeIndex: number }
  | { code: "zero_length_edge"; edgeIndex: number }
  | { code: "not_counter_clockwise"; signedArea: number }
  | { code: "self_intersecting_polygon" };

export type OrthogonalPolygonValidationResult =
  | { ok: true }
  | { ok: false; error: OrthogonalPolygonValidationError };
