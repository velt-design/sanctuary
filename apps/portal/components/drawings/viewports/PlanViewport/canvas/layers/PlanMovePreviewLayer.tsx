import type { Point2 } from '@sp/geometry';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { MoveToolPreview } from '../../tools/MoveTool';
import lineweightStyles from '../planLineweights.module.css';

/**
 * Live preview of a move-in-progress: renders the active object's polygon
 * translated by the move tool's current `delta`. Mounted between the
 * selection halo and the edge-drag preview layers so the moving polygon
 * sits above the bodies but below decorative previews.
 *
 * Source polygon: the host passes the polygon to translate (typically the
 * active object's halo polygon). This avoids the layer having to know
 * about families or rendering rules. When `preview` is null (no drag in
 * progress), the layer is empty.
 */
type PlanMovePreviewLayerProps = {
  preview: MoveToolPreview | null;
  /** World-coord polygon of the object being moved, in mm. */
  sourcePolygonMm: ReadonlyArray<Point2> | null;
  coordinateAdapter: PlanCoordinateAdapter;
};

export function PlanMovePreviewLayer({
  preview,
  sourcePolygonMm,
  coordinateAdapter,
}: PlanMovePreviewLayerProps) {
  if (!preview || !sourcePolygonMm || sourcePolygonMm.length < 3) {
    return <g data-plan-layer="movePreview" pointerEvents="none" />;
  }
  const translated = sourcePolygonMm.map((point) => ({
    x: point.x + preview.delta.x,
    y: point.y + preview.delta.y,
  }));
  const svgPoints = translated.map((point) => coordinateAdapter.projectionToSvg(point));
  const pointsAttr = svgPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
  return (
    <g data-plan-layer="movePreview" pointerEvents="none">
      <polygon
        points={pointsAttr}
        className={lineweightStyles.movePreview}
        data-plan-move-target-family={preview.target.family}
        data-plan-move-target-id={preview.target.targetId}
        data-plan-move-delta-x-mm={Math.round(preview.delta.x)}
        data-plan-move-delta-y-mm={Math.round(preview.delta.y)}
      />
    </g>
  );
}
