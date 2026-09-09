import { describe, expect, it } from 'vitest';
import { foliageOverlapsProduct } from './foliageOverlap';

describe('foliage obstruction', () => {
  const diamond = [{ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }];
  it('keeps trees visible in the empty corner of a rotated product rectangle', () => {
    expect(foliageOverlapsProduct(diamond, { x: 1.7, y: 1.7 }, .3, .3)).toBe(false);
  });
  it('detects foliage crossing an edge or covering the product', () => {
    expect(foliageOverlapsProduct(diamond, { x: 1.1, y: 1.1 }, .3, .3)).toBe(true);
    expect(foliageOverlapsProduct(diamond, { x: 0, y: 0 }, .3, .3)).toBe(true);
    expect(foliageOverlapsProduct(diamond, { x: 0, y: 0 }, 4, 4)).toBe(true);
  });
});
