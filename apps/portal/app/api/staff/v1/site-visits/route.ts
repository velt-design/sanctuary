import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { formatSupabaseError } from '@/lib/supabase/apiErrors';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { SALES_PEOPLE } from '@/src/config/salesPeople';

export const runtime = 'nodejs';

type SupabaseLikeError = { code?: unknown; message?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isMissingColumnError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message).toLowerCase();
  return code === 'PGRST204' || code === '42703' || msg.includes('does not exist') || msg.includes('missing') || msg.includes('undefined column');
}

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

function mapRow(row: any): any {
  const project = row?.projects ?? row?.project ?? null;
  const projectObj = Array.isArray(project) ? project[0] : project;
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
    status: String(row?.status ?? 'UNSCHEDULED'),
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

export async function GET(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  const fromIso = asIso(url.searchParams.get('from'));
  const toIso = asIso(url.searchParams.get('to'));
  const salesOwnerId = (url.searchParams.get('salesOwnerId') || '').trim() || null;

  if (!fromIso || !toIso) return jsonError('from and to are required (ISO)', 400);

  const selectVariants = [
    // Preferred select (avoid schema drift, like missing `projects.region`).
    'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, customer_notified, last_notified_at, cancel_reason, created_at, updated_at,' +
      ' projects!inner( id, name, site_address, pipeline_stage, site_visit_priority_tier, contact_id, contacts ( id, name, email, phone ) )',
    // Full select for DBs that include `projects.region`.
    'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, customer_notified, last_notified_at, cancel_reason, created_at, updated_at,' +
      ' projects!inner( id, name, region, site_address, pipeline_stage, site_visit_priority_tier, contact_id, contacts ( id, name, email, phone ) )',
    // Fallbacks without tier for older schemas.
    'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, customer_notified, last_notified_at, cancel_reason, created_at, updated_at,' +
      ' projects!inner( id, name, site_address, pipeline_stage, contact_id, contacts ( id, name, email, phone ) )',
    'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner_id, notes, customer_notified, last_notified_at, cancel_reason, created_at, updated_at,' +
      ' projects!inner( id, name, region, site_address, pipeline_stage, contact_id, contacts ( id, name, email, phone ) )',
    // site_visit_events may still have legacy `assigned_sales_owner` column name.
    'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner, notes, created_at, updated_at,' +
      ' projects!inner( id, name, site_address, pipeline_stage, site_visit_priority_tier, contact_id, contacts ( id, name, email, phone ) )',
    'id, project_id, status, scheduled_start, scheduled_end, assigned_sales_owner, notes, created_at, updated_at,' +
      ' projects!inner( id, name, site_address, pipeline_stage, contact_id, contacts ( id, name, email, phone ) )',
  ] as const;

  const runWithSelect = async (select: string) => {
    const hasAssignedSalesOwnerId = select.includes('assigned_sales_owner_id');
    const unscheduledQuery = supabaseServer
      .from('site_visit_events')
      .select(select)
      .eq('status', 'UNSCHEDULED');

    const eventsQuery = supabaseServer
      .from('site_visit_events')
      .select(select)
      .in('status', ['TENTATIVE', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'])
      .not('scheduled_start', 'is', null)
      .gte('scheduled_start', fromIso)
      .lte('scheduled_start', toIso);

    if (salesOwnerId) {
      (unscheduledQuery as any).eq(hasAssignedSalesOwnerId ? 'assigned_sales_owner_id' : 'assigned_sales_owner', salesOwnerId);
      (eventsQuery as any).eq(hasAssignedSalesOwnerId ? 'assigned_sales_owner_id' : 'assigned_sales_owner', salesOwnerId);
    }

    const [unscheduledRes, eventsRes] = await Promise.all([unscheduledQuery, eventsQuery]);
    return { unscheduledRes, eventsRes };
  };

  let unscheduledRes: any = null;
  let eventsRes: any = null;
  let lastErr: any = null;

  for (const select of selectVariants) {
    const res = await runWithSelect(select);
    if (!res.unscheduledRes.error && !res.eventsRes.error) {
      unscheduledRes = res.unscheduledRes;
      eventsRes = res.eventsRes;
      lastErr = null;
      break;
    }
    const err = res.unscheduledRes.error || res.eventsRes.error;
    lastErr = err;
    if (!isMissingColumnError(err)) break;
  }

  if (lastErr) {
    const e = formatSupabaseError('site_visit_events', lastErr);
    return jsonError(e.message, e.status);
  }

  const salesPeople = SALES_PEOPLE;

  const isSiteVisitStage = (row: any): boolean => {
    const project = row?.projects ?? row?.project ?? null;
    const projectObj = Array.isArray(project) ? project[0] : project;
    const stageRaw = typeof projectObj?.pipeline_stage === 'string' ? projectObj.pipeline_stage : null;
    return normalizeProjectStatus(stageRaw).status === 'SITE_VISIT';
  };

  return jsonOk({
    generatedAt: nowIso(),
    unscheduled: (Array.isArray(unscheduledRes.data) ? unscheduledRes.data : []).filter(isSiteVisitStage).map(mapRow),
    events: (Array.isArray(eventsRes.data) ? eventsRes.data : []).filter(isSiteVisitStage).map(mapRow),
    salesPeople,
  });
}
