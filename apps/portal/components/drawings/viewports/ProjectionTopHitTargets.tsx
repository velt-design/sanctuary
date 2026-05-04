import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import { topProjectionShapeVisualOwner } from '@/lib/drawings/views/plan/planRenderGraph';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';
import {
  projectionTopShapePergolaId,
  projectionTopShapeToSelection,
} from './ProjectionTopInteractionAdapter';
import {
  toProjectionTopPointsAttr,
  type ProjectionTopItem,
} from './ProjectionTopLayers';

export function ProjectionTopHitTargets({
  items,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
}: {
  items: ProjectionTopItem[];
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
}) {
  return (
    <>
      {items.map(({ shape, points }) => {
        const selection = projectionTopShapeToSelection(shape);
        const pergolaId = projectionTopShapePergolaId(shape);
        const visualOwner = topProjectionShapeVisualOwner(shape);
        const handlePointerDown = (event: ReactPointerEvent<SVGPolygonElement>) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          if (pergolaId) {
            onSelectPergolaTarget?.(pergolaId);
            return;
          }
          if (selection) onSelectObjectWorkbenchTarget?.(selection);
        };

        return (
          <polygon
            key={`projection-top-hit-${shape.id}`}
            points={toProjectionTopPointsAttr(points)}
            data-plan-layer="hitTargets"
            data-plan-coordinate-space="top_projection_screen"
            data-plan-render-source="top_projection_committed"
            data-plan-visual-owner={visualOwner}
            data-object-workbench-shape-hit={selection ? `${selection.kind}:${selection.targetId ?? ''}` : undefined}
            data-object-workbench-shape-visual="false"
            data-object-workbench-shape-draggable="false"
            data-pergola-shape-hit={pergolaId ?? undefined}
            data-pergola-shape-hit-source={pergolaId ? 'top_projection_committed' : undefined}
            className={styles.moduleHouseFirstShapeHit}
            onClick={() => {
              if (pergolaId) {
                onSelectPergolaTarget?.(pergolaId);
                return;
              }
              if (selection) onSelectObjectWorkbenchTarget?.(selection);
            }}
            onPointerDown={handlePointerDown}
          />
        );
      })}
    </>
  );
}
