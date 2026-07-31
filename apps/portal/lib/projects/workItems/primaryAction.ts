import { aucklandLocalDate } from './businessCalendar';
import type { ProjectWorkItem, ProjectWorkPrimaryCandidate } from './types';

export type SpecialistActionCandidate = Extract<ProjectWorkPrimaryCandidate, { kind: 'specialist' }>;
export type RecoveryActionCandidate = Extract<ProjectWorkPrimaryCandidate, { kind: 'recovery' }>;

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function dueStateForWorkItem(
  item: ProjectWorkItem,
  now: Date,
): Extract<ProjectWorkPrimaryCandidate, { kind: 'workItem' }>['dueState'] {
  if (item.priority === 'CRITICAL') return 'critical';
  const due = time(item.dueAt);
  if (due < now.getTime()) return 'overdue';
  if (aucklandLocalDate(item.dueAt) === aucklandLocalDate(now)) return 'today';
  return 'future';
}

function rankingReasonForWorkItem(item: ProjectWorkItem, now: Date): string {
  const dueState = dueStateForWorkItem(item, now);
  if (dueState === 'critical') return 'Critical work is ranked ahead of other current work.';
  if (dueState === 'overdue') return 'This work is overdue.';
  if (dueState === 'today') return 'This work is due today.';
  return 'This is the earliest due current work.';
}

function urgencyRank(item: ProjectWorkItem, now: Date): number {
  const state = dueStateForWorkItem(item, now);
  if (state === 'critical') return 0;
  if (state === 'overdue') return 1;
  if (state === 'today') return 2;
  return 3;
}

export function rankActionableWorkItems(items: ProjectWorkItem[], now = new Date()): ProjectWorkItem[] {
  return items
    .filter((item) => item.status === 'OPEN')
    .slice()
    .sort((left, right) => {
      const urgency = urgencyRank(left, now) - urgencyRank(right, now);
      if (urgency !== 0) return urgency;
      const due = time(left.dueAt) - time(right.dueAt);
      if (due !== 0) return due;
      const created = time(left.createdAt) - time(right.createdAt);
      if (created !== 0) return created;
      return left.id.localeCompare(right.id);
    });
}

export function resolveProjectWorkPrimaryAction(params: {
  workItems: ProjectWorkItem[];
  recoveryAction?: RecoveryActionCandidate | null;
  specialistAction?: SpecialistActionCandidate | null;
  needsTriageReason?: string;
  now?: Date;
}): ProjectWorkPrimaryCandidate {
  if (params.recoveryAction) return params.recoveryAction;

  const now = params.now ?? new Date();
  const work = rankActionableWorkItems(params.workItems, now);
  const urgentWork = work.find((item) => dueStateForWorkItem(item, now) !== 'future');
  if (urgentWork) {
    return {
      kind: 'workItem',
      item: urgentWork,
      dueState: dueStateForWorkItem(urgentWork, now),
      reason: rankingReasonForWorkItem(urgentWork, now),
    };
  }
  if (params.specialistAction) return params.specialistAction;
  if (work[0]) {
    return {
      kind: 'workItem',
      item: work[0],
      dueState: dueStateForWorkItem(work[0], now),
      reason: rankingReasonForWorkItem(work[0], now),
    };
  }
  return {
    kind: 'needsTriage',
    title: 'Needs triage',
    reason: params.needsTriageReason ?? 'No current staff work or specialist action is recorded.',
  };
}
