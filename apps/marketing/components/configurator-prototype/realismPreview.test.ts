import { expect, it } from 'vitest';
import { isBaselineScene } from './realismPreview';

it('does not let public query strings turn off the approved presentation', () => {
  expect(isBaselineScene('?scene=realism&render=baseline&bench=1', false)).toBe(false);
  expect(isBaselineScene('', false)).toBe(false);
});
it('retains an explicit local furnished baseline comparison', () => {
  expect(isBaselineScene('?render=baseline', true)).toBe(true);
  expect(isBaselineScene('', true)).toBe(false);
});
