import type { Project, ProjectStatus } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import { nowIso } from '@/lib/utils/time';
import { fetchAllPages } from '@/lib/list/listLimits';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
import { formatSupportedSchemaMessage } from '@/lib/supabase/schemaGuard';
import { apiJson } from '@/lib/repo/apiClient';

function toPostgrestError(value: unknown): PostgrestErrorLike | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  return {
    message: v.message,
    code: v.code,
    details: v.details,
    hint: v.hint,
  };
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
  const details = typeof pg?.details === 'string' && pg.details.trim() ? pg.details.trim() : '';
  const hint = typeof pg?.hint === 'string' && pg.hint.trim() ? pg.hint.trim() : '';
  const extras = [details, hint].filter(Boolean).join(' · ');
  const schemaMessage = formatSupportedSchemaMessage(table, error);
  const message = schemaMessage ?? `Supabase ${code ? `${code}: ` : ''}${msg}${extras ? ` (${extras})` : ''}${hostSuffix()}`;
  return new SupabaseRepoError(message, {
    table,
    supabaseUrl,
    supabaseHost,
    postgrestUrl,
    postgrestHost,
    postgrestError: pg,
  });
}

function normaliseProjectShape(p: Project): Project {
  const normalized = normalizeProjectStatus((p as any).status);
  const nextActionDate =
    typeof (p as any).nextActionDate === 'string'
      ? (p as any).nextActionDate
      : typeof (p as any).followUpDate === 'string'
        ? (p as any).followUpDate
        : null;
  const followUpDate = typeof (p as any).followUpDate === 'string' ? (p as any).followUpDate : nextActionDate;
  return {
    ...p,
    status: normalized.status,
    isLost: typeof (p as any).isLost === 'boolean' ? (p as any).isLost : normalized.isLost,
    isArchived: typeof (p as any).isArchived === 'boolean' ? (p as any).isArchived : normalized.isArchived,
    legacyStatus:
      typeof (p as any).legacyStatus === 'string' && (p as any).legacyStatus.trim() ? (p as any).legacyStatus : normalized.legacyStatus,
    ...(typeof (p as any).nextActionDate === 'string' || nextActionDate ? { nextActionDate } : null),
    followUpDate: followUpDate ?? null,
  };
}

function projectFromRow(row: any): Project {
  const id = typeof row?.id === 'string' ? row.id : '';
  const createdAt = typeof row?.created_at === 'string' ? row.created_at : nowIso();
  const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : createdAt;
  const contactId = typeof row?.contact_id === 'string' ? appIdFromUuid('ct', row.contact_id) : undefined;
  const projectName = typeof row?.name === 'string' ? row.name : '';
  const siteAddress = typeof row?.site_address === 'string' ? row.site_address : '';
  const status = typeof row?.pipeline_stage === 'string' ? row.pipeline_stage : 'NEW';
  const followUpDate = typeof row?.follow_up_date === 'string' ? row.follow_up_date : null;
  const isArchived = Boolean(row?.archived_at);
  const notes = typeof row?.notes === 'string' ? row.notes : '';
  const depositAmountCents = typeof row?.deposit_amount_cents === 'number' && Number.isFinite(row.deposit_amount_cents) ? row.deposit_amount_cents : null;
  const depositPaidDate = typeof row?.deposit_paid_date === 'string' ? row.deposit_paid_date : null;
  const finalPaymentDate = typeof row?.final_payment_date === 'string' ? row.final_payment_date : null;

  return normaliseProjectShape({
    id: appIdFromUuid('proj', id),
    createdAt,
    updatedAt,
    ...(contactId ? { contactId } : null),
    projectName,
    name: projectName,
    region: typeof row?.region === 'string' ? row.region : undefined,
    quoteRef: typeof row?.quote_ref === 'string' ? row.quote_ref : undefined,
    siteAddress: siteAddress || undefined,
    address: siteAddress || undefined,
    status: status as any,
    isArchived,
    nextActionDate: followUpDate,
    followUpDate,
    depositAmountCents,
    depositPaidDate,
    finalPaymentDate,
    notes,
  } as Project);
}

function isUniqueViolation(error: unknown): boolean {
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' ? pg.message : '';
  return code === '23505' || /duplicate key value/i.test(msg) || /unique constraint/i.test(msg);
}

async function insertWithUnknownColumnRetry(payloadIn: Record<string, any>): Promise<{ data: any | null; error: any | null }> {
  const supabase = getSupabaseBrowser();
  const payload = { ...payloadIn };
  const res = await supabase.from('projects').insert(payload as any).select('*').single();
  if (!res.error && res.data) return { data: res.data, error: null };
  return { data: null, error: res.error };
}

async function updateWithUnknownColumnRetry(uuid: string, payloadIn: Record<string, any>): Promise<{ data: any | null; error: any | null }> {
  const supabase = getSupabaseBrowser();
  const payload = { ...payloadIn };
  const res = await supabase.from('projects').update(payload as any).eq('id', uuid).select('*').single();
  if (!res.error && res.data) return { data: res.data, error: null };
  return { data: null, error: res.error };
}

