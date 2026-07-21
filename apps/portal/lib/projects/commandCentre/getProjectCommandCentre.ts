import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeEstimateEditability } from '@/lib/estimates/editability';
import { appIdFromUuid, isRecord, uuidFromAppId } from '@/lib/supabase/mappers';
import { resolveCommandCentreSelection } from './resolve';
import { getProjectCommandOperations } from './getProjectCommandOperations';
import {
  resolveCommandCentreCostingState,
  summarizeCommandCentreDesign,
} from './summarizeDesign';
import type {
  CommandCentreDeliveryState,
  CommandCentreEstimateCandidate,
  CommandCentreQuoteCandidate,
  CommandCentreQuoteStatus,
  CommandCentreStatusTone,
  ProjectCommandCentreResponse,
} from './types';

const PROJECT_COMMAND_CENTRE_SELECT = `
  id,
  pipeline_stage,
  estimates(id,project_id,created_at,status,version,summary_json),
  quotes(
    id,
    quote_ref,
    quoteVersions:quote_versions(
      id,
      quote_id,
      version_number,
      status,
      source_estimate_version_id,
      created_at,
      sent_at,
      total_inc_gst_cents,
      sendLogs:quote_send_logs(status,created_at,sent_at)
    )
  )
`;

type AnyRecord = Record<string, unknown>;

