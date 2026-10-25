import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { defaultRoofPitchDeg, normalizeEnteredRoofPitchDeg } from './roofPitch';

describe('canonical roof pitch resolution', () => {
  it.each([
    [5, 5], ['5', 5], [4.999, 4.999], [-1, 0], [90, 85],
    [undefined, null], [null, null], [NaN, null], [Infinity, null], ['invalid', null],
  ] as const)('preserves entered pitch parsing and clamping for %s', (value, expected) => {
    expect(normalizeEnteredRoofPitchDeg(value, false)).toBe(expected);
  });

  it('forces zero pitch for open roofs even when a pitch was supplied', () => {
    for (const value of [5, undefined, NaN]) expect(normalizeEnteredRoofPitchDeg(value, true)).toBe(0);
  });

  it('uses the configured defaults and retains the original roof-family fallbacks', () => {
    const config = structuredClone(loadCostingConfigV1());
    config.rules.geometry.roof_pitch_defaults_deg.pitched = 7;
    expect(defaultRoofPitchDeg('pitched', config)).toBe(7);
    config.rules.geometry.roof_pitch_defaults_deg.pitched = NaN;
    expect(defaultRoofPitchDeg('pitched', config)).toBe(5);
    expect(defaultRoofPitchDeg('pitched')).toBe(5);
    expect(defaultRoofPitchDeg('low_gable')).toBe(10);
    expect(defaultRoofPitchDeg('gable')).toBe(25);
    expect(defaultRoofPitchDeg('hip')).toBe(25);
    expect(defaultRoofPitchDeg('hip_corner')).toBe(25);
  });
});
