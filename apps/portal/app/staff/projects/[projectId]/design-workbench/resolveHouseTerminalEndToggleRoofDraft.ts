import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';

/**
 * Compute the next `HouseFormRoofIntentModel` after a user toggles a single
 * terminal end's open state on the Plan canvas (or the rail).
 *
 * The non-obvious case is `currentRoof.form === 'gable'`. The geometry
 * pipeline's normalize layer treats `form: 'gable'` as "hipped + every
 * terminal end open" regardless of `openGableEndIds` (see
 * `packages/geometry/src/normalize.ts:691-720` -- the migration that
 * supports the milestone 13 Dutch-hip retirement of standalone gable
 * forms). That means a house can have `form: 'gable'` +
 * `openGableEndIds: []` in the workbench state while the rendered
 * topology already shows every end open. A toggle from that implicit
 * state must port the migration into explicit workbench state in one
 * commit: convert to `form: 'hipped'` and seed `openGableEndIds` from
 * the full terminal-end set, then apply the toggle. Otherwise the diff
 * would be `[].filter(...) === []`, the commit is a no-op, normalize
 * re-migrates on the next solve, and the user sees no visible change.
 *
 * The helper is callsite-agnostic so the rail's toggle and the Plan
 * canvas's toggle can share it (or any future surface that toggles a
 * single terminal end).
 */
export function resolveHouseTerminalEndToggleRoofDraft(input: {
  currentRoof: HouseFormRoofIntentModel;
  endId: string;
  currentlyOpen: boolean;
  /**
   * Every terminal end id available on this house (the full set per the
   * resolved footprint + ridge axis). Required only for the
   * `form: 'gable'` migration path so we know what "all ends open"
   * means; passing the full set is always safe.
   */
  allTerminalEndIds: ReadonlyArray<string>;
}): HouseFormRoofIntentModel {
  const { currentRoof, endId, currentlyOpen, allTerminalEndIds } = input;
  if (currentRoof.form === 'gable') {
    const openIds = new Set(allTerminalEndIds);
    if (currentlyOpen) openIds.delete(endId);
    else openIds.add(endId);
    return {
      ...currentRoof,
      form: 'hipped',
      openGableEndIds: [...openIds],
    };
  }
  const currentOpenIds = currentRoof.openGableEndIds ?? [];
  const nextOpenIds = currentlyOpen
    ? currentOpenIds.filter((id) => id !== endId)
    : [...currentOpenIds, endId];
  return { ...currentRoof, openGableEndIds: nextOpenIds };
}
