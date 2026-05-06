import {
  applyEdgePerpendicularTranslation,
  findClosestPolygonEdge,
  polygonEdgeOutwardNormal,
  type Point2,
} from '../canvas/polygonEdgeMath';
import type { ActiveObjectFamily } from '../canvas/planDimension';
import type { Tool, ToolPointerEvent } from './Tool';

export type EdgeDragOutline = {
  id: string;
  family: ActiveObjectFamily;
  polygon: ReadonlyArray<Point2>;
};

export type EdgeDragOutlineSource = () => EdgeDragOutline | null;

export type EdgeDragPreview = {
  outlineId: string;
  family: ActiveObjectFamily;
  edgeIndex: number;
  originalPolygon: ReadonlyArray<Point2>;
  previewPolygon: ReadonlyArray<Point2>;
  deltaMm: number;
};

export type EdgeDragCommit = {
  outlineId: string;
  family: ActiveObjectFamily;
  nextPolygon: ReadonlyArray<Point2>;
};

export type EdgeDragToolConfig = {
  getActiveOutline: EdgeDragOutlineSource;
  edgeHitToleranceMm?: number;
  onPreviewChange?: (preview: EdgeDragPreview | null) => void;
  onCommit?: (commit: EdgeDragCommit) => void;
};

const DEFAULT_EDGE_HIT_TOLERANCE_MM = 200;

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

function buildPreview(session: DragSession, deltaMm: number): EdgeDragPreview {
  const previewPolygon = applyEdgePerpendicularTranslation(
    session.outline.polygon,
    session.edgeIndex,
    deltaMm,
  );
  return {
    outlineId: session.outline.id,
    family: session.outline.family,
    edgeIndex: session.edgeIndex,
    originalPolygon: session.outline.polygon,
    previewPolygon,
    deltaMm,
  };
}

export function createEdgeDragTool(config: EdgeDragToolConfig): Tool {
  const tolerance = config.edgeHitToleranceMm ?? DEFAULT_EDGE_HIT_TOLERANCE_MM;
  let session: DragSession | null = null;

  const clearSession = (): void => {
    session = null;
    config.onPreviewChange?.(null);
  };

  return {
    id: 'edge-drag',
    cursor: 'crosshair',
    onPointerDown(event: ToolPointerEvent) {
      if (event.button !== 0) return;
      const outline = config.getActiveOutline();
      if (!outline) return;
      const closest = findClosestPolygonEdge(outline.polygon, event.point);
      if (!closest || closest.distanceMm > tolerance) return;
      session = {
        outline,
        edgeIndex: closest.edgeIndex,
        startPoint: { x: event.point.x, y: event.point.y },
        pointerId: event.pointerId,
      };
      config.onPreviewChange?.(buildPreview(session, 0));
    },
    onPointerMove(event: ToolPointerEvent) {
      if (!session || session.pointerId !== event.pointerId) return;
      const deltaMm = computeDeltaMm(session, event.point);
      config.onPreviewChange?.(buildPreview(session, deltaMm));
    },
    onPointerUp(event: ToolPointerEvent) {
      if (!session || session.pointerId !== event.pointerId) return;
      const finalSession = session;
      const deltaMm = computeDeltaMm(finalSession, event.point);
      const preview = buildPreview(finalSession, deltaMm);
      session = null;
      config.onPreviewChange?.(null);
      if (deltaMm !== 0) {
        config.onCommit?.({
          outlineId: finalSession.outline.id,
          family: finalSession.outline.family,
          nextPolygon: preview.previewPolygon,
        });
      }
    },
    onCancel() {
      if (!session) return;
      clearSession();
    },
  };
}