function relationRows(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isoTimestamp(value: unknown): string | null {
  const raw = trimmedString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseRecord(value: unknown): AnyRecord | null {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function estimatePriceCents(value: unknown): number | null {
  const summary = parseRecord(value);
  const raw = summary?.total;
  const amount = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function estimateStatus(value: unknown): CommandCentreEstimateCandidate['status'] {
  const status = trimmedString(value)?.toLowerCase();
  if (status === 'draft' || status === 'archived') return status;
  return 'unknown';
}

function quoteStatus(value: unknown): CommandCentreQuoteStatus | null {
  const status = trimmedString(value)?.toUpperCase();
  if (status === 'DRAFT' || status === 'SENT' || status === 'ACCEPTED' || status === 'DECLINED') {
    return status;
  }
  return null;
}

function buildEstimateVersionLabels(rows: AnyRecord[]): Map<string, string> {
  const labels = new Map<string, string>();
  const validRows = rows.filter((row) => trimmedString(row.id));
  const allVersioned = validRows.length > 0 && validRows.every((row) => positiveInteger(row.version) !== null);
  if (allVersioned) {
    for (const row of validRows) {
      labels.set(String(row.id), `V${positiveInteger(row.version)}`);
    }
    return labels;
  }

  validRows
    .slice()
    .sort((left, right) => {
      const timestamp = String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''));
      return timestamp || String(left.id).localeCompare(String(right.id));
    })
    .forEach((row, index) => labels.set(String(row.id), `V${index + 1}`));
  return labels;
}

function normalizeQuoteRows(projectRow: AnyRecord): CommandCentreQuoteCandidate[] {
  const quotes = relationRows(projectRow.quotes);
  const out: CommandCentreQuoteCandidate[] = [];
  for (const quote of quotes) {
    const quoteRef = trimmedString(quote.quote_ref);
    for (const version of relationRows(quote.quoteVersions)) {
      const sourceId = trimmedString(version.id);
      const status = quoteStatus(version.status);
      if (!sourceId || !status) continue;
      const logs = relationRows(version.sendLogs)
        .map((log) => {
          const logStatus = trimmedString(log.status)?.toUpperCase();
          if (logStatus !== 'SENT' && logStatus !== 'FAILED') return null;
          return {
            status: logStatus,
            createdAt: isoTimestamp(log.created_at),
            sentAt: isoTimestamp(log.sent_at),
          } as const;
        })
        .filter((log): log is NonNullable<typeof log> => log !== null);
      out.push({
        id: appIdFromUuid('qv', sourceId),
        sourceId,
        quoteRef,
        versionNumber: positiveInteger(version.version_number),
        status,
        sourceEstimateId: trimmedString(version.source_estimate_version_id),
        createdAt: isoTimestamp(version.created_at),
        sentAt: isoTimestamp(version.sent_at),
        totalIncGstCents: nonNegativeInteger(version.total_inc_gst_cents),
        sendLogs: logs,
      });
    }
  }
  return out;
}

function normalizeEstimateRows(
  projectRow: AnyRecord,
  quotes: CommandCentreQuoteCandidate[],
): CommandCentreEstimateCandidate[] {
  const rows = relationRows(projectRow.estimates);
  const labels = buildEstimateVersionLabels(rows);
  return rows.flatMap((row) => {
    const sourceId = trimmedString(row.id);
    if (!sourceId) return [];
    const relatedQuotes = quotes.filter((quote) => quote.sourceEstimateId === sourceId);
    const editability = computeEstimateEditability({
      quoteVersions: relatedQuotes.map((quote) => ({
        id: quote.sourceId,
        status: quote.status,
        sent_at: quote.sentAt,
        created_at: quote.createdAt,
        version_number: quote.versionNumber,
        quote_ref: quote.quoteRef,
      })),
      sendLogs: relatedQuotes.flatMap((quote) => quote.sendLogs.map((log) => ({
        quote_version_id: quote.sourceId,
        status: log.status,
        sent_at: log.sentAt,
        created_at: log.createdAt,
      }))),
    });
    return [{
      id: appIdFromUuid('est', sourceId),
      sourceId,
      createdAt: isoTimestamp(row.created_at),
      status: estimateStatus(row.status),
      versionLabel: labels.get(sourceId) ?? 'V-',
      totalIncGstCents: estimatePriceCents(row.summary_json),
      isLocked: editability.isLocked,
    }];
  });
}

function statusPresentation(source: ProjectCommandCentreResponse['currentDesign']['source']): {
  label: string;
  tone: CommandCentreStatusTone;
} {
  if (source === 'accepted_quote') return { label: 'Quote accepted', tone: 'accepted' };
  if (source === 'sent_quote') return { label: 'Quote sent', tone: 'sent' };
  if (source === 'draft_quote') return { label: 'Draft quote', tone: 'draft' };
  if (source === 'estimate') return { label: 'Estimate current', tone: 'neutral' };
  return { label: 'No current design', tone: 'neutral' };
}

function quoteDeliveryState(quote: CommandCentreQuoteCandidate): CommandCentreDeliveryState {
  if (quote.status === 'ACCEPTED') return 'accepted';
  if (quote.status === 'DRAFT') return 'draft';
  const latestLog = quote.sendLogs.slice().sort((left, right) => {
    const leftAt = left.createdAt ?? left.sentAt ?? '';
    const rightAt = right.createdAt ?? right.sentAt ?? '';
    return rightAt.localeCompare(leftAt);
  })[0];
  return latestLog?.status === 'FAILED' ? 'failed' : 'sent';
}

export async function getProjectCommandCentre(
  projectId: string,
  supabase: SupabaseClient,
  viewer: { userId: string; isAdmin: boolean } = { userId: '', isAdmin: false },
): Promise<ProjectCommandCentreResponse | null> {
  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return null;
  }

  const projectResult = await supabase
    .from('projects')
    .select(PROJECT_COMMAND_CENTRE_SELECT)
    .eq('id', projectUuid)
    .maybeSingle();
  if (projectResult.error) throw new Error(projectResult.error.message ?? 'Failed to load command centre');
  if (!projectResult.data) return null;

  const projectRow = projectResult.data as AnyRecord;
  const stage = String(projectRow.pipeline_stage ?? 'new').trim().toLowerCase();
  const quotes = normalizeQuoteRows(projectRow);
  const estimates = normalizeEstimateRows(projectRow, quotes);
  const selection = resolveCommandCentreSelection({ estimates, quoteVersions: quotes });

  let selectedDetail: AnyRecord | null = null;
  if (selection.estimate) {
    const estimateResult = await supabase
      .from('estimates')
      .select('id,inputs,outputs,costing_manifest,costing_rules')
      .eq('id', selection.estimate.sourceId)
      .maybeSingle();
    if (estimateResult.error || !estimateResult.data) {
      throw new Error(estimateResult.error?.message ?? 'Selected estimate detail unavailable');
    }
    selectedDetail = estimateResult.data as AnyRecord;
  }

  const status = statusPresentation(selection.source);
  const quoteSelected = selection.quote !== null;
  const designState = selection.sourceEstimateMissing
    ? 'source_unavailable'
    : selection.estimate
      ? 'available'
      : 'none';
  const warnings: ProjectCommandCentreResponse['currentDesign']['warnings'] = [];
  if (selection.acceptedQuoteCount > 1) warnings.push('multiple_accepted_quotes');
  if (selection.sourceEstimateMissing) warnings.push('source_design_unavailable');
  if (quoteSelected && selection.quote?.totalIncGstCents === null) warnings.push('quote_price_unavailable');

  const basePath = `/staff/projects/${encodeURIComponent(projectId)}`;
  const estimate = selection.estimate;
  const quote = selection.quote;
  const operations = await getProjectCommandOperations({
    projectUuid,
    stage,
    supabase,
    viewerUserId: viewer.userId,
    isAdmin: viewer.isAdmin,
  });
  return {
    projectId,
    generatedAt: new Date().toISOString(),
    operations,
    currentDesign: {
      source: selection.source,
      statusLabel: status.label,
      statusTone: status.tone,
      designState,
      design: selectedDetail ? summarizeCommandCentreDesign(selectedDetail.inputs) : null,
      price: quote
        ? { source: 'quote', totalIncGstCents: quote.totalIncGstCents }
        : estimate
          ? { source: 'estimate', totalIncGstCents: estimate.totalIncGstCents }
          : { source: 'none', totalIncGstCents: null },
      estimate: estimate ? {
        id: estimate.id,
        versionLabel: estimate.versionLabel,
        savedAt: estimate.createdAt,
        isActiveDraft: estimate.status === 'draft' && !estimate.isLocked,
        isLocked: estimate.isLocked,
        isQuoteSource: quoteSelected,
        costingState: resolveCommandCentreCostingState(selectedDetail?.outputs),
      } : null,
      quote: quote ? {
        id: quote.id,
        quoteRef: quote.quoteRef,
        versionNumber: quote.versionNumber,
        status: quote.status,
        createdAt: quote.createdAt,
        sentAt: quote.sentAt,
        deliveryState: quoteDeliveryState(quote),
      } : null,
      newerEstimate: selection.newerEstimate ? {
        id: selection.newerEstimate.id,
        versionLabel: selection.newerEstimate.versionLabel,
        savedAt: selection.newerEstimate.createdAt,
      } : null,
      latestDeclinedQuote: !quote && selection.latestDeclinedQuote ? {
        quoteVersionId: selection.latestDeclinedQuote.id,
        quoteRef: selection.latestDeclinedQuote.quoteRef,
        versionNumber: selection.latestDeclinedQuote.versionNumber,
        createdAt: selection.latestDeclinedQuote.createdAt,
      } : null,
      warnings,
      links: {
        designs: `${basePath}?tab=estimates`,
        quotes: `${basePath}?tab=quotes`,
        estimate: estimate
          ? `${basePath}?tab=estimates&estimateId=${encodeURIComponent(estimate.id)}`
          : null,
        quote: quote
          ? `${basePath}?tab=quotes&quoteId=${encodeURIComponent(quote.id)}`
          : null,
      },
    },
  };
}
