import 'server-only';

import { buildVersionLabelMap, extractVersionNumber } from '@/lib/estimates/server';
import { fetchAllPages } from '@/lib/list/listLimits';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { SALES_PEOPLE } from '@/src/config/salesPeople';
import { buildDesignPackageDesignerLookups } from './designers';
import type {
  DesignListRow,
  DesignPackagesResponse,
  DesignRequestMutationResponse,
  DesignRequestPreview,
  DesignRequestPriorityTier,
  DesignRequestSource,
  DesignRequestStatus,
} from './types';
import { compareDesignListRows } from './group';

const ACTIVE_STATUSES = new Set<DesignRequestStatus>(['OPEN', 'IN_PROGRESS', 'BLOCKED']);
type DesignRequestRow = {
  id: string;
  project_id: string;
  estimate_id: string | null;
  request_version: number | null;
  status: string | null;
  priority_tier: string | null;
  price_total_inc_gst_cents: number | null;
  request_source: string | null;
  request_note: string | null;
  designer_note: string | null;
  assigned_designer: string | null;
  due_at: string | null;
  requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  site_address: string | null;
  contacts: unknown;
};

type EstimateRow = {
  id: string;
  project_id: string;
  created_at: string | null;
  outputs: unknown;
  total_true_cost_inc_gst: number | null;
};

type SiteVisitRow = {
  project_id: string;
  status: string | null;
  assigned_sales_owner_id: string | null;
  updated_at: string | null;
};

type QuoteVersionRow = {
  source_estimate_version_id: string | null;
  sent_at: string | null;
  quotes: { quote_ref: string | null; project_id: string | null } | Array<{ quote_ref: string | null; project_id: string | null }> | null;
};

function asStatus(value: unknown): DesignRequestStatus {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'IN_PROGRESS' || raw === 'DONE' || raw === 'CANCELLED' || raw === 'BLOCKED') return raw;
  return 'OPEN';
}

function asPriorityTier(value: unknown): DesignRequestPriorityTier {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'TIER_1' || raw === 'TIER_2' || raw === 'TIER_3' || raw === 'TIER_4') return raw;
  return 'UNPRICED';
}

function asSource(value: unknown): DesignRequestSource {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === 'calculator_generate' || raw === 'estimates_tab' || raw === 'legacy_backfill') return raw;
  return 'legacy_backfill';
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function trimString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = typeof (error as any).code === 'string' ? (error as any).code.trim() : '';
  const message = typeof (error as any).message === 'string' ? (error as any).message.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || message.includes('does not exist') || message.includes('schema cache');
}

function nowDate(): Date {
  return new Date();
}

function addBusinessDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    next.setUTCDate(next.getUTCDate() + 1);
    const day = next.getUTCDay();
    if (day === 0 || day === 6) continue;
    remaining -= 1;
  }
  return next;
}

function withUtcHour(date: Date, hour: number): Date {
  const next = new Date(date.getTime());
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}

function dueAtForTier(tier: DesignRequestPriorityTier): string | null {
  if (tier === 'TIER_1') return withUtcHour(addBusinessDays(nowDate(), 2), 9).toISOString();
  if (tier === 'TIER_2') return withUtcHour(addBusinessDays(nowDate(), 3), 9).toISOString();
  if (tier === 'TIER_3') return withUtcHour(addBusinessDays(nowDate(), 4), 9).toISOString();
  return null;
}

function centsToTier(totalIncGstCents: number | null): DesignRequestPriorityTier {
  if (typeof totalIncGstCents !== 'number' || !Number.isFinite(totalIncGstCents)) return 'UNPRICED';
  if (totalIncGstCents < 1_200_000) return 'TIER_4';
  if (totalIncGstCents < 2_400_000) return 'TIER_3';
  if (totalIncGstCents < 4_800_000) return 'TIER_2';
  return 'TIER_1';
}

