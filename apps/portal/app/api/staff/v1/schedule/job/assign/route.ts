import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { isYmd } from '@/lib/scheduling/date';
import { commitAssignJob } from '@/lib/scheduling/scheduleCommands';
import {
  applyScheduleItemPositions,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  durationDaysFromEstimate,
  ensureForecastDurationDays,
  formatCrewScheduleBlocks,
  getLatestSchedulableEstimate,
  insertItemAtPosition,
  isMissingSchemaError,
  loadScheduleContext,
  removeItem,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';
import { isSchedulingReadyProjectStatus } from '@/lib/scheduling/readiness';

export const runtime = 'nodejs';

const ASSIGN_REPAIR_MIGRATION_MESSAGE =
  'Schedule assign repair migration is not applied. Apply supabase/migrations/20260414_000001_schedule_v2_assign_existing_job_repair.sql, then refresh.';

type ForecastUpdate = {
  id: string;
  forecast_start: string | null;
  forecast_end_exclusive: string | null;
  forecast_duration_days: number;
};

type AssignmentKind = 'new_assignment' | 'existing_repair' | 'move';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value.trim());
}

function tempId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function errorMessage(error: unknown): string {
  return typeof (error as { message?: unknown })?.message === 'string' ? ((error as { message?: string }).message ?? '').trim() : '';
}

function isOldAssignRepairRpcError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('p_assignment.job_id is required');
}

function splitNewAssignmentForecast(input: {
  updates: ForecastUpdate[];
  jobRecordId: string;
  hasExistingJob: boolean;
}): {
  targetForecastUpdates: ForecastUpdate[];
  initialForecast: ForecastUpdate | null;
} {
  if (input.hasExistingJob) {
    return {
      targetForecastUpdates: input.updates,
      initialForecast: null,
    };
  }

  const initialForecast = input.updates.find((update) => update.id === input.jobRecordId) ?? null;
  if (!initialForecast) {
    return {
      targetForecastUpdates: input.updates,
      initialForecast: null,
    };
  }

  return {
    targetForecastUpdates: input.updates.filter((update) => update.id !== input.jobRecordId),
    initialForecast,
  };
}

