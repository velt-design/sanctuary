import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

export function PlanSelectionHaloLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="selectionHalo" pointerEvents="none">
      {items.map(({ shape, points }) => (
        <polygon
          key={`plan-selection-${shape.id}`}
          points={svgPointsAttr(points)}
          className={lineweightStyles.selectionHalo}
          data-plan-selection-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
        />
      ))}
    </g>
  );
}
