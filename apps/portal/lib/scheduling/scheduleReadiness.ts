import 'server-only';

import { logPortalServerWarn, type PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import { loadScheduleContext, listProjectsAndEstimates, isMissingSchemaError } from '@/lib/scheduling/scheduleV2Server';
import { isSupportedSchemaError } from '@/lib/supabase/schemaGuard';
import { supabaseServiceRole } from '@/lib/supabaseClient';

type ScheduleReadinessCheck = {
  kind: 'read' | 'rpc';
  name: string;
  ok: boolean;
  detail?: string;
};

export type ScheduleReadinessResult = {
  ok: boolean;
  missingFunctions: string[];
  readinessChecks: ScheduleReadinessCheck[];
  message?: string;
};

type RpcProbe = {
  fn: string;
  args: Record<string, unknown>;
  expectedMessages: string[];
};

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const REQUIRED_SCHEDULE_RPC_FUNCTIONS = [
  'schedule_v2_reorder_queue',
  'schedule_v2_set_days_remaining',
  'schedule_v2_unassign_job',
  'schedule_v2_delete_downtime',
  'schedule_v2_mark_done',
  'schedule_v2_apply_job_patch',
  'schedule_v2_apply_commitment',
  'schedule_v2_ack_client_update',
  'schedule_v2_assign_job',
  'schedule_v2_create_downtime',
  'schedule_v2_update_downtime',
] as const;

const REQUIRED_SCHEDULE_RPC_PROBES: RpcProbe[] = [
  {
    fn: 'schedule_v2_reorder_queue',
    args: { p_crew_id: NIL_UUID, p_positions: [], p_forecast_updates: [] },
    expectedMessages: ['p_positions must be a non-empty array'],
  },
  {
    fn: 'schedule_v2_set_days_remaining',
    args: { p_scheduled_job_id: NIL_UUID, p_days_remaining: -1, p_forecast_updates: [] },
    expectedMessages: ['p_days_remaining must be zero or greater'],
  },
  {
    fn: 'schedule_v2_unassign_job',
    args: { p_scheduled_job_id: NIL_UUID, p_job_item_id: NIL_UUID, p_positions: [], p_forecast_updates: [] },
    expectedMessages: ['scheduled job not found'],
  },
  {
    fn: 'schedule_v2_delete_downtime',
    args: { p_downtime_id: NIL_UUID, p_downtime_item_id: NIL_UUID, p_positions: [], p_forecast_updates: [] },
    expectedMessages: ['downtime not found'],
  },
  {
    fn: 'schedule_v2_mark_done',
    args: {
      p_scheduled_job_id: NIL_UUID,
      p_actual_start: '2026-04-07',
      p_actual_finish: '2026-04-07',
      p_forecast_updates: [],
      p_finish_early: null,
    },
    expectedMessages: ['scheduled job not found'],
  },
  {
    fn: 'schedule_v2_apply_job_patch',
    args: { p_scheduled_job_id: NIL_UUID, p_job_patch: {}, p_forecast_updates: [] },
    expectedMessages: ['scheduled job not found'],
  },
  {
    fn: 'schedule_v2_apply_commitment',
    args: { p_scheduled_job_id: NIL_UUID, p_job_patch: {}, p_history: {}, p_forecast_updates: [] },
    expectedMessages: ['scheduled job not found'],
  },
  {
    fn: 'schedule_v2_ack_client_update',
    args: { p_scheduled_job_id: NIL_UUID, p_ack_at: '2026-04-07T00:00:00.000Z', p_ack_by: 'readiness-check' },
    expectedMessages: ['scheduled job not found'],
  },
  {
    fn: 'schedule_v2_assign_job',
    args: {
      p_target_crew_id: NIL_UUID,
      p_target_insert_position: 0,
      p_target_positions: [],
      p_target_forecast_updates: [],
      p_assignment: {},
      p_move: null,
    },
    expectedMessages: ['target crew not found'],
  },
  {
    fn: 'schedule_v2_create_downtime',
    args: {
      p_crew_id: NIL_UUID,
      p_duration_days: 1,
      p_reason: 'other',
      p_note: null,
      p_insert_position: 0,
      p_positions: [],
      p_forecast_updates: [],
    },
    expectedMessages: ['crew not found'],
  },
  {
    fn: 'schedule_v2_update_downtime',
    args: { p_downtime_id: NIL_UUID, p_patch: { duration_days: 1 }, p_forecast_updates: [] },
    expectedMessages: ['downtime not found'],
  },
];

function errorCode(error: unknown): string {
  return typeof (error as { code?: unknown })?.code === 'string' ? ((error as { code?: string }).code ?? '').trim() : '';
}

function errorMessage(error: unknown): string {
  return typeof (error as { message?: unknown })?.message === 'string' ? ((error as { message?: string }).message ?? '').trim() : '';
}

function isMissingScheduleRpcError(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('could not find the function') ||
    message.includes('function public.schedule_v2_') ||
    message.includes('undefined function')
  );
}

