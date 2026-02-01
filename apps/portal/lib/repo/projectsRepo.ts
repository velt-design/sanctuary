import type { Project, ProjectStatus } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import { nowIso } from '@/lib/utils/time';
import { newId } from '@/lib/utils/id';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
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
  const message = `Supabase ${code ? `${code}: ` : ''}${msg}${extras ? ` (${extras})` : ''}${hostSuffix()}`;
  return new SupabaseRepoError(message, {
    table,
    supabaseUrl,
    supabaseHost,
    postgrestUrl,
    postgrestHost,
    postgrestError: pg,
  });
}

function missingColumnFromError(error: unknown): string | null {
  const pg = toPostgrestError(error);
  if (!pg) return null;
  const code = typeof pg.code === 'string' ? pg.code.trim() : '';
  if (code !== 'PGRST204') return null;
  const msg = typeof pg.message === 'string' ? pg.message : '';
  const match = msg.match(/'([^']+)' column/i);
  return match ? match[1] : null;
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
  const notes = typeof row?.notes === 'string' ? row.notes : '';

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
    nextActionDate: followUpDate,
    followUpDate,
    notes,
  } as Project);
}

function isUniqueViolation(error: unknown): boolean {
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' ? pg.message : '';
  return code === '23505' || /duplicate key value/i.test(msg) || /unique constraint/i.test(msg);
}

function upsertProjectInList(list: Project[], project: Project): Project[] {
  const next = list.filter((p) => p.id !== project.id);
  next.push(project);
  return next.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

function removeProjectFromList(list: Project[], projectId: string): Project[] {
  return list.filter((p) => p.id !== projectId);
}

async function insertWithUnknownColumnRetry(payloadIn: Record<string, any>): Promise<{ data: any | null; error: any | null }> {
  const supabase = getSupabaseBrowser();
  const payload = { ...payloadIn };
  let lastError: any | null = null;
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await supabase.from('projects').insert(payload as any).select('*').single();
    if (!res.error && res.data) return { data: res.data, error: null };

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      removedColumns.push(missing);
      delete payload[missing];
      lastError = res.error;
      continue;
    }

    lastError = res.error;
    return { data: null, error: res.error };
  }

  const fallback = { message: 'Supabase insert failed after retries', code: 'CLIENT_RETRY', details: removedColumns.length ? `Removed columns: ${removedColumns.join(', ')}` : null };
  return { data: null, error: lastError ?? fallback };
}

async function updateWithUnknownColumnRetry(uuid: string, payloadIn: Record<string, any>): Promise<{ data: any | null; error: any | null }> {
  const supabase = getSupabaseBrowser();
  const payload = { ...payloadIn };
  let lastError: any | null = null;
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await supabase.from('projects').update(payload as any).eq('id', uuid).select('*').single();
    if (!res.error && res.data) return { data: res.data, error: null };

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      removedColumns.push(missing);
      delete payload[missing];
      lastError = res.error;
      continue;
    }

    lastError = res.error;
    return { data: null, error: res.error };
  }

  const fallback = { message: 'Supabase update failed after retries', code: 'CLIENT_RETRY', details: removedColumns.length ? `Removed columns: ${removedColumns.join(', ')}` : null };
  return { data: null, error: lastError ?? fallback };
}

