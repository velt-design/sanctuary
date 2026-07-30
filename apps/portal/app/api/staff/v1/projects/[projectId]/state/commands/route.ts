import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import {
  recentMarketingConversionOccurrence,
  recordMarketingConversionEvent,
} from '@/lib/marketingAttribution/server';
import { runProjectOperationalStateCommand } from '@/lib/projects/workItems/commands';
import { getAuthoritativeProjectWorkProjection } from '@/lib/projects/workItems/getAuthoritativeProjectWorkProjection';
import {
  privateNoStore,
  workDatabaseError,
  workJsonError,
  workJsonOk,
} from '@/lib/projects/workItems/routeSupport';
import {
  PROJECT_CLOSED_OUTCOMES,
  PROJECT_LOST_OUTCOMES,
} from '@/lib/projects/workItems/types';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const COMMANDS = new Set(['ACTIVATE', 'WAIT', 'CLOSE', 'REOPEN']);
const CLOSED_OUTCOMES = new Set<string>(PROJECT_CLOSED_OUTCOMES);
const LOST_OUTCOMES = new Set<string>(PROJECT_LOST_OUTCOMES);

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximum ? trimmed : null;
}

function instant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

async function loadStateEventOccurrence(
  supabase: Parameters<typeof runProjectOperationalStateCommand>[0],
  projectId: string,
  commandId: string,
): Promise<string | null> {
  const result = await supabase
    .from('project_state_events')
    .select('occurred_at')
    .eq('project_id', projectId)
    .eq('command_id', commandId)
    .eq('event_sequence', 0)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return instant(result.data.occurred_at);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/staff/v1/projects/[projectId]/state/commands',
  );
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return workJsonError(parsed.error, 400, diagnostics, 'INVALID_JSON');
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const command = typeof body.command === 'string' ? body.command.trim().toUpperCase() : '';
  const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : '';
  const expectedRowVersion = Number.isInteger(body.expectedRowVersion) && Number(body.expectedRowVersion) > 0
    ? Number(body.expectedRowVersion)
    : null;
  if (!COMMANDS.has(command) || !isUuid(commandId) || !expectedRowVersion) {
    return workJsonError('Invalid project-state command', 400, diagnostics, 'INVALID_COMMAND');
  }
  const payload: Record<string, unknown> = { expectedRowVersion };
  if (command === 'WAIT') {
    const waitingUntil = instant(body.waitingUntil);
    const reason = boundedText(body.reason, 500);
    if (!waitingUntil || !reason) {
      return workJsonError('Waiting date and reason are required', 400, diagnostics, 'INVALID_COMMAND');
    }
    Object.assign(payload, { waitingUntil, reason });
  }
  if (command === 'CLOSE') {
    const outcome = typeof body.outcome === 'string' && CLOSED_OUTCOMES.has(body.outcome)
      ? body.outcome
      : null;
    if (!outcome) {
      return workJsonError('A valid close outcome is required', 400, diagnostics, 'INVALID_COMMAND');
    }
    Object.assign(payload, {
      outcome,
      note: boundedText(body.note, 1000),
    });
  }
  const cancellationReason = boundedText(body.cancellationReason, 500);
  if ((command === 'WAIT' || command === 'CLOSE') && !cancellationReason) {
    return workJsonError(
      'A reason is required to cancel remaining project work',
      400,
      diagnostics,
      'REASON_REQUIRED',
    );
  }
  if (cancellationReason) payload.cancellationReason = cancellationReason;
  const reason = boundedText(body.reason, 500);
  if (reason) payload.reason = reason;

  const { projectId } = await context.params;
  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return workJsonError('Invalid projectId', 400, diagnostics, 'INVALID_PROJECT');
  }

  try {
    const result = await runProjectOperationalStateCommand(auth.supabase, {
      projectId: projectUuid,
      commandId,
      command,
      payload,
    });
    if (
      command === 'CLOSE'
      && typeof payload.outcome === 'string'
      && LOST_OUTCOMES.has(payload.outcome)
    ) {
      const occurredAt = await loadStateEventOccurrence(
        auth.supabase,
        projectUuid,
        commandId,
      );
      if (
        !result.replayed
        || recentMarketingConversionOccurrence(occurredAt)
      ) {
        await recordMarketingConversionEvent({
          type: 'marketing.project_lost',
          projectId: projectUuid,
          occurredAt,
          payload: { outcome: payload.outcome },
        });
      }
    }
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
        message: 'Project-state command committed but refresh failed',
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
        message: 'Project-state command failed',
        error,
      });
    }
    return workJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
