import { PORTAL_TIME_ZONE, portalTodayYmd } from '@/lib/format/portalDateTime';
import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';
import type {
  ProjectCommandActionCategory,
  ProjectCommandActionPermissions,
  ProjectCommandActionSourceKind,
  ProjectCommandActionSummary,
  ProjectCommandOwnerSummary,
  ProjectCommandSelectionConflict,
  ProjectCommandStaffSummary,
} from './types';
import { projectOwnerOption } from './projectOwners';

export const ACTIVE_LEAD_TO_QUOTE_STAGES = new Set(['new', 'contacted', 'site_visit', 'quoting', 'sent']);
export const PROJECT_OWNER_REQUIRED_STAGES = new Set([...ACTIVE_LEAD_TO_QUOTE_STAGES, 'deposit']);

const CUSTOMER_FACING_TASK_TYPES = new Set([
  'REVIEW_NEW_LEAD',
  'BOOK_SITE_VISIT',
  'ATTEND_SITE_VISIT',
  'FINALIZE_SEND_QUOTE',
  'FOLLOWUP_CALL',
  'FOLLOWUP_EMAIL',
  'SCHEDULE_INSTALL_WINDOW',
  'CONFIRM_FINAL_SCHEDULE',
  'RESEND_EMAIL',
]);

const CUSTOMER_FACING_MANUAL_CATEGORIES = new Set<ProjectCommandActionCategory>([
  'Call',
  'Site visit',
  'Quote',
  'Follow-up',
]);

export type ProjectCommandActionCandidate = {
  sourceKind: ProjectCommandActionSourceKind;
  sourceId: string;
  title: string;
  category: ProjectCommandActionCategory;
  sourceType: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  isCritical: boolean;
  criticalReason: string | null;
  rescheduleCount: number;
};

export type ProjectCommandSelectionRecord = {
  sourceKind: ProjectCommandActionSourceKind;
  sourceId: string;
  confirmedOutrankingHash: string;
};

function validDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) ? parsed : null;
}

function sourceLabel(sourceKind: ProjectCommandActionSourceKind): string {
  if (sourceKind === 'automation_task') return 'Automated workflow task';
  if (sourceKind === 'quote_followup') return 'Quote follow-up task';
  return 'Manual action';
}

export function projectOwnerRequired(stage: string): boolean {
  return PROJECT_OWNER_REQUIRED_STAGES.has(stage.trim().toLowerCase());
}

function isCustomerFacingAction(candidate: Pick<ProjectCommandActionCandidate, 'sourceType' | 'category' | 'sourceKind'>): boolean {
  if (candidate.sourceKind === 'manual') return CUSTOMER_FACING_MANUAL_CATEGORIES.has(candidate.category);
  return Boolean(candidate.sourceType && CUSTOMER_FACING_TASK_TYPES.has(candidate.sourceType));
}

function dueState(dueAt: string | null, now: Date): ProjectCommandActionSummary['dueState'] {
  const due = validDate(dueAt);
  if (!due) return 'needs_due_date';
  const dueYmd = portalTodayYmd(due);
  const today = portalTodayYmd(now);
  if (due.valueOf() < now.valueOf() && dueYmd <= today) return 'overdue';
  if (dueYmd === today) return 'today';
  if (dueYmd === addDaysYmd(today, 1)) return 'tomorrow';
  return 'future';
}

function dueLabel(dueAt: string | null, now: Date): string {
  const state = dueState(dueAt, now);
  if (state === 'needs_due_date') return 'Due date required';
  if (state === 'today') return 'Due today';
  if (state === 'tomorrow') return 'Due tomorrow';
  const due = validDate(dueAt);
  if (!due) return 'Due date required';
  const days = Math.abs(diffDaysYmd(portalTodayYmd(now), portalTodayYmd(due)));
  if (state === 'overdue') return days === 0 ? 'Overdue today' : `Overdue by ${days} day${days === 1 ? '' : 's'}`;
  return `Due in ${Math.max(1, days)} day${days === 1 ? '' : 's'}`;
}

