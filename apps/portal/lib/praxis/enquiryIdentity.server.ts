import 'server-only';
import {
  createDatabase, loadPraxisConnectorConfig, PraxisConnectorError,
  setReadBudgets, verifyDatabaseIdentity, type PraxisServerDependencies,
} from './server';
import {
  ENQUIRY_IDENTITY_MAX_ROWS, ENQUIRY_IDENTITY_VERSION, enforceEnquiryIdentityByteLimit,
  enquiryIdentityQueryFingerprint, parseEnquiryUtcInstant,
  type EnquiryIdentityQuery, type EnquiryIdentityRecord, type EnquiryIdentityResponse,
} from './enquiryIdentity.contract';

type IdentityRow = {
  enquiry_request_id: string; submission_id: string; submitted_at: string; in_window: boolean;
  reference: string | null; dispatch_submission_id: string | null; dispatch_started_at: string | null;
  receipt_state: 'no_intent' | 'missing' | 'recorded'; outcome: string | null; code: string | null;
  provider_api_message_id: string | null; recorded_at: string | null; verified_rfc_message_id: null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function unavailable(): never {
  throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The enquiry identity projection is invalid.', true);
}

function mapIdentity(row: IdentityRow): EnquiryIdentityRecord {
  if (!UUID.test(row.enquiry_request_id) || !UUID.test(row.submission_id)
      || typeof row.in_window !== 'boolean' || row.verified_rfc_message_id !== null) return unavailable();
  const base = {
    enquiryId: row.enquiry_request_id, submissionId: row.submission_id,
    submittedAt: parseEnquiryUtcInstant(row.submitted_at).text,
    submittedAtSource: 'enquiry_requests.created_at' as const, inWindow: row.in_window,
  };
  if (row.reference === null) {
    if (row.receipt_state !== 'no_intent' || [row.dispatch_submission_id, row.dispatch_started_at,
      row.outcome, row.code, row.provider_api_message_id, row.recorded_at].some((value) => value !== null)) return unavailable();
    return { ...base, dispatch: null, receipt: null, emailEvidence: 'no_intent' };
  }
  if (!UUID_V4.test(row.reference) || row.dispatch_submission_id !== row.submission_id
      || row.dispatch_started_at === null || !['missing', 'recorded'].includes(row.receipt_state)
      || !['accepted', 'failed', 'unknown'].includes(row.outcome ?? '')
      || !row.code || !/^[A-Z][A-Z_]{0,95}$/.test(row.code)) return unavailable();
  const outcome = row.outcome as 'accepted' | 'failed' | 'unknown';
  if (row.receipt_state === 'missing' && (outcome !== 'unknown'
      || row.code !== 'ENQUIRY_EMAIL_RECEIPT_MISSING' || row.recorded_at !== null
      || row.provider_api_message_id !== null)) return unavailable();
  if (row.receipt_state === 'recorded' && row.recorded_at === null) return unavailable();
  if (outcome === 'accepted') {
    if (row.code !== 'RESEND_ACCEPTED' || !row.provider_api_message_id
      || !/^[A-Za-z0-9._:-]{1,256}$/.test(row.provider_api_message_id)) return unavailable();
  } else if (row.provider_api_message_id !== null) return unavailable();
  return {
    ...base,
    dispatch: { reference: `sp_enq_${row.reference}`, enquiryId: base.enquiryId,
      submissionId: row.dispatch_submission_id, startedAt: parseEnquiryUtcInstant(row.dispatch_started_at).text },
    receipt: { state: row.receipt_state as 'missing' | 'recorded', outcome, code: row.code,
      providerApiMessageId: row.provider_api_message_id,
      recordedAt: row.recorded_at === null ? null : parseEnquiryUtcInstant(row.recorded_at).text,
      verifiedRfcMessageId: null, rfcVerification: 'unverified' },
    emailEvidence: row.receipt_state === 'missing' ? 'missing_receipt' : 'recorded_receipt',
  };
}

export async function readEnquiryIdentities(
  query: EnquiryIdentityQuery,
  config: ReturnType<typeof loadPraxisConnectorConfig>,
  requestId: string,
  dependencies: PraxisServerDependencies = { createDatabase },
): Promise<EnquiryIdentityResponse> {
  const client = dependencies.createDatabase(config);
  let snapshot: { asOf: string; rows: IdentityRow[] };
  try {
    snapshot = await client.begin('read only isolation level repeatable read', async (transaction) => {
      await setReadBudgets(transaction);
      await verifyDatabaseIdentity(transaction, config);
      const timestamps = await transaction<{ as_of: string }[]>`
        select to_char(transaction_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as as_of
      `;
      const asOf = parseEnquiryUtcInstant(timestamps[0]!.as_of).text;
      if (parseEnquiryUtcInstant(query.submittedBefore).micros > parseEnquiryUtcInstant(asOf).micros) {
        throw new PraxisConnectorError(400, 'INVALID_QUERY', 'The requested interval is not complete at this snapshot.');
      }
      // The UUID array is a bound parameter, never SQL text; only strict references reach it.
      const references = `{${query.references.map((reference) => reference.slice(7)).join(',')}}`;
      const rows = await transaction<IdentityRow[]>`
        select * from praxis_reporting.enquiry_identity_snapshot_v1(
          ${query.submittedFrom}::timestamptz, ${query.submittedBefore}::timestamptz, ${references}::uuid[]
        )
      `;
      return { asOf, rows };
    });
  } catch (error) {
    if (error instanceof PraxisConnectorError) throw error;
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === '22023') throw new PraxisConnectorError(400, 'INVALID_QUERY', 'The enquiry identity query is invalid.');
    if (['42P01', '42883', '42501'].includes(code)) return unavailable();
    throw new PraxisConnectorError(503, 'SOURCE_UNAVAILABLE', 'The Sanctuary source is unavailable.', true);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
  if (snapshot.rows.length > ENQUIRY_IDENTITY_MAX_ROWS) {
    throw new PraxisConnectorError(400, 'SNAPSHOT_TOO_LARGE', 'The identity snapshot exceeds 100 rows; narrow the interval or candidates. No records are returned.');
  }
  let records: EnquiryIdentityRecord[];
  try { records = snapshot.rows.map(mapIdentity); } catch { return unavailable(); }
  if (new Set(records.map((row) => row.enquiryId)).size !== records.length) return unavailable();
  const byReference = new Map(records.flatMap((row) => row.dispatch ? [[row.dispatch.reference, row] as const] : []));
  if (byReference.size !== records.filter((row) => row.dispatch !== null).length) return unavailable();
  const from = parseEnquiryUtcInstant(query.submittedFrom).micros;
  const before = parseEnquiryUtcInstant(query.submittedBefore).micros;
  for (const row of records) {
    const submitted = parseEnquiryUtcInstant(row.submittedAt).micros;
    if (row.inWindow !== (submitted >= from && submitted < before)
      || (!row.inWindow && (!row.dispatch || !query.references.includes(row.dispatch.reference)))) return unavailable();
  }
  const candidates = query.references.map((reference) => {
    const row = byReference.get(reference);
    return { reference, state: row ? 'matched' as const : 'not_found' as const,
      enquiryId: row?.enquiryId ?? null, submissionId: row?.submissionId ?? null,
      submittedAt: row?.submittedAt ?? null, inWindow: row?.inWindow ?? null };
  });
  const matched = candidates.filter((candidate) => candidate.state === 'matched').length;
  const response: EnquiryIdentityResponse = {
    schemaVersion: ENQUIRY_IDENTITY_VERSION, requestId,
    source: { sourceKey: config.sourceKey, connectionId: config.connectionId, environment: config.environment,
      authority: 'canonical', projectionVersion: ENQUIRY_IDENTITY_VERSION,
      asOf: snapshot.asOf, retrievedAt: new Date().toISOString() },
    query, queryFingerprint: enquiryIdentityQueryFingerprint(query),
    coverage: { terminal: true, hasMore: false, nextCursor: null, windowComplete: true, candidatesComplete: true,
      canonicalRowCount: records.length, windowEnquiryCount: records.filter((row) => row.inWindow).length,
      uniqueReferenceCount: query.references.length, matchedReferenceCount: matched,
      unmatchedReferenceCount: candidates.length - matched, meaning: 'current_database_snapshot_only' },
    candidates, records,
  };
  enforceEnquiryIdentityByteLimit(response);
  return response;
}
