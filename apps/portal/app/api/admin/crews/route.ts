import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { supabaseServer } from '@/lib/supabaseClient';
import { listCrewsWithCounts, sanitizeHexColor, isYmd } from './_shared';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const crews = await listCrewsWithCounts();
    return jsonOk({ ok: true, crews });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load crews';
    return jsonError(message, 500);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return jsonError('name is required', 400);

  const colorInput = typeof body.color === 'string' ? body.color : '';
  const color = colorInput ? sanitizeHexColor(colorInput) : PORTAL_DEFAULT_ACCENT_HEX;
  if (!color) return jsonError('color must be a valid hex value', 400);

  const regionInput = typeof body.calendar_region === 'string' ? body.calendar_region.trim() : '';
  const calendarRegion = regionInput || 'Auckland';

  const baseDateRaw = typeof body.base_available_date === 'string' ? body.base_available_date.trim() : '';
  if (baseDateRaw && !isYmd(baseDateRaw)) return jsonError('base_available_date must be YYYY-MM-DD', 400);

  const lastSortRes = await supabaseServer
    .from('schedule_crews')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastSortRes.error) {
    return jsonError(lastSortRes.error.message ?? 'Failed to determine sort order', 500);
  }

  const nextSortOrder =
    typeof lastSortRes.data?.sort_order === 'number' && Number.isFinite(lastSortRes.data.sort_order)
      ? Math.trunc(lastSortRes.data.sort_order) + 1
      : 1;

  const insertRes = await supabaseServer
    .from('schedule_crews')
    .insert({
      name,
      color,
      calendar_region: calendarRegion,
      base_available_date: baseDateRaw || null,
      sort_order: nextSortOrder,
      is_active: true,
    } as any)
    .select('id,name,color,is_active,sort_order,calendar_region,base_available_date')
    .single();

  if (insertRes.error) return jsonError(insertRes.error.message ?? 'Failed to create crew', 500);

  return jsonOk({
    ok: true,
    crew: {
      ...insertRes.data,
      scheduled_item_count: 0,
    },
  });
}
