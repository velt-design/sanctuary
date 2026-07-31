import { describe, expect, it } from 'vitest';
import type { WorkQueueEntryView } from './workQueuePresentation';
import {
  DEFAULT_WORK_QUEUE_FILTERS,
  filterWorkQueueEntries,
  workQueueOwnerOptions,
} from './workQueueFilters';

function entry(overrides: Partial<WorkQueueEntryView> = {}): WorkQueueEntryView {
  return {
    projectId: 'proj_1',
    projectName: 'Beach Deck',
    stage: 'quoting',
    group: 'today',
    actionKind: 'specialist',
    title: 'Prepare the quote',
    reason: 'Estimate is ready.',
    dueAt: null,
    priority: null,
    blockedReason: null,
    effectiveAssignee: { kind: 'projectOwner', ownerKey: 'jordan' },
    workItemId: null,
    workItemRowVersion: null,
    stateRowVersion: 1,
    sourceType: null,
    sourceKey: null,
    subjectKind: null,
    subjectId: null,
    repairSignalId: null,
    repairSignalRowVersion: null,
    href: '/staff/projects/proj_1',
    ...overrides,
  };
}

describe('Work Queue filters', () => {
  it('filters by owner, stage, due group, and search together', () => {
    const entries = [
      entry(),
      entry({
        projectId: 'proj_2',
        projectName: 'Garden Room',
        stage: 'scheduled',
        group: 'blocked',
        title: 'Resolve delivery issue',
        effectiveAssignee: { kind: 'unassigned' },
      }),
    ];
    expect(filterWorkQueueEntries(entries, [], {
      query: 'estimate',
      owner: 'projectOwner:jordan',
      stage: 'quoting',
      dueGroup: 'today',
    }).map((item) => item.projectId)).toEqual(['proj_1']);
    expect(filterWorkQueueEntries(entries, [], {
      ...DEFAULT_WORK_QUEUE_FILTERS,
      owner: 'unassigned',
    }).map((item) => item.projectId)).toEqual(['proj_2']);
  });

  it('offers only owners represented in the current queue', () => {
    expect(workQueueOwnerOptions([
      entry(),
      entry({ effectiveAssignee: { kind: 'unassigned' } }),
    ], []).map((option) => option.label)).toEqual([
      'All owners',
      'Jordan',
      'Unassigned',
    ]);
  });
});
