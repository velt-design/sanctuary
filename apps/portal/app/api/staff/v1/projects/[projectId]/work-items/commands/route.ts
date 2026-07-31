import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { runProjectWorkItemCommand } from '@/lib/projects/workItems/commands';
import { getAuthoritativeProjectWorkProjection } from '@/lib/projects/workItems/getAuthoritativeProjectWorkProjection';
import {
  privateNoStore,
  workDatabaseError,
  workJsonError,
  workJsonOk,
} from '@/lib/projects/workItems/routeSupport';
import {
  PROJECT_WORK_RESPONSIBILITY_AREAS,
  type ProjectWorkResponsibilityArea,
} from '@/lib/projects/workItems/types';
import { hasProhibitedProjectWorkText } from '@/lib/projects/workItems/prohibitedWork';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const COMMANDS = new Set([
  'CREATE',
  'COMPLETE',
  'CANCEL',
  'RESCHEDULE',
  'REASSIGN',
  'BLOCK',
  'UNBLOCK',
  'SET_CRITICAL',
  'REOPEN',
  'REPLACE_REVIEW',
]);
const RESPONSIBILITY_AREAS = new Set<string>(PROJECT_WORK_RESPONSIBILITY_AREAS);

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

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function buildPayload(
  body: Record<string, unknown>,
  command: string,
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  const payload: Record<string, unknown> = {};
  if (command !== 'CREATE') {
    const workItemId = typeof body.workItemId === 'string' && isUuid(body.workItemId)
      ? body.workItemId
      : null;
    const expectedRowVersion = positiveInteger(body.expectedRowVersion);
    if (!workItemId || !expectedRowVersion) {
      return { ok: false, message: 'Work item and current row version are required' };
    }
    Object.assign(payload, { workItemId, expectedRowVersion });
  }

  if (command === 'CREATE' || command === 'REPLACE_REVIEW') {
    const title = boundedText(body.title, 160);
    const responsibilityArea = typeof body.responsibilityArea === 'string'
      && RESPONSIBILITY_AREAS.has(body.responsibilityArea)
      ? body.responsibilityArea as ProjectWorkResponsibilityArea
      : null;
    const dueAt = instant(body.dueAt);
    if (!title || !responsibilityArea || !dueAt) {
      return { ok: false, message: 'Title, responsibility area, and valid due time are required' };
    }
    if (hasProhibitedProjectWorkText(title)) {
      return {
        ok: false,
        message: 'Call and Site Visit work cannot be created in Project Work',
      };
    }
    const assigneeUserId = body.assigneeUserId == null
      ? null
      : typeof body.assigneeUserId === 'string' && isUuid(body.assigneeUserId)
        ? body.assigneeUserId
        : undefined;
    if (assigneeUserId === undefined) return { ok: false, message: 'Invalid assignee' };
    Object.assign(payload, {
      title,
      responsibilityArea,
      dueAt,
      assigneeUserId,
      priority: body.priority === 'CRITICAL' ? 'CRITICAL' : 'NORMAL',
      priorityReason: boundedText(body.priorityReason, 500),
    });
    if (payload.priority === 'CRITICAL' && !payload.priorityReason) {
      return { ok: false, message: 'A reason is required for Critical work' };
    }
  }
  if (command === 'REPLACE_REVIEW') {
    const reason = boundedText(body.reason, 500);
    if (!reason) return { ok: false, message: 'A reason is required to replace a decision review' };
    payload.reason = reason;
  }
  if (command === 'COMPLETE') payload.outcome = boundedText(body.outcome, 1000);
  if (command === 'CANCEL') {
    const reason = boundedText(body.reason, 500);
    if (!reason) return { ok: false, message: 'A cancellation reason is required' };
    payload.reason = reason;
  }
  if (command === 'RESCHEDULE') {
    const dueAt = instant(body.dueAt);
    if (!dueAt) return { ok: false, message: 'A valid due time is required' };
    Object.assign(payload, { dueAt, reason: boundedText(body.reason, 500) });
  }
  if (command === 'REASSIGN') {
    if (body.assigneeUserId != null && (typeof body.assigneeUserId !== 'string' || !isUuid(body.assigneeUserId))) {
      return { ok: false, message: 'Invalid assignee' };
    }
    payload.assigneeUserId = body.assigneeUserId ?? null;
  }
  if (command === 'BLOCK') {
    const reason = boundedText(body.reason, 500);
    if (!reason) return { ok: false, message: 'A blocked reason is required' };
    payload.reason = reason;
  }
  if (command === 'SET_CRITICAL') {
    if (typeof body.critical !== 'boolean') return { ok: false, message: 'Critical state is required' };
    const reason = boundedText(body.reason, 500);
    if (!reason) return { ok: false, message: 'A reason is required when changing Critical work' };
    Object.assign(payload, { critical: body.critical, reason });
  }
  if (command === 'REOPEN') {
    const reason = boundedText(body.reason, 500);
    if (!reason) return { ok: false, message: 'A reopen reason is required' };
    Object.assign(payload, { reason, dueAt: instant(body.dueAt) });
  }
  return { ok: true, payload };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/staff/v1/projects/[projectId]/work-items/commands',
  );
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return workJsonError(parsed.error, 400, diagnostics, 'INVALID_JSON');
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const command = typeof body.command === 'string' ? body.command.trim().toUpperCase() : '';
  const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : '';
  if (!COMMANDS.has(command) || !isUuid(commandId)) {
    return workJsonError('Invalid work-item command', 400, diagnostics, 'INVALID_COMMAND');
  }
  const built = buildPayload(body, command);
  if (!built.ok) return workJsonError(built.message, 400, diagnostics, 'INVALID_COMMAND');

  const { projectId } = await context.params;
  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return workJsonError('Invalid projectId', 400, diagnostics, 'INVALID_PROJECT');
  }

  try {
    const result = await runProjectWorkItemCommand(auth.supabase, {
      projectId: projectUuid,
      commandId,
      command,
      payload: built.payload,
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
        message: 'Work-item command committed but refresh failed',
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
        message: 'Work-item command failed',
        error,
      });
    }
    return workJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
