import 'server-only';

import { supabaseServer } from '@/lib/supabaseClient';
import { addDaysYmd, diffDaysYmd, isYmd, todayYmd } from '@/lib/scheduling/date';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import {
  addWorkingDays,
  buildWorkingDayIndex,
  nextWorkingDay,
  snapToWorkingDay,
  workingDaysBetween,
  type CompanyClosure,
  type NzHoliday,
  type WorkingDayIndex,
} from '@/lib/scheduling/workingDays';
import {
  recomputeCrewSchedule,
  type CrewDowntime,
  type CrewScheduleItem,
  type PinnedConflict,
  type RecomputeResult,
  type ScheduleCrew,
  type ScheduledJob,
} from '@/lib/scheduling/recompute';

type SupabaseLikeError = { code?: unknown; message?: unknown };

type ProjectRowLite = {
  id: string;
  name: string;
  pipeline_stage: string | null;
  follow_up_date: string | null;
};

type EstimateRowLite = {
  id: string;
  project_id: string;
  status: string | null;
  created_at: string | null;
  version: number | null;
  inputs?: unknown;
  outputs: unknown;
};

export type CrewRow = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean | null;
  calendar_region: string | null;
  base_available_date: string | null;
};

export type ScheduleContext = {
  crews: CrewRow[];
  items: CrewScheduleItem[];
  jobs: ScheduledJob[];
  downtimes: CrewDowntime[];
  holidays: NzHoliday[];
  closures: CompanyClosure[];
  calendar: WorkingDayIndex;
  today: string;
};

export type CommitImpact = {
  job_id: string;
  scheduled_job_id: string;
  before_start: string | null;
  after_start: string | null;
};

export type CrewScheduleContext = {
  crewRow: CrewRow;
  items: CrewScheduleItem[];
  jobs: ScheduledJob[];
  downtimes: CrewDowntime[];
  jobsById: Map<string, ScheduledJob>;
  downtimesById: Map<string, CrewDowntime>;
  recompute: RecomputeResult;
};

export type PlannedCommitmentType = 'week_of' | 'fixed_date';
export type ClientUpdateStatus = 'none' | 'needed' | 'acknowledged';

export type DriftStatusPatch = {
  jobId: string;
  driftDays: number | null;
  clientUpdateStatus: ClientUpdateStatus;
  clientUpdateNeededAt: string | null;
};

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function isMissingSchemaError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message).toLowerCase();
  return code === 'PGRST204' || code === '42703' || msg.includes('does not exist') || msg.includes('missing') || msg.includes('undefined column');
}

export function crewRowToScheduleCrew(row: CrewRow): ScheduleCrew {
  return {
    id: row.id,
    region: (row.calendar_region || 'Auckland').trim() || 'Auckland',
    baseAvailableDate: row.base_available_date,
  };
}

export function normalizePlannedCommitmentType(value: unknown): PlannedCommitmentType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'week_of') return 'week_of';
  if (normalized === 'fixed_date') return 'fixed_date';
  return null;
}

export function normalizeClientUpdateStatus(value: unknown): ClientUpdateStatus {
  if (typeof value !== 'string') return 'none';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'needed') return 'needed';
  if (normalized === 'acknowledged') return 'acknowledged';
  return 'none';
}

export function defaultFlexDaysForCommitment(type: PlannedCommitmentType): number {
  return type === 'week_of' ? 4 : 1;
}

export function defaultHardLockForCommitment(type: PlannedCommitmentType): boolean {
  return type === 'fixed_date';
}

export function startOfWeekMondayYmd(ymd: string): string {
  if (!isYmd(ymd)) return ymd;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDaysYmd(ymd, -daysSinceMonday);
}

export function resolveJobCommitmentType(job: ScheduledJob): PlannedCommitmentType | null {
  const explicit = normalizePlannedCommitmentType(job.plannedCommitmentType);
  if (explicit) return explicit;
  if (job.plannedStart && isYmd(job.plannedStart)) return 'fixed_date';
  return null;
}

