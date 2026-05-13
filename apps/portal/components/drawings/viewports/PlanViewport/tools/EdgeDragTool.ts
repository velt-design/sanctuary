import {
  applyEdgePerpendicularTranslation,
  findClosestPolygonEdge,
  polygonEdgeOutwardNormal,
  type Point2,
} from '../canvas/polygonEdgeMath';
import type { ActiveObjectFamily } from '../canvas/planDimension';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';
import { resolveEdgeSnap, type EdgeSnapResult } from './resolveEdgeSnap';
import type { Tool, ToolPointerEvent } from './Tool';

export type EdgeDragOutline = {
  id: string;
  family: ActiveObjectFamily;
  polygon: ReadonlyArray<Point2>;
};

export type EdgeDragOutlineSource = () => EdgeDragOutline | null;

export type EdgeDragSnapTargetSource = () => ReadonlyArray<SnapLineTarget>;

export type EdgeDragPreview = {
  outlineId: string;
  family: ActiveObjectFamily;
  edgeIndex: number;
  originalPolygon: ReadonlyArray<Point2>;
  previewPolygon: ReadonlyArray<Point2>;
  deltaMm: number;
  /** Resolved snap when the dragged edge is parallel + close to a line target. */
  snap: EdgeSnapResult | null;
};

export type EdgeDragCommit = {
  outlineId: string;
  family: ActiveObjectFamily;
  /** Index in the original polygon of the edge that was dragged. */
  edgeIndex: number;
  nextPolygon: ReadonlyArray<Point2>;
  /** When the drag ended on a snap, this carries the resolved snap result. */
  snap: EdgeSnapResult | null;
};

/**
 * Hover state published by `EdgeDragTool` while no drag is active. The host
 * uses this to render a highlighted edge so the user can see which edge will
 * be grabbed before pressing. Cleared (set to null) when the pointer leaves
 * the active outline's hit tolerance or once a drag begins.
 */
export type EdgeDragHover = {
  outlineId: string;
  family: ActiveObjectFamily;
  edgeIndex: number;
  edgeStart: Point2;
  edgeEnd: Point2;
  closestPoint: Point2;
};

export type EdgeDragToolConfig = {
  getActiveOutline: EdgeDragOutlineSource;
  edgeHitToleranceMm?: number;
  /**
   * Snap line target source — typically `buildHouseSnapTargets(houseModel)`
   * for house wall + roof-eave candidates. Read fresh on every pointermove
   * so re-solves between pointer events surface up-to-date targets. Omit
   * for v1 deck/house edits where snap doesn't apply yet; pergola edge
   * drags consume this for `wall` / `roof_edge` snap formation.
   */
  getSnapLineTargets?: EdgeDragSnapTargetSource;
  /** Max correction distance (mm) before a candidate is rejected. Default 250mm. */
  snapToleranceMm?: number;
  /** Max angle (degrees) between the dragged edge and a parallel target. Default 5°. */
  snapAngularToleranceDeg?: number;
  onPreviewChange?: (preview: EdgeDragPreview | null) => void;
  onHoverChange?: (hover: EdgeDragHover | null) => void;
  onCommit?: (commit: EdgeDragCommit) => void;
  /**
   * Called when a pointer-down doesn't initiate an edge drag — either because
   * there is no active outline or because the click is too far from any edge.
   * The host wires this to the SelectTool so clicking on a different object in
   * the plan view still routes to selection while EdgeDragTool is the active tool.
   */
  onPointerDownFallthrough?: (event: ToolPointerEvent) => void;
};

const DEFAULT_EDGE_HIT_TOLERANCE_MM = 500;

type DragSession = {
  outline: EdgeDragOutline;
  edgeIndex: number;
  startPoint: Point2;
  pointerId: number;
};

function computeDeltaMm(session: DragSession, currentPoint: Point2): number {
  const normal = polygonEdgeOutwardNormal(session.outline.polygon, session.edgeIndex);
  if (!normal) return 0;
  const dx = currentPoint.x - session.startPoint.x;
  const dy = currentPoint.y - session.startPoint.y;
  return dx * normal.x + dy * normal.y;
}

type DragSessionWithSnapConfig = {
  snapLineTargets: ReadonlyArray<SnapLineTarget>;
  snapToleranceMm: number;
  snapAngularToleranceDeg: number;
};

function resolveSnapForDrag(
  session: DragSession,
  naturalDeltaMm: number,
  snapConfig: DragSessionWithSnapConfig,
): EdgeSnapResult | null {
  if (snapConfig.snapLineTargets.length === 0) return null;
  const a = session.outline.polygon[session.edgeIndex];
  const b = session.outline.polygon[(session.edgeIndex + 1) % session.outline.polygon.length];
  if (!a || !b) return null;
  const outwardNormal = polygonEdgeOutwardNormal(session.outline.polygon, session.edgeIndex);
  if (!outwardNormal) return null;
  return resolveEdgeSnap({
    edgeStart: { x: a.x, y: a.y },
    edgeEnd: { x: b.x, y: b.y },
    outwardNormal,
    naturalDeltaMm,
    lineTargets: snapConfig.snapLineTargets,
    toleranceMm: snapConfig.snapToleranceMm,
    angularToleranceDeg: snapConfig.snapAngularToleranceDeg,
  });
}

function buildPreview(
  session: DragSession,
  deltaMm: number,
  snap: EdgeSnapResult | null,
): EdgeDragPreview {
  const effectiveDelta = snap ? snap.snapDeltaMm : deltaMm;
  const previewPolygon = applyEdgePerpendicularTranslation(
    session.outline.polygon,
    session.edgeIndex,
    effectiveDelta,
  );
  return {
    outlineId: session.outline.id,
    family: session.outline.family,
    edgeIndex: session.edgeIndex,
    originalPolygon: session.outline.polygon,
    previewPolygon,
    deltaMm: effectiveDelta,
    snap,
  };
}

