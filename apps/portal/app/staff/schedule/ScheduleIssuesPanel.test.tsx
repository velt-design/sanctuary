import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { ScheduleItem } from '@/lib/types/scheduling';
import { buildScheduleConflictIssues } from './scheduleConflictIssues';
import ScheduleIssuesPanel from './ScheduleIssuesPanel';

it('names both jobs and routes each conflict resolution to the intended job', () => {
  const items: ScheduleItem[] = ['first','second'].map((id) => ({ id, projectId: id, scheduledJobId: id, estimateId: 'estimate', installerId: 'crew', sortIndex: 0, updatedAt: '', mode: 'pinned', jobStatus: 'not_started' }));
  const projects = new Map(items.map((item) => [item.projectId, { id: item.projectId, name: `${item.id} project`, projectName: `${item.id} project`, status: 'DEPOSIT', nextActionDate: null, followUpDate: null }]));
  const issues = buildScheduleConflictIssues([{ job_id: 'second', conflicting_job_id: 'first', overlap_key: 'exact-dates', type: 'pinned_collision', pinned_start: '2026-09-10', expected_cursor_start: '2026-09-14', overlap_days: 2 }], items, projects);
  expect(issues[0].message).toBe('second project overlaps first project by 2 working days.');
  const onEdit = vi.fn(), onMove = vi.fn(), onKeep = vi.fn();
  const view = renderIntoDocument(<ScheduleIssuesPanel issues={issues} items={items} installers={[{ id: 'other', name: 'Other crew', color: '#000000', active: true, sortOrder: 1 }]} disabled={false} onEdit={onEdit} onMove={onMove} onKeep={onKeep} />);
  const click = (label: string) => act(() => Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === label)?.click());
  click('Change this date'); click('Change other job');
  expect(onEdit.mock.calls).toEqual([['second'],['first']]);
  act(() => { const select = view.container.querySelector('select')!; select.value = 'other'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  click('Change crew');
  expect(onMove).toHaveBeenCalledWith('second', 'other');
  click('Keep overlap');
  expect(onKeep).toHaveBeenCalledWith('second', 'exact-dates');
  view.unmount();
});
