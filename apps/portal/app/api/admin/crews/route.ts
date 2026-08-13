import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listCrewsWithCounts, sanitizeHexColor, isYmd } from './_shared';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

async function readNextSortOrder(supabase: SupabaseClient): Promise<{ value: number | null; error: string | null }> {
  const lastSortRes = await supabase
    .from('schedule_crews')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastSortRes.error) {
    return { value: null, error: lastSortRes.error.message ?? 'Failed to determine sort order' };
  }

  const nextSortOrder =
    typeof lastSortRes.data?.sort_order === 'number' && Number.isFinite(lastSortRes.data.sort_order)
      ? Math.trunc(lastSortRes.data.sort_order) + 1
      : 1;

  return { value: nextSortOrder, error: null };
}

export async function GET() {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  try {
    const crews = await listCrewsWithCounts(supabase);
    return jsonOk({ ok: true, crews });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load crews';
    return jsonError(message, 500);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return jsonError('name is required', 400);

  let crewId: string | null = null;
  if (typeof body.crew_id === 'string' && body.crew_id.trim()) {
    try {
      crewId = uuidFromAppId(body.crew_id, 'crew');
    } catch {
      return jsonError('crew_id is invalid', 400);
    }
    const existing = await supabase
      .from('schedule_crews')
      .select('id,name,color,is_active,sort_order,calendar_region,base_available_date')
      .eq('id', crewId)
      .maybeSingle();
    if (existing.error) return jsonError(existing.error.message ?? 'Failed to check crew', 500);
    if (existing.data) {
      return jsonOk({ ok: true, replayed: true, crew: { ...existing.data, scheduled_item_count: 0 } });
    }
  }

  const colorInput = typeof body.color === 'string' ? body.color : '';
  const color = colorInput ? sanitizeHexColor(colorInput) : PORTAL_DEFAULT_ACCENT_HEX;
  if (!color) return jsonError('color must be a valid hex value', 400);

  const regionInput = typeof body.calendar_region === 'string' ? body.calendar_region.trim() : '';
  const calendarRegion = regionInput || 'Auckland';

  const baseDateRaw = typeof body.base_available_date === 'string' ? body.base_available_date.trim() : '';
  if (baseDateRaw && !isYmd(baseDateRaw)) return jsonError('base_available_date must be YYYY-MM-DD', 400);

  const nextSortOrderRes = await readNextSortOrder(supabase);
  if (nextSortOrderRes.error) return jsonError(nextSortOrderRes.error, 500);

  const insertRes = await supabase
    .from('schedule_crews')
    .insert({
      ...(crewId ? { id: crewId } : {}),
      name,
      color,
      calendar_region: calendarRegion,
      base_available_date: baseDateRaw || null,
      sort_order: nextSortOrderRes.value,
      is_active: true,
    } as any)
    .select('id,name,color,is_active,sort_order,calendar_region,base_available_date')
    .single();

  if (insertRes.error) {
    if (crewId && insertRes.error.code === '23505') {
      const replay = await supabase
        .from('schedule_crews')
        .select('id,name,color,is_active,sort_order,calendar_region,base_available_date')
        .eq('id', crewId)
        .maybeSingle();
      if (!replay.error && replay.data) {
        return jsonOk({ ok: true, replayed: true, crew: { ...replay.data, scheduled_item_count: 0 } });
      }
    }
    return jsonError(insertRes.error.message ?? 'Failed to create crew', 500);
  }

  return jsonOk({
    ok: true,
    replayed: false,
    crew: {
      ...insertRes.data,
      scheduled_item_count: 0,
    },
  });
}
