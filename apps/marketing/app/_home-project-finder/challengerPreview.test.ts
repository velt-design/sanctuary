import { describe, expect, it } from 'vitest';
import { isHomepageChallengerPreview } from './challengerPreview';

describe('homepage challenger preview boundary', () => {
  it('keeps the approved homepage by default, including on preview', () => {
    expect(isHomepageChallengerPreview({})).toBe(false);
    expect(isHomepageChallengerPreview({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isHomepageChallengerPreview({ NODE_ENV: 'development' })).toBe(false);
  });
  it('requires an exact opt-in in a preview or local development environment', () => {
    expect(isHomepageChallengerPreview({ HOMEPAGE_CHALLENGER_PREVIEW: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' })).toBe(true);
    expect(isHomepageChallengerPreview({ HOMEPAGE_CHALLENGER_PREVIEW: '1', NODE_ENV: 'development' })).toBe(true);
    expect(isHomepageChallengerPreview({ HOMEPAGE_CHALLENGER_PREVIEW: 'true', VERCEL_ENV: 'preview' })).toBe(false);
  });
  it('refuses an inherited flag in production, unknown targets and unclassified production builds', () => {
    for (const VERCEL_ENV of ['production', 'staging', undefined]) {
      expect(isHomepageChallengerPreview({ HOMEPAGE_CHALLENGER_PREVIEW: '1', VERCEL_ENV, NODE_ENV: 'production' })).toBe(false);
    }
    expect(isHomepageChallengerPreview({ HOMEPAGE_CHALLENGER_PREVIEW: '1', VERCEL_ENV: 'production', NODE_ENV: 'development' })).toBe(false);
  });
});
