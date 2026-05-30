import type { SupabaseClient } from '@supabase/supabase-js';
import { PORTAL_TIME_ZONE, portalTodayYmd } from '@/lib/format/portalDateTime';
import type { DashboardPersonalTask } from './types';

export const DASHBOARD_TASK_TITLE_MAX_LENGTH = 240;

const TASK_COLUMNS = 'id,owner_id,title,completed_at,created_at,updated_at,deleted_at,sort_order';

type DashboardTaskRow = {
  id: string;
  owner_id: string;
  title: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_order: number | null;
};

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - date.getTime();
}

export function portalBusinessDayStartIso(
  now: Date | string | number = new Date(),
  timeZone = PORTAL_TIME_ZONE,
): string {
  const date = now instanceof Date ? now : new Date(now);
  const safeDate = Number.isNaN(date.valueOf()) ? new Date() : date;
  const ymd = portalTodayYmd(safeDate);
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = timeZoneOffsetMs(utcMidnight, timeZone);
  return new Date(utcMidnight.getTime() - offset).toISOString();
}

export function normalizeDashboardTaskTitle(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > DASHBOARD_TASK_TITLE_MAX_LENGTH) return null;
  return trimmed;
}

function mapDashboardTaskRow(row: DashboardTaskRow): DashboardPersonalTask {
  return {
    id: row.id,
    title: row.title,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isDashboardTaskVisibleToday(
  task: Pick<DashboardPersonalTask, 'completedAt'>,
  now: Date | string | number = new Date(),
): boolean {
  if (!task.completedAt) return true;
  return portalTodayYmd(task.completedAt) === portalTodayYmd(now);
}

export async function listVisibleDashboardTasks(
  client: SupabaseClient,
  ownerId: string,
  now: Date | string | number = new Date(),
): Promise<DashboardPersonalTask[]> {
  const startIso = portalBusinessDayStartIso(now);
  const { data, error } = await client
    .from('portal_dashboard_tasks')
    .select(TASK_COLUMNS)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .or(`completed_at.is.null,completed_at.gte.${startIso}`)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message ?? 'Failed to load dashboard tasks.');
  return (Array.isArray(data) ? data : []).map((row) => mapDashboardTaskRow(row as DashboardTaskRow));
}

export async function createDashboardTask(
  client: SupabaseClient,
  ownerId: string,
  title: string,
): Promise<DashboardPersonalTask> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('portal_dashboard_tasks')
    .insert({
      owner_id: ownerId,
      title,
      sort_order: Date.now(),
      created_at: now,
      updated_at: now,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error) throw new Error(error.message ?? 'Failed to create dashboard task.');
  return mapDashboardTaskRow(data as DashboardTaskRow);
}

export async function setDashboardTaskCompleted(
  client: SupabaseClient,
  ownerId: string,
  taskId: string,
  completed: boolean,
): Promise<DashboardPersonalTask | null> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('portal_dashboard_tasks')
    .update({
      completed_at: completed ? now : null,
      updated_at: now,
    })
    .eq('id', taskId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .select(TASK_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message ?? 'Failed to update dashboard task.');
  return data ? mapDashboardTaskRow(data as DashboardTaskRow) : null;
}
