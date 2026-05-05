import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import calcStyles from '@/app/staff/calculator/CalculatorGrid.module.css';
import { topProjectionShapeClassifier } from '@/components/drawings/viewports/selection/selectionRouter';
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
          className={calcStyles.moduleHouseFirstShapeHit}
          data-plan-hit-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
          data-plan-shape-target-kind={topProjectionShapeClassifier(shape).kind}
          onPointerDown={(event) => {
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
