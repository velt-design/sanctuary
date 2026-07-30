import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireAdminContext,
} from '@/lib/api/adminApi';
import {
  createRouteDiagnostics,
  logPortalServerError,
} from '@/lib/api/routeDiagnostics';
import { runConfirmationCorrectionReview } from '@/lib/projects/workItems/legacyTriage/commands';
import { legacyTriageDatabaseError } from '@/lib/projects/workItems/legacyTriage/errors';
import { parseConfirmationCorrectionReviewBody } from '@/lib/projects/workItems/legacyTriage/validation';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/admin/project-work/confirmations/reconcile',
  );
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = parseConfirmationCorrectionReviewBody(body.body);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);

  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(parsed.value.projectId, 'proj');
  } catch {
    return jsonError('Invalid project id.', 400, diagnostics);
  }

  try {
    const result = await runConfirmationCorrectionReview(auth.supabase, {
      ...parsed.value,
      projectUuid,
    });
    return jsonOk({
      command: {
        id: parsed.value.commandId,
        committed: true as const,
        replayed: result.replayed,
      },
      result,
    }, 200, diagnostics);
  } catch (error) {
    const mapped = legacyTriageDatabaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: mapped.status,
        message: 'Failed to finish a confirmation correction review',
        error,
      });
    }
    return jsonError(mapped.message, mapped.status, diagnostics);
  }
}