function dueBucket(candidate: ProjectCommandActionCandidate, now: Date): number {
  const state = dueState(candidate.dueAt, now);
  if (state === 'overdue') return isCustomerFacingAction(candidate) ? 0 : 1;
  if (state === 'today') return 2;
  if (state === 'tomorrow' || state === 'future') return 3;
  return 4;
}

function compareCandidates(left: ProjectCommandActionCandidate, right: ProjectCommandActionCandidate, now: Date): number {
  const sourceRank = (candidate: ProjectCommandActionCandidate) => candidate.sourceKind === 'manual' ? 1 : 0;
  const sourceDifference = sourceRank(left) - sourceRank(right);
  if (sourceDifference) return sourceDifference;
  const dueDifference = dueBucket(left, now) - dueBucket(right, now);
  if (dueDifference) return dueDifference;
  const dueAtDifference = String(left.dueAt ?? '9999').localeCompare(String(right.dueAt ?? '9999'));
  if (dueAtDifference) return dueAtDifference;
  const createdDifference = left.createdAt.localeCompare(right.createdAt);
  if (createdDifference) return createdDifference;
  const kindDifference = left.sourceKind.localeCompare(right.sourceKind);
  return kindDifference || left.sourceId.localeCompare(right.sourceId);
}

function stableHash(parts: unknown): string {
  const input = JSON.stringify(parts);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cc_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function candidateIdentity(candidate: Pick<ProjectCommandActionCandidate, 'sourceKind' | 'sourceId'>): string {
  return `${candidate.sourceKind}:${candidate.sourceId}`;
}

function rankingSignature(candidate: ProjectCommandActionCandidate, now: Date) {
  return [candidate.sourceKind, candidate.sourceId, candidate.dueAt, candidate.createdAt, dueBucket(candidate, now)];
}

export function categoryForSource(sourceType: string | null): ProjectCommandActionCategory {
  const type = String(sourceType ?? '').toUpperCase();
  if (type.includes('CALL')) return 'Call';
  if (type.includes('SITE_VISIT')) return 'Site visit';
  if (type.includes('DESIGN')) return 'Design';
  if (type.includes('QUOTE')) return 'Quote';
  if (type.includes('EMAIL') || type.includes('FOLLOWUP')) return 'Follow-up';
  return 'Other';
}

export function normalizeManualCategory(value: unknown): ProjectCommandActionCategory {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'call') return 'Call';
  if (normalized === 'site_visit' || normalized === 'site visit') return 'Site visit';
  if (normalized === 'design') return 'Design';
  if (normalized === 'estimate') return 'Estimate';
  if (normalized === 'quote') return 'Quote';
  if (normalized === 'follow_up' || normalized === 'follow-up' || normalized === 'follow up') return 'Follow-up';
  return 'Other';
}

export function buildProjectOwnerSummary(args: {
  stage: string;
  assignment: { ownerKey: string; updatedAt: string } | null;
  isAdmin: boolean;
}): ProjectCommandOwnerSummary {
  const owner = projectOwnerOption(args.assignment?.ownerKey);
  const required = projectOwnerRequired(args.stage);
  return {
    owner,
    required,
    missing: required && !owner,
    version: args.assignment?.updatedAt ?? null,
    permissions: { canManage: args.isAdmin },
  };
}