function estimateTotalIncGstCents(row: Partial<EstimateRow> | null | undefined): number | null {
  if (!row) return null;
  if (typeof row.total_true_cost_inc_gst === 'number' && Number.isFinite(row.total_true_cost_inc_gst)) {
    return Math.max(0, Math.round(row.total_true_cost_inc_gst * 100));
  }
  const outputs = row.outputs && typeof row.outputs === 'object' ? (row.outputs as any) : null;
  const raw = outputs?.totals?.cost_inc_gst;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw * 100));
  return null;
}

function contactNameFromProject(project: ProjectRow): string | null {
  const raw = Array.isArray(project.contacts) ? project.contacts[0] : project.contacts ?? null;
  return trimString(raw && typeof (raw as any).name === 'string' ? (raw as any).name : null);
}

function quoteLabelForProject(project: ProjectRow): string {
  return contactNameFromProject(project) ?? trimString(project.name) ?? 'Project';
}

function appRequestId(requestUuid: string): string {
  return appIdFromUuid('dpr', requestUuid);
}

function rowVersionFromParts(parts: Array<string | null>): string {
  return parts.map((part) => part ?? '').join('|');
}

function rowVersionForDesignRequestRow(input: {
  updatedAt: string | null;
  sentAt: string | null;
  visitStatus: string | null;
  visitCompletedAt: string | null;
  notes: string;
  status: DesignRequestStatus;
  priorityTier: DesignRequestPriorityTier;
  assignedDesignerId: string | null;
}): string {
  return rowVersionFromParts([
    input.updatedAt,
    input.sentAt,
    input.visitStatus,
    input.visitCompletedAt,
    input.notes,
    input.status,
    input.priorityTier,
    input.assignedDesignerId,
  ]);
}

async function loadEstimateVersionLabels(projectIds: string[]): Promise<Map<string, string>> {
  if (!projectIds.length) return new Map();
  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('estimates')
    .select('id, project_id, created_at, outputs')
    .in('project_id', projectIds)
    .order('created_at', { ascending: true });

  if (res.error) throw res.error;

  const rows = (Array.isArray(res.data) ? res.data : []) as EstimateRow[];
  const byProject = new Map<string, EstimateRow[]>();
  for (const row of rows) {
    const bucket = byProject.get(row.project_id) ?? [];
    bucket.push(row);
    byProject.set(row.project_id, bucket);
  }

  const labels = new Map<string, string>();
  for (const bucket of byProject.values()) {
    const allHaveVersion = bucket.every((row) => extractVersionNumber(row) !== null);
    if (allHaveVersion) {
      for (const row of bucket) {
        const version = extractVersionNumber(row);
        labels.set(row.id, version !== null ? `v${version}` : 'v-');
      }
      continue;
    }
    const map = buildVersionLabelMap(bucket as any[]);
    for (const [estimateId, label] of map.entries()) labels.set(estimateId, label);
  }

  return labels;
}

async function loadRawDesignRequestsForProjects(projectIds?: string[]): Promise<DesignRequestRow[]> {
  const supabase = await getSupabaseServerAuth();
  // PR-PG1c (2026-06-16): chunked fetch defeats Supabase's project-level
  // `db-max-rows` cap. Conditional `.in('project_id', projectIds)`
  // filter is applied INSIDE the page builder so every page applies it.
  const selectCols = [
    'id',
    'project_id',
    'estimate_id',
    'request_version',
    'status',
    'priority_tier',
    'price_total_inc_gst_cents',
    'request_source',
    'request_note',
    'designer_note',
    'assigned_designer',
    'due_at',
    'requested_at',
    'started_at',
    'completed_at',
    'cancelled_at',
    'updated_at',
  ].join(',');

  const result = await fetchAllPages<unknown>((from, to) => {
    let q = supabase
      .from('design_package_requests')
      .select(selectCols)
      .order('project_id', { ascending: true })
      .order('request_version', { ascending: false });
    if (projectIds?.length) q = q.in('project_id', projectIds);
    return q.range(from, to);
  });
  return result.rows as DesignRequestRow[];
}

