import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const missingColumnFromError = vi.fn();
const uuidFromAppId = vi.fn();

const projectMaybeSingle = vi.fn();
const projectUpdateSingle = vi.fn();
const contactUpdateSingle = vi.fn();
const projectUpdateMatch = vi.fn();
const contactUpdateMatch = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/api/siteVisitsServer', () => ({
  missingColumnFromError,
}));

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              if (column !== 'id') throw new Error(`Unexpected select eq column ${column}`);
              return {
                maybeSingle: () => projectMaybeSingle(value),
              };
            },
          }),
          update: (payload: unknown) => ({
            match: (match: Record<string, unknown>) => {
              projectUpdateMatch(payload, match);
              return {
                select: () => ({
                  single: projectUpdateSingle,
                }),
              };
            },
          }),
        };
      }

      if (table === 'contacts') {
        return {
          update: (payload: unknown) => ({
            match: (match: Record<string, unknown>) => {
              contactUpdateMatch(payload, match);
              return {
                select: () => ({
                  single: contactUpdateSingle,
                }),
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

describe('PATCH /api/projects/[projectId]/details', () => {
  const projectRow = { id: 'project-uuid', contact_id: 'contact-uuid' };

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    missingColumnFromError.mockReset();
    uuidFromAppId.mockReset();
    projectMaybeSingle.mockReset();
    projectUpdateSingle.mockReset();
    contactUpdateSingle.mockReset();
    projectUpdateMatch.mockReset();
    contactUpdateMatch.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: {} });
    missingColumnFromError.mockReturnValue(null);
    uuidFromAppId.mockImplementation((id: string, prefix: string) => {
      if (prefix === 'proj') return 'project-uuid';
      if (prefix === 'ct') return 'contact-uuid';
      throw new Error(`Unexpected prefix ${prefix}`);
    });
    projectMaybeSingle.mockResolvedValue({ data: projectRow, error: null });
    projectUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', name: 'Updated Project' }, error: null });
    contactUpdateSingle.mockResolvedValue({ data: { id: 'contact-uuid', name: 'Jamie Client' }, error: null });
  });

  it('returns 401 when no staff session exists', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when projectId is invalid', async () => {
    uuidFromAppId.mockImplementation(() => {
      throw new Error('bad id');
    });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/bad/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'bad' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid project id' });
  });

  it('returns 400 when the JSON body is invalid', async () => {
    parseJsonBody.mockResolvedValue({ ok: false, error: 'Invalid JSON body' });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 404 when the project lookup fails', async () => {
    projectMaybeSingle.mockResolvedValue({ data: null, error: { message: 'missing' } });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' });
  });

  it('returns 400 when a provided project name is empty', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { project: { name: '   ' } },
    });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Project name is required' });
  });

  it('returns 400 when nextActionDate is invalid', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { project: { nextActionDate: 'not-a-date' } },
    });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid nextActionDate (expected YYYY-MM-DD)' });
  });

  it('returns 400 when updating an existing contact with an empty name', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: { contact: { name: '   ', email: 'client@example.com' } },
    });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Contact name is required' });
  });

  it('returns updated project and contact payloads on success', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        project: {
          name: 'Updated Project',
          siteAddress: '123 Pergola Lane',
          region: 'North',
          quoteRef: 'Q-101',
          nextActionDate: '2026-04-10',
        },
        contact: {
          name: 'Jamie Client',
          email: 'jamie@example.com',
          phone: '021 555 111',
        },
      },
    });
    projectUpdateSingle.mockResolvedValue({
      data: { id: 'project-uuid', name: 'Updated Project', contact_id: 'contact-uuid' },
      error: null,
    });
    contactUpdateSingle.mockResolvedValue({
      data: { id: 'contact-uuid', name: 'Jamie Client', email: 'jamie@example.com', phone: '021 555 111' },
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.PATCH(new Request('http://localhost/api/projects/proj_1/details', { method: 'PATCH' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      project: { id: 'project-uuid', name: 'Updated Project', contact_id: 'contact-uuid' },
      contact: { id: 'contact-uuid', name: 'Jamie Client', email: 'jamie@example.com', phone: '021 555 111' },
    });
    expect(projectUpdateMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Project',
        site_address: '123 Pergola Lane',
        region: 'North',
        quote_ref: 'Q-101',
        follow_up_date: '2026-04-10',
        next_action_date: '2026-04-10',
        updated_at: expect.any(String),
      }),
      { id: 'project-uuid' },
    );
    expect(contactUpdateMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jamie Client',
        email: 'jamie@example.com',
        phone: '021 555 111',
        updated_at: expect.any(String),
      }),
      { id: 'contact-uuid' },
    );
  });
});
