import type { Estimate, EstimateStatus } from '@/lib/types/estimate';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1, migrateLegacyCalculatorInputsToV2 } from '@/lib/types/calculator';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { MAX_LIST_FETCH_ROWS } from '@/lib/list/listLimits';
import { appIdFromUuid, isRecord, uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError, type PostgrestErrorLike } from '@/lib/supabase/repoError';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';

function toPostgrestError(value: unknown): PostgrestErrorLike | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  return { message: v.message, code: v.code, details: v.details, hint: v.hint };
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
  const message = `Supabase ${code ? `${code}: ` : ''}${msg}${hostSuffix()}`;
  return new SupabaseRepoError(message, {
    table,
    supabaseUrl,
    supabaseHost,
    postgrestUrl,
    postgrestHost,
    postgrestError: pg,
  });
}

function normaliseStatus(value: unknown): EstimateStatus {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'archived') return 'archived';
  return 'draft';
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundTo2(n: number | null): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function estimateFromRow(row: any): Estimate {
  const id = typeof row?.id === 'string' ? row.id : '';
  const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
  const createdAt = typeof row?.created_at === 'string' ? row.created_at : nowIso();
  const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : createdAt;
  const status = normaliseStatus(row?.status);

  const inputs = isRecord(row?.inputs) ? (row.inputs as any) : {};
  const outputsRaw = isRecord(row?.outputs) ? (row.outputs as any) : {};
  const warnings = Array.isArray(row?.warnings) ? (row.warnings as any[]) : Array.isArray(outputsRaw?.warnings) ? outputsRaw.warnings : [];

  const outputs = {
    cost_snapshot_version: outputsRaw?.cost_snapshot_version === 'v2' ? 'v2' : 'v1',
    materials: outputsRaw?.materials ?? {},
    install: outputsRaw?.install ?? {},
    overhead: outputsRaw?.overhead ?? {},
    totals: outputsRaw?.totals ?? {},
    warnings,
    pergolas: Array.isArray(outputsRaw?.pergolas) ? outputsRaw.pergolas : undefined,
    siteShared:
      outputsRaw?.siteShared && typeof outputsRaw.siteShared === 'object'
        ? outputsRaw.siteShared
        : outputsRaw?.shared && typeof outputsRaw.shared === 'object'
          ? outputsRaw.shared
          : undefined,
    shared:
      outputsRaw?.shared && typeof outputsRaw.shared === 'object'
        ? outputsRaw.shared
        : outputsRaw?.siteShared && typeof outputsRaw.siteShared === 'object'
          ? outputsRaw.siteShared
          : undefined,
  };

  const configVersions = isRecord(outputsRaw?.configVersions)
    ? (outputsRaw.configVersions as any)
    : { pricebook: '', installActions: '', overheads: '', rules: '', manifest: '' };

  const derived = outputsRaw?.derived ?? {};

  const estimate: Estimate = {
    id: appIdFromUuid('est', id),
    projectId: appIdFromUuid('proj', projectId),
    createdAt,
    updatedAt,
    status,
    inputs: inputs as any,
    derived: derived as any,
    outputs: outputs as any,
    configVersions: configVersions as any,
    ...(outputsRaw?.projectSnapshot ? { projectSnapshot: outputsRaw.projectSnapshot as any } : null),
    ...(outputsRaw?.snapshot ? { snapshot: outputsRaw.snapshot as any } : null),
    ...(typeof outputsRaw?.version === 'number' ? { version: outputsRaw.version } : null),
  };

  return estimate;
}

function computeSummaryFields(estimate: Estimate): {
  crewHours: number | null;
  durationDays: number | null;
  materialsEx: number | null;
  installPayoutEx: number | null;
  overheadEx: number | null;
  totalEx: number | null;
  totalInc: number | null;
} {
  const derivedDuration = deriveDurationHoursFromEstimate(estimate);
  const crewHours = roundTo2(derivedDuration.crewHours);
  const durationDays = roundTo2(derivedDuration.durationHours / WORK_HOURS_PER_DAY);

  const materialsEx = safeNumber((estimate.outputs as any)?.materials?.totals?.materials_ex_gst);
  const installPayoutEx = safeNumber((estimate.outputs as any)?.install?.totals?.install_ex_gst);
  const overheadEx = safeNumber((estimate.outputs as any)?.overhead?.total_ex_gst ?? (estimate.outputs as any)?.overhead?.ops_ex_gst);
  const totalEx = safeNumber((estimate.outputs as any)?.totals?.cost_ex_gst);
  const totalInc = safeNumber((estimate.outputs as any)?.totals?.cost_inc_gst);

  return {
    crewHours,
    durationDays,
    materialsEx,
    installPayoutEx,
    overheadEx,
    totalEx,
    totalInc,
  };
}

