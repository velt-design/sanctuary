import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { isScheduleBoardBuildError, isScheduleSchemaNotReadyError, loadScheduleBoardResponse } from '@/lib/scheduling/scheduleBoardServer';
import { logScheduleEndpointTelemetry } from '@/lib/scheduling/scheduleServerTelemetry';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/board');
  const session = await requireStaffSession();
  if (!session) {
    const payload = { error: 'Unauthorized' };
    logScheduleEndpointTelemetry(diagnostics, { view: 'board', status: 401, payload, meta: { reason: 'unauthorized' } });
    return jsonError(payload.error, 401, diagnostics);
  }

  const url = new URL(req.url);
  try {
    const board = await loadScheduleBoardResponse({ today: url.searchParams.get('today') ?? undefined, diagnostics });
    logScheduleEndpointTelemetry(diagnostics, {
      view: 'board',
      status: 200,
      payload: board,
      meta: { today: url.searchParams.get('today') ?? null },
    });
    return jsonOk(board, 200, diagnostics);
  } catch (error) {
    if (isScheduleSchemaNotReadyError(error)) {
      const payload = { error: error.message };
      logScheduleEndpointTelemetry(diagnostics, { view: 'board', status: 501, payload, meta: { reason: 'schema_not_ready' } });
      return jsonError(error.message, 501, diagnostics);
    }
    if (isScheduleBoardBuildError(error)) {
      const payload = { error: error.message };
      logScheduleEndpointTelemetry(diagnostics, { view: 'board', status: 500, payload, meta: { reason: error.phase } });
      return jsonError(error.message, 500, diagnostics);
    }
    const payload = { error: 'Failed to load schedule data' };
    logScheduleEndpointTelemetry(diagnostics, { view: 'board', status: 500, payload, meta: { reason: 'unknown' } });
    return jsonError(payload.error, 500, diagnostics);
  }
}
