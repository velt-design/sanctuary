import type { PlanRenderItem } from './planRenderItem';
import { planShapeIsPlanHitTarget } from '@/lib/drawings/views/plan/planShapeOwnership';

export function isPlanHitTarget(item: PlanRenderItem): boolean {
  return planShapeIsPlanHitTarget(item.shape);
}

export function filterPlanHitTargets(items: ReadonlyArray<PlanRenderItem>): PlanRenderItem[] {
  return items.filter(isPlanHitTarget);
}