async function loadRawDesignRequestById(requestUuid: string): Promise<DesignRequestRow | null> {
  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('design_package_requests')
    .select(
      [
        'id',
        'project_id',
        'estimate_id',
        'request_version',
        'status',
        'priority_tier',
        'price_total_inc_gst_cents',
        'request_source',
        'request_note',
        'designer_note',
        'assigned_designer',
        'due_at',
        'requested_at',
        'started_at',
        'completed_at',
        'cancelled_at',
        'updated_at',
      ].join(','),
    )
    .eq('id', requestUuid)
    .maybeSingle();

  if (res.error) throw res.error;
  return (res.data as DesignRequestRow | null) ?? null;
}

async function hydrateDesignListRows(requests: DesignRequestRow[]): Promise<Pick<DesignPackagesResponse, 'lookups' | 'rows'>> {
  if (!requests.length) {
    return {
      lookups: { designers: buildDesignPackageDesignerLookups([]) },
      rows: [],
    };
  }
  const supabase = await getSupabaseServerAuth();

  const projectIds = Array.from(new Set(requests.map((row) => row.project_id).filter(Boolean)));
  const estimateIds = Array.from(new Set(requests.map((row) => row.estimate_id).filter((value): value is string => Boolean(value))));

  const [projectsRes, siteVisitsRes, quoteVersionsRes, estimateLabels] = await Promise.all([
    projectIds.length
      ? supabase
          .from('projects')
          .select('id, name, site_address, contacts ( name )')
          .in('id', projectIds)
      : Promise.resolve({ data: [], error: null } as any),
    projectIds.length
      ? supabase
          .from('site_visit_events')
          .select('project_id, status, assigned_sales_owner_id, updated_at')
          .in('project_id', projectIds)
      : Promise.resolve({ data: [], error: null } as any),
    estimateIds.length
      ? supabase
          .from('quote_versions')
          .select('source_estimate_version_id, sent_at, quotes ( project_id, quote_ref )')
          .in('source_estimate_version_id', estimateIds)
      : Promise.resolve({ data: [], error: null } as any),
    loadEstimateVersionLabels(projectIds),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (siteVisitsRes.error) throw siteVisitsRes.error;
  if (quoteVersionsRes.error) throw quoteVersionsRes.error;

  const projectsById = new Map<string, ProjectRow>();
  for (const row of (Array.isArray(projectsRes.data) ? projectsRes.data : []) as ProjectRow[]) {
    projectsById.set(row.id, row);
  }

  const siteVisitsByProjectId = new Map<string, SiteVisitRow>();
  for (const row of (Array.isArray(siteVisitsRes.data) ? siteVisitsRes.data : []) as SiteVisitRow[]) {
    siteVisitsByProjectId.set(row.project_id, row);
  }

  const salesPeopleById = new Map(SALES_PEOPLE.map((person) => [person.id, person]));

  const sentByEstimateId = new Map<string, { sentAt: string | null; quoteRef: string | null }>();
  for (const row of (Array.isArray(quoteVersionsRes.data) ? quoteVersionsRes.data : []) as QuoteVersionRow[]) {
    const estimateId = trimString(row.source_estimate_version_id);
    if (!estimateId) continue;
    const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
    const sentAt = trimString(row.sent_at);
    const prev = sentByEstimateId.get(estimateId);
    if (prev && (prev.sentAt ?? '') >= (sentAt ?? '')) continue;
    sentByEstimateId.set(estimateId, {
      sentAt,
      quoteRef: trimString(quote?.quote_ref),
    });
  }

  const designerIds = new Set<string>();
  const rows = requests
    .map((row) => {
      const project = projectsById.get(row.project_id);
      if (!project) return null;

      const sent = row.estimate_id ? sentByEstimateId.get(row.estimate_id) ?? null : null;
      const siteVisit = siteVisitsByProjectId.get(row.project_id) ?? null;
      const designerId = trimString(row.assigned_designer);
      const designerNote = trimString(row.designer_note);
      const requestNote = trimString(row.request_note);
      const notes = designerNote ?? requestNote ?? '';
      const updatedAt = trimString(row.updated_at) ?? trimString(row.requested_at) ?? new Date().toISOString();
      const status = asStatus(row.status);
      const visitStatus = trimString(siteVisit?.status);
      const visitCompletedAt = visitStatus === 'COMPLETED' ? trimString(siteVisit?.updated_at) : null;
      const siteVisitRep =
        siteVisit?.assigned_sales_owner_id ? salesPeopleById.get(siteVisit.assigned_sales_owner_id)?.shortLabel ?? siteVisit.assigned_sales_owner_id : null;
      if (designerId) designerIds.add(designerId);

      return {
        requestId: appRequestId(row.id),
        projectId: appIdFromUuid('proj', row.project_id),
        estimateId: row.estimate_id ? appIdFromUuid('est', row.estimate_id) : null,
        estimateVersionLabel: row.estimate_id ? estimateLabels.get(row.estimate_id) ?? null : null,
        requestVersion: Math.max(1, Number(row.request_version ?? 1) || 1),
        status,
        priorityTier: asPriorityTier(row.priority_tier),
        priceTotalIncGstCents: asPositiveInt(row.price_total_inc_gst_cents),
        requestSource: asSource(row.request_source),
        requestedAt: row.requested_at ?? row.updated_at ?? new Date().toISOString(),
        dueAt: trimString(row.due_at),
        startedAt: trimString(row.started_at),
        completedAt: trimString(row.completed_at),
        cancelledAt: trimString(row.cancelled_at),
        updatedAt,
        rowVersion: rowVersionForDesignRequestRow({
          updatedAt,
          sentAt: sent?.sentAt ?? null,
          visitStatus,
          visitCompletedAt,
          notes,
          status,
          priorityTier: asPriorityTier(row.priority_tier),
          assignedDesignerId: designerId,
        }),
        quoteName: quoteLabelForProject(project),
        projectName: trimString(project.name),
        clientName: contactNameFromProject(project),
        siteAddress: trimString(project.site_address),
        siteVisitRep,
        sentAt: sent?.sentAt ?? null,
        sentQuoteRef: sent?.quoteRef ?? null,
        visitStatus,
        visitCompletedAt,
        notes,
        requestNote,
        designerNote,
        assignedDesignerId: designerId,
      } satisfies DesignListRow;
    })
    .filter((row): row is DesignListRow => Boolean(row))
    .sort(compareDesignListRows);

  return {
    lookups: {
      designers: buildDesignPackageDesignerLookups(Array.from(designerIds).sort((a, b) => a.localeCompare(b))),
    },
    rows,
  };
}

export async function loadDesignPackages(): Promise<DesignPackagesResponse> {
  const requests = await loadRawDesignRequestsForProjects();
  const byProject = new Map<string, DesignRequestRow[]>();

  for (const row of requests) {
    const projectId = trimString(row.project_id);
    if (!projectId) continue;
    const bucket = byProject.get(projectId) ?? [];
    bucket.push(row);
    byProject.set(projectId, bucket);
  }

  const selected = Array.from(byProject.values())
    .map((rows) => rows.find((row) => ACTIVE_STATUSES.has(asStatus(row.status))) ?? rows[0] ?? null)
    .filter((row): row is DesignRequestRow => Boolean(row));

  const hydrated = await hydrateDesignListRows(selected);
  return {
    generatedAt: new Date().toISOString(),
    lookups: hydrated.lookups,
    rows: hydrated.rows,
  };
}

export async function loadProjectDesignPackageRows(projectId: string): Promise<DesignListRow[]> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const requests = await loadRawDesignRequestsForProjects([projectUuid]);
  const hydrated = await hydrateDesignListRows(requests);
  return hydrated.rows
    .slice()
    .sort((left, right) => right.requestVersion - left.requestVersion || right.updatedAt.localeCompare(left.updatedAt));
}

export async function loadDesignPackageRow(requestUuid: string): Promise<DesignListRow | null> {
  const request = await loadRawDesignRequestById(requestUuid);
  if (!request) return null;
  const hydrated = await hydrateDesignListRows([request]);
  return hydrated.rows[0] ?? null;
}

async function loadProjectEstimate(projectUuid: string, estimateUuid: string): Promise<EstimateRow> {
  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('estimates')
    .select('id, project_id, created_at, outputs, total_true_cost_inc_gst')
    .eq('id', estimateUuid)
    .eq('project_id', projectUuid)
    .maybeSingle();

  if (res.error) throw res.error;
  if (!res.data) throw new Error('Estimate not found');
  return res.data as EstimateRow;
}

async function loadProjectDesignRequestPreviewInternal(projectUuid: string, estimateUuid: string): Promise<{
  preview: DesignRequestPreview;
  nextVersion: number;
  tier: DesignRequestPriorityTier;
  priceTotalIncGstCents: number | null;
  activeRow: DesignRequestRow | null;
}> {
  const [estimate, requests] = await Promise.all([loadProjectEstimate(projectUuid, estimateUuid), loadRawDesignRequestsForProjects([projectUuid])]);
  const sorted = requests.slice().sort((a, b) => (Number(b.request_version ?? 0) || 0) - (Number(a.request_version ?? 0) || 0));
  const latest = sorted[0] ?? null;
  const active = sorted.find((row) => ACTIVE_STATUSES.has(asStatus(row.status))) ?? null;
  const nextVersion = Math.max(1, (Number(latest?.request_version ?? 0) || 0) + 1);
  const priceTotalIncGstCents = estimateTotalIncGstCents(estimate);
  const tier = centsToTier(priceTotalIncGstCents);

  return {
    preview: {
      projectId: appIdFromUuid('proj', projectUuid),
      estimateId: appIdFromUuid('est', estimateUuid),
      canSubmit: !active,
      mode: latest ? 'revision' : 'initial',
      nextVersion,
      priorityTier: tier,
      priceTotalIncGstCents,
      activeRequest: active
        ? {
            id: appRequestId(active.id),
            requestVersion: Math.max(1, Number(active.request_version ?? 1) || 1),
            status: asStatus(active.status),
            priorityTier: asPriorityTier(active.priority_tier),
          }
        : null,
    },
    nextVersion,
    tier,
    priceTotalIncGstCents,
    activeRow: active,
  };
}

export async function loadDesignRequestPreview(projectId: string, estimateId: string): Promise<DesignRequestPreview> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const estimateUuid = uuidFromAppId(estimateId, 'est');
  const { preview } = await loadProjectDesignRequestPreviewInternal(projectUuid, estimateUuid);
  return preview;
}

