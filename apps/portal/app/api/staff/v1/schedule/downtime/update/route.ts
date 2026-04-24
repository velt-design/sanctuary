import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { isYmd } from '@/lib/scheduling/date';
import { commitUpdateDowntime } from '@/lib/scheduling/scheduleCommands';
import {
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

function normalizeReason(value: unknown): string | null {
  if (value == null) return null;
  const allowed = new Set(['weather', 'materials', 'site', 'staff', 'travel', 'other']);
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.has(v) ? v : 'other';
}

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/downtime/update');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const downtimeId = typeof body.downtime_id === 'string' ? body.downtime_id.trim() : '';
  const durationRaw = body.duration_days;
  const reason = normalizeReason(body.reason);
  const note = typeof body.note === 'string' ? body.note.trim() : null;
  const force = Boolean(body.force);

  if (!downtimeId) return jsonError('downtime_id is required', 400, diagnostics);

  const downtimeRes = await supabase.from('crew_downtimes').select('*').eq('id', downtimeId).maybeSingle();
  if (downtimeRes.error) {
    if (isMissingSchemaError(downtimeRes.error)) {
      logPortalServerWarn(diagnostics, {
        status: 501,
        message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
        error: downtimeRes.error,
      });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load downtime',
      error: downtimeRes.error,
    });
    return jsonError('Failed to load downtime', 500, diagnostics);
  }
  const downtimeRow = downtimeRes.data;
  if (!downtimeRow) return jsonError('Downtime not found', 404, diagnostics);

  const crewId = String(downtimeRow.crew_id);

  let ctx;
  try {
    ctx = await loadScheduleContext({ crewId, today: typeof body.today === 'string' && isYmd(body.today) ? body.today : undefined });
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
  if (!crewCtx) return jsonError('Crew not found', 404, diagnostics);

  const durationDays = typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? Math.max(1, Math.trunc(durationRaw)) : crewCtx.downtimesById.get(downtimeId)?.durationDays ?? 1;

  const downtimes = crewCtx.downtimes.map((dt) =>
    dt.id === downtimeId
      ? {
          ...dt,
          durationDays,
          reason: reason ?? dt.reason,
          note: note ?? dt.note,
        }
      : dt,
  );

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: crewCtx.items,
    jobs: crewCtx.jobs,
    downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(crewCtx.jobs),
    today: ctx.today,
    horizonDays: 10,
    region: crewCtx.crewRow.calendar_region || 'Auckland',
    calendar: ctx.calendar,
  });

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const patch: {
    duration_days: number;
    reason?: string;
    note?: string;
  } = { duration_days: durationDays };
  if (reason != null) patch.reason = reason;
  if (note != null) patch.note = note;

  const commitRes = await commitUpdateDowntime({
    diagnostics,
    downtimeId,
    patch,
    forecastUpdates: afterRecompute.job_updates,
  });
  if (!commitRes.ok) return jsonError(commitRes.responseMessage, commitRes.status, diagnostics);

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: afterRecompute,
    jobsById: crewCtx.jobsById,
    downtimesById: new Map(downtimes.map((dt) => [dt.id, dt])),
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
  }, 200, diagnostics);
}
