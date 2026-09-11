import { parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { isCalendarYmd } from '@/lib/scheduling/scheduleMutationRequest';
import { readDeliveryCompletion } from '@/lib/projects/deliveryCompletion';
import { privateNoStore, workDatabaseError, workJsonError, workJsonOk } from '@/lib/projects/workItems/routeSupport';
import { POST as markDone } from '@/app/api/staff/v1/schedule/job/mark-done/route';
import { POST as markInProgress } from '@/app/api/staff/v1/schedule/job/mark-in-progress/route';

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireStaffContext();
  if (!auth.ok) return privateNoStore(auth.response);
  let id: string;
  try { id = uuidFromAppId((await context.params).projectId, 'proj'); }
  catch { return workJsonError('Invalid projectId', 400); }
  try {
    return workJsonOk(await readDeliveryCompletion(auth.supabase, id));
  } catch (error) {
    const failure = workDatabaseError(error);
    return workJsonError(failure.message, failure.status, null, failure.code);
  }
}

export async function POST(request: Request, context: Context) {
  const auth = await requireStaffContext();
  if (!auth.ok) return privateNoStore(auth.response);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return workJsonError(parsed.error, 400);
  const body = parsed.body ?? {};
  if ((typeof body.commandId !== 'string' || !isUuid(body.commandId)) || !['complete', 'reopen'].includes(body.action)) return workJsonError('Invalid delivery command', 400);
  let id: string;
  try { id = uuidFromAppId((await context.params).projectId, 'proj'); }
  catch { return workJsonError('Invalid projectId', 400); }
  try {
    const status = await readDeliveryCompletion(auth.supabase, id);
    if (status.archived) return workJsonError('Restore the project before changing delivery.', 409);
    if (status.scheduled) {
      if (status.completed && body.action === 'complete') return workJsonOk({ ok: true, alreadyCompleted: true });
      const handler = body.action === 'complete' ? markDone : markInProgress;
      return privateNoStore(await handler(new Request(request.url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job_id: id, force: body.force, finish_early_action: body.finishEarlyAction }),
      })));
    }
    if (body.action === 'reopen') return workJsonError('Use the audited confirmation correction to reopen unscheduled delivery.', 400);
    if (!isCalendarYmd(body.completedDate) || typeof body.note !== 'string' || !body.note.trim() || body.note.trim().length > 500) {
      return workJsonError('Completion date and a short note are required.', 400);
    }
    const result = await auth.supabase.rpc('project_record_delivery_completion', {
      p_project_id: id, p_command_id: body.commandId, p_completed_date: body.completedDate, p_note: body.note.trim(),
    });
    if (result.error) throw result.error;
    return workJsonOk({ ok: true, result: result.data });
  } catch (error) {
    const failure = workDatabaseError(error);
    return workJsonError(failure.message, failure.status, null, failure.code);
  }
}
