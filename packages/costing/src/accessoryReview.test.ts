import { describe, expect, it } from 'vitest';
import { reviewSlatCost } from './accessoryReview';

describe('provisional timber assembly pricing', () => {
  const panel = { material: 'timber' as const, profile: '90x39', lengthM: 40, frameM: 10, cutPieces: 20, fixingPoints: 80 };
  it('prices ThermoPine below cedar without changing quantities or assembly labour', () => {
    expect(reviewSlatCost({ ...panel, species: 'thermopine' })).toBeLessThan(reviewSlatCost({ ...panel, species: 'cedar' }));
    expect(reviewSlatCost(panel)).toBe(reviewSlatCost({ ...panel, species: 'cedar' }));
  });
  it('charges more for more cutting and fixing, even at the same total timber length', () => {
    expect(reviewSlatCost({ ...panel, cutPieces: 40, fixingPoints: 160 })).toBeGreaterThan(reviewSlatCost(panel));
    expect(reviewSlatCost({ ...panel, setup: false })).toBeLessThan(reviewSlatCost(panel));
  });
  it('fails closed when timber fitting quantities are absent or invalid', () => {
    expect(() => reviewSlatCost({ ...panel, cutPieces: undefined })).toThrow();
    expect(() => reviewSlatCost({ ...panel, fixingPoints: -1 })).toThrow();
  });
});
