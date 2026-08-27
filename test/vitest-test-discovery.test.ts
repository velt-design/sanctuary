// @vitest-environment node

import { describe, expect, it } from 'vitest';

import vitestConfig from '../vitest.config';

describe('root Vitest test discovery', () => {
  it('keeps Playwright files isolated without replacing standard unit patterns', () => {
    expect(typeof vitestConfig).toBe('object');

    const testConfig = (vitestConfig as {
      test?: {
        exclude?: string[];
        include?: string[];
      };
    }).test;

    expect(testConfig?.exclude).toContain('playwright/**');
    expect(testConfig?.include).toBeUndefined();
  });
});
