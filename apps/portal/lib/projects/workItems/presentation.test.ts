import { describe, expect, it, vi } from 'vitest';
import {
  projectClosedOutcomeLabel,
  projectWorkDueLabel,
  projectWorkEffectiveAssigneeLabel,
  projectWorkResponsibilityLabel,
} from './presentation';

describe('Project Work presentation', () => {
  it('uses staff-facing outcome and responsibility language', () => {
    expect(projectClosedOutcomeLabel('LOST_TIMING_DEFERRED')).toBe(
      'Lost - Timing deferred',
    );
    expect(projectClosedOutcomeLabel('COMPLETE')).toBe('Complete');
    expect(projectWorkResponsibilityLabel('CUSTOMER')).toBe(
      'Customer follow-up',
    );
    expect(projectWorkResponsibilityLabel('OPERATIONS')).toBe('Delivery');
  });

  it('uses one assignee label contract for owner, staff, and missing states', () => {
    expect(
      projectWorkEffectiveAssigneeLabel({
        kind: 'projectOwner',
        ownerKey: 'jordan',
      }),
    ).toBe('Jordan');
    expect(
      projectWorkEffectiveAssigneeLabel(
        { kind: 'staff', userId: 'staff-1' },
        [
          {
            userId: 'staff-1',
            displayName: 'Sam Sales',
            email: null,
            accessRole: 'staff',
          },
        ],
      ),
    ).toBe('Sam Sales');
    expect(projectWorkEffectiveAssigneeLabel({ kind: 'unassigned' })).toBe(
      'Unassigned',
    );
  });

  it('uses one semantic due label contract across queue consumers', () => {
    const now = new Date('2026-07-31T02:00:00.000Z');
    expect(
      projectWorkDueLabel(
        { actionKind: 'specialist', group: 'today', dueAt: null },
        now,
      ),
    ).toBe('Ready now');
    expect(
      projectWorkDueLabel(
        {
          actionKind: 'workItem',
          group: 'overdue',
          dueAt: '2026-07-29T04:00:00.000Z',
        },
        now,
      ),
    ).toMatch(/^Overdue - /);
    expect(
      projectWorkDueLabel(
        { actionKind: 'needsTriage', group: 'needsTriage', dueAt: null },
        now,
      ),
    ).toBe('Decision needed');
  });
});


it('keeps overdue and upcoming formats exact across both Auckland DST changes', () => {
  for (const nowText of ['2026-04-04T13:59:59Z', '2026-04-04T14:00:00Z', '2026-09-26T13:59:59Z', '2026-09-26T14:00:00Z']) {
    const now = new Date(nowText);
    for (const offset of [-86400000, 0, 86400000]) {
      const due = new Date(now.valueOf() + offset);
      const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' });
      const expected = ymd.format(due) < ymd.format(now)
        ? `Overdue - ${new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short' }).format(due)}`
        : ymd.format(due) === ymd.format(now) ? 'Due today'
        : new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', day: 'numeric', month: 'short' }).format(due);
      expect(projectWorkDueLabel({ actionKind: 'workItem', group: 'today', dueAt: due.toISOString() }, now)).toBe(expected);
    }
  }
  expect(projectWorkDueLabel({ actionKind: 'workItem', group: 'today', dueAt: 'invalid' })).toBe('Due time unavailable');
});

it('re-evaluates the same due date against fresh current time after Auckland midnight', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    const action = { actionKind: 'workItem', group: 'today', dueAt: '2026-10-25T11:00:00Z' } as const;
    vi.setSystemTime(new Date('2026-10-25T10:59:59Z'));
    expect(projectWorkDueLabel(action)).not.toBe('Due today');
    vi.setSystemTime(new Date('2026-10-25T11:00:00Z'));
    expect(projectWorkDueLabel(action)).toBe('Due today');
    vi.setSystemTime(new Date('2026-10-26T11:00:00Z'));
    expect(projectWorkDueLabel(action)).toMatch(/^Overdue - /);
  } finally { vi.useRealTimers(); }
});
