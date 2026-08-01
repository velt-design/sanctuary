import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_CARD_SIZE,
  PROJECT_CARD_SIZE_OPTIONS,
  getProjectCardImageSizes,
  getProjectCardSizeIndex,
  getProjectCardSizeOption,
  parseProjectCardSize,
} from './projectCardSize';

describe('project card size preferences', () => {
  it('exposes four ordered slider stops with Editorial as the default', () => {
    expect(PROJECT_CARD_SIZE_OPTIONS.map((option) => option.value)).toEqual([
      'showcase',
      'editorial',
      'compact',
      'overview',
    ]);
    expect(PROJECT_CARD_SIZE_OPTIONS.map((option) => option.scale)).toEqual([
      '02',
      '03',
      '04',
      '05',
    ]);
    expect(DEFAULT_PROJECT_CARD_SIZE).toBe('editorial');
    expect(getProjectCardSizeIndex(DEFAULT_PROJECT_CARD_SIZE)).toBe(1);
  });

  it('maps slider indexes safely and rejects unknown stored values', () => {
    expect(getProjectCardSizeOption(0).value).toBe('showcase');
    expect(getProjectCardSizeOption(3).value).toBe('overview');
    expect(getProjectCardSizeOption(99).value).toBe(DEFAULT_PROJECT_CARD_SIZE);
    expect(parseProjectCardSize('compact')).toBe('compact');
    expect(parseProjectCardSize('unexpected')).toBeNull();
    expect(parseProjectCardSize(null)).toBeNull();
  });

  it('keeps responsive image requests aligned with every density', () => {
    expect(getProjectCardImageSizes('showcase')).toContain('min(47vw, 48rem)');
    expect(getProjectCardImageSizes('editorial')).toContain('min(30vw, 32rem)');
    expect(getProjectCardImageSizes('compact')).toContain('min(23vw, 24rem)');
    expect(getProjectCardImageSizes('overview')).toContain('min(18vw, 19rem)');
  });
});
