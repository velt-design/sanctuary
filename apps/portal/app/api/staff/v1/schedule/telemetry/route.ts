import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { logScheduleClientTelemetry } from '@/lib/scheduling/scheduleServerTelemetry';
import { estimateJsonPayloadBytes, sanitizeScheduleClientTelemetryEvent, SCHEDULE_CLIENT_TELEMETRY_MAX_BYTES } from '@/lib/scheduling/scheduleTelemetry';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/telemetry', 'POST');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  if (estimateJsonPayloadBytes(parsed.body) > SCHEDULE_CLIENT_TELEMETRY_MAX_BYTES * 4) {
    return jsonError('Telemetry payload is too large.', 413, diagnostics);
  }

  const event = sanitizeScheduleClientTelemetryEvent(parsed.body);
  if (!event) return jsonError('Invalid telemetry event.', 400, diagnostics);

  logScheduleClientTelemetry(diagnostics, event);
  return jsonOk({ ok: true }, 200, diagnostics);
}
