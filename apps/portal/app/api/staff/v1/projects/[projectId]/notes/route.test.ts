import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();

vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return {
    ...actual,
    requireStaffContext,
  };
});

const listProjectNotes = vi.fn();
const createProjectNote = vi.fn();

vi.mock('@/lib/projectNotes/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/projectNotes/server')>('@/lib/projectNotes/server');
  return {
    ...actual,
    listProjectNotes: (...args: unknown[]) => listProjectNotes(...args),
    createProjectNote: (...args: unknown[]) => createProjectNote(...args),
  };
});

const validProjectId = 'proj_11111111111111111111111111111111';

function buildContext(projectId = validProjectId) {
  return { params: Promise.resolve({ projectId }) };
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
  listProjectNotes.mockReset();
  createProjectNote.mockReset();
});

describe('GET /api/staff/v1/projects/[projectId]/notes', () => {
  it('returns 401 when there is no staff session', async () => {
    requireStaffContext.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes`), buildContext());

    expect(res.status).toBe(401);
  });

  it('returns the listed notes for a valid project id', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    listProjectNotes.mockResolvedValue({ notes: [{ id: 'n1', body: 'hi', authorId: 'user-1', authorEmail: 'a@b', authorDisplayName: null, createdAt: '', updatedAt: '', isOwn: true }] });

    const mod = await import('./route');
    const res = await mod.GET(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes`),
      buildContext(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notes).toHaveLength(1);
  });

  it('returns 400 for an invalid limit param', async () => {
    requireStaffContext.mockResolvedValue(authedSession());

    const mod = await import('./route');
    const res = await mod.GET(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes?limit=0`),
      buildContext(),
    );

    expect(res.status).toBe(400);
  });
});

describe('POST /api/staff/v1/projects/[projectId]/notes', () => {
  it('returns 400 for an empty body', async () => {
    requireStaffContext.mockResolvedValue(authedSession());

    const mod = await import('./route');
    const res = await mod.POST(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: '' }),
      }),
      buildContext(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 201 with the created note on success', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    createProjectNote.mockResolvedValue({
      note: {
        id: 'n2',
        body: 'first',
        authorId: 'user-1',
        authorEmail: 'a@b',
        authorDisplayName: null,
        createdAt: '',
        updatedAt: '',
        isOwn: true,
      },
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'first' }),
      }),
      buildContext(),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.note.id).toBe('n2');
  });

  it('returns 403 when the server reports permission_denied', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    createProjectNote.mockResolvedValue({ error: 'permission_denied' });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'first' }),
      }),
      buildContext(),
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when the project is missing', async () => {
    requireStaffContext.mockResolvedValue(authedSession());
    createProjectNote.mockResolvedValue({ error: 'project_not_found' });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request(`http://localhost/api/staff/v1/projects/${validProjectId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'first' }),
      }),
      buildContext(),
    );

    expect(res.status).toBe(404);
  });
});
