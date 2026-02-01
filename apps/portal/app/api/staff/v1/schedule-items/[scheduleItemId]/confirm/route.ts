import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { supabaseServer } from '@/lib/supabaseClient';
import { isYmd, todayYmd } from '@/lib/scheduling/date';
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

export async function POST(_req: Request, ctx: { params: Promise<{ scheduleItemId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let itemUuid: string;
  try {
    const { scheduleItemId } = await ctx.params;
    itemUuid = uuidFromAppId(scheduleItemId, 'sch');
  } catch {
    return jsonError('Invalid scheduleItemId', 400);
  }

  const today = todayYmd();
  const now = new Date().toISOString();
  const confirmedBy = (session.user?.email || '').trim() || null;

  const select = await supabaseServer
    .from('schedule_items')
    .select('id, project_id, crew_id, start_date, end_date, status, actual_start_date')
    .eq('id', itemUuid)
    .single();

  if (select.error) {
    if (isMissingColumnError(select.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run supabase/schedule_engine.sql then refresh.', 501);
    }
    return jsonError('Schedule item not found', 404);
  }

  const row: any = select.data;
  const start = typeof row?.start_date === 'string' ? row.start_date : null;
  const end = typeof row?.end_date === 'string' ? row.end_date : null;
  const status = String(row?.status ?? 'TENTATIVE').toUpperCase();
  const started = Boolean(row?.actual_start_date) || (start && isYmd(start) && start <= today);

  const nextStatus = status === 'COMPLETED' ? 'COMPLETED' : started ? 'IN_PROGRESS' : 'CONFIRMED';

  const update = await supabaseServer
    .from('schedule_items')
    .update({ status: nextStatus, confirmed_at: now, confirmed_by: confirmedBy, locked: true } as any)
    .eq('id', itemUuid);

  if (update.error) {
    if (isMissingColumnError(update.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run supabase/schedule_engine.sql then refresh.', 501);
    }
    return jsonError('Failed to confirm schedule item', 500);
  }

  const eventKey = `${itemUuid}:SCHEDULE_CONFIRMED:${start ?? ''}:${end ?? ''}`;
  try {
    await supabaseServer
      .from('schedule_events')
      .insert(
        {
          schedule_item_id: itemUuid,
          project_id: typeof row?.project_id === 'string' ? row.project_id : null,
          type: 'SCHEDULE_CONFIRMED',
          payload: { planned_start_date: start, planned_end_date: end, crew_id: typeof row?.crew_id === 'string' ? row.crew_id : null },
          created_by: confirmedBy,
          idempotency_key: eventKey,
        } as any,
        { returning: 'minimal' } as any,
      );
  } catch {
    // Best-effort; idempotency_key prevents duplicates.
  }

  return jsonOk({ ok: true, status: nextStatus, locked: true, confirmedAt: now, confirmedBy });
}