export async function createDesignRequest(params: {
  projectId: string;
  estimateId: string;
  requestSource: Exclude<DesignRequestSource, 'legacy_backfill'>;
  requestNote?: string | null;
  priorityTier?: DesignRequestPriorityTier | null;
}): Promise<{ requestId: string }> {
  const supabase = await getSupabaseServerAuth();
  const projectUuid = uuidFromAppId(params.projectId, 'proj');
  const estimateUuid = uuidFromAppId(params.estimateId, 'est');
  const previewData = await loadProjectDesignRequestPreviewInternal(projectUuid, estimateUuid);
  if (previewData.activeRow) {
    throw new Error(`An active design request already exists for this project (v${previewData.preview.activeRequest?.requestVersion ?? '?'})`);
  }
  const selectedTier = params.priorityTier ?? previewData.tier;
  const dueAt = dueAtForTier(selectedTier);

  const insertRes = await supabase
    .from('design_package_requests')
    .insert({
      project_id: projectUuid,
      estimate_id: estimateUuid,
      request_version: previewData.nextVersion,
      status: 'OPEN',
      priority_tier: selectedTier,
      price_total_inc_gst_cents: previewData.priceTotalIncGstCents,
      request_source: params.requestSource,
      request_note: trimString(params.requestNote) ?? null,
      due_at: dueAt,
      requested_at: nowDate().toISOString(),
    } as any)
    .select('id')
    .single();

  if (insertRes.error || !insertRes.data) {
    const code = typeof insertRes.error?.code === 'string' ? insertRes.error.code.trim() : '';
    if (code === '23505') {
      throw new Error('Another active design request was created first. Refresh and try again.');
    }
    throw insertRes.error ?? new Error('Failed to create design request');
  }

  const requestUuid = String(insertRes.data.id);
  return { requestId: appRequestId(requestUuid) };
}

