import { describe, expect, it } from 'vitest';
import { accessoryReviewItems, reviewExamplePrice } from './accessoryReviewModel';

describe('accessory pricing review', () => {
  it('never treats installed schedules as supplier cost', () => {
    const item = accessoryReviewItems().find(item => item.id === 'installed')!;
    expect(item.example).toBeUndefined();
    expect(item.installation).toContain('Do not add a second');
  });
  it('flags conflicting and unquoted rates', () => {
    expect(accessoryReviewItems().find(item => item.id === 'cedar')?.status).toBe('Rate conflict');
    expect(accessoryReviewItems().find(item => item.id === 'thermopine')?.status).toBe('Needs supplier quote');
  });
  it('compares the same fitting and material quantities', () => {
    const cedar = accessoryReviewItems().find(item => item.id === 'cedar')!.example!;
    const pine = accessoryReviewItems().find(item => item.id === 'thermopine')!.example!;
    expect(cedar.scope).toBe(pine.scope);
    expect(cedar.cost - pine.cost).toBeCloseTo(50 * 4.5 * 1.3 * 1.1);
  });
  it('excludes GST from remaining margin', () => {
    expect(reviewExamplePrice(1000)).toEqual({ exGst: 1300, incGst: 1495, remainingEx: 300 });
  });
});
