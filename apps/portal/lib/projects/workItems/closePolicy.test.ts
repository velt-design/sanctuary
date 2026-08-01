import { describe, expect, it } from 'vitest';
import {
  defaultLostCloseCancellationReason,
  isProjectLostClosedOutcome,
} from './closePolicy';

describe('project close policy', () => {
  it.each([
    'LOST_NO_RESPONSE',
    'LOST_BUDGET_PRICE',
    'LOST_OTHER_SUPPLIER',
    'LOST_TIMING_DEFERRED',
    'LOST_NOT_SUITABLE',
  ] as const)('treats %s as a Lost outcome with a neutral audit reason', (outcome) => {
    expect(isProjectLostClosedOutcome(outcome)).toBe(true);
    expect(defaultLostCloseCancellationReason(outcome)).toMatch(/^Project closed as Lost - /);
  });

  it.each(['CANCELLED', 'COMPLETE', null, ''])('does not relax non-Lost outcome %s', (outcome) => {
    expect(isProjectLostClosedOutcome(outcome)).toBe(false);
  });
});