export function resolveJobPlannedAnchor(job: ScheduledJob): string | null {
  const commitmentType = resolveJobCommitmentType(job);
  if (!commitmentType) return null;
  if (commitmentType === 'week_of') {
    if (job.plannedWeekStart && isYmd(job.plannedWeekStart)) return job.plannedWeekStart;
    if (job.plannedStart && isYmd(job.plannedStart)) return startOfWeekMondayYmd(job.plannedStart);
    return null;
  }
  return job.plannedStart && isYmd(job.plannedStart) ? job.plannedStart : null;
}

export function resolveJobFlexDays(job: ScheduledJob): number | null {
  const commitmentType = resolveJobCommitmentType(job);
  if (!commitmentType) return null;
  if (typeof job.plannedFlexDays === 'number' && Number.isFinite(job.plannedFlexDays)) {
    return Math.max(0, Math.trunc(job.plannedFlexDays));
  }
  return defaultFlexDaysForCommitment(commitmentType);
}

export function computeWorkingDayDriftDays(anchor: string, forecastStart: string, region: string, calendar: WorkingDayIndex): number {
  if (!isYmd(anchor) || !isYmd(forecastStart)) return 0;
  if (anchor === forecastStart) return 0;
  if (anchor < forecastStart) return Math.max(0, workingDaysBetween(anchor, forecastStart, region, calendar));
  return Math.max(0, workingDaysBetween(forecastStart, anchor, region, calendar));
}

export function computeJobDriftDays(job: ScheduledJob, forecastStart: string | null, region: string, calendar: WorkingDayIndex): number | null {
  const anchor = resolveJobPlannedAnchor(job);
  if (!anchor || !forecastStart || !isYmd(forecastStart)) return null;
  return computeWorkingDayDriftDays(anchor, forecastStart, region, calendar);
}

export function computeDriftStatusPatches(input: {
  jobs: ScheduledJob[];
  recompute: RecomputeResult;
  region: string;
  calendar: WorkingDayIndex;
  nowIso?: string;
}): DriftStatusPatch[] {
  const nextNowIso = typeof input.nowIso === 'string' && input.nowIso ? input.nowIso : new Date().toISOString();
  const forecastByJobId = new Map(input.recompute.job_updates.map((u) => [u.id, u.forecast_start ?? null]));
  const patches: DriftStatusPatch[] = [];

  for (const job of input.jobs) {
    const forecastStart = forecastByJobId.get(job.id) ?? job.forecastStart ?? null;
    const driftDays = computeJobDriftDays(job, forecastStart, input.region, input.calendar);
    const flexDays = resolveJobFlexDays(job);
    const commitmentType = resolveJobCommitmentType(job);
    let clientUpdateStatus = normalizeClientUpdateStatus(job.clientUpdateStatus);
    let clientUpdateNeededAt = typeof job.clientUpdateNeededAt === 'string' && job.clientUpdateNeededAt ? job.clientUpdateNeededAt : null;

    if (!commitmentType) {
      clientUpdateStatus = 'none';
      clientUpdateNeededAt = null;
    } else if (driftDays !== null && flexDays !== null) {
      if (driftDays > flexDays) {
        if (clientUpdateStatus === 'none') {
          clientUpdateStatus = 'needed';
          clientUpdateNeededAt = nextNowIso;
        }
      } else if (clientUpdateStatus === 'needed') {
        clientUpdateStatus = 'none';
        clientUpdateNeededAt = null;
      }
    }

    patches.push({
      jobId: job.id,
      driftDays,
      clientUpdateStatus,
      clientUpdateNeededAt,
    });
  }

  return patches;
}

