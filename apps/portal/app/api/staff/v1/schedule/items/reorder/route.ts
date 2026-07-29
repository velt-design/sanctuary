import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { commitScheduleReorder } from '@/lib/scheduling/scheduleCommands';
import {
  excludeTargetCommitImpacts,
  isCalendarYmd,
  isCanonicalScheduleUuid,
  parseScheduleForce,
} from '@/lib/scheduling/scheduleMutationRequest';
import {
  applyScheduleItemPositions,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  reorderItems,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/items/reorder');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const crewId = typeof body.crew_id === 'string' ? body.crew_id : '';
  const hasOrderedMode = Object.prototype.hasOwnProperty.call(body, 'ordered_item_ids');
  const hasSingleItemMode =
    Object.prototype.hasOwnProperty.call(body, 'item_id') ||
    Object.prototype.hasOwnProperty.call(body, 'new_position');
  if (hasOrderedMode === hasSingleItemMode) {
    return jsonError('Provide exactly one reorder mode: ordered_item_ids or item_id with new_position', 400, diagnostics);
  }

  let orderedIds: string[] | null = null;
  let moveItemId = '';
  const newPositionRaw = body.new_position;
  if (hasOrderedMode) {
    if (
      !Array.isArray(body.ordered_item_ids) ||
      body.ordered_item_ids.length === 0 ||
      body.ordered_item_ids.some((id: unknown) => !isCanonicalScheduleUuid(id)) ||
      new Set(body.ordered_item_ids).size !== body.ordered_item_ids.length
    ) {
      return jsonError('ordered_item_ids must be a non-empty list of unique UUIDs', 400, diagnostics);
    }
    orderedIds = body.ordered_item_ids as string[];
  } else {
    moveItemId = typeof body.item_id === 'string' ? body.item_id : '';
    if (!isCanonicalScheduleUuid(moveItemId)) {
      return jsonError('item_id must be a UUID', 400, diagnostics);
    }
    if (!Number.isSafeInteger(newPositionRaw) || newPositionRaw < 0) {
      return jsonError('new_position must be a non-negative safe integer', 400, diagnostics);
    }
  }
  const parsedForce = parseScheduleForce(body.force);
  if (!parsedForce.ok) return jsonError(parsedForce.error, 400, diagnostics);
  const force = parsedForce.value;

  if (!crewId) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.reorder.validation_failed',
      status: 400,
      message: 'crew_id is required',
      extra: { reason: 'missing_crew_id' },
    });
    return jsonError('crew_id is required', 400, diagnostics);
  }
  if (!isCanonicalScheduleUuid(crewId)) {
    return jsonError('crew_id must be a UUID', 400, diagnostics);
  }
  if (body.today !== undefined && !isCalendarYmd(body.today)) {
    return jsonError('today must be a valid YYYY-MM-DD date', 400, diagnostics);
  }

  let ctx;
  try {
    ctx = await loadScheduleContext({ crewId, today: typeof body.today === 'string' ? body.today : undefined });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      logPortalServerWarn(diagnostics, {
        status: 501,
        message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
        error: err,
      });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load schedule data',
      error: err,
    });
    return jsonError('Failed to load schedule data', 500, diagnostics);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.reorder.validation_failed',
      status: 404,
      message: 'Crew not found',
      extra: { reason: 'crew_not_found', crewId },
    });
    return jsonError('Crew not found', 404, diagnostics);
  }

  if (orderedIds) {
    const currentItemIds = new Set(crewCtx.items.map((item) => item.id));
    const hasExactCrewMembership =
      currentItemIds.size === crewCtx.items.length &&
      orderedIds.length === crewCtx.items.length &&
      orderedIds.every((itemId) => currentItemIds.has(itemId));
    if (!hasExactCrewMembership) {
      logPortalServerWarn(diagnostics, {
        event: 'schedule.reorder.validation_failed',
        status: 409,
        message: 'ordered_item_ids must include every current crew item exactly once',
        extra: {
          reason: 'stale_ordered_item_ids',
          crewId,
          requestedItemCount: orderedIds.length,
          currentItemCount: crewCtx.items.length,
        },
      });
      return jsonError('ordered_item_ids must include every current crew item exactly once', 409, diagnostics);
    }
  }

  const movedItem = hasSingleItemMode
    ? crewCtx.items.find((item) => item.id === moveItemId) ?? null
    : null;

  let nextItems = crewCtx.items.slice();
  if (orderedIds) {
    nextItems = reorderItems(nextItems, orderedIds);
  } else if (moveItemId) {
    const sorted = nextItems.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const idx = sorted.findIndex((item) => item.id === moveItemId);
    if (idx === -1) {
      logPortalServerWarn(diagnostics, {
        event: 'schedule.reorder.validation_failed',
        status: 404,
        message: 'item_id not found in crew schedule',
        extra: { reason: 'item_not_found', crewId, itemId: moveItemId },
      });
      return jsonError('item_id not found in crew schedule', 404, diagnostics);
    }
    const [moving] = sorted.splice(idx, 1);
    const newPosition = newPositionRaw as number;
    const insertAt = Math.max(0, Math.min(newPosition, sorted.length));
    sorted.splice(insertAt, 0, moving);
    nextItems = sorted.map((item, index) => ({ ...item, position: index }));
  } else {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.reorder.validation_failed',
      status: 400,
      message: 'ordered_item_ids or item_id is required',
      extra: { reason: 'missing_reorder_payload', crewId },
    });
    return jsonError('ordered_item_ids or item_id is required', 400, diagnostics);
  }

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: nextItems,
    jobs: crewCtx.jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const computedImpacts = computeCommitImpacts({
      before: crewCtx.recompute,
      after: afterRecompute,
      jobMetaById: buildJobMetaMap(crewCtx.jobs),
      today: ctx.today,
      horizonDays: 10,
      region: crewCtx.crewRow.calendar_region || 'Auckland',
      calendar: ctx.calendar,
    });
  const impacts = hasSingleItemMode
    ? excludeTargetCommitImpacts(computedImpacts, {
        scheduledJobId: movedItem?.itemType === 'job' ? movedItem.jobId : null,
      })
    : computedImpacts;

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const commitRes = await commitScheduleReorder({
    diagnostics,
    crewId,
    positions: applyScheduleItemPositions(nextItems),
    forecastUpdates: afterRecompute.job_updates,
  });
  if (!commitRes.ok) {
    logPortalServerWarn(diagnostics, {
      event: 'schedule.reorder.commit_failed',
      status: commitRes.status,
      message: commitRes.responseMessage,
      error: commitRes.error,
      extra: {
        crewId,
        positionCount: nextItems.length,
        forecastUpdateCount: afterRecompute.job_updates.length,
      },
    });
    return jsonError(commitRes.responseMessage, commitRes.status, diagnostics);
  }

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: afterRecompute,
    jobsById: crewCtx.jobsById,
    downtimesById: crewCtx.downtimesById,
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
  }, 200, diagnostics);
}