async function requireExistingRequest(requestUuid: string): Promise<DesignRequestRow> {
  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('design_package_requests')
    .select(
      [
        'id',
        'project_id',
        'estimate_id',
        'request_version',
        'status',
        'priority_tier',
        'price_total_inc_gst_cents',
        'request_source',
        'request_note',
        'designer_note',
        'assigned_designer',
        'due_at',
        'requested_at',
        'started_at',
        'completed_at',
        'cancelled_at',
        'updated_at',
      ].join(','),
    )
    .eq('id', requestUuid)
    .maybeSingle();

  if (res.error) throw res.error;
  if (!res.data) throw new Error('Design request not found');
  return res.data as unknown as DesignRequestRow;
}

export async function markDesignRequestStarted(requestId: string): Promise<{ requestId: string }> {
  const supabase = await getSupabaseServerAuth();
  const requestUuid = uuidFromAppId(requestId, 'dpr');
  const current = await requireExistingRequest(requestUuid);
  const status = asStatus(current.status);
  if (status === 'DONE' || status === 'CANCELLED') throw new Error('Cannot start a completed design request');

  const patch: Record<string, unknown> = {
    status: 'IN_PROGRESS',
  };
  if (!trimString(current.started_at)) patch.started_at = nowDate().toISOString();

  const updateRes = await supabase.from('design_package_requests').update(patch as any).eq('id', requestUuid);
  if (updateRes.error) throw updateRes.error;

  return { requestId: appRequestId(requestUuid) };
}

