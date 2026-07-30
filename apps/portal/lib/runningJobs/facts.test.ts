import { describe, expect, it } from 'vitest';
import { legacyRunningJobTaskProjectIds, resolveRunningJobFactState } from './facts';

describe('resolveRunningJobFactState', () => {
  it('keeps legacy project checks authoritative for unmarked projects', () => {
    expect(resolveRunningJobFactState({
      modelVersion: null,
      legacyTaskKeys: new Set(['order_materials', 'job_complete']),
      materialsOrderedAt: null,
      roofingOrderedAt: '2026-07-29T01:00:00.000Z',
      scheduleCompleted: false,
    })).toEqual({
      materialsOrdered: true,
      roofingOrdered: false,
      jobComplete: true,
    });
  });

  it('uses Running Jobs metadata and Schedule completion for V2 projects', () => {
    expect(resolveRunningJobFactState({
      modelVersion: 2,
      legacyTaskKeys: new Set(['roofing_ordered', 'job_complete']),
      materialsOrderedAt: '2026-07-29T01:00:00.000Z',
      roofingOrderedAt: null,
      scheduleCompleted: true,
    })).toEqual({
      materialsOrdered: true,
      roofingOrdered: false,
      jobComplete: true,
    });
  });
});

describe('legacyRunningJobTaskProjectIds', () => {
  it('prevents V2 projects from being read through the legacy task-check owner', () => {
    expect(legacyRunningJobTaskProjectIds([
      { id: 'legacy-project', modelVersion: null },
      { id: 'v2-project', modelVersion: 2 },
    ])).toEqual(['legacy-project']);
  });
});
