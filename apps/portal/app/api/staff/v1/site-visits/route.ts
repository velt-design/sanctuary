import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { formatSupportedSchemaMessage, isSupportedSchemaError } from '@/lib/supabase/schemaGuard';
import { formatSupabaseError } from '@/lib/supabase/apiErrors';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import type { SiteVisitCalendarItem, SiteVisitProjectFocus } from '@/lib/types/siteVisits';
import { normalizeProjectStatus } from '@/lib/types/project';
import { SALES_PEOPLE } from '@/src/config/salesPeople';

export const runtime = 'nodejs';

function asIso(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

const SITE_VISIT_SELECT =
  'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, customer_notified, last_notified_at, cancel_reason, created_at, updated_at,' +
  ' projects!inner( id, name, region, site_address, pipeline_stage, site_visit_priority_tier, contact_id, contacts ( id, name, email, phone ) )';

const PROJECT_SELECT =
  'id, name, region, site_address, pipeline_stage, site_visit_priority_tier, contact_id, created_at, updated_at,' +
  ' contacts ( id, name, email, phone )';

const PROJECT_FOCUS_STATUSES = ['UNSCHEDULED', 'TENTATIVE', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'];

function projectObject(row: any): any {
  const project = row?.projects ?? row?.project ?? null;
  return Array.isArray(project) ? project[0] : project;
}

function contactObject(project: any): any {
  const contact = project?.contacts ?? project?.contact ?? null;
  return Array.isArray(contact) ? contact[0] : contact;
}

function siteVisitStatus(value: unknown): SiteVisitCalendarItem['status'] {
  const status = String(value ?? '').trim().toUpperCase();
  if (
    status === 'TENTATIVE'
    || status === 'CONFIRMED'
    || status === 'COMPLETED'
    || status === 'NO_SHOW'
    || status === 'RESCHEDULED'
    || status === 'CANCELLED'
  ) {
    return status;
  }
  return 'UNSCHEDULED';
}

function mapRow(row: any): SiteVisitCalendarItem {
  const projectObj = projectObject(row);
  const contact = projectObj?.contacts ?? projectObj?.contact ?? null;
  const contactObj = Array.isArray(contact) ? contact[0] : contact;

  const projectUuid = String(row?.project_id ?? projectObj?.id ?? '');
  const contactUuid =
    typeof projectObj?.contact_id === 'string' ? projectObj.contact_id : typeof contactObj?.id === 'string' ? contactObj.id : '';
  const tierRaw = projectObj?.site_visit_priority_tier ?? projectObj?.siteVisitPriorityTier ?? null;
  const priorityTier = tierRaw === 1 || tierRaw === '1' ? 1 : tierRaw === 2 || tierRaw === '2' ? 2 : null;

  const salespersonId =
    typeof row?.assigned_sales_owner_id === 'string'
      ? row.assigned_sales_owner_id
      : typeof row?.assigned_sales_owner === 'string'
        ? row.assigned_sales_owner
        : row?.assigned_sales_owner && typeof row.assigned_sales_owner === 'object'
          ? String(row.assigned_sales_owner)
          : null;

  return {
    id: appIdFromUuid('sv', String(row?.id ?? '')),
    projectId: appIdFromUuid('proj', projectUuid),
    status: siteVisitStatus(row?.status),
    scheduledStart: typeof row?.scheduled_start === 'string' ? row.scheduled_start : null,
    scheduledEnd: typeof row?.scheduled_end === 'string' ? row.scheduled_end : null,
    salespersonId: typeof salespersonId === 'string' && salespersonId.trim() ? salespersonId.trim() : null,
    notes: typeof row?.notes === 'string' ? row.notes : null,
    customerNotified: Boolean(row?.customer_notified),
    lastNotifiedAt: typeof row?.last_notified_at === 'string' ? row.last_notified_at : null,
    cancelReason: typeof row?.cancel_reason === 'string' ? row.cancel_reason : null,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : '',
    priorityTier,
    project: {
      id: appIdFromUuid('proj', projectUuid),
      name: typeof projectObj?.name === 'string' ? projectObj.name : '',
      region: typeof projectObj?.region === 'string' ? projectObj.region : null,
      siteAddress: typeof projectObj?.site_address === 'string' ? projectObj.site_address : null,
      pipelineStage: typeof projectObj?.pipeline_stage === 'string' ? projectObj.pipeline_stage : null,
    },
    contact: {
      id: contactUuid ? appIdFromUuid('ct', contactUuid) : null,
      name: typeof contactObj?.name === 'string' ? contactObj.name : null,
      email: typeof contactObj?.email === 'string' ? contactObj.email : null,
      phone: typeof contactObj?.phone === 'string' ? contactObj.phone : null,
    },
  };
}

function mapProjectCreateTarget(project: any): SiteVisitCalendarItem {
  const projectUuid = String(project?.id ?? '');
  const projectId = appIdFromUuid('proj', projectUuid);
  const contact = contactObject(project);
  const contactUuid =
    typeof project?.contact_id === 'string'
      ? project.contact_id
      : typeof contact?.id === 'string'
        ? contact.id
        : '';
  const tierRaw = project?.site_visit_priority_tier ?? null;
  const priorityTier = tierRaw === 1 || tierRaw === '1' ? 1 : tierRaw === 2 || tierRaw === '2' ? 2 : null;

  return {
    id: `project:${projectId}`,
    projectId,
    status: 'UNSCHEDULED',
    scheduledStart: null,
    scheduledEnd: null,
    salespersonId: null,
    notes: null,
    customerNotified: false,
    lastNotifiedAt: null,
    cancelReason: null,
    createdAt: typeof project?.created_at === 'string' ? project.created_at : '',
    updatedAt: typeof project?.updated_at === 'string' ? project.updated_at : '',
    priorityTier,
    project: {
      id: projectId,
      name: typeof project?.name === 'string' ? project.name : '',
      region: typeof project?.region === 'string' ? project.region : null,
      siteAddress: typeof project?.site_address === 'string' ? project.site_address : null,
      pipelineStage: typeof project?.pipeline_stage === 'string' ? project.pipeline_stage : null,
    },
    contact: {
      id: contactUuid ? appIdFromUuid('ct', contactUuid) : null,
      name: typeof contact?.name === 'string' ? contact.name : null,
      email: typeof contact?.email === 'string' ? contact.email : null,
      phone: typeof contact?.phone === 'string' ? contact.phone : null,
    },
  };
}

function projectFocusFromRows(rows: any[]): SiteVisitProjectFocus | null {
  const mapped = rows.map(mapRow);
  const activeScheduled = mapped.find((item) => (
    Boolean(item.scheduledStart)
      && ['TENTATIVE', 'CONFIRMED', 'RESCHEDULED'].includes(item.status)
  ));
  if (activeScheduled) return { kind: 'scheduled', item: activeScheduled };

  const unscheduled = mapped.find((item) => item.status === 'UNSCHEDULED');
  if (unscheduled) return { kind: 'create', item: unscheduled };

  const completed = mapped.find((item) => item.status === 'COMPLETED' && Boolean(item.scheduledStart));
  return completed ? { kind: 'scheduled', item: completed } : null;
}

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/site-visits');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const url = new URL(req.url);
  const fromIso = asIso(url.searchParams.get('from'));
  const toIso = asIso(url.searchParams.get('to'));
  const salesOwnerId = (url.searchParams.get('salesOwnerId') || '').trim() || null;
  const projectParam = (url.searchParams.get('project') || '').trim() || null;
  let projectUuid: string | null = null;

  if (projectParam) {
    try {
      projectUuid = uuidFromAppId(projectParam, 'proj');
    } catch {
      return jsonError('Invalid project', 400, diagnostics);
    }
  }

  if (!fromIso || !toIso) return jsonError('from and to are required (ISO)', 400, diagnostics);

  const unscheduledQuery = supabase
    .from('site_visit_events')
    .select(SITE_VISIT_SELECT)
    .eq('status', 'UNSCHEDULED');

  const eventsQuery = supabase
    .from('site_visit_events')
    .select(SITE_VISIT_SELECT)
    .in('status', ['TENTATIVE', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'])
    .not('scheduled_start', 'is', null)
    .gte('scheduled_start', fromIso)
    .lte('scheduled_start', toIso);

  const projectFocusQuery = projectUuid
    ? supabase
        .from('site_visit_events')
        .select(SITE_VISIT_SELECT)
        .eq('project_id', projectUuid)
        .in('status', PROJECT_FOCUS_STATUSES)
        .order('updated_at', { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [], error: null });

  if (salesOwnerId) {
    (unscheduledQuery as any).eq('assigned_sales_owner_id', salesOwnerId);
    (eventsQuery as any).eq('assigned_sales_owner_id', salesOwnerId);
  }

  const [unscheduledRes, eventsRes, projectFocusRes] = await Promise.all([
    unscheduledQuery,
    eventsQuery,
    projectFocusQuery,
  ]);
  const lastErr = unscheduledRes.error || eventsRes.error || projectFocusRes.error;

  if (lastErr) {
    const e = isSupportedSchemaError(lastErr)
      ? { status: 500, message: formatSupportedSchemaMessage('site_visit_events', lastErr) ?? 'Unsupported database schema for "site_visit_events". Apply the current portal schema.' }
      : formatSupabaseError('site_visit_events', lastErr);
    logPortalServerError(diagnostics, {
      status: e.status,
      message: e.message,
      error: lastErr,
      extra: { table: 'site_visit_events' },
    });
    return jsonError(e.message, e.status, diagnostics);
  }

  const salesPeople = SALES_PEOPLE;

  const isSiteVisitStage = (row: any): boolean => {
    const project = row?.projects ?? row?.project ?? null;
    const projectObj = Array.isArray(project) ? project[0] : project;
    const stageRaw = typeof projectObj?.pipeline_stage === 'string' ? projectObj.pipeline_stage : null;
    return normalizeProjectStatus(stageRaw).status === 'SITE_VISIT';
  };

  let projectFocus = projectFocusFromRows(
    Array.isArray(projectFocusRes.data) ? projectFocusRes.data : [],
  );

  if (
    projectFocus?.kind === 'create'
    && normalizeProjectStatus(projectFocus.item.project.pipelineStage).status !== 'SITE_VISIT'
  ) {
    return jsonError('Project is no longer at Site Visit stage', 409, diagnostics);
  }

  if (projectUuid && !projectFocus) {
    const projectRes = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', projectUuid)
      .maybeSingle();

    if (projectRes.error) {
      const e = formatSupabaseError('projects', projectRes.error);
      logPortalServerError(diagnostics, {
        status: e.status,
        message: e.message,
        error: projectRes.error,
        extra: { table: 'projects' },
      });
      return jsonError(e.message, e.status, diagnostics);
    }
    if (!projectRes.data) return jsonError('Project not found', 404, diagnostics);
    if (normalizeProjectStatus((projectRes.data as any).pipeline_stage).status !== 'SITE_VISIT') {
      return jsonError('Project is no longer at Site Visit stage', 409, diagnostics);
    }
    projectFocus = {
      kind: 'create',
      item: mapProjectCreateTarget(projectRes.data),
    };
  }

  return jsonOk({
    generatedAt: nowIso(),
    unscheduled: (Array.isArray(unscheduledRes.data) ? unscheduledRes.data : []).filter(isSiteVisitStage).map(mapRow),
    events: (Array.isArray(eventsRes.data) ? eventsRes.data : []).filter(isSiteVisitStage).map(mapRow),
    salesPeople,
    projectFocus,
  }, 200, diagnostics);
}