export async function applyDriftStatusPatches(input: {
  jobs: ScheduledJob[];
  recompute: RecomputeResult;
  region: string;
  calendar: WorkingDayIndex;
  nowIso?: string;
}): Promise<ScheduledJob[]> {
  const patches = computeDriftStatusPatches(input);
  const patchByJobId = new Map(patches.map((patch) => [patch.jobId, patch]));
  const previousByJobId = new Map(input.jobs.map((job) => [job.id, job]));

  const nextJobs = input.jobs.map((job) => {
    const patch = patchByJobId.get(job.id);
    if (!patch) return job;
    return {
      ...job,
      driftDays: patch.driftDays,
      clientUpdateStatus: patch.clientUpdateStatus,
      clientUpdateNeededAt: patch.clientUpdateNeededAt,
    };
  });

  for (const job of nextJobs) {
    const prev = previousByJobId.get(job.id);
    if (!prev) continue;

    const prevStatus = normalizeClientUpdateStatus(prev.clientUpdateStatus);
    const nextStatus = normalizeClientUpdateStatus(job.clientUpdateStatus);
    const prevNeededAt = typeof prev.clientUpdateNeededAt === 'string' && prev.clientUpdateNeededAt ? prev.clientUpdateNeededAt : null;
    const nextNeededAt = typeof job.clientUpdateNeededAt === 'string' && job.clientUpdateNeededAt ? job.clientUpdateNeededAt : null;

    if (prevStatus === nextStatus && prevNeededAt === nextNeededAt) continue;

    const updateRes = await supabaseServer
      .from('scheduled_jobs')
      .update({
        client_update_status: nextStatus,
        client_update_needed_at: nextStatus === 'needed' ? nextNeededAt : null,
      } as any)
      .eq('id', job.id);
    if (updateRes.error) throw updateRes.error;
  }

  return nextJobs;
}

export function mapJobRow(row: any): ScheduledJob {
  const plannedStart = typeof row.planned_start === 'string' ? row.planned_start : null;
  const plannedCommitmentType = normalizePlannedCommitmentType(row.planned_commitment_type) ?? (plannedStart ? 'fixed_date' : null);
  const plannedFlexDays =
    typeof row.planned_flex_days === 'number' && Number.isFinite(row.planned_flex_days) ? Math.max(0, Math.trunc(row.planned_flex_days)) : null;
  const clientUpdateStatus = normalizeClientUpdateStatus(row.client_update_status);

  return {
    id: String(row.id),
    jobId: String(row.job_id),
    crewId: String(row.crew_id),
    mode: row.mode === 'pinned' ? 'pinned' : 'floating',
    plannedCommitmentType,
    plannedWeekStart: typeof row.planned_week_start === 'string' ? row.planned_week_start : null,
    plannedStart,
    plannedDurationDays: typeof row.planned_duration_days === 'number' ? row.planned_duration_days : null,
    plannedFlexDays,
    plannedLockedAt: typeof row.planned_locked_at === 'string' ? row.planned_locked_at : null,
    plannedLockedBy: typeof row.planned_locked_by === 'string' ? row.planned_locked_by : null,
    forecastStart: typeof row.forecast_start === 'string' ? row.forecast_start : null,
    forecastDurationDays: typeof row.forecast_duration_days === 'number' && Number.isFinite(row.forecast_duration_days) ? Math.max(1, Math.trunc(row.forecast_duration_days)) : 1,
    forecastEndExclusive: typeof row.forecast_end_exclusive === 'string' ? row.forecast_end_exclusive : null,
    actualStart: typeof row.actual_start === 'string' ? row.actual_start : null,
    actualFinish: typeof row.actual_finish === 'string' ? row.actual_finish : null,
    status: typeof row.status === 'string' ? (row.status as any) : null,
    daysRemaining: typeof row.days_remaining === 'number' ? row.days_remaining : null,
    driftDays: typeof row.drift_days === 'number' && Number.isFinite(row.drift_days) ? Math.max(0, Math.trunc(row.drift_days)) : null,
    clientUpdateStatus,
    clientUpdateNeededAt: typeof row.client_update_needed_at === 'string' ? row.client_update_needed_at : null,
    clientUpdateAckAt: typeof row.client_update_ack_at === 'string' ? row.client_update_ack_at : null,
    clientUpdateAckBy: typeof row.client_update_ack_by === 'string' ? row.client_update_ack_by : null,
  };
}

