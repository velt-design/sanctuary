import type { ScheduleItem } from '@/lib/types/scheduling';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { nowIso } from '@/lib/utils/time';
import { appIdFromUuid, isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
import { apiJson } from '@/lib/repo/apiClient';

type BarLike = { startDate: string; endDate: string; durationHours: number };

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

function scheduleItemFromRow(row: any): ScheduleItem {
  const id = typeof row?.id === 'string' ? row.id : '';
  const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
  const estimateId = typeof row?.estimate_id === 'string' ? row.estimate_id : '';
  const crewId = typeof row?.crew_id === 'string' ? row.crew_id : '';
  const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : nowIso();
  const startDate = typeof row?.start_date === 'string' ? row.start_date : '';
  const durationDays = typeof row?.duration_days === 'number' && Number.isFinite(row.duration_days) ? row.duration_days : null;
  const statusRaw = typeof row?.status === 'string' ? row.status : '';
  const scheduleStatus = statusRaw ? (statusRaw.trim().toUpperCase() as any) : undefined;

  return {
    id: appIdFromUuid('sch', id),
    projectId: appIdFromUuid('proj', projectId),
    estimateId: estimateId ? appIdFromUuid('est', estimateId) : '',
    installerId: appIdFromUuid('crew', crewId),
    sortIndex: typeof row?.sort_order === 'number' && Number.isFinite(row.sort_order) ? row.sort_order : 0,
    scheduleStatus,
    locked: typeof row?.locked === 'boolean' ? row.locked : undefined,
    confirmedAt: typeof row?.confirmed_at === 'string' ? row.confirmed_at : null,
    confirmedBy: typeof row?.confirmed_by === 'string' ? row.confirmed_by : null,
    actualStartDate: typeof row?.actual_start_date === 'string' ? row.actual_start_date : null,
    actualEndDate: typeof row?.actual_end_date === 'string' ? row.actual_end_date : null,
    startDateOverride: startDate || undefined,
    durationHoursOverride: typeof durationDays === 'number' ? durationDays * WORK_HOURS_PER_DAY : undefined,
    updatedAt,
  };
}

export async function listScheduleItems(): Promise<ScheduleItem[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('schedule_items').select('*').order('crew_id', { ascending: true }).order('sort_order', { ascending: true });
  if (error) throw wrapError('schedule_items', error);
  return (Array.isArray(data) ? data : []).map(scheduleItemFromRow);
}

function scheduleItemUuidFromId(id: string): string | null {
  const raw = typeof id === 'string' ? id.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('sch_')) {
    const uuid = raw.slice('sch_'.length);
    return isUuid(uuid) ? uuid : null;
  }
  return isUuid(raw) ? raw : null;
}

export async function upsertScheduleItems(items: ScheduleItem[], opts?: { barsById?: Map<string, BarLike>; today?: string }): Promise<void> {
  const supabase = getSupabaseBrowser();
  const rows: any[] = [];

  for (const item of items) {
    const uuid = scheduleItemUuidFromId(item.id);
    if (!uuid) continue;

    let projectUuid: string;
    let crewUuid: string;
    try {
      projectUuid = uuidFromAppId(item.projectId, 'proj');
      crewUuid = uuidFromAppId(item.installerId, 'crew');
    } catch {
      continue;
    }

    const estimateUuid = (() => {
      try {
        return item.estimateId ? uuidFromAppId(item.estimateId, 'est') : null;
      } catch {
        return null;
      }
    })();

    const bar = opts?.barsById?.get(item.id) ?? null;
    const startDate = bar?.startDate ?? item.startDateOverride ?? opts?.today ?? '';
    if (!startDate) continue;

    const durationDays =
      bar && Number.isFinite(bar.durationHours) && bar.durationHours > 0
        ? bar.durationHours / WORK_HOURS_PER_DAY
        : typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? item.durationHoursOverride / WORK_HOURS_PER_DAY
          : null;

    rows.push({
      id: uuid,
      crew_id: crewUuid,
      project_id: projectUuid,
      estimate_id: estimateUuid,
      start_date: startDate,
      end_date: bar?.endDate ?? startDate,
      duration_days: typeof durationDays === 'number' && Number.isFinite(durationDays) ? durationDays : null,
      sort_order: item.sortIndex,
      updated_at: nowIso(),
    });
  }

  if (!rows.length) return;

  const upsert = await supabase.from('schedule_items').upsert(rows as any, { onConflict: 'id' });
  if (upsert.error) throw wrapError('schedule_items', upsert.error);
}

