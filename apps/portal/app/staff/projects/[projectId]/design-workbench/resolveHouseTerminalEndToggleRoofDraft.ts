import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';

/**
 * Compute the next `HouseFormRoofIntentModel` after a user toggles a single
 * terminal end's open state on the Plan canvas (or the rail).
 *
 * Milestone 13 session C retired `'gable'` from the `HouseRoofForm`
 * type union -- any legacy gable storage is mapped to `'hipped'` at the
 * `normalizeHouseFormRoofIntent` boundary. By the time this helper
 * runs, `currentRoof.form` is one of `'flat' | 'mono' | 'hipped'`. The
 * toggle is a simple add/remove on `openGableEndIds`.
 *
 * `allTerminalEndIds` is no longer required for the migration (the
 * migration moved upstream), but the parameter stays so existing
 * callers don't have to change shape. Passing the full set is still
 * always safe.
 */
export function resolveHouseTerminalEndToggleRoofDraft(input: {
  currentRoof: HouseFormRoofIntentModel;
  endId: string;
  currentlyOpen: boolean;
  allTerminalEndIds: ReadonlyArray<string>;
}): HouseFormRoofIntentModel {
  const { currentRoof, endId, currentlyOpen } = input;
  const currentOpenIds = currentRoof.openGableEndIds ?? [];
  const nextOpenIds = currentlyOpen
    ? currentOpenIds.filter((id) => id !== endId)
    : [...currentOpenIds, endId];
  return { ...currentRoof, openGableEndIds: nextOpenIds };
}
