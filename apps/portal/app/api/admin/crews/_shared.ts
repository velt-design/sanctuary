
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';

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

async function resolveSupabaseClient(supabase?: SupabaseClient): Promise<SupabaseClient> {
  return supabase ?? (await getSupabaseServerAuth());
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isMissingRelationError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown };
  const code = toStringValue(e?.code).trim();
  const message = toStringValue(e?.message).toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('relation');
}

function isMissingArchivedAtError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown };
  const code = toStringValue(e?.code).trim();
  const message = toStringValue(e?.message).toLowerCase();
  return code === '42703' || (message.includes('archived_at') && message.includes('column'));
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

async function loadVisibleProjectIds(projectIds: string[], supabase?: SupabaseClient): Promise<Set<string>> {
  if (!projectIds.length) return new Set<string>();
  const client = await resolveSupabaseClient(supabase);

  let projectsRes = await client.from('projects').select('id').in('id', projectIds).is('archived_at', null);
  if (projectsRes.error && isMissingArchivedAtError(projectsRes.error)) {
    projectsRes = await client.from('projects').select('id').in('id', projectIds);
  }
  if (projectsRes.error) throw projectsRes.error;

  const visibleIds = new Set<string>();
  for (const row of Array.isArray(projectsRes.data) ? projectsRes.data : []) {
    if (typeof row?.id === 'string' && row.id) visibleIds.add(row.id);
  }
  return visibleIds;
}

async function countV2BoardJobsForCrew(crewId: string, supabase?: SupabaseClient): Promise<number | null> {
  const client = await resolveSupabaseClient(supabase);
  const itemRowsRes = await client.from('crew_schedule_items').select('job_id').eq('crew_id', crewId).eq('item_type', 'job');
  if (itemRowsRes.error) {
    if (isMissingRelationError(itemRowsRes.error)) return null;
    throw itemRowsRes.error;
  }

  const itemRows = Array.isArray(itemRowsRes.data) ? itemRowsRes.data : [];
  const scheduledJobIds = Array.from(
    new Set(itemRows.map((row: any) => (typeof row?.job_id === 'string' ? row.job_id : '')).filter(Boolean)),
  );
  if (!scheduledJobIds.length) return 0;

  const jobsRes = await client.from('scheduled_jobs').select('id,job_id').in('id', scheduledJobIds).eq('crew_id', crewId);
  if (jobsRes.error) throw jobsRes.error;

  const scheduledJobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
  const projectIds = Array.from(
    new Set(scheduledJobs.map((row: any) => (typeof row?.job_id === 'string' ? row.job_id : '')).filter(Boolean)),
  );
  const visibleProjectIds = await loadVisibleProjectIds(projectIds, client);
  if (!visibleProjectIds.size) return 0;

  const projectByScheduledJobId = new Map<string, string>();
  for (const row of scheduledJobs) {
    const scheduledJobId = typeof row?.id === 'string' ? row.id : '';
    const projectId = typeof row?.job_id === 'string' ? row.job_id : '';
    if (!scheduledJobId || !projectId) continue;
    projectByScheduledJobId.set(scheduledJobId, projectId);
  }

  let count = 0;
  for (const row of itemRows) {
    const scheduledJobId = typeof row?.job_id === 'string' ? row.job_id : '';
    if (!scheduledJobId) continue;
    const projectId = projectByScheduledJobId.get(scheduledJobId) ?? '';
    if (projectId && visibleProjectIds.has(projectId)) count += 1;
  }
  return count;
}

async function countLegacyBoardJobsForCrew(crewId: string, supabase?: SupabaseClient): Promise<number | null> {
  const client = await resolveSupabaseClient(supabase);
  const rowsRes = await client.from('schedule_items').select('project_id').eq('crew_id', crewId);
  if (rowsRes.error) {
    if (isMissingRelationError(rowsRes.error)) return null;
    throw rowsRes.error;
  }

  const rows = Array.isArray(rowsRes.data) ? rowsRes.data : [];
  const projectIds = Array.from(new Set(rows.map((row: any) => (typeof row?.project_id === 'string' ? row.project_id : '')).filter(Boolean)));
  const visibleProjectIds = await loadVisibleProjectIds(projectIds, client);
  if (!visibleProjectIds.size) return 0;

  let count = 0;
  for (const row of rows) {
    const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
    if (projectId && visibleProjectIds.has(projectId)) count += 1;
  }
  return count;
}

export async function countScheduledItemsForCrew(crewId: string, supabase?: SupabaseClient): Promise<number> {
  const client = await resolveSupabaseClient(supabase);
  const v2Count = await countV2BoardJobsForCrew(crewId, client);
  if (typeof v2Count === 'number') return v2Count;

  const legacyCount = await countLegacyBoardJobsForCrew(crewId, client);
  if (typeof legacyCount === 'number') return legacyCount;

  return 0;
}

export async function listCrewsWithCounts(supabase?: SupabaseClient): Promise<AdminCrew[]> {
  const client = await resolveSupabaseClient(supabase);
  const crewsRes = await client.from('schedule_crews').select(CREW_SELECT).order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (crewsRes.error) throw crewsRes.error;

  const crewRows = Array.isArray(crewsRes.data) ? crewsRes.data : [];
  const base = crewRows.map(normalizeCrewRow);

  const counts = await Promise.all(base.map((crew) => countScheduledItemsForCrew(crew.id, client)));

  return base.map((crew, index) => ({
    ...crew,
    scheduled_item_count: typeof counts[index] === 'number' ? counts[index] : 0,
  }));
}

export async function readCrewByIdWithCount(crewId: string, supabase?: SupabaseClient): Promise<AdminCrew | null> {
  const client = await resolveSupabaseClient(supabase);
  const res = await client.from('schedule_crews').select(CREW_SELECT).eq('id', crewId).maybeSingle();
  if (res.error) throw res.error;
  if (!res.data) return null;

  const normalized = normalizeCrewRow(res.data);
  const count = await countScheduledItemsForCrew(normalized.id, client);
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
