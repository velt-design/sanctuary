import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { topProjectionShapeClassifier } from '@/components/drawings/viewports/selection/selectionRouter';
import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

export type PlanHitTargetLayerProps = {
  items: PlanRenderItem[];
  onShapePointerDown: (
    shape: GeometryTopProjectionShape,
    event: ReactPointerEvent<SVGPolygonElement>,
  ) => void;
  onShapeEnter: (shape: GeometryTopProjectionShape) => void;
  onShapeLeave: (shapeId: string) => void;
};

export function PlanHitTargetLayer({
  items,
  onShapePointerDown,
  onShapeEnter,
  onShapeLeave,
}: PlanHitTargetLayerProps) {
  return (
    <g data-plan-layer="hitTargets">
      {items.map(({ shape, points }) => (
        <polygon
          key={`plan-hit-${shape.id}`}
          points={svgPointsAttr(points)}
          className={lineweightStyles.hitTarget}
          data-plan-hit-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
          data-plan-shape-target-kind={topProjectionShapeClassifier(shape).kind}
          onPointerDown={(event) => {
            // Only swallow the primary button — that's what drives selection
            // and edge-drag. Right-click (button 2) and middle-click (button 1)
            // must bubble to the SVG root so `usePanZoom` can start a pan even
            // when the pointer is over an object.
            if (event.button !== 0) return;
            event.stopPropagation();
            onShapePointerDown(shape, event);
          }}
          onPointerEnter={() => onShapeEnter(shape)}
          onPointerLeave={() => onShapeLeave(shape.id)}
        />
      ))}
    </g>
  );
}
