/**
 * PR-SS-2 (2026-06-19): public API for the orthogonal straight-
 * skeleton primitive.
 *
 * One pure function that knows nothing about roofs:
 *
 *   computeOrthogonalStraightSkeleton(polygon: OrthogonalPolygon)
 *     → { ok: true, skeleton } | { ok: false, error }
 *
 * The roof translator in `packages/geometry/src/house/` (PR-SS-3)
 * consumes this graph and emits `RoofPlane3D[]` + `HouseRoofFeature3D[]`
 * at a given pitch + eave height. Other consumers (medial axis,
 * inward offset polygons) can use the same graph.
 *
 * See `docs/decision-log.md` for the PR-SS-1 spec — the regression
 * matrix this solver must satisfy.
 */

export { computeOrthogonalStraightSkeleton } from "./solve";
export type {
  StraightSkeletonError,
  StraightSkeletonResult,
} from "./solve";
export { validateOrthogonalPolygon } from "./validate";
export { classifyVertex, computeVertexMotion } from "./bisector";
export type { VertexClass, VertexMotion } from "./bisector";
export type {
  IntegerPoint2D,
  OrthogonalPolygon,
  OrthogonalPolygonValidationError,
  OrthogonalPolygonValidationResult,
  SkeletonEdge,
  SkeletonNode,
  StraightSkeleton,
} from "./types";
