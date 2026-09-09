// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Sql, TransactionSql } from 'postgres';
import { readEnquiryIdentities } from './enquiryIdentity.server';
import {
  ENQUIRY_IDENTITY_MAX_BYTES, enforceEnquiryIdentityByteLimit,
  parseEnquiryIdentityQuery, parseEnquiryUtcInstant,
} from './enquiryIdentity.contract';

const id = (n: number, prefix = '10000000') => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number) => `sp_enq_${id(n, '30000000')}`;
const config = {
  databaseUrl: 'postgres://synthetic@127.0.0.1:1/postgres', databaseSsl: false as const,
  token: 'synthetic-token-longer-than-thirty-two-characters', sourceKey: 'sanctuary',
  connectionId: id(1, 'a0000000'), environment: 'test',
};
const identity = {
  source_key: config.sourceKey, connection_id: config.connectionId, environment: config.environment,
  projection_version: 'sanctuary.praxis.core.v1', runtime_role: 'sanctuary_praxis_reader_test',
  group_member: true, transaction_read_only: true, default_transaction_read_only: true,
  service_role_member: false, can_login: true, is_superuser: false, can_create_database: false,
  can_create_role: false, can_replicate: false, can_bypass_rls: false, only_reporting_membership: true,
  forbidden_schema_create: false, forbidden_table_privilege: false,
  forbidden_sequence_privilege: false, forbidden_definer_function_privilege: false,
};
function query(extra = '') {
  return parseEnquiryIdentityQuery(new URL(`https://example.invalid/?submittedFrom=2020-01-01T00:00:00Z&submittedBefore=2020-01-02T00:00:00Z${extra}`));
}
function row(n: number, extra: Record<string, unknown> = {}) {
  return {
    enquiry_request_id: id(n), submission_id: id(n, '20000000'), submitted_at: '2020-01-01T12:00:00.000001Z',
    in_window: true, reference: null, dispatch_submission_id: null, dispatch_started_at: null,
    receipt_state: 'no_intent', outcome: null, code: null, provider_api_message_id: null,
    recorded_at: null, verified_rfc_message_id: null, ...extra,
  };
}
function dispatch(n: number, extra: Record<string, unknown> = {}) {
  return row(n, { reference: id(n, '30000000'), dispatch_submission_id: id(n, '20000000'),
    dispatch_started_at: '2020-01-01T12:01:00.000002Z', receipt_state: 'missing',
    outcome: 'unknown', code: 'ENQUIRY_EMAIL_RECEIPT_MISSING', ...extra });
}
function database(rows: Record<string, unknown>[], options: { identity?: object; failure?: object } = {}) {
  const transaction = vi.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.startsWith('set local')) return [];
    if (sql.includes('from praxis_reporting.source_identity_v1')) return [options.identity ?? identity];
    if (sql.includes('transaction_timestamp()')) return [{ as_of: '2026-09-09T00:00:00.123456Z' }];
    if (sql.includes('enquiry_identity_snapshot_v1')) {
      if (options.failure) throw options.failure;
      return rows;
    }
    throw new Error('Unexpected synthetic query');
  });
  const end = vi.fn().mockResolvedValue(undefined);
  const begin = vi.fn(async (_mode: string, callback: (sql: TransactionSql) => unknown) => callback(transaction as unknown as TransactionSql));
  return { transaction, end, begin, dependencies: { createDatabase: () => ({ begin, end }) as unknown as Sql } };
}

describe('enquiry identity query', () => {
  it('preserves microseconds, exact 31-day windows and deduplicated references', () => {
    const result = parseEnquiryIdentityQuery(new URL(`https://example.invalid/?submittedFrom=2020-01-01T00:00:00.000001Z&submittedBefore=2020-02-01T00:00:00.000001Z&reference=${ref(1)}&reference=${ref(1)}`));
    expect(result.references).toEqual([ref(1)]);
    expect(result.suppliedReferenceCount).toBe(2);
    expect(result.submittedFrom).toBe('2020-01-01T00:00:00.000001Z');
    expect(parseEnquiryUtcInstant(result.submittedFrom).micros - parseEnquiryUtcInstant('2020-01-01T00:00:00Z').micros).toBe(BigInt(1));
  });
  it.each(['2020-02-30T00:00:00Z', '2020-01-01', '2020-01-01T00:00:00+01:00',
    '2020-01-01T00:00:00.0000001Z', '0000-01-01T00:00:00Z', 'infinity'])('rejects invalid UTC input %s', (time) => {
    expect(() => parseEnquiryUtcInstant(time)).toThrow();
  });
  it.each(['&cursor=x', '&limit=1000', '&submittedFrom=2020-01-01T00:00:00Z',
    '&reference=garbage', `&reference=sp_enq_${id(1).replace('-4000-', '-1000-')}`])('rejects unsupported or ambiguous input %s', (extra) => {
    expect(() => query(extra)).toThrow();
  });
  it('rejects 101 supplied references before deduplication and intervals beyond 31 days', () => {
    expect(() => query(Array.from({ length: 101 }, () => `&reference=${ref(1)}`).join(''))).toThrow();
    expect(() => parseEnquiryIdentityQuery(new URL('https://example.invalid/?submittedFrom=2020-01-01T00:00:00Z&submittedBefore=2020-02-01T00:00:00.000001Z'))).toThrow();
  });
});

