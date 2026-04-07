import 'server-only';

import { isMissingSchemaError } from '@/lib/scheduling/scheduleV2Server';
import { logPortalServerError, logPortalServerWarn, type PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import { supabaseServer } from '@/lib/supabaseClient';

const SCHEMA_NOT_READY_MESSAGE = 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.';

type ScheduleCommandOk<T> = {
  ok: true;
  data: T;
};

type ScheduleCommandFailure = {
  ok: false;
  status: 500 | 501;
  responseMessage: string;
};

type ScheduleCommandResult<T> = ScheduleCommandOk<T> | ScheduleCommandFailure;

type RunScheduleRpcCommandInput<T> = {
  diagnostics: PortalServerLogContext;
  fn: string;
  args: Record<string, unknown>;
  failureMessage: string;
};

type ForecastUpdateInput = {
  id: string;
  forecast_start: string | null;
  forecast_end_exclusive: string | null;
  forecast_duration_days: number;
};

type PositionInput = {
  id: string;
  position: number;
};

export type MarkDoneFinishEarlyInput = {
  crewId: string;
  freedDays: number;
  bufferNote: string;
  insertPosition: number;
  existingPositions: PositionInput[];
};

export type MarkDoneCommandResult = {
  updated_job: string;
  created_downtime_id: string | null;
  created_item_id: string | null;
  updated_items: number;
  updated_forecasts: number;
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

async function runScheduleRpcCommand<T>(input: RunScheduleRpcCommandInput<T>): Promise<ScheduleCommandResult<T>> {
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
    data: rpcRes.data as T,
  };
}

export async function commitScheduleReorder(input: {
  diagnostics: PortalServerLogContext;
  crewId: string;
  positions: PositionInput[];
  forecastUpdates: ForecastUpdateInput[];
}): Promise<ScheduleCommandResult<{ updated_items: number; updated_forecasts: number }>> {
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
}): Promise<ScheduleCommandResult<{ updated_job: string; updated_forecasts: number }>> {
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

export async function commitScheduleUnassign(input: {
  diagnostics: PortalServerLogContext;
  scheduledJobId: string;
  jobItemId: string;
  positions: PositionInput[];
  forecastUpdates: ForecastUpdateInput[];
}): Promise<ScheduleCommandResult<{ deleted_job: string; deleted_item: string; updated_items: number; updated_forecasts: number }>> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_unassign_job',
    args: {
      p_scheduled_job_id: input.scheduledJobId,
      p_job_item_id: input.jobItemId,
      p_positions: input.positions,
      p_forecast_updates: input.forecastUpdates,
    },
    failureMessage: 'Failed to unassign scheduled job',
  });
}

export async function commitDeleteDowntime(input: {
  diagnostics: PortalServerLogContext;
  downtimeId: string;
  downtimeItemId: string;
  positions: PositionInput[];
  forecastUpdates: ForecastUpdateInput[];
}): Promise<ScheduleCommandResult<{ deleted_downtime: string; deleted_item: string; updated_items: number; updated_forecasts: number }>> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_delete_downtime',
    args: {
      p_downtime_id: input.downtimeId,
      p_downtime_item_id: input.downtimeItemId,
      p_positions: input.positions,
      p_forecast_updates: input.forecastUpdates,
    },
    failureMessage: 'Failed to delete downtime',
  });
}

export async function commitMarkDone(input: {
  diagnostics: PortalServerLogContext;
  scheduledJobId: string;
  actualStart: string;
  actualFinish: string;
  forecastUpdates: ForecastUpdateInput[];
  finishEarly?: MarkDoneFinishEarlyInput | null;
}): Promise<ScheduleCommandResult<MarkDoneCommandResult>> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_mark_done',
    args: {
      p_scheduled_job_id: input.scheduledJobId,
      p_actual_start: input.actualStart,
      p_actual_finish: input.actualFinish,
      p_forecast_updates: input.forecastUpdates,
      p_finish_early: input.finishEarly
        ? {
            crew_id: input.finishEarly.crewId,
            freed_days: input.finishEarly.freedDays,
            buffer_note: input.finishEarly.bufferNote,
            insert_position: input.finishEarly.insertPosition,
            existing_positions: input.finishEarly.existingPositions,
          }
        : null,
    },
    failureMessage: input.finishEarly ? 'Failed to create finish-early buffer' : 'Failed to mark scheduled job done',
  });
}
