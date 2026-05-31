import { planCommittedBodyTokenClass } from '../shapeStyle';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';
import { planShapeIsVisibleHouseReferenceFallback } from '@/lib/drawings/views/plan/planShapeOwnership';

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
          data-plan-shape-source-type={shape.sourceType}
          data-plan-visible-reference-fallback={
            planShapeIsVisibleHouseReferenceFallback(shape) ? 'true' : undefined
          }
        />
      ))}
    </g>
  );
}
