import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { runProjectConfirmationCommand } from '@/lib/projects/workItems/commands';
import { getAuthoritativeProjectWorkProjection } from '@/lib/projects/workItems/getAuthoritativeProjectWorkProjection';
import {
  privateNoStore,
  workDatabaseError,
  workJsonError,
  workJsonOk,
} from '@/lib/projects/workItems/routeSupport';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const COMMANDS = new Set([
  'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
  'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT',
  'RECORD_ENQUIRY_CUSTOMER_REPLY',
  'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
  'RECORD_QUOTE_CUSTOMER_REPLY',
  'RECORD_SITE_VISIT_COMPLETED',
]);
const QUOTE_COMMANDS = new Set([
  'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
  'RECORD_QUOTE_CUSTOMER_REPLY',
]);

function instant(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/staff/v1/projects/[projectId]/confirmations/commands',
  );
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return workJsonError(parsed.error, 400, diagnostics, 'INVALID_JSON');
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const command = typeof body.command === 'string' ? body.command.trim().toUpperCase() : '';
  const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : '';
  if (!COMMANDS.has(command) || !isUuid(commandId)) {
    return workJsonError('Invalid confirmation command', 400, diagnostics, 'INVALID_COMMAND');
  }
  const occurredAt = instant(body.occurredAt);
  if (body.occurredAt != null && !occurredAt) {
    return workJsonError('Invalid occurrence time', 400, diagnostics, 'INVALID_COMMAND');
  }
  const subjectId = typeof body.subjectId === 'string' && isUuid(body.subjectId)
    ? body.subjectId
    : null;
  if (QUOTE_COMMANDS.has(command) && !subjectId) {
    return workJsonError('Quote version is required', 400, diagnostics, 'INVALID_COMMAND');
  }

  const { projectId } = await context.params;
  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return workJsonError('Invalid projectId', 400, diagnostics, 'INVALID_PROJECT');
  }
  const payload: Record<string, unknown> = {
    occurredAt: occurredAt ?? new Date().toISOString(),
    ...(subjectId ? { subjectKind: 'QUOTE_VERSION', subjectId } : {}),
  };

  try {
    const result = await runProjectConfirmationCommand(auth.supabase, {
      projectId: projectUuid,
      commandId,
      command,
      payload,
    });
    try {
      const projectWork = await getAuthoritativeProjectWorkProjection(projectId, auth.supabase);
      return workJsonOk({
        command: {
          id: commandId,
          committed: true,
          replayed: result.replayed,
          rowVersion: result.rowVersion,
        },
        ...(projectWork ? { projectWork } : { refreshRequired: true }),
      }, diagnostics);
    } catch (refreshError) {
      logPortalServerError(diagnostics, {
        status: 200,
        message: 'Confirmation committed but refresh failed',
        error: refreshError,
      });
      return workJsonOk({
        command: {
          id: commandId,
          committed: true,
          replayed: result.replayed,
          rowVersion: result.rowVersion,
        },
        refreshRequired: true,
      }, diagnostics);
    }
  } catch (error) {
    const mapped = workDatabaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: 'Confirmation command failed',
        error,
      });
    }
    return workJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
