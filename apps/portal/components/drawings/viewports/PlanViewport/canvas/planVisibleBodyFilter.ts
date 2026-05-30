import type { PlanRenderItem } from './planRenderItem';

function houseFormOwner(shape: PlanRenderItem['shape']): string | null {
  if (shape.family !== 'house') return null;
  const taggedHouseFormId =
    typeof shape.metadata?.houseFormId === 'string' ? shape.metadata.houseFormId : null;
  if (taggedHouseFormId) return taggedHouseFormId;
  if (shape.sourceType === 'house_reference') {
    return shape.sourceObjectId ?? shape.sourceId ?? null;
  }
  return null;
}

/**
 * Visual-only filter for the Plan/Sheet committed-body render layer.
 *
 * The render graph keeps `house_reference + footprint` in `committedBodies`
 * because the hit-target chain (`filterPlanHitTargets(committedBodies)`)
 * derives clickable polygons from that same array, and house selection on
 * the canvas depends on the canonical reference footprint being present.
 *
 * For VISIBLE rendering, drawing the reference footprint outline on top of
 * a roof body produces overlapping concentric strokes (the user-reported
 * "doubled house lines" on Sheet). This helper drops the reference
 * footprint from the visible-body list when the same house form has a
 * `house + roof` body in the same array. Other house forms keep their
 * canonical footprint visible. The polygon stays in committedBodies for
 * hit-test purposes; only the stroke is suppressed.
 *
 * See `docs/decision-log.md` 2026-05-13 "Plan Rendering -- Suppress House
 * Footprint When Roof Body Renders" for the split between graph-level
 * (hit-target) and render-level (visual) concerns.
 */
export function filterPlanVisibleBodies(items: ReadonlyArray<PlanRenderItem>): PlanRenderItem[] {
  const houseFormIdsWithRoof = new Set<string>();
  let hasUnownedHouseRoofBody = false;
  for (const { shape } of items) {
    const isHouseRoofBody =
      shape.family === 'house' &&
      (shape.kind === 'roof' ||
        (shape.sourceType === 'house_roof_material' && shape.kind === 'house_roof_material'));
    if (!isHouseRoofBody) continue;
    const owner = houseFormOwner(shape);
    if (owner) houseFormIdsWithRoof.add(owner);
    else hasUnownedHouseRoofBody = true;
  }
  if (!houseFormIdsWithRoof.size && !hasUnownedHouseRoofBody) return [...items];
  return items.filter(({ shape }) => {
    if (shape.family !== 'house' || shape.kind !== 'footprint') return true;
    const owner = houseFormOwner(shape);
    return owner
      ? !houseFormIdsWithRoof.has(owner)
      : !hasUnownedHouseRoofBody;
  });
}
