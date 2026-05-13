import type { PlanRenderItem } from './planRenderItem';

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
 * footprint from the visible-body list when a `house + roof` body exists
 * in the same array. The polygon stays in committedBodies for hit-test
 * purposes; only the stroke is suppressed.
 *
 * See `docs/decision-log.md` 2026-05-13 "Plan Rendering -- Suppress House
 * Footprint When Roof Body Renders" for the split between graph-level
 * (hit-target) and render-level (visual) concerns.
 */
export function filterPlanVisibleBodies(items: ReadonlyArray<PlanRenderItem>): PlanRenderItem[] {
  const hasHouseRoofBody = items.some(
    ({ shape }) => shape.family === 'house' && shape.kind === 'roof',
  );
  if (!hasHouseRoofBody) return [...items];
  return items.filter(
    ({ shape }) => !(shape.family === 'house' && shape.kind === 'footprint'),
  );
}
