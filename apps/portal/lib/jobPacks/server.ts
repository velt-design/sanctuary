import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { buildVersionLabelMap } from '@/lib/estimates/server';
import { normalizePowdercoatProfile, normalizePowdercoatStoredRow } from './powdercoating';
import type {
  JobPackGenerationSummary,
  JobPackPowdercoatOption,
  JobPackPowdercoatOverrideState,
  JobPackPowdercoatStoredRow,
} from './types';

const POWDERCOATING_SHEET_KEY = 'powdercoating-order';

function emptyState(): JobPackPowdercoatOverrideState {
  return { version: null, rows: [] };
}

async function resolveSupabaseClient(supabase?: SupabaseClient): Promise<SupabaseClient> {
  return supabase ?? (await getSupabaseServerAuth());
}

export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = typeof (error as any).code === 'string' ? (error as any).code.trim() : '';
  const message = typeof (error as any).message === 'string' ? (error as any).message.toLowerCase() : '';
  return (
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('missing') ||
    message.includes('could not find the table')
  );
}

export async function estimateExists(estimateUuid: string, supabase?: SupabaseClient): Promise<boolean> {
  const client = await resolveSupabaseClient(supabase);
  const res = await client.from('estimates').select('id').eq('id', estimateUuid).maybeSingle();
  if (res.error) throw res.error;
  return Boolean(res.data?.id);
}

export async function loadPowdercoatOverrideState(estimateUuid: string, supabase?: SupabaseClient): Promise<JobPackPowdercoatOverrideState> {
  const client = await resolveSupabaseClient(supabase);
  const res = await client
    .from('job_pack_sheet_overrides')
    .select('payload_json, updated_at')
    .eq('estimate_id', estimateUuid)
    .eq('sheet_key', POWDERCOATING_SHEET_KEY)
    .maybeSingle();

  if (res.error) throw res.error;
  if (!res.data) return emptyState();

  const rowsRaw =
    res.data.payload_json && typeof res.data.payload_json === 'object' && Array.isArray((res.data.payload_json as any).rows)
      ? (res.data.payload_json as any).rows
      : [];

  const rows = rowsRaw
    .map(normalizePowdercoatStoredRow)
    .filter((row: JobPackPowdercoatStoredRow | null): row is JobPackPowdercoatStoredRow => Boolean(row));
  return {
    version: typeof res.data.updated_at === 'string' ? res.data.updated_at : null,
    rows,
  };
}

export async function listPowdercoatProfileOptions(): Promise<JobPackPowdercoatOption[]> {
  const supabase = await resolveSupabaseClient();
  const { config } = await getCostingConfigWithOverrides(supabase);
  const grouped = new Map<string, { profile: string; stockLengthsM: Set<number> }>();

  for (const item of config.materials.items) {
    if (item.category !== 'aluminium_extrusion' || item.unit !== 'bar') continue;
    const attrs = item.attributes as Record<string, unknown> | null | undefined;
    const rawProfile = typeof attrs?.profile === 'string' ? attrs.profile : '';
    const rawLength = typeof attrs?.length_m === 'number' && Number.isFinite(attrs.length_m) ? attrs.length_m : null;
    const profile = normalizePowdercoatProfile(rawProfile);
    if (!profile || rawLength === null) continue;

    const existing = grouped.get(profile) ?? { profile, stockLengthsM: new Set<number>() };
    existing.stockLengthsM.add(Math.round(rawLength * 1000) / 1000);
    grouped.set(profile, existing);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      profile: item.profile,
      stockLengthsM: Array.from(item.stockLengthsM.values()).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.profile.localeCompare(right.profile));
}

