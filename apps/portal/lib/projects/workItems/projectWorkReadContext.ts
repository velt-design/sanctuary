import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Facts from this request's auth-bound project read, never a cached permission grant. */
export type ProjectWorkReadContext = Readonly<{
  supabase: SupabaseClient;
  projectUuid: string;
  archivedAt: string | null;
  modelVersion: 2 | null;
  projectOwnerKey: string | null;
}>;

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function iso(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

async function firstRow(
  query: PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>,
  fallback: string,
): Promise<Row | null> {
  const result = await query;
  if (result.error) throw Object.assign(new Error(result.error.message ?? fallback), result.error);
  return Array.isArray(result.data)
    ? result.data.find((entry): entry is Row => Boolean(entry && typeof entry === 'object')) ?? null
    : null;
}

export async function getProjectWorkReadContext(params: {
  supabase: SupabaseClient;
  projectUuid: string;
  readContext?: ProjectWorkReadContext;
}): Promise<ProjectWorkReadContext | null> {
  const { supabase, projectUuid, readContext } = params;
  if (readContext) {
    if (readContext.supabase !== supabase || readContext.projectUuid !== projectUuid) {
      throw new Error('Project work read context does not match this authenticated project read');
    }
    return readContext;
  }

  // Standalone projection callers still own a complete authenticated read.
  const [project, model, owner] = await Promise.all([
    firstRow(supabase.from('projects').select('id,archived_at').eq('id', projectUuid).limit(1), 'Failed to load project'),
    firstRow(
      supabase.from('project_work_model_versions').select('model_version').eq('project_id', projectUuid).limit(1),
      'Failed to load project work model',
    ),
    firstRow(
      supabase.from('project_owner_assignments').select('owner_key').eq('project_id', projectUuid).limit(1),
      'Failed to load project owner',
    ),
  ]);
  if (!project) return null;
  return {
    supabase,
    projectUuid,
    archivedAt: iso(project.archived_at),
    modelVersion: model?.model_version === 2 ? 2 : null,
    projectOwnerKey: text(owner?.owner_key),
  };
}
