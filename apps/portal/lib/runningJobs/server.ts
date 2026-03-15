import 'server-only';

import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { SALES_PEOPLE } from '@/src/config/salesPeople';
import { deriveCrewShortCode, deriveRunningJobFields, getLatestRunningJobsEstimate, type RunningJobsEstimateLite } from './derive';
import type { RunningJobRow, RunningJobsResponse, RunningJobStatusValue } from './types';

const INCLUDED_STAGES = new Set(['SENT', 'DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);

type ProjectRow = {
  id: string;
  name: string | null;
  contact_id: string | null;
  site_address: string | null;
  pipeline_stage: string | null;
  created_at: string | null;
  updated_at: string | null;
  deposit_paid_date: string | null;
  final_payment_date: string | null;
  contacts?: unknown;
};

type SiteVisitRow = {
  id: string;
  project_id: string;
  status: string | null;
  assigned_sales_owner_id: string | null;
  updated_at: string | null;
};

type ScheduledJobRow = {
  id: string;
  job_id: string;
  crew_id: string | null;
  planned_start: string | null;
  planned_duration_days: number | null;
  forecast_start: string | null;
  forecast_duration_days: number | null;
  actual_start: string | null;
  actual_finish: string | null;
  status: string | null;
  updated_at: string | null;
};

type TaskRow = {
  project_id: string;
  task_key: string | null;
};

type MetaRow = {
  project_id: string;
  lights_status: RunningJobStatusValue | null;
  notes: string | null;
  updated_at: string | null;
};

type QuoteRow = {
  id: string;
  project_id: string;
};

type QuoteVersionRow = {
  id: string;
  quote_id: string;
  version_number: number | null;
  created_at: string | null;
  customer_name: string | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toYmd(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function toDateYear(value: string | null | undefined, fallback: string | null | undefined): number {
  const primary = typeof value === 'string' ? value.trim() : '';
  if (primary) {
    const match = primary.match(/^(\d{4})/);
    if (match) return Number(match[1]);
  }
  const secondary = typeof fallback === 'string' ? fallback.trim() : '';
  if (secondary) {
    const match = secondary.match(/^(\d{4})/);
    if (match) return Number(match[1]);
  }
  return new Date().getFullYear();
}

function contactFromProject(project: ProjectRow): { id: string | null; name: string; phone: string; updatedAt: string | null } {
  const raw = Array.isArray(project.contacts) ? project.contacts[0] : project.contacts ?? null;
  return {
    id: raw && typeof (raw as any).id === 'string' ? String((raw as any).id) : project.contact_id ?? null,
    name: raw && typeof (raw as any).name === 'string' ? String((raw as any).name).trim() : '',
    phone: raw && typeof (raw as any).phone === 'string' ? String((raw as any).phone).trim() : '',
    updatedAt: raw && typeof (raw as any).updated_at === 'string' ? String((raw as any).updated_at) : null,
  };
}

function taskSetByProject(taskRows: TaskRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of taskRows) {
    const projectId = typeof row.project_id === 'string' ? row.project_id : '';
    const taskKey = typeof row.task_key === 'string' ? row.task_key.trim() : '';
    if (!projectId || !taskKey) continue;
    const bucket = out.get(projectId) ?? new Set<string>();
    bucket.add(taskKey);
    out.set(projectId, bucket);
  }
  return out;
}

function hashRowVersion(input: {
  projectUpdatedAt: string | null;
  contactUpdatedAt: string | null;
  siteVisitUpdatedAt: string | null;
  scheduledJobUpdatedAt: string | null;
  metaUpdatedAt: string | null;
  stage: string;
  tasks: {
    materialsOrdered: boolean;
    roofingOrdered: boolean;
    jobComplete: boolean;
  };
}): string {
  const payload = JSON.stringify(input);
  return createHash('sha256').update(payload).digest('hex');
}

function compareQuoteVersions(a: QuoteVersionRow, b: QuoteVersionRow): number {
  const versionDiff = (typeof b.version_number === 'number' ? b.version_number : 0) - (typeof a.version_number === 'number' ? a.version_number : 0);
  if (versionDiff !== 0) return versionDiff;
  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
}

function compareRows(a: RunningJobRow, b: RunningJobRow): number {
  const aDate = a.cells.estimated_start_date;
  const bDate = b.cells.estimated_start_date;
  if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
  if (aDate && !bDate) return -1;
  if (!aDate && bDate) return 1;
  return a.cells.client_name.localeCompare(b.cells.client_name, undefined, { sensitivity: 'base' });
}

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = typeof (error as any).code === 'string' ? (error as any).code.trim() : '';
  const message = typeof (error as any).message === 'string' ? (error as any).message.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || message.includes('does not exist') || message.includes('missing');
}

async function loadProjectsAndCrews(): Promise<{ projects: ProjectRow[]; crews: RunningJobsResponse['lookups']['crews'] }> {
  const [projectsRes, crewsRes] = await Promise.all([
    supabaseServer
      .from('projects')
      .select(
        [
          'id',
          'name',
          'contact_id',
          'site_address',
          'pipeline_stage',
          'created_at',
          'updated_at',
          'deposit_paid_date',
          'final_payment_date',
          'contacts ( id, name, phone, updated_at )',
        ].join(','),
      )
      .is('archived_at', null),
    supabaseServer.from('schedule_crews').select('id, name, short_code, color, sort_order, is_active').order('sort_order', { ascending: true }),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (crewsRes.error) throw crewsRes.error;

  const crews = (Array.isArray(crewsRes.data) ? crewsRes.data : []).map((row: any) => ({
    id: String(row?.id ?? ''),
    name: typeof row?.name === 'string' ? row.name : 'Crew',
    shortCode: deriveCrewShortCode(row?.short_code, row?.name),
    color: typeof row?.color === 'string' ? row.color : null,
    active: typeof row?.is_active === 'boolean' ? row.is_active : true,
  }));

  const projects = (Array.isArray(projectsRes.data) ? projectsRes.data : []).map((row: any) => ({
    id: String(row?.id ?? ''),
    name: typeof row?.name === 'string' ? row.name : null,
    contact_id: typeof row?.contact_id === 'string' ? row.contact_id : null,
    site_address: typeof row?.site_address === 'string' ? row.site_address : null,
    pipeline_stage: typeof row?.pipeline_stage === 'string' ? row.pipeline_stage : null,
    created_at: typeof row?.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row?.updated_at === 'string' ? row.updated_at : null,
    deposit_paid_date: typeof row?.deposit_paid_date === 'string' ? row.deposit_paid_date : null,
    final_payment_date: typeof row?.final_payment_date === 'string' ? row.final_payment_date : null,
    contacts: row?.contacts ?? null,
  }));

  return { projects, crews };
}

export async function loadRunningJobs(): Promise<RunningJobsResponse> {
  const generatedAt = new Date().toISOString();
  const { projects, crews } = await loadProjectsAndCrews();
  const projectIds = projects.map((project) => project.id).filter(Boolean);

  const salesPeople = SALES_PEOPLE.map((person) => ({
    id: person.id,
    name: person.name,
    shortLabel: person.shortLabel,
  }));

  if (!projectIds.length) {
    return {
      generatedAt,
      lookups: { crews, salesPeople },
      groups: [],
    };
  }

  const [siteVisitsRes, scheduledJobsRes, tasksRes, metaRes, estimatesRes, quotesRes] = await Promise.all([
    supabaseServer
      .from('site_visit_events')
      .select('id, project_id, status, assigned_sales_owner_id, updated_at')
      .in('project_id', projectIds),
    supabaseServer
      .from('scheduled_jobs')
      .select(
        [
          'id',
          'job_id',
          'crew_id',
          'planned_start',
          'planned_duration_days',
          'forecast_start',
          'forecast_duration_days',
          'actual_start',
          'actual_finish',
          'status',
          'updated_at',
        ].join(','),
      )
      .in('job_id', projectIds),
    supabaseServer.from('project_task_checks').select('project_id, task_key').in('project_id', projectIds),
    supabaseServer.from('project_running_job_meta').select('project_id, lights_status, notes, updated_at').in('project_id', projectIds),
    supabaseServer
      .from('estimates')
      .select('id, project_id, status, created_at, version, inputs, outputs')
      .in('project_id', projectIds),
    supabaseServer.from('quotes').select('id, project_id').in('project_id', projectIds),
  ]);

  if (siteVisitsRes.error) throw siteVisitsRes.error;
  if (scheduledJobsRes.error) throw scheduledJobsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (metaRes.error) throw metaRes.error;
  if (estimatesRes.error) throw estimatesRes.error;
  if (quotesRes.error) throw quotesRes.error;

  const quoteRows = (Array.isArray(quotesRes.data) ? quotesRes.data : []).map((row: any) => ({
    id: String(row?.id ?? ''),
    project_id: String(row?.project_id ?? ''),
  }));

  const quoteIds = quoteRows.map((row) => row.id).filter(Boolean);
  const quoteVersionsRes = quoteIds.length
    ? await supabaseServer.from('quote_versions').select('id, quote_id, version_number, created_at, customer_name').in('quote_id', quoteIds)
    : { data: [], error: null };

  if (quoteVersionsRes.error) throw quoteVersionsRes.error;

  const salesPeopleById = new Map(salesPeople.map((person) => [person.id, person]));
  const crewsById = new Map(crews.map((crew) => [crew.id, crew]));

  const siteVisitByProjectId = new Map<string, SiteVisitRow>();
  for (const row of Array.isArray(siteVisitsRes.data) ? siteVisitsRes.data : []) {
    const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
    if (!projectId) continue;
    siteVisitByProjectId.set(projectId, {
      id: String(row?.id ?? ''),
      project_id: projectId,
      status: typeof row?.status === 'string' ? row.status : null,
      assigned_sales_owner_id: typeof row?.assigned_sales_owner_id === 'string' ? row.assigned_sales_owner_id : null,
      updated_at: typeof row?.updated_at === 'string' ? row.updated_at : null,
    });
  }

  const scheduledJobByProjectId = new Map<string, ScheduledJobRow>();
  for (const row of Array.isArray(scheduledJobsRes.data) ? scheduledJobsRes.data : []) {
    const projectId = typeof row?.job_id === 'string' ? row.job_id : '';
    if (!projectId) continue;
    scheduledJobByProjectId.set(projectId, {
      id: String(row?.id ?? ''),
      job_id: projectId,
      crew_id: typeof row?.crew_id === 'string' ? row.crew_id : null,
      planned_start: typeof row?.planned_start === 'string' ? row.planned_start : null,
      planned_duration_days: typeof row?.planned_duration_days === 'number' ? row.planned_duration_days : null,
      forecast_start: typeof row?.forecast_start === 'string' ? row.forecast_start : null,
      forecast_duration_days: typeof row?.forecast_duration_days === 'number' ? row.forecast_duration_days : null,
      actual_start: typeof row?.actual_start === 'string' ? row.actual_start : null,
      actual_finish: typeof row?.actual_finish === 'string' ? row.actual_finish : null,
      status: typeof row?.status === 'string' ? row.status : null,
      updated_at: typeof row?.updated_at === 'string' ? row.updated_at : null,
    });
  }

  const tasksByProjectId = taskSetByProject((Array.isArray(tasksRes.data) ? tasksRes.data : []) as TaskRow[]);

  const metaByProjectId = new Map<string, MetaRow>();
  for (const row of Array.isArray(metaRes.data) ? metaRes.data : []) {
    const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
    if (!projectId) continue;
    metaByProjectId.set(projectId, {
      project_id: projectId,
      lights_status: row?.lights_status === 'No' || row?.lights_status === 'Yes' || row?.lights_status === 'TBC' ? row.lights_status : null,
      notes: typeof row?.notes === 'string' ? row.notes : null,
      updated_at: typeof row?.updated_at === 'string' ? row.updated_at : null,
    });
  }

  const estimatesByProjectId = new Map<string, RunningJobsEstimateLite[]>();
  for (const row of Array.isArray(estimatesRes.data) ? estimatesRes.data : []) {
    const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
    if (!projectId) continue;
    const bucket = estimatesByProjectId.get(projectId) ?? [];
    bucket.push({
      id: String(row?.id ?? ''),
      project_id: projectId,
      status: typeof row?.status === 'string' ? row.status : null,
      created_at: typeof row?.created_at === 'string' ? row.created_at : null,
      version: typeof row?.version === 'number' ? row.version : null,
      inputs: row?.inputs ?? null,
      outputs: row?.outputs ?? null,
    });
    estimatesByProjectId.set(projectId, bucket);
  }

  const projectIdByQuoteId = new Map(quoteRows.map((row) => [row.id, row.project_id]));
  const latestQuoteVersionByProjectId = new Map<string, QuoteVersionRow>();
  for (const row of (Array.isArray(quoteVersionsRes.data) ? quoteVersionsRes.data : []) as any[]) {
    const quoteId = typeof row?.quote_id === 'string' ? row.quote_id : '';
    const projectId = projectIdByQuoteId.get(quoteId) ?? '';
    if (!projectId) continue;

    const nextVersion: QuoteVersionRow = {
      id: String(row?.id ?? ''),
      quote_id: quoteId,
      version_number: typeof row?.version_number === 'number' ? row.version_number : null,
      created_at: typeof row?.created_at === 'string' ? row.created_at : null,
      customer_name: typeof row?.customer_name === 'string' ? row.customer_name : null,
    };

    const prev = latestQuoteVersionByProjectId.get(projectId);
    if (!prev || compareQuoteVersions(nextVersion, prev) < 0) {
      latestQuoteVersionByProjectId.set(projectId, nextVersion);
    }
  }

  const rows: Array<{ year: number; row: RunningJobRow }> = [];

  for (const project of projects) {
    const normalizedStage = normalizeProjectStatus(project.pipeline_stage);
    const stage = firstNonEmpty(typeof project.pipeline_stage === 'string' ? project.pipeline_stage.toUpperCase() : '', normalizedStage.status);
    const scheduledJob = scheduledJobByProjectId.get(project.id) ?? null;
    if (!INCLUDED_STAGES.has(normalizedStage.status) && !scheduledJob) continue;

    const contact = contactFromProject(project);
    const taskKeys = tasksByProjectId.get(project.id) ?? new Set<string>();
    const meta = metaByProjectId.get(project.id) ?? null;
    const latestEstimate = getLatestRunningJobsEstimate(estimatesByProjectId.get(project.id) ?? []);
    const latestQuoteVersion = latestQuoteVersionByProjectId.get(project.id) ?? null;
    const derivedFields = deriveRunningJobFields(latestEstimate, meta?.lights_status);
    const siteVisit = siteVisitByProjectId.get(project.id) ?? null;

    const estimatedStartDate = toYmd(scheduledJob?.forecast_start) ?? toYmd(scheduledJob?.planned_start);
    const crew = scheduledJob?.crew_id ? crewsById.get(scheduledJob.crew_id) ?? null : null;
    const clientName = firstNonEmpty(
      contact.name,
      derivedFields.snapshotContactName,
      latestQuoteVersion?.customer_name ?? '',
      project.name ?? '',
    );

    const materialsOrdered = taskKeys.has('order_materials');
    const roofingOrdered = taskKeys.has('roofing_ordered');
    const jobCompleteTask = taskKeys.has('job_complete');
    const jobCompleted = Boolean(scheduledJob && (scheduledJob.status === 'done' || scheduledJob.actual_finish));

    const row: RunningJobRow = {
      projectId: appIdFromUuid('proj', project.id),
      contactId: contact.id ? appIdFromUuid('ct', contact.id) : null,
      siteVisitEventId: siteVisit?.id ? appIdFromUuid('sv', siteVisit.id) : null,
      scheduledJobId: scheduledJob?.id ?? null,
      latestEstimateId: latestEstimate?.id ? appIdFromUuid('est', latestEstimate.id) : null,
      latestQuoteVersionId: latestQuoteVersion?.id ? appIdFromUuid('qv', latestQuoteVersion.id) : null,
      stage,
      sortDate: estimatedStartDate,
      rowVersion: hashRowVersion({
        projectUpdatedAt: project.updated_at,
        contactUpdatedAt: contact.updatedAt,
        siteVisitUpdatedAt: siteVisit?.updated_at ?? null,
        scheduledJobUpdatedAt: scheduledJob?.updated_at ?? null,
        metaUpdatedAt: meta?.updated_at ?? null,
        stage,
        tasks: {
          materialsOrdered,
          roofingOrdered,
          jobComplete: jobCompleteTask,
        },
      }),
      cells: {
        client_name: clientName,
        phone_number: contact.phone,
        site_address: typeof project.site_address === 'string' ? project.site_address : '',
        site_visit_rep: siteVisit?.assigned_sales_owner_id
          ? salesPeopleById.get(siteVisit.assigned_sales_owner_id)?.shortLabel ?? siteVisit.assigned_sales_owner_id
          : null,
        deposit_paid_date: toYmd(project.deposit_paid_date),
        materials_ordered: materialsOrdered,
        pergola_type: derivedFields.derived.pergola_type ?? '',
        estimated_start_date: estimatedStartDate,
        final_payment_date: toYmd(project.final_payment_date),
        job_assigned_to: crew?.shortCode ?? crew?.name ?? null,
        job_completed: jobCompleted,
        lights_status: derivedFields.effectiveLightsStatus,
        blinds_status: derivedFields.derived.blinds_status,
        install_days: scheduledJob?.forecast_duration_days ?? scheduledJob?.planned_duration_days ?? null,
        size_text: derivedFields.derived.size_text ?? '',
        colour_text: derivedFields.derived.colour_text ?? '',
        roofing_text: derivedFields.derived.roofing_text ?? '',
        roofing_ordered: roofingOrdered,
        running_notes: typeof meta?.notes === 'string' ? meta.notes : '',
      },
      derived: derivedFields.derived,
      state: {
        projectCreatedAt: project.created_at,
        hasSiteVisit: Boolean(siteVisit),
        hasSchedule: Boolean(scheduledJob),
        hasCrewAssigned: Boolean(scheduledJob?.crew_id),
        hasEstimatedStartDate: Boolean(estimatedStartDate),
        hasLatestEstimate: Boolean(latestEstimate),
        tasks: {
          materialsOrdered,
          roofingOrdered,
          jobComplete: jobCompleteTask,
        },
        siteVisit: {
          salespersonId: siteVisit?.assigned_sales_owner_id ?? null,
          status: siteVisit?.status ?? null,
          updatedAt: siteVisit?.updated_at ?? null,
        },
        schedule: {
          crewId: scheduledJob?.crew_id ?? null,
          plannedStart: toYmd(scheduledJob?.planned_start),
          forecastStart: toYmd(scheduledJob?.forecast_start),
          plannedDurationDays: scheduledJob?.planned_duration_days ?? null,
          forecastDurationDays: scheduledJob?.forecast_duration_days ?? null,
          actualStart: toYmd(scheduledJob?.actual_start),
          actualFinish: toYmd(scheduledJob?.actual_finish),
          status: scheduledJob?.status ?? null,
          updatedAt: scheduledJob?.updated_at ?? null,
        },
        meta: {
          lightsStatus: meta?.lights_status ?? null,
          updatedAt: meta?.updated_at ?? null,
        },
      },
    };

    rows.push({
      year: toDateYear(estimatedStartDate, project.created_at),
      row,
    });
  }

  const groupsMap = new Map<number, RunningJobRow[]>();
  for (const entry of rows) {
    const bucket = groupsMap.get(entry.year) ?? [];
    bucket.push(entry.row);
    groupsMap.set(entry.year, bucket);
  }

  const groups = Array.from(groupsMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearRows]) => ({
      year,
      rows: yearRows.sort(compareRows),
    }));

  return {
    generatedAt,
    lookups: {
      crews,
      salesPeople,
    },
    groups,
  };
}

export { isMissingSchemaError };
