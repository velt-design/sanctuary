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

type JobPatchInput = {
  mode?: 'floating' | 'pinned';
  forecast_start?: string | null;
  forecast_duration_days?: number;
  status?: 'not_started' | 'in_progress' | 'paused' | 'done';
  actual_start?: string | null;
};

type PlannedCommitmentPatchInput = {
  mode?: 'floating' | 'pinned';
  planned_commitment_type?: 'week_of' | 'fixed_date' | null;
  planned_week_start?: string | null;
  planned_start?: string | null;
  planned_duration_days?: number | null;
  planned_flex_days?: number | null;
  planned_locked_at?: string | null;
  planned_locked_by?: string | null;
  client_update_status?: 'none' | 'needed' | 'acknowledged';
  client_update_needed_at?: string | null;
  client_update_ack_at?: string | null;
  client_update_ack_by?: string | null;
  forecast_start?: string | null;
};

type PlannedCommitmentHistoryInput = {
  eventType: 'lock' | 'reschedule';
  commitmentType: 'week_of' | 'fixed_date';
  plannedWeekStart: string | null;
  plannedStart: string | null;
  plannedDurationDays: number | null;
  plannedFlexDays: number;
  hardLock: boolean;
  changedBy: string | null;
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

function jsonbWithoutUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

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

export async function commitScheduleJobPatch(input: {
  diagnostics: PortalServerLogContext;
  scheduledJobId: string;
  jobPatch: JobPatchInput;
  forecastUpdates: ForecastUpdateInput[];
  failureMessage: string;
}): Promise<ScheduleCommandResult<{ updated_job: string; updated_forecasts: number }>> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_apply_job_patch',
    args: {
      p_scheduled_job_id: input.scheduledJobId,
      p_job_patch: jsonbWithoutUndefined(input.jobPatch as Record<string, unknown>),
      p_forecast_updates: input.forecastUpdates,
    },
    failureMessage: input.failureMessage,
  });
}

export async function commitPlannedCommitment(input: {
  diagnostics: PortalServerLogContext;
  scheduledJobId: string;
  jobPatch: PlannedCommitmentPatchInput;
  history: PlannedCommitmentHistoryInput;
  forecastUpdates: ForecastUpdateInput[];
}): Promise<ScheduleCommandResult<{ updated_job: string; history_inserted: boolean; updated_forecasts: number }>> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_apply_commitment',
    args: {
      p_scheduled_job_id: input.scheduledJobId,
      p_job_patch: jsonbWithoutUndefined(input.jobPatch as Record<string, unknown>),
      p_history: {
        event_type: input.history.eventType,
        commitment_type: input.history.commitmentType,
        planned_week_start: input.history.plannedWeekStart,
        planned_start: input.history.plannedStart,
        planned_duration_days: input.history.plannedDurationDays,
        planned_flex_days: input.history.plannedFlexDays,
        hard_lock: input.history.hardLock,
        changed_by: input.history.changedBy,
      },
      p_forecast_updates: input.forecastUpdates,
    },
    failureMessage: 'Failed to update planned commitment',
  });
}

export async function commitClientUpdateAck(input: {
  diagnostics: PortalServerLogContext;
  scheduledJobId: string;
  ackAt: string;
  ackBy: string | null;
}): Promise<ScheduleCommandResult<{ updated_job: string; acknowledged: boolean }>> {
  return runScheduleRpcCommand({
    diagnostics: input.diagnostics,
    fn: 'schedule_v2_ack_client_update',
    args: {
      p_scheduled_job_id: input.scheduledJobId,
      p_ack_at: input.ackAt,
      p_ack_by: input.ackBy,
    },
    failureMessage: 'Failed to acknowledge client update',
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
