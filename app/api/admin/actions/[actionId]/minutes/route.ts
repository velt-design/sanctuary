import { requireAdminSession, parseJsonBody, jsonError, jsonOk } from '@/lib/api/adminApi';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { actionId: string } }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const actionId = decodeURIComponent(params.actionId ?? '').trim();
  if (!actionId) return jsonError('Action id is required', 400);

  const minutesRaw = parsed.body?.base_minutes;
  const minutes = typeof minutesRaw === 'number' ? minutesRaw : Number.parseInt(String(minutesRaw ?? ''), 10);
  if (!Number.isFinite(minutes) || minutes < 0 || !Number.isInteger(minutes)) {
    return jsonError('base_minutes must be an integer >= 0', 400);
  }

  const updatedBy = auth.session.user?.email ?? null;

  const res = await supabaseServer
    .from('install_action_minutes_overrides')
    .upsert(
      {
        action_id: actionId,
        base_minutes: minutes,
        updated_by: updatedBy,
      },
      { onConflict: 'action_id' },
    )
    .select('action_id, base_minutes')
    .single();

  if (res.error) return jsonError(res.error.message ?? 'Failed to update base minutes', 500);

  return jsonOk({
    action_id: res.data.action_id,
    base_minutes: res.data.base_minutes,
  });
}
