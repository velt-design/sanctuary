import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  appendPlannedCommitmentHistory,
  applyJobForecastUpdates,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  defaultFlexDaysForCommitment,
  defaultHardLockForCommitment,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  loadScheduledJobRow,
  normalizePlannedCommitmentType,
  recomputeForCrew,
  snapToday,
  startOfWeekMondayYmd,
  type PlannedCommitmentType,
} from '@/lib/scheduling/scheduleV2Server';
import { supabaseServer } from '@/lib/supabaseClient';

type CommitmentEventType = 'lock' | 'reschedule';

type ParsedCommitmentInput = {
  jobId: string;
  commitmentType: PlannedCommitmentType;
  plannedWeekStart: string | null;
  plannedStart: string;
  plannedDurationDays: number;
  plannedFlexDays: number;
  hardLock: boolean;
  force: boolean;
  today: string | undefined;
};

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const v = Math.trunc(value);
  if (v <= 0) return null;
  return v;
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function parseInput(body: any): { ok: true; value: ParsedCommitmentInput } | { ok: false; error: string } {
  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  if (!jobId) return { ok: false, error: 'job_id is required' };

  const commitmentType = normalizePlannedCommitmentType(body.commitment_type);
  if (!commitmentType) return { ok: false, error: "commitment_type must be 'week_of' or 'fixed_date'" };

  const durationDays = toPositiveInt(body.duration_days);
  if (durationDays === null) return { ok: false, error: 'duration_days must be a positive integer' };

  const startDateRaw = typeof body.start_date === 'string' ? body.start_date.trim() : '';
  const weekOfDateRaw = typeof body.week_of_date === 'string' ? body.week_of_date.trim() : '';

  let plannedWeekStart: string | null = null;
  let plannedStart = '';

  if (commitmentType === 'week_of') {
    if (!isYmd(weekOfDateRaw)) {
      return { ok: false, error: 'week_of_date is required for week_of commitments' };
    }
    plannedWeekStart = startOfWeekMondayYmd(weekOfDateRaw);
    plannedStart = plannedWeekStart;
  } else {
    if (!isYmd(startDateRaw)) {
      return { ok: false, error: 'start_date is required for fixed_date commitments' };
    }
    plannedStart = startDateRaw;
  }

  const flexDaysInput = body.flex_days;
  const flexDays = flexDaysInput === undefined || flexDaysInput === null ? null : toNonNegativeInt(flexDaysInput);
  if (flexDaysInput !== undefined && flexDaysInput !== null && flexDays === null) {
    return { ok: false, error: 'flex_days must be a non-negative integer' };
  }

  const plannedFlexDays = flexDays ?? defaultFlexDaysForCommitment(commitmentType);
  const hardLock = typeof body.hard_lock === 'boolean' ? body.hard_lock : defaultHardLockForCommitment(commitmentType);

  const force = Boolean(body.force);
  const today = typeof body.today === 'string' && isYmd(body.today) ? body.today : undefined;

  return {
    ok: true,
    value: {
      jobId,
      commitmentType,
      plannedWeekStart,
      plannedStart,
      plannedDurationDays: durationDays,
      plannedFlexDays,
      hardLock,
      force,
      today,
    },
  };
}

export async function runCommitmentMutation(req: Request, eventType: CommitmentEventType) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) return jsonError(parsedBody.error, 400);
  const body = parsedBody.body ?? {};

  const parsed = parseInput(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const input = parsed.value;

  let jobRow: any = null;
  try {
    jobRow = await loadScheduledJobRow(input.jobId);
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load scheduled job', 500);
  }

  if (!jobRow) return jsonError('Scheduled job not found', 404);

  const crewId = String(jobRow.crew_id);

  let ctx;
  try {
    ctx = await loadScheduleContext({ crewId, today: input.today });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load schedule data', 500);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) return jsonError('Crew not found', 404);

  const region = crewCtx.crewRow.calendar_region || 'Auckland';
  const plannedStart = input.commitmentType === 'fixed_date' ? snapToday(input.plannedStart, region, ctx.calendar) : input.plannedStart;
  const actor = (session.user?.email || '').trim() || null;
  const nowIso = new Date().toISOString();

  const jobs = crewCtx.jobs.map((job) => {
    if (job.id !== jobRow.id) return job;
    return {
      ...job,
      mode: input.hardLock ? ('pinned' as const) : ('floating' as const),
      forecastStart: input.hardLock ? plannedStart : job.forecastStart,
      plannedCommitmentType: input.commitmentType,
      plannedWeekStart: input.commitmentType === 'week_of' ? input.plannedWeekStart : null,
      plannedStart,
      plannedDurationDays: input.plannedDurationDays,
      plannedFlexDays: input.plannedFlexDays,
      plannedLockedAt: nowIso,
      plannedLockedBy: actor,
      clientUpdateStatus: 'none' as const,
      clientUpdateNeededAt: null,
      clientUpdateAckAt: null,
      clientUpdateAckBy: null,
    };
  });

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: crewCtx.items,
    jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(jobs),
    today: ctx.today,
    horizonDays: 10,
    region,
    calendar: ctx.calendar,
  });

  if (impacts.length && !input.force) {
    return jsonOk({ requires_confirmation: true, impacts });
  }

  const updatePayload: any = {
    mode: input.hardLock ? 'pinned' : 'floating',
    planned_commitment_type: input.commitmentType,
    planned_week_start: input.commitmentType === 'week_of' ? input.plannedWeekStart : null,
    planned_start: plannedStart,
    planned_duration_days: input.plannedDurationDays,
    planned_flex_days: input.plannedFlexDays,
    planned_locked_at: nowIso,
    planned_locked_by: actor,
    client_update_status: 'none',
    client_update_needed_at: null,
    client_update_ack_at: null,
    client_update_ack_by: null,
  };
  if (input.hardLock) updatePayload.forecast_start = plannedStart;

  const updateRes = await supabaseServer.from('scheduled_jobs').update(updatePayload).eq('id', jobRow.id);
  if (updateRes.error) {
    if (isMissingSchemaError(updateRes.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to update planned commitment', 500);
  }

  await applyJobForecastUpdates(afterRecompute.job_updates);

  try {
    await appendPlannedCommitmentHistory({
      scheduledJobId: String(jobRow.id),
      eventType,
      commitmentType: input.commitmentType,
      plannedWeekStart: input.commitmentType === 'week_of' ? input.plannedWeekStart : null,
      plannedStart,
      plannedDurationDays: input.plannedDurationDays,
      plannedFlexDays: input.plannedFlexDays,
      hardLock: input.hardLock,
      changedBy: actor,
    });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to record commitment history', 500);
  }

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: afterRecompute,
    jobsById: new Map(jobs.map((job) => [job.id, job])),
    downtimesById: crewCtx.downtimesById,
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
  });
}
