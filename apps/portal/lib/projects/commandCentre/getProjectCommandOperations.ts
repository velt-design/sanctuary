import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACTIVE_LEAD_TO_QUOTE_STAGES,
  buildProjectOwnerSummary,
  categoryForSource,
  normalizeManualCategory,
  resolveProjectPrimaryAction,
  type ProjectCommandActionCandidate,
  type ProjectCommandSelectionRecord,
} from './actionResolver';
import { getPortalStaffDirectory } from './staffDirectory';
import type {
  ProjectCommandActionSourceKind,
  ProjectCommandAuditEntry,
  ProjectCommandCentreOperations,
} from './types';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item && typeof item === 'object')) : [];
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function iso(value: unknown, fallback: string): string {
  const raw = stringValue(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : fallback;
}

function optionalIso(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function sourceKey(kind: ProjectCommandActionSourceKind, id: string): string {
  return `${kind}:${id}`;
}

async function queryRows(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, message: string): Promise<Row[]> {
  const result = await query;
  if (result.error) throw new Error(result.error.message ?? message);
  return rows(result.data);
}

export async function getProjectCommandOperations(args: {
  projectUuid: string;
  stage: string;
  supabase: SupabaseClient;
  viewerUserId: string;
  isAdmin: boolean;
  now?: Date;
}): Promise<ProjectCommandCentreOperations> {
  const { projectUuid, supabase } = args;
  const [staffRows, assignmentRows, taskRows, followupRows, manualRows, controlRows, selectionRows, auditRows, versionRows] = await Promise.all([
    getPortalStaffDirectory(supabase),
    queryRows(supabase.from('project_owner_assignments').select('owner_key,updated_at').eq('project_id', projectUuid).limit(1), 'Failed to load project owner'),
    queryRows(supabase.from('tasks').select('id,type,title,assigned_to,due_at,created_at,updated_at').eq('project_id', projectUuid).eq('status', 'OPEN'), 'Failed to load automation tasks'),
    queryRows(supabase.from('followup_tasks').select('id,type,assigned_to,due_at,created_at,updated_at').eq('project_id', projectUuid).eq('status', 'OPEN'), 'Failed to load follow-up tasks'),
    queryRows(supabase.from('project_manual_actions').select('id,title,category,owner_user_id,due_at,created_at,updated_at').eq('project_id', projectUuid).eq('status', 'OPEN'), 'Failed to load manual actions'),
    queryRows(supabase.from('project_action_controls').select('source_kind,source_id,is_critical,critical_reason,reschedule_count,updated_at').eq('project_id', projectUuid), 'Failed to load action controls'),
    queryRows(supabase.from('project_primary_action_selections').select('source_kind,source_id,confirmed_outranking_hash,candidate_revision,updated_at').eq('project_id', projectUuid).limit(1), 'Failed to load primary selection'),
    queryRows(supabase.from('project_command_audit').select('id,event_type,source_kind,source_id,actor_user_id,reason,created_at').eq('project_id', projectUuid).order('created_at', { ascending: false }).limit(20), 'Failed to load project command history'),
    queryRows(supabase.from('project_action_versions').select('version').eq('project_id', projectUuid).limit(1), 'Failed to load project action version'),
  ]);

  const staff = new Map(staffRows.map((person) => [person.userId, person]));
  const assignmentRow = assignmentRows[0];
  const owner = buildProjectOwnerSummary({
    stage: args.stage,
    assignment: assignmentRow && stringValue(assignmentRow.owner_key)
      ? { ownerKey: String(assignmentRow.owner_key), updatedAt: iso(assignmentRow.updated_at, new Date(0).toISOString()) }
      : null,
    isAdmin: args.isAdmin,
  });
  const controls = new Map(controlRows.flatMap((row) => {
    const kind = stringValue(row.source_kind) as ProjectCommandActionSourceKind | null;
    const id = stringValue(row.source_id);
    if (!kind || !id) return [];
    return [[sourceKey(kind, id), {
      isCritical: row.is_critical === true,
      criticalReason: stringValue(row.critical_reason),
      rescheduleCount: typeof row.reschedule_count === 'number' ? Math.max(0, Math.trunc(row.reschedule_count)) : 0,
    }] as const];
  }));
  const nowIso = (args.now ?? new Date()).toISOString();
  const buildCandidate = (row: Row, sourceKind: ProjectCommandActionSourceKind): ProjectCommandActionCandidate | null => {
    const sourceId = stringValue(row.id);
    if (!sourceId) return null;
    const sourceType = sourceKind === 'manual' ? null : stringValue(row.type)?.toUpperCase() ?? null;
    const control = controls.get(sourceKey(sourceKind, sourceId));
    const title = sourceKind === 'quote_followup'
      ? sourceType === 'FOLLOWUP_EMAIL' ? 'Email quote follow-up' : 'Call for quote follow-up'
      : stringValue(row.title) ?? 'Project action';
    return {
      sourceKind,
      sourceId,
      title,
      category: sourceKind === 'manual' ? normalizeManualCategory(row.category) : categoryForSource(sourceType),
      sourceType,
      assignedTo: stringValue(sourceKind === 'manual' ? row.owner_user_id : row.assigned_to),
      dueAt: optionalIso(row.due_at),
      createdAt: iso(row.created_at, nowIso),
      updatedAt: iso(row.updated_at, iso(row.created_at, nowIso)),
      isCritical: control?.isCritical ?? false,
      criticalReason: control?.criticalReason ?? null,
      rescheduleCount: control?.rescheduleCount ?? 0,
    };
  };
  const candidates = [
    ...taskRows.map((row) => buildCandidate(row, 'automation_task')),
    ...followupRows.map((row) => buildCandidate(row, 'quote_followup')),
    ...manualRows.map((row) => buildCandidate(row, 'manual')),
  ].filter((candidate): candidate is ProjectCommandActionCandidate => candidate !== null);

  const rawSelection = selectionRows[0];
  const selection: ProjectCommandSelectionRecord | null = rawSelection && stringValue(rawSelection.source_id)
    ? {
        sourceKind: stringValue(rawSelection.source_kind) as ProjectCommandActionSourceKind,
        sourceId: String(rawSelection.source_id),
        confirmedOutrankingHash: stringValue(rawSelection.confirmed_outranking_hash) ?? 'cc_741638a5',
      }
    : null;
  const resolved = resolveProjectPrimaryAction({
    candidates,
    owner,
    staff,
    selection,
    now: args.now,
    isAdmin: args.isAdmin,
  });
  const rawVersion = versionRows[0]?.version;
  const parsedVersion = typeof rawVersion === 'number' ? rawVersion : Number.parseInt(String(rawVersion ?? '0'), 10);
  const version = Number.isFinite(parsedVersion) ? Math.max(0, Math.trunc(parsedVersion)) : 0;
  const candidateRevision = `v${version}`;
  const audit: ProjectCommandAuditEntry[] = auditRows.flatMap((row) => {
    const id = stringValue(row.id);
    const eventType = stringValue(row.event_type);
    const createdAt = stringValue(row.created_at);
    if (!id || !eventType || !createdAt) return [];
    const sourceKind = stringValue(row.source_kind) as ProjectCommandActionSourceKind | null;
    const sourceId = stringValue(row.source_id);
    return [{
      id,
      eventType,
      actor: staff.get(stringValue(row.actor_user_id) ?? '') ?? null,
      reason: stringValue(row.reason),
      createdAt,
      source: sourceKind && sourceId ? { sourceKind, sourceId } : null,
    }];
  });
  return {
    owner,
    ...resolved,
    candidateRevision,
    ...(resolved.selectionConflict ? {
      selectionConflict: { ...resolved.selectionConflict, candidateRevision },
    } : null),
    audit,
    exceptions: {
      missingOwner: owner.missing,
      noPrimaryAction: ACTIVE_LEAD_TO_QUOTE_STAGES.has(args.stage) && !resolved.primaryAction,
      selectionConflict: Boolean(resolved.selectionConflict),
    },
  };
}
