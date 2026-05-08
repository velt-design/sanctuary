import type { PlanRenderItem } from './planRenderItem';

/**
 * House-family kinds that are visual decoration, not selection targets.
 *
 * These kinds have higher zOrder than the canonical house outline (zOrder 0),
 * so they would otherwise sit on top in SVG and steal clicks from the canonical
 * outline. We drop them from the hit-target layer so clicks in the house area
 * fall through to the canonical outline.
 *
 * Walls, decks, openings, and attachment zones are intentionally NOT in this
 * set — they are real selection targets in PlanViewport.
 */
const DECORATIVE_HOUSE_KINDS: ReadonlySet<string> = new Set([
  'roof',
  'fascia',
  'soffit',
  'gutter',
  'roof_feature',
  'house_roof_material',
]);

export function isPlanHitTarget(item: PlanRenderItem): boolean {
  if (item.shape.family === 'house' && DECORATIVE_HOUSE_KINDS.has(item.shape.kind)) {
    // Milestone 13 plan-view UX exception: a hip-end facet (kind:'roof')
    // tagged with `metadata.openGableEndId` is a click target for the
    // open-as-gable toggle, NOT pure decoration. Keep it in the
    // hit-target layer so clicks dispatch to the toggle action and
    // hover styling shows over the hip triangle.
    if (
      item.shape.kind === 'roof' &&
      typeof item.shape.metadata?.openGableEndId === 'string'
    ) {
      return true;
    }
    return false;
  }
  return true;
}

export function filterPlanHitTargets(items: ReadonlyArray<PlanRenderItem>): PlanRenderItem[] {
  return items.filter(isPlanHitTarget);
}
