import { describe, expect, it } from 'vitest';
import { allocateMoneyCentsByWeightV1 } from './moneyAllocation';

describe('allocateMoneyCentsByWeightV1', () => {
  it('reconciles residual cents deterministically by largest remainder and id', () => {
    const result = allocateMoneyCentsByWeightV1(10, [
      { id: 'b', weight: 1 },
      { id: 'a', weight: 1 },
      { id: 'c', weight: 1 },
    ]);

    expect(result).toEqual({ b: 3, a: 4, c: 3 });
    expect(Object.values(result).reduce((sum, cents) => sum + cents, 0)).toBe(10);
  });

  it('puts a zero-weight total on the first stable id', () => {
    expect(allocateMoneyCentsByWeightV1(7, [
      { id: 'z', weight: 0 },
      { id: 'a', weight: Number.NaN },
    ])).toEqual({ a: 7, z: 0 });
  });

  it('rejects duplicate allocation ids', () => {
    expect(() => allocateMoneyCentsByWeightV1(10, [
      { id: 'same', weight: 1 },
      { id: 'same', weight: 2 },
    ])).toThrow(/unique/);
  });
});
