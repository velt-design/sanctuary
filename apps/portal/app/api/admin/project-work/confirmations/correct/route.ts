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
import { runConfirmationCorrection } from '@/lib/projects/workItems/confirmationCorrections/commands';
import { projectWorkCorrectionDatabaseError } from '@/lib/projects/workItems/confirmationCorrections/errors';
import { parseConfirmationCorrectionBody } from '@/lib/projects/workItems/confirmationCorrections/validation';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/admin/project-work/confirmations/correct',
  );
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = parseConfirmationCorrectionBody(body.body);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);

  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(parsed.value.projectId, 'proj');
  } catch {
    return jsonError('Invalid project id.', 400, diagnostics);
  }

  try {
    const result = await runConfirmationCorrection(auth.supabase, {
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
    const mapped = projectWorkCorrectionDatabaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: mapped.status,
        message: 'Failed to correct a project confirmation',
        error,
      });
    }
    return jsonError(mapped.message, mapped.status, diagnostics);
  }
}
