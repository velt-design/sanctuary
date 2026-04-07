import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const isMissingSchemaError = vi.fn();
const logPortalServerError = vi.fn();
const logPortalServerWarn = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServer: {
    rpc,
  },
}));

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  isMissingSchemaError,
}));

vi.mock('@/lib/api/routeDiagnostics', () => ({
  logPortalServerError,
  logPortalServerWarn,
}));

describe('scheduleCommands', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
    isMissingSchemaError.mockReset();
    logPortalServerError.mockReset();
    logPortalServerWarn.mockReset();
    isMissingSchemaError.mockReturnValue(false);
  });

  it('passes unassign payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { deleted_job: 'job-1' }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleUnassign({
      diagnostics: { requestId: 'req-1', route: '/api/staff/v1/schedule/job/unassign', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobItemId: 'item-1',
      positions: [{ id: 'item-2', position: 0 }],
      forecastUpdates: [{ id: 'job-2', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-11', forecast_duration_days: 1 }],
    });

    expect(res).toEqual({ ok: true, data: { deleted_job: 'job-1' } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_unassign_job', {
      p_scheduled_job_id: 'job-1',
      p_job_item_id: 'item-1',
      p_positions: [{ id: 'item-2', position: 0 }],
      p_forecast_updates: [{ id: 'job-2', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-11', forecast_duration_days: 1 }],
    });
  });

  it('passes downtime delete payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { deleted_downtime: 'dt-1' }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitDeleteDowntime({
      diagnostics: { requestId: 'req-2', route: '/api/staff/v1/schedule/downtime/delete', method: 'POST', startedAt: 1 },
      downtimeId: 'dt-1',
      downtimeItemId: 'item-1',
      positions: [{ id: 'item-2', position: 0 }],
      forecastUpdates: [{ id: 'job-2', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-11', forecast_duration_days: 1 }],
    });

    expect(res).toEqual({ ok: true, data: { deleted_downtime: 'dt-1' } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_delete_downtime', {
      p_downtime_id: 'dt-1',
      p_downtime_item_id: 'item-1',
      p_positions: [{ id: 'item-2', position: 0 }],
      p_forecast_updates: [{ id: 'job-2', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-11', forecast_duration_days: 1 }],
    });
  });

  it('passes keep-schedule mark-done payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: { updated_job: 'job-1', created_downtime_id: 'dt-1', created_item_id: 'item-1' },
      error: null,
    });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitMarkDone({
      diagnostics: { requestId: 'req-3', route: '/api/staff/v1/schedule/job/mark-done', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      actualStart: '2026-04-09',
      actualFinish: '2026-04-10',
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-09', forecast_end_exclusive: '2026-04-10', forecast_duration_days: 1 }],
      finishEarly: {
        crewId: 'crew-1',
        freedDays: 2,
        bufferNote: 'Finish early buffer (2 working days).',
        insertPosition: 1,
        existingPositions: [{ id: 'item-2', position: 2 }],
      },
    });

    expect(res).toEqual({
      ok: true,
      data: { updated_job: 'job-1', created_downtime_id: 'dt-1', created_item_id: 'item-1' },
    });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_mark_done', {
      p_scheduled_job_id: 'job-1',
      p_actual_start: '2026-04-09',
      p_actual_finish: '2026-04-10',
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-09', forecast_end_exclusive: '2026-04-10', forecast_duration_days: 1 }],
      p_finish_early: {
        crew_id: 'crew-1',
        freed_days: 2,
        buffer_note: 'Finish early buffer (2 working days).',
        insert_position: 1,
        existing_positions: [{ id: 'item-2', position: 2 }],
      },
    });
  });

  it('maps missing RPC functions to schema-not-ready', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_unassign_job' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleUnassign({
      diagnostics: { requestId: 'req-4', route: '/api/staff/v1/schedule/job/unassign', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobItemId: 'item-1',
      positions: [],
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 501,
      responseMessage: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(logPortalServerWarn).toHaveBeenCalledTimes(1);
  });

  it('maps generic unassign RPC failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleUnassign({
      diagnostics: { requestId: 'req-5', route: '/api/staff/v1/schedule/job/unassign', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobItemId: 'item-1',
      positions: [],
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to unassign scheduled job',
    });
    expect(logPortalServerError).toHaveBeenCalledTimes(1);
  });

  it('maps generic downtime delete RPC failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitDeleteDowntime({
      diagnostics: { requestId: 'req-6', route: '/api/staff/v1/schedule/downtime/delete', method: 'POST', startedAt: 1 },
      downtimeId: 'dt-1',
      downtimeItemId: 'item-1',
      positions: [],
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to delete downtime',
    });
  });

  it('maps generic keep-schedule mark-done RPC failures to the buffer message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitMarkDone({
      diagnostics: { requestId: 'req-7', route: '/api/staff/v1/schedule/job/mark-done', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      actualStart: '2026-04-09',
      actualFinish: '2026-04-10',
      forecastUpdates: [],
      finishEarly: {
        crewId: 'crew-1',
        freedDays: 2,
        bufferNote: 'buffer',
        insertPosition: 1,
        existingPositions: [{ id: 'item-2', position: 2 }],
      },
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to create finish-early buffer',
    });
  });
});
