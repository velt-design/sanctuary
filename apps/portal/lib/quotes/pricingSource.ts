import { createHash } from 'crypto';

export type QuotePricingSource = 'calculator_live' | 'workbench_solved';

export type QuotePricingSourceCopyReason =
  | 'quote_created'
  | 'quote_refreshed_from_estimate'
  | 'quote_revised';

export type QuotePricingSourceCopy = {
  pricingSource: QuotePricingSource;
  pricingSourceMetadata: Record<string, unknown>;
  sourceMetadataHash: string;
};

type SourceRecord = Record<string, unknown>;

const DEFAULT_PRICING_SOURCE: QuotePricingSource = 'calculator_live';

const ALLOWED_SOURCE_METADATA_KEYS = [
  'gateVersion',
  'requestedSource',
  'requestedSourceRaw',
  'selectedSource',
  'selectedAt',
  'selectedBy',
  'defaultedReason',
  'rollbackProvenance',
  'commercialInputSchemaVersion',
  'quantityTakeoffSource',
  'trustSummary',
  'commercialInputHash',
  'parityReportHash',
  'parityReportVersion',
  'blockingGateCodes',
] as const;

function isRecord(value: unknown): value is SourceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<SourceRecord>((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function metadataHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function compactMetadataValue(key: (typeof ALLOWED_SOURCE_METADATA_KEYS)[number], value: unknown): unknown {
  if (key === 'trustSummary') {
    if (!isRecord(value)) return null;
    return {
      status: typeof value.status === 'string' ? value.status : null,
      blockingDiagnostics: typeof value.blockingDiagnostics === 'number' ? value.blockingDiagnostics : 0,
    };
  }
  if (key === 'blockingGateCodes') {
    return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  return null;
}

export function normalizeQuotePricingSource(value: unknown): QuotePricingSource {
  return value === 'workbench_solved' || value === 'calculator_live' ? value : DEFAULT_PRICING_SOURCE;
}

export function compactPricingSourceMetadata(value: unknown): SourceRecord {
  if (!isRecord(value)) return {};

  return ALLOWED_SOURCE_METADATA_KEYS.reduce<SourceRecord>((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      acc[key] = compactMetadataValue(key, value[key]);
    }
    return acc;
  }, {});
}

export function buildQuotePricingSourceCopyFromEstimate(params: {
  estimate: {
    pricingSource?: unknown;
    pricing_source?: unknown;
    pricingSourceMetadata?: unknown;
    pricing_source_metadata?: unknown;
  };
  sourceEstimateVersionId: string;
  copiedAt: string;
  copiedBy: string | null;
  copyReason: QuotePricingSourceCopyReason;
}): QuotePricingSourceCopy {
  const pricingSource = normalizeQuotePricingSource(params.estimate.pricingSource ?? params.estimate.pricing_source);
  const compactMetadata = compactPricingSourceMetadata(
    params.estimate.pricingSourceMetadata ?? params.estimate.pricing_source_metadata,
  );
  const sourceMetadataHash = metadataHash({
    pricingSource,
    sourceEstimateVersionId: params.sourceEstimateVersionId,
    sourceMetadata: compactMetadata,
  });

  return {
    pricingSource,
    sourceMetadataHash,
    pricingSourceMetadata: {
      ...compactMetadata,
      sourceEstimateVersionId: params.sourceEstimateVersionId,
      copiedAt: params.copiedAt,
      copiedBy: params.copiedBy,
      copyReason: params.copyReason,
      sourceMetadataHash,
    },
  };
}

export function buildQuotePricingSourceCopyFromQuoteVersion(params: {
  quoteVersion: {
    pricing_source?: unknown;
    pricingSource?: unknown;
    pricing_source_metadata?: unknown;
    pricingSourceMetadata?: unknown;
    source_estimate_version_id?: unknown;
    sourceEstimateVersionId?: unknown;
  };
  copiedAt: string;
  copiedBy: string | null;
  copyReason: QuotePricingSourceCopyReason;
  revisedFromQuoteVersionId?: string | null;
}): QuotePricingSourceCopy | null {
  const rawSource = params.quoteVersion.pricingSource ?? params.quoteVersion.pricing_source;
  if (rawSource !== 'workbench_solved' && rawSource !== 'calculator_live') return null;

  const pricingSource = normalizeQuotePricingSource(rawSource);
  const sourceEstimateVersionId =
    typeof params.quoteVersion.sourceEstimateVersionId === 'string'
      ? params.quoteVersion.sourceEstimateVersionId
      : typeof params.quoteVersion.source_estimate_version_id === 'string'
        ? params.quoteVersion.source_estimate_version_id
        : '';
  const compactMetadata = compactPricingSourceMetadata(
    params.quoteVersion.pricingSourceMetadata ?? params.quoteVersion.pricing_source_metadata,
  );
  const sourceMetadataHash = metadataHash({
    pricingSource,
    sourceEstimateVersionId,
    sourceMetadata: compactMetadata,
  });

  return {
    pricingSource,
    sourceMetadataHash,
    pricingSourceMetadata: {
      ...compactMetadata,
      sourceEstimateVersionId,
      copiedAt: params.copiedAt,
      copiedBy: params.copiedBy,
      copyReason: params.copyReason,
      revisedFromQuoteVersionId: params.revisedFromQuoteVersionId ?? null,
      sourceMetadataHash,
    },
  };
}

export function quotePricingSourceDbColumns(copy: QuotePricingSourceCopy): {
  pricing_source: QuotePricingSource;
  pricing_source_metadata: Record<string, unknown>;
} {
  return {
    pricing_source: copy.pricingSource,
    pricing_source_metadata: copy.pricingSourceMetadata,
  };
}

export function quotePricingSourceAuditPayload(copy: QuotePricingSourceCopy): {
  pricingSource: QuotePricingSource;
  sourceMetadataHash: string;
} {
  return {
    pricingSource: copy.pricingSource,
    sourceMetadataHash: copy.sourceMetadataHash,
  };
}

export function protectedQuoteVersionRefreshReason(input: {
  status: unknown;
  hasDepositInvoice?: boolean;
  hasJobPackGeneration?: boolean;
}): 'status_locked' | 'invoice_backed' | 'job_pack_backed' | null {
  const status = typeof input.status === 'string' ? input.status.toUpperCase() : '';
  if (status === 'SENT' || status === 'ACCEPTED' || status === 'DECLINED') return 'status_locked';
  if (input.hasDepositInvoice) return 'invoice_backed';
  if (input.hasJobPackGeneration) return 'job_pack_backed';
  return null;
}
