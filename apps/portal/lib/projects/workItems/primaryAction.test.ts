import { describe, expect, it } from 'vitest';
import { rankActionableWorkItems, resolveProjectWorkPrimaryAction } from './primaryAction';
import type { ProjectWorkItem } from './types';

function item(
  id: string,
  dueAt: string,
  overrides: Partial<ProjectWorkItem> = {},
): ProjectWorkItem {
  return {
    id,
    projectId: 'project-1',
    title: id,
    responsibilityArea: 'CUSTOMER',
    status: 'OPEN',
    dueAt,
    slaBreachAt: null,
    deadlinePolicy: null,
    calendarRevision: null,
    assigneeUserId: null,
    effectiveAssignee: { kind: 'unassigned' },
    priority: 'NORMAL',
    priorityReason: null,
    blockedReason: null,
    origin: 'MANUAL',
    sourceType: 'MANUAL',
    sourceKey: null,
    seriesKey: null,
    subjectKind: null,
    subjectId: null,
    rowVersion: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    completedAt: null,
    cancelledAt: null,
    outcome: null,
    cancellationReason: null,
    ...overrides,
  };
}

describe('project work ranking', () => {
  const now = new Date('2026-07-10T02:00:00.000Z');

  it('orders critical, overdue, today, then future with stable tie-breaks', () => {
    const ranked = rankActionableWorkItems([
      item('future', '2026-07-12T05:00:00.000Z'),
      item('today-newer', '2026-07-10T05:00:00.000Z', { createdAt: '2026-07-02T00:00:00.000Z' }),
      item('overdue', '2026-07-09T05:00:00.000Z'),
      item('critical-future', '2026-07-20T05:00:00.000Z', {
        priority: 'CRITICAL',
        priorityReason: 'Director review',
      }),
      item('today-older', '2026-07-10T05:00:00.000Z'),
      item('blocked', '2026-07-01T05:00:00.000Z', {
        status: 'BLOCKED',
        blockedReason: 'Waiting for drawings',
      }),
    ], now);

    expect(ranked.map((entry) => entry.id)).toEqual([
      'critical-future',
      'overdue',
      'today-older',
      'today-newer',
      'future',
    ]);
  });

  it('places recovery first, urgent work before specialist work, and future work after it', () => {
    const recovery = {
      kind: 'recovery' as const,
      key: 'quote-delivery',
      title: 'Recover quote delivery',
      reason: 'Finalisation is incomplete.',
      href: '/commercial',
    };
    expect(resolveProjectWorkPrimaryAction({
      workItems: [item('overdue', '2026-07-09T05:00:00.000Z')],
      recoveryAction: recovery,
      now,
    })).toEqual(recovery);

    expect(resolveProjectWorkPrimaryAction({
      workItems: [item('overdue', '2026-07-09T05:00:00.000Z')],
      specialistAction: {
        kind: 'specialist',
        key: 'quote',
        title: 'Prepare quote',
        reason: 'Estimate is ready.',
        owner: 'Commercial',
        expectedResult: 'A draft quote is created.',
        href: '/commercial',
      },
      now,
    })).toMatchObject({
      kind: 'workItem',
      dueState: 'overdue',
      reason: 'This work is overdue.',
    });

    expect(resolveProjectWorkPrimaryAction({
      workItems: [item('future', '2026-07-20T05:00:00.000Z')],
      specialistAction: {
        kind: 'specialist',
        key: 'quote',
        title: 'Prepare quote',
        reason: 'Estimate is ready.',
        owner: 'Commercial',
        expectedResult: 'A draft quote is created.',
        href: '/commercial',
      },
      now,
    }).kind).toBe('specialist');
  });

  it('supplies the server-owned reason for each work-item ranking basis', () => {
    expect(resolveProjectWorkPrimaryAction({
      workItems: [item('critical', '2026-07-20T05:00:00.000Z', { priority: 'CRITICAL' })],
      now,
    })).toMatchObject({
      reason: 'Critical work is ranked ahead of other current work.',
    });
    expect(resolveProjectWorkPrimaryAction({
      workItems: [item('today', '2026-07-10T05:00:00.000Z')],
      now,
    })).toMatchObject({ reason: 'This work is due today.' });
    expect(resolveProjectWorkPrimaryAction({
      workItems: [item('future', '2026-07-20T05:00:00.000Z')],
      now,
    })).toMatchObject({ reason: 'This is the earliest due current work.' });
  });
});
