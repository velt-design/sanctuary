import { describe, expect, it } from 'vitest';

import { buildCalculatorReadinessSummary } from './calculatorReadinessSummary';

describe('calculator readiness summary', () => {
  it('reports a ready state when no check blocks or needs review', () => {
    expect(
      buildCalculatorReadinessSummary({
        items: [{ id: 'engine', level: 'ok' }],
        resultFreshness: 'current',
      }),
    ).toEqual({
      tone: 'ready',
      label: 'Ready to save',
      accessibleLabel: 'Ready to save',
      rootCauseCount: 0,
      blockedCheckCount: 0,
      reviewCount: 0,
    });
  });

  it.each([
    [1, '1 input issue blocks Save'],
    [3, '3 input issues block Save'],
  ] as const)('separates %i input cause(s) from two blocked checks', (causeCount, label) => {
    expect(
      buildCalculatorReadinessSummary({
        items: [
          { id: 'inputs', level: 'block', causeCount },
          { id: 'engine', level: 'block', blockedBy: 'inputs', causeCount: 0 },
        ],
        resultFreshness: 'invalid',
      }),
    ).toEqual({
      tone: 'blocked',
      label,
      accessibleLabel: `${label}. 2 readiness checks blocked.`,
      rootCauseCount: causeCount,
      blockedCheckCount: 2,
      reviewCount: 0,
    });
  });

  it('counts independent root causes without counting a derived check twice', () => {
    const summary = buildCalculatorReadinessSummary({
      items: [
        { id: 'project', level: 'block', causeCount: 1 },
        { id: 'inputs', level: 'block', causeCount: 2 },
        { id: 'engine', level: 'block', blockedBy: 'inputs', causeCount: 0 },
      ],
      resultFreshness: 'invalid',
    });

    expect(summary).toMatchObject({
      tone: 'blocked',
      label: '3 issues block Save',
      rootCauseCount: 3,
      blockedCheckCount: 3,
    });
  });

  it.each([
    ['calculating', 'Updating - Save waits for a current result'],
    ['stale', 'Recalculation pending - Save waits for a current result'],
    ['waiting', 'Waiting - Save needs a valid result'],
  ] as const)('presents %s as a wait rather than an independent defect', (resultFreshness, label) => {
    expect(
      buildCalculatorReadinessSummary({
        items: [{ id: 'engine', level: 'block', causeCount: 0 }],
        resultFreshness,
      }),
    ).toMatchObject({
      tone: 'waiting',
      label,
      rootCauseCount: 0,
      blockedCheckCount: 1,
    });
  });

  it('keeps an engine error as an independent cause', () => {
    expect(
      buildCalculatorReadinessSummary({
        items: [{ id: 'engine', level: 'block', causeCount: 1 }],
        resultFreshness: 'error',
      }),
    ).toMatchObject({
      tone: 'blocked',
      label: 'Engine error blocks Save',
      rootCauseCount: 1,
      blockedCheckCount: 1,
    });
  });

  it('reports warning-only review without making it a blocker', () => {
    expect(
      buildCalculatorReadinessSummary({
        items: [{ id: 'contact', level: 'review' }],
        resultFreshness: 'current',
      }),
    ).toEqual({
      tone: 'review',
      label: '1 item to review',
      accessibleLabel: '1 item to review',
      rootCauseCount: 0,
      blockedCheckCount: 0,
      reviewCount: 1,
    });
  });
});
