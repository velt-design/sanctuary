import {
  planDiagnosticFallbackReason,
  planShapeIsDiagnosticFallback,
} from '@/lib/drawings/views/plan/planDiagnosticFallbacks';
import {
  planShapeIsPergolaDiagnosticFallback,
  planShapeIsVisibleHouseReferenceFallback,
} from '@/lib/drawings/views/plan/planShapeOwnership';
import lineweightStyles from '../planLineweights.module.css';
import { svgPointsAttr, type PlanRenderItem } from '../planRenderItem';

function fallbackClassName(item: PlanRenderItem): string {
  if (planShapeIsPergolaDiagnosticFallback(item.shape)) {
    return lineweightStyles.diagnosticFallbackPergola;
  }
  return lineweightStyles.diagnosticFallbackHouse;
}

export function PlanDiagnosticFallbackLayer({ items }: { items: PlanRenderItem[] }) {
  return (
    <g data-plan-layer="diagnosticFallbacks" pointerEvents="none">
      {items.filter((item) => planShapeIsDiagnosticFallback(item.shape)).map((item) => (
        <polygon
          key={`plan-diagnostic-fallback-${item.shape.id}`}
          points={svgPointsAttr(item.points)}
          className={fallbackClassName(item)}
          data-plan-shape-id={item.shape.id}
          data-plan-shape-family={item.shape.family}
          data-plan-shape-kind={item.shape.kind}
          data-plan-shape-source-type={item.shape.sourceType}
          data-plan-diagnostic-fallback="true"
          data-plan-fallback-reason={planDiagnosticFallbackReason(item.shape) ?? undefined}
          data-plan-visible-reference-fallback={
            planShapeIsVisibleHouseReferenceFallback(item.shape) ? 'true' : undefined
          }
          data-plan-pergola-fallback={
            planShapeIsPergolaDiagnosticFallback(item.shape) ? 'true' : undefined
          }
        />
      ))}
    </g>
  );
}
