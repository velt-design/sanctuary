import type { HouseConnectionType } from './types';

export const DEFAULT_PERGOLA_POST_SPACING_M = 4;

/**
 * Suggests an editable starting post count. This is not a structural limit or
 * validation rule; staff can deliberately choose another count.
 */
export function suggestPergolaPostCountV1(
  lengthM: number,
  houseConnectionType: HouseConnectionType,
): number {
  const safeLengthM = Number.isFinite(lengthM) && lengthM > 0 ? lengthM : 0;
  const postsPerBeam = Math.max(
    2,
    Math.ceil(safeLengthM / DEFAULT_PERGOLA_POST_SPACING_M) + 1,
  );
  return postsPerBeam * (houseConnectionType === 'none' ? 2 : 1);
}
