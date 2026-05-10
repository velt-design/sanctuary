import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffContext,
  };
});

const updateProjectNote = vi.fn();
const softDeleteProjectNote = vi.fn();

vi.mock('@/lib/projectNotes/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/projectNotes/server')>('@/lib/projectNotes/server');
  return {
    ...actual,
    updateProjectNote: (...args: unknown[]) => updateProjectNote(...args),
    softDeleteProjectNote: (...args: unknown[]) => softDeleteProjectNote(...args),
  };
});

const validProjectId = 'proj_11111111111111111111111111111111';
const validNoteId = '11111111-1111-4111-8111-111111111111';
const invalidNoteId = 'not-a-uuid';

function buildContext(noteId = validNoteId) {
  return { params: Promise.resolve({ projectId: validProjectId, noteId }) };
}

function authedSession() {
  return {
    ok: true as const,
    session: { user: { id: 'user-1', email: 'ops@example.test' }, role: 'staff' as const },
    supabase: {} as any,
  };
}

beforeEach(() => {
  vi.resetModules();
  requireStaffContext.mockReset();
  updateProjectNote.mockReset();
  softDeleteProjectNote.mockReset();
});

describe('PATCH /api/staff/v1/projects/[projectId]/notes/[noteId]', () => {
  it('returns 400 for an invalid note id', async () => {
    requireStaffContext.mockResolvedValue(authedSession());

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes/${invalidNoteId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'updated' }),
      }),
      buildContext(invalidNoteId),
    );

    expect(res.status).toBe(400);
  });

  it('returns 403 when the server reports permission_denied', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    updateProjectNote.mockResolvedValue({ error: 'permission_denied' });

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes/${validNoteId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'updated' }),
      }),
      buildContext(),
    );

    expect(res.status).toBe(403);
  });

  it('returns the updated note on success', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    updateProjectNote.mockResolvedValue({
      note: {
        id: validNoteId,
        body: 'updated',
        authorId: 'user-1',
        authorEmail: 'a@b',
        authorDisplayName: null,
        createdAt: '',
        updatedAt: '',
        isOwn: true,
      },
    });

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes/${validNoteId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'updated' }),
      }),
      buildContext(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.note.body).toBe('updated');
  });
});

describe('DELETE /api/staff/v1/projects/[projectId]/notes/[noteId]', () => {
  it('returns 401 when there is no staff session', async () => {
    requireStaffContext.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const mod = await import('./route');
    const res = await mod.DELETE(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes/${validNoteId}`, {
        method: 'DELETE',
      }),
      buildContext(),
    );

    expect(res.status).toBe(401);
  });

  it('returns 404 when the server reports note_not_found', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    softDeleteProjectNote.mockResolvedValue({ error: 'note_not_found' });

    const mod = await import('./route');
    const res = await mod.DELETE(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes/${validNoteId}`, {
        method: 'DELETE',
      }),
      buildContext(),
    );

    expect(res.status).toBe(404);
  });

  it('returns ok on successful soft delete', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    softDeleteProjectNote.mockResolvedValue({ ok: true });

    const mod = await import('./route');
    const res = await mod.DELETE(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes/${validNoteId}`, {
        method: 'DELETE',
      }),
      buildContext(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