describe('enquiry identity snapshot', () => {
  it('maps outside-window candidates without counting them as window enquiries or duplicating rows', async () => {
    const db = database([dispatch(1), dispatch(2, { submitted_at: '2019-12-01T00:00:00.000000Z', in_window: false })]);
    const result = await readEnquiryIdentities(query(`&reference=${ref(1)}&reference=${ref(2)}&reference=${ref(2)}&reference=${ref(3)}`), config, 'request', db.dependencies);
    expect(result.records).toHaveLength(2);
    expect(result.coverage).toMatchObject({ terminal: true, hasMore: false, windowEnquiryCount: 1,
      canonicalRowCount: 2, uniqueReferenceCount: 3, matchedReferenceCount: 2, unmatchedReferenceCount: 1 });
    expect(result.candidates[1]).toMatchObject({ state: 'matched', enquiryId: id(2), inWindow: false });
    expect(result.candidates[2]).toMatchObject({ state: 'not_found', enquiryId: null, inWindow: null });
    expect(result.source.asOf).toBe('2026-09-09T00:00:00.123456Z');
    expect(db.begin).toHaveBeenCalledWith('read only isolation level repeatable read', expect.any(Function));
    expect(db.transaction.mock.calls.filter(([strings]) => strings.join('').includes('enquiry_identity_snapshot_v1'))).toHaveLength(1);
    expect(db.end).toHaveBeenCalledOnce();
  });
  it('keeps no intent, missing receipt, recorded unknown, failed and accepted distinct', async () => {
    const db = database([row(1), dispatch(2), dispatch(3, { receipt_state: 'recorded', code: 'RESEND_TIMEOUT', recorded_at: '2020-01-01T12:02:00Z' }),
      dispatch(4, { receipt_state: 'recorded', outcome: 'failed', code: 'RESEND_VALIDATION_REJECTED', recorded_at: '2020-01-01T12:02:00Z' }),
      dispatch(5, { receipt_state: 'recorded', outcome: 'accepted', code: 'RESEND_ACCEPTED', provider_api_message_id: 'provider-api-identifier', recorded_at: '2020-01-01T12:02:00Z',
        message: 'PRIVATE_CONTENT', payload_hash: 'PRIVATE_HASH', email: 'PRIVATE_ADDRESS' })]);
    const result = await readEnquiryIdentities(query(), config, 'request', db.dependencies);
    expect(result.records.map((record) => [record.emailEvidence, record.receipt?.outcome ?? null])).toEqual([
      ['no_intent', null], ['missing_receipt', 'unknown'], ['recorded_receipt', 'unknown'], ['recorded_receipt', 'failed'], ['recorded_receipt', 'accepted'],
    ]);
    expect(result.records[4]?.receipt).toMatchObject({ verifiedRfcMessageId: null, rfcVerification: 'unverified' });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|delivered|payload_hash|idempotency/);
    expect(result.records[4]?.dispatch).toMatchObject({ enquiryId: id(5), submissionId: id(5, '20000000') });
  });
  it('returns exactly 100 rows but rejects the 101st sentinel without a partial response', async () => {
    const rows = Array.from({ length: 101 }, (_, n) => row(n + 1));
    const accepted = await readEnquiryIdentities(query(), config, 'request', database(rows.slice(0, 100)).dependencies);
    expect(accepted.coverage.canonicalRowCount).toBe(100);
    await expect(readEnquiryIdentities(query(), config, 'request', database(rows).dependencies)).rejects.toMatchObject({ code: 'SNAPSHOT_TOO_LARGE' });
  });
  it('applies the UTF-8 cap to the entire envelope, not only records', async () => {
    const empty = await readEnquiryIdentities(query(), config, 'request', database([]).dependencies);
    expect(empty.coverage).toMatchObject({ terminal: true, canonicalRowCount: 0 });
    const baseSize = Buffer.byteLength(JSON.stringify({ ...empty, requestId: '' }), 'utf8');
    const exact = { ...empty, requestId: 'x'.repeat(ENQUIRY_IDENTITY_MAX_BYTES - baseSize) };
    expect(() => enforceEnquiryIdentityByteLimit(exact)).not.toThrow();
    expect(() => enforceEnquiryIdentityByteLimit({ ...exact, requestId: `${exact.requestId}é` })).toThrow();
  });
  it.each([
    [row(1), row(1)], [dispatch(1, { dispatch_submission_id: id(9) })],
    [dispatch(1, { verified_rfc_message_id: '<unverified@example.invalid>' })],
    [row(1, { in_window: false })], [dispatch(1, { outcome: 'accepted' })],
  ])('rejects inconsistent source identity/provenance instead of completing the snapshot', async (...rows) => {
    await expect(readEnquiryIdentities(query(), config, 'request', database(rows).dependencies)).rejects.toMatchObject({ code: 'PROJECTION_NOT_READY' });
  });
  it('fails before querying when source posture drifts and closes the connection', async () => {
    const db = database([], { identity: { ...identity, service_role_member: true } });
    await expect(readEnquiryIdentities(query(), config, 'request', db.dependencies)).rejects.toMatchObject({ code: 'PROJECTION_NOT_READY' });
    expect(db.transaction.mock.calls.some(([strings]) => strings.join('').includes('enquiry_identity_snapshot_v1'))).toBe(false);
    expect(db.end).toHaveBeenCalledOnce();
  });
  it('rejects an unfinished interval and reports missing projection privileges as unavailable', async () => {
    const future = parseEnquiryIdentityQuery(new URL('https://example.invalid/?submittedFrom=2026-09-09T00:00:00Z&submittedBefore=2026-09-10T00:00:00Z'));
    await expect(readEnquiryIdentities(future, config, 'request', database([]).dependencies)).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(readEnquiryIdentities(query(), config, 'request', database([], { failure: { code: '42501' } }).dependencies)).rejects.toMatchObject({ code: 'PROJECTION_NOT_READY' });
  });
});