export function mapDowntimeRow(row: any): CrewDowntime {
  return {
    id: String(row.id),
    crewId: String(row.crew_id),
    durationDays: typeof row.duration_days === 'number' ? Math.max(1, Math.trunc(row.duration_days)) : 1,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    note: typeof row.note === 'string' ? row.note : null,
  };
}

export function mapScheduleItemRow(row: any): CrewScheduleItem {
  return {
    id: String(row.id),
    crewId: String(row.crew_id),
    itemType: row.item_type === 'downtime' ? 'downtime' : 'job',
    jobId: typeof row.job_id === 'string' ? row.job_id : null,
    downtimeId: typeof row.downtime_id === 'string' ? row.downtime_id : null,
    position: typeof row.position === 'number' ? row.position : 0,
  };
}

export async function loadScheduledJobRow(jobIdOrScheduledJobId: string): Promise<any | null> {
  const byProjectRes = await supabaseServer.from('scheduled_jobs').select('*').eq('job_id', jobIdOrScheduledJobId).maybeSingle();
  if (byProjectRes.error) throw byProjectRes.error;
  if (byProjectRes.data) return byProjectRes.data;

  const byIdRes = await supabaseServer.from('scheduled_jobs').select('*').eq('id', jobIdOrScheduledJobId).maybeSingle();
  if (byIdRes.error) throw byIdRes.error;
  return byIdRes.data ?? null;
}

export async function appendPlannedCommitmentHistory(input: {
  scheduledJobId: string;
  eventType: 'lock' | 'reschedule';
  commitmentType: PlannedCommitmentType;
  plannedWeekStart: string | null;
  plannedStart: string | null;
  plannedDurationDays: number | null;
  plannedFlexDays: number;
  hardLock: boolean;
  changedBy: string | null;
}) {
  const res = await supabaseServer.from('planned_commitment_history').insert({
    scheduled_job_id: input.scheduledJobId,
    event_type: input.eventType,
    commitment_type: input.commitmentType,
    planned_week_start: input.plannedWeekStart,
    planned_start: input.plannedStart,
    planned_duration_days: input.plannedDurationDays,
    planned_flex_days: input.plannedFlexDays,
    hard_lock: input.hardLock,
    changed_by: input.changedBy,
  } as any);
  if (res.error) throw res.error;
}

export async function loadCalendar(): Promise<{ holidays: NzHoliday[]; closures: CompanyClosure[]; calendar: WorkingDayIndex }> {
  const holidaysRes = await supabaseServer.from('nz_holidays').select('date, name, scope, region');
  if (holidaysRes.error) throw holidaysRes.error;
  const closuresRes = await supabaseServer.from('company_closures').select('date, name, region');
  if (closuresRes.error) throw closuresRes.error;

  const holidays: NzHoliday[] = (Array.isArray(holidaysRes.data) ? holidaysRes.data : []).map((row: any): NzHoliday => ({
    date: String(row.date),
    name: typeof row.name === 'string' ? row.name : undefined,
    scope: row.scope === 'regional' ? 'regional' : 'national',
    region: typeof row.region === 'string' ? row.region : null,
  }));

  const closures: CompanyClosure[] = (Array.isArray(closuresRes.data) ? closuresRes.data : []).map((row: any): CompanyClosure => ({
    date: String(row.date),
    name: typeof row.name === 'string' ? row.name : undefined,
    region: typeof row.region === 'string' ? row.region : null,
  }));

  return { holidays, closures, calendar: buildWorkingDayIndex(holidays, closures) };
}

