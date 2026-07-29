import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { getProjectWorkProjection } from '@/lib/projects/workItems/repository';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import {
  ACTIVE_LEAD_TO_QUOTE_STAGES,
  PROJECT_OWNER_REQUIRED_STAGES,
  buildProjectOwnerSummary,
  categoryForSource,
  normalizeManualCategory,
  resolveProjectPrimaryAction,
  type ProjectCommandActionCandidate,
  type ProjectCommandSelectionRecord,
} from './actionResolver';
import { getPortalStaffDirectory } from './staffDirectory';
import { fetchRowsByIdChunks } from '@/lib/list/listLimits';
import type {
  ProjectCommandActionSourceKind,
  ProjectCommandException,
  ProjectCommandExceptionsResponse,
} from './types';

type Row = Record<string, any>;
const V2_PROJECTION_BATCH_SIZE = 20;

function list(value: unknown): Row[] { return Array.isArray(value) ? value as Row[] : []; }
function relationRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  return value && typeof value === 'object' ? [value as Row] : [];
}
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function timestamp(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}
function sourceKey(kind: string, id: string) { return `${kind}:${id}`; }
function group(rows: Row[]): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const row of rows) {
    const projectId = text(row.project_id);
    if (!projectId) continue;
    const bucket = out.get(projectId) ?? [];
    bucket.push(row);
    out.set(projectId, bucket);
  }
  return out;
}

function usesV2ProjectWork(project: Row): boolean {
  return relationRows(project.workModel).some((row) => Number(row.model_version) === 2);
}

async function read(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, label: string) {
  const result = await query;
  if (result.error) throw new Error(result.error.message ?? `Failed to load ${label}`);
  return list(result.data);
}

async function loadV2Projections(
  supabase: SupabaseClient,
  projects: Array<Row & { id: string }>,
  now: Date,
): Promise<Map<string, ProjectWorkProjection>> {
  const out = new Map<string, ProjectWorkProjection>();
  for (let offset = 0; offset < projects.length; offset += V2_PROJECTION_BATCH_SIZE) {
    const batch = await Promise.all(
      projects.slice(offset, offset + V2_PROJECTION_BATCH_SIZE).map(async (project) => {
        const projection = await getProjectWorkProjection({
          supabase,
          projectUuid: project.id,
          now,
        });
        if (!projection) throw new Error(`V2 project work could not be loaded for ${project.id}`);
        return [project.id, projection] as const;
      }),
    );
    for (const [projectId, projection] of batch) out.set(projectId, projection);
  }
  return out;
}

