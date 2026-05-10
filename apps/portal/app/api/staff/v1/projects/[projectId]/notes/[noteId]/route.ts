import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { softDeleteProjectNote, updateProjectNote } from '@/lib/projectNotes/server';
import { normalizeNoteBody } from '@/lib/projectNotes/types';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateNoteId(noteId: unknown): string | null {
  if (typeof noteId !== 'string') return null;
  const trimmed = noteId.trim();
  if (!UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ projectId: string; noteId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  const { noteId } = await ctx.params;
  const validNoteId = validateNoteId(noteId);
  if (!validNoteId) return jsonError('Invalid noteId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = normalizeNoteBody(parsed.body?.body);
  if (!body) return jsonError('Note body required', 400);

  const result = await updateProjectNote(auth.supabase, validNoteId, auth.session.user, body);
  if ('error' in result) {
    if (result.error === 'note_not_found') return jsonError('Note not found', 404);
    if (result.error === 'permission_denied') return jsonError('Forbidden', 403);
    return jsonError('Failed to update project note', 500);
  }

  return jsonOk({ note: result.note });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ projectId: string; noteId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  const { noteId } = await ctx.params;
  const validNoteId = validateNoteId(noteId);
  if (!validNoteId) return jsonError('Invalid noteId', 400);

  const result = await softDeleteProjectNote(auth.supabase, validNoteId, auth.session.user);
  if ('error' in result) {
    if (result.error === 'note_not_found') return jsonError('Note not found', 404);
    if (result.error === 'permission_denied') return jsonError('Forbidden', 403);
    return jsonError('Failed to delete project note', 500);
  }

  return jsonOk({ ok: true });
}
