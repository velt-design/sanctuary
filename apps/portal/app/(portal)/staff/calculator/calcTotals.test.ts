import { describe, expect, it } from 'vitest';
import { buildAddonsTotals, computeDisplayTotals } from './calcTotals';

describe('calculator display totals', () => {
  it('keeps core totals unchanged when addons are present', () => {
    const coreEx = 1000;
    const coreInc = 1150;
    const addons = buildAddonsTotals(500, 575);
    const result = computeDisplayTotals(coreEx, coreInc, addons);
    expect(result.coreEx).toBe(coreEx);
    expect(result.coreInc).toBe(coreInc);
  });

  it('builds addons totals from blinds only', () => {
    const addons = buildAddonsTotals(250, 287.5);
    expect(addons.blinds.ex).toBe(250);
    expect(addons.blinds.inc).toBe(287.5);
    expect(addons.totals.ex).toBe(250);
    expect(addons.totals.inc).toBe(287.5);
  });
});
