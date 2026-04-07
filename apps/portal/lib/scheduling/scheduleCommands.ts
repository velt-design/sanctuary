import 'server-only';

import { isMissingSchemaError } from '@/lib/scheduling/scheduleV2Server';
import { logPortalServerError, logPortalServerWarn, type PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import { supabaseServer } from '@/lib/supabaseClient';

const SCHEMA_NOT_READY_MESSAGE = 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.';

type ForecastUpdateInput = {
  id: string;
  forecast_start: string | null;
  forecast_end_exclusive: string | null;
  forecast_duration_days: number;
};

type ScheduleCommandOk = {
  ok: true;
  data: unknown;
};

type ScheduleCommandFailure = {
  ok: false;
  status: 500 | 501;
  responseMessage: string;
};

type ScheduleCommandResult = ScheduleCommandOk | ScheduleCommandFailure;

type RunScheduleRpcCommandInput = {
  diagnostics: PortalServerLogContext;
  fn: string;
  args: Record<string, unknown>;
  failureMessage: string;
};

function isMissingScheduleRpcError(error: unknown): boolean {
  if (isMissingSchemaError(error)) return true;

  const code = typeof (error as { code?: unknown })?.code === 'string' ? ((error as { code?: string }).code ?? '').trim() : '';
  const message =
    typeof (error as { message?: unknown })?.message === 'string' ? ((error as { message?: string }).message ?? '').toLowerCase() : '';

  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('could not find the function') ||
    message.includes('function public.schedule_v2_') ||
    message.includes('undefined function')
  );
}

async function runScheduleRpcCommand(input: RunScheduleRpcCommandInput): Promise<ScheduleCommandResult> {
  const rpcRes = await supabaseServer.rpc(input.fn, input.args as any);

  if (rpcRes.error) {
    if (isMissingScheduleRpcError(rpcRes.error)) {
      logPortalServerWarn(input.diagnostics, {
        status: 501,
        message: SCHEMA_NOT_READY_MESSAGE,
        error: rpcRes.error,
        extra: { command: input.fn },
      });
      return {
        ok: false,
        status: 501,
        responseMessage: SCHEMA_NOT_READY_MESSAGE,
      };
    }

    logPortalServerError(input.diagnostics, {
      status: 500,
      message: input.failureMessage,
      error: rpcRes.error,
      extra: { command: input.fn },
    });
    return {
      ok: false,
      status: 500,
      responseMessage: input.failureMessage,
    };
  }

  return {
    ok: true,
    data: rpcRes.data,
  };
}

export async function commitScheduleReorder(input: {
  diagnostics: PortalServerLogContext;
  crewId: string;
  positions: { id: string; position: number }[];
  forecastUpdates: ForecastUpdateInput[];
}): Promise<ScheduleCommandResult> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_reorder_queue',
    args: {
      p_crew_id: input.crewId,
      p_positions: input.positions,
      p_forecast_updates: input.forecastUpdates,
    },
    failureMessage: 'Failed to reorder schedule items',
  });
}

export async function commitSetDaysRemaining(input: {
  diagnostics: PortalServerLogContext;
  scheduledJobId: string;
  daysRemaining: number;
  forecastUpdates: ForecastUpdateInput[];
}): Promise<ScheduleCommandResult> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_set_days_remaining',
    args: {
      p_scheduled_job_id: input.scheduledJobId,
      p_days_remaining: input.daysRemaining,
      p_forecast_updates: input.forecastUpdates,
    },
    failureMessage: 'Failed to update scheduled job',
  });
}
