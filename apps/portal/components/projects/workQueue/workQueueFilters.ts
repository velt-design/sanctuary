import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import {
  effectiveAssigneeLabel,
  queueDueLabel,
  queueEntryReason,
  queueEntryStage,
  type WorkQueueEntryView,
} from './workQueuePresentation';

export type WorkQueueFilters = {
  query: string;
  owner: string;
  stage: string;
  dueGroup: WorkQueueEntryView['group'] | 'all';
};

export const DEFAULT_WORK_QUEUE_FILTERS: WorkQueueFilters = {
  query: '',
  owner: 'all',
  stage: 'all',
  dueGroup: 'all',
};

function workQueueOwnerValue(entry: WorkQueueEntryView): string {
  const assignee = entry.effectiveAssignee;
  if (assignee.kind === 'staff') return `staff:${assignee.userId}`;
  if (assignee.kind === 'projectOwner') return `projectOwner:${assignee.ownerKey}`;
  return 'unassigned';
}

export function workQueueOwnerOptions(
  entries: WorkQueueEntryView[],
  staff: ProjectCommandStaffSummary[],
) {
  const values = new Set(entries.map(workQueueOwnerValue));
  const staffById = new Map(staff.map((person) => [person.userId, person]));
  return [
    { value: 'all', label: 'All owners' },
    ...[...values].sort().map((value) => {
      if (value === 'unassigned') return { value, label: 'Unassigned' };
      if (value.startsWith('staff:')) {
        const id = value.slice('staff:'.length);
        return { value, label: staffById.get(id)?.displayName ?? 'Assigned staff' };
      }
      const ownerKey = value.slice('projectOwner:'.length);
      return {
        value,
        label: projectOwnerOption(ownerKey)?.displayName ?? 'Project owner',
      };
    }),
  ];
}

export function workQueueStageOptions(entries: WorkQueueEntryView[]) {
  const labels = new Map<string, string>();
  entries.forEach((entry) => {
    const label = queueEntryStage(entry).trim();
    if (label) labels.set(label.toLowerCase(), label.replaceAll('_', ' '));
  });
  return [
    { value: 'all', label: 'All stages' },
    ...[...labels].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({
      value,
      label: label.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),
    })),
  ];
}

export function filterWorkQueueEntries(
  entries: WorkQueueEntryView[],
  staff: ProjectCommandStaffSummary[],
  filters: WorkQueueFilters,
): WorkQueueEntryView[] {
  const query = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.owner !== 'all' && workQueueOwnerValue(entry) !== filters.owner) return false;
    if (filters.stage !== 'all' && queueEntryStage(entry).toLowerCase() !== filters.stage) return false;
    if (filters.dueGroup !== 'all' && entry.group !== filters.dueGroup) return false;
    if (!query) return true;
    const searchable = [
      entry.projectName,
      entry.title,
      queueEntryReason(entry),
      queueEntryStage(entry),
      effectiveAssigneeLabel(entry, staff),
      queueDueLabel(entry),
    ].join(' ').toLowerCase();
    return searchable.includes(query);
  });
}
