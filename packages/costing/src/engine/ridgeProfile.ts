import type { CostingConfigV1 } from './config';
import { isCostingManifestAtLeast } from '../manifestVersion';

/** Versioned automatic selection; explicit staff beam selections remain authoritative. */
export function automaticRidgeProfile(
  config: CostingConfigV1 | undefined,
  isGable: boolean,
  ridgeLengthM: number,
  previousDefault: string | null,
): string | null {
  return config?.manifest && isCostingManifestAtLeast(config, 2, 9) && isGable && ridgeLengthM > 6
    ? 'RHS 150x50x3'
    : previousDefault;
}
