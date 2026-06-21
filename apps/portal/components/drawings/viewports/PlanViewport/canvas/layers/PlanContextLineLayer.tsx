import { memo } from 'react';
import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

export const PlanContextLineLayer = memo(function PlanContextLineLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="contextLines" pointerEvents="none">
      {items.map(({ shape, points }) => (
        <polygon
          key={shape.id}
          points={svgPointsAttr(points)}
          className={lineweightStyles.contextLine}
          data-plan-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
          data-plan-shape-source-type={shape.sourceType}
          data-plan-pergola-fallback={
            shape.sourceType === 'pergola_reference' ? 'true' : undefined
          }
          data-plan-pergola-fallback-reason={
            typeof shape.metadata?.fallbackReason === 'string'
              ? shape.metadata.fallbackReason
              : undefined
          }
        />
      ))}
    </g>
  );
});