export function resolveProjectPrimaryAction(args: {
  candidates: ProjectCommandActionCandidate[];
  owner: ProjectCommandOwnerSummary;
  staff: Map<string, ProjectCommandStaffSummary>;
  selection: ProjectCommandSelectionRecord | null;
  now?: Date;
  isAdmin: boolean;
}): {
  primaryAction: ProjectCommandActionSummary | null;
  candidates: ProjectCommandActionSummary[];
  candidateCount: number;
  candidateRevision: string;
  manualSelectionBaselineHash: string;
  selectionConflict: ProjectCommandSelectionConflict | null;
  permissions: ProjectCommandActionPermissions;
} {
  const now = args.now ?? new Date();
  const sorted = args.candidates.slice().sort((left, right) => compareCandidates(left, right, now));
  const eligible = sorted.filter((candidate) => validDate(candidate.dueAt));
  const automatic = eligible[0] ?? null;
  const selected = args.selection
    ? eligible.find((candidate) => candidateIdentity(candidate) === `${args.selection?.sourceKind}:${args.selection?.sourceId}`) ?? null
    : null;
  const current = selected ?? automatic;
  const mapCandidate = (candidate: ProjectCommandActionCandidate): ProjectCommandActionSummary => {
    const explicitAssignee = candidate.assignedTo ? args.staff.get(candidate.assignedTo) ?? null : null;
    const projectOwner = args.owner.owner;
    const owner = explicitAssignee
      ? { userId: explicitAssignee.userId, displayName: explicitAssignee.displayName }
      : projectOwner
        ? { userId: null, displayName: projectOwner.displayName }
        : null;
    return {
      sourceKind: candidate.sourceKind,
      sourceId: candidate.sourceId,
      title: candidate.title,
      category: candidate.category,
      sourceLabel: sourceLabel(candidate.sourceKind),
      sourceType: candidate.sourceType,
      owner,
      ownerSource: explicitAssignee ? 'source_assignee' : projectOwner ? 'project_owner' : 'unassigned',
      dueAt: candidate.dueAt,
      dueState: dueState(candidate.dueAt, now),
      dueLabel: dueLabel(candidate.dueAt, now),
      isCustomerFacing: isCustomerFacingAction(candidate),
      isCritical: candidate.isCritical,
      criticalReason: candidate.criticalReason,
      rescheduleCount: candidate.rescheduleCount,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      requiresDueDate: !validDate(candidate.dueAt),
      isExplicitlySelected: Boolean(selected && candidateIdentity(selected) === candidateIdentity(candidate)),
      selectionBaselineHash: stableHash(eligible
        .filter((other) => candidateIdentity(other) !== candidateIdentity(candidate) && compareCandidates(other, candidate, now) < 0)
        .map((other) => rankingSignature(other, now))),
    };
  };
  const candidateRevision = stableHash(sorted.map((candidate) => rankingSignature(candidate, now)));
  const manualSelectionBaselineHash = stableHash(eligible
    .filter((candidate) => candidate.sourceKind !== 'manual')
    .map((candidate) => rankingSignature(candidate, now)));
  let selectionConflict: ProjectCommandSelectionConflict | null = null;
  if (selected) {
    const outranking = eligible.filter((candidate) => {
      if (candidateIdentity(candidate) === candidateIdentity(selected)) return false;
      return compareCandidates(candidate, selected, now) < 0;
    });
    const outrankingHash = stableHash(outranking.map((candidate) => rankingSignature(candidate, now)));
    if (outranking.length && outrankingHash !== args.selection?.confirmedOutrankingHash) {
      selectionConflict = {
        current: mapCandidate(selected),
        challenger: mapCandidate(outranking[0]),
        outrankingCandidates: outranking.slice(0, 25).map(mapCandidate),
        challengerCount: outranking.length,
        candidateRevision,
      };
    }
  }
  const conflictRequiresResolution = Boolean(selectionConflict);
  return {
    primaryAction: current ? mapCandidate(current) : null,
    candidates: sorted.slice(0, 25).map(mapCandidate),
    candidateCount: sorted.length,
    candidateRevision,
    manualSelectionBaselineHash,
    selectionConflict,
    permissions: {
      canCreate: !conflictRequiresResolution,
      canSelect: !conflictRequiresResolution,
      canComplete: Boolean(current),
      canReschedule: Boolean(current) && !conflictRequiresResolution,
      canReassign: Boolean(current) && !conflictRequiresResolution,
      canSetCritical: Boolean(current) && !conflictRequiresResolution,
      canResolveConflict: Boolean(selectionConflict && args.isAdmin),
    },
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second')) - date.valueOf();
}

export function portalDueDateToIso(date: string): string | null {
  if (!isYmd(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
  let offset = timeZoneOffsetMs(localAsUtc, PORTAL_TIME_ZONE);
  let instant = new Date(localAsUtc.valueOf() - offset);
  const correctedOffset = timeZoneOffsetMs(instant, PORTAL_TIME_ZONE);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = new Date(localAsUtc.valueOf() - offset);
  }
  return instant.toISOString();
}
