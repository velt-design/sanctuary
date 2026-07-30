import { describe, expect, it } from 'vitest';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import {
  aucklandLocalDateTimeToIso,
  isManualCompletable,
  queueDueLabel,
  replyConfirmationCommand,
  sentConfirmationCommand,
  toLocalDateTimeValue,
} from './workQueuePresentation';

function entry(
  overrides: Partial<ProjectWorkQueueEntry> = {},
): ProjectWorkQueueEntry {
  return {
    projectId: 'proj_11111111-1111-4111-8111-111111111111',
    projectName: 'Test project',
    stage: 'contacted',
    group: 'today',
    actionKind: 'workItem',
    title: 'Send first enquiry email',
    reason: 'Due today.',
    dueAt: '2026-07-29T00:00:00.000Z',
    priority: 'NORMAL',
    blockedReason: null,
    effectiveAssignee: { kind: 'unassigned' },
    workItemId: '11111111-1111-4111-8111-111111111112',
    workItemRowVersion: 1,
    stateRowVersion: 1,
    sourceType: 'LEAD_CADENCE',
    sourceKey: 'lead:first-email:project:v1',
    subjectKind: 'PROJECT',
    subjectId: '11111111-1111-4111-8111-111111111111',
    href: '/staff/projects/proj_11111111-1111-4111-8111-111111111111?tab=activity',
    ...overrides,
  };
}

describe('work queue presentation', () => {
  it('uses operational labels before attempting to format a date', () => {
    expect(queueDueLabel(entry({ group: 'blocked' }))).toBe('Blocked');
    expect(queueDueLabel(entry({
      group: 'needsTriage',
      actionKind: 'stateReview',
    }))).toBe('Wake-up due');
    expect(queueDueLabel(entry({
      group: 'needsTriage',
      actionKind: 'needsTriage',
      dueAt: null,
    }))).toBe('Decision needed');
    expect(queueDueLabel(entry({
      group: 'today',
      actionKind: 'specialist',
      dueAt: null,
    }))).toBe('Ready now');
  });

  it('maps only approved cadence work to semantic confirmation commands', () => {
    expect(sentConfirmationCommand(entry())).toBe('RECORD_FIRST_ENQUIRY_EMAIL_SENT');
    expect(sentConfirmationCommand(entry({
      sourceKey: 'lead:follow-up:project:v1',
    }))).toBe('RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT');
    expect(sentConfirmationCommand(entry({
      sourceType: 'QUOTE_CADENCE',
      sourceKey: 'quote:follow-up:quote:v1',
    }))).toBe('RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT');
    expect(replyConfirmationCommand(entry())).toBe('RECORD_ENQUIRY_CUSTOMER_REPLY');
    expect(replyConfirmationCommand(entry({
      sourceType: 'QUOTE_CADENCE',
    }))).toBe('RECORD_QUOTE_CUSTOMER_REPLY');
    expect(sentConfirmationCommand(entry({
      sourceType: 'MANUAL',
      sourceKey: null,
    }))).toBeNull();
  });

  it('allows generic completion only for staff-owned manual work', () => {
    expect(isManualCompletable(entry({ sourceType: 'MANUAL' }))).toBe(true);
    expect(isManualCompletable(entry({ sourceType: 'LEGACY_REVIEW' }))).toBe(true);
    expect(isManualCompletable(entry({ sourceType: 'LEAD_CADENCE' }))).toBe(false);
    expect(isManualCompletable(entry({
      actionKind: 'specialist',
      sourceType: null,
    }))).toBe(false);
  });

  it('round-trips Auckland wall-clock values without using the browser timezone', () => {
    const iso = aucklandLocalDateTimeToIso('2026-07-29T09:30');
    expect(iso).toBe('2026-07-28T21:30:00.000Z');
    expect(toLocalDateTimeValue(iso)).toBe('2026-07-29T09:30');
    expect(aucklandLocalDateTimeToIso('not-a-date')).toBeNull();
  });
});
