import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { getProjectWorkProjection } from '@/lib/projects/workItems/repository';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import { getProjectWorkModelV2Ids } from '@/lib/projects/workItems/modelBoundary';
import {
  PROJECT_OWNER_REQUIRED_STAGES,
  buildProjectOwnerSummary,
} from './projectOwners';
import { fetchRowsByIdChunks } from '@/lib/list/listLimits';
import type {
  ProjectCommandException,
  ProjectCommandExceptionsResponse,
} from './types';

type Row = Record<string, any>;
const V2_PROJECTION_BATCH_SIZE = 20;

function list(value: unknown): Row[] { return Array.isArray(value) ? value as Row[] : []; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
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
      .select('id,name,pipeline_stage,created_at'),
    'exception projects',
  );
  const activeProjects: Array<Row & { id: string; stage: string }> = projects.flatMap((project) => {
    const stage = normalizePipelineStageKey(normalizeProjectStatus(project.pipeline_stage ?? 'NEW').status) ?? 'new';
    const id = text(project.id);
    return id && PROJECT_OWNER_REQUIRED_STAGES.has(stage)
      ? [{ ...project, id, stage }]
      : [];
  });
  if (!activeProjects.length) {
    return { counts: { no_action: 0, missing_owner: 0 }, projects: [], totalProjects: 0, generatedAt: now.toISOString() };
  }
  const ids = activeProjects.map((project) => project.id);
  const v2ProjectIds = await getProjectWorkModelV2Ids(supabase, ids);
  const v2Projects = activeProjects.filter((project) => v2ProjectIds.has(project.id));
  const [assignments, v2Projections] = await Promise.all([
    fetchRowsByIdChunks<Row>(ids, (chunkIds) =>
      supabase.from('project_owner_assignments').select('project_id,owner_key,updated_at').in('project_id', chunkIds),
    ),
    loadV2Projections(supabase, v2Projects, now),
  ]);
  const assignmentGroups = group(assignments);
  const exceptions: ProjectCommandException[] = [];
  const counts: ProjectCommandExceptionsResponse['counts'] = { no_action: 0, missing_owner: 0 };

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
    if (v2ProjectIds.has(project.id)) {
      const projection = v2Projections.get(project.id);
      if (!projection) throw new Error(`V2 project work could not be loaded for ${project.id}`);
      if (projection.effectiveState !== 'ACTIVE') continue;
      if (projection.primaryAction.kind === 'needsTriage') reasons.push('no_action');
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
  const priority = (item: ProjectCommandException) => item.reasons.includes('no_action') ? 0
    : item.reasons.includes('missing_owner') ? 1 : 2;
  exceptions.sort((left, right) => priority(left) - priority(right) || left.projectName.localeCompare(right.projectName));
  return { counts, projects: exceptions.slice(0, 50), totalProjects: exceptions.length, generatedAt: now.toISOString() };
}
