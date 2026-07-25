import { describe, expect, it } from 'vitest';
import type { SeoLandingBlock } from './types';
import { orderSeoLandingBlocks } from './seoLandingViewModel';

const blocks = [
  { kind: 'split-intro', id: 'answer' },
  { kind: 'projects', id: 'projects' },
  { kind: 'faq', id: 'faq' },
] as unknown as readonly SeoLandingBlock[];

describe('orderSeoLandingBlocks', () => {
  it('preserves the authored order when no presentation order is supplied', () => {
    expect(orderSeoLandingBlocks(blocks)).toBe(blocks);
  });

  it('returns every block in the requested canonical order', () => {
    expect(
      orderSeoLandingBlocks(blocks, ['projects', 'answer', 'faq']).map(
        ({ id }) => id,
      ),
    ).toEqual(['projects', 'answer', 'faq']);
  });

  it.each([
    ['missing a block', ['projects', 'answer']],
    ['repeating a block', ['projects', 'answer', 'answer']],
    ['referencing an unknown block', ['projects', 'answer', 'unknown']],
  ])('fails safely when %s', (_label, blockOrder) => {
    expect(() => orderSeoLandingBlocks(blocks, blockOrder)).toThrow(
      'must reference every block exactly once',
    );
  });
});
