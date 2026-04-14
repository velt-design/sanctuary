import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const isMissingSchemaError = vi.fn();
const logPortalServerError = vi.fn();
const logPortalServerWarn = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    rpc,
  },
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

  it('passes job patch payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { updated_job: 'job-1', updated_forecasts: 1 }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleJobPatch({
      diagnostics: { requestId: 'req-1', route: '/api/staff/v1/schedule/job/pin', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobPatch: { mode: 'pinned', forecast_start: '2026-04-15' },
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      failureMessage: 'Failed to pin scheduled job',
    });

    expect(res).toEqual({ ok: true, data: { updated_job: 'job-1', updated_forecasts: 1 } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_apply_job_patch', {
      p_scheduled_job_id: 'job-1',
      p_job_patch: { mode: 'pinned', forecast_start: '2026-04-15' },
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
  });

  it('passes assign payloads through to the RPC, including move state', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        scheduled_job_id: 'job-1',
        schedule_item_id: 'item-2',
        source_crew_id: 'crew-old',
        updated_target_items: 1,
        updated_source_items: 1,
        updated_forecasts: 2,
      },
      error: null,
    });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitAssignJob({
      diagnostics: { requestId: 'req-assign', route: '/api/staff/v1/schedule/job/assign', method: 'POST', startedAt: 1 },
      targetCrewId: 'crew-new',
      targetInsertPosition: 1,
      targetPositions: [{ id: 'item-1', position: 0 }],
      targetForecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      scheduledJobId: 'job-1',
      move: {
        sourceCrewId: 'crew-old',
        sourceJobItemId: 'item-old',
        sourcePositions: [{ id: 'old-1', position: 0 }],
        sourceForecastUpdates: [{ id: 'job-2', forecast_start: '2026-04-18', forecast_end_exclusive: '2026-04-20', forecast_duration_days: 2 }],
      },
    });

    expect(res).toEqual({
      ok: true,
      data: {
        scheduled_job_id: 'job-1',
        schedule_item_id: 'item-2',
        source_crew_id: 'crew-old',
        updated_target_items: 1,
        updated_source_items: 1,
        updated_forecasts: 2,
      },
    });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_assign_job', {
      p_target_crew_id: 'crew-new',
      p_target_insert_position: 1,
      p_target_positions: [{ id: 'item-1', position: 0 }],
      p_target_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      p_assignment: { scheduled_job_id: 'job-1' },
      p_move: {
        source_crew_id: 'crew-old',
        source_job_item_id: 'item-old',
        source_positions: [{ id: 'old-1', position: 0 }],
        source_forecast_updates: [{ id: 'job-2', forecast_start: '2026-04-18', forecast_end_exclusive: '2026-04-20', forecast_duration_days: 2 }],
      },
    });
  });

  it('passes existing scheduled job repair payloads through to the assign RPC without move state', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        scheduled_job_id: 'job-1',
        schedule_item_id: 'item-2',
        source_crew_id: null,
        updated_target_items: 1,
        updated_source_items: 0,
        updated_forecasts: 1,
      },
      error: null,
    });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitAssignJob({
      diagnostics: { requestId: 'req-assign-repair', route: '/api/staff/v1/schedule/job/assign', method: 'POST', startedAt: 1 },
      targetCrewId: 'crew-new',
      targetInsertPosition: 1,
      targetPositions: [{ id: 'item-1', position: 0 }],
      targetForecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      scheduledJobId: 'job-1',
    });

    expect(res).toEqual({
      ok: true,
      data: {
        scheduled_job_id: 'job-1',
        schedule_item_id: 'item-2',
        source_crew_id: null,
        updated_target_items: 1,
        updated_source_items: 0,
        updated_forecasts: 1,
      },
    });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_assign_job', {
      p_target_crew_id: 'crew-new',
      p_target_insert_position: 1,
      p_target_positions: [{ id: 'item-1', position: 0 }],
      p_target_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
      p_assignment: { scheduled_job_id: 'job-1' },
      p_move: null,
    });
  });

  it('passes downtime create payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        downtime_id: 'dt-1',
        schedule_item_id: 'item-1',
        updated_items: 1,
        updated_forecasts: 1,
      },
      error: null,
    });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitCreateDowntime({
      diagnostics: { requestId: 'req-dt-create', route: '/api/staff/v1/schedule/downtime/create', method: 'POST', startedAt: 1 },
      crewId: 'crew-1',
      durationDays: 2,
      reason: 'weather',
      note: 'Storm delay',
      insertPosition: 1,
      positions: [{ id: 'item-1', position: 0 }],
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });

    expect(res).toEqual({
      ok: true,
      data: {
        downtime_id: 'dt-1',
        schedule_item_id: 'item-1',
        updated_items: 1,
        updated_forecasts: 1,
      },
    });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_create_downtime', {
      p_crew_id: 'crew-1',
      p_duration_days: 2,
      p_reason: 'weather',
      p_note: 'Storm delay',
      p_insert_position: 1,
      p_positions: [{ id: 'item-1', position: 0 }],
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
  });

  it('passes downtime update payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        updated_downtime: 'dt-1',
        updated_forecasts: 1,
      },
      error: null,
    });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitUpdateDowntime({
      diagnostics: { requestId: 'req-dt-update', route: '/api/staff/v1/schedule/downtime/update', method: 'POST', startedAt: 1 },
      downtimeId: 'dt-1',
      patch: {
        duration_days: 3,
        reason: 'travel',
        note: 'Buffer',
      },
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });

    expect(res).toEqual({
      ok: true,
      data: {
        updated_downtime: 'dt-1',
        updated_forecasts: 1,
      },
    });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_update_downtime', {
      p_downtime_id: 'dt-1',
      p_patch: {
        duration_days: 3,
        reason: 'travel',
        note: 'Buffer',
      },
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
  });

  it('passes planned commitment payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { updated_job: 'job-1', history_inserted: true, updated_forecasts: 1 }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitPlannedCommitment({
      diagnostics: { requestId: 'req-2', route: '/api/staff/v1/schedule/job/lock', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobPatch: {
        mode: 'pinned',
        planned_commitment_type: 'fixed_date',
        planned_week_start: null,
        planned_start: '2026-04-15',
        planned_duration_days: 2,
        planned_flex_days: 1,
        planned_locked_at: '2026-04-01T00:00:00.000Z',
        planned_locked_by: 'ops@example.com',
        client_update_status: 'none',
        client_update_needed_at: null,
        client_update_ack_at: null,
        client_update_ack_by: null,
        forecast_start: '2026-04-15',
      },
      history: {
        eventType: 'lock',
        commitmentType: 'fixed_date',
        plannedWeekStart: null,
        plannedStart: '2026-04-15',
        plannedDurationDays: 2,
        plannedFlexDays: 1,
        hardLock: true,
        changedBy: 'ops@example.com',
      },
      forecastUpdates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });

    expect(res).toEqual({ ok: true, data: { updated_job: 'job-1', history_inserted: true, updated_forecasts: 1 } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_apply_commitment', {
      p_scheduled_job_id: 'job-1',
      p_job_patch: {
        mode: 'pinned',
        planned_commitment_type: 'fixed_date',
        planned_week_start: null,
        planned_start: '2026-04-15',
        planned_duration_days: 2,
        planned_flex_days: 1,
        planned_locked_at: '2026-04-01T00:00:00.000Z',
        planned_locked_by: 'ops@example.com',
        client_update_status: 'none',
        client_update_needed_at: null,
        client_update_ack_at: null,
        client_update_ack_by: null,
        forecast_start: '2026-04-15',
      },
      p_history: {
        event_type: 'lock',
        commitment_type: 'fixed_date',
        planned_week_start: null,
        planned_start: '2026-04-15',
        planned_duration_days: 2,
        planned_flex_days: 1,
        hard_lock: true,
        changed_by: 'ops@example.com',
      },
      p_forecast_updates: [{ id: 'job-1', forecast_start: '2026-04-15', forecast_end_exclusive: '2026-04-17', forecast_duration_days: 2 }],
    });
  });

  it('passes client update ack payloads through to the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: { updated_job: 'job-1', acknowledged: true }, error: null });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitClientUpdateAck({
      diagnostics: { requestId: 'req-3', route: '/api/staff/v1/schedule/job/client-update/ack', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      ackAt: '2026-04-01T00:00:00.000Z',
      ackBy: 'ops@example.com',
    });

    expect(res).toEqual({ ok: true, data: { updated_job: 'job-1', acknowledged: true } });
    expect(rpc).toHaveBeenCalledWith('schedule_v2_ack_client_update', {
      p_scheduled_job_id: 'job-1',
      p_ack_at: '2026-04-01T00:00:00.000Z',
      p_ack_by: 'ops@example.com',
    });
  });

  it('maps missing RPC functions to schema-not-ready', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_apply_job_patch' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleJobPatch({
      diagnostics: { requestId: 'req-4', route: '/api/staff/v1/schedule/job/pin', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobPatch: { mode: 'pinned' },
      forecastUpdates: [],
      failureMessage: 'Failed to pin scheduled job',
    });

    expect(res).toEqual({
      ok: false,
      status: 501,
      responseMessage: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
    expect(logPortalServerWarn).toHaveBeenCalledTimes(1);
  });

  it('maps generic job patch failures to the supplied stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitScheduleJobPatch({
      diagnostics: { requestId: 'req-5', route: '/api/staff/v1/schedule/job/unpin', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobPatch: { mode: 'floating' },
      forecastUpdates: [],
      failureMessage: 'Failed to unpin scheduled job',
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to unpin scheduled job',
    });
  });

  it('maps generic commitment failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitPlannedCommitment({
      diagnostics: { requestId: 'req-6', route: '/api/staff/v1/schedule/job/lock', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      jobPatch: { mode: 'pinned', planned_commitment_type: 'fixed_date' },
      history: {
        eventType: 'lock',
        commitmentType: 'fixed_date',
        plannedWeekStart: null,
        plannedStart: '2026-04-15',
        plannedDurationDays: 2,
        plannedFlexDays: 1,
        hardLock: true,
        changedBy: 'ops@example.com',
      },
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to update planned commitment',
    });
  });

  it('maps generic client update ack failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitClientUpdateAck({
      diagnostics: { requestId: 'req-7', route: '/api/staff/v1/schedule/job/client-update/ack', method: 'POST', startedAt: 1 },
      scheduledJobId: 'job-1',
      ackAt: '2026-04-01T00:00:00.000Z',
      ackBy: 'ops@example.com',
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to acknowledge client update',
    });
  });

  it('maps missing assign RPC functions to schema-not-ready', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_assign_job' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitAssignJob({
      diagnostics: { requestId: 'req-assign-schema', route: '/api/staff/v1/schedule/job/assign', method: 'POST', startedAt: 1 },
      targetCrewId: 'crew-1',
      targetInsertPosition: 0,
      targetPositions: [],
      targetForecastUpdates: [],
      jobId: 'project-1',
      forecastDurationDays: 2,
    });

    expect(res).toEqual({
      ok: false,
      status: 501,
      responseMessage: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
  });

  it('maps generic assign failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitAssignJob({
      diagnostics: { requestId: 'req-assign-fail', route: '/api/staff/v1/schedule/job/assign', method: 'POST', startedAt: 1 },
      targetCrewId: 'crew-1',
      targetInsertPosition: 0,
      targetPositions: [],
      targetForecastUpdates: [],
      jobId: 'project-1',
      forecastDurationDays: 2,
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to assign scheduled job',
    });
  });

  it('maps missing downtime create RPC functions to schema-not-ready', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_create_downtime' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitCreateDowntime({
      diagnostics: { requestId: 'req-dt-create-schema', route: '/api/staff/v1/schedule/downtime/create', method: 'POST', startedAt: 1 },
      crewId: 'crew-1',
      durationDays: 1,
      reason: 'other',
      note: null,
      insertPosition: 0,
      positions: [],
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 501,
      responseMessage: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
  });

  it('maps missing downtime update RPC functions to schema-not-ready', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_update_downtime' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitUpdateDowntime({
      diagnostics: { requestId: 'req-dt-update-schema', route: '/api/staff/v1/schedule/downtime/update', method: 'POST', startedAt: 1 },
      downtimeId: 'dt-1',
      patch: { duration_days: 2 },
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 501,
      responseMessage: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
    });
  });

  it('maps generic downtime create failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitCreateDowntime({
      diagnostics: { requestId: 'req-dt-create-fail', route: '/api/staff/v1/schedule/downtime/create', method: 'POST', startedAt: 1 },
      crewId: 'crew-1',
      durationDays: 1,
      reason: 'other',
      note: null,
      insertPosition: 0,
      positions: [],
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to create downtime',
    });
  });

  it('maps generic downtime update failures to a stable route message', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const mod = await import('./scheduleCommands');
    const res = await mod.commitUpdateDowntime({
      diagnostics: { requestId: 'req-dt-update-fail', route: '/api/staff/v1/schedule/downtime/update', method: 'POST', startedAt: 1 },
      downtimeId: 'dt-1',
      patch: { duration_days: 2 },
      forecastUpdates: [],
    });

    expect(res).toEqual({
      ok: false,
      status: 500,
      responseMessage: 'Failed to update downtime',
    });
  });
});
