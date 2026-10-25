import type { CostingConfigV1 } from './config';
import type { RoofType } from './types';

/** Entered pitch and default pitch are separate so box-frame fall can retain its own calculation. */
export function normalizeEnteredRoofPitchDeg(value: unknown, isOpenRoof: boolean): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return isOpenRoof ? 0 : Number.isFinite(parsed) ? Math.min(85, Math.max(0, parsed)) : null;
}

export function defaultRoofPitchDeg(roofType: RoofType, config?: Pick<CostingConfigV1, 'rules'>): number {
  const pitchDefaults = config?.rules?.geometry?.roof_pitch_defaults_deg as Record<string, number> | undefined;
  const defaultPitchRaw = Number(
    pitchDefaults?.[roofType] ??
      (roofType === 'low_gable' ? 10 : roofType === 'gable' || roofType === 'hip' || roofType === 'hip_corner' ? 25 : 5),
  );
  return Number.isFinite(defaultPitchRaw) ? defaultPitchRaw : 5;
}