export async function listProjects(options?: { includeArchived?: boolean }): Promise<Project[]> {
  const supabase = getSupabaseBrowser();
  const includeArchived = Boolean(options?.includeArchived);
  // PR-PG1c (2026-06-16): chunked fetch defeats Supabase's project-level
  // `db-max-rows` cap. Return shape stays `Project[]` for back-compat.
  let result;
  try {
    result = await fetchAllPages<any>((from, to) => {
      let q = supabase.from('projects').select('*');
      if (!includeArchived) q = q.is('archived_at', null);
      return q.order('created_at', { ascending: false }).range(from, to);
    });
  } catch (err) {
    throw wrapError('projects', err);
  }
  const projects = result.rows.map(projectFromRow);
  return projects.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listProjectsForContact(contactId: string): Promise<Project[]> {
  const supabase = getSupabaseBrowser();
  const contactUuid = uuidFromAppId(contactId, 'ct');
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('contact_id', contactUuid)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw wrapError('projects', error);
  const projects = (Array.isArray(data) ? data : []).map(projectFromRow);
  return projects.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const supabase = getSupabaseBrowser();
    const uuid = uuidFromAppId(id, 'proj');
    const { data, error } = await supabase.from('projects').select('*').eq('id', uuid).single();
    if (error || !data) return null;
    return projectFromRow(data);
  } catch {
    return null;
  }
}

export async function upsertProject(project: Project): Promise<Project> {
  const now = nowIso();
  const uuid = uuidFromAppId(project.id, 'proj');
  const projectName = (project.projectName ?? project.name ?? '').trim();
  if (!projectName) throw new Error('Project name is required.');

  const contactUuid = project.contactId ? uuidFromAppId(project.contactId, 'ct') : null;
  const payload: any = {
    id: uuid,
    contact_id: contactUuid,
    name: projectName,
    quote_ref: typeof project.quoteRef === 'string' ? project.quoteRef.trim() || null : null,
    region: typeof project.region === 'string' ? project.region.trim() || null : null,
    site_address:
      typeof project.siteAddress === 'string' ? project.siteAddress.trim() || null : typeof project.address === 'string' ? project.address.trim() || null : null,
    pipeline_stage: (project.status ?? 'NEW') as any,
    deposit_amount_cents:
      typeof project.depositAmountCents === 'number' && Number.isFinite(project.depositAmountCents)
        ? Math.round(project.depositAmountCents)
        : null,
    deposit_paid_date: typeof project.depositPaidDate === 'string' ? project.depositPaidDate : null,
    final_payment_date: typeof project.finalPaymentDate === 'string' ? project.finalPaymentDate : null,
    notes: typeof project.notes === 'string' ? project.notes : '',
    created_at: typeof project.createdAt === 'string' && project.createdAt.trim() ? project.createdAt.trim() : now,
    updated_at: typeof project.updatedAt === 'string' && project.updatedAt.trim() ? project.updatedAt.trim() : now,
  };

  const insertRes = await insertWithUnknownColumnRetry(payload);
  if (!insertRes.error && insertRes.data) return projectFromRow(insertRes.data);
  if (!isUniqueViolation(insertRes.error)) throw wrapError('projects', insertRes.error);

  const updatePayload: any = { ...payload };
  delete updatePayload.id;
  delete updatePayload.created_at;

  const { data, error } = await updateWithUnknownColumnRetry(uuid, updatePayload);
  if (error || !data) throw wrapError('projects', error);
  return projectFromRow(data);
}

export async function addProjectActivity(
  projectId: string,
  _event: Omit<NonNullable<Project['activity']>[number], 'id' | 'createdAt'>,
  _opts?: { force?: boolean },
): Promise<Project> {
  // Activity events are intentionally out-of-scope for now; keep callers working.
  const p = await getProject(projectId);
  if (!p) throw new Error('Project not found');
  return p;
}

export async function correctProjectStage(
  projectId: string,
  status: ProjectStatus,
  opts?: { reason?: string | null; siteVisitPriorityTier?: 1 | 2 | null },
): Promise<{ project: Project; rollback: boolean }> {
  const payload: Record<string, unknown> = {
    toStage: status,
    reason: typeof opts?.reason === 'string' ? opts.reason : null,
  };
  if (status === 'SITE_VISIT' && opts?.siteVisitPriorityTier) {
    payload.site_visit_priority_tier = opts.siteVisitPriorityTier;
  }

  const res = await apiJson<{ project?: any; rollback?: boolean }>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/stage/correct`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  const project = res?.project ? projectFromRow(res.project) : await getProject(projectId);
  if (!project) throw new Error('Project not found');

  return {
    project,
    rollback: Boolean(res?.rollback),
  };
}

export async function deleteProject(
  id: string,
  opts?: { confirmText?: string; reason?: string | null },
): Promise<{ stage?: string; requiredConfirmation?: string; auditLogged?: boolean }> {
  const payload = {
    confirmText: typeof opts?.confirmText === 'string' ? opts.confirmText : 'DELETE',
    reason: typeof opts?.reason === 'string' ? opts.reason : null,
  };
  const res = await apiJson<{ stage?: string; requiredConfirmation?: string; auditLogged?: boolean }>(
    `/api/staff/v1/projects/${encodeURIComponent(id)}/delete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return {
    stage: typeof res?.stage === 'string' ? res.stage : undefined,
    requiredConfirmation: typeof res?.requiredConfirmation === 'string' ? res.requiredConfirmation : undefined,
    auditLogged: typeof res?.auditLogged === 'boolean' ? res.auditLogged : undefined,
  };
}
