import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';

type PlanPointResolver = ((clientX: number, clientY: number) => PlanPoint | null) | null | undefined;

export function isProjectionBackedDeckDrag(input: {
  dragSource?: string | null;
  dragCoordinateSpace?: string | null;
}): boolean {
  return input.dragSource === 'top_projection_committed' ||
    input.dragCoordinateSpace === 'top_projection_world_m';
}

export function resolveDeckDragPlanPoint(input: {
  clientX: number;
  clientY: number;
  projectionBackedDeckDrag: boolean;
  deckDragPointResolver: PlanPointResolver;
  legacyPlanPointResolver: PlanPointResolver;
}): PlanPoint | null {
  const deckPoint = input.deckDragPointResolver?.(input.clientX, input.clientY) ?? null;
  if (input.projectionBackedDeckDrag) return deckPoint;
  return deckPoint ?? input.legacyPlanPointResolver?.(input.clientX, input.clientY) ?? null;
}