export async function savePowdercoatOverrideState(input: {
  estimateUuid: string;
  expectedVersion: string | null;
  rows: JobPackPowdercoatStoredRow[];
  updatedBy: string | null;
}): Promise<{ ok: true; overrides: JobPackPowdercoatOverrideState } | { ok: false; current: JobPackPowdercoatOverrideState }> {
  const client = await resolveSupabaseClient();
  const current = await loadPowdercoatOverrideState(input.estimateUuid, client);
  if ((current.version ?? null) !== (input.expectedVersion ?? null)) {
    return { ok: false, current };
  }

  if (!input.rows.length) {
    const deleteRes = await client
      .from('job_pack_sheet_overrides')
      .delete()
      .eq('estimate_id', input.estimateUuid)
      .eq('sheet_key', POWDERCOATING_SHEET_KEY);
    if (deleteRes.error) throw deleteRes.error;
    return { ok: true, overrides: emptyState() };
  }

  const upsertRes = await client
    .from('job_pack_sheet_overrides')
    .upsert(
      {
        estimate_id: input.estimateUuid,
        sheet_key: POWDERCOATING_SHEET_KEY,
        payload_json: { rows: input.rows },
        updated_by: input.updatedBy,
      } as any,
      { onConflict: 'estimate_id,sheet_key' },
    )
    .select('payload_json, updated_at')
    .single();

  if (upsertRes.error) throw upsertRes.error;

  const rowsRaw =
    upsertRes.data.payload_json && typeof upsertRes.data.payload_json === 'object' && Array.isArray((upsertRes.data.payload_json as any).rows)
      ? (upsertRes.data.payload_json as any).rows
      : [];

  return {
    ok: true,
    overrides: {
      version: typeof upsertRes.data.updated_at === 'string' ? upsertRes.data.updated_at : null,
      rows: rowsRaw
        .map(normalizePowdercoatStoredRow)
        .filter((row: JobPackPowdercoatStoredRow | null): row is JobPackPowdercoatStoredRow => Boolean(row)),
    },
  };
}

type QuoteVersionForGeneration = {
  id: string;
  quote_id: string;
  version_number: number | null;
  status: string | null;
  source_estimate_version_id: string | null;
  quotes: { project_id: string | null; quote_ref: string | null } | Array<{ project_id: string | null; quote_ref: string | null }> | null;
};

type JobPackGenerationRow = {
  id: string;
  project_id: string;
  estimate_id: string;
  quote_version_id: string;
  created_at: string | null;
  created_by: string | null;
};

function isQuoteEligibleForJobPack(status: unknown): status is 'SENT' | 'ACCEPTED' | 'DECLINED' {
  return status === 'SENT' || status === 'ACCEPTED' || status === 'DECLINED';
}

function quoteRelation(value: QuoteVersionForGeneration['quotes']): { project_id: string | null; quote_ref: string | null } | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function loadEstimateVersionLabel(projectUuid: string, estimateUuid: string): Promise<string> {
  const client = await resolveSupabaseClient();
  const estimatesRes = await client
    .from('estimates')
    .select('id, created_at, outputs, version')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  if (estimatesRes.error) throw estimatesRes.error;
  const labels = buildVersionLabelMap(Array.isArray(estimatesRes.data) ? estimatesRes.data : []);
  return labels.get(estimateUuid) ?? 'V-';
}

function mapGenerationRow(params: {
  generation: JobPackGenerationRow;
  quoteVersion: QuoteVersionForGeneration;
  estimateVersionLabel: string;
}): JobPackGenerationSummary {
  const quote = quoteRelation(params.quoteVersion.quotes);
  return {
    id: appIdFromUuid('jpg', params.generation.id),
    projectId: appIdFromUuid('proj', params.generation.project_id),
    estimateId: appIdFromUuid('est', params.generation.estimate_id),
    estimateVersionLabel: params.estimateVersionLabel,
    quoteVersionId: appIdFromUuid('qv', params.generation.quote_version_id),
    quoteRef: quote?.quote_ref ?? '',
    quoteVersionNumber: Number(params.quoteVersion.version_number ?? 0) || 0,
    quoteStatus: (isQuoteEligibleForJobPack(params.quoteVersion.status) ? params.quoteVersion.status : 'SENT') as 'SENT' | 'ACCEPTED' | 'DECLINED',
    createdAt: params.generation.created_at ?? new Date().toISOString(),
    createdBy: params.generation.created_by ?? null,
  };
}

export async function hasGeneratedJobPacksForProject(projectUuid: string): Promise<boolean> {
  const client = await resolveSupabaseClient();
  const res = await client.from('job_pack_generations').select('id').eq('project_id', projectUuid).limit(1).maybeSingle();
  if (res.error) {
    if (isMissingSchemaError(res.error)) return false;
    throw res.error;
  }
  return Boolean(res.data?.id);
}

export async function loadLatestJobPackGenerationForEstimate(estimateUuid: string): Promise<JobPackGenerationSummary | null> {
  const client = await resolveSupabaseClient();
  const res = await client
    .from('job_pack_generations')
    .select('id, project_id, estimate_id, quote_version_id, created_at, created_by')
    .eq('estimate_id', estimateUuid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) {
    if (isMissingSchemaError(res.error)) return null;
    throw res.error;
  }
  if (!res.data) return null;

  const generation = res.data as JobPackGenerationRow;
  const quoteVersionRes = await client
    .from('quote_versions')
    .select('id, quote_id, version_number, status, source_estimate_version_id, quotes!inner(project_id, quote_ref)')
    .eq('id', generation.quote_version_id)
    .maybeSingle();
  if (quoteVersionRes.error) throw quoteVersionRes.error;
  if (!quoteVersionRes.data) return null;

  return mapGenerationRow({
    generation,
    quoteVersion: quoteVersionRes.data as QuoteVersionForGeneration,
    estimateVersionLabel: await loadEstimateVersionLabel(generation.project_id, generation.estimate_id),
  });
}

