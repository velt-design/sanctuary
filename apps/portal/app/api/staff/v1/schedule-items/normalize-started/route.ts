import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { supabaseServer } from '@/lib/supabaseClient';
import { isYmd, todayYmd } from '@/lib/scheduling/date';

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

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const today = typeof body.today === 'string' && isYmd(body.today) ? body.today : todayYmd();
  const createdBy = (session.user?.email || '').trim() || null;

  const list = await supabaseServer
    .from('schedule_items')
    .select('id, project_id, start_date, status, actual_start_date');

  if (list.error) {
    if (isMissingColumnError(list.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run supabase/schedule_engine.sql then refresh.', 501);
    }
    return jsonError('Failed to load schedule items', 500);
  }

  const rows = Array.isArray(list.data) ? list.data : [];
  const candidates = rows.filter((r: any) => {
    const status = String(r?.status ?? 'TENTATIVE').toUpperCase();
    if (status === 'COMPLETED') return false;
    if (r?.actual_start_date) return false;
    const start = typeof r?.start_date === 'string' ? r.start_date : null;
    if (!start || !isYmd(start)) return false;
    return start <= today;
  });

  if (!candidates.length) return jsonOk({ updated: 0 });

  let updated = 0;
  for (const r of candidates) {
    const id = typeof (r as any).id === 'string' ? (r as any).id : null;
    const projectId = typeof (r as any).project_id === 'string' ? (r as any).project_id : null;
    const start = typeof (r as any).start_date === 'string' ? (r as any).start_date : null;
    if (!id || !start) continue;

    const patch = await supabaseServer
      .from('schedule_items')
      .update({ status: 'IN_PROGRESS', actual_start_date: start, locked: true } as any)
      .eq('id', id)
      .is('actual_start_date', null);

    if (patch.error) {
      if (isMissingColumnError(patch.error)) {
        return jsonError('Schedule schema is not upgraded yet. Run supabase/schedule_engine.sql then refresh.', 501);
      }
      continue;
    }

    const eventKey = `${id}:SCHEDULE_STARTED:${start}`;
    try {
      await supabaseServer
        .from('schedule_events')
        .insert(
          {
            schedule_item_id: id,
            project_id: projectId,
            type: 'SCHEDULE_STARTED',
            payload: { planned_start_date: start, assumedToday: today },
            created_by: createdBy,
            idempotency_key: eventKey,
          } as any,
          { returning: 'minimal' } as any,
        );
    } catch {
      // Best-effort; idempotency_key prevents duplicates.
    }

    updated += 1;
  }

  return jsonOk({ updated });
}
