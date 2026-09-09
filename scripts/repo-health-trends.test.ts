import { describe, expect, it } from 'vitest';

import { parseRootCompatibilityReport } from './repo-health-parsers.mjs';

describe('parseRootCompatibilityReport', () => {
  it.each([
    'No root compatibility files detected.',
    'No changed root compatibility files detected.',
  ])('accepts the zero-result producer message: %s', (summary) => {
    expect(parseRootCompatibilityReport(summary)).toEqual({
      newGrowthFiles: 0,
      changedFiles: 0,
      legacyCompatibleFiles: 0,
    });
  });

  it('accepts the numeric producer summary', () => {
    expect(
      parseRootCompatibilityReport(
        '2 new-growth file(s), 3 changed file(s), 41 legacy-compatible file(s).',
      ),
    ).toEqual({
      newGrowthFiles: 2,
      changedFiles: 3,
      legacyCompatibleFiles: 41,
    });
  });

  it('rejects output without a recognized producer summary', () => {
    expect(() => parseRootCompatibilityReport('root compatibility report unavailable')).toThrow(
      'repo-health-trends: could not parse root compatibility report summary',
    );
  });
});