export async function listGeneratedJobPacksForProject(projectId: string): Promise<JobPackGenerationSummary[]> {
  const client = await resolveSupabaseClient();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const res = await client
    .from('job_pack_generations')
    .select('id, project_id, estimate_id, quote_version_id, created_at, created_by')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;

  const rows = (Array.isArray(res.data) ? res.data : []) as JobPackGenerationRow[];
  if (!rows.length) return [];

  const quoteVersionIds = rows.map((row) => row.quote_version_id);
  const quoteVersionsRes = await client
    .from('quote_versions')
    .select('id, quote_id, version_number, status, source_estimate_version_id, quotes!inner(project_id, quote_ref)')
    .in('id', quoteVersionIds);
  if (quoteVersionsRes.error) throw quoteVersionsRes.error;
  const quoteVersions = (Array.isArray(quoteVersionsRes.data) ? quoteVersionsRes.data : []) as QuoteVersionForGeneration[];
  const quoteVersionsById = new Map(quoteVersions.map((row) => [row.id, row]));

  const estimateLabelsRes = await client
    .from('estimates')
    .select('id, project_id, created_at, outputs, version')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  if (estimateLabelsRes.error) throw estimateLabelsRes.error;
  const labels = buildVersionLabelMap(Array.isArray(estimateLabelsRes.data) ? estimateLabelsRes.data : []);

  return rows
    .map((row) => {
      const quoteVersion = quoteVersionsById.get(row.quote_version_id);
      if (!quoteVersion) return null;
      return mapGenerationRow({
        generation: row,
        quoteVersion,
        estimateVersionLabel: labels.get(row.estimate_id) ?? 'V-',
      });
    })
    .filter((row): row is JobPackGenerationSummary => Boolean(row));
}

export async function generateJobPackForQuoteVersion(input: {
  projectId: string;
  quoteVersionId: string;
  actor: string | null;
}): Promise<JobPackGenerationSummary> {
  const client = await resolveSupabaseClient();
  const projectUuid = uuidFromAppId(input.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(input.quoteVersionId, 'qv');

  const quoteVersionRes = await client
    .from('quote_versions')
    .select('id, quote_id, version_number, status, source_estimate_version_id, quotes!inner(project_id, quote_ref)')
    .eq('id', quoteVersionUuid)
    .maybeSingle();
  if (quoteVersionRes.error) throw quoteVersionRes.error;
  if (!quoteVersionRes.data) throw new Error('Quote not found');

  const quoteVersion = quoteVersionRes.data as QuoteVersionForGeneration;
  const quote = quoteRelation(quoteVersion.quotes);
  if (!quote?.project_id || quote.project_id !== projectUuid) throw new Error('Quote does not belong to this project');
  if (!quoteVersion.source_estimate_version_id) throw new Error('Quote source design missing');
  if (!isQuoteEligibleForJobPack(quoteVersion.status)) {
    throw new Error('Job packs can only be generated after a quote has been sent.');
  }

  const existingRes = await client
    .from('job_pack_generations')
    .select('id, project_id, estimate_id, quote_version_id, created_at, created_by')
    .eq('quote_version_id', quoteVersionUuid)
    .maybeSingle();
  if (existingRes.error && !isMissingSchemaError(existingRes.error)) throw existingRes.error;
  if (existingRes.data) {
    return mapGenerationRow({
      generation: existingRes.data as JobPackGenerationRow,
      quoteVersion,
      estimateVersionLabel: await loadEstimateVersionLabel(projectUuid, quoteVersion.source_estimate_version_id),
    });
  }

  const insertRes = await client
    .from('job_pack_generations')
    .insert({
      project_id: projectUuid,
      estimate_id: quoteVersion.source_estimate_version_id,
      quote_version_id: quoteVersionUuid,
      created_by: input.actor,
    } as any)
    .select('id, project_id, estimate_id, quote_version_id, created_at, created_by')
    .single();
  if (insertRes.error) throw insertRes.error;

  return mapGenerationRow({
    generation: insertRes.data as JobPackGenerationRow,
    quoteVersion,
    estimateVersionLabel: await loadEstimateVersionLabel(projectUuid, quoteVersion.source_estimate_version_id),
  });
}