export async function listEstimates(projectId: string): Promise<Estimate[]> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase.from('estimates').select('*').eq('project_id', projectUuid).order('created_at', { ascending: false });
  if (error) throw wrapError('estimates', error);
  const estimates = (Array.isArray(data) ? data : []).map(estimateFromRow);
  return estimates.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllEstimates(): Promise<Estimate[]> {
  const supabase = getSupabaseBrowser();
  // PR-PG1 (2026-06-16): explicit cap replaces PostgREST's silent 1000-row
  // default. Used by the schedule legacy-fallback client; the schedule
  // page itself isn't a flat list but this fetch backs the project
  // selector dropdown so silent truncation could hide options.
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, MAX_LIST_FETCH_ROWS - 1);
  if (error) throw wrapError('estimates', error);
  const estimates = (Array.isArray(data) ? data : []).map(estimateFromRow);
  return estimates.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getEstimate(id: string): Promise<Estimate | null> {
  try {
    const supabase = getSupabaseBrowser();
    const uuid = uuidFromAppId(id, 'est');
    const { data, error } = await supabase.from('estimates').select('*').eq('id', uuid).single();
    if (error || !data) return null;
    return estimateFromRow(data);
  } catch {
    return null;
  }
}

export async function createEstimate(projectId: string, snapshot: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>): Promise<Estimate> {
  const now = nowIso();
  const existing = await listEstimates(projectId);
  const maxVersion = existing.reduce((max, e) => (typeof (e as any).version === 'number' ? Math.max(max, (e as any).version) : max), 0);

  const estimate: Estimate = {
    id: newId('est'),
    projectId,
    version: maxVersion + 1,
    createdAt: now,
    updatedAt: now,
    ...snapshot,
  };

  const projectUuid = uuidFromAppId(projectId, 'proj');
  const uuid = uuidFromAppId(estimate.id, 'est');

  const summary = computeSummaryFields(estimate);

  const payload: any = {
    id: uuid,
    project_id: projectUuid,
    status: normaliseStatus(estimate.status),
    summary: typeof (estimate as any).summary === 'string' ? (estimate as any).summary : null,
    crew_hours: summary.crewHours,
    duration_days: summary.durationDays,
    materials_ex_gst: summary.materialsEx,
    install_payout_ex_gst: summary.installPayoutEx,
    overhead_ex_gst: summary.overheadEx,
    total_true_cost_ex_gst: summary.totalEx,
    total_true_cost_inc_gst: summary.totalInc,
    inputs: (estimate as any).inputs ?? {},
    outputs: {
      ...(isRecord((estimate as any).outputs) ? (estimate as any).outputs : {}),
      derived: (estimate as any).derived ?? {},
      configVersions: (estimate as any).configVersions ?? null,
      projectSnapshot: (estimate as any).projectSnapshot ?? null,
      snapshot: (estimate as any).snapshot ?? null,
      version: estimate.version ?? null,
    },
    warnings: Array.isArray((estimate as any)?.outputs?.warnings) ? (estimate as any).outputs.warnings : [],
    costing_manifest: typeof (estimate as any)?.configVersions?.manifest === 'string' ? (estimate as any).configVersions.manifest : null,
    costing_rules: typeof (estimate as any)?.configVersions?.rules === 'string' ? (estimate as any).configVersions.rules : null,
    created_at: estimate.createdAt,
    updated_at: estimate.updatedAt ?? estimate.createdAt,
  };

  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('estimates')
    .insert(payload)
    .select('*')
    .single();
  if (error || !data) throw wrapError('estimates', error);

  return estimateFromRow(data);
}

