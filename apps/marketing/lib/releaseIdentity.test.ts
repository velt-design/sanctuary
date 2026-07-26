import { describe, expect, it } from 'vitest';
import {
  MARKETING_RELEASE_HEADER,
  normalizeMarketingReleaseSha,
  resolveMarketingReleaseId,
} from './releaseIdentity';

describe('marketing release identity', () => {
  it('uses the explicit build SHA before deployment-provider values', () => {
    expect(
      resolveMarketingReleaseId({
        MARKETING_RELEASE_SHA: 'ABCDEF1234567',
        VERCEL_GIT_COMMIT_SHA: '1111111111111111111111111111111111111111',
        GITHUB_SHA: '2222222222222222222222222222222222222222',
      }),
    ).toBe('abcdef1234567');
  });

  it('uses the Vercel commit SHA for ordinary production deployments', () => {
    expect(
      resolveMarketingReleaseId({
        VERCEL_GIT_COMMIT_SHA: 'A1CCFACD0123456789ABCDEF0123456789ABCDEF',
      }),
    ).toBe('a1ccfacd0123456789abcdef0123456789abcdef');
  });

  it('falls back to a clearly non-production local identity', () => {
    expect(resolveMarketingReleaseId({})).toBe('local');
    expect(resolveMarketingReleaseId({ VERCEL_GIT_COMMIT_SHA: 'deployment-42' }))
      .toBe('local');
  });

  it('accepts only bounded hexadecimal repository revisions', () => {
    expect(normalizeMarketingReleaseSha('abcdef1')).toBe('abcdef1');
    expect(normalizeMarketingReleaseSha(' abcdef1234567890 ')).toBe(
      'abcdef1234567890',
    );
    expect(normalizeMarketingReleaseSha('abcdef')).toBeNull();
    expect(normalizeMarketingReleaseSha('g123456')).toBeNull();
    expect(normalizeMarketingReleaseSha(`${'a'.repeat(40)}0`)).toBeNull();
  });

  it('uses a stable response-header name', () => {
    expect(MARKETING_RELEASE_HEADER).toBe('X-Sanctuary-Release');
  });
});
