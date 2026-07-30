import { describe, expect, it } from 'vitest';
import { resolveRunningJobFactState } from './facts';

describe('resolveRunningJobFactState', () => {
  it('uses Running Jobs metadata and Schedule completion for every live project', () => {
    expect(resolveRunningJobFactState({
      materialsOrderedAt: '2026-07-29T01:00:00.000Z',
      roofingOrderedAt: '2026-07-29T01:00:00.000Z',
      scheduleCompleted: true,
    })).toEqual({
      materialsOrdered: true,
      roofingOrdered: true,
      jobComplete: true,
    });
  });

  it('does not infer specialist facts when their authoritative rows are empty', () => {
    expect(resolveRunningJobFactState({
      materialsOrderedAt: null,
      roofingOrderedAt: null,
      scheduleCompleted: false,
    })).toEqual({
      materialsOrdered: false,
      roofingOrdered: false,
      jobComplete: false,
    });
  });
});
