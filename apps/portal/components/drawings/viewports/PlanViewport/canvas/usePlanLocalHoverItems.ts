import type { HoveredShape } from '../interactions/useHoveredShape';
import type { PlanRenderItem } from './planRenderItem';

export function buildPlanLocalHoverItems(input: {
  hoveredShape: HoveredShape | null;
  hitTargetItems: ReadonlyArray<PlanRenderItem>;
  diagnosticFallbackItems?: ReadonlyArray<PlanRenderItem>;
  selectionHaloItems: ReadonlyArray<PlanRenderItem>;
}): PlanRenderItem[] {
  const hoveredShapeId = input.hoveredShape?.shapeId;
  if (!hoveredShapeId) return [];

  const selectionShapeIds = new Set(input.selectionHaloItems.map((item) => item.shape.id));
  if (selectionShapeIds.has(hoveredShapeId)) return [];

  const diagnosticFallbackItems =
    input.diagnosticFallbackItems?.filter((item) => item.shape.id === hoveredShapeId) ?? [];
  if (diagnosticFallbackItems.length > 0) return diagnosticFallbackItems;

  return input.hitTargetItems.filter((item) => item.shape.id === hoveredShapeId);
}
