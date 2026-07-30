import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { portalDueDateToIso } from '@/lib/projects/commandCentre/actionResolver';
import { getProjectCommandCentre } from '@/lib/projects/commandCentre/getProjectCommandCentre';
import {
  commandDatabaseError,
  commandJsonError,
  commandJsonOk,
  privateNoStore,
} from '@/lib/projects/commandCentre/routeSupport';
import type { ProjectCommandActionSummary } from '@/lib/projects/commandCentre/types';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const COMMANDS = new Set(['create_manual', 'select', 'complete', 'reschedule', 'reassign', 'set_critical', 'resolve_conflict']);
const CATEGORIES = new Set(['Call', 'Site visit', 'Design', 'Estimate', 'Quote', 'Follow-up', 'Other']);

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function findCandidate(candidates: ProjectCommandActionSummary[], sourceKind: unknown, sourceId: unknown) {
  return candidates.find((candidate) => candidate.sourceKind === sourceKind && candidate.sourceId === sourceId) ?? null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function replayIntent(body: Record<string, unknown>, command: string): Record<string, unknown> {
  const intent: Record<string, unknown> = {
    sourceKind: typeof body.sourceKind === 'string' ? body.sourceKind : null,
    sourceId: typeof body.sourceId === 'string' && isUuid(body.sourceId) ? body.sourceId : null,
  };
  if (command === 'create_manual') Object.assign(intent, {
    title: text(body.title, 160),
    category: typeof body.category === 'string' && CATEGORIES.has(body.category) ? body.category : null,
    dueAt: portalDueDateToIso(typeof body.dueDate === 'string' ? body.dueDate : ''),
    ownerUserId: body.ownerUserId ?? null,
  });
  if (command === 'select') {
    const dueAt = portalDueDateToIso(typeof body.dueDate === 'string' ? body.dueDate : '');
    if (dueAt) intent.dueAt = dueAt;
  }
  if (command === 'reschedule') Object.assign(intent, {
    dueAt: portalDueDateToIso(typeof body.dueDate === 'string' ? body.dueDate : ''),
    reason: text(body.reason, 500),
  });
  if (command === 'reassign') intent.ownerUserId = body.ownerUserId ?? null;
  if (command === 'complete') intent.outcome = text(body.outcome, 1000);
  if (command === 'set_critical') Object.assign(intent, { critical: body.critical, reason: text(body.reason, 500) });
  if (command === 'resolve_conflict') intent.resolution = body.resolution;
  return intent;
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/projects/[projectId]/command-centre/primary-action/commands');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return commandJsonError(parsed.error, 400, diagnostics, 'INVALID_JSON');
  const body = parsed.body ?? {};
  const command = typeof body.command === 'string' ? body.command.trim() : '';
  const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : '';
  if (!COMMANDS.has(command) || !isUuid(commandId)) return commandJsonError('Invalid action command', 400, diagnostics, 'INVALID_COMMAND');
  const { projectId } = await ctx.params;
  let projectUuid: string;
  try { projectUuid = uuidFromAppId(projectId, 'proj'); } catch { return commandJsonError('Invalid projectId', 400, diagnostics, 'INVALID_PROJECT'); }

  try {
    const replayResult = await auth.supabase
      .from('project_command_audit')
      .select('project_id,event_type,after_state')
      .eq('command_id', commandId)
      .limit(1);
    if (replayResult.error) throw replayResult.error;
    const replayRow = Array.isArray(replayResult.data) ? replayResult.data[0] as {
      project_id?: unknown;
      event_type?: unknown;
      after_state?: { intent?: unknown } | null;
    } : null;
    if (replayRow) {
      const expectedIntent = replayIntent(body, command);
      if (replayRow.project_id !== projectUuid
          || replayRow.event_type !== `primary_action_${command}`
          || stableJson(replayRow.after_state?.intent) !== stableJson(expectedIntent)) {
        return commandJsonError('Command ID was already used for a different command', 400, diagnostics, 'COMMAND_ID_CONFLICT');
      }
      try {
        const commandCentre = await getProjectCommandCentre(projectId, auth.supabase, {
          userId: auth.session.user.id,
          isAdmin: auth.session.role === 'admin',
        });
        if (!commandCentre) return commandJsonError('Project not found', 404, diagnostics, 'NOT_FOUND');
        return commandJsonOk({
          command: { id: commandId, committed: true, replayed: true },
          commandCentre,
        }, diagnostics);
      } catch (refreshError) {
        logPortalServerError(diagnostics, { status: 200, message: 'Action replay confirmed but refresh failed', error: refreshError });
        return commandJsonOk({ command: { id: commandId, committed: true, replayed: true }, refreshRequired: true }, diagnostics);
      }
    }
  } catch (error) {
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to validate command idempotency', error });
    return commandJsonError('Failed to validate action command', 500, diagnostics, 'COMMAND_STATE_FAILED');
  }

  let before;
  try {
    before = await getProjectCommandCentre(projectId, auth.supabase, {
      userId: auth.session.user.id,
      isAdmin: auth.session.role === 'admin',
    });
  } catch (error) {
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to validate action command', error });
    return commandJsonError('Failed to validate current action', 500, diagnostics, 'COMMAND_STATE_FAILED');
  }
  if (!before) return commandJsonError('Project not found', 404, diagnostics, 'NOT_FOUND');
  if (before.workModel !== 'legacy') {
    return commandJsonError(
      'This project uses the V2 work-item commands',
      409,
      diagnostics,
      'LEGACY_COMMAND_DISABLED',
    );
  }
  if (before.operations.selectionConflict
      && command !== 'complete'
      && !(auth.session.role === 'admin' && command === 'resolve_conflict')) {
    return commandJsonError('The primary-action conflict must be resolved first', 409, diagnostics, 'ACTION_CONFLICT');
  }

  const sourceKind = typeof body.sourceKind === 'string' ? body.sourceKind : null;
  const sourceId = typeof body.sourceId === 'string' && isUuid(body.sourceId) ? body.sourceId : null;
  const expectedCandidateRevision = typeof body.expectedCandidateRevision === 'string' ? body.expectedCandidateRevision : '';
  if (!expectedCandidateRevision) {
    return commandJsonError('Candidate version is required', 400, diagnostics, 'VERSION_REQUIRED');
  }
  if (expectedCandidateRevision !== before.operations.candidateRevision) {
    return commandJsonError('Available project actions changed', 409, diagnostics, 'STALE_STATE');
  }
  const current = before.operations.primaryAction;
  const candidate = sourceKind && sourceId
    ? current && current.sourceKind === sourceKind && current.sourceId === sourceId
      ? current
      : findCandidate(before.operations.candidates, sourceKind, sourceId)
    : null;
  if (command !== 'create_manual') {
    if (!candidate) return commandJsonError('Open action not found', 404, diagnostics, 'ACTION_NOT_FOUND');
    if (typeof body.expectedUpdatedAt !== 'string') {
      return commandJsonError('Action version is required', 400, diagnostics, 'VERSION_REQUIRED');
    }
    if (body.expectedUpdatedAt !== candidate.updatedAt) {
      return commandJsonError('Project action changed', 409, diagnostics, 'STALE_STATE');
    }
    if (['complete', 'reschedule', 'reassign', 'set_critical'].includes(command)
        && (!current || current.sourceKind !== sourceKind || current.sourceId !== sourceId)) {
      return commandJsonError('Command must target the current primary action', 409, diagnostics, 'STALE_STATE');
    }
  }

  const rpcPayload: Record<string, unknown> = {
    sourceKind,
    sourceId,
    expectedUpdatedAt: candidate?.updatedAt ?? null,
    candidateRevision: before.operations.candidateRevision,
    confirmedOutrankingHash: candidate?.selectionBaselineHash ?? before.operations.manualSelectionBaselineHash,
  };
  if (command === 'create_manual') {
    const title = text(body.title, 160);
    const category = typeof body.category === 'string' && CATEGORIES.has(body.category) ? body.category : null;
    const dueAt = portalDueDateToIso(typeof body.dueDate === 'string' ? body.dueDate : '');
    if (!title || !category || !dueAt) return commandJsonError('Title, category, and valid due date are required', 400, diagnostics, 'INVALID_COMMAND');
    if (body.ownerUserId != null && (typeof body.ownerUserId !== 'string' || !isUuid(body.ownerUserId))) {
      return commandJsonError('Invalid action owner', 400, diagnostics, 'INVALID_OWNER');
    }
    Object.assign(rpcPayload, { title, category, dueAt, ownerUserId: body.ownerUserId ?? null });
  }
  if (command === 'select' && candidate?.requiresDueDate) {
    const dueAt = portalDueDateToIso(typeof body.dueDate === 'string' ? body.dueDate : '');
    if (!dueAt) return commandJsonError('A due date is required before selecting this action', 400, diagnostics, 'DUE_DATE_REQUIRED');
    rpcPayload.dueAt = dueAt;
  }
  if (command === 'reschedule') {
    const dueAt = portalDueDateToIso(typeof body.dueDate === 'string' ? body.dueDate : '');
    if (!dueAt) return commandJsonError('A valid due date is required', 400, diagnostics, 'INVALID_DUE_DATE');
    rpcPayload.dueAt = dueAt;
    rpcPayload.reason = text(body.reason, 500);
    if ((candidate?.rescheduleCount ?? 0) >= 2 && !rpcPayload.reason) {
      return commandJsonError('A reason is required for the third and later reschedules', 400, diagnostics, 'REASON_REQUIRED');
    }
  }
  if (command === 'reassign') {
    if (body.ownerUserId != null && (typeof body.ownerUserId !== 'string' || !isUuid(body.ownerUserId))) {
      return commandJsonError('Invalid action owner', 400, diagnostics, 'INVALID_OWNER');
    }
    rpcPayload.ownerUserId = body.ownerUserId ?? null;
  }
  if (command === 'complete') rpcPayload.outcome = text(body.outcome, 1000);
  if (command === 'set_critical') {
    if (typeof body.critical !== 'boolean') return commandJsonError('Critical state is required', 400, diagnostics, 'INVALID_COMMAND');
    const reason = text(body.reason, 500);
    if (!reason) return commandJsonError('A reason is required when changing criticality', 400, diagnostics, 'REASON_REQUIRED');
    Object.assign(rpcPayload, { critical: body.critical, reason });
  }
  if (command === 'resolve_conflict') {
    if (auth.session.role !== 'admin' || !before.operations.selectionConflict) {
      return commandJsonError('No resolvable action conflict exists', 409, diagnostics, 'ACTION_CONFLICT');
    }
    if (body.resolution !== 'keep_current' && body.resolution !== 'select_candidate') {
      return commandJsonError('Invalid conflict resolution', 400, diagnostics, 'INVALID_COMMAND');
    }
    if (body.resolution === 'select_candidate'
        && !before.operations.selectionConflict.outrankingCandidates.some((item) => (
          item.sourceKind === candidate?.sourceKind && item.sourceId === candidate?.sourceId
        ))) {
      return commandJsonError('Conflict resolution must choose a current outranking action', 409, diagnostics, 'ACTION_CONFLICT');
    }
    rpcPayload.resolution = body.resolution;
    if (body.resolution === 'keep_current') {
      Object.assign(rpcPayload, {
        sourceKind: current?.sourceKind,
        sourceId: current?.sourceId,
        expectedUpdatedAt: current?.updatedAt,
        confirmedOutrankingHash: current?.selectionBaselineHash,
      });
    }
  }

  try {
    const result = await auth.supabase.rpc('project_command_action', {
      p_project_id: projectUuid,
      p_command_id: commandId,
      p_command: command,
      p_payload: rpcPayload,
    });
    if (result.error) throw result.error;
    try {
      const commandCentre = await getProjectCommandCentre(projectId, auth.supabase, {
        userId: auth.session.user.id,
        isAdmin: auth.session.role === 'admin',
      });
      if (!commandCentre) return commandJsonError('Project not found', 404, diagnostics, 'NOT_FOUND');
      return commandJsonOk({
        command: { id: commandId, committed: true, replayed: Boolean((result.data as any)?.replayed) },
        commandCentre,
      }, diagnostics);
    } catch (refreshError) {
      logPortalServerError(diagnostics, { status: 200, message: 'Action committed but refresh failed', error: refreshError });
      return commandJsonOk({ command: { id: commandId, committed: true }, refreshRequired: true }, diagnostics);
    }
  } catch (error) {
    const mapped = commandDatabaseError(error);
    if (mapped.status === 500) logPortalServerError(diagnostics, { status: 500, message: 'Action command failed', error });
    return commandJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