export async function loadScheduleContext(options?: { crewId?: string; today?: string }): Promise<ScheduleContext> {
  const today = typeof options?.today === 'string' && isYmd(options.today) ? options.today : todayYmd();
  const crewId = typeof options?.crewId === 'string' && options.crewId.trim() ? options.crewId.trim() : null;

  let crewsQuery = supabaseServer
    .from('schedule_crews')
    .select('id, name, color, sort_order, is_active, calendar_region, base_available_date')
    .order('sort_order', { ascending: true });
  let itemsQuery = supabaseServer.from('crew_schedule_items').select('id, crew_id, item_type, job_id, downtime_id, position').order('position', { ascending: true });
  let jobsQuery = supabaseServer.from('scheduled_jobs').select(
    [
      'id',
      'job_id',
      'crew_id',
      'mode',
      'planned_commitment_type',
      'planned_week_start',
      'planned_start',
      'planned_duration_days',
      'planned_flex_days',
      'planned_locked_at',
      'planned_locked_by',
      'forecast_start',
      'forecast_duration_days',
      'forecast_end_exclusive',
      'actual_start',
      'actual_finish',
      'status',
      'days_remaining',
      'client_update_status',
      'client_update_needed_at',
      'client_update_ack_at',
      'client_update_ack_by',
    ].join(','),
  );
  let downtimesQuery = supabaseServer.from('crew_downtimes').select('id, crew_id, duration_days, reason, note');

  if (crewId) {
    crewsQuery = crewsQuery.eq('id', crewId);
    itemsQuery = itemsQuery.eq('crew_id', crewId);
    jobsQuery = jobsQuery.eq('crew_id', crewId);
    downtimesQuery = downtimesQuery.eq('crew_id', crewId);
  }

  const [crewsRes, itemsRes, jobsRes, downtimesRes, calendarRes] = await Promise.all([crewsQuery, itemsQuery, jobsQuery, downtimesQuery, loadCalendar()]);

  if (crewsRes.error) throw crewsRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (jobsRes.error) throw jobsRes.error;
  if (downtimesRes.error) throw downtimesRes.error;

  const crews = Array.isArray(crewsRes.data) ? crewsRes.data : [];
  const items = (Array.isArray(itemsRes.data) ? itemsRes.data : []).map(mapScheduleItemRow);
  const jobs = (Array.isArray(jobsRes.data) ? jobsRes.data : []).map(mapJobRow);
  const downtimes = (Array.isArray(downtimesRes.data) ? downtimesRes.data : []).map(mapDowntimeRow);

  return {
    crews,
    items,
    jobs,
    downtimes,
    holidays: calendarRes.holidays,
    closures: calendarRes.closures,
    calendar: calendarRes.calendar,
    today,
  };
}

function normaliseEstimateStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isSchedulableEstimate(estimate: EstimateRowLite): boolean {
  return normaliseEstimateStatus(estimate.status) !== 'archived';
}