export async function replaceScheduleItems(
  items: ScheduleItem[],
  opts?: { barsById?: Map<string, BarLike>; today?: string },
): Promise<ScheduleItem[]> {
  const supabase = getSupabaseBrowser();
  const existing = await supabase.from('schedule_items').select('id');
  if (existing.error) throw wrapError('schedule_items', existing.error);
  const existingIds = new Set((Array.isArray(existing.data) ? existing.data : []).map((r: any) => String(r.id)));

  const desiredIds = new Set<string>();
  const rows: any[] = [];

  for (const item of items) {
    let uuid: string;
    try {
      uuid = uuidFromAppId(item.id, 'sch');
    } catch {
      continue;
    }
    desiredIds.add(uuid);

    const projectUuid = uuidFromAppId(item.projectId, 'proj');
    const crewUuid = uuidFromAppId(item.installerId, 'crew');
    const estimateUuid = (() => {
      try {
        return item.estimateId ? uuidFromAppId(item.estimateId, 'est') : null;
      } catch {
        return null;
      }
    })();

    const bar = opts?.barsById?.get(item.id) ?? null;
    const startDate = bar?.startDate ?? item.startDateOverride ?? opts?.today ?? '';
    const endDate = bar?.endDate ?? startDate;
    const durationDays =
      bar && Number.isFinite(bar.durationHours) && bar.durationHours > 0 ? bar.durationHours / WORK_HOURS_PER_DAY : item.durationHoursOverride ? item.durationHoursOverride / WORK_HOURS_PER_DAY : null;

    rows.push({
      id: uuid,
      crew_id: crewUuid,
      project_id: projectUuid,
      estimate_id: estimateUuid,
      start_date: startDate,
      end_date: endDate,
      duration_days: typeof durationDays === 'number' && Number.isFinite(durationDays) ? durationDays : null,
      sort_order: item.sortIndex,
      updated_at: nowIso(),
    });
  }

  if (rows.length) {
    const upsert = await supabase.from('schedule_items').upsert(rows as any, { onConflict: 'id' }).select('id');
    if (upsert.error) throw wrapError('schedule_items', upsert.error);
  }

  const deleteIds = Array.from(existingIds).filter((id) => !desiredIds.has(id));
  if (deleteIds.length) {
    const del = await supabase.from('schedule_items').delete().in('id', deleteIds);
    if (del.error) throw wrapError('schedule_items', del.error);
  }

  return listScheduleItems();
}

export async function deleteScheduleItem(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const uuid = uuidFromAppId(id, 'sch');
  const { error } = await supabase.from('schedule_items').delete().eq('id', uuid);
  if (error) throw wrapError('schedule_items', error);
}

export async function normalizeScheduleItemsStarted(today?: string): Promise<{ updated: number }> {
  return apiJson('/api/staff/v1/schedule-items/normalize-started', {
    method: 'POST',
    body: JSON.stringify({ today }),
    skipSaveTracking: true,
  });
}

export async function confirmScheduleItem(scheduleItemId: string): Promise<{ ok: boolean; status: string; locked: boolean; confirmedAt: string; confirmedBy: string | null }> {
  return apiJson(`/api/staff/v1/schedule-items/${encodeURIComponent(scheduleItemId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function unlockScheduleItem(scheduleItemId: string, opts?: { force?: boolean }): Promise<{ ok: boolean; status: string; locked: boolean }> {
  return apiJson(`/api/staff/v1/schedule-items/${encodeURIComponent(scheduleItemId)}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ force: Boolean(opts?.force) }),
  });
}
