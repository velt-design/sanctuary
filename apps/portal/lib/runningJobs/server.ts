import 'server-only';

import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { SALES_PEOPLE } from '@/src/config/salesPeople';
import { deriveCrewShortCode, deriveRunningJobFields, getLatestRunningJobsEstimate, type RunningJobsEstimateLite } from './derive';
import { groupRunningJobRows } from './group';
import {
  parseLegacyBoolean,
  parseLegacyPositiveInt,
  parseLegacyStatusValue,
  type LegacyRunningJobDisplayCells,
} from './legacy';
import type { RunningJobCellKey, RunningJobRow, RunningJobsResponse, RunningJobStatusValue } from './types';

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

type LegacyImportBatchRow = {
  id: string;
};

type LegacyImportRow = {
  id: string;
  batch_id: string;
  source_row_number: number;
  display_cells: unknown;
  group_year: number | null;
  sort_date: string | null;
  matched_project_id: string | null;
  match_method: string | null;
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

function trimCellText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function displayCellsFromUnknown(value: unknown): LegacyRunningJobDisplayCells {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: LegacyRunningJobDisplayCells = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawValue !== 'string' || !rawValue.trim()) continue;
    out[rawKey as RunningJobCellKey] = rawValue.trim();
  }
  return out;
}

function legacyDisplayValue(displayCells: LegacyRunningJobDisplayCells, key: RunningJobCellKey): string {
  return trimCellText(displayCells[key] ?? '');
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

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = typeof (error as any).code === 'string' ? (error as any).code.trim() : '';
  const message = typeof (error as any).message === 'string' ? (error as any).message.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || message.includes('does not exist') || message.includes('missing');
}

