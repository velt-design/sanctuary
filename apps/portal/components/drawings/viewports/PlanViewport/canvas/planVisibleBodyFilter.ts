import type { PlanRenderItem } from './planRenderItem';
import {
  planHouseFormOwner,
  planShapeIsHouseRoofBody,
} from '@/lib/drawings/views/plan/planShapeOwnership';

/**
 * Visual-only filter for the Plan/Sheet committed-body render layer.
 *
 * The render graph now keeps `house_reference + footprint` in `hitTargets`
 * and only promotes it to `committedBodies` as a visible fallback when that
 * same house form has no roof body. This filter remains as a defensive guard
 * for older callers and tests that still hand it mixed body/reference arrays.
 *
 * For VISIBLE rendering, drawing the reference footprint outline on top of
 * a roof body produces overlapping concentric strokes (the user-reported
 * "doubled house lines" on Sheet). This helper drops the reference
 * footprint from the visible-body list when the same house form has a
 * `house + roof` body in the same array. Other house forms keep their
 * canonical footprint visible. The polygon stays in committedBodies for
 * hit-test purposes; only the stroke is suppressed.
 *
 * See `docs/decision-log.md` 2026-05-30 "Plan Rendering -- interaction
 * references must not live in visible body layers" for the layer contract.
 */
export function filterPlanVisibleBodies(items: ReadonlyArray<PlanRenderItem>): PlanRenderItem[] {
  const houseFormIdsWithRoof = new Set<string>();
  let hasUnownedHouseRoofBody = false;
  for (const { shape } of items) {
    if (!planShapeIsHouseRoofBody(shape)) continue;
    const owner = planHouseFormOwner(shape);
    if (owner) houseFormIdsWithRoof.add(owner);
    else hasUnownedHouseRoofBody = true;
  }
  if (!houseFormIdsWithRoof.size && !hasUnownedHouseRoofBody) return [...items];
  return items.filter(({ shape }) => {
    if (shape.family !== 'house' || shape.kind !== 'footprint') return true;
    const owner = planHouseFormOwner(shape);
    return owner
      ? !houseFormIdsWithRoof.has(owner)
      : !hasUnownedHouseRoofBody;
  });
}