export async function listProjects(): Promise<Project[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw wrapError('projects', error);
  const projects = (Array.isArray(data) ? data : []).map(projectFromRow);
  return projects.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listProjectsForContact(contactId: string): Promise<Project[]> {
  const supabase = getSupabaseBrowser();
  const contactUuid = uuidFromAppId(contactId, 'ct');
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('contact_id', contactUuid)
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

export async function createProject(data: {
  contactId: string;
  projectName: string;
  region?: string;
  siteAddress?: string;
  quoteRef?: string;
  status?: Project['status'];
}): Promise<Project> {
  const now = nowIso();
  if (!data.contactId.trim()) throw new Error('Contact is required.');
  if (!data.projectName.trim()) throw new Error('Project name is required.');

  const project: Project = {
    id: newId('proj'),
    createdAt: now,
    updatedAt: now,
    status: (data.status ?? 'NEW') as any,
    contactId: data.contactId.trim(),
    projectName: data.projectName.trim(),
    region: data.region,
    siteAddress: data.siteAddress,
    quoteRef: data.quoteRef,
    nextActionDate: null,
    followUpDate: null,
    notes: '',
    name: data.projectName.trim(),
    address: data.siteAddress,
  };

  const uuid = uuidFromAppId(project.id, 'proj');
  const contactUuid = uuidFromAppId(project.contactId ?? '', 'ct');

  const payload: any = {
    id: uuid,
    contact_id: contactUuid || null,
    name: project.projectName ?? project.name ?? '',
    quote_ref: project.quoteRef ?? null,
    region: project.region ?? null,
    site_address: project.siteAddress ?? project.address ?? null,
    pipeline_stage: (project.status ?? 'NEW') as any,
    follow_up_date: null,
    notes: project.notes ?? '',
    created_at: project.createdAt,
    updated_at: project.updatedAt ?? project.createdAt,
  };

  const { data: row, error } = await insertWithUnknownColumnRetry(payload);
  if (error || !row) {
    if (process.env.NODE_ENV !== 'production') {
      (globalThis as any).__SP_PROJECT_INSERT_DEBUG__ = {
        host: supabaseHostFromUrl(supabaseRuntimeUrl()),
        payload,
        error,
      };
      console.error('[projects] createProject insert failed', { host: supabaseHostFromUrl(supabaseRuntimeUrl()), payload, error });
    }
    throw wrapError('projects', error);
  }
  return projectFromRow(row);
}

export async function upsertProject(project: Project): Promise<Project> {
  const now = nowIso();
  const uuid = uuidFromAppId(project.id, 'proj');
  const projectName = (project.projectName ?? project.name ?? '').trim();
  if (!projectName) throw new Error('Project name is required.');

  const contactUuid = project.contactId ? uuidFromAppId(project.contactId, 'ct') : null;
  const followUpDate = (project.nextActionDate ?? project.followUpDate) || null;

  const payload: any = {
    id: uuid,
    contact_id: contactUuid,
    name: projectName,
    quote_ref: typeof project.quoteRef === 'string' ? project.quoteRef.trim() || null : null,
    region: typeof project.region === 'string' ? project.region.trim() || null : null,
    site_address:
      typeof project.siteAddress === 'string' ? project.siteAddress.trim() || null : typeof project.address === 'string' ? project.address.trim() || null : null,
    pipeline_stage: (project.status ?? 'NEW') as any,
    follow_up_date: typeof followUpDate === 'string' ? followUpDate : null,
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

export async function updateProject(
  id: string,
  patch: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> & { contactId?: string; projectName?: string },
  _opts?: { expectedVersion?: number; force?: boolean; addActivity?: { type: string; message: string; meta?: unknown } },
): Promise<Project> {
  const prev = await getProject(id);
  if (!prev) throw new Error('Project not found');

  const now = nowIso();
  const uuid = uuidFromAppId(id, 'proj');

  const next = normaliseProjectShape({
    ...prev,
    ...patch,
    ...(typeof patch.projectName === 'string' ? { projectName: patch.projectName.trim(), name: patch.projectName.trim() } : null),
    ...(typeof patch.siteAddress === 'string' ? { siteAddress: patch.siteAddress.trim(), address: patch.siteAddress.trim() } : null),
    ...(typeof patch.contactId === 'string' ? { contactId: patch.contactId.trim() || undefined } : null),
    updatedAt: now,
  });

  if (typeof next.projectName === 'string' && !next.projectName.trim()) throw new Error('Project name is required.');

  const contactUuid =
    typeof next.contactId === 'string' && next.contactId.trim() ? uuidFromAppId(next.contactId.trim(), 'ct') : null;

  const payload: any = {
    contact_id: contactUuid,
    name: (next.projectName ?? next.name ?? '').trim(),
    quote_ref: typeof next.quoteRef === 'string' ? next.quoteRef.trim() || null : null,
    region: typeof next.region === 'string' ? next.region.trim() || null : null,
    site_address: typeof next.siteAddress === 'string' ? next.siteAddress.trim() || null : typeof next.address === 'string' ? next.address.trim() || null : null,
    pipeline_stage: (next.status ?? 'NEW') as any,
    follow_up_date: typeof next.nextActionDate === 'string' ? next.nextActionDate : typeof next.followUpDate === 'string' ? next.followUpDate : null,
    notes: typeof next.notes === 'string' ? next.notes : '',
    updated_at: now,
  };

  const { data: row, error } = await updateWithUnknownColumnRetry(uuid, payload);
  if (error || !row) throw wrapError('projects', error);
  return projectFromRow(row);
}

export async function updateProjectFields(
  projectId: string,
  patch: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>,
  opts?: { expectedVersion?: number; force?: boolean; addActivity?: { type: string; message: string; meta?: unknown } },
): Promise<Project> {
  return updateProject(projectId, patch as any, opts as any);
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

export async function setProjectStatus(projectId: string, status: ProjectStatus, opts?: { force?: boolean }): Promise<Project> {
  const prev = await getProject(projectId);
  if (!prev) throw new Error('Project not found');
  if (prev.status === status) return prev;

  try {
    const res = await apiJson<{ project: any }>(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/stage`, {
      method: 'POST',
      body: JSON.stringify({ toStage: status, reason: opts?.force ? 'force' : null }),
    });
    if (res?.project) return projectFromRow(res.project);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    throw msg ? new Error(msg) : new Error('Failed to update status');
  }

  const refreshed = await getProject(projectId);
  if (!refreshed) throw new Error('Project not found');
  return refreshed;
}

export async function setProjectFollowUpDate(projectId: string, followUpDate: string | null, opts?: { force?: boolean }): Promise<Project> {
  const prev = await getProject(projectId);
  if (!prev) throw new Error('Project not found');
  return updateProject(projectId, { nextActionDate: followUpDate, followUpDate } as any, opts as any);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const uuid = uuidFromAppId(id, 'proj');
  const { error } = await supabase.from('projects').delete().eq('id', uuid);
  if (error) throw wrapError('projects', error);
}