async function loadProjectsAndCrews(projectIdsFilter?: string[]): Promise<{ projects: ProjectRow[]; crews: RunningJobsResponse['lookups']['crews'] }> {
  const projectsQuery = supabaseServer
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
    .is('archived_at', null);

  if (projectIdsFilter?.length) {
    projectsQuery.in('id', projectIdsFilter);
  }

  const [projectsRes, crewsRes] = await Promise.all([
    projectsQuery,
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

async function loadLegacyRunningJobRows(): Promise<RunningJobRow[]> {
  const activeBatchRes = await supabaseServer
    .from('running_job_legacy_import_batches')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeBatchRes.error) {
    if (isMissingSchemaError(activeBatchRes.error)) return [];
    throw activeBatchRes.error;
  }
  const activeBatch = activeBatchRes.data as LegacyImportBatchRow | null;
  if (!activeBatch?.id) return [];

  const rowsRes = await supabaseServer
    .from('running_job_legacy_rows')
    .select('id, batch_id, source_row_number, display_cells, group_year, sort_date, matched_project_id, match_method')
    .eq('batch_id', activeBatch.id)
    .eq('match_status', 'unmatched')
    .order('source_row_number', { ascending: true });

  if (rowsRes.error) {
    if (isMissingSchemaError(rowsRes.error)) return [];
    throw rowsRes.error;
  }

  return (Array.isArray(rowsRes.data) ? rowsRes.data : []).map((raw: any) => {
    const row = raw as LegacyImportRow;
    const displayCells = displayCellsFromUnknown(row.display_cells);
    const estimatedStart = legacyDisplayValue(displayCells, 'estimated_start_date');
    const finalPayment = legacyDisplayValue(displayCells, 'final_payment_date');
    const depositPaid = legacyDisplayValue(displayCells, 'deposit_paid_date');
    const clientName = legacyDisplayValue(displayCells, 'client_name');
    const lightsRaw = legacyDisplayValue(displayCells, 'lights_status');
    const blindsRaw = legacyDisplayValue(displayCells, 'blinds_status');
    const installDaysRaw = legacyDisplayValue(displayCells, 'install_days');
    const materialsOrderedRaw = legacyDisplayValue(displayCells, 'materials_ordered');
    const roofingOrderedRaw = legacyDisplayValue(displayCells, 'roofing_ordered');
    const completedRaw = legacyDisplayValue(displayCells, 'job_completed');

    return {
      projectId: appIdFromUuid('rjl', String(row.id)),
      source: 'legacy',
      groupYear: typeof row.group_year === 'number' ? row.group_year : null,
      sourceRowNumber: typeof row.source_row_number === 'number' ? row.source_row_number : null,
      contactId: null,
      siteVisitEventId: null,
      scheduledJobId: null,
      latestEstimateId: null,
      latestQuoteVersionId: null,
      legacy: {
        batchId: String(row.batch_id ?? ''),
        importRowId: String(row.id ?? ''),
        matchedProjectId: row.matched_project_id ? appIdFromUuid('proj', row.matched_project_id) : null,
        matchMethod: typeof row.match_method === 'string' ? row.match_method : null,
      },
      stage: 'COMPLETED',
      sortDate: toYmd(row.sort_date) ?? null,
      rowVersion: createHash('sha256').update(JSON.stringify({ id: row.id, batchId: row.batch_id, sortDate: row.sort_date })).digest('hex'),
      displayTextByCell: displayCells,
      cells: {
        client_name: clientName,
        phone_number: legacyDisplayValue(displayCells, 'phone_number'),
        site_address: legacyDisplayValue(displayCells, 'site_address'),
        site_visit_rep: legacyDisplayValue(displayCells, 'site_visit_rep') || null,
        deposit_paid_date: depositPaid || null,
        materials_ordered: parseLegacyBoolean(materialsOrderedRaw),
        pergola_type: legacyDisplayValue(displayCells, 'pergola_type'),
        estimated_start_date: estimatedStart || null,
        final_payment_date: finalPayment || null,
        job_assigned_to: legacyDisplayValue(displayCells, 'job_assigned_to') || null,
        job_completed: true,
        lights_status: parseLegacyStatusValue(lightsRaw || null),
        blinds_status: parseLegacyStatusValue(blindsRaw || null),
        install_days: parseLegacyPositiveInt(installDaysRaw || null),
        size_text: legacyDisplayValue(displayCells, 'size_text'),
        colour_text: legacyDisplayValue(displayCells, 'colour_text'),
        roofing_text: legacyDisplayValue(displayCells, 'roofing_text'),
        roofing_ordered: parseLegacyBoolean(roofingOrderedRaw),
        running_notes: legacyDisplayValue(displayCells, 'running_notes'),
      },
      derived: {
        pergola_type: legacyDisplayValue(displayCells, 'pergola_type') || null,
        lights_status: parseLegacyStatusValue(lightsRaw || null),
        blinds_status: parseLegacyStatusValue(blindsRaw || null),
        size_text: legacyDisplayValue(displayCells, 'size_text') || null,
        colour_text: legacyDisplayValue(displayCells, 'colour_text') || null,
        roofing_text: legacyDisplayValue(displayCells, 'roofing_text') || null,
      },
      state: {
        projectCreatedAt: null,
        hasSiteVisit: false,
        hasSchedule: false,
        hasCrewAssigned: false,
        hasEstimatedStartDate: Boolean(estimatedStart),
        hasLatestEstimate: false,
        tasks: {
          materialsOrdered: parseLegacyBoolean(materialsOrderedRaw),
          roofingOrdered: parseLegacyBoolean(roofingOrderedRaw),
          jobComplete: true,
        },
        siteVisit: {
          salespersonId: null,
          status: null,
          updatedAt: null,
        },
        schedule: {
          crewId: null,
          plannedStart: null,
          forecastStart: toYmd(estimatedStart) ?? null,
          plannedDurationDays: null,
          forecastDurationDays: parseLegacyPositiveInt(installDaysRaw || null),
          actualStart: null,
          actualFinish: toYmd(finalPayment) ?? toYmd(estimatedStart) ?? null,
          status: 'done',
          updatedAt: null,
        },
        meta: {
          lightsStatus: parseLegacyStatusValue(lightsRaw || null),
          updatedAt: null,
        },
      },
    } satisfies RunningJobRow;
  });
}

async function loadLiveRunningJobsByProjectIds(projectIdsFilter?: string[]): Promise<RunningJobsResponse> {
  const generatedAt = new Date().toISOString();
  const { projects, crews } = await loadProjectsAndCrews(projectIdsFilter);
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

  const siteVisitRows = Array.isArray(siteVisitsRes.data) ? (siteVisitsRes.data as any[]) : [];
  const siteVisitByProjectId = new Map<string, SiteVisitRow>();
  for (const row of siteVisitRows) {
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

  const scheduledJobRows = Array.isArray(scheduledJobsRes.data) ? (scheduledJobsRes.data as any[]) : [];
  const scheduledJobByProjectId = new Map<string, ScheduledJobRow>();
  for (const row of scheduledJobRows) {
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

  const taskRows = Array.isArray(tasksRes.data) ? (tasksRes.data as TaskRow[]) : [];
  const tasksByProjectId = taskSetByProject(taskRows);

  const metaRows = Array.isArray(metaRes.data) ? (metaRes.data as any[]) : [];
  const metaByProjectId = new Map<string, MetaRow>();
  for (const row of metaRows) {
    const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
    if (!projectId) continue;
    metaByProjectId.set(projectId, {
      project_id: projectId,
      lights_status: row?.lights_status === 'No' || row?.lights_status === 'Yes' || row?.lights_status === 'TBC' ? row.lights_status : null,
      notes: typeof row?.notes === 'string' ? row.notes : null,
      updated_at: typeof row?.updated_at === 'string' ? row.updated_at : null,
    });
  }

  const estimateRows = Array.isArray(estimatesRes.data) ? (estimatesRes.data as any[]) : [];
  const estimatesByProjectId = new Map<string, RunningJobsEstimateLite[]>();
  for (const row of estimateRows) {
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

  const rows: RunningJobRow[] = [];

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
      source: 'live',
      groupYear: null,
      sourceRowNumber: null,
      contactId: contact.id ? appIdFromUuid('ct', contact.id) : null,
      siteVisitEventId: siteVisit?.id ? appIdFromUuid('sv', siteVisit.id) : null,
      scheduledJobId: scheduledJob?.id ?? null,
      latestEstimateId: latestEstimate?.id ? appIdFromUuid('est', latestEstimate.id) : null,
      latestQuoteVersionId: latestQuoteVersion?.id ? appIdFromUuid('qv', latestQuoteVersion.id) : null,
      legacy: null,
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
      displayTextByCell: {},
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

    rows.push(row);
  }

  return {
    generatedAt,
    lookups: {
      crews,
      salesPeople,
    },
    groups: groupRunningJobRows(rows),
  };
}

export async function loadRunningJobs(): Promise<RunningJobsResponse> {
  const livePayload = await loadLiveRunningJobsByProjectIds();
  const legacyRows = await loadLegacyRunningJobRows();
  if (!legacyRows.length) return livePayload;

  return {
    ...livePayload,
    generatedAt: new Date().toISOString(),
    groups: groupRunningJobRows([...livePayload.groups.flatMap((group) => group.rows), ...legacyRows]),
  };
}

export async function loadRunningJobRow(projectUuid: string): Promise<RunningJobRow | null> {
  const payload = await loadLiveRunningJobsByProjectIds([projectUuid]);
  return payload.groups[0]?.rows[0] ?? null;
}

export { isMissingSchemaError };
