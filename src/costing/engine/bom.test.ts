import { describe, expect, it } from 'vitest';
import { __test__ } from './bom';

const { selectBestStock } = __test__;

type TestBar = {
  id: string;
  category: string;
  unit: string;
  attributes: { profile: string; length_m: number; colour: string };
  cost_ex_gst: number;
  stock_length_m: number;
};

function bar(stockLengthM: number, costExGst: number): TestBar {
  return {
    id: `bar_${stockLengthM}`,
    category: 'aluminium_extrusion',
    unit: 'bar',
    attributes: { profile: 'test', length_m: stockLengthM, colour: 'Black' },
    cost_ex_gst: costExGst,
    stock_length_m: stockLengthM,
  };
}

describe('selectBestStock tie-breaker', () => {
  it('prefers lower cost per metre even with higher waste', () => {
    const bars = [bar(4, 8), bar(6, 15)];
    const cuts = [3, 3];
    const result = selectBestStock(bars as any, cuts, [6, 4]);
    expect(result.bar?.stock_length_m).toBe(4);
  });

  it('prefers lower waste when cost per metre ties', () => {
    const bars = [bar(4, 8), bar(6, 12)];
    const cuts = [3, 3];
    const result = selectBestStock(bars as any, cuts, [6, 4]);
    expect(result.bar?.stock_length_m).toBe(6);
  });

  it('prefers fewer bars when cost and waste tie', () => {
    const bars = [bar(4, 8), bar(6, 12)];
    const cuts = [3, 3, 3];
    const result = selectBestStock(bars as any, cuts, [6, 4]);
    expect(result.bar?.stock_length_m).toBe(6);
  });
});