export async function markDesignRequestDone(requestId: string): Promise<{ requestId: string; projectUuid: string }> {
  const supabase = await getSupabaseServerAuth();
  const requestUuid = uuidFromAppId(requestId, 'dpr');
  const current = await requireExistingRequest(requestUuid);
  const status = asStatus(current.status);
  if (status === 'DONE') return { requestId: appRequestId(requestUuid), projectUuid: current.project_id };
  if (status === 'CANCELLED') throw new Error('Cannot complete a cancelled design request');

  const nowIso = nowDate().toISOString();
  const patch: Record<string, unknown> = {
    status: 'DONE',
    completed_at: nowIso,
  };
  if (!trimString(current.started_at)) patch.started_at = nowIso;

  const updateRes = await supabase.from('design_package_requests').update(patch as any).eq('id', requestUuid);
  if (updateRes.error) throw updateRes.error;

  return { requestId: appRequestId(requestUuid), projectUuid: current.project_id };
}

export async function setDesignRequestStatus(
  requestId: string,
  nextStatus: Exclude<DesignRequestStatus, 'IN_PROGRESS' | 'DONE'>,
): Promise<DesignRequestMutationResponse> {
  const supabase = await getSupabaseServerAuth();
  const requestUuid = uuidFromAppId(requestId, 'dpr');
  const current = await requireExistingRequest(requestUuid);
  const currentStatus = asStatus(current.status);
  if (currentStatus === nextStatus) return { ok: true, requestId: appRequestId(requestUuid) };
  if (currentStatus === 'DONE' || currentStatus === 'CANCELLED') {
    throw new Error('Completed requests are read-only');
  }

  const nowIso = nowDate().toISOString();
  const patch: Record<string, unknown> = {
    status: nextStatus,
  };
  if (nextStatus === 'OPEN') {
    patch.completed_at = null;
    patch.cancelled_at = null;
  }
  if (nextStatus === 'CANCELLED') {
    patch.cancelled_at = nowIso;
  }

  const updateRes = await supabase.from('design_package_requests').update(patch as any).eq('id', requestUuid);
  if (updateRes.error) throw updateRes.error;
  return { ok: true, requestId: appRequestId(requestUuid) };
}

