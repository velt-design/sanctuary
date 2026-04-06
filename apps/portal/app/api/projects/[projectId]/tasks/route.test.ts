import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const runEvent = vi.fn();
const getTaskDefinition = vi.fn();
const missingColumnFromError = vi.fn();
const uuidFromAppId = vi.fn();

const projectTaskChecksSelectEq = vi.fn();
const projectTaskChecksUpsert = vi.fn();
const projectTaskChecksDeleteEq = vi.fn();
const projectsSelectSingle = vi.fn();
const projectsUpdateSingle = vi.fn();
const projectsUpdateEq = vi.fn();
const depositInvoiceMaybeSingle = vi.fn();

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

vi.mock('@/lib/projects/pipelineDefinition', () => ({
  getTaskDefinition,
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
      if (table === 'project_task_checks') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              if (column !== 'project_id') throw new Error(`Unexpected select eq column ${column}`);
              return projectTaskChecksSelectEq(value);
            },
          }),
          upsert: (payload: unknown, options: unknown) => projectTaskChecksUpsert(payload, options),
          delete: () => ({
            eq: (column: string, value: string) => {
              if (column !== 'project_id') throw new Error(`Unexpected delete eq column ${column}`);
              return {
                eq: (column2: string, value2: string) => projectTaskChecksDeleteEq(value, column2, value2),
              };
            },
          }),
        };
      }

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

      if (table === 'deposit_invoices') {
        return {
          select: () => ({
            eq: (column: string, projectId: string) => {
              if (column !== 'project_id') throw new Error(`Unexpected select eq column ${column}`);
              return {
                eq: (column2: string, status: string) => {
                  if (column2 !== 'status') throw new Error(`Unexpected nested eq column ${column2}`);
                  return {
                    order: (field: string) => {
                      if (field !== 'created_at') throw new Error(`Unexpected order field ${field}`);
                      return {
                        limit: (count: number) => ({
                          maybeSingle: () => depositInvoiceMaybeSingle(projectId, status, count),
                        }),
                      };
                    },
                  };
                },
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

describe('GET/POST /api/projects/[projectId]/tasks', () => {
  const definitions = new Map<string, { key: string; kind: 'manual' | 'action' }>([
    ['call_enquiry', { key: 'call_enquiry', kind: 'manual' }],
    ['invoice_paid', { key: 'invoice_paid', kind: 'manual' }],
    ['confirm_schedule', { key: 'confirm_schedule', kind: 'manual' }],
    ['order_materials', { key: 'order_materials', kind: 'manual' }],
    ['job_complete', { key: 'job_complete', kind: 'manual' }],
    ['schedule_install', { key: 'schedule_install', kind: 'action' }],
  ]);

  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    runEvent.mockReset();
    getTaskDefinition.mockReset();
    missingColumnFromError.mockReset();
    uuidFromAppId.mockReset();
    projectTaskChecksSelectEq.mockReset();
    projectTaskChecksUpsert.mockReset();
    projectTaskChecksDeleteEq.mockReset();
    projectsSelectSingle.mockReset();
    projectsUpdateSingle.mockReset();
    projectsUpdateEq.mockReset();
    depositInvoiceMaybeSingle.mockReset();

    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'admin' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'call_enquiry', completed: true } });
    getTaskDefinition.mockImplementation((key: string) => definitions.get(key) ?? null);
    missingColumnFromError.mockReturnValue(null);
    uuidFromAppId.mockReturnValue('project-uuid');
    projectTaskChecksSelectEq.mockResolvedValue({ data: [], error: null });
    projectTaskChecksUpsert.mockResolvedValue({ error: null });
    projectTaskChecksDeleteEq.mockResolvedValue({ error: null });
    projectsSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'SENT' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'DEPOSIT' }, error: null });
    depositInvoiceMaybeSingle.mockResolvedValue({ data: { id: 'inv-1' }, error: null });
    runEvent.mockResolvedValue(undefined);
  });

  it('GET returns 401 when no staff session exists', async () => {
    requireStaffSession.mockResolvedValue(null);

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects/proj_1/tasks'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('GET returns only completed manual task keys', async () => {
    projectTaskChecksSelectEq.mockResolvedValue({
      data: [{ task_key: 'call_enquiry' }, { task_key: 'schedule_install' }, { task_key: 'unknown' }],
      error: null,
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/projects/proj_1/tasks'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ completed: ['call_enquiry'] });
  });

  it('POST returns 400 when taskKey is missing', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { completed: true } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'taskKey is required' });
  });

  it('POST returns 400 when completed is not a boolean', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'call_enquiry', completed: 'yes' } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'completed must be a boolean' });
  });

  it('POST returns 400 for an invalid task key', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'mystery', completed: true } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid taskKey' });
  });

  it('POST returns 403 when a non-admin completes invoice_paid', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' }, role: 'staff' });
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'invoice_paid', completed: true } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Only admins can complete this task' });
  });

  it('POST completes a simple manual task and upserts project_task_checks', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, taskKey: 'call_enquiry', completed: true });
    expect(projectTaskChecksUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'project-uuid',
        task_key: 'call_enquiry',
        completed_at: expect.any(String),
        completed_by: null,
      }),
      { onConflict: 'project_id,task_key' },
    );
  });

  it('POST advances invoice_paid from SENT to DEPOSIT and emits automation events', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'invoice_paid', completed: true } });
    projectsSelectSingle
      .mockResolvedValueOnce({ data: { id: 'project-uuid', pipeline_stage: 'SENT' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'project-uuid', pipeline_stage: 'SENT' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'DEPOSIT' }, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, taskKey: 'invoice_paid', completed: true });
    expect(projectsUpdateEq).toHaveBeenCalledWith({ pipeline_stage: 'DEPOSIT' }, 'project-uuid');
    expect(runEvent).toHaveBeenCalledTimes(2);
    expect(runEvent).toHaveBeenNthCalledWith(1, {
      type: 'pipeline.stage_changed',
      projectId: 'project-uuid',
      stage: 'DEPOSIT',
      payload: { fromStage: 'SENT', toStage: 'DEPOSIT', reason: 'invoice_paid' },
    });
    expect(runEvent).toHaveBeenNthCalledWith(2, {
      type: 'ui.action.mark_deposit_received',
      projectId: 'project-uuid',
      stage: 'DEPOSIT',
      payload: { source: 'task.invoice_paid' },
    });
  });

  it('POST advances confirm_schedule from DEPOSIT to SCHEDULED and emits automation events', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'confirm_schedule', completed: true } });
    projectsSelectSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'DEPOSIT' }, error: null });
    projectsUpdateSingle.mockResolvedValue({ data: { id: 'project-uuid', pipeline_stage: 'SCHEDULED' }, error: null });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, taskKey: 'confirm_schedule', completed: true });
    expect(projectsUpdateEq).toHaveBeenCalledWith({ pipeline_stage: 'SCHEDULED' }, 'project-uuid');
    expect(runEvent).toHaveBeenCalledTimes(2);
    expect(runEvent).toHaveBeenNthCalledWith(1, {
      type: 'pipeline.stage_changed',
      projectId: 'project-uuid',
      stage: 'SCHEDULED',
      payload: { fromStage: 'DEPOSIT', toStage: 'SCHEDULED', reason: 'confirm_schedule' },
    });
    expect(runEvent).toHaveBeenNthCalledWith(2, {
      type: 'ui.action.confirm_schedule',
      projectId: 'project-uuid',
      stage: 'SCHEDULED',
      payload: {},
    });
  });

  it('POST uncompleting order_materials also clears the dependent job_complete task', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: { taskKey: 'order_materials', completed: false } });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/projects/proj_1/tasks', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, taskKey: 'order_materials', completed: false });
    expect(projectTaskChecksDeleteEq).toHaveBeenNthCalledWith(1, 'project-uuid', 'task_key', 'order_materials');
    expect(projectTaskChecksDeleteEq).toHaveBeenNthCalledWith(2, 'project-uuid', 'task_key', 'job_complete');
  });
});
