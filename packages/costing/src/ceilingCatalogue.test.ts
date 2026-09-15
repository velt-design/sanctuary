import { loadCostingMaterialsV1 } from './engine/materialsConfig';
import { describe, expect, it } from 'vitest';
import { CEILING_CATALOGUE, ceilingLengthSurcharge, isCeilingOption } from './ceilingCatalogue';

describe('ceiling supplier catalogue', () => {
  it('uses the owner-approved ex-GST rates and effective covers', () => {
    expect(Object.entries(CEILING_CATALOGUE).map(([key,item]) => Number((loadCostingMaterialsV1().items.find(row => row.id === 'ceiling.'+key+'_lm')!.cost_ex_gst / (item.coverMm / 1000)).toFixed(2)))).toEqual([98, 98.67, 134, 136.67]);
  });
  it('only accepts the four owned options', () => {
    expect(isCeilingOption('cedar-100')).toBe(true);
    expect(isCeilingOption('toString')).toBe(false);
    expect(isCeilingOption('cedar-110')).toBe(false);
  });
  it('preserves quoted surcharge boundaries', () => {
    expect(ceilingLengthSurcharge(1.8)).toBe(.1);
    expect(ceilingLengthSurcharge(2.4)).toBe(.1);
    expect(ceilingLengthSurcharge(2.7)).toBe(.3);
    expect(ceilingLengthSurcharge(4.8)).toBe(.3);
    for (const length of [0, 1.7, 2.5, 4.9, NaN, Infinity]) expect(() => ceilingLengthSurcharge(length)).toThrow();
  });
});
