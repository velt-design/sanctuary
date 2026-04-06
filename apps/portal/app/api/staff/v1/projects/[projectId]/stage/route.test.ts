import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const runEvent = vi.fn();
const uuidFromAppId = vi.fn();

const projectSelectSingle = vi.fn();
const projectUpdateSingle = vi.fn();
const projectUpdateEq = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/automation/AutomationRunner', () => ({
  automationRunner: {
    runEvent,
  },
}));

vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    from: (table: string) => {
      if (table !== 'projects') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            if (column !== 'id') throw new Error(`Unexpected select eq column ${column}`);
            return {
              single: () => projectSelectSingle(value),
            };
          },
        }),
        update: (payload: unknown) => ({
          eq: (column: string, id: string) => {
            if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
            projectUpdateEq(payload, id);
            return {
              select: () => ({
                single: projectUpdateSingle,
              }),
            };
          },
        }),
      };
    },
  },
}));

describe('POST /api/staff/v1/projects/[projectId]/stage', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    runEvent.mockReset();
    uuidFromAppId.mockReset();
    projectSelectSingle.mockReset();
    projectUpdateSingle.mockReset();
    projectUpdateEq.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { toStage: 'QUOTING' } });
    uuidFromAppId.mockReturnValue('project-uuid');
    projectSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'CONTACTED' }, error: null });
    projectUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'QUOTING' }, error: null });
    runEvent.mockResolvedValue(undefined);
  });

  it('returns 401 when no staff session exists', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when toStage is invalid', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { toStage: 'mystery' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid toStage' });
  });

  it('returns 400 when SITE_VISIT is missing a priority tier', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { toStage: 'SITE_VISIT' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Site visit priority tier is required.' });
  });

  it('returns 400 when projectId is invalid', async () => {
    uuidFromAppId.mockImplementation(() => {
      throw new Error('bad id');
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/bad/stage', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'bad' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid projectId' });
  });

  it('returns 404 when the project is missing', async () => {
    projectSelectSingle.mockResolvedValue({ data: null, error: { message: 'missing' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' });
  });

  it('returns the updated project and emits pipeline.stage_changed', async () => {
    parseJsonBody.mockResolvedValue({
      ok: true,
      body: {
        toStage: 'SITE_VISIT',
        site_visit_priority_tier: 2,
        reason: 'manual',
        meta: { source: 'test' },
        quoteId: 'quote-1',
      },
    });
    projectSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'CONTACTED' }, error: null });
    projectUpdateSingle.mockResolvedValue({
      data: { id: 'project-uuid', pipeline_stage: 'SITE_VISIT', site_visit_priority_tier: 2 },
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      project: { id: 'project-uuid', pipeline_stage: 'SITE_VISIT', site_visit_priority_tier: 2 },
    });
    expect(projectUpdateEq).toHaveBeenCalledWith({ pipeline_stage: 'SITE_VISIT', site_visit_priority_tier: 2 }, 'project-uuid');
    expect(runEvent).toHaveBeenCalledWith({
      type: 'pipeline.stage_changed',
      projectId: 'project-uuid',
      stage: 'SITE_VISIT',
      primaryId: 'quote-1',
      payload: {
        fromStage: 'CONTACTED',
        toStage: 'SITE_VISIT',
        reason: 'manual',
        meta: { source: 'test' },
        quoteId: 'quote-1',
      },
    });
  });
});
