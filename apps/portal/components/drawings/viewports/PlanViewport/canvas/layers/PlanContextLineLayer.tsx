import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

export function PlanContextLineLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="contextLines">
      {items.map(({ shape, points }) => (
        <polygon
          key={shape.id}
          points={svgPointsAttr(points)}
          className={lineweightStyles.contextLine}
          data-plan-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
        />
      ))}
    </g>
  );
}
