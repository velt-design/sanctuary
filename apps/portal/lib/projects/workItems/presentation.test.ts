import { describe, expect, it } from 'vitest';
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
