import type { Installer } from '@/lib/types/scheduling';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
import { BRAND_ACCENT_HEX } from '@sp/theme';

const DEFAULT_SEED: Array<{ name: string; color: string; sort_order: number }> = [
  { name: 'Jayden', color: BRAND_ACCENT_HEX, sort_order: 1 },
  { name: 'David', color: '#1F6E8C', sort_order: 2 },
  { name: 'Alistair', color: '#2A9D8F', sort_order: 3 },
  { name: 'Eder', color: '#E09F3E', sort_order: 4 },
  { name: 'Jesse', color: '#6D597A', sort_order: 5 },
];

function toPostgrestError(value: unknown): PostgrestErrorLike | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  return { message: v.message, code: v.code, details: v.details, hint: v.hint };
}

function hostSuffix(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host ? ` (host: ${host})` : '';
}

function wrapError(table: string, error: unknown): SupabaseRepoError {
  const supabaseUrl = supabaseRuntimeUrl();
  const supabaseHost = supabaseHostFromUrl(supabaseUrl);
  const postgrestUrl = supabaseRestUrl(table);
  const postgrestHost = supabaseHostFromUrl(postgrestUrl);
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' && pg.code.trim() ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' && pg.message.trim() ? pg.message.trim() : 'Supabase request failed';
  const message = `Supabase ${code ? `${code}: ` : ''}${msg}${hostSuffix()}`;
  return new SupabaseRepoError(message, {
    table,
    supabaseUrl,
    supabaseHost,
    postgrestUrl,
    postgrestHost,
    postgrestError: pg,
  });
}

function installerFromRow(row: any): Installer {
  const id = typeof row?.id === 'string' ? row.id : '';
  return {
    id: appIdFromUuid('crew', id),
    name: typeof row?.name === 'string' ? row.name : 'Crew',
    color: typeof row?.color === 'string' && row.color.trim() ? row.color : BRAND_ACCENT_HEX,
    active: typeof row?.is_active === 'boolean' ? row.is_active : true,
    calendarRegion: typeof row?.calendar_region === 'string' ? row.calendar_region : null,
    baseAvailableDate: typeof row?.base_available_date === 'string' ? row.base_available_date : null,
    sortOrder: typeof row?.sort_order === 'number' && Number.isFinite(row.sort_order) ? row.sort_order : 0,
  };
}

async function ensureSeededIfEmpty(): Promise<void> {
  const supabase = getSupabaseBrowser();
  const existing = await supabase.from('schedule_crews').select('id,name,color,sort_order').order('sort_order', { ascending: true });
  if (existing.error) throw wrapError('schedule_crews', existing.error);
  const rows = Array.isArray(existing.data) ? (existing.data as any[]) : [];

  if (!rows.length) {
    const insert = await supabase.from('schedule_crews').insert(DEFAULT_SEED as any);
    if (insert.error) throw wrapError('schedule_crews', insert.error);
    return;
  }

  const expectedNames = new Set(DEFAULT_SEED.map((c) => c.name));
  const hasAnyExpected = rows.some((r) => typeof r?.name === 'string' && expectedNames.has(r.name));
  const byName = new Map<string, { id: string }>();
  for (const r of rows) {
    if (typeof r?.name === 'string' && typeof r?.id === 'string') byName.set(r.name, { id: r.id });
  }

  const hasLegacy = !hasAnyExpected && byName.has('Crew 1') && byName.has('Crew 2') && byName.has('Crew 3');
  if (!hasLegacy) return;

  const legacyMap: Array<{ legacy: string; next: (typeof DEFAULT_SEED)[number] }> = [
    { legacy: 'Crew 1', next: DEFAULT_SEED[0] },
    { legacy: 'Crew 2', next: DEFAULT_SEED[1] },
    { legacy: 'Crew 3', next: DEFAULT_SEED[2] },
  ];

  for (const m of legacyMap) {
    const row = byName.get(m.legacy);
    if (!row) continue;
    const update = await supabase.from('schedule_crews').update({ name: m.next.name, color: m.next.color, sort_order: m.next.sort_order } as any).eq('id', row.id);
    if (update.error) throw wrapError('schedule_crews', update.error);
  }

  const namesAfter = new Set<string>(DEFAULT_SEED.slice(0, 3).map((c) => c.name));
  for (const r of rows) {
    if (typeof r?.name === 'string') namesAfter.add(r.name);
  }

  const missing = DEFAULT_SEED.filter((c) => !namesAfter.has(c.name));
  if (missing.length) {
    const insert = await supabase.from('schedule_crews').insert(missing as any);
    if (insert.error) throw wrapError('schedule_crews', insert.error);
  }
}

export async function listInstallers(opts?: { activeOnly?: boolean }): Promise<Installer[]> {
  await ensureSeededIfEmpty();

  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('schedule_crews').select('*').order('sort_order', { ascending: true });
  if (error) throw wrapError('schedule_crews', error);

  const installers = (Array.isArray(data) ? data : []).map(installerFromRow).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return opts?.activeOnly ? installers.filter((i) => i.active) : installers;
}

export async function getInstaller(id: string): Promise<Installer | null> {
  try {
    const uuid = uuidFromAppId(id, 'crew');
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.from('schedule_crews').select('*').eq('id', uuid).single();
    if (error || !data) return null;
    return installerFromRow(data);
  } catch {
    return null;
  }
}