export async function upsertEstimate(estimateIn: Estimate): Promise<Estimate> {
  const supabase = getSupabaseBrowser();
  const now = nowIso();

  const estimateId =
    typeof estimateIn.id === 'string' && estimateIn.id.trim()
      ? estimateIn.id.trim()
      : newId('est');
  const projectId = typeof estimateIn.projectId === 'string' && estimateIn.projectId.trim() ? estimateIn.projectId.trim() : '';
  if (!projectId) throw new Error('Estimate projectId is required');

  const createdAt = typeof estimateIn.createdAt === 'string' && estimateIn.createdAt.trim() ? estimateIn.createdAt.trim() : now;
  const updatedAt = typeof estimateIn.updatedAt === 'string' && estimateIn.updatedAt.trim() ? estimateIn.updatedAt.trim() : createdAt;

  const estimate: Estimate = {
    ...(estimateIn as any),
    id: estimateId,
    projectId,
    createdAt,
    updatedAt,
    status: normaliseStatus(estimateIn.status),
  };

  const uuid = uuidFromAppId(estimate.id, 'est');
  const projectUuid = uuidFromAppId(projectId, 'proj');

  const summary = computeSummaryFields(estimate);

  const payload: any = {
    id: uuid,
    project_id: projectUuid,
    status: normaliseStatus(estimate.status),
    summary: typeof (estimate as any).summary === 'string' ? (estimate as any).summary : null,
    crew_hours: summary.crewHours,
    duration_days: summary.durationDays,
    materials_ex_gst: summary.materialsEx,
    install_payout_ex_gst: summary.installPayoutEx,
    overhead_ex_gst: summary.overheadEx,
    total_true_cost_ex_gst: summary.totalEx,
    total_true_cost_inc_gst: summary.totalInc,
    inputs: (estimate as any).inputs ?? {},
    outputs: {
      ...(isRecord((estimate as any).outputs) ? (estimate as any).outputs : {}),
      derived: (estimate as any).derived ?? {},
      configVersions: (estimate as any).configVersions ?? null,
      projectSnapshot: (estimate as any).projectSnapshot ?? null,
      snapshot: (estimate as any).snapshot ?? null,
      version: (estimate as any).version ?? null,
    },
    warnings: Array.isArray((estimate as any)?.outputs?.warnings) ? (estimate as any).outputs.warnings : [],
    costing_manifest: typeof (estimate as any)?.configVersions?.manifest === 'string' ? (estimate as any).configVersions.manifest : null,
    costing_rules: typeof (estimate as any)?.configVersions?.rules === 'string' ? (estimate as any).configVersions.rules : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const { data, error } = await supabase.from('estimates').upsert(payload as any, { onConflict: 'id' }).select('*');
  if (error) throw wrapError('estimates', error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error(`Estimate upsert succeeded but no row returned${hostSuffix()}`);
  return estimateFromRow(row);
}

export async function updateEstimate(id: string, patch: Partial<Omit<Estimate, 'id' | 'projectId' | 'createdAt'>>): Promise<Estimate> {
  const prev = await getEstimate(id);
  if (!prev) throw new Error('Estimate not found');

  const now = nowIso();
  const uuid = uuidFromAppId(id, 'est');
  const next: Estimate = {
    ...prev,
    ...patch,
    updatedAt: now,
  } as any;

  const summary = computeSummaryFields(next);

  const payload: any = {
    status: normaliseStatus(next.status),
    summary: typeof (next as any).summary === 'string' ? (next as any).summary : null,
    crew_hours: summary.crewHours,
    duration_days: summary.durationDays,
    materials_ex_gst: summary.materialsEx,
    install_payout_ex_gst: summary.installPayoutEx,
    overhead_ex_gst: summary.overheadEx,
    total_true_cost_ex_gst: summary.totalEx,
    total_true_cost_inc_gst: summary.totalInc,
    inputs: (next as any).inputs ?? {},
    outputs: {
      ...(isRecord((next as any).outputs) ? (next as any).outputs : {}),
      derived: (next as any).derived ?? {},
      configVersions: (next as any).configVersions ?? null,
      projectSnapshot: (next as any).projectSnapshot ?? null,
      snapshot: (next as any).snapshot ?? null,
      version: (next as any).version ?? null,
    },
    warnings: Array.isArray((next as any)?.outputs?.warnings) ? (next as any).outputs.warnings : [],
    costing_manifest: typeof (next as any)?.configVersions?.manifest === 'string' ? (next as any).configVersions.manifest : null,
    costing_rules: typeof (next as any)?.configVersions?.rules === 'string' ? (next as any).configVersions.rules : null,
    updated_at: now,
  };

  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from('estimates').update(payload).eq('id', uuid).select('*').single();
  if (error || !data) throw wrapError('estimates', error);
  return estimateFromRow(data);
}

export async function deleteEstimate(estimateId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const uuid = uuidFromAppId(estimateId, 'est');
  const { error } = await supabase.from('estimates').delete().eq('id', uuid);
  if (error) throw wrapError('estimates', error);
}

export async function deleteEstimatesForProject(projectId: string): Promise<void> {
  const existing = await listEstimates(projectId);
  for (const e of existing) await deleteEstimate(e.id);
}

export async function duplicateEstimate(id: string): Promise<Estimate> {
  const prev = await getEstimate(id);
  if (!prev) throw new Error('Estimate not found');
  const copy = { ...prev, status: 'draft' as EstimateStatus };
  delete (copy as any).id;
  delete (copy as any).createdAt;
  delete (copy as any).updatedAt;
  return createEstimate(prev.projectId, copy as any);
}

export async function duplicateEstimateToDraft(estimateId: string): Promise<CalculatorInputs> {
  const estimate = await getEstimate(estimateId);
  if (!estimate) throw new Error('Estimate not found');
  const inputs: unknown = (estimate as any).inputs;
  if (isCalculatorInputsV2(inputs)) return inputs;
  if (isLegacyCalculatorInputsV1(inputs)) return migrateLegacyCalculatorInputsToV2(inputs);
  throw new Error('Estimate inputs are not compatible with this calculator version.');
}
