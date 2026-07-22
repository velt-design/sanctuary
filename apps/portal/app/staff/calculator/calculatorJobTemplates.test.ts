import { describe, expect, it } from 'vitest';
import { makeDefaultCalculatorInputs, makeDefaultModule } from './calculatorInputs';
import { applyCalculatorJobTemplate } from './calculatorJobTemplates';

describe('calculator job templates', () => {
  it('replaces only the active module and preserves site-level commercial fields', () => {
    const base = makeDefaultCalculatorInputs();
    const values = {
      ...base,
      travelExGst: '275',
      quoteDiscountPct: '5',
      pergolas: [
        { id: 'pergola-1', label: 'Front patio' },
        { id: 'pergola-2', label: 'Pool cover' },
      ],
      modules: [
        { ...makeDefaultModule('pergola-1'), lengthM: '8.5' },
        { ...makeDefaultModule('pergola-2'), lengthM: '4.2' },
      ],
    };

    const result = applyCalculatorJobTemplate(values, 1, 'attached_gable_acrylic');
    expect(result.modules[0]).toBe(values.modules[0]);
    expect(result.modules[1]).toMatchObject({
      pergolaId: 'pergola-2',
      pergolaStyle: 'gable',
      lengthM: '6',
      projectionM: '4',
    });
    expect(result.travelExGst).toBe('275');
    expect(result.quoteDiscountPct).toBe('5');
    expect(result.pergolas?.[1]).toEqual({ id: 'pergola-2', label: 'Pool cover' });
  });

  it('builds a freestanding starting module with no house connection', () => {
    const result = applyCalculatorJobTemplate(
      makeDefaultCalculatorInputs(),
      0,
      'freestanding_pitched_acrylic',
    );
    expect(result.modules[0]).toMatchObject({
      pergolaStyle: 'pitched',
      houseConnectionType: 'none',
      lengthM: '6',
      projectionM: '3',
    });
  });
});
