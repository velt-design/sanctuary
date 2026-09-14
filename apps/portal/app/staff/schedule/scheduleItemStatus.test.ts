import { expect, it } from 'vitest';
import type { ScheduleItem } from '@/lib/types/scheduling';
import { deriveScheduleStatus } from './scheduleItemStatus';
const item: ScheduleItem = { id: 'item', projectId: 'project', estimateId: 'estimate', installerId: 'crew', sortIndex: 0, updatedAt: '', itemType: 'job', scheduledJobId: 'job', startDateOverride: '2026-09-01', jobStatus: 'not_started' };
it('does not mark a planned V2 job started when the clock passes its date', () => {
  expect(deriveScheduleStatus(item, '2026-08-31')).toBe('TENTATIVE');
  expect(deriveScheduleStatus(item, '2026-09-22')).toBe('TENTATIVE');
  expect(deriveScheduleStatus({ ...item, jobStatus: null }, '2026-09-22')).toBe('TENTATIVE');
});
it('uses recorded starts and completion', () => {
  expect(deriveScheduleStatus({ ...item, actualStartDate: '2026-09-08' }, '2026-09-22')).toBe('IN_PROGRESS');
  expect(deriveScheduleStatus({ ...item, jobStatus: 'done' }, '2026-09-22')).toBe('COMPLETED');
});
