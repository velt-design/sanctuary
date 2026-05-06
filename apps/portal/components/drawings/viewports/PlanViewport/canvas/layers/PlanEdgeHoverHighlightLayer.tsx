import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { EdgeDragHover } from '../../tools/EdgeDragTool';
import lineweightStyles from '../planLineweights.module.css';

type PlanEdgeHoverHighlightLayerProps = {
  hover: EdgeDragHover | null;
  coordinateAdapter: PlanCoordinateAdapter;
};

export function PlanEdgeHoverHighlightLayer({ hover, coordinateAdapter }: PlanEdgeHoverHighlightLayerProps) {
  if (!hover) return <g data-plan-layer="edgeHoverHighlight" />;
  const start = coordinateAdapter.projectionToSvg(hover.edgeStart);
  const end = coordinateAdapter.projectionToSvg(hover.edgeEnd);
  const grab = coordinateAdapter.projectionToSvg(hover.closestPoint);
  return (
    <g
      data-plan-layer="edgeHoverHighlight"
      data-plan-edge-hover-outline-id={hover.outlineId}
      data-plan-edge-hover-edge-index={hover.edgeIndex}
    >
      <line
        x1={start.x.toFixed(2)}
        y1={start.y.toFixed(2)}
        x2={end.x.toFixed(2)}
        y2={end.y.toFixed(2)}
        className={lineweightStyles.edgeHoverHighlight}
      />
      <circle
        cx={grab.x.toFixed(2)}
        cy={grab.y.toFixed(2)}
        r={4}
        className={lineweightStyles.edgeHoverGrabDot}
      />
    </g>
  );
}
