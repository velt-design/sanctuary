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

  it('passes reorder payloads through to the reorder RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { updated_items: 2, updated_forecasts: 1 }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleReorder({
      diagnostics: { requestId: 'req-1', route: '/api/staff/v1/schedule/items/reorder', method: 'POST', startedAt: 1 },
      crewId: 'crew-1',
      positions: [{ id: 'item-1', position: 0 }],
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-11', forecast_duration_days: 1 }],
    });

    expect(res).toEqual({ ok: true, data: { updated_items: 2, updated_forecasts: 1 } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_reorder_queue', {
      p_crew_id: 'crew-1',
      p_positions: [{ id: 'item-1', position: 0 }],
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-11', forecast_duration_days: 1 }],
    });
  });

  it('passes set-days-remaining payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { updated_job: 'job-1', updated_forecasts: 1 }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitSetDaysRemaining({
      diagnostics: { requestId: 'req-2', route: '/api/staff/v1/schedule/job/set-days-remaining', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      daysRemaining: 3,
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-13', forecast_duration_days: 3 }],
    });

    expect(res).toEqual({ ok: true, data: { updated_job: 'job-1', updated_forecasts: 1 } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_set_days_remaining', {
      p_scheduled_job_id: 'job-1',
      p_days_remaining: 3,
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-10', forecast_end_exclusive: '2026-04-13', forecast_duration_days: 3 }],
    });
  });

  it('maps missing RPC functions to schema-not-ready', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_reorder_queue' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleReorder({
      diagnostics: { requestId: 'req-3', route: '/api/staff/v1/schedule/items/reorder', method: 'POST', startedAt: 1 },
      crewId: 'crew-1',
      positions: [{ id: 'item-1', position: 0 }],
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 501,
      responseMessage: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(logPortalServerWarn).toHaveBeenCalledTimes(1);
  });

  it('maps generic RPC failures to stable route messages', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitSetDaysRemaining({
      diagnostics: { requestId: 'req-4', route: '/api/staff/v1/schedule/job/set-days-remaining', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      daysRemaining: 4,
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to update scheduled job',
    });
    expect(logPortalServerError).toHaveBeenCalledTimes(1);
  });
});
