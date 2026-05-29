import type { HouseModel3D } from '@sp/geometry';
import { buildHouseSnapTargets } from './buildHouseSnapTargets';
import type { SnapLineTarget } from './snapEngine';

export type ProjectHouseSnapSource = {
  houseFormId: string;
  model: HouseModel3D | null | undefined;
};

type HouseSnapActiveFamily = 'pergolas' | 'decks' | 'house_forms' | 'openings' | null;

export function buildProjectHouseSnapTargets(input: {
  activeFamily: HouseSnapActiveFamily;
  projectHouseSnapSources?: ReadonlyArray<ProjectHouseSnapSource> | null;
  fallbackHouseModel?: HouseModel3D | null;
  fallbackHouseObjectId?: string | null;
}): SnapLineTarget[] {
  if (input.activeFamily !== 'pergolas' && input.activeFamily !== 'decks') return [];

  const kinds = input.activeFamily === 'pergolas' ? 'walls_and_eaves' : 'walls';
  const sources =
    input.projectHouseSnapSources && input.projectHouseSnapSources.length
      ? input.projectHouseSnapSources
      : input.fallbackHouseModel
        ? [{
            houseFormId: input.fallbackHouseObjectId || 'house-main',
            model: input.fallbackHouseModel,
          }]
        : [];

  return sources.flatMap((source) =>
    buildHouseSnapTargets({
      houseModel: source.model,
      houseObjectId: source.houseFormId,
      kinds,
    }),
  );
}
