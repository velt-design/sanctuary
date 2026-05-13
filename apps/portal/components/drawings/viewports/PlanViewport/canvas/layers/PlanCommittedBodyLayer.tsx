import { useMemo } from 'react';
import { planCommittedBodyTokenClass } from '../shapeStyle';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';
import { filterPlanVisibleBodies } from '../planVisibleBodyFilter';

export function PlanCommittedBodyLayer({ items }: { items: PlanRenderItem[] }) {
  const visibleItems = useMemo(() => filterPlanVisibleBodies(items), [items]);
  return (
    <g data-plan-layer="committedBodies" pointerEvents="none">
      {visibleItems.map(({ shape, points }) => (
        <polygon
          key={shape.id}
          points={svgPointsAttr(points)}
          className={planCommittedBodyTokenClass(shape)}
          data-plan-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
        />
      ))}
    </g>
  );
}