export async function setDesignRequestPriorityTier(
  requestId: string,
  nextTier: DesignRequestPriorityTier,
): Promise<DesignRequestMutationResponse> {
  const supabase = await getSupabaseServerAuth();
  const requestUuid = uuidFromAppId(requestId, 'dpr');
  const current = await requireExistingRequest(requestUuid);
  const currentTier = asPriorityTier(current.priority_tier);
  if (currentTier === nextTier) return { ok: true, requestId: appRequestId(requestUuid) };

  const status = asStatus(current.status);
  const dueAt = status === 'DONE' || status === 'CANCELLED' ? trimString(current.due_at) : dueAtForTier(nextTier);
  const updateRes = await supabase
    .from('design_package_requests')
    .update({
      priority_tier: nextTier,
      due_at: dueAt,
    } as any)
    .eq('id', requestUuid);

  if (updateRes.error) throw updateRes.error;
  return { ok: true, requestId: appRequestId(requestUuid) };
}

export async function setDesignRequestAssignedDesigner(
  requestId: string,
  designerId: string | null,
): Promise<DesignRequestMutationResponse> {
  const supabase = await getSupabaseServerAuth();
  const requestUuid = uuidFromAppId(requestId, 'dpr');
  await requireExistingRequest(requestUuid);

  const normalized = trimString(designerId) ?? null;
  const updateRes = await supabase
    .from('design_package_requests')
    .update({ assigned_designer: normalized } as any)
    .eq('id', requestUuid);

  if (updateRes.error) throw updateRes.error;
  return { ok: true, requestId: appRequestId(requestUuid) };
}

export async function updateDesignRequestDesignerNote(requestId: string, note: string | null): Promise<{ requestId: string }> {
  const supabase = await getSupabaseServerAuth();
  const requestUuid = uuidFromAppId(requestId, 'dpr');
  await requireExistingRequest(requestUuid);

  const normalized = trimString(note) ?? null;
  const updateRes = await supabase
    .from('design_package_requests')
    .update({ designer_note: normalized } as any)
    .eq('id', requestUuid);

  if (updateRes.error) throw updateRes.error;
  return { requestId: appRequestId(requestUuid) };
}

export async function markDesignRequestOrLegacyTicketDoneByUuid(rawId: string): Promise<{ projectUuid: string }> {
  const supabase = await getSupabaseServerAuth();
  try {
    const request = await requireExistingRequest(rawId);
    const done = await markDesignRequestDone(appRequestId(request.id));
    return { projectUuid: done.projectUuid };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      // Fall back to the legacy table in environments that have not run the new migration yet.
    } else if (!(error instanceof Error) || error.message !== 'Design request not found') {
      throw error;
    }
  }

  const ticketRes = await supabase.from('design_package_tickets').select('id, project_id').eq('id', rawId).maybeSingle();
  if (ticketRes.error) throw ticketRes.error;
  if (!ticketRes.data) throw new Error('Design request not found');

  const updateRes = await supabase
    .from('design_package_tickets')
    .update({ status: 'DONE', completed_at: new Date().toISOString() } as any)
    .eq('id', rawId);

  if (updateRes.error) throw updateRes.error;
  return { projectUuid: String(ticketRes.data.project_id) };
}

export { isMissingSchemaError };
