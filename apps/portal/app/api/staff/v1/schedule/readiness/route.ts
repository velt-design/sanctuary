import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { REQUIRED_SCHEDULE_RPC_FUNCTIONS, verifyScheduleReadiness } from '@/lib/scheduling/scheduleReadiness';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/readiness');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  try {
    const readiness = await verifyScheduleReadiness(diagnostics);
    if (!readiness.ok) {
      const message =
        readiness.missingFunctions.length > 0
          ? `Schedule schema is not upgraded yet. Missing required functions: ${readiness.missingFunctions.join(', ')}. Run latest schedule migrations then refresh.`
          : readiness.message ?? 'Schedule schema/read model is not upgraded yet. Run latest schedule migrations then refresh.';

      logPortalServerWarn(diagnostics, {
        status: 501,
        message,
        extra: {
          missingFunctions: readiness.missingFunctions,
          readinessChecks: readiness.readinessChecks,
        },
      });

      return jsonError(message, 501, diagnostics);
    }

    return jsonOk(
      {
        ok: true,
        checked_at: new Date().toISOString(),
        required_functions: [...REQUIRED_SCHEDULE_RPC_FUNCTIONS],
      },
      200,
      diagnostics,
    );
  } catch (error) {
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to verify schedule readiness',
      error,
    });
    return jsonError('Failed to verify schedule readiness', 500, diagnostics);
  }
}
