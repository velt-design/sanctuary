import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const loadScheduleContext = vi.fn();
const listProjectsAndEstimates = vi.fn();
const isMissingSchemaError = vi.fn();
const isSupportedSchemaError = vi.fn();
const logPortalServerWarn = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    rpc,
  },
}));

vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  loadScheduleContext,
  listProjectsAndEstimates,
  isMissingSchemaError,
}));

vi.mock('@/lib/supabase/schemaGuard', () => ({
  isSupportedSchemaError,
}));

vi.mock('@/lib/api/routeDiagnostics', () => ({
  logPortalServerWarn,
}));

const expectedProbeFailures = new Map<string, string>([
  ['schedule_v2_reorder_queue', 'p_positions must be a non-empty array'],
  ['schedule_v2_set_days_remaining', 'p_days_remaining must be zero or greater'],
  ['schedule_v2_unassign_job', 'scheduled job not found'],
  ['schedule_v2_delete_downtime', 'downtime not found'],
  ['schedule_v2_mark_done', 'scheduled job not found'],
  ['schedule_v2_apply_job_patch', 'scheduled job not found'],
  ['schedule_v2_apply_commitment', 'scheduled job not found'],
  ['schedule_v2_ack_client_update', 'scheduled job not found'],
  ['schedule_v2_assign_job', 'target crew not found'],
  ['schedule_v2_create_downtime', 'crew not found'],
  ['schedule_v2_update_downtime', 'downtime not found'],
]);

describe('scheduleReadiness', () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
    loadScheduleContext.mockReset();
    listProjectsAndEstimates.mockReset();
    isMissingSchemaError.mockReset();
    isSupportedSchemaError.mockReset();
    logPortalServerWarn.mockReset();

    loadScheduleContext.mockResolvedValue({
      crews: [],
      items: [],
      jobs: [],
      downtimes: [],
      holidays: [],
      closures: [],
      calendar: {},
      today: '2026-04-07',
    });
    listProjectsAndEstimates.mockResolvedValue({ projects: [], estimates: [] });
    isMissingSchemaError.mockReturnValue(false);
    isSupportedSchemaError.mockReturnValue(false);

    rpc.mockImplementation(async (fn: string) => ({
      data: null,
      error: { message: expectedProbeFailures.get(fn) ?? 'unexpected probe failure' },
    }));
  });

  it('accepts expected probe failures as proof the full RPC contract exists', async () => {
    const mod = await import('./scheduleReadiness');
    const readiness = await mod.verifyScheduleReadiness();

    expect(readiness.ok).toBe(true);
    expect(readiness.missingFunctions).toEqual([]);
    expect(readiness.readinessChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'read', name: 'loadScheduleContext', ok: true }),
        expect.objectContaining({ kind: 'read', name: 'listProjectsAndEstimates', ok: true }),
        expect.objectContaining({ kind: 'rpc', name: 'schedule_v2_apply_commitment', ok: true }),
        expect.objectContaining({ kind: 'rpc', name: 'schedule_v2_update_downtime', ok: true }),
      ]),
    );
    expect(rpc).toHaveBeenCalledTimes(mod.REQUIRED_SCHEDULE_RPC_FUNCTIONS.length);
  });

  it('reports missing RPC functions as not ready', async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'schedule_v2_mark_done') {
        return {
          data: null,
          error: { code: 'PGRST202', message: 'Could not find the function public.schedule_v2_mark_done' },
        };
      }
      return {
        data: null,
        error: { message: expectedProbeFailures.get(fn) ?? 'unexpected probe failure' },
      };
    });

    const mod = await import('./scheduleReadiness');
    const readiness = await mod.verifyScheduleReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.missingFunctions).toEqual(['schedule_v2_mark_done']);
    expect(readiness.message).toContain('Missing required functions: schedule_v2_mark_done');
    expect(readiness.readinessChecks).toContainEqual(
      expect.objectContaining({ kind: 'rpc', name: 'schedule_v2_mark_done', ok: false }),
    );
  });

  it('detects the pre-repair assign RPC revision when a crew is available', async () => {
    loadScheduleContext.mockResolvedValueOnce({
      crews: [{ id: '11111111-1111-4111-8111-111111111111' }],
      items: [],
      jobs: [],
      downtimes: [],
      holidays: [],
      closures: [],
      calendar: {},
      today: '2026-04-07',
    });
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'schedule_v2_assign_job') {
        expect(args).toEqual({
          p_target_crew_id: '11111111-1111-4111-8111-111111111111',
          p_target_insert_position: 0,
          p_target_positions: [],
          p_target_forecast_updates: [],
          p_assignment: { scheduled_job_id: '00000000-0000-0000-0000-000000000000' },
          p_move: null,
        });
        return { data: null, error: { message: 'p_assignment.job_id is required' } };
      }
      return {
        data: null,
        error: { message: expectedProbeFailures.get(fn) ?? 'unexpected probe failure' },
      };
    });

    const mod = await import('./scheduleReadiness');
    const readiness = await mod.verifyScheduleReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.missingFunctions).toEqual([]);
    expect(readiness.message).toContain('20260414_000001_schedule_v2_assign_existing_job_repair.sql');
    expect(readiness.readinessChecks).toContainEqual(
      expect.objectContaining({
        kind: 'rpc',
        name: 'schedule_v2_assign_job',
        ok: false,
        detail: 'p_assignment.job_id is required',
      }),
    );
  });

  it('treats read-path schema errors as not ready', async () => {
    const missing = new Error('column projects.pipeline_stage does not exist');
    loadScheduleContext.mockRejectedValueOnce(missing);
    isMissingSchemaError.mockImplementation((error) => error === missing);

    const mod = await import('./scheduleReadiness');
    const readiness = await mod.verifyScheduleReadiness();

    expect(readiness).toEqual(
      expect.objectContaining({
        ok: false,
        missingFunctions: [],
        message: 'Schedule schema/read model is not upgraded yet. Run latest schedule migrations then refresh.',
      }),
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('treats supported-schema RPC failures as not ready', async () => {
    const schemaError = { code: '42703', message: 'column scheduled_jobs.client_update_status does not exist' };
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'schedule_v2_ack_client_update') {
        return { data: null, error: schemaError };
      }
      return {
        data: null,
        error: { message: expectedProbeFailures.get(fn) ?? 'unexpected probe failure' },
      };
    });
    isSupportedSchemaError.mockImplementation((error) => error === schemaError);

    const mod = await import('./scheduleReadiness');
    const readiness = await mod.verifyScheduleReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.missingFunctions).toEqual([]);
    expect(readiness.readinessChecks).toContainEqual(
      expect.objectContaining({ kind: 'rpc', name: 'schedule_v2_ack_client_update', ok: false }),
    );
  });

  it('throws on unexpected probe failures', async () => {
    const unexpected = { message: 'permission denied for relation scheduled_jobs' };
    rpc.mockResolvedValueOnce({ data: null, error: unexpected });

    const mod = await import('./scheduleReadiness');

    await expect(mod.verifyScheduleReadiness()).rejects.toEqual(unexpected);
  });
});