function isExpectedProbeFailure(error: unknown, expectedMessages: string[]): boolean {
  const message = errorMessage(error).toLowerCase();
  if (!message) return false;
  return expectedMessages.some((expected) => message.includes(expected.toLowerCase()));
}

function notReadyMessage(missingFunctions: string[]): string {
  if (missingFunctions.length) {
    return `Schedule schema is not upgraded yet. Missing required functions: ${missingFunctions.join(', ')}. Run latest schedule migrations then refresh.`;
  }
  return 'Schedule schema/read model is not upgraded yet. Run latest schedule migrations then refresh.';
}

export async function verifyScheduleReadiness(
  diagnostics?: PortalServerLogContext,
): Promise<ScheduleReadinessResult> {
  const readinessChecks: ScheduleReadinessCheck[] = [];

  try {
    await loadScheduleContext();
    readinessChecks.push({ kind: 'read', name: 'loadScheduleContext', ok: true });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      readinessChecks.push({ kind: 'read', name: 'loadScheduleContext', ok: false, detail: errorMessage(error) || 'missing schema' });
      return {
        ok: false,
        missingFunctions: [],
        readinessChecks,
        message: notReadyMessage([]),
      };
    }
    throw error;
  }

  try {
    await listProjectsAndEstimates();
    readinessChecks.push({ kind: 'read', name: 'listProjectsAndEstimates', ok: true });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      readinessChecks.push({ kind: 'read', name: 'listProjectsAndEstimates', ok: false, detail: errorMessage(error) || 'missing schema' });
      return {
        ok: false,
        missingFunctions: [],
        readinessChecks,
        message: notReadyMessage([]),
      };
    }
    throw error;
  }

  const missingFunctions: string[] = [];

  for (const probe of REQUIRED_SCHEDULE_RPC_PROBES) {
    const rpcRes = await supabaseServiceRole.rpc(probe.fn, probe.args as any);

    if (!rpcRes.error) {
      readinessChecks.push({ kind: 'rpc', name: probe.fn, ok: true });
      continue;
    }

    if (isMissingScheduleRpcError(rpcRes.error)) {
      readinessChecks.push({ kind: 'rpc', name: probe.fn, ok: false, detail: errorMessage(rpcRes.error) || 'missing function' });
      missingFunctions.push(probe.fn);
      continue;
    }

    if (isSupportedSchemaError(rpcRes.error)) {
      readinessChecks.push({ kind: 'rpc', name: probe.fn, ok: false, detail: errorMessage(rpcRes.error) || 'unsupported schema' });
      return {
        ok: false,
        missingFunctions,
        readinessChecks,
        message: notReadyMessage(missingFunctions),
      };
    }

    if (isExpectedProbeFailure(rpcRes.error, probe.expectedMessages)) {
      readinessChecks.push({ kind: 'rpc', name: probe.fn, ok: true, detail: errorMessage(rpcRes.error) });
      continue;
    }

    if (diagnostics) {
      logPortalServerWarn(diagnostics, {
        status: 500,
        message: `Unexpected readiness probe failure for ${probe.fn}`,
        error: rpcRes.error,
        extra: { command: probe.fn },
      });
    }
    throw rpcRes.error;
  }

  if (missingFunctions.length) {
    return {
      ok: false,
      missingFunctions,
      readinessChecks,
      message: notReadyMessage(missingFunctions),
    };
  }

  return {
    ok: true,
    missingFunctions: [],
    readinessChecks,
  };
}
