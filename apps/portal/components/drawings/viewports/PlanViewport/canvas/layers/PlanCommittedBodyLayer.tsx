import { planCommittedBodyTokenClass } from '../shapeStyle';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

export function PlanCommittedBodyLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="committedBodies" pointerEvents="none">
      {items.map(({ shape, points }) => (
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
