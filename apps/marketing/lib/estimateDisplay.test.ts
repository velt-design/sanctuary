import { expect, it } from 'vitest';
import { formatEstimate, roundedEstimate } from './estimateDisplay';
it('rounds displayed estimates to the nearest five dollars', () => {
  expect([11706,15362,15630,11708,11707.5].map(roundedEstimate)).toEqual([11705,15360,15630,11710,11710]);
  expect(formatEstimate(11706)).toBe('$11,705');
});
