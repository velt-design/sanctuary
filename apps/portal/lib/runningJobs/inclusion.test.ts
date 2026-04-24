import { describe, expect, it } from 'vitest';
import { shouldIncludeRunningJob } from './inclusion';

describe('shouldIncludeRunningJob', () => {
  it('excludes sent projects that do not have schedule state yet', () => {
    expect(shouldIncludeRunningJob('SENT', false)).toBe(false);
  });

  it('includes deposit and later pipeline stages', () => {
    expect(shouldIncludeRunningJob('DEPOSIT', false)).toBe(true);
    expect(shouldIncludeRunningJob('SCHEDULED', false)).toBe(true);
    expect(shouldIncludeRunningJob('COMPLETED', false)).toBe(true);
    expect(shouldIncludeRunningJob('PAID', false)).toBe(true);
  });

  it('keeps scheduled jobs visible even when the pipeline stage is still sent', () => {
    expect(shouldIncludeRunningJob('SENT', true)).toBe(true);
  });
});