export async function getProjectCommandExceptions(
  supabase: SupabaseClient,
  viewer: { userId: string; isAdmin: boolean },
  now = new Date(),
): Promise<ProjectCommandExceptionsResponse> {
  const projects = await read(
    supabase
      .from('projects')
      .select('id,name,pipeline_stage,created_at,workModel:project_work_model_versions(model_version)'),
    'exception projects',
  );
  const activeProjects: Array<Row & { id: string; stage: string }> = projects.flatMap((project) => {
    const stage = normalizePipelineStageKey(normalizeProjectStatus(project.pipeline_stage ?? 'NEW').status) ?? 'new';
    const id = text(project.id);
    return id && (ACTIVE_LEAD_TO_QUOTE_STAGES.has(stage) || PROJECT_OWNER_REQUIRED_STAGES.has(stage))
      ? [{ ...project, id, stage }]
      : [];
  });
  if (!activeProjects.length) {
    return { counts: { selection_conflict: 0, no_action: 0, missing_owner: 0 }, projects: [], totalProjects: 0, generatedAt: now.toISOString() };
  }
  const ids = activeProjects.map((project) => project.id);
  const v2Projects = activeProjects.filter(usesV2ProjectWork);
  const legacyIds = activeProjects
    .filter((project) => !usesV2ProjectWork(project))
    .map((project) => project.id);
  const [staffRows, assignments, v2Projections] = await Promise.all([
    getPortalStaffDirectory(supabase),
    fetchRowsByIdChunks<Row>(ids, (chunkIds) =>
      supabase.from('project_owner_assignments').select('project_id,owner_key,updated_at').in('project_id', chunkIds),
    ),
    loadV2Projections(supabase, v2Projects, now),
  ]);
  const [tasks, followups, manuals, controls, selections] = await Promise.all([
    fetchRowsByIdChunks<Row>(legacyIds, (chunkIds) =>
      supabase.from('tasks').select('id,project_id,type,title,assigned_to,due_at,created_at,updated_at').in('project_id', chunkIds).eq('status', 'OPEN'),
    ),
    fetchRowsByIdChunks<Row>(legacyIds, (chunkIds) =>
      supabase.from('followup_tasks').select('id,project_id,type,assigned_to,due_at,created_at,updated_at').in('project_id', chunkIds).eq('status', 'OPEN'),
    ),
    fetchRowsByIdChunks<Row>(legacyIds, (chunkIds) =>
      supabase.from('project_manual_actions').select('id,project_id,title,category,owner_user_id,due_at,created_at,updated_at').in('project_id', chunkIds).eq('status', 'OPEN'),
    ),
    fetchRowsByIdChunks<Row>(legacyIds, (chunkIds) =>
      supabase.from('project_action_controls').select('project_id,source_kind,source_id,is_critical,critical_reason,reschedule_count').in('project_id', chunkIds),
    ),
    fetchRowsByIdChunks<Row>(legacyIds, (chunkIds) =>
      supabase.from('project_primary_action_selections').select('project_id,source_kind,source_id,confirmed_outranking_hash').in('project_id', chunkIds),
    ),
  ]);
  const staff = new Map(staffRows.map((person) => [person.userId, person]));
  const assignmentGroups = group(assignments);
  const taskGroups = group(tasks);
  const followupGroups = group(followups);
  const manualGroups = group(manuals);
  const controlGroups = group(controls);
  const selectionGroups = group(selections);
  const exceptions: ProjectCommandException[] = [];
  const counts: ProjectCommandExceptionsResponse['counts'] = { selection_conflict: 0, no_action: 0, missing_owner: 0 };

  for (const project of activeProjects) {
    const ownerRow = assignmentGroups.get(project.id)?.[0];
    const owner = buildProjectOwnerSummary({
      stage: project.stage,
      assignment: ownerRow && text(ownerRow.owner_key)
        ? { ownerKey: String(ownerRow.owner_key), updatedAt: text(ownerRow.updated_at) ?? now.toISOString() }
        : null,
      isAdmin: viewer.isAdmin,
    });
    const reasons: ProjectCommandException['reasons'] = [];
    if (usesV2ProjectWork(project)) {
      const projection = v2Projections.get(project.id);
      if (!projection) throw new Error(`V2 project work could not be loaded for ${project.id}`);
      if (projection.effectiveState !== 'ACTIVE') continue;
      if (projection.primaryAction.kind === 'needsTriage') reasons.push('no_action');
    } else {
      const controlMap = new Map((controlGroups.get(project.id) ?? []).map((row) => [sourceKey(row.source_kind, row.source_id), row]));
      const mapCandidate = (row: Row, sourceKind: ProjectCommandActionSourceKind): ProjectCommandActionCandidate | null => {
        const id = text(row.id);
        if (!id) return null;
        const sourceType = sourceKind === 'manual' ? null : text(row.type)?.toUpperCase() ?? null;
        const control = controlMap.get(sourceKey(sourceKind, id));
        const rescheduleCount = typeof control?.reschedule_count === 'number'
          ? Math.max(0, Math.trunc(control.reschedule_count))
          : 0;
        return {
          sourceKind,
          sourceId: id,
          title: sourceKind === 'quote_followup'
            ? sourceType === 'FOLLOWUP_EMAIL' ? 'Email quote follow-up' : 'Call for quote follow-up'
            : text(row.title) ?? 'Project action',
          category: sourceKind === 'manual' ? normalizeManualCategory(row.category) : categoryForSource(sourceType),
          sourceType,
          assignedTo: text(sourceKind === 'manual' ? row.owner_user_id : row.assigned_to),
          dueAt: timestamp(row.due_at),
          createdAt: timestamp(row.created_at) ?? now.toISOString(),
          updatedAt: timestamp(row.updated_at) ?? timestamp(row.created_at) ?? now.toISOString(),
          isCritical: control?.is_critical === true,
          criticalReason: text(control?.critical_reason),
          rescheduleCount,
        };
      };
      const candidates = [
        ...(taskGroups.get(project.id) ?? []).map((row) => mapCandidate(row, 'automation_task')),
        ...(followupGroups.get(project.id) ?? []).map((row) => mapCandidate(row, 'quote_followup')),
        ...(manualGroups.get(project.id) ?? []).map((row) => mapCandidate(row, 'manual')),
      ].filter((item): item is ProjectCommandActionCandidate => item !== null);
      const selectionRow = selectionGroups.get(project.id)?.[0];
      const selection: ProjectCommandSelectionRecord | null = selectionRow && text(selectionRow.source_id) ? {
        sourceKind: text(selectionRow.source_kind) as ProjectCommandActionSourceKind,
        sourceId: String(selectionRow.source_id),
        confirmedOutrankingHash: text(selectionRow.confirmed_outranking_hash) ?? 'cc_741638a5',
      } : null;
      const resolved = resolveProjectPrimaryAction({ candidates, owner, staff, selection, now, isAdmin: viewer.isAdmin });
      if (resolved.selectionConflict) reasons.push('selection_conflict');
      if (ACTIVE_LEAD_TO_QUOTE_STAGES.has(project.stage) && !resolved.primaryAction) reasons.push('no_action');
    }
    if (owner.missing) reasons.push('missing_owner');
    if (!reasons.length) continue;
    for (const reason of reasons) counts[reason] += 1;
    const projectId = appIdFromUuid('proj', project.id);
    exceptions.push({
      projectId,
      projectName: text(project.name) ?? 'Untitled project',
      stage: project.stage,
      reasons,
      href: `/staff/projects/${encodeURIComponent(projectId)}?tab=activity`,
    });
  }
  const priority = (item: ProjectCommandException) => item.reasons.includes('selection_conflict') ? 0
    : item.reasons.includes('no_action') ? 1
    : item.reasons.includes('missing_owner') ? 2 : 3;
  exceptions.sort((left, right) => priority(left) - priority(right) || left.projectName.localeCompare(right.projectName));
  return { counts, projects: exceptions.slice(0, 50), totalProjects: exceptions.length, generatedAt: now.toISOString() };
}
