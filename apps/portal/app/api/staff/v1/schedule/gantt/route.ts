import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { isYmd } from '@/lib/scheduling/date';
import { isScheduleSchemaNotReadyError } from '@/lib/scheduling/scheduleBoardServer';
import { loadScheduleGanttResponse } from '@/lib/scheduling/scheduleGanttServer';
import { logScheduleEndpointTelemetry } from '@/lib/scheduling/scheduleServerTelemetry';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/gantt');
  const session = await requireStaffSession();
  if (!session) {
    const payload = { error: 'Unauthorized' };
    logScheduleEndpointTelemetry(diagnostics, { view: 'gantt', status: 401, payload, meta: { reason: 'unauthorized' } });
    return jsonError(payload.error, 401, diagnostics);
  }

  const url = new URL(req.url);
  const rangeStart = url.searchParams.get('rangeStart') ?? '';
  const rangeEnd = url.searchParams.get('rangeEnd') ?? '';
  const today = url.searchParams.get('today');

  if (!isYmd(rangeStart) || !isYmd(rangeEnd)) {
    const payload = { error: 'rangeStart and rangeEnd are required YYYY-MM-DD values.' };
    logScheduleEndpointTelemetry(diagnostics, { view: 'gantt', status: 400, payload, meta: { reason: 'invalid_range' } });
    return jsonError(payload.error, 400, diagnostics);
  }

  try {
    const gantt = await loadScheduleGanttResponse({
      rangeStart,
      rangeEnd,
      today: today && isYmd(today) ? today : undefined,
    });
    logScheduleEndpointTelemetry(diagnostics, {
      view: 'gantt',
      status: 200,
      payload: gantt,
      meta: { rangeStart, rangeEnd, today: today ?? null },
    });
    return jsonOk(gantt, 200, diagnostics);
  } catch (err) {
    if (isScheduleSchemaNotReadyError(err)) {
      const payload = { error: err.message };
      logScheduleEndpointTelemetry(diagnostics, { view: 'gantt', status: 501, payload, meta: { reason: 'schema_not_ready', rangeStart, rangeEnd } });
      return jsonError(err.message, 501, diagnostics);
    }
    const payload = { error: 'Failed to load schedule data' };
    logScheduleEndpointTelemetry(diagnostics, { view: 'gantt', status: 500, payload, meta: { reason: 'unknown', rangeStart, rangeEnd } });
    return jsonError(payload.error, 500, diagnostics);
  }
}