export function getLatestSchedulableEstimate(estimates: EstimateRowLite[]): EstimateRowLite | null {
  const schedulable = estimates.filter((e) => isSchedulableEstimate(e));
  if (!schedulable.length) return null;
  schedulable.sort((a, b) => (b.version ?? 0) - (a.version ?? 0) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  return schedulable[0] ?? null;
}

export function durationDaysFromEstimate(estimate: EstimateRowLite | null): number {
  if (!estimate) return 1;
  const derived = deriveDurationHoursFromEstimate(
    {
      id: estimate.id,
      projectId: estimate.project_id,
      outputs: estimate.outputs ?? {},
    } as any,
  );
  const hours = derived.durationHours;
  return Math.max(1, Math.ceil(hours / WORK_HOURS_PER_DAY));
}

export function recomputeForCrew(input: {
  crewRow: CrewRow;
  items: CrewScheduleItem[];
  jobs: ScheduledJob[];
  downtimes: CrewDowntime[];
  calendar: WorkingDayIndex;
  today: string;
}): RecomputeResult {
  const crew = crewRowToScheduleCrew(input.crewRow);
  const jobsById = new Map(input.jobs.map((job) => [job.id, job]));
  const downtimesById = new Map(input.downtimes.map((dt) => [dt.id, dt]));

  return recomputeCrewSchedule({
    crew,
    items: input.items,
    jobsById,
    downtimesById,
    today: input.today,
    calendar: input.calendar,
  });
}

export function buildCrewContext(ctx: ScheduleContext, crewId: string): CrewScheduleContext | null {
  const crewRow = ctx.crews.find((crew) => crew.id === crewId);
  if (!crewRow) return null;
  const items = ctx.items.filter((item) => item.crewId === crewId);
  const jobs = ctx.jobs.filter((job) => job.crewId === crewId);
  const downtimes = ctx.downtimes.filter((dt) => dt.crewId === crewId);
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const downtimesById = new Map(downtimes.map((dt) => [dt.id, dt]));
  const recompute = recomputeForCrew({ crewRow, items, jobs, downtimes, calendar: ctx.calendar, today: ctx.today });

  return {
    crewRow,
    items,
    jobs,
    downtimes,
    jobsById,
    downtimesById,
    recompute,
  };
}

function inRange(date: string | null, start: string, endExclusive: string): boolean {
  if (!date || !isYmd(date)) return false;
  const afterStart = diffDaysYmd(start, date) >= 0;
  const beforeEnd = diffDaysYmd(date, endExclusive) > 0;
  return afterStart && beforeEnd;
}

export function computeCommitImpacts(input: {
  before: RecomputeResult;
  after: RecomputeResult;
  jobMetaById: Map<string, ScheduledJob>;
  today: string;
  horizonDays: number;
  region: string;
  calendar: WorkingDayIndex;
}): CommitImpact[] {
  const horizonEnd = addWorkingDays(input.today, input.horizonDays, input.region, input.calendar);

  const beforeMap = new Map(input.before.job_updates.map((u) => [u.id, u.forecast_start ?? null]));
  const afterMap = new Map(input.after.job_updates.map((u) => [u.id, u.forecast_start ?? null]));
  const impacts: CommitImpact[] = [];

  for (const [jobId, afterStart] of afterMap.entries()) {
    const beforeStart = beforeMap.get(jobId) ?? null;
    if (beforeStart === afterStart) continue;

    if (!inRange(beforeStart, input.today, horizonEnd) && !inRange(afterStart, input.today, horizonEnd)) continue;

    const meta = input.jobMetaById.get(jobId);
    impacts.push({
      job_id: meta?.jobId ?? jobId,
      scheduled_job_id: jobId,
      before_start: beforeStart,
      after_start: afterStart,
    });
  }

  return impacts;
}

export async function applyJobForecastUpdates(updates: { id: string; forecast_start: string | null; forecast_end_exclusive: string | null; forecast_duration_days: number }[]) {
  if (!Array.isArray(updates) || !updates.length) return;

  const chunkSize = 20;
  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    await Promise.all(
      chunk.map(async (update) => {
        const res = await supabaseServer
          .from('scheduled_jobs')
          .update({
            forecast_start: update.forecast_start,
            forecast_end_exclusive: update.forecast_end_exclusive,
            forecast_duration_days: update.forecast_duration_days,
          } as any)
          .eq('id', update.id);
        if (res.error) throw res.error;
      }),
    );
  }
}

export function computeRangeIntersection(start: string, endExclusive: string, rangeStart: string, rangeEnd: string): boolean {
  if (!isYmd(start) || !isYmd(endExclusive) || !isYmd(rangeStart) || !isYmd(rangeEnd)) return false;
  const rangeEndExclusive = addDaysYmd(rangeEnd, 1);
  const startsBeforeEnd = diffDaysYmd(start, rangeEndExclusive) > 0;
  const endsAfterStart = diffDaysYmd(rangeStart, endExclusive) > 0;
  return startsBeforeEnd && endsAfterStart;
}

export function snapToday(today: string, region: string, calendar: WorkingDayIndex): string {
  return snapToWorkingDay(today, region, calendar);
}

export function nextAvailableDate(today: string, crewRow: CrewRow, calendar: WorkingDayIndex): string {
  const base = crewRow.base_available_date && isYmd(crewRow.base_available_date) ? crewRow.base_available_date : today;
  return nextWorkingDay(base, (crewRow.calendar_region || 'Auckland').trim() || 'Auckland', calendar);
}

