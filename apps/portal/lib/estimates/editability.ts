import type { EstimateEditability } from './types';

type QuoteVersionLike = {
  id?: unknown;
  status?: unknown;
  sent_at?: unknown;
  sentAt?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  version_number?: unknown;
  versionNumber?: unknown;
  quote_ref?: unknown;
  quotes?: { quote_ref?: unknown } | Array<{ quote_ref?: unknown }> | null;
};

type QuoteSendLogLike = {
  quote_version_id?: unknown;
  quoteVersionId?: unknown;
  status?: unknown;
  sent_at?: unknown;
  sentAt?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
};

type LockCandidate = {
  quoteVersionId: string | null;
  lockedAt: string | null;
  quoteRef: string | null;
  quoteVersionNumber: number | null;
};

const LOCKING_STATUSES = new Set(['SENT', 'ACCEPTED', 'DECLINED']);

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function quoteRefFromRelation(value: QuoteVersionLike['quotes']): string | null {
  if (Array.isArray(value)) return asTrimmedString(value[0]?.quote_ref);
  return asTrimmedString(value?.quote_ref);
}

function normalizeTimestamp(...values: unknown[]): string | null {
  for (const value of values) {
    const iso = asTrimmedString(value);
    if (!iso) continue;
    const date = new Date(iso);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return null;
}

function compareCandidateDesc(a: LockCandidate, b: LockCandidate): number {
  const aKey = a.lockedAt ?? '';
  const bKey = b.lockedAt ?? '';
  if (aKey !== bKey) return bKey.localeCompare(aKey);
  return (b.quoteVersionNumber ?? -1) - (a.quoteVersionNumber ?? -1);
}

export function emptyEstimateEditability(): EstimateEditability {
  return {
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    lockedByQuoteVersionId: null,
    lockedByQuoteRef: null,
    lockedByQuoteVersionNumber: null,
    hasDraftQuotes: false,
    draftQuoteCount: 0,
  };
}

export function computeEstimateEditability(params: {
  quoteVersions?: QuoteVersionLike[] | null;
  sendLogs?: QuoteSendLogLike[] | null;
}): EstimateEditability {
  const quoteVersions = Array.isArray(params.quoteVersions) ? params.quoteVersions : [];
  const sendLogs = Array.isArray(params.sendLogs) ? params.sendLogs : [];

  const versionsById = new Map<string, QuoteVersionLike>();
  let draftQuoteCount = 0;
  const lockCandidates: LockCandidate[] = [];

  for (const version of quoteVersions) {
    const quoteVersionId = asTrimmedString(version?.id);
    if (quoteVersionId) versionsById.set(quoteVersionId, version);

    const status = asStatus(version?.status);
    if (status === 'DRAFT') draftQuoteCount += 1;
    if (!LOCKING_STATUSES.has(status)) continue;

    lockCandidates.push({
      quoteVersionId,
      lockedAt: normalizeTimestamp(version?.sent_at, version?.sentAt, version?.created_at, version?.createdAt),
      quoteRef: quoteRefFromRelation(version?.quotes) ?? asTrimmedString(version?.quote_ref),
      quoteVersionNumber: asFiniteNumber(version?.version_number) ?? asFiniteNumber(version?.versionNumber),
    });
  }

  for (const log of sendLogs) {
    const status = asStatus(log?.status);
    if (status !== 'SENT') continue;

    const quoteVersionId = asTrimmedString(log?.quote_version_id) ?? asTrimmedString(log?.quoteVersionId);
    const version = quoteVersionId ? versionsById.get(quoteVersionId) : null;
    lockCandidates.push({
      quoteVersionId,
      lockedAt: normalizeTimestamp(log?.sent_at, log?.sentAt, log?.created_at, log?.createdAt),
      quoteRef: quoteRefFromRelation(version?.quotes) ?? asTrimmedString(version?.quote_ref),
      quoteVersionNumber: asFiniteNumber(version?.version_number) ?? asFiniteNumber(version?.versionNumber),
    });
  }

  if (!lockCandidates.length) {
    return {
      ...emptyEstimateEditability(),
      hasDraftQuotes: draftQuoteCount > 0,
      draftQuoteCount,
    };
  }

  lockCandidates.sort(compareCandidateDesc);
  const chosen = lockCandidates[0];

  return {
    isLocked: true,
    lockReason: 'quote_sent',
    lockedAt: chosen.lockedAt,
    lockedByQuoteVersionId: chosen.quoteVersionId,
    lockedByQuoteRef: chosen.quoteRef,
    lockedByQuoteVersionNumber: chosen.quoteVersionNumber,
    hasDraftQuotes: draftQuoteCount > 0,
    draftQuoteCount,
  };
}
