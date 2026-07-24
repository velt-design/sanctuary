import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import { countScheduledItemsForCrew, readCrewByIdWithCount, sanitizeHexColor, isYmd } from '../_shared';

export const runtime = 'nodejs';

type Params = { crewId: string };
type Ctx = { params: Promise<Params> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const { crewId: crewIdRaw } = await params;
  const crewId = decodeURIComponent(crewIdRaw ?? '').trim();
  if (!crewId) return jsonError('crewId is required', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const body = parsed.body ?? {};
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return jsonError('name must be a non-empty string', 400);
    payload.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'color')) {
    const colorRaw = typeof body.color === 'string' ? body.color : '';
    const normalized = colorRaw.trim() ? sanitizeHexColor(colorRaw) : '';
    if (colorRaw.trim() && !normalized) return jsonError('color must be a valid hex value', 400);
    payload.color = normalized || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'calendar_region')) {
    if (body.calendar_region === null || body.calendar_region === undefined) {
      payload.calendar_region = 'Auckland';
    } else if (typeof body.calendar_region === 'string') {
      payload.calendar_region = body.calendar_region.trim() || 'Auckland';
    } else {
      return jsonError('calendar_region must be a string', 400);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'base_available_date')) {
    if (body.base_available_date === null || body.base_available_date === undefined || body.base_available_date === '') {
      payload.base_available_date = null;
    } else if (typeof body.base_available_date === 'string') {
      const ymd = body.base_available_date.trim();
      if (!isYmd(ymd)) return jsonError('base_available_date must be YYYY-MM-DD', 400);
      payload.base_available_date = ymd;
    } else {
      return jsonError('base_available_date must be YYYY-MM-DD', 400);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
    if (typeof body.is_active !== 'boolean') return jsonError('is_active must be boolean', 400);
    payload.is_active = body.is_active;
  }

  if (!Object.keys(payload).length) return jsonError('No supported fields provided.', 400);

  const existing = await readCrewByIdWithCount(crewId, supabase);
  if (!existing) return jsonError('Crew not found.', 404);

  if (payload.is_active === false) {
    const scheduledItemCount = await countScheduledItemsForCrew(crewId, supabase);
    if (scheduledItemCount > 0) {
      return jsonError('Move/unschedule items before deactivating this crew.', 409);
    }
  }

  const updateRes = await supabase
    .from('schedule_crews')
    .update(payload as any)
    .eq('id', crewId)
    .select('id,name,color,is_active,sort_order,calendar_region,base_available_date')
    .single();

  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update crew', 500);

  const scheduledItemCount = await countScheduledItemsForCrew(crewId, supabase);

  return jsonOk({
    ok: true,
    crew: {
      ...updateRes.data,
      scheduled_item_count: scheduledItemCount,
    },
  });
}