function fallbackExistingJobModel(input: {
  scheduledJobId: string;
  projectId: string;
  crewId: string;
  durationDays: number;
}) {
  return {
    id: input.scheduledJobId,
    jobId: input.projectId,
    crewId: input.crewId,
    mode: 'floating' as const,
    plannedStart: null,
    plannedDurationDays: null,
    forecastStart: null,
    forecastDurationDays: input.durationDays,
    forecastEndExclusive: null,
    actualStart: null,
    actualFinish: null,
    status: 'not_started' as const,
    daysRemaining: null,
  };
}

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/assign');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const crewId = typeof body.crew_id === 'string' ? body.crew_id.trim() : '';
  const positionRaw = body.position;
  const force = Boolean(body.force);
  const requestedPosition = typeof positionRaw === 'number' && Number.isFinite(positionRaw) ? Math.trunc(positionRaw) : null;

  if (!jobId || !crewId) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.assign.validation_failed',
      status: 400,
      message: 'job_id and crew_id are required',
      extra: {
        reason: 'missing_job_or_crew',
        jobId: jobId || null,
        crewId: crewId || null,
        requestedPosition,
      },
    });
    return jsonError('job_id and crew_id are required', 400, diagnostics);
  }

  let existingJob: any = null;
  const existingRes = await supabase.from('scheduled_jobs').select('id, crew_id, forecast_duration_days').eq('job_id', jobId).maybeSingle();
  if (existingRes.error) {
    if (isMissingSchemaError(existingRes.error)) {
      logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: existingRes.error });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load scheduled job', error: existingRes.error });
    return jsonError('Failed to load scheduled job', 500, diagnostics);
  }
  existingJob = existingRes.data ?? null;

  const existingScheduledJobId = existingJob?.id ? String(existingJob.id) : null;
  const existingCrewId = existingJob?.crew_id ? String(existingJob.crew_id) : null;
  const isMove = Boolean(existingJob && existingCrewId && existingCrewId !== crewId);

  let durationDays = ensureForecastDurationDays(existingJob?.forecast_duration_days ?? null, 1);
  if (!existingJob) {
    const projectRes = await supabase.from('projects').select('id, pipeline_stage').eq('id', jobId).maybeSingle();
    if (projectRes.error) {
      if (isMissingSchemaError(projectRes.error)) {
        logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: projectRes.error });
        return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
      }
      logPortalServerError(diagnostics, { status: 500, message: 'Failed to load project', error: projectRes.error });
      return jsonError('Failed to load project', 500, diagnostics);
    }
    if (!projectRes.data) {
      logPortalServerWarn(diagnostics, {
        event: 'schedule.assign.validation_failed',
        status: 404,
        message: 'Project not found',
        extra: { reason: 'project_not_found', jobId, crewId, requestedPosition },
      });
      return jsonError('Project not found', 404, diagnostics);
    }
    if (!isSchedulingReadyProjectStatus(projectRes.data.pipeline_stage)) {
      logPortalServerWarn(diagnostics, {
        event: 'schedule.assign.validation_failed',
        status: 409,
        message: 'Only deposit-stage projects can be scheduled.',
        extra: { reason: 'project_not_scheduling_ready', jobId, crewId, requestedPosition },
      });
      return jsonError('Only deposit-stage projects can be scheduled.', 409, diagnostics);
    }

    const estimatesRes = await supabase
      .from('estimates')
      .select('id, project_id, status, created_at, version, duration_days, crew_hours, inputs, outputs')
      .eq('project_id', jobId);
    if (estimatesRes.error) {
      if (isMissingSchemaError(estimatesRes.error)) {
        logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: estimatesRes.error });
        return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
      }
      logPortalServerError(diagnostics, { status: 500, message: 'Failed to load estimates', error: estimatesRes.error });
      return jsonError('Failed to load estimates', 500, diagnostics);
    }
    const estimates = Array.isArray(estimatesRes.data) ? estimatesRes.data : [];
    const latest = getLatestSchedulableEstimate(estimates as any);
    durationDays = durationDaysFromEstimate(latest as any);
  }

  let ctx;
  try {
    ctx = await loadScheduleContext({ today: typeof body.today === 'string' && isYmd(body.today) ? body.today : undefined });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: err });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load schedule data', error: err });
    return jsonError('Failed to load schedule data', 500, diagnostics);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.assign.validation_failed',
      status: 404,
      message: 'Crew not found',
      extra: { reason: 'crew_not_found', jobId, crewId, scheduledJobId: existingScheduledJobId, requestedPosition },
    });
    return jsonError('Crew not found', 404, diagnostics);
  }

  const existingTargetItem = existingScheduledJobId
    ? crewCtx.items.find((item) => item.itemType === 'job' && item.jobId === existingScheduledJobId) ?? null
    : null;
  if (existingTargetItem && !isMove) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.assign.validation_failed',
      status: 409,
      message: 'Job is already scheduled in this crew. Refresh the board.',
      extra: {
        reason: 'already_scheduled_same_crew',
        jobId,
        crewId,
        scheduledJobId: existingScheduledJobId,
        requestedPosition,
        targetItemPresent: true,
        sourceCrewId: existingCrewId,
        sourceItemPresent: true,
      },
    });
    return jsonError('Job is already scheduled in this crew. Refresh the board.', 409, diagnostics);
  }

  const jobRecordId = existingScheduledJobId ?? tempId('temp_job');
  const existingJobModel = existingScheduledJobId
    ? crewCtx.jobs.find((job) => job.id === existingScheduledJobId) ??
      ctx.jobs.find((job) => job.id === existingScheduledJobId) ??
      fallbackExistingJobModel({ scheduledJobId: existingScheduledJobId, projectId: jobId, crewId: existingCrewId ?? crewId, durationDays })
    : null;
  const newJob = existingJob
    ? existingJobModel
      ? { ...existingJobModel, crewId }
      : null
    : {
        id: jobRecordId,
        jobId,
        crewId,
        mode: 'floating' as const,
        plannedStart: null,
        plannedDurationDays: null,
        forecastStart: null,
        forecastDurationDays: durationDays,
        forecastEndExclusive: null,
        actualStart: null,
        actualFinish: null,
        status: 'not_started' as const,
        daysRemaining: null,
      };

  const jobs =
    newJob && !existingJob
      ? [...crewCtx.jobs, newJob]
      : newJob
        ? crewCtx.jobs.some((job) => job.id === newJob.id)
          ? crewCtx.jobs.map((job) => (job.id === newJob.id ? (newJob as any) : job))
          : [...crewCtx.jobs, newJob]
        : crewCtx.jobs;
  const position = typeof positionRaw === 'number' && Number.isFinite(positionRaw) ? Math.trunc(positionRaw) : crewCtx.items.length;
  const newItem = {
    id: tempId('temp_item'),
    crewId,
    itemType: 'job' as const,
    jobId: jobRecordId,
    downtimeId: null,
    position,
  };
  const items = insertItemAtPosition(crewCtx.items, newItem, position);

  let impacts: any[] = [];
  let afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items,
    jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });
  impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(jobs),
    today: ctx.today,
    horizonDays: 10,
    region: crewCtx.crewRow.calendar_region || 'Auckland',
    calendar: ctx.calendar,
  });

  let sourceCrewId: string | null = null;
  let sourceFormatted: ReturnType<typeof formatCrewScheduleBlocks> | null = null;
  let sourceItemId: string | null = null;
  let sourcePositions: Array<{ id: string; position: number }> = [];
  let sourceForecastUpdates: Array<{ id: string; forecast_start: string | null; forecast_end_exclusive: string | null; forecast_duration_days: number }> = [];
  let repairedMissingSourceItem = false;

  if (isMove && existingScheduledJobId && existingCrewId) {
    const oldCrewId = existingCrewId;
    sourceCrewId = oldCrewId;
    const oldCrewCtx = buildCrewContext(ctx, oldCrewId);
    if (!oldCrewCtx) {
      repairedMissingSourceItem = true;
      logPortalServerWarn(diagnostics, {
        event: 'schedule.assign.consistency_repair',
        status: 200,
        message: 'Repairing scheduled job with missing source crew context',
        extra: {
          reason: 'missing_source_crew_repaired',
          jobId,
          crewId,
          scheduledJobId: existingScheduledJobId,
          sourceCrewId,
          requestedPosition,
          targetItemPresent: Boolean(existingTargetItem),
          sourceItemPresent: false,
        },
      });
    } else {
      sourceItemId = oldCrewCtx.items.find((item) => item.itemType === 'job' && item.jobId === existingScheduledJobId)?.id ?? null;
      if (!sourceItemId) {
        repairedMissingSourceItem = true;
        logPortalServerWarn(diagnostics, {
          event: 'schedule.assign.consistency_repair',
          status: 200,
          message: 'Repairing scheduled job with missing source queue item',
          extra: {
            reason: 'missing_source_queue_item_repaired',
            jobId,
            crewId,
            scheduledJobId: existingScheduledJobId,
            sourceCrewId,
            requestedPosition,
            targetItemPresent: Boolean(existingTargetItem),
            sourceItemPresent: false,
          },
        });
      } else {
        const oldItems = removeItem(oldCrewCtx.items, (item) => item.itemType === 'job' && item.jobId === existingScheduledJobId);
        const oldJobs = oldCrewCtx.jobs.filter((job) => job.id !== existingScheduledJobId);
        const oldAfter = recomputeForCrew({
          crewRow: oldCrewCtx.crewRow,
          items: oldItems,
          jobs: oldJobs,
          downtimes: oldCrewCtx.downtimes,
          calendar: ctx.calendar,
          today: ctx.today,
        });
        const oldImpacts = computeCommitImpacts({
          before: oldCrewCtx.recompute,
          after: oldAfter,
          jobMetaById: buildJobMetaMap(oldCrewCtx.jobs),
          today: ctx.today,
          horizonDays: 10,
          region: oldCrewCtx.crewRow.calendar_region || 'Auckland',
          calendar: ctx.calendar,
        });
        impacts = [...impacts, ...oldImpacts];
        sourcePositions = applyScheduleItemPositions(oldItems);
        sourceForecastUpdates = oldAfter.job_updates;
        sourceFormatted = formatCrewScheduleBlocks({
          crewRow: oldCrewCtx.crewRow,
          recompute: oldAfter,
          jobsById: new Map(oldJobs.map((job) => [job.id, job])),
          downtimesById: oldCrewCtx.downtimesById,
        });
      }
    }
  }

  if (existingJob && !isMove && !existingTargetItem) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.assign.consistency_repair',
      status: 200,
      message: 'Repairing scheduled job with missing target queue item',
      extra: {
        reason: 'missing_target_queue_item_repaired',
        jobId,
        crewId,
        scheduledJobId: existingScheduledJobId,
        sourceCrewId: existingCrewId,
        requestedPosition,
        targetItemPresent: false,
        sourceItemPresent: false,
      },
    });
  }

  if (repairedMissingSourceItem) {
    sourceItemId = null;
    sourcePositions = [];
    sourceForecastUpdates = [];
    sourceFormatted = null;
  }

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const assignmentKind: AssignmentKind = isMove && sourceCrewId && sourceItemId ? 'move' : existingJob ? 'existing_repair' : 'new_assignment';
  const targetForecastCommit = splitNewAssignmentForecast({
    updates: afterRecompute.job_updates,
    jobRecordId,
    hasExistingJob: Boolean(existingJob),
  });
  const targetPositions = applyScheduleItemPositions(items.filter((item) => item.id !== newItem.id));
  const assignCommitDiagnostics = {
    assignmentKind,
    targetRawForecastCount: afterRecompute.job_updates.length,
    targetForecastCount: targetForecastCommit.targetForecastUpdates.length,
    targetForecastNonUuidCount: targetForecastCommit.targetForecastUpdates.filter((update) => !isUuid(update.id)).length,
    sourceForecastCount: sourceForecastUpdates.length,
    sourceForecastNonUuidCount: sourceForecastUpdates.filter((update) => !isUuid(update.id)).length,
    targetPositionCount: targetPositions.length,
    initialForecastPresent: Boolean(targetForecastCommit.initialForecast),
    sanitizedTempForecastPresent: Boolean(targetForecastCommit.initialForecast?.id.startsWith('temp_job_')),
  };

  const commitRes = await commitAssignJob({
    diagnostics,
    targetCrewId: crewId,
    targetInsertPosition: position,
    targetPositions,
    targetForecastUpdates: targetForecastCommit.targetForecastUpdates,
    ...(existingJob
      ? { scheduledJobId: String(existingJob.id) }
      : {
          jobId,
          forecastDurationDays: targetForecastCommit.initialForecast?.forecast_duration_days ?? durationDays,
          initialForecastStart: targetForecastCommit.initialForecast?.forecast_start,
          initialForecastEndExclusive: targetForecastCommit.initialForecast?.forecast_end_exclusive,
        }),
    ...(isMove && sourceCrewId && sourceItemId
      ? {
          move: {
            sourceCrewId,
            sourceJobItemId: sourceItemId,
            sourcePositions,
            sourceForecastUpdates,
          },
        }
      : null),
  });
  if (!commitRes.ok) {
    const usesExistingJobRepairPath = Boolean(existingJob && !(isMove && sourceCrewId && sourceItemId));
    if (usesExistingJobRepairPath && isOldAssignRepairRpcError(commitRes.error)) {
      logPortalServerWarn(diagnostics, {
        event: 'schedule.assign.schema_revision_missing',
        status: 501,
        message: ASSIGN_REPAIR_MIGRATION_MESSAGE,
        error: commitRes.error,
        extra: {
          reason: 'old_assign_repair_rpc_revision',
          ...assignCommitDiagnostics,
          jobId,
          crewId,
          scheduledJobId: existingScheduledJobId,
          sourceCrewId,
          requestedPosition: position,
          targetItemPresent: Boolean(existingTargetItem),
          sourceItemPresent: Boolean(sourceItemId),
        },
      });
      return jsonError(ASSIGN_REPAIR_MIGRATION_MESSAGE, 501, diagnostics);
    }

    const logInput = {
      event: 'schedule.assign.commit_failed',
      status: commitRes.status,
      message: commitRes.responseMessage,
      error: commitRes.error,
      extra: {
        reason: 'commit_failed',
        ...assignCommitDiagnostics,
        jobId,
        crewId,
        scheduledJobId: existingScheduledJobId,
        sourceCrewId,
        requestedPosition: position,
        targetItemPresent: Boolean(existingTargetItem),
        sourceItemPresent: Boolean(sourceItemId),
      },
    };
    if (commitRes.status === 501) {
      logPortalServerWarn(diagnostics, logInput);
    } else {
      logPortalServerError(diagnostics, logInput);
    }
    return jsonError(commitRes.responseMessage, commitRes.status, diagnostics);
  }

  const scheduledJobId = commitRes.data.scheduled_job_id;
  const newScheduleItemId = commitRes.data.schedule_item_id;

  const updatedJobs = jobs.map((job) =>
    job.id === jobRecordId
      ? {
          ...job,
          id: scheduledJobId,
          crewId,
        }
      : job,
  );
  const updatedItems = items.map((item) => {
    if (item.id === newItem.id) {
      return { ...item, id: newScheduleItemId, jobId: scheduledJobId };
    }
    return item.jobId === jobRecordId ? { ...item, jobId: scheduledJobId } : item;
  });
  const finalRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: updatedItems,
    jobs: updatedJobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: finalRecompute,
    jobsById: new Map(updatedJobs.map((job) => [job.id, job])),
    downtimesById: crewCtx.downtimesById,
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
    ...(sourceCrewId && sourceFormatted
      ? {
          source_crew_id: sourceCrewId,
          source_schedule: sourceFormatted,
        }
      : null),
  }, 200, diagnostics);
}
