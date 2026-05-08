import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

/**
 * Cross-viewport hover halo. Renders a lightweight outline on every plan
 * shape that matches the externally-driven hover ref (e.g. when the user
 * pointer-overs an object in the 3D viewport). Visual is intentionally
 * lighter than `PlanSelectionHaloLayer` so the active selection still reads
 * as primary -- the hover halo is a secondary affordance.
 *
 * Empty `items` produces no DOM: when there's no external hover, the layer
 * is effectively absent.
 */
export function PlanHoverHaloLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="hoverHalo" pointerEvents="none">
      {items.map(({ shape, points }) => (
        <polygon
          key={`plan-hover-halo-${shape.id}`}
          points={svgPointsAttr(points)}
          className={lineweightStyles.hoverHalo}
          data-plan-hover-halo-shape-id={shape.id}
          data-plan-shape-family={shape.family}
          data-plan-shape-kind={shape.kind}
        />
      ))}
    </g>
  );
}
