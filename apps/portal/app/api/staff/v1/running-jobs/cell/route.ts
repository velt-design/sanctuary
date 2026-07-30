import { NextResponse } from 'next/server';
import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { normalizeRunningJobCellInput } from '@/lib/runningJobs/editing';
import { isMissingSchemaError, loadRunningJobRow } from '@/lib/runningJobs/server';
import {
  applyRunningJobCellMutation,
  RouteInvocationError,
  RunningJobFactConflictError,
} from '@/lib/runningJobs/writeOps';
import type { RunningJobCellMutationRequest } from '@/lib/runningJobs/types';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = (parsed.body ?? {}) as Partial<RunningJobCellMutationRequest>;

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const rowVersion = typeof body.rowVersion === 'string' ? body.rowVersion.trim() : '';
  const key = typeof body.key === 'string' ? body.key.trim() : '';

  if (!projectId) return jsonError('projectId is required', 400);
  if (!rowVersion) return jsonError('rowVersion is required', 400);

  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const normalized = normalizeRunningJobCellInput(key as any, body.value);
  if (!normalized.ok) return jsonError(normalized.error, 400);

  try {
    const currentRow = await loadRunningJobRow(projectUuid);
    if (!currentRow) return jsonError('Running job not found', 404);

    if (currentRow.rowVersion !== rowVersion) {
      return NextResponse.json({ error: 'Row conflict', currentRow }, { status: 409 });
    }

    const response = await applyRunningJobCellMutation({
      projectId,
      projectUuid,
      actorUserId: session.user.id,
      currentRow,
      key: key as any,
      value: normalized.value,
      force: Boolean(body.force),
      finishEarlyAction: body.finishEarlyAction === 'pull_forward' || body.finishEarlyAction === 'keep_schedule' ? body.finishEarlyAction : undefined,
    });

    return jsonOk(response);
  } catch (error) {
    if (error instanceof RunningJobFactConflictError) {
      const currentRow = await loadRunningJobRow(projectUuid).catch(() => null);
      return NextResponse.json({ error: 'Row conflict', currentRow }, { status: 409 });
    }
    if (error instanceof RouteInvocationError) {
      return NextResponse.json(error.body ?? { error: error.message }, { status: error.status });
    }
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Running jobs schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to update running-job cell.';
    return jsonError(message, 500);
  }
}
