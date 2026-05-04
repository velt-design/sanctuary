import { planShapeClassForLayer } from '../shapeStyle';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

export function PlanCommittedBodyLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="committedBodies">
      {items.map(({ shape, points, layer }) => (
        <polygon
          key={shape.id}
          points={svgPointsAttr(points)}
          className={planShapeClassForLayer(shape, layer)}
          data-plan-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
        />
      ))}
    </g>
  );
}
