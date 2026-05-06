import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { EdgeDragPreview } from '../../tools/EdgeDragTool';
import lineweightStyles from '../planLineweights.module.css';

type PlanEdgeDragPreviewLayerProps = {
  preview: EdgeDragPreview | null;
  coordinateAdapter: PlanCoordinateAdapter;
};

export function PlanEdgeDragPreviewLayer({ preview, coordinateAdapter }: PlanEdgeDragPreviewLayerProps) {
  if (!preview) return <g data-plan-layer="edgeDragPreview" />;
  const svgPoints = preview.previewPolygon.map((point) => coordinateAdapter.projectionToSvg(point));
  const pointsAttr = svgPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  return (
    <g data-plan-layer="edgeDragPreview">
      <polygon
        points={pointsAttr}
        className={lineweightStyles.edgeDragPreview}
        data-plan-edge-drag-outline-id={preview.outlineId}
        data-plan-edge-drag-edge-index={preview.edgeIndex}
        data-plan-edge-drag-delta-mm={Math.round(preview.deltaMm)}
      />
    </g>
  );
}
