import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

function localHoverClassName(item: PlanRenderItem): string {
  if (item.layer === 'diagnosticFallbacks') {
    return lineweightStyles.localDiagnosticHoverHalo;
  }
  const isTerminalEnd =
    item.shape.kind === 'roof' && typeof item.shape.metadata?.openGableEndId === 'string';
  return isTerminalEnd
    ? `${lineweightStyles.localHoverHalo} ${lineweightStyles.terminalEndHoverHalo}`
    : lineweightStyles.localHoverHalo;
}

export function PlanLocalHoverLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="localHover" pointerEvents="none">
      {items.map((item) => (
        <polygon
          key={`plan-local-hover-${item.shape.id}`}
          points={svgPointsAttr(item.points)}
          className={localHoverClassName(item)}
          data-plan-local-hover-shape-id={item.shape.id}
          data-plan-shape-family={item.shape.family}
          data-plan-shape-kind={item.shape.kind}
        />
      ))}
    </g>
  );
}
