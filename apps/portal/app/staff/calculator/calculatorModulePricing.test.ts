import type { PergolaOutputV1 } from '@sp/costing';
import { describe, expect, it } from 'vitest';

import { makeDefaultModule } from './calculatorInputs';
import { buildCalculatorModulePriceRows } from './calculatorModulePricing';

describe('calculator module price allocation', () => {
  it('allocates the final pergola customer price by direct module cost and reconciles exact cents', () => {
    const modules = [makeDefaultModule('p1'), makeDefaultModule('p1')];
    modules[0]!.lengthM = '3';
    modules[1]!.lengthM = '6';
    const pergola = {
      id: 'p1',
      label: 'Rear pergola',
      module_count: 2,
      modules: [
        { totals: { cost_ex_gst: 100 } },
        { totals: { cost_ex_gst: 300 } },
      ],
    } as PergolaOutputV1;

    const rows = buildCalculatorModulePriceRows({
      pergola,
      pergolaLabel: 'Rear pergola',
      modules,
      parentPriceIncGstCents: 10_001,
    });

    expect(rows.map((row) => row.priceIncGstCents)).toEqual([2_500, 7_501]);
    expect(rows.reduce((sum, row) => sum + row.priceIncGstCents, 0)).toBe(10_001);
    expect(rows.map((row) => row.parentId)).toEqual(['pergola:p1', 'pergola:p1']);
    expect(rows[0]?.detail).toContain('3m × 3m');
  });
});
