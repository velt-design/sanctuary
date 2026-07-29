import { describe, expect, it, vi } from 'vitest';

import {
  beginScheduleMutationActivity,
  getForeignScheduleMutationActivityCount,
  getScheduleMutationActivityCount,
  subscribeScheduleMutationActivity,
} from './scheduleMutationActivity';

describe('shared Schedule mutation activity', () => {
  it('excludes the owner, counts foreign work, and clears an idempotently ended token', () => {
    const scope = `test:${crypto.randomUUID()}`;
    const ownerA = Symbol('owner-a');
    const ownerB = Symbol('owner-b');
    const listener = vi.fn();
    const unsubscribe = subscribeScheduleMutationActivity(scope, listener);

    const endA = beginScheduleMutationActivity(scope, ownerA);
    expect(getScheduleMutationActivityCount(scope)).toBe(1);
    expect(getForeignScheduleMutationActivityCount(scope, ownerA)).toBe(0);
    expect(getForeignScheduleMutationActivityCount(scope, ownerB)).toBe(1);

    const endB = beginScheduleMutationActivity(scope, ownerB);
    expect(getScheduleMutationActivityCount(scope)).toBe(2);
    expect(getForeignScheduleMutationActivityCount(scope, ownerA)).toBe(1);
    expect(getForeignScheduleMutationActivityCount(scope, ownerB)).toBe(1);

    endA();
    endA();
    expect(getScheduleMutationActivityCount(scope)).toBe(1);
    expect(getForeignScheduleMutationActivityCount(scope, ownerB)).toBe(0);

    endB();
    expect(getScheduleMutationActivityCount(scope)).toBe(0);
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });
});
