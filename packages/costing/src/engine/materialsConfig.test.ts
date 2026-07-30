import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { loadCostingMaterialsV1 } from './materialsConfig';

describe('loadCostingMaterialsV1', () => {
  it('returns the exact merged material catalogue used by the full configuration', () => {
    expect(loadCostingMaterialsV1()).toEqual(loadCostingConfigV1().materials);
  });

  it('returns independent item arrays so callers cannot mutate package defaults', () => {
    const first = loadCostingMaterialsV1();
    const second = loadCostingMaterialsV1();

    expect(first).not.toBe(second);
    expect(first.items).not.toBe(second.items);
    expect(first.items).toEqual(second.items);
  });
});
