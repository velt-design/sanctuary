import 'server-only';
import { isDeferredProjectFollowUp } from './deferredFollowUps';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { resolveProjectWorkEffectiveAssignee } from './effectiveAssignee';
import { activeConfirmationEventRows } from './confirmationFacts';
import { getProjectWorkReadContext, type ProjectWorkReadContext } from './projectWorkReadContext';
import { loadProjectWorkProjectionFacts, type ProjectWorkProjectionFacts, type ProjectWorkRow as Row } from './projectWorkProjectionFacts';
import { getAuthoritativeProjectWorkQueue } from './teamQueue';
import {
  resolveProjectWorkPrimaryAction,
  type RecoveryActionCandidate,
  type SpecialistActionCandidate,
} from './primaryAction';
import type {
  ProjectClosedOutcome,
  ProjectConfirmationType,
  ProjectOperationalState,
  ProjectWorkConfirmationFact,
  ProjectWorkItem,
  ProjectWorkItemOrigin,
  ProjectWorkItemPriority,
  ProjectWorkItemSourceType,
  ProjectWorkItemStatus,
  ProjectWorkProjection,
  ProjectWorkResponsibilityArea,
} from './types';

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function iso(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function positiveInteger(value: unknown, fallback = 1): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function mapWorkItem(row: Row, projectOwnerKey: string | null): ProjectWorkItem | null {
  const id = text(row.id);
  const projectId = text(row.project_id);
  const title = text(row.title);
  const dueAt = iso(row.due_at);
  const createdAt = iso(row.created_at);
  const updatedAt = iso(row.updated_at);
  if (!id || !projectId || !title || !dueAt || !createdAt || !updatedAt) return null;
  const assigneeUserId = text(row.assignee_user_id);
  return {
    id,
    projectId: appIdFromUuid('proj', projectId),
    title,
    responsibilityArea: text(row.responsibility_area) as ProjectWorkResponsibilityArea,
    status: text(row.status) as ProjectWorkItemStatus,
    dueAt,
    slaBreachAt: iso(row.sla_breach_at),
    deadlinePolicy: text(row.deadline_policy),
    calendarRevision: text(row.calendar_revision),
    assigneeUserId,
    effectiveAssignee: resolveProjectWorkEffectiveAssignee(assigneeUserId, projectOwnerKey),
    priority: text(row.priority) as ProjectWorkItemPriority,
    priorityReason: text(row.priority_reason),
    blockedReason: text(row.blocked_reason),
    origin: text(row.origin) as ProjectWorkItemOrigin,
    sourceType: text(row.source_type) as ProjectWorkItemSourceType,
    sourceKey: text(row.source_key),
    seriesKey: text(row.series_key),
    subjectKind: text(row.subject_kind),
    subjectId: text(row.subject_id),
    rowVersion: positiveInteger(row.row_version),
    createdAt,
    updatedAt,
    completedAt: iso(row.completed_at),
    cancelledAt: iso(row.cancelled_at),
    outcome: text(row.outcome),
    cancellationReason: text(row.cancellation_reason),
  };
}

function mapConfirmationFact(row: Row): ProjectWorkConfirmationFact | null {
  const id = text(row.id);
  const type = text(row.confirmation_type) as ProjectConfirmationType | null;
  const occurredAt = iso(row.occurred_at);
  const recordedAt = iso(row.recorded_at);
  if (!id || !type || !occurredAt || !recordedAt) return null;
  return {
    id,
    type,
    subjectKind: text(row.subject_kind) as ProjectWorkConfirmationFact['subjectKind'],
    subjectId: text(row.subject_id),
    occurredAt,
    recordedAt,
  };
}

export async function getProjectWorkProjection(params: {
  supabase: SupabaseClient;
  projectUuid: string;
  now?: Date;
  recoveryAction?: RecoveryActionCandidate | null;
  specialistAction?: SpecialistActionCandidate | null;
  readContext?: ProjectWorkReadContext;
  facts?: ProjectWorkProjectionFacts;
}): Promise<ProjectWorkProjection | null> {
  const { supabase, projectUuid } = params;
  const readContext = await getProjectWorkReadContext(params);
  if (!readContext || readContext.modelVersion !== 2) return null;
  const facts = params.facts ?? await loadProjectWorkProjectionFacts({ supabase, projectUuid, readContext });
  if (facts.readContext !== readContext) throw new Error('Project work facts do not match this request read context');
  const { stateRows, itemRows, confirmationRows } = facts;
  const stateRow = stateRows[0];
  const state = text(stateRow?.state) as ProjectOperationalState | null;
  if (!state) throw new Error('V2 project is missing its operational state');
  const projectOwnerKey = readContext.projectOwnerKey;
  const allItems = itemRows
    .map((row) => mapWorkItem(row, projectOwnerKey))
    .filter((item): item is ProjectWorkItem => item !== null && !isDeferredProjectFollowUp(item));
  const openItems = allItems.filter((item) => item.status === 'OPEN');
  const blockedItems = allItems.filter((item) => item.status === 'BLOCKED');
  const confirmedFacts = activeConfirmationEventRows(confirmationRows)
    .map(mapConfirmationFact)
    .filter((fact): fact is ProjectWorkConfirmationFact => fact !== null);
  const archived = Boolean(readContext.archivedAt);
  const now = params.now ?? new Date();
  const generatedAt = now.toISOString();
  const waitingUntil = iso(stateRow.waiting_until);
  const primaryAction = archived
    ? {
        kind: 'none' as const,
        title: 'Project archived',
        reason: 'Restore the project before assigning operational work.',
      }
    : state === 'CLOSED'
      ? {
          kind: 'none' as const,
          title: 'Project closed',
          reason: 'Reopen the project before assigning operational work.',
        }
      : state === 'WAITING'
        ? waitingUntil && Date.parse(waitingUntil) <= now.getTime()
          ? {
              kind: 'stateReview' as const,
              key: 'waiting-review' as const,
              title: 'Review waiting project' as const,
              reason: text(stateRow.waiting_reason) ?? 'The project wake-up time has arrived.',
              dueAt: waitingUntil,
            }
          : {
              kind: 'none' as const,
              title: 'Project waiting',
              reason: waitingUntil ? `Waiting until ${waitingUntil}.` : 'This project is intentionally waiting.',
            }
        : resolveProjectWorkPrimaryAction({
            workItems: openItems,
            recoveryAction: params.recoveryAction,
            specialistAction: params.specialistAction,
            hasBlockedWork: blockedItems.length > 0,
            needsTriageReason: blockedItems.length
              ? 'Blocked project work requires review.'
              : 'No current staff work or specialist action is recorded.',
            now,
          });

  return {
    projectId: appIdFromUuid('proj', projectUuid),
    modelVersion: 2,
    operationalState: state,
    effectiveState: archived ? 'ARCHIVED' : state,
    waitingUntil,
    waitingReason: text(stateRow.waiting_reason),
    closedOutcome: text(stateRow.closed_outcome) as ProjectClosedOutcome | null,
    stateRowVersion: positiveInteger(stateRow.row_version),
    primaryAction,
    openItems,
    blockedItems,
    confirmedFacts,
    generatedAt,
  };
}

export async function getProjectWorkQueue(
  supabase: SupabaseClient,
  options: { now?: Date; limit?: number } = {},
): ReturnType<typeof getAuthoritativeProjectWorkQueue> {
  return getAuthoritativeProjectWorkQueue(supabase, options);
}
