import { computeEstimateEditability } from '@/lib/estimates/editability';
import { appIdFromUuid, isRecord } from '@/lib/supabase/mappers';
import type {
  CommandCentreDeliveryState,
  CommandCentreEstimateCandidate,
  CommandCentreQuoteCandidate,
  CommandCentreQuoteStatus,
} from './types';

export const COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT = `
  estimates(id,project_id,commercial_scope_id,created_at,status,version),
  quotes(
    id,
    quote_ref,
    commercial_scope_id,
    quoteVersions:quote_versions(
      id,
      quote_id,
      version_number,
      status,
      source_estimate_version_id,
      created_at,
      sent_at,
      accepted_at,
      total_inc_gst_cents,
      pricing_source_metadata,
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

// PostgreSQL records microseconds; Date.toISOString alone discards them. Keep
// the remaining fraction for delivery ordering while normalizing the UTC instant.
function preciseDeliveryTimestamp(value: unknown): string | null {
  const iso = isoTimestamp(value);
  if (!iso) return null;
  const fraction = trimmedString(value)?.match(/\.(\d+)(?:z|[+-]\d{2}(?::?\d{2})?)$/i)?.[1] ?? '';
  return `${iso.slice(0, -1)}${fraction.slice(3)}Z`;
}

function compareDeliveryLogs(
  left: CommandCentreQuoteCandidate['sendLogs'][number],
  right: CommandCentreQuoteCandidate['sendLogs'][number],
): number {
  const leftAt = preciseDeliveryTimestamp(left.createdAt ?? left.sentAt);
  const rightAt = preciseDeliveryTimestamp(right.createdAt ?? right.sentAt);
  if (leftAt !== null && rightAt !== null) {
    const milliseconds = Date.parse(rightAt) - Date.parse(leftAt);
    if (milliseconds) return milliseconds;
    const leftFraction = leftAt.match(/\.(\d+)Z$/)?.[1] ?? '';
    const rightFraction = rightAt.match(/\.(\d+)Z$/)?.[1] ?? '';
    const width = Math.max(leftFraction.length, rightFraction.length);
    const fraction = rightFraction.padEnd(width, '0').localeCompare(leftFraction.padEnd(width, '0'));
    if (fraction) return fraction;
  } else if (leftAt !== rightAt) {
    return leftAt === null ? 1 : -1;
  }
  // A truly simultaneous/undated failure remains visible regardless of transport
  // order. Accepted and draft quote semantics are handled before log selection.
  return Number(right.status === 'FAILED') - Number(left.status === 'FAILED');
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function estimateStatus(value: unknown): CommandCentreEstimateCandidate['status'] {
  const status = trimmedString(value)?.toLowerCase();
  if (status === 'draft' || status === 'archived') return status;
  return 'unknown';
}

function quoteStatus(value: unknown): CommandCentreQuoteStatus | null {
  const status = trimmedString(value)?.toUpperCase();
  if (
    status === 'DRAFT' ||
    status === 'SENT' ||
    status === 'ACCEPTED' ||
    status === 'DECLINED' ||
    status === 'SUPERSEDED'
  ) {
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
            createdAt: preciseDeliveryTimestamp(log.created_at),
            sentAt: preciseDeliveryTimestamp(log.sent_at),
          } as const;
        })
        .filter((log): log is NonNullable<typeof log> => log !== null);
      out.push({
        ...(version.pricing_source_metadata !== undefined ? {pricingSourceMetadata:version.pricing_source_metadata} : {}),
        id: appIdFromUuid('qv', sourceId),
        sourceId,
        quoteRef,
        versionNumber: positiveInteger(version.version_number),
        status,
        acceptedAt: isoTimestamp(version.accepted_at),
        sourceEstimateId: trimmedString(version.source_estimate_version_id),
        createdAt: isoTimestamp(version.created_at),
        sentAt: isoTimestamp(version.sent_at),
        totalIncGstCents: nonNegativeInteger(version.total_inc_gst_cents),
        sendLogs: logs,
        commercialScopeId: trimmedString(quote.commercial_scope_id),
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
      isLocked: editability.isLocked,
      commercialScopeId: trimmedString(row.commercial_scope_id),
    }];
  });
}

export function normalizeCommandCentreCommercialCandidates(
  projectRow: Record<string, unknown>,
): {
  estimates: CommandCentreEstimateCandidate[];
  quotes: CommandCentreQuoteCandidate[];
} {
  const quotes = normalizeQuoteRows(projectRow);
  return {
    estimates: normalizeEstimateRows(projectRow, quotes),
    quotes,
  };
}

export function commandCentreQuoteDeliveryState(
  quote: CommandCentreQuoteCandidate,
): CommandCentreDeliveryState {
  if (quote.status === 'ACCEPTED') return 'accepted';
  if (quote.status === 'DRAFT') return 'draft';
  const latestLog = quote.sendLogs.slice().sort(compareDeliveryLogs)[0];
  return latestLog?.status === 'FAILED' ? 'failed' : 'sent';
}
