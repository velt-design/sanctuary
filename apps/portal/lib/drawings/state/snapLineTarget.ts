import type { Point2 } from '@sp/geometry';

/**
 * A line-shaped snap target for edges that aren't a polygon boundary, like
 * roof eaves at gutter height projected to plan space, or standalone wall
 * segments that aren't part of a closed body.
 */
export type SnapLineTarget = {
  /** Stable id, e.g. `roof-eave-${sourceEdgeId}`. */
  id: string;
  sourceObjectId: string;
  /** Domain edge kind for downstream attachment routing, e.g. `roof_eave` or `wall`. */
  edgeKind: string;
  start: Point2;
  end: Point2;
};