export function normalizedPosition(items: CrewScheduleItem[]): CrewScheduleItem[] {
  const sorted = items.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return sorted.map((item, index) => ({ ...item, position: index }));
}

export function insertItemAtPosition(items: CrewScheduleItem[], item: CrewScheduleItem, position: number): CrewScheduleItem[] {
  const clamped = Math.max(0, Math.trunc(position));
  const sorted = items.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const next = sorted.map((i) => ({ ...i }));
  next.splice(Math.min(clamped, next.length), 0, { ...item, position: clamped });
  return next.map((i, index) => ({ ...i, position: index }));
}

export function removeItem(items: CrewScheduleItem[], predicate: (item: CrewScheduleItem) => boolean): CrewScheduleItem[] {
  return items.filter((i) => !predicate(i)).map((i, index) => ({ ...i, position: index }));
}

export function reorderItems(items: CrewScheduleItem[], orderedIds: string[]): CrewScheduleItem[] {
  const map = new Map(items.map((i) => [i.id, { ...i }]));
  const next: CrewScheduleItem[] = [];
  for (const id of orderedIds) {
    const item = map.get(id);
    if (item) next.push(item);
  }
  for (const item of items) {
    if (!orderedIds.includes(item.id)) next.push({ ...item });
  }
  return next.map((item, index) => ({ ...item, position: index }));
}

export function buildJobMetaMap(jobs: ScheduledJob[]): Map<string, ScheduledJob> {
  return new Map(jobs.map((job) => [job.id, job]));
}

export function defaultForecastDurationDays(): number {
  return 1;
}

