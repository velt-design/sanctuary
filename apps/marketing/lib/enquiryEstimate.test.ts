import { describe, expect, it } from 'vitest';
import { toIndicativeRangeOneSided, toIndicativeSingleAmount } from './enquiryEstimate';

describe('toIndicativeRangeOneSided', () => {
  it('returns baseline -> +15% (residential), rounded to $250', () => {
    const trueCostIncGst = 19999;
    const range = toIndicativeRangeOneSided(trueCostIncGst, 'residential');

    // baseline = 19999 * 1.25 = 24998.75 -> rounds to 25000
    // high = baseline * 1.15 = 28748.5625 -> rounds to 28750
    expect(range.lowIncGst).toBe(25000);
    expect(range.highIncGst).toBe(28750);

    expect(range.lowIncGst % 250).toBe(0);
    expect(range.highIncGst % 250).toBe(0);
  });

  it('returns baseline -> +15% (commercial), rounded to $500', () => {
    const trueCostIncGst = 41234.56;
    const range = toIndicativeRangeOneSided(trueCostIncGst, 'commercial');

    // baseline = 41234.56 * 1.25 = 51543.2 -> rounds to 51500
    // high = baseline * 1.15 = 59274.68 -> rounds to 59500
    expect(range.lowIncGst).toBe(51500);
    expect(range.highIncGst).toBe(59500);

    expect(range.lowIncGst % 500).toBe(0);
    expect(range.highIncGst % 500).toBe(0);
  });

  it('is safe for invalid inputs', () => {
    expect(toIndicativeRangeOneSided(NaN, 'residential')).toEqual({ lowIncGst: 0, highIncGst: 0 });
    expect(toIndicativeRangeOneSided(-100, 'commercial')).toEqual({ lowIncGst: 0, highIncGst: 0 });
  });

  it('can return a single rounded lower-only amount', () => {
    const residential = toIndicativeSingleAmount(19999, 'residential');
    const commercial = toIndicativeSingleAmount(41234.56, 'commercial');

    expect(residential).toEqual({ lowIncGst: 25000, highIncGst: 25000 });
    expect(commercial).toEqual({ lowIncGst: 51500, highIncGst: 51500 });
  });
});
