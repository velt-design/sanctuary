import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminSession = vi.fn();
const uuidFromAppId = vi.fn();

const projectsSelectSingle = vi.fn();
const projectsUpdateSingle = vi.fn();
const projectsUpdateEq = vi.fn();
const projectTaskChecksDeleteSelect = vi.fn();
const auditInsert = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

vi.mock('@/lib/api/adminApi', () => ({
  jsonError: (error: string, status: number) => jsonResponse({ error }, status),
  jsonOk: (body: unknown, status = 200) => jsonResponse(body, status),
  requireAdminSession,
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
                single: () => projectsSelectSingle(value),
              };
            },
          }),
          update: (payload: unknown) => ({
            eq: (column: string, value: string) => {
              if (column !== 'id') throw new Error(`Unexpected update eq column ${column}`);
              projectsUpdateEq(payload, value);
              return {
                select: () => ({
                  single: projectsUpdateSingle,
                }),
              };
            },
          }),
        };
      }

      if (table === 'project_task_checks') {
        return {
          delete: () => ({
            eq: (column: string, value: string) => {
              if (column !== 'project_id') throw new Error(`Unexpected delete eq column ${column}`);
              return {
                in: (column2: string, values: string[]) => ({
                  select: (selection: string) => projectTaskChecksDeleteSelect(value, column2, values, selection),
                }),
              };
            },
          }),
        };
      }

      if (table === 'audit_events') {
        return {
          insert: (payload: unknown) => auditInsert(payload),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

describe('POST /api/staff/v1/projects/[projectId]/stage/correct', () => {
  beforeEach(() => {
    vi.resetModules();
    requireAdminSession.mockReset();
    uuidFromAppId.mockReset();
    projectsSelectSingle.mockReset();
    projectsUpdateSingle.mockReset();
    projectsUpdateEq.mockReset();
    projectTaskChecksDeleteSelect.mockReset();
    auditInsert.mockReset();

    requireAdminSession.mockResolvedValue({
      ok: true,
      session: { role: 'admin', user: { id: 'user-1', email: 'ops@example.com' } },
    });
    uuidFromAppId.mockReturnValue('project-uuid');
    projectsSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'CONTACTED', name: 'Project' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'QUOTING' }, error: null });
    projectTaskChecksDeleteSelect.mockResolvedValue({ data: [], error: null });
    auditInsert.mockResolvedValue({ error: null });
  });

  it('returns 401 when admin auth is missing', async () => {
    requireAdminSession.mockResolvedValue({ ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401) });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when admin auth is forbidden', async () => {
    requireAdminSession.mockResolvedValue({ ok: false, response: jsonResponse({ error: 'Forbidden' }, 403) });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 400 for an invalid toStage', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', {
      method: 'POST',
      body: JSON.stringify({ toStage: 'mystery' }),
      headers: { 'content-type': 'application/json' },
    }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid toStage' });
  });

  it('returns 400 when projectId is invalid', async () => {
    uuidFromAppId.mockImplementation(() => {
      throw new Error('bad id');
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/bad/stage/correct', {
      method: 'POST',
      body: JSON.stringify({ toStage: 'QUOTING' }),
      headers: { 'content-type': 'application/json' },
    }), {
      params: Promise.resolve({ projectId: 'bad' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid projectId' });
  });

  it('returns 404 when the project is not found', async () => {
    projectsSelectSingle.mockResolvedValue({ data: null, error: { message: 'missing' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', {
      method: 'POST',
      body: JSON.stringify({ toStage: 'QUOTING' }),
      headers: { 'content-type': 'application/json' },
    }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' });
  });

  it('returns rollback success and clears downstream manual task checks', async () => {
    projectsSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'SCHEDULED', name: 'Project' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'DEPOSIT' }, error: null });
    projectTaskChecksDeleteSelect.mockResolvedValue({
      data: [{ task_key: 'order_materials' }, { task_key: 'job_complete' }],
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', {
      method: 'POST',
      body: JSON.stringify({ toStage: 'DEPOSIT', reason: 'rollback' }),
      headers: { 'content-type': 'application/json' },
    }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      project: { id: 'project-uuid', pipeline_stage: 'DEPOSIT' },
      rollback: true,
      resetManualTaskCount: 2,
      silent: true,
    });
    expect(projectTaskChecksDeleteSelect).toHaveBeenCalledWith(
      'project-uuid',
      'task_key',
      expect.arrayContaining(['confirm_schedule', 'order_materials', 'job_complete']),
      'task_key',
    );
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'project-uuid',
      type: 'project.stage_corrected',
      payload: expect.objectContaining({
        projectId: 'proj_1',
        fromStage: 'SCHEDULED',
        toStage: 'DEPOSIT',
        rollback: true,
        resetManualTaskCount: 2,
        silent: true,
        actorUserId: 'user-1',
      }),
    }));
  });

  it('returns 500 when rollback task reset fails and reverts the stage', async () => {
    projectsSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'SCHEDULED', name: 'Project' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'DEPOSIT' }, error: null });
    projectTaskChecksDeleteSelect.mockResolvedValue({ data: null, error: { message: 'reset failed' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', {
      method: 'POST',
      body: JSON.stringify({ toStage: 'DEPOSIT' }),
      headers: { 'content-type': 'application/json' },
    }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'reset failed' });
    expect(projectsUpdateEq).toHaveBeenNthCalledWith(1, { pipeline_stage: 'DEPOSIT' }, 'project-uuid');
    expect(projectsUpdateEq).toHaveBeenNthCalledWith(2, { pipeline_stage: 'SCHEDULED' }, 'project-uuid');
  });

  it('still succeeds when audit insert fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    projectsSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'CONTACTED', name: 'Project' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'QUOTING' }, error: null });
    auditInsert.mockResolvedValue({ error: { message: 'audit failed' } });

    try {
      const mod = await import('./route');
      const res = await mod.POST(new Request('http://localhost/api/staff/v1/projects/proj_1/stage/correct', {
        method: 'POST',
        body: JSON.stringify({ toStage: 'QUOTING' }),
        headers: { 'content-type': 'application/json' },
      }), {
        params: Promise.resolve({ projectId: 'proj_1' }),
      });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        project: { id: 'project-uuid', pipeline_stage: 'QUOTING' },
        rollback: false,
        resetManualTaskCount: 0,
        silent: true,
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
