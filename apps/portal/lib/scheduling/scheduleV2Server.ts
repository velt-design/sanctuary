import 'server-only';

import { supabaseServer } from '@/lib/supabaseClient';
import { addDaysYmd, diffDaysYmd, isYmd, todayYmd } from '@/lib/scheduling/date';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import {
  addWorkingDays,
  buildWorkingDayIndex,
  nextWorkingDay,
  snapToWorkingDay,
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
  inputs: unknown;
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

export function mapJobRow(row: any): ScheduledJob {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    crewId: String(row.crew_id),
    mode: row.mode === 'pinned' ? 'pinned' : 'floating',
    plannedStart: typeof row.planned_start === 'string' ? row.planned_start : null,
    plannedDurationDays: typeof row.planned_duration_days === 'number' ? row.planned_duration_days : null,
    forecastStart: typeof row.forecast_start === 'string' ? row.forecast_start : null,
    forecastDurationDays: typeof row.forecast_duration_days === 'number' && Number.isFinite(row.forecast_duration_days) ? Math.max(1, Math.trunc(row.forecast_duration_days)) : 1,
    forecastEndExclusive: typeof row.forecast_end_exclusive === 'string' ? row.forecast_end_exclusive : null,
    actualStart: typeof row.actual_start === 'string' ? row.actual_start : null,
    actualFinish: typeof row.actual_finish === 'string' ? row.actual_finish : null,
    status: typeof row.status === 'string' ? (row.status as any) : null,
    daysRemaining: typeof row.days_remaining === 'number' ? row.days_remaining : null,
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
  const crewsQuery = supabaseServer
    .from('schedule_crews')
    .select('id, name, color, sort_order, is_active, calendar_region, base_available_date')
    .order('sort_order', { ascending: true });

  const [crewsRes, itemsRes, jobsRes, downtimesRes, calendarRes] = await Promise.all([
    crewsQuery,
    supabaseServer
      .from('crew_schedule_items')
      .select('id, crew_id, item_type, job_id, downtime_id, position')
      .order('position', { ascending: true }),
    supabaseServer.from('scheduled_jobs').select(
      [
        'id',
        'job_id',
        'crew_id',
        'mode',
        'planned_start',
        'planned_duration_days',
        'forecast_start',
        'forecast_duration_days',
        'forecast_end_exclusive',
        'actual_start',
        'actual_finish',
        'status',
        'days_remaining',
      ].join(','),
    ),
    supabaseServer.from('crew_downtimes').select('id, crew_id, duration_days, reason, note'),
    loadCalendar(),
  ]);

  if (crewsRes.error) throw crewsRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (jobsRes.error) throw jobsRes.error;
  if (downtimesRes.error) throw downtimesRes.error;

  let crews = Array.isArray(crewsRes.data) ? crewsRes.data : [];
  if (options?.crewId) {
    crews = crews.filter((row: any) => row.id === options.crewId);
  }

  const items = (Array.isArray(itemsRes.data) ? itemsRes.data : []).map(mapScheduleItemRow).filter((row) => (options?.crewId ? row.crewId === options.crewId : true));
  const jobs = (Array.isArray(jobsRes.data) ? jobsRes.data : []).map(mapJobRow).filter((row) => (options?.crewId ? row.crewId === options.crewId : true));
  const downtimes = (Array.isArray(downtimesRes.data) ? downtimesRes.data : []).map(mapDowntimeRow).filter((row) => (options?.crewId ? row.crewId === options.crewId : true));

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

function isApprovedEstimate(estimate: EstimateRowLite): boolean {
  const status = typeof estimate.status === 'string' ? estimate.status.trim().toLowerCase() : '';
  return status === 'approved';
}

export function getLatestApprovedEstimate(estimates: EstimateRowLite[]): EstimateRowLite | null {
  const approved = estimates.filter((e) => isApprovedEstimate(e));
  if (!approved.length) return null;
  approved.sort((a, b) => (b.version ?? 0) - (a.version ?? 0) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  return approved[0] ?? null;
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
  for (const update of updates) {
    await supabaseServer
      .from('scheduled_jobs')
      .update({
        forecast_start: update.forecast_start,
        forecast_end_exclusive: update.forecast_end_exclusive,
        forecast_duration_days: update.forecast_duration_days,
      } as any)
      .eq('id', update.id);
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
            planned_start: job.plannedStart,
            planned_duration_days: job.plannedDurationDays,
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
    supabaseServer.from('estimates').select('id, project_id, status, created_at, version, inputs, outputs'),
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
    inputs: row?.inputs ?? null,
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
    const approved = getLatestApprovedEstimate(list);
    if (!approved) continue;

    const durationDays = durationDaysFromEstimate(approved);
    const projectName = project.name || 'Untitled project';

    unscheduled.push({
      job_id: project.id,
      estimate_id: approved.id,
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
