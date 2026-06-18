import type { Installer } from '@/lib/types/scheduling';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';

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
    color: typeof row?.color === 'string' && row.color.trim() ? row.color : PORTAL_DEFAULT_ACCENT_HEX,
    active: typeof row?.is_active === 'boolean' ? row.is_active : true,
    calendarRegion: typeof row?.calendar_region === 'string' ? row.calendar_region : null,
    baseAvailableDate: typeof row?.base_available_date === 'string' ? row.base_available_date : null,
    sortOrder: typeof row?.sort_order === 'number' && Number.isFinite(row.sort_order) ? row.sort_order : 0,
  };
}

export async function listInstallers(opts?: { activeOnly?: boolean }): Promise<Installer[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('schedule_crews').select('*').order('sort_order', { ascending: true });
  if (error) throw wrapError('schedule_crews', error);

  const installers = (Array.isArray(data) ? data : []).map(installerFromRow).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return opts?.activeOnly ? installers.filter((i) => i.active) : installers;
}

