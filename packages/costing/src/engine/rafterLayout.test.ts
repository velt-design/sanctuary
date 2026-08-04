import { describe, expect, it } from 'vitest';
import { calculateAcrylicRafterLayoutV1 } from './rafterLayout';

describe('calculateAcrylicRafterLayoutV1', () => {
  it.each([
    [1_000, 3],
    [4_700, 9],
    [6_000, 11],
    [10_000, 17],
  ])('keeps %i mm acrylic rafters within the canonical spacing', (lengthMm, expectedCount) => {
    const layout = calculateAcrylicRafterLayoutV1(lengthMm);

    expect(layout.rafterCount).toBe(expectedCount);
    expect(layout.positions).toHaveLength(expectedCount);
    expect(layout.positions.at(0)).toBe(25 / lengthMm);
    expect(layout.positions.at(-1)).toBe((lengthMm - 25) / lengthMm);
    expect(layout.spacingMm).toBe((lengthMm - 50) / (expectedCount - 1));
    expect(layout.spacingMm).toBeLessThanOrEqual(642);
  });
});
