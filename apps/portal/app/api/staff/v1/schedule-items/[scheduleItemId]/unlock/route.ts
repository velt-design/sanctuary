import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type SupabaseLikeError = { code?: unknown; message?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isMissingColumnError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message).toLowerCase();
  return code === 'PGRST204' || code === '42703' || msg.includes('does not exist') || msg.includes('missing') || msg.includes('undefined column');
}

export async function POST(req: Request, ctx: { params: Promise<{ scheduleItemId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let itemUuid: string;
  try {
    const { scheduleItemId } = await ctx.params;
    itemUuid = uuidFromAppId(scheduleItemId, 'sch');
  } catch {
    return jsonError('Invalid scheduleItemId', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};
  const force = Boolean(body.force);
  const unlockedBy = (auth.session.user?.email || '').trim() || null;

  const select = await supabase
    .from('schedule_items')
    .select('id, project_id, status, actual_start_date')
    .eq('id', itemUuid)
    .single();

  if (select.error) {
    if (isMissingColumnError(select.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run supabase/schedule_engine.sql then refresh.', 501);
    }
    return jsonError('Schedule item not found', 404);
  }

  const row: any = select.data;
  const status = String(row?.status ?? 'TENTATIVE').toUpperCase();
  const isInProgress = status === 'IN_PROGRESS' || Boolean(row?.actual_start_date);
  if (isInProgress && !force) {
    return jsonError('This job is in progress. Unlock requires confirmation.', 409);
  }

  const update = await supabase
    .from('schedule_items')
    .update({ status: 'TENTATIVE', locked: false, confirmed_at: null, confirmed_by: null } as any)
    .eq('id', itemUuid);

  if (update.error) {
    if (isMissingColumnError(update.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run supabase/schedule_engine.sql then refresh.', 501);
    }
    return jsonError('Failed to unlock schedule item', 500);
  }

  const eventKey = `${itemUuid}:SCHEDULE_UNLOCKED:${new Date().toISOString().slice(0, 10)}`;
  try {
    await supabase
      .from('schedule_events')
      .insert(
        {
          schedule_item_id: itemUuid,
          project_id: typeof row?.project_id === 'string' ? row.project_id : null,
          type: 'SCHEDULE_UNLOCKED',
          payload: { previous_status: status, forced: force },
          created_by: unlockedBy,
          idempotency_key: eventKey,
        } as any,
        { returning: 'minimal' } as any,
      );
  } catch {
    // Best-effort; idempotency_key prevents duplicates.
  }

  return jsonOk({ ok: true, status: 'TENTATIVE', locked: false });
}
