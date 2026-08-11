import { describe, expect, it } from 'vitest';
import { suggestPergolaPostCountV1 } from './postLayout';

describe('pergola post-count suggestion', () => {
  it.each([
    [1, 'facade', 2],
    [4, 'fascia', 2],
    [4.1, 'soffit', 3],
    [6, 'facade', 3],
    [8, 'facade', 3],
    [8.1, 'facade', 4],
    [6, 'none', 6],
    [8.1, 'none', 8],
  ] as const)('suggests %s m / %s as %i total posts', (lengthM, connection, expected) => {
    expect(suggestPergolaPostCountV1(lengthM, connection)).toBe(expected);
  });

  it('returns a safe two-post starting line for an invalid length', () => {
    expect(suggestPergolaPostCountV1(Number.NaN, 'facade')).toBe(2);
    expect(suggestPergolaPostCountV1(0, 'none')).toBe(4);
  });
});
