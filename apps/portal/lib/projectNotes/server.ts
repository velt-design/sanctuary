import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectNote } from '@/lib/projects/types';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import {
  deriveAuthorDisplayName,
  mapProjectNoteRow,
  type ProjectNoteRow,
} from './types';

export const PROJECT_NOTES_DEFAULT_LIMIT = 50;
export const PROJECT_NOTES_MAX_LIMIT = 200;

const NOTE_COLUMNS = 'id,project_id,author_id,author_email,author_display_name,body,created_at,updated_at,deleted_at';

type ProjectNoteActor = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function projectUuidFromAppId(projectId: string): string | null {
  try {
    return uuidFromAppId(projectId, 'proj');
  } catch {
    return null;
  }
}

export async function listProjectNotes(
  client: SupabaseClient,
  projectAppId: string,
  currentUserId: string | null,
  limit = PROJECT_NOTES_DEFAULT_LIMIT,
): Promise<{ notes: ProjectNote[] } | { error: 'invalid_project_id' | 'query_failed' }> {
  const projectUuid = projectUuidFromAppId(projectAppId);
  if (!projectUuid) return { error: 'invalid_project_id' };

  const safeLimit = Math.max(1, Math.min(PROJECT_NOTES_MAX_LIMIT, Math.floor(limit)));

  const { data, error } = await client
    .from('project_notes')
    .select(NOTE_COLUMNS)
    .eq('project_id', projectUuid)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) return { error: 'query_failed' };

  const notes = (Array.isArray(data) ? data : []).map((row) =>
    mapProjectNoteRow(row as ProjectNoteRow, currentUserId),
  );
  return { notes };
}

export async function createProjectNote(
  client: SupabaseClient,
  projectAppId: string,
  user: ProjectNoteActor,
  body: string,
): Promise<
  | { note: ProjectNote }
  | { error: 'invalid_project_id' | 'project_not_found' | 'permission_denied' | 'insert_failed' }
> {
  const projectUuid = projectUuidFromAppId(projectAppId);
  if (!projectUuid) return { error: 'invalid_project_id' };

  const projectExists = await client
    .from('projects')
    .select('id')
    .eq('id', projectUuid)
    .maybeSingle();
  if (projectExists.error) return { error: 'insert_failed' };
  if (!projectExists.data) return { error: 'project_not_found' };

  const insert = await client
    .from('project_notes')
    .insert({
      project_id: projectUuid,
      author_id: user.id,
      author_email: user.email ?? '',
      author_display_name: deriveAuthorDisplayName(user),
      body,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (insert.error) {
    if (insert.error.code === '42501' || insert.error.code === 'PGRST301') {
      return { error: 'permission_denied' };
    }
    return { error: 'insert_failed' };
  }

  return { note: mapProjectNoteRow(insert.data as ProjectNoteRow, user.id) };
}

export async function updateProjectNote(
  client: SupabaseClient,
  noteId: string,
  user: ProjectNoteActor,
  body: string,
): Promise<
  | { note: ProjectNote }
  | { error: 'note_not_found' | 'permission_denied' | 'update_failed' }
> {
  const update = await client
    .from('project_notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .is('deleted_at', null)
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (update.error) {
    if (update.error.code === '42501' || update.error.code === 'PGRST301') {
      return { error: 'permission_denied' };
    }
    return { error: 'update_failed' };
  }
  if (!update.data) return { error: 'note_not_found' };

  return { note: mapProjectNoteRow(update.data as ProjectNoteRow, user.id) };
}

export async function softDeleteProjectNote(
  client: SupabaseClient,
  noteId: string,
  user: ProjectNoteActor,
): Promise<
  | { ok: true }
  | { error: 'note_not_found' | 'permission_denied' | 'delete_failed' }
> {
  const update = await client
    .from('project_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (update.error) {
    if (update.error.code === '42501' || update.error.code === 'PGRST301') {
      return { error: 'permission_denied' };
    }
    return { error: 'delete_failed' };
  }
  if (!update.data) return { error: 'note_not_found' };

  void user; // RLS owns the permission decision; user param kept for symmetry/audit hooks.
  return { ok: true };
}
