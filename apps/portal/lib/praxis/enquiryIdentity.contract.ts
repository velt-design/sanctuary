import { createHash } from 'node:crypto';
import { PraxisConnectorError } from './server';

export const ENQUIRY_IDENTITY_VERSION = 'sanctuary.praxis.enquiry-identities.v1' as const;
export const ENQUIRY_IDENTITY_MAX_ROWS = 100;
export const ENQUIRY_IDENTITY_MAX_BYTES = 128 * 1024;
const REFERENCE = /^sp_enq_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UTC_INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;

function invalid(message: string): never {
  throw new PraxisConnectorError(400, 'INVALID_QUERY', message);
}

// Keep all six PostgreSQL fractional digits; Date is used only to validate the calendar.
export function parseEnquiryUtcInstant(value: string): { text: string; micros: bigint } {
  const match = UTC_INSTANT.exec(value);
  if (!match || value.startsWith('0000-')) return invalid('An exact UTC timestamp is required.');
  const fraction = (match[2] ?? '').padEnd(6, '0');
  const milliseconds = `${match[1]}.${fraction.slice(0, 3)}Z`;
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== milliseconds) {
    return invalid('The UTC timestamp is invalid.');
  }
  return { text: `${match[1]}.${fraction}Z`, micros: BigInt(date.valueOf()) * BigInt(1000) + BigInt(fraction.slice(3)) };
}

export type EnquiryIdentityQuery = Readonly<{
  submittedFrom: string;
  submittedBefore: string;
  references: readonly string[];
  suppliedReferenceCount: number;
}>;

export function parseEnquiryIdentityQuery(url: URL): EnquiryIdentityQuery {
  const keys = new Set(['submittedFrom', 'submittedBefore', 'reference']);
  if (Buffer.byteLength(url.search, 'utf8') > 8192 || [...url.searchParams.keys()].some((key) => !keys.has(key))) {
    return invalid('The enquiry identity query is invalid or oversized.');
  }
  for (const key of ['submittedFrom', 'submittedBefore']) {
    if (url.searchParams.getAll(key).length !== 1) return invalid('Supply one explicit UTC submission interval.');
  }
  const from = parseEnquiryUtcInstant(url.searchParams.get('submittedFrom')!);
  const before = parseEnquiryUtcInstant(url.searchParams.get('submittedBefore')!);
  if (before.micros <= from.micros || before.micros - from.micros > BigInt(31) * BigInt(86_400_000_000)) {
    return invalid('The submission interval must be positive and at most 31 days.');
  }
  const supplied = url.searchParams.getAll('reference');
  if (supplied.length > 100 || supplied.some((reference) => !REFERENCE.test(reference))) {
    return invalid('Supply at most 100 valid enquiry dispatch references.');
  }
  return {
    submittedFrom: from.text, submittedBefore: before.text,
    references: [...new Set(supplied)].sort(), suppliedReferenceCount: supplied.length,
  };
}

export function enquiryIdentityQueryFingerprint(query: EnquiryIdentityQuery): string {
  return createHash('sha256').update(JSON.stringify(query)).digest('hex');
}

export type EnquiryIdentityRecord = Readonly<{
  enquiryId: string;
  submissionId: string;
  submittedAt: string;
  submittedAtSource: 'enquiry_requests.created_at';
  inWindow: boolean;
  dispatch: null | Readonly<{
    reference: string;
    enquiryId: string;
    submissionId: string;
    startedAt: string;
  }>;
  receipt: null | Readonly<{
    state: 'missing' | 'recorded';
    outcome: 'accepted' | 'failed' | 'unknown';
    code: string;
    providerApiMessageId: string | null;
    recordedAt: string | null;
    verifiedRfcMessageId: null;
    rfcVerification: 'unverified';
  }>;
  emailEvidence: 'no_intent' | 'missing_receipt' | 'recorded_receipt';
}>;

export type EnquiryIdentityResponse = Readonly<{
  schemaVersion: typeof ENQUIRY_IDENTITY_VERSION;
  requestId: string;
  source: Readonly<{
    sourceKey: string; connectionId: string; environment: string;
    authority: 'canonical'; projectionVersion: typeof ENQUIRY_IDENTITY_VERSION;
    asOf: string; retrievedAt: string;
  }>;
  query: EnquiryIdentityQuery;
  queryFingerprint: string;
  coverage: Readonly<{
    terminal: true; hasMore: false; nextCursor: null;
    windowComplete: true; candidatesComplete: true;
    canonicalRowCount: number; windowEnquiryCount: number;
    uniqueReferenceCount: number; matchedReferenceCount: number; unmatchedReferenceCount: number;
    meaning: 'current_database_snapshot_only';
  }>;
  candidates: readonly Readonly<{
    reference: string; state: 'matched' | 'not_found';
    enquiryId: string | null; submissionId: string | null; submittedAt: string | null; inWindow: boolean | null;
  }>[];
  records: readonly EnquiryIdentityRecord[];
}>;

export function enforceEnquiryIdentityByteLimit(response: EnquiryIdentityResponse): void {
  if (Buffer.byteLength(JSON.stringify(response), 'utf8') > ENQUIRY_IDENTITY_MAX_BYTES) {
    throw new PraxisConnectorError(400, 'SNAPSHOT_TOO_LARGE', 'The identity snapshot exceeds its byte limit; no records are returned.');
  }
}
