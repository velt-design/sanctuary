import type { GeometryTopProjectionShape } from '@sp/geometry';
import { planHouseFormOwner } from './planShapeOwnership';
import type { ProjectionPlanGraphItem } from './planRenderGraph';

function planDiagnosticFallbackOwner(shape: GeometryTopProjectionShape): string {
  if (shape.family === 'house') return `house:${planHouseFormOwner(shape) ?? 'unowned'}`;
  if (shape.family === 'pergola') {
    return `pergola:${shape.metadata?.pergolaId ?? shape.sourceObjectId ?? shape.sourceId ?? shape.id}`;
  }
  return `${shape.family}:${shape.sourceObjectId ?? shape.sourceId ?? shape.id}`;
}

function diagnosticFallbackRank(shape: GeometryTopProjectionShape): number {
  if (shape.family === 'house') return 20;
  if (shape.family === 'pergola') return 30;
  return 50;
}

export function comparePlanDiagnosticFallbackItems<TItem extends { shape: GeometryTopProjectionShape }>(
  left: ProjectionPlanGraphItem<TItem>,
  right: ProjectionPlanGraphItem<TItem>,
): number {
  return (
    diagnosticFallbackRank(left.shape) - diagnosticFallbackRank(right.shape) ||
    planDiagnosticFallbackOwner(left.shape).localeCompare(planDiagnosticFallbackOwner(right.shape)) ||
    left.shape.zOrder - right.shape.zOrder ||
    left.shape.id.localeCompare(right.shape.id)
  );
}

export function withDiagnosticFallbackLayer<TItem extends { shape: GeometryTopProjectionShape }>(
  item: ProjectionPlanGraphItem<TItem>,
): ProjectionPlanGraphItem<TItem> {
  return { ...item, layer: 'diagnosticFallbacks' };
}