export function ensureForecastDurationDays(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

export function formatCrewScheduleBlocks(input: {
  crewRow: CrewRow;
  recompute: RecomputeResult;
  jobsById: Map<string, ScheduledJob>;
  downtimesById: Map<string, CrewDowntime>;
}): { crew_id: string; items: any[]; conflicts: PinnedConflict[]; next_available_date: string } {
  const items = input.recompute.blocks.map((block) => {
    if (block.item_type === 'downtime') {
      const dt = block.downtime_id ? input.downtimesById.get(block.downtime_id) : null;
      return {
        id: block.item_id,
        item_type: 'downtime',
        position: block.position,
        start: block.start,
        end_exclusive: block.end_exclusive,
        duration_days: block.duration_days,
        downtime: dt
          ? {
              id: dt.id,
              crew_id: dt.crewId,
              duration_days: dt.durationDays,
              reason: dt.reason,
              note: dt.note,
            }
          : null,
      };
    }

    const job = block.job_id ? input.jobsById.get(block.job_id) : null;
    return {
      id: block.item_id,
      item_type: 'job',
      position: block.position,
      start: block.start,
      end_exclusive: block.end_exclusive,
      duration_days: block.duration_days,
      job: job
        ? {
            id: job.id,
            job_id: job.jobId,
            crew_id: job.crewId,
            mode: job.mode,
            planned_commitment_type: job.plannedCommitmentType ?? null,
            planned_week_start: job.plannedWeekStart ?? null,
            planned_start: job.plannedStart,
            planned_duration_days: job.plannedDurationDays,
            planned_flex_days: resolveJobFlexDays(job),
            planned_locked_at: job.plannedLockedAt ?? null,
            planned_locked_by: job.plannedLockedBy ?? null,
            drift_days: typeof job.driftDays === 'number' && Number.isFinite(job.driftDays) ? Math.max(0, Math.trunc(job.driftDays)) : null,
            client_update_status: normalizeClientUpdateStatus(job.clientUpdateStatus),
            client_update_needed_at: job.clientUpdateNeededAt ?? null,
            client_update_ack_at: job.clientUpdateAckAt ?? null,
            client_update_ack_by: job.clientUpdateAckBy ?? null,
            forecast_start: block.start,
            forecast_end_exclusive: block.end_exclusive,
            forecast_duration_days: block.duration_days,
            actual_start: job.actualStart,
            actual_finish: job.actualFinish,
            status: job.status,
            days_remaining: job.daysRemaining,
          }
        : null,
    };
  });

  return {
    crew_id: input.crewRow.id,
    items,
    conflicts: input.recompute.conflicts,
    next_available_date: input.recompute.next_available_date,
  };
}

export async function listProjectsAndEstimates(): Promise<{ projects: ProjectRowLite[]; estimates: EstimateRowLite[] }> {
  const [projectsRes, estimatesRes] = await Promise.all([
    supabaseServer.from('projects').select('id, name, pipeline_stage, follow_up_date'),
    supabaseServer.from('estimates').select('id, project_id, status, created_at, version, outputs'),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (estimatesRes.error) throw estimatesRes.error;

  const projects: ProjectRowLite[] = (Array.isArray(projectsRes.data) ? projectsRes.data : []).map((row: any) => ({
    id: String(row?.id ?? ''),
    name: String(row?.name ?? ''),
    pipeline_stage: typeof row?.pipeline_stage === 'string' ? row.pipeline_stage : null,
    follow_up_date: typeof row?.follow_up_date === 'string' ? row.follow_up_date : null,
  }));

  const estimates: EstimateRowLite[] = (Array.isArray(estimatesRes.data) ? estimatesRes.data : []).map((row: any) => ({
    id: String(row?.id ?? ''),
    project_id: String(row?.project_id ?? ''),
    status: typeof row?.status === 'string' ? row.status : null,
    created_at: typeof row?.created_at === 'string' ? row.created_at : null,
    version: typeof row?.version === 'number' && Number.isFinite(row.version) ? row.version : null,
    outputs: row?.outputs ?? null,
  }));

  return {
    projects,
    estimates,
  };
}

export function buildUnscheduledJobs(input: {
  projects: ProjectRowLite[];
  estimates: EstimateRowLite[];
  scheduledProjectIds: Set<string>;
}): any[] {
  const estimatesByProject = new Map<string, EstimateRowLite[]>();
  for (const est of input.estimates) {
    const list = estimatesByProject.get(est.project_id) ?? [];
    list.push(est);
    estimatesByProject.set(est.project_id, list);
  }

  const unscheduled: any[] = [];

  for (const project of input.projects) {
    if (input.scheduledProjectIds.has(project.id)) continue;
    const list = estimatesByProject.get(project.id) ?? [];
    if (!list.length) continue;
    const latest = getLatestSchedulableEstimate(list);
    if (!latest) continue;

    const durationDays = durationDaysFromEstimate(latest);
    const projectName = project.name || 'Untitled project';

    unscheduled.push({
      job_id: project.id,
      estimate_id: latest.id,
      project_name: projectName,
      status: project.pipeline_stage ?? 'NEW',
      duration_days: durationDays,
    });
  }

  unscheduled.sort((a, b) => String(a.project_name).localeCompare(String(b.project_name)));
  return unscheduled;
}

export function applyScheduleItemPositions(items: CrewScheduleItem[]): { id: string; position: number }[] {
  return items.map((item) => ({ id: item.id, position: item.position }));
}

export function clampPosition(position: unknown, length: number): number {
  const value = typeof position === 'number' && Number.isFinite(position) ? Math.trunc(position) : length;
  return Math.max(0, Math.min(value, length));
}

export function ensureActualStart(job: ScheduledJob, fallback: string): string {
  if (job.actualStart && isYmd(job.actualStart)) return job.actualStart;
  if (job.forecastStart && isYmd(job.forecastStart)) return job.forecastStart;
  return fallback;
}

export function computeRangeHolidays(input: { holidays: NzHoliday[]; closures: CompanyClosure[]; rangeStart: string; rangeEnd: string }) {
  const start = input.rangeStart;
  const end = input.rangeEnd;
  const rangeEndExclusive = addDaysYmd(end, 1);
  const inRange = (date: string) => diffDaysYmd(start, date) >= 0 && diffDaysYmd(date, rangeEndExclusive) > 0;

  return {
    holidays: input.holidays.filter((h) => inRange(h.date)),
    closures: input.closures.filter((c) => inRange(c.date)),
  };
}
