import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import {
  PROJECT_NOTES_DEFAULT_LIMIT,
  PROJECT_NOTES_MAX_LIMIT,
  createProjectNote,
  listProjectNotes,
} from '@/lib/projectNotes/server';
import { normalizeNoteBody } from '@/lib/projectNotes/types';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  const { projectId } = await ctx.params;
  const projectIdRaw = typeof projectId === 'string' ? projectId.trim() : '';
  if (!projectIdRaw) return jsonError('Invalid projectId', 400);

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const requestedLimit = limitParam ? Number.parseInt(limitParam, 10) : PROJECT_NOTES_DEFAULT_LIMIT;
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : PROJECT_NOTES_DEFAULT_LIMIT;
  if (limit < 1 || limit > PROJECT_NOTES_MAX_LIMIT) return jsonError('Invalid limit', 400);

  const result = await listProjectNotes(auth.supabase, projectIdRaw, auth.session.user.id, limit);
  if ('error' in result) {
    if (result.error === 'invalid_project_id') return jsonError('Invalid projectId', 400);
    return jsonError('Failed to load project notes', 500);
  }

  return jsonOk({ notes: result.notes });
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  const { projectId } = await ctx.params;
  const projectIdRaw = typeof projectId === 'string' ? projectId.trim() : '';
  if (!projectIdRaw) return jsonError('Invalid projectId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = normalizeNoteBody(parsed.body?.body);
  if (!body) return jsonError('Note body required', 400);

  const result = await createProjectNote(auth.supabase, projectIdRaw, auth.session.user, body);
  if ('error' in result) {
    if (result.error === 'invalid_project_id') return jsonError('Invalid projectId', 400);
    if (result.error === 'project_not_found') return jsonError('Project not found', 404);
    if (result.error === 'permission_denied') return jsonError('Forbidden', 403);
    return jsonError('Failed to create project note', 500);
  }

  return jsonOk({ note: result.note }, 201);
}
