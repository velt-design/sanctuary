import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { projectDetailHref } from './links';
import type { DashboardRecentActivityItem } from './types';

const ACTIVITY_COLUMNS = `
  id,
  project_id,
  body,
  author_email,
  author_display_name,
  created_at,
  projects!inner(id,name,archived_at)
`;

type ProjectNoteActivityRow = {
  id: string;
  project_id: string;
  body: string;
  author_email: string | null;
  author_display_name: string | null;
  created_at: string;
  projects?: { id?: string | null; name?: string | null; archived_at?: string | null } | null;
};

export async function listRecentProjectNoteActivity(
  client: SupabaseClient,
  limit = 20,
): Promise<DashboardRecentActivityItem[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const { data, error } = await client
    .from('project_notes')
    .select(ACTIVITY_COLUMNS)
    .is('deleted_at', null)
    .is('projects.archived_at', null)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message ?? 'Failed to load recent project notes.');

  return (Array.isArray(data) ? data : []).map((row) => {
    const note = row as ProjectNoteActivityRow;
    const projectId = appIdFromUuid('proj', note.project_id);
    const projectName = note.projects?.name?.trim() || 'Untitled project';
    return {
      id: note.id,
      type: 'project_note' as const,
      at: note.created_at,
      body: note.body,
      projectId,
      projectName,
      authorDisplayName: note.author_display_name,
      authorEmail: note.author_email,
      href: projectDetailHref(projectId),
    };
  });
}
