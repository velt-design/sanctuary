import { supabaseServer } from '@/lib/supabaseClient';

export type AdminCrew = {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  calendar_region: string;
  base_available_date: string | null;
  scheduled_item_count: number;
};

const CREW_SELECT = 'id,name,color,is_active,sort_order,calendar_region,base_available_date';

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isMissingRelationError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown };
  const code = toStringValue(e?.code).trim();
  const message = toStringValue(e?.message).toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('relation');
}

function normalizeCrewRow(row: any): Omit<AdminCrew, 'scheduled_item_count'> {
  return {
    id: String(row?.id ?? ''),
    name: toStringValue(row?.name).trim(),
    color: typeof row?.color === 'string' && row.color.trim() ? row.color.trim() : null,
    is_active: typeof row?.is_active === 'boolean' ? row.is_active : true,
    sort_order: typeof row?.sort_order === 'number' && Number.isFinite(row.sort_order) ? Math.trunc(row.sort_order) : 0,
    calendar_region: toStringValue(row?.calendar_region).trim() || 'Auckland',
    base_available_date: typeof row?.base_available_date === 'string' && row.base_available_date.trim() ? row.base_available_date : null,
  };
}

export async function countScheduledItemsForCrew(crewId: string): Promise<number> {
  const v2 = await supabaseServer.from('crew_schedule_items').select('*', { count: 'exact', head: true }).eq('crew_id', crewId);
  if (!v2.error) return typeof v2.count === 'number' ? v2.count : 0;
  if (!isMissingRelationError(v2.error)) throw v2.error;

  const legacy = await supabaseServer.from('schedule_items').select('*', { count: 'exact', head: true }).eq('crew_id', crewId);
  if (!legacy.error) return typeof legacy.count === 'number' ? legacy.count : 0;
  if (!isMissingRelationError(legacy.error)) throw legacy.error;

  return 0;
}

export async function listCrewsWithCounts(): Promise<AdminCrew[]> {
  const crewsRes = await supabaseServer.from('schedule_crews').select(CREW_SELECT).order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (crewsRes.error) throw crewsRes.error;

  const crewRows = Array.isArray(crewsRes.data) ? crewsRes.data : [];
  const base = crewRows.map(normalizeCrewRow);

  const counts = await Promise.all(base.map((crew) => countScheduledItemsForCrew(crew.id)));

  return base.map((crew, index) => ({
    ...crew,
    scheduled_item_count: typeof counts[index] === 'number' ? counts[index] : 0,
  }));
}

export async function readCrewByIdWithCount(crewId: string): Promise<AdminCrew | null> {
  const res = await supabaseServer.from('schedule_crews').select(CREW_SELECT).eq('id', crewId).maybeSingle();
  if (res.error) throw res.error;
  if (!res.data) return null;

  const normalized = normalizeCrewRow(res.data);
  const count = await countScheduledItemsForCrew(normalized.id);
  return {
    ...normalized,
    scheduled_item_count: count,
  };
}

export function sanitizeHexColor(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return '';

  const body = match[1].toUpperCase();
  if (body.length === 3) {
    return `#${body
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`;
  }
  return `#${body}`;
}

export function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
