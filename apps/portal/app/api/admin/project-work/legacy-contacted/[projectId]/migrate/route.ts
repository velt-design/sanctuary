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
import { runLegacyContactedMigration } from '@/lib/projects/workItems/legacyTriage/commands';
import { legacyTriageDatabaseError } from '@/lib/projects/workItems/legacyTriage/errors';
import { parseLegacyContactedMigrationBody } from '@/lib/projects/workItems/legacyTriage/validation';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/admin/project-work/legacy-contacted/[projectId]/migrate',
  );
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;

  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId((await ctx.params).projectId, 'proj');
  } catch {
    return jsonError('Invalid project id.', 400, diagnostics);
  }

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = parseLegacyContactedMigrationBody(body.body);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);

  try {
    const result = await runLegacyContactedMigration(auth.supabase, {
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
        message: 'Failed to migrate a reviewed Contacted project',
        error,
      });
    }
    return jsonError(mapped.message, mapped.status, diagnostics);
  }
}
