import { describe, expect, it } from 'vitest';
import { toIndicativeRangeOneSided, toIndicativeSingleAmount } from './enquiryEstimate';

describe('toIndicativeRangeOneSided', () => {
  it('returns baseline -> +15% (residential), rounded to $250', () => {
    const trueCostIncGst = 19999;
    const range = toIndicativeRangeOneSided(trueCostIncGst, 'residential');

    // baseline = 19999 * 1.20 = 23998.8 -> rounds to 24000
    // high = baseline * 1.15 = 27598.62 -> rounds to 27500
    expect(range.lowIncGst).toBe(24000);
    expect(range.highIncGst).toBe(27500);

    expect(range.lowIncGst % 250).toBe(0);
    expect(range.highIncGst % 250).toBe(0);
  });

  it('returns baseline -> +15% (commercial), rounded to $500', () => {
    const trueCostIncGst = 41234.56;
    const range = toIndicativeRangeOneSided(trueCostIncGst, 'commercial');

    // baseline = 41234.56 * 1.20 = 49481.472 -> rounds to 49500
    // high = baseline * 1.15 = 56903.69 -> rounds to 57000
    expect(range.lowIncGst).toBe(49500);
    expect(range.highIncGst).toBe(57000);

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

    expect(residential).toEqual({ lowIncGst: 24000, highIncGst: 24000 });
    expect(commercial).toEqual({ lowIncGst: 49500, highIncGst: 49500 });
  });
});
