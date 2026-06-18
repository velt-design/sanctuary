import type { HouseModel3D } from '@sp/geometry';
import { buildHouseSnapTargets } from './buildHouseSnapTargets';
import type { SnapLineTarget } from './snapEngine';

export type ProjectHouseSnapSource = {
  houseFormId: string;
  model: HouseModel3D | null | undefined;
};

type HouseSnapActiveFamily = 'pergolas' | 'decks' | 'house_forms' | 'openings' | null;

/**
 * PR-COMP-PHASE3.4 (2026-06-18): house-to-house snap.
 *
 * For pergola / deck drags the function emits snap targets from
 * every project house's wall and eave geometry. For house-form
 * drags (added in 3.4) it now ALSO emits targets — but from every
 * house form OTHER than the one being dragged, so a form never
 * snaps to itself. The active form is identified via
 * `excludeHouseFormId`.
 *
 * - pergolas: walls + roof eaves (pergolas attach at gutter)
 * - decks: walls only (decks sit at ground level, eaves are
 *   irrelevant for landings)
 * - house_forms: walls + roof eaves (composition vision treats
 *   house-form drag as both an edge-align operation — wall-to-wall —
 *   and an overhang-align operation — eave-to-eave for verandah
 *   alignment between two forms)
 */
export function buildProjectHouseSnapTargets(input: {
  activeFamily: HouseSnapActiveFamily;
  projectHouseSnapSources?: ReadonlyArray<ProjectHouseSnapSource> | null;
  fallbackHouseModel?: HouseModel3D | null;
  fallbackHouseObjectId?: string | null;
  excludeHouseFormId?: string | null;
}): SnapLineTarget[] {
  if (
    input.activeFamily !== 'pergolas' &&
    input.activeFamily !== 'decks' &&
    input.activeFamily !== 'house_forms'
  ) {
    return [];
  }

  const kinds = input.activeFamily === 'decks' ? 'walls' : 'walls_and_eaves';
  const baseSources =
    input.projectHouseSnapSources && input.projectHouseSnapSources.length
      ? input.projectHouseSnapSources
      : input.fallbackHouseModel
        ? [{
            houseFormId: input.fallbackHouseObjectId || 'house-main',
            model: input.fallbackHouseModel,
          }]
        : [];
  const sources = input.excludeHouseFormId
    ? baseSources.filter((source) => source.houseFormId !== input.excludeHouseFormId)
    : baseSources;

  return sources.flatMap((source) =>
    buildHouseSnapTargets({
      houseModel: source.model,
      houseObjectId: source.houseFormId,
      kinds,
    }),
  );
}
