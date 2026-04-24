import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { computeEstimateEditability } from './editability';
import type { EstimateEditability, EstimateFlowState } from './types';

type QuoteVersionRow = {
  id: string;
  source_estimate_version_id: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
  version_number: number | null;
  quotes: { quote_ref: string | null } | Array<{ quote_ref: string | null }> | null;
};

type QuoteSendLogRow = {
  quote_version_id: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type JobPackGenerationRow = {
  estimate_id: string | null;
  quote_version_id: string | null;
  created_at: string | null;
};

type EstimateRowLite = {
  id: string;
  status: string | null;
  created_at: string | null;
};

type EstimateFlowMaps = {
  activeDraftEstimateId: string | null;
  editabilityByEstimateId: Map<string, EstimateEditability>;
  flowByEstimateId: Map<string, EstimateFlowState>;
};

function emptyFlowState(): EstimateFlowState {
  return {
    isActiveDraft: false,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
  };
}

function isDraftStatus(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'draft';
}

export async function loadProjectEstimateFlowMaps(
  projectUuid: string,
  estimateRows?: EstimateRowLite[],
  supabase?: SupabaseClient,
): Promise<EstimateFlowMaps> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const estimates =
    estimateRows ??
    (
      (
        await client
          .from('estimates')
          .select('id, status, created_at')
          .eq('project_id', projectUuid)
          .order('created_at', { ascending: false })
      ).data ?? []
    );

  const estimateIds = estimates.map((row) => String(row?.id ?? '')).filter(Boolean);
  if (!estimateIds.length) {
    return {
      activeDraftEstimateId: null,
      editabilityByEstimateId: new Map(),
      flowByEstimateId: new Map(),
    };
  }

  const quoteVersionsRes = await client
    .from('quote_versions')
    .select('id, source_estimate_version_id, status, sent_at, created_at, version_number, quotes(quote_ref)')
    .in('source_estimate_version_id', estimateIds);
  if (quoteVersionsRes.error) throw new Error(quoteVersionsRes.error.message ?? 'Failed to load related quotes');

  const quoteVersions = (Array.isArray(quoteVersionsRes.data) ? quoteVersionsRes.data : []) as QuoteVersionRow[];
  const quoteVersionIds = quoteVersions.map((row) => row.id).filter(Boolean);

  let sendLogs: QuoteSendLogRow[] = [];
  if (quoteVersionIds.length) {
    const sendLogsRes = await client
      .from('quote_send_logs')
      .select('quote_version_id, status, sent_at, created_at')
      .in('quote_version_id', quoteVersionIds);
    if (sendLogsRes.error) throw new Error(sendLogsRes.error.message ?? 'Failed to load quote send logs');
    sendLogs = (Array.isArray(sendLogsRes.data) ? sendLogsRes.data : []) as QuoteSendLogRow[];
  }

  let jobPackGenerations: JobPackGenerationRow[] = [];
  const jobPackGenerationsRes = await client
    .from('job_pack_generations')
    .select('estimate_id, quote_version_id, created_at')
    .in('estimate_id', estimateIds);
  if (jobPackGenerationsRes.error) {
    const code = typeof (jobPackGenerationsRes.error as any)?.code === 'string' ? (jobPackGenerationsRes.error as any).code : '';
    const message = typeof (jobPackGenerationsRes.error as any)?.message === 'string' ? (jobPackGenerationsRes.error as any).message.toLowerCase() : '';
    const missing = code === 'PGRST204' || code === '42703' || message.includes('does not exist') || message.includes('schema cache');
    if (!missing) throw new Error(jobPackGenerationsRes.error.message ?? 'Failed to load job pack generations');
  } else {
    jobPackGenerations = (Array.isArray(jobPackGenerationsRes.data) ? jobPackGenerationsRes.data : []) as JobPackGenerationRow[];
  }

  const versionsByEstimateId = new Map<string, QuoteVersionRow[]>();
  for (const row of quoteVersions) {
    const estimateId = typeof row.source_estimate_version_id === 'string' ? row.source_estimate_version_id : '';
    if (!estimateId) continue;
    const bucket = versionsByEstimateId.get(estimateId) ?? [];
    bucket.push(row);
    versionsByEstimateId.set(estimateId, bucket);
  }

  const logsByEstimateId = new Map<string, QuoteSendLogRow[]>();
  for (const log of sendLogs) {
    const quoteVersionId = typeof log.quote_version_id === 'string' ? log.quote_version_id : '';
    if (!quoteVersionId) continue;
    const version = quoteVersions.find((row) => row.id === quoteVersionId);
    const estimateId = version?.source_estimate_version_id ?? '';
    if (!estimateId) continue;
    const bucket = logsByEstimateId.get(estimateId) ?? [];
    bucket.push(log);
    logsByEstimateId.set(estimateId, bucket);
  }

  const generatedByEstimateId = new Map<string, JobPackGenerationRow>();
  for (const row of jobPackGenerations) {
    const estimateId = typeof row.estimate_id === 'string' ? row.estimate_id : '';
    if (!estimateId) continue;
    const current = generatedByEstimateId.get(estimateId);
    const currentAt = current?.created_at ?? '';
    const nextAt = row.created_at ?? '';
    if (!current || nextAt > currentAt) generatedByEstimateId.set(estimateId, row);
  }

  const editabilityByEstimateId = new Map<string, EstimateEditability>();
  for (const estimateId of estimateIds) {
    editabilityByEstimateId.set(
      estimateId,
      computeEstimateEditability({
        quoteVersions: versionsByEstimateId.get(estimateId) ?? [],
        sendLogs: logsByEstimateId.get(estimateId) ?? [],
      }),
    );
  }

  const activeDraftEstimateId =
    estimates
      .filter((row) => {
        const estimateId = String(row?.id ?? '');
        const editability = editabilityByEstimateId.get(estimateId);
        return estimateId && isDraftStatus(row?.status) && !editability?.isLocked;
      })
      .sort((left, right) => String(right?.created_at ?? '').localeCompare(String(left?.created_at ?? '')))[0]
      ?.id ?? null;

  const flowByEstimateId = new Map<string, EstimateFlowState>();
  for (const estimateId of estimateIds) {
    const editability = editabilityByEstimateId.get(estimateId);
    const generation = generatedByEstimateId.get(estimateId);
    flowByEstimateId.set(estimateId, {
      isActiveDraft: estimateId === activeDraftEstimateId,
      hasSentQuote: Boolean(editability?.isLocked),
      jobPackEligible: Boolean(editability?.isLocked),
      jobPackGeneratedAt: generation?.created_at ?? null,
      jobPackQuoteVersionId: generation?.quote_version_id ? appIdFromUuid('qv', generation.quote_version_id) : null,
    });
  }

  return {
    activeDraftEstimateId,
    editabilityByEstimateId,
    flowByEstimateId,
  };
}

export function estimateFlowStateFor(
  flowByEstimateId: Map<string, EstimateFlowState>,
  estimateUuid: string,
): EstimateFlowState {
  return flowByEstimateId.get(estimateUuid) ?? emptyFlowState();
}