const DEFAULT_SNAP_TOLERANCE_MM = 250;
const DEFAULT_SNAP_ANGULAR_TOLERANCE_DEG = 5;

export function createEdgeDragTool(config: EdgeDragToolConfig): Tool {
  const tolerance = config.edgeHitToleranceMm ?? DEFAULT_EDGE_HIT_TOLERANCE_MM;
  const snapToleranceMm = config.snapToleranceMm ?? DEFAULT_SNAP_TOLERANCE_MM;
  const snapAngularToleranceDeg =
    config.snapAngularToleranceDeg ?? DEFAULT_SNAP_ANGULAR_TOLERANCE_DEG;
  // Read snap targets fresh on every consult — between pointer events the
  // store may re-solve and the target list may refresh.
  const readSnapConfig = (): DragSessionWithSnapConfig => ({
    snapLineTargets: config.getSnapLineTargets?.() ?? [],
    snapToleranceMm,
    snapAngularToleranceDeg,
  });
  let session: DragSession | null = null;
  // Cache the last published hover by content (outline, edge index, and the
  // edge endpoints) — NOT just by edge index. After a commit the polygon
  // coords for the same edgeIndex change, and an index-only dedup would leave
  // the layer rendering stale endpoints.
  let lastHoverKey: string | null = null;

  const clearSession = (): void => {
    session = null;
    config.onPreviewChange?.(null);
  };

  const clearHover = (): void => {
    if (lastHoverKey !== null) {
      lastHoverKey = null;
      config.onHoverChange?.(null);
    }
  };

  const updateHover = (event: ToolPointerEvent): void => {
    const outline = config.getActiveOutline();
    if (!outline) {
      clearHover();
      return;
    }
    const closest = findClosestPolygonEdge(outline.polygon, event.point);
    if (!closest || closest.distanceMm > tolerance) {
      clearHover();
      return;
    }
    const a = outline.polygon[closest.edgeIndex];
    const b = outline.polygon[(closest.edgeIndex + 1) % outline.polygon.length];
    if (!a || !b) {
      clearHover();
      return;
    }
    const nextKey = `${outline.id}|${closest.edgeIndex}|${a.x}|${a.y}|${b.x}|${b.y}`;
    if (lastHoverKey === nextKey) return;
    lastHoverKey = nextKey;
    config.onHoverChange?.({
      outlineId: outline.id,
      family: outline.family,
      edgeIndex: closest.edgeIndex,
      edgeStart: { x: a.x, y: a.y },
      edgeEnd: { x: b.x, y: b.y },
      closestPoint: closest.closestPoint,
    });
  };

  return {
    id: 'edge-drag',
    cursor: 'crosshair',
    onPointerDown(event: ToolPointerEvent) {
      if (event.button !== 0) return;
      // Terminal-end toggle priority: a click on a roof shape tagged with
      // `metadata.openGableEndId` is a hip↔gable toggle target (milestone
      // 13), NOT an edge-drag handle. When the house is the active
      // outline, the synthetic gable triangle sits within `tolerance`
      // of the house's perimeter edge, so the natural EdgeDragTool path
      // would intercept the click and start a resize session before the
      // toggle ever reaches SelectTool. Fall through unconditionally so
      // the SelectTool downstream of the chain receives the toggle
      // event. See `docs/decision-log.md` 2026-05-13 entry on terminal
      // end click priority.
      if (typeof event.shape?.metadata?.openGableEndId === 'string') {
        config.onPointerDownFallthrough?.(event);
        return;
      }
      const outline = config.getActiveOutline();
      if (!outline) {
        config.onPointerDownFallthrough?.(event);
        return;
      }
      const closest = findClosestPolygonEdge(outline.polygon, event.point);
      if (!closest || closest.distanceMm > tolerance) {
        config.onPointerDownFallthrough?.(event);
        return;
      }
      session = {
        outline,
        edgeIndex: closest.edgeIndex,
        startPoint: { x: event.point.x, y: event.point.y },
        pointerId: event.pointerId,
      };
      clearHover();
      config.onPreviewChange?.(buildPreview(session, 0, null));
    },
    onPointerMove(event: ToolPointerEvent) {
      if (session && session.pointerId === event.pointerId) {
        const deltaMm = computeDeltaMm(session, event.point);
        const snap = resolveSnapForDrag(session, deltaMm, readSnapConfig());
        config.onPreviewChange?.(buildPreview(session, deltaMm, snap));
        return;
      }
      if (session) return;
      updateHover(event);
    },
    onPointerUp(event: ToolPointerEvent) {
      if (!session || session.pointerId !== event.pointerId) return;
      const finalSession = session;
      const naturalDelta = computeDeltaMm(finalSession, event.point);
      const snap = resolveSnapForDrag(finalSession, naturalDelta, readSnapConfig());
      const preview = buildPreview(finalSession, naturalDelta, snap);
      session = null;
      config.onPreviewChange?.(null);
      if (preview.deltaMm !== 0) {
        // The commit changes the active outline polygon. Drop the cached hover
        // so the next pointermove republishes against fresh edges instead of
        // re-using endpoints from the pre-commit polygon.
        clearHover();
        config.onCommit?.({
          outlineId: finalSession.outline.id,
          family: finalSession.outline.family,
          edgeIndex: finalSession.edgeIndex,
          nextPolygon: preview.previewPolygon,
          snap,
        });
      }
    },
    onCancel() {
      clearHover();
      if (!session) return;
      clearSession();
    },
  };
}
